import { expect, test } from 'bun:test';
import { resolve } from 'node:path';

import { read, run } from './release.command';
import { getBuildKey, getLatestTag, getPlatform, getTagVersion, getVersion, resolveWithin } from './release.utils';

test.each([
  ['win32', 'windows', 'build:windows'], ['darwin', 'macos', 'build:macos'], ['linux', 'linux', 'build:linux'],
])('%s selects its native platform build command', (host: string, platform: string, command: string): void => {
  expect(getPlatform(host)).toMatchObject({ name: platform, command });
});

test('unsupported platforms and architectures fail with native build instructions', (): void => {
  expect((): unknown => getPlatform('freebsd')).toThrow('Windows, macOS, or Linux');
  expect((): unknown => getPlatform('toString')).toThrow('Unsupported OS');
  expect((): string => getBuildKey('windows', 'ia32')).toThrow('native x64 or arm64');
  expect(getBuildKey('macos', 'arm64')).toBe('macos-arm64');
  expect(getBuildKey('linux', 'x64')).toBe('linux-x64');
});

test('the highest Git version-sorted stable tag is selected while preview tags are excluded', (): void => {
  expect(getLatestTag('v1.0.0-rc.1\nv0.10.0\nv0.9.0\nv0.1.0')).toBe('v0.10.0');
  expect(getLatestTag('v0.2.0\r\nv0.1.0')).toBe('v0.2.0');
  expect(getTagVersion('v0.1.0')).toBe('0.1.0');
  for (const tag of ['', 'v0.1.0-beta', '0.1.0', 'v01.0.0', '../v1.0.0']) expect((): string => getTagVersion(tag)).toThrow('stable version tag');
  expect((): string => getLatestTag('')).toThrow('No stable version tags');
});

test('release paths cannot replace the output root or escape into unrelated directories', (): void => {
  const root = resolve('release-test');
  expect(resolveWithin(root, 'artifacts/windows-x64/app.exe')).toBe(resolve(root, 'artifacts/windows-x64/app.exe'));
  for (const path of ['.', '..', '../other', resolve(root, '../outside')]) expect((): string => resolveWithin(root, path)).toThrow('leaves its output directory');
});

test('version metadata must provide a version instead of silently defaulting', (): void => {
  expect(getVersion({ version: '0.1.0' })).toBe('0.1.0');
  for (const value of [null, {}, { version: 1 }]) expect((): string => getVersion(value)).toThrow('Missing package version');
});

test('subprocess failures stop the release and captured output is returned on success', async (): Promise<void> => {
  expect(await read([process.execPath, '-e', 'process.stdout.write("ready")'], process.cwd())).toBe('ready');
  await expect(read([process.execPath, '-e', 'process.stderr.write("missing compiler");process.exit(2)'], process.cwd())).rejects.toThrow('missing compiler');
  await expect(run([process.execPath, '-e', 'process.exit(2)'], process.cwd())).rejects.toThrow('failed');
});
