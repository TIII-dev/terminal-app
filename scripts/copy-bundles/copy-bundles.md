# Copy bundles

After a native Tauri build, `bun scripts/copy-bundles/copy-bundles.ts` copies the host platform's bundles from `src-tauri/target/release/bundle/` into `dist/bundles/`. It requires every expected bundle format and leaves existing files in place.
