import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { getPlatform } from '../release/release.utils';

export const copyBundles = async (
  root: string,
  platform: string,
): Promise<void> => {
  const source = resolve(root, 'src-tauri/target/release/bundle');
  for (const pattern of getPlatform(platform).bundles) {
    const matches = await Array.fromAsync(
      new Bun.Glob(pattern).scan({ cwd: source, onlyFiles: false }),
    );
    if (!matches.length)
      throw new Error(
        `Missing bundle ${pattern} in ${source} — run the native Tauri build first`,
      );
    for (const match of matches) {
      const destination = resolve(root, 'dist/bundles', match);
      await mkdir(dirname(destination), { recursive: true });
      await cp(resolve(source, match), destination, { recursive: true });
    }
  }
};

if (import.meta.main)
  await copyBundles(resolve(import.meta.dir, '../..'), process.platform);
