import { isAbsolute, relative, resolve } from 'node:path';

import { platforms } from './release.constants';
import type {
  ReleaseFile,
  ReleaseManifest,
  ReleasePlatform,
} from './release.types';

export const getPlatform = (platform: string): ReleasePlatform => {
  if (!Object.hasOwn(platforms, platform))
    throw new Error(
      `Unsupported OS ${platform} — build on Windows, macOS, or Linux`,
    );
  return platforms[platform]!;
};

export const getBuildKey = (
  platform: ReleasePlatform['name'],
  architecture: string,
): string => {
  if (!['x64', 'arm64'].includes(architecture))
    throw new Error(
      `Unsupported architecture ${architecture} — use native x64 or arm64`,
    );
  return `${platform}-${architecture}`;
};

export const getTagVersion = (tag: string): string => {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag))
    throw new Error(
      'Invalid release tag — use a stable version tag such as v0.1.0',
    );
  return tag.slice(1);
};

export const getLatestTag = (tags: string): string => {
  const tag = tags
    .split(/\r?\n/)
    .find((name): boolean =>
      /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(name),
    );
  if (!tag)
    throw new Error(
      'No stable version tags found — commit your release, tag it (for example git tag v0.1.0), and push that tag before publishing',
    );
  return tag;
};

export const resolveWithin = (root: string, path: string): string => {
  const result = resolve(root, path);
  const child = relative(root, result);
  if (!child || isAbsolute(child) || child.split(/[\\/]/).includes('..'))
    throw new Error(
      'Release path leaves its output directory — rebuild the release metadata',
    );
  return result;
};

export const getVersion = (value: unknown): string => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    typeof value.version !== 'string'
  )
    throw new Error(
      'Missing package version — set matching versions in package.json, tauri.conf.json, and Cargo.toml',
    );
  return value.version;
};

export const parseManifest = (value: unknown): ReleaseManifest => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('tag' in value) ||
    typeof value.tag !== 'string' ||
    !('commit' in value) ||
    typeof value.commit !== 'string' ||
    !/^[a-f0-9]{40}$/.test(value.commit) ||
    !('platform' in value) ||
    !Object.values(platforms).some(
      (platform): boolean => platform.name === value.platform,
    ) ||
    !('architecture' in value) ||
    typeof value.architecture !== 'string' ||
    !('files' in value) ||
    !Array.isArray(value.files) ||
    !value.files.length
  )
    throw new Error(
      'Invalid release manifest — run bun run build:last-tag on this platform',
    );
  getTagVersion(value.tag);
  const platform = value.platform as ReleasePlatform['name'];
  const key = getBuildKey(platform, value.architecture);
  for (const file of value.files as unknown[]) {
    if (
      typeof file !== 'object' ||
      file === null ||
      !('path' in file) ||
      typeof file.path !== 'string' ||
      !('sha256' in file) ||
      typeof file.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !('size' in file) ||
      typeof file.size !== 'number' ||
      !Number.isSafeInteger(file.size) ||
      file.size <= 0
    )
      throw new Error(
        'Invalid release file — rebuild instead of editing the manifest',
      );
    const path = file.path;
    if (
      ![`artifacts/${key}/`, `screenshots/terminal-${value.tag}-${key}-`].some(
        (prefix): boolean => path.startsWith(prefix),
      ) ||
      path.includes('..') ||
      path.includes('\\') ||
      path.includes(':')
    )
      throw new Error(
        'Invalid release file — rebuild instead of editing the manifest',
      );
  }
  const files = value.files as ReleaseFile[];
  const formats = Object.values(platforms).find(
    (candidate): boolean => candidate.name === platform,
  )!.bundles;
  if (
    new Set(files.map((file): string => file.path)).size !== files.length ||
    !files.some(
      (file): boolean =>
        file.path.startsWith('screenshots/') && file.path.endsWith('.png'),
    ) ||
    formats.some(
      (format): boolean =>
        !files.some((file): boolean =>
          file.path.endsWith(
            format.endsWith('.app')
              ? '.app.zip'
              : format.slice(format.lastIndexOf('*') + 1),
          ),
        ),
    )
  )
    throw new Error(
      'Incomplete release manifest — rebuild all installers and screenshots for this platform',
    );
  return value as ReleaseManifest;
};
