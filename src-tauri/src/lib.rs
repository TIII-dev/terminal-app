mod shell_profile;

use portable_pty::{native_pty_system, Child, MasterPty, PtySize};
use serde::Serialize;
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, State};

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
struct Sessions(Mutex<HashMap<String, Session>>);

#[derive(Serialize, Clone)]
struct Output {
    id: String,
    data: Vec<u8>,
}

#[tauri::command]
fn open_terminal(
    app: AppHandle,
    sessions: State<'_, Sessions>,
    id: String,
    cols: u16,
    rows: u16,
    profile_id: String,
    directory: Option<String>,
) -> Result<(), String> {
    let profile = shell_profile::detect_profiles()?
        .into_iter()
        .find(|profile| profile.id == profile_id)
        .ok_or("Unknown shell profile - select an installed profile in Settings")?;
    let mut command = profile.command();
    let home = std::env::home_dir().ok_or("Could not find the user home directory")?;
    let directory = directory
        .map(std::path::PathBuf::from)
        .filter(|path| path.is_absolute() && path.is_dir())
        .unwrap_or(home);
    command.cwd(directory);
    let pty = native_pty_system()
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())?;
    let child = pty
        .slave
        .spawn_command(command)
        .map_err(|error| error.to_string())?;
    #[cfg(target_os = "linux")]
    let process_id = child.process_id();
    drop(pty.slave);
    let mut reader = pty
        .master
        .try_clone_reader()
        .map_err(|error| error.to_string())?;
    let writer = pty
        .master
        .take_writer()
        .map_err(|error| error.to_string())?;
    sessions
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .insert(
            id.clone(),
            Session {
                master: pty.master,
                writer,
                child,
            },
        );
    #[cfg(target_os = "linux")]
    if let Some(process_id) = process_id {
        let app = app.clone();
        let id = id.clone();
        std::thread::spawn(move || {
            let mut previous = None;
            while let Ok(directory) = std::fs::read_link(format!("/proc/{process_id}/cwd")) {
                if previous.as_ref() != Some(&directory) {
                    let _ = app.emit(
                        "terminal-directory",
                        serde_json::json!({ "id": id, "directory": directory }),
                    );
                    previous = Some(directory);
                }
                std::thread::sleep(std::time::Duration::from_millis(250));
            }
        });
    }
    std::thread::spawn(move || {
        let mut buffer = [0; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(length) => {
                    let _ = app.emit(
                        "terminal-output",
                        Output {
                            id: id.clone(),
                            data: buffer[..length].to_vec(),
                        },
                    );
                }
            }
        }
    });
    Ok(())
}

#[tauri::command]
fn write_terminal(sessions: State<'_, Sessions>, id: String, data: String) -> Result<(), String> {
    sessions
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .get_mut(&id)
        .ok_or("Terminal session not found")?
        .writer
        .write_all(data.as_bytes())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn resize_terminal(
    sessions: State<'_, Sessions>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    sessions
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .get_mut(&id)
        .ok_or("Terminal session not found")?
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn close_terminal(sessions: State<'_, Sessions>, id: String) -> Result<(), String> {
    let mut sessions = sessions.0.lock().map_err(|error| error.to_string())?;
    if let Some(session) = sessions.get_mut(&id) {
        if session
            .child
            .try_wait()
            .map_err(|error| error.to_string())?
            .is_none()
        {
            session.child.kill().map_err(|error| error.to_string())?;
            session.child.wait().map_err(|error| error.to_string())?;
        }
    }
    sessions.remove(&id);
    Ok(())
}

#[tauri::command]
fn get_platform() -> &'static str {
    std::env::consts::OS
}

// Synchronous commands run on the main thread, as required by GTK.
#[tauri::command]
fn read_clipboard() -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        Ok(gtk::Clipboard::get(&gtk::gdk::SELECTION_CLIPBOARD)
            .wait_for_text()
            .map(|text| text.to_string())
            .unwrap_or_default())
    }
    #[cfg(not(target_os = "linux"))]
    arboard::Clipboard::new()
        .and_then(|mut clipboard| clipboard.get_text())
        .map_err(|error| {
            format!("Could not read clipboard - copy some text and try again: {error}")
        })
}

#[tauri::command]
fn write_clipboard(text: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let clipboard = gtk::Clipboard::get(&gtk::gdk::SELECTION_CLIPBOARD);
        clipboard.set_text(&text);
        clipboard.store();
        Ok(())
    }
    #[cfg(not(target_os = "linux"))]
    {
        arboard::Clipboard::new()
            .and_then(|mut clipboard| clipboard.set_text(text))
            .map_err(|error| format!("Could not write clipboard - try copying again: {error}"))
    }
}

#[tauri::command]
fn get_profiles() -> Result<Vec<shell_profile::ShellProfile>, String> {
    shell_profile::detect_profiles()
}

#[tauri::command]
async fn get_fonts() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut database = fontdb::Database::new();
        // shortcut: scans standard font directories; use native font registries if custom font locations are needed.
        database.load_system_fonts();
        let mut families: Vec<_> = database
            .faces()
            .flat_map(|face| face.families.iter().map(|(name, _)| name.clone()))
            .collect();
        families.sort_unstable();
        families.dedup();
        if families.is_empty() {
            return Err(
                "No installed fonts detected - install a font in your system's font directory"
                    .into(),
            );
        }
        Ok(families)
    })
    .await
    .map_err(|error| error.to_string())?
}

pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            #[cfg(target_os = "linux")]
            {
                use gtk::prelude::{GtkWindowExt, WidgetExt};
                use tauri::Manager;

                let window = _app.get_webview_window("main").ok_or(
                    "Missing main window - set its label to main in the Linux configuration",
                )?;
                let titlebar = gtk::Box::new(gtk::Orientation::Horizontal, 0);
                titlebar.set_no_show_all(true);
                // Install before showing the window so GTK keeps the frame without a title bar.
                window.gtk_window()?.set_titlebar(Some(&titlebar));
                window.show()?;
            }
            Ok(())
        })
        .manage(Sessions::default())
        .invoke_handler(tauri::generate_handler![
            open_terminal,
            write_terminal,
            resize_terminal,
            close_terminal,
            get_platform,
            get_profiles,
            get_fonts,
            read_clipboard,
            write_clipboard
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
