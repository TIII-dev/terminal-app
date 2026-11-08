# Build the latest tagged version

Run `bun run build:last-tag` from any Windows, macOS, or Linux checkout with dependencies installed. The script detects the host OS and x64/arm64 architecture, fetches tags from `origin`, and selects the highest stable `vMAJOR.MINOR.PATCH` tag using Git's version ordering. Preview tags are excluded. No tags means an actionable error; a tag is never created automatically.

The tag is built in a temporary detached Git worktree under ignored `.release-worktrees/`. Your working branch, edits, and installed app are untouched. The tagged package, Tauri configuration, and Cargo package must all match the tag's version. Dependencies are installed from its frozen Bun lockfile. The script runs that checkout's `build:windows`, `build:macos`, or `build:linux` command. These are normal Tauri CLI builds using Cargo's lockfile. The worktree is removed after success or failure.

## Requirements

- Bun, Git, and the platform's normal Tauri/Rust build prerequisites from `docs/INSTALLATION.md`.
- Run `bun install` in this checkout before using the release scripts.
- Native x64 or arm64 builds. Unset `CARGO_TARGET_DIR` and `CARGO_BUILD_TARGET`; custom Cargo target directories/triples are not supported by this wrapper.
- Playwright's Chromium is installed automatically into its browser cache. Linux may also need browser system libraries: install them using `bunx playwright install-deps chromium` before building.
- Standard Tauri signing/notarization environment variables are inherited. This script does not provide signing identities or certificates.

## Outputs

For `v0.1.0` on Windows x64:

```text
docs/releases/v0.1.0/
  artifacts/windows-x64/
    terminal-v0.1.0-windows-x64-<installer>.exe
    terminal-v0.1.0-windows-x64-<installer>.msi
    manifest.json
  screenshots/
    terminal-v0.1.0-windows-x64-tiii.png
    terminal-v0.1.0-windows-x64-settings.png
    ...other tagged themes...
```

Windows produces NSIS/MSI, macOS produces DMG and a zipped `.app` bundle, and Linux produces Deb/RPM/AppImage. macOS uses its standard `ditto` command to archive the app bundle. Every requested format must exist; missing formats stop the script.

The current platform/architecture's old artifacts are replaced after build and screenshots succeed. Other platforms' files remain intact. The manifest records the exact tag commit and each file's SHA-256 and size. Installer directories are ignored by Git; screenshots can be reviewed and committed normally. These images use the tagged app's real frontend with illustrative shell output and simulated native desktop calls; they are not native-window/compositor screenshots and never read personal terminal sessions.
