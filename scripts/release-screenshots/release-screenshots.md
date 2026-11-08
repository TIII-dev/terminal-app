# Release screenshots

`captureScreenshots` is called by `scripts/build-last-tagged-version/` after the tagged Tauri build succeeds. It serves that checkout's compiled frontend on a temporary loopback port and captures each of its theme palettes plus the theme settings panel at 1280 × 680. The native-call fixture uses the host platform's controls and a deterministic illustrative terminal session. The app's own terminal renderer draws all output.

Inputs are the tagged source checkout, output directory, version tag, host platform, and architecture. Files are named `terminal-<tag>-<platform>-<architecture>-<theme>.png` and written under `docs/releases/<tag>/screenshots/`. The browser/server are closed even if capture fails. Unexpected native calls or missing tagged frontend/theme/icon data fail the build.

No real shell is started, personal settings are not read, and the native app's acrylic/compositor appearance is not captured. Use a manual desktop screenshot if a release needs to demonstrate OS blur effects.
