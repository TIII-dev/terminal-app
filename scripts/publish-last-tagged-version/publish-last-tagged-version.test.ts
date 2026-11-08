import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { hashFile } from '../release/release.file';
import type { ReleaseManifest } from '../release/release.types';
import { parseManifest, resolveWithin } from '../release/release.utils';

const directories: string[] = [];
afterEach(async (): Promise<void> => {
  for (const directory of directories.splice(0)) {
    resolveWithin(tmpdir(), basename(directory));
    await rm(directory, { recursive: true });
  }
});

const manifest: ReleaseManifest = { tag: 'v0.1.0', commit: 'a'.repeat(40), platform: 'windows', architecture: 'x64', files: [
  { path: 'artifacts/windows-x64/terminal-v0.1.0-windows-x64-app.exe', sha256: 'b'.repeat(64), size: 12 },
  { path: 'artifacts/windows-x64/terminal-v0.1.0-windows-x64-app.msi', sha256: 'c'.repeat(64), size: 12 },
  { path: 'screenshots/terminal-v0.1.0-windows-x64-tiii.png', sha256: 'd'.repeat(64), size: 12 },
] };

test('valid build metadata keeps the tag, platform, commit, and artifact identity', (): void => {
  expect(parseManifest(manifest)).toEqual(manifest);
  expect((): unknown => parseManifest({ ...manifest, files: [] })).toThrow('Invalid release manifest');
  expect((): unknown => parseManifest({ ...manifest, commit: 'branch-name' })).toThrow('Invalid release manifest');
  expect((): unknown => parseManifest({ ...manifest, architecture: 'ia32' })).toThrow('Unsupported architecture');
  expect((): unknown => parseManifest({ ...manifest, files: manifest.files.slice(0, 1) })).toThrow('Incomplete release manifest');
  expect((): unknown => parseManifest({ ...manifest, files: [...manifest.files, manifest.files[0]] })).toThrow('Incomplete release manifest');
});

test('publishing rejects cross-platform assets, path traversal, and corrupted file metadata', (): void => {
  for (const path of ['artifacts/linux-x64/app.deb', 'artifacts/windows-x64/../../.env', 'C:\\secrets', 'screenshots/terminal-v0.2.0-windows-x64-tiii.png']) {
    expect((): unknown => parseManifest({ ...manifest, files: [{ ...manifest.files[0], path }] })).toThrow('Invalid release file');
  }
  expect((): unknown => parseManifest({ ...manifest, files: [{ ...manifest.files[0], sha256: 'invalid' }] })).toThrow('Invalid release file');
});

test('file checksums identify changed or missing installer content before upload', async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'terminal-release-test-'));
  directories.push(directory);
  const path = join(directory, 'app.exe');
  await Bun.write(path, 'first installer');
  const before = await hashFile(path);
  await Bun.write(path, 'other installer');
  const after = await hashFile(path);
  expect(after.size).toBe(before.size);
  expect(after.sha256).not.toBe(before.sha256);
  await expect(hashFile(join(directory, 'missing.exe'))).rejects.toThrow('Missing or empty release file');
});
