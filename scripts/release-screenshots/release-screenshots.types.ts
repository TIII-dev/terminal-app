import type { ReleasePlatform } from '../release/release.types';

export type ScreenshotOptions = { source: string; output: string; tag: string; platform: ReleasePlatform; architecture: string };
export type ScreenshotSeed = { theme: string; version: string; platform: ReleasePlatform['name']; shell: string; icons: string[]; output: string };
export type ScreenshotEvent = { event: string; id: number; payload: { id: string; data: number[] } };
export type ScreenshotTab = { id: string; profileId: string; profileName: string; groupId: string; icon: string };

declare global {
  interface Window {
    __TAURI_INTERNALS__: {
      metadata: { currentWindow: { label: string }; currentWebview: { label: string } };
      transformCallback: (callback: (event: ScreenshotEvent) => void) => number;
      unregisterCallback: (id: number) => void;
      invoke: (command: string, args: Record<string, unknown>) => Promise<unknown>;
    };
  }
}
