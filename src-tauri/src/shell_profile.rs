use portable_pty::CommandBuilder;
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellProfile {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    #[serde(skip_serializing)]
    executable: PathBuf,
}

impl ShellProfile {
    pub fn command(&self) -> CommandBuilder {
        let mut command = CommandBuilder::new(&self.executable);
        match self.executable.file_stem().and_then(|name| name.to_str()) {
            Some("pwsh" | "powershell") => command.args(["-NoLogo"]),
            Some("cmd") => {},
            _ => command.args(["-l"]),
        }
        command
    }
}

fn find_executable(program: &Path, search_paths: &[PathBuf]) -> Option<PathBuf> {
    if program.is_absolute() {
        return program.is_file().then(|| program.to_owned());
    }
    search_paths.iter().map(|directory| directory.join(program)).find(|path| path.is_file())
}

#[cfg(target_os = "windows")]
pub fn detect_profiles() -> Result<Vec<ShellProfile>, String> {
    let path = std::env::var_os("PATH").ok_or("Missing PATH - add your installed shells to PATH")?;
    let program_files = std::env::var_os("ProgramFiles").ok_or("Missing ProgramFiles - restore the Windows environment variable")?;
    let mut search_paths = vec![PathBuf::from(program_files).join("PowerShell/7")];
    search_paths.extend(std::env::split_paths(&path));
    let profiles: Vec<_> = [
        ("pwsh", "PowerShell 7", "pwsh.exe"),
        ("powershell", "Windows PowerShell", "powershell.exe"),
        ("cmd", "Command Prompt", "cmd.exe"),
    ].into_iter().filter_map(|(id, name, executable)| {
        find_executable(Path::new(executable), &search_paths).map(|executable| ShellProfile {
            id: id.into(), name: name.into(), is_default: id == "pwsh", executable,
        })
    }).collect();
    if !profiles.iter().any(|profile| profile.is_default) {
        return Err("PowerShell 7 not found - install PowerShell 7 and add pwsh.exe to PATH, then restart TIII Terminal".into());
    }
    Ok(profiles)
}

#[cfg(not(target_os = "windows"))]
pub fn detect_profiles() -> Result<Vec<ShellProfile>, String> {
    let shell = std::env::var_os("SHELL").ok_or("Missing SHELL - set it to your login shell's absolute path")?;
    let executable = find_executable(Path::new(&shell), &[]).ok_or("Login shell not found - set SHELL to an installed shell's absolute path")?;
    let name = executable.file_name().ok_or("Invalid SHELL - set it to an executable file")?.to_string_lossy().into_owned();
    let mut profiles = vec![ShellProfile { id: "default".into(), name, is_default: true, executable }];
    for (id, name, path) in [("zsh", "Zsh", "/bin/zsh"), ("bash", "Bash", "/bin/bash"), ("fish", "Fish", "/usr/bin/fish"), ("sh", "POSIX shell", "/bin/sh")] {
        if let Some(executable) = find_executable(Path::new(path), &[]) {
            if executable.canonicalize().map_err(|error| error.to_string())? != profiles[0].executable.canonicalize().map_err(|error| error.to_string())? {
                profiles.push(ShellProfile { id: id.into(), name: name.into(), is_default: false, executable });
            }
        }
    }
    Ok(profiles)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;

    #[test]
    fn powershell_starts_with_user_profiles_enabled() {
        let profile = ShellProfile { id: "pwsh".into(), name: "PowerShell 7".into(), is_default: true, executable: "pwsh.exe".into() };
        assert_eq!(profile.command().get_argv(), &vec![OsString::from("pwsh.exe"), OsString::from("-NoLogo")]);
    }

    #[test]
    fn unix_shell_loads_login_startup_files() {
        let profile = ShellProfile { id: "default".into(), name: "Zsh".into(), is_default: true, executable: "/bin/zsh".into() };
        assert_eq!(profile.command().get_argv(), &vec![OsString::from("/bin/zsh"), OsString::from("-l")]);
    }

    #[test]
    fn powershell_as_the_user_login_shell_uses_powershell_startup_options() {
        let profile = ShellProfile { id: "default".into(), name: "pwsh".into(), is_default: true, executable: "/usr/bin/pwsh".into() };
        assert_eq!(profile.command().get_argv(), &vec![OsString::from("/usr/bin/pwsh"), OsString::from("-NoLogo")]);
    }

    #[test]
    fn command_prompt_receives_no_powershell_arguments() {
        let profile = ShellProfile { id: "cmd".into(), name: "Command Prompt".into(), is_default: false, executable: "cmd.exe".into() };
        assert_eq!(profile.command().get_argv(), &vec![OsString::from("cmd.exe")]);
    }
}
