# Publish the latest tagged version

Run `bun run publish:last-tag` separately on each platform after `bun run build:last-tag` succeeds on that machine. GitHub CLI must be installed and authenticated with permission to publish releases to `tiii-dev/terminal-app`.

The script fetches tags, selects the highest stable version, and loads only this native platform/architecture's build manifest. Its tag and commit must match Git and the tag on GitHub. Every artifact and screenshot is checked against its recorded size and SHA-256 before any release is created or modified. Missing builds, moved tags, edited files, and incomplete metadata stop publishing with instructions to rebuild.

If the release does not exist, `gh release create --verify-tag --generate-notes` creates it with this platform's files. Otherwise, `gh release upload --clobber` replaces the same platform-specific filenames. Assets from other operating systems and architectures are kept. Each screenshot and installer filename includes the version, OS, and architecture, preventing cross-platform replacement. If two machines attempt the first release creation simultaneously, retry the failed command after the first finishes; subsequent runs upload to that existing release.

No source commits, tags, or branches are created or pushed. Publishing makes the GitHub release publicly available because `tiii-dev/terminal-app` is public. Code signing and notarization must already have been handled by the platform build.
