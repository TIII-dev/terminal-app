import { basename, resolve } from 'node:path';

import { read, run } from '../release/release.command';
import { repository } from '../release/release.constants';
import { hashFile } from '../release/release.file';
import {
  getBuildKey,
  getLatestTag,
  getPlatform,
  parseManifest,
  resolveWithin,
} from '../release/release.utils';

const root = resolve(import.meta.dir, '../..');
const platform = getPlatform(process.platform);
const key = getBuildKey(platform.name, process.arch);
await run(['git', 'fetch', 'origin', '--tags'], root);
const tag = getLatestTag(
  await read(['git', 'tag', '--sort=-version:refname'], root),
);
const release = resolveWithin(resolve(root, 'docs/releases'), tag);
const file = Bun.file(resolveWithin(release, `artifacts/${key}/manifest.json`));
if (!(await file.exists()))
  throw new Error(
    `No ${tag} build for ${key} — run bun run build:last-tag on this machine first`,
  );
const manifest = parseManifest((await file.json()) as unknown);
const commit = await read(['git', 'rev-parse', `${tag}^{commit}`], root);
if (
  manifest.tag !== tag ||
  manifest.commit !== commit ||
  manifest.platform !== platform.name ||
  manifest.architecture !== process.arch
)
  throw new Error(
    'Build does not match this platform and tag — run bun run build:last-tag again',
  );
const remote = await read(
  [
    'git',
    'ls-remote',
    `https://github.com/${repository}.git`,
    `refs/tags/${tag}`,
    `refs/tags/${tag}^{}`,
  ],
  root,
);
const references = Object.fromEntries(
  remote.split(/\r?\n/).map((line): string[] => line.split(/\s+/).reverse()),
);
const remoteCommit = Object.hasOwn(references, `refs/tags/${tag}^{}`)
  ? references[`refs/tags/${tag}^{}`]
  : references[`refs/tags/${tag}`];
if (remoteCommit !== commit)
  throw new Error(
    `GitHub tag ${tag} is missing or different — push the matching tag to ${repository} before publishing`,
  );
const uploads: string[] = [];
for (const entry of manifest.files) {
  const path = resolveWithin(release, entry.path);
  const actual = await hashFile(path);
  if (actual.sha256 !== entry.sha256 || actual.size !== entry.size)
    throw new Error(
      `Release file ${basename(path)} changed — rebuild before publishing`,
    );
  uploads.push(path);
}
await run(['gh', 'auth', 'status'], root);
const existing = Bun.spawn(
  ['gh', 'api', `repos/${repository}/releases/tags/${tag}`, '--silent'],
  { cwd: root, stdout: 'pipe', stderr: 'pipe' },
);
const [error, status] = await Promise.all([
  new Response(existing.stderr).text(),
  existing.exited,
]);
if (status !== 0) {
  if (!error.includes('(HTTP 404)'))
    throw new Error(`Cannot inspect the GitHub release: ${error.trim()}`);
  await run(
    [
      'gh',
      'release',
      'create',
      tag,
      ...uploads,
      '--repo',
      repository,
      '--verify-tag',
      '--title',
      `TIIIErminal ${tag}`,
      '--generate-notes',
    ],
    root,
  );
} else
  await run(
    [
      'gh',
      'release',
      'upload',
      tag,
      ...uploads,
      '--repo',
      repository,
      '--clobber',
    ],
    root,
  );
process.stdout.write(
  `Published ${key} files to https://github.com/${repository}/releases/tag/${tag}\n`,
);
