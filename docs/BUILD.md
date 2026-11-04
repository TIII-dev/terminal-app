# Build issues

Troubleshooting for building and running TIIIErminal from source. For first-time setup, see [INSTALLATION.md](INSTALLATION.md).

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
