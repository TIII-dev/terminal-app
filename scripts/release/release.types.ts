export type ReleasePlatform = {
  name: 'windows' | 'macos' | 'linux';
  command: 'build:windows' | 'build:macos' | 'build:linux';
  bundles: readonly string[];
  shell: string;
};

export type ReleaseFile = { path: string; sha256: string; size: number };

export type ReleaseManifest = {
  tag: string;
  commit: string;
  platform: ReleasePlatform['name'];
  architecture: string;
  files: ReleaseFile[];
};
