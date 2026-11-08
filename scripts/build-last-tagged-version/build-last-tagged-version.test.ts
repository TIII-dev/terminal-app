import { expect, test } from 'bun:test';

import { platforms } from '../release/release.constants';
import { getPlatform, getTagVersion, getVersion } from '../release/release.utils';

test('each native release requires every installer format supported by its build command', (): void => {
  expect(getPlatform('win32').bundles).toEqual(['nsis/*.exe', 'msi/*.msi']);
  expect(getPlatform('darwin').bundles).toEqual(['dmg/*.dmg', 'macos/*.app']);
  expect(getPlatform('linux').bundles).toEqual(['deb/*.deb', 'rpm/*.rpm', 'appimage/*.AppImage']);
});

test('the package, Tauri, and Cargo versions must match the selected tag before building', async (): Promise<void> => {
  const packageVersion: unknown = await Bun.file(new URL('../../package.json', import.meta.url)).json();
  const config: unknown = await Bun.file(new URL('../../src-tauri/tauri.conf.json', import.meta.url)).json();
  const cargo = Bun.TOML.parse(await Bun.file(new URL('../../src-tauri/Cargo.toml', import.meta.url)).text()) as { package: unknown };
  const version = getVersion(packageVersion);
  expect(getTagVersion(`v${version}`)).toBe(version);
  expect(getVersion(config)).toBe(version);
  expect(getVersion(cargo.package)).toBe(version);
  const commands = (packageVersion as { scripts: Record<string, string> }).scripts;
  for (const platform of Object.values(platforms)) expect(commands[platform.command]).toContain('tauri build --bundles');
});
