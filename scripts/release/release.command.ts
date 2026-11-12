export const run = async (command: string[], cwd: string): Promise<void> => {
  const child = Bun.spawn(command, {
    cwd,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if ((await child.exited) !== 0)
    throw new Error(
      `${command[0]} ${command[1]} failed — fix the command error above and retry`,
    );
};

export const read = async (command: string[], cwd: string): Promise<string> => {
  const child = Bun.spawn(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [output, error, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0)
    throw new Error(`${command[0]} ${command[1]} failed: ${error.trim()}`);
  return output.trim();
};
