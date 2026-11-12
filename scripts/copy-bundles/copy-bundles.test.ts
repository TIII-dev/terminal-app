import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { copyBundles } from './copy-bundles';

test('Windows bundles are copied into dist and missing formats fail', async (): Promise<void> => {
  const root = await mkdtemp(resolve(tmpdir(), 'terminal-bundles-'));
  try {
    const source = resolve(root, 'src-tauri/target/release/bundle');
    await mkdir(resolve(source, 'nsis'), { recursive: true });
    await mkdir(resolve(source, 'msi'), { recursive: true });
    await writeFile(resolve(source, 'nsis/setup.exe'), 'installer');
    await expect(copyBundles(root, 'win32')).rejects.toThrow(
      'Missing bundle msi/*.msi',
    );
    await writeFile(resolve(source, 'msi/setup.msi'), 'package');
    await copyBundles(root, 'win32');
    expect(
      await readFile(resolve(root, 'dist/bundles/nsis/setup.exe'), 'utf8'),
    ).toBe('installer');
    expect(
      await readFile(resolve(root, 'dist/bundles/msi/setup.msi'), 'utf8'),
    ).toBe('package');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
