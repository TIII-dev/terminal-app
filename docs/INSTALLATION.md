# Installation

This guide covers preparing a machine to run and build TIIIErminal from source. For what the app does once it is running, see the [README](../README.md).

## Requirements

All platforms need:

- **Bun** and **Node.js** matching `^22.22.3 || ^24.15.0 || >=26.0.0`
- **Rust** (stable toolchain, installed with [rustup](https://rustup.rs))
- The **Tauri platform prerequisites** for your operating system (see below)

Windows also needs **PowerShell 7** (`pwsh.exe` on `PATH`, or installed in `ProgramFiles/PowerShell/7`).

## Platform prerequisites

### Linux

Tauri 2 builds against WebKitGTK 4.1 and the related GTK libraries. Install the packages for your distribution before running `bun install`.

**Arch Linux / CachyOS / Manjaro**

```sh
sudo pacman -S --needed base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg xdotool webkit2gtk-4.1
```

**Debian / Ubuntu**

```sh
sudo apt update
sudo apt install build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libwebkit2gtk-4.1-dev
```

**Fedora**

```sh
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel libxdo-devel
sudo dnf group install "C Development Tools and Libraries"
```

If the build fails because `javascriptcoregtk-4.1` is not found, see [BUILD.md](BUILD.md).

### macOS

Install the Xcode Command Line Tools:

```sh
xcode-select --install
```

### Windows

- Install **Visual Studio Build Tools** with the "Desktop development with C++" workload.
- WebView2 is required. It ships with Windows 11 and most current Windows 10 installs; the Tauri installer can add it if it is missing.
- Install **PowerShell 7** from the [official releases](https://github.com/PowerShell/PowerShell/releases).

## Install dependencies

From the project root:

```sh
bun install
```

## Run in development

```sh
bun run tauri:dev
```

To run only the Angular frontend in a browser, use `bun run dev`. The frontend alone does not start the native PTY, so terminals will not work in that mode.

## Build desktop bundles

Build on the operating system you are targeting:

| Platform | Command | Bundles |
| --- | --- | --- |
| Windows | `bun run build:windows` | NSIS, MSI |
| macOS | `bun run build:macos` | `.app`, DMG |
| Linux | `bun run build:linux` | Deb, RPM, AppImage |

Bundles are written under `src-tauri/target/release/bundle/`.

## Verify the installation

Run the test suites:

```sh
bun test
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

## Troubleshooting

- **Build errors** (missing WebKitGTK, failed builds after updates, blank window on Linux): see [BUILD.md](BUILD.md).
- **App refuses to start with a settings or tab error:** a saved preference points to a shell or font that is no longer installed. Remove the `tiii-terminal-settings` or `tiii-terminal-tabs` entry from the WebView's local storage to reset it. Saved preferences are described in the [README](../README.md).
