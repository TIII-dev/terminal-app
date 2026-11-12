#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK paints a blank window on some Linux GPU drivers (for example NVIDIA
    // on X11 with a compositor). Fall back to the non-DMABUF renderer and software GL
    // unless the user has already set these variables.
    #[cfg(target_os = "linux")]
    for (key, value) in [
        ("WEBKIT_DISABLE_DMABUF_RENDERER", "1"),
        ("LIBGL_ALWAYS_SOFTWARE", "1"),
    ] {
        if std::env::var_os(key).is_none() {
            std::env::set_var(key, value);
        }
    }
    tiii_terminal_app_lib::run();
}
