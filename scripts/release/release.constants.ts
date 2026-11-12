import type { ReleasePlatform } from './release.types';

export const repository = 'tiii-dev/terminal-app';

export const platforms: Record<string, ReleasePlatform> = {
  win32: {
    name: 'windows',
    command: 'build:windows',
    bundles: ['nsis/*.exe', 'msi/*.msi'],
    shell: 'PowerShell 7',
  },
  darwin: {
    name: 'macos',
    command: 'build:macos',
    bundles: ['dmg/*.dmg', 'macos/*.app'],
    shell: 'Zsh',
  },
  linux: {
    name: 'linux',
    command: 'build:linux',
    bundles: ['deb/*.deb', 'rpm/*.rpm', 'appimage/*.AppImage'],
    shell: 'Bash',
  },
};
