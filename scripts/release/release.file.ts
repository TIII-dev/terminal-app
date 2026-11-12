import type { ReleaseFile } from './release.types';

export const hashFile = async (
  path: string,
): Promise<Omit<ReleaseFile, 'path'>> => {
  const file = Bun.file(path);
  if (!(await file.exists()) || file.size === 0)
    throw new Error(
      'Missing or empty release file — run bun run build:last-tag again',
    );
  const hash = new Bun.CryptoHasher('sha256');
  for await (const chunk of file.stream()) hash.update(chunk);
  return { size: file.size, sha256: hash.digest('hex') };
};
