#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != Linux ]]; then
  echo 'This installer requires Linux.' >&2
  exit 1
fi

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
binary="$project_dir/src-tauri/target/release/tiiierminal"
bin_dir="$HOME/.local/bin"
data_dir="${XDG_DATA_HOME:-$HOME/.local/share}"

if [[ ! -x "$binary" ]]; then
  echo 'Release binary not found. Run npm run build:linux first.' >&2
  exit 1
fi

install -Dm755 "$binary" "$bin_dir/tiiierminal"
install -Dm644 "$project_dir/src-tauri/icons/128x128.png" \
  "$data_dir/icons/hicolor/128x128/apps/app.tiii.terminal.png"
mkdir -p "$data_dir/applications"

# Escape paths for a quoted desktop-entry Exec argument, including field codes.
desktop_binary="${bin_dir//\\/\\\\}/tiiierminal"
desktop_binary="${desktop_binary//\"/\\\"}"
desktop_binary="${desktop_binary//\$/\\\$}"
desktop_binary="${desktop_binary//\`/\\\`}"
desktop_binary="${desktop_binary//%/%%}"
cat > "$data_dir/applications/app.tiii.terminal.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=TIIIErminal
Comment=A compact terminal desktop app
Exec="$desktop_binary"
Icon=app.tiii.terminal
Terminal=false
Categories=System;TerminalEmulator;
StartupWMClass=tiiierminal
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$data_dir/applications" || true
fi

echo "Installed TIIIErminal to $bin_dir/tiiierminal"
echo 'Launch TIIIErminal from your application menu.'
case ":$PATH:" in
  *":$bin_dir:"*) ;;
  *) echo "Add $bin_dir to PATH to launch it with the tiiierminal command." ;;
esac
