import { resolve } from 'node:path';

import { run } from './release.command';
import type { NativeVersions } from './release.types';
import { getTagVersion, getVersion } from './release.utils';

export const updateNativeVersions = (files: NativeVersions, version: string): NativeVersions => {
  getTagVersion(`v${version}`);
  const config: unknown = JSON.parse(files.config);
  const previous = getVersion(config);
  const cargo = /(\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m;
  const lock = /(\[\[package\]\]\r?\nname = "tiii-terminal-app"\r?\nversion = ")[^"]+(")/;
  if (!cargo.test(files.cargo) || !lock.test(files.lock)) throw new Error('Missing native package version — check Cargo.toml and the tiii-terminal-app entry in Cargo.lock');
  return {
    config: previous === version ? files.config : `${JSON.stringify({ ...config as Record<string, unknown>, version }, null, 2)}\n`,
    cargo: files.cargo.replace(cargo, (_match, prefix: string, suffix: string): string => `${prefix}${version}${suffix}`),
    lock: files.lock.replace(lock, (_match, prefix: string, suffix: string): string => `${prefix}${version}${suffix}`),
  };
};

if (import.meta.main) {
  const root = resolve(import.meta.dir, '../..');
  const paths = ['src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock'];
  const [config, cargo, lock] = await Promise.all(paths.map((path): Promise<string> => Bun.file(resolve(root, path)).text()));
  const files = updateNativeVersions({ config: config!, cargo: cargo!, lock: lock! }, getVersion(await Bun.file(resolve(root, 'package.json')).json() as unknown));
  await Promise.all(paths.map((path, index): Promise<number> => Bun.write(resolve(root, path), Object.values(files)[index]!)));
  await run(['git', 'add', '--', ...paths], root);
}
