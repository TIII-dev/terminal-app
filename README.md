# TIIIErminal

<img src="assets/logo/logo.png" width="96" alt="TIIIErminal lavender terminal prompt and mint block cursor">

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

The application menu contains Settings and About. Settings → Main includes shell profiles, a searchable installed-font combobox, terminal font size, application scale (50–200%), and acrylic opacity (0–100%). TIII is the default theme, using the same terminal palette as the TIII editor; existing saved theme choices are preserved. Settings → Theme contains the coding themes and updates every terminal's background, foreground, cursor, selection, and ANSI palette immediately, including new tabs. The header, tab labels, monochrome icons, active-tab highlight, and menus also use the selected palette. The header and terminal body share one background layer, so opacity is applied once. The terminal body uses the selected theme background; xterm renders its default cell background transparently over that surface. Acrylic opacity changes only the background tint: 100% is opaque and lower values reveal native acrylic on Windows or vibrancy on macOS. This Linux build uses an opaque native window, so the opacity control is disabled and the theme background stays exact. The saved opacity preference is retained. Text remains opaque, and programs that explicitly paint cell backgrounds or emit RGB colors retain those colors. Font detection scans standard system and user font directories. Shell profile, theme, font, font size, scale, and acrylic opacity save automatically in the WebView's disk-backed local storage under `tiii-terminal-settings` and restore before the first terminal opens. Existing saved preferences migrate to 100% opacity. Development and packaged builds use separate WebView origins and settings. Native transparency changes require restarting the desktop app. Invalid saved settings or unavailable saved shells/fonts stop startup; remove that local-storage entry to reset preferences.

Profiles affect new tabs; existing sessions keep their shell. Windows also detects Windows PowerShell and Command Prompt from PATH. macOS and Linux also detect installed Zsh, Bash, Fish, and POSIX shells in their standard system locations. Scrollbars are thin and follow the terminal theme.

Format source files with `bun run format:ts`, `bun run format:css`, and `bun run format:rs`. TypeScript and CSS use Bun's built-in formatter; Rust uses rustfmt through Cargo.

## Install an existing Linux build

Run `npm run install:linux` (or `npm run install:linux:arch` on Arch/CachyOS). This installs the existing `src-tauri/target/release/tiiierminal` binary to `~/.local/bin` and adds an application-menu launcher and icon under `${XDG_DATA_HOME:-~/.local/share}`. No rebuild or sudo is needed. The system must already have the Tauri Linux runtime dependencies installed.

Run the command again after building to update the installed app. Add `~/.local/bin` to your `PATH` to launch it as `tiiierminal` from a shell.

## Tabs and groups

Open tabs, their order, shell profiles, icons, groups (names, colors, collapsed state), and the active tab save automatically under `tiii-terminal-tabs` in disk-backed WebView local storage. Startup restores the layout and opens a fresh shell in each tab; running processes, working directories, and terminal output are not restored. Closing the last tab clears the layout, so the next startup opens one new tab. Invalid saved layouts or unavailable shells stop startup without overwriting the saved layout; remove that storage entry to reset it.

Tab numbers follow their left-to-right positions and update when tabs move, close, or join groups. Number shortcuts select those same positions. Each open tab has a unique icon that stays with its terminal when it moves. New icons are randomly chosen from the unused monochrome presets; additional geometric icons are generated when the presets are occupied. Right-click a tab and choose **Edit icon** to select a built-in icon or upload any valid SVG, JPG, or PNG image. Uploaded images are embedded in the tab, so moving or deleting the source file does not affect them. Icons remain when tabs are moved, reopened, or restored after restarting the app. SVG uploads render as images, without executing embedded scripts. Click the close button or middle-click a tab to close it. Closing the final tab closes the window. Drag a tab onto another tab to move it to that position; tab numbers and numeric hotkeys update immediately. Right-click a tab to create a named, colored group or move it into an existing group. Click a group's label to collapse it (the active tab stays visible), or right-click the label to rename, recolor, ungroup, or close the group. Drop a tab onto a group label to join it.

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| New tab | Ctrl+T | Cmd+T |
| Close tab | Ctrl+W | Cmd+W |
| Reopen closed tab | Ctrl+Shift+T | Cmd+Shift+T |
| Next / previous tab | Ctrl+Tab / Ctrl+Shift+Tab | Ctrl+Tab / Ctrl+Shift+Tab |
| Select tabs 1–9 by number | Ctrl+1–9 | Cmd+1–9 |
| Move tab left / right | Ctrl+Shift+PageUp / PageDown | Ctrl+Shift+PageUp / PageDown |
| Close window | Ctrl+Shift+W | Cmd+Shift+W |

Right-click the terminal for Copy, Paste, Select all, and Clear scrollback. Copy and Paste use the native system clipboard on every desktop platform, avoiding WebView clipboard permission prompts. Copy is disabled without a selection. Right-clicking a tab continues to show tab actions.

On Linux, copy terminal selections with **Ctrl+Shift+C** and paste with **Ctrl+Shift+V**. **Ctrl+C** remains the shell interrupt shortcut. Pasting respects the terminal's bracketed paste mode.

Reopening a closed tab starts a fresh shell; it does not restore the terminated process. Run the UI and tab behavior tests with `bun test` and the Rust tests with `cargo test --manifest-path src-tauri/Cargo.toml --lib`. UI tests run zoneless with native async functions and mock the native window and terminal-rendering boundaries.
