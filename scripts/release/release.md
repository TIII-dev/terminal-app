# Shared release data and checks

This module owns the native platform commands, stable-version tag validation, artifact identity, output path boundaries, streaming file hashes, and command execution shared by tagged builds and publishing. `release.constants.ts` fixes the GitHub destination to `tiii-dev/terminal-app`. `release.types.ts` defines the on-disk manifest written next to a platform's artifacts.

Run `bun test scripts` for release checks and `bun run typecheck:scripts` for strict TypeScript validation. Full usage is documented beside the build and publishing entry points. No helper reads or stores GitHub tokens or signing credentials.
