import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { read, run } from '../release/release.command';
import { hashFile } from '../release/release.file';
import type { ReleaseFile, ReleaseManifest } from '../release/release.types';
import { getBuildKey, getLatestTag, getPlatform, getTagVersion, getVersion, resolveWithin } from '../release/release.utils';
import { captureScreenshots } from '../release-screenshots/release-screenshots.capture';

const root = resolve(import.meta.dir, '../..');
const platform = getPlatform(process.platform);
const key = getBuildKey(platform.name, process.arch);
if (process.env['CARGO_TARGET_DIR'] !== undefined || process.env['CARGO_BUILD_TARGET'] !== undefined) throw new Error('Custom Cargo target configuration is set — unset CARGO_TARGET_DIR and CARGO_BUILD_TARGET for a native release build');
await run(['git', 'fetch', 'origin', '--tags'], root);
const tag = getLatestTag(await read(['git', 'tag', '--sort=-version:refname'], root));
const version = getTagVersion(tag);
const commit = await read(['git', 'rev-parse', `${tag}^{commit}`], root);
const release = resolveWithin(resolve(root, 'docs/releases'), tag);
const artifacts = resolveWithin(release, `artifacts/${key}`);
const worktrees = resolve(root, '.release-worktrees');
await mkdir(worktrees, { recursive: true });
const worktree = await mkdtemp(join(worktrees, `${tag}-${key}-`));
resolveWithin(worktrees, basename(worktree));
await run(['git', 'worktree', 'add', '--detach', worktree, commit], root);
try {
  const cargo: unknown = Bun.TOML.parse(await Bun.file(resolve(worktree, 'src-tauri/Cargo.toml')).text());
  if (typeof cargo !== 'object' || cargo === null || !('package' in cargo)) throw new Error('Missing Cargo package — fix src-tauri/Cargo.toml in the tagged version');
  const versions = await Promise.all([Bun.file(resolve(worktree, 'package.json')).json() as Promise<unknown>, Bun.file(resolve(worktree, 'src-tauri/tauri.conf.json')).json() as Promise<unknown>]);
  if ([...versions, cargo.package].some((value): boolean => getVersion(value) !== version)) throw new Error(`Version mismatch with ${tag} — set package.json, tauri.conf.json, and Cargo.toml to ${version} before tagging`);
  await run([process.execPath, 'install', '--frozen-lockfile'], worktree);
  await run([process.execPath, resolve(root, 'node_modules/playwright/cli.js'), 'install', 'chromium'], root);
  await run([process.execPath, 'run', platform.command], worktree);
  const bundle = resolve(worktree, 'src-tauri/target/release/bundle');
  const staging = resolve(worktree, '.release-artifacts');
  await mkdir(staging);
  for (const pattern of platform.bundles) {
    const matches = await Array.fromAsync(new Bun.Glob(pattern).scan({ cwd: bundle, onlyFiles: false }));
    if (!matches.length) throw new Error(`Missing Tauri bundle ${pattern} — check the ${platform.command} build output`);
    for (const match of matches) {
      const source = resolveWithin(bundle, match);
      const destination = resolveWithin(staging, `terminal-${tag}-${key}-${basename(match)}${match.endsWith('.app') ? '.zip' : ''}`);
      if (match.endsWith('.app')) await run(['ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', source, destination], worktree);
      else await cp(source, destination);
    }
  }
  await captureScreenshots({ source: worktree, output: resolve(release, 'screenshots'), tag, platform, architecture: process.arch });
  await rm(artifacts, { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });
  await cp(staging, artifacts, { recursive: true });
  const files: ReleaseFile[] = [];
  for await (const file of new Bun.Glob('*').scan({ cwd: artifacts })) files.push({ path: `artifacts/${key}/${file}`, ...await hashFile(resolveWithin(artifacts, file)) });
  for await (const file of new Bun.Glob(`terminal-${tag}-${key}-*.png`).scan({ cwd: resolve(release, 'screenshots') })) files.push({ path: `screenshots/${file}`, ...await hashFile(resolveWithin(release, `screenshots/${file}`)) });
  const manifest: ReleaseManifest = { tag, commit, platform: platform.name, architecture: process.arch, files };
  await Bun.write(resolve(artifacts, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Built ${tag} for ${key}. Artifacts: ${artifacts}\nScreenshots: ${resolve(release, 'screenshots')}\n`);
} finally {
  resolveWithin(worktrees, basename(worktree));
  await run(['git', 'worktree', 'remove', '--force', worktree], root);
}
