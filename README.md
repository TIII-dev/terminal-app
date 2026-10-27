# TIIIErminal

A compact terminal desktop app built with Angular 22, Tauri 2, xterm.js, and a native PTY. UI state uses signals and zoneless change detection.

Tabs, settings, and window controls share one compact row. macOS uses traffic lights on the left; Windows and Linux use controls on the right. Drag the empty space in this row to move the window.

## Requirements

- Bun and Node.js matching `^22.22.3 || ^24.15.0 || >=26.0.0`
- Rust and the Tauri platform prerequisites for your operating system
- PowerShell 7 on Windows (`pwsh.exe` on PATH or installed in `ProgramFiles/PowerShell/7`)

## Run

```sh
bun install
bun run tauri:dev
```

Run the frontend alone with `bun run dev`. Build desktop bundles on the corresponding operating system with `bun run build:windows` (NSIS/MSI), `bun run build:macos` (app/DMG), or `bun run build:linux` (Deb/RPM/AppImage). The app is named TIIIErminal; its executable is `tiiierminal.exe` on Windows and `tiiierminal` on macOS/Linux.

Each terminal starts in the user's home directory. Windows defaults to PowerShell 7 with its user startup profiles enabled. macOS and Linux default to the user's `$SHELL` and launch it as a login shell.

The application menu contains Settings and About. Settings → Main includes shell profiles, a searchable installed-font combobox, terminal font size, and application scale (50–200%). Theme contains the coding themes and updates every terminal's background, foreground, cursor, selection, and ANSI palette immediately, including new tabs. Programs that emit explicit RGB colors retain those colors. Font detection scans standard system and user font directories. Shell profile, theme, font, font size, and scale save automatically in the WebView's disk-backed local storage under `tiii-terminal-settings` and restore before the first terminal opens. Development and packaged builds use separate WebView origins and settings. Invalid saved settings or unavailable saved shells/fonts stop startup; remove that local-storage entry to reset preferences.

Profiles affect new tabs; existing sessions keep their shell. Windows also detects Windows PowerShell and Command Prompt from PATH. macOS and Linux also detect installed Zsh, Bash, Fish, and POSIX shells in their standard system locations. Scrollbars are thin and follow the terminal theme.

## Tabs and groups

Tab numbers follow their left-to-right positions and update when tabs move, close, or join groups. Number shortcuts select those same positions. Each open tab has a unique icon that stays with its terminal when it moves. New icons are randomly chosen from the unused monochrome presets; additional geometric icons are generated when the presets are occupied. Right-click a tab and choose **Edit icon** to select a built-in icon or upload any valid SVG, JPG, or PNG image. Uploaded images are embedded in the tab, so moving or deleting the source file does not affect them. Icons remain when tabs are moved or reopened during the current session; tabs are not restored after restarting the app. SVG uploads render as images, without executing embedded scripts. Click the close button or middle-click a tab to close it. Closing the final tab closes the window. Drag tabs to reorder them; right-click a tab to create a named, colored group or move it into an existing group. Click a group's label to collapse it (the active tab stays visible), or right-click the label to rename, recolor, ungroup, or close the group. Drop a tab onto a group label to join it.

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| New tab | Ctrl+T | Cmd+T |
| Close tab | Ctrl+W | Cmd+W |
| Reopen closed tab | Ctrl+Shift+T | Cmd+Shift+T |
| Next / previous tab | Ctrl+Tab / Ctrl+Shift+Tab | Ctrl+Tab / Ctrl+Shift+Tab |
| Select tabs 1–9 by number | Ctrl+1–9 | Cmd+1–9 |
| Move tab left / right | Ctrl+Shift+PageUp / PageDown | Ctrl+Shift+PageUp / PageDown |
| Close window | Ctrl+Shift+W | Cmd+Shift+W |

Reopening a closed tab starts a fresh shell; it does not restore the terminated process. Run the UI and tab behavior tests with `bun test` and the Rust tests with `cargo test --manifest-path src-tauri/Cargo.toml --lib`. UI tests run zoneless with native async functions and mock the native window and terminal-rendering boundaries.
