# Build issues

Troubleshooting for building and running TIIIErminal from source. For first-time setup, see [INSTALLATION.md](INSTALLATION.md).

## Standard builds and tagged releases

The normal build is Tauri's standard release pipeline: `build` compiles Angular, Tauri reads `frontendDist`, Cargo compiles the native app, and Tauri bundles the platform installers. The `build:windows`, `build:macos`, and `build:linux` commands use native bundlers and Cargo's lockfile. Run each on its matching operating system. Bundles are copied to `dist/bundles/` by format; Tauri also keeps its originals in `src-tauri/target/release/bundle/`. Existing bundles are not removed.

For repeatable tagged releases, set the same version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`, update their lockfiles, commit, then create and push a stable tag such as `v0.1.0`. Run the following separately on each OS:

```sh
bun run build:last-tag
bun run publish:last-tag
```

Building uses an isolated checkout of the highest stable version tag and writes installers plus a checksum manifest under `docs/releases/<tag>/artifacts/<platform>-<architecture>/`. It also automatically creates `docs/releases/<tag>/screenshots/` with captures of the tagged app's themes and settings, using illustrative shell output. Previous files for that platform are replaced; other platform assets are retained. Publishing verifies the build/tag/checksums and creates or updates the same GitHub release without deleting the other platforms' assets. No tag or release is created by the build step.

See [build script](../scripts/build-last-tagged-version/build-last-tagged-version.md) and [publish script](../scripts/publish-last-tagged-version/publish-last-tagged-version.md) for prerequisites, signing, browser dependencies, and exact outputs. macOS/Windows signing credentials remain the standard Tauri build environment's responsibility.

Future version bumps use `@tertium/gith`: `bun run release:patch` from `main`, or `bun run release:minor` / `bun run release:major` from `develop`. These explicitly enable npm version updates and perform gith's Git release flow. The npm `version` hook synchronizes Tauri, Cargo.toml, and the app's Cargo.lock entry before npm commits and tags the new version. These commands do not build installers; run the tagged build and publisher afterward on each platform.

## Missing WebKitGTK 4.1 (Linux)

If the build fails with:

```
The system library `javascriptcoregtk-4.1` required by crate `javascriptcore-rs-sys` was not found.
```

WebKitGTK 4.1 is not installed. Install the `webkit2gtk-4.1` package (Arch) or `libwebkit2gtk-4.1-dev` (Debian/Ubuntu), then confirm that pkg-config can see it:

```sh
pkg-config --modversion javascriptcoregtk-4.1
pkg-config --modversion webkit2gtk-4.1
```

Both commands should print a version number. If they do not, check that `PKG_CONFIG_PATH` is not overriding the default search path.

## Build fails after a system update

Clear the Rust build cache and build again:

```sh
cargo clean --manifest-path src-tauri/Cargo.toml
bun run build:linux
```

## Window opens but stays blank (Linux)

WebKitGTK can fail to paint on some GPU drivers. This was seen with an NVIDIA GPU on X11 with a compositor such as picom: the process starts and the window appears, but nothing is drawn, and the terminal logs `Failed to create GBM buffer`.

The app works around this at startup by setting `WEBKIT_DISABLE_DMABUF_RENDERER=1` and `LIBGL_ALWAYS_SOFTWARE=1`. It sets each variable only if it is not already set, so you can set both yourself before launching to choose different values. Software GL can be slower for heavy output.

On Linux the window is also opaque (`src-tauri/tauri.linux.conf.json`). A transparent window stayed blank until clicked and then went fully see-through under a compositor. Windows and macOS keep the transparent window from `tauri.conf.json`.

If the window is still blank with these set, check that WebKitGTK is version 4.1 and that the GPU driver is current.
