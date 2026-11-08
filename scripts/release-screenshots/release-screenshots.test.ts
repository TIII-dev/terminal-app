import { afterEach, beforeEach, expect, test } from 'bun:test';
import { Window as BrowserWindow } from 'happy-dom';

import { installScreenshot } from './release-screenshots.fixture';
import type { ScreenshotSeed } from './release-screenshots.types';

const descriptors = new Map<string, PropertyDescriptor | undefined>();
beforeEach((): void => {
  const browser = new BrowserWindow({ url: 'http://localhost' });
  for (const [key, value] of Object.entries({ window: browser, localStorage: browser.localStorage })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
});
afterEach((): void => {
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const seed: ScreenshotSeed = { theme: 'TIII', version: '0.1.0', platform: 'windows', shell: 'PowerShell 7', icons: ['M0 0', 'M1 1', 'M2 2', 'M3 3'], output: 'Illustrative output' };

test.each(['windows', 'macos', 'linux'] as const)('%s screenshots use isolated illustrative settings and the requested platform', async (platform): Promise<void> => {
  installScreenshot({ ...seed, platform });
  expect(JSON.parse(localStorage.getItem('tiii-terminal-settings')!)).toMatchObject({ theme: 'TIII', fontFamily: 'monospace', backgroundOpacity: 100 });
  expect(JSON.parse(localStorage.getItem('tiii-terminal-tabs')!).tabs).toHaveLength(4);
  expect(await window.__TAURI_INTERNALS__.invoke('get_platform', {})).toBe(platform);
  expect(await window.__TAURI_INTERNALS__.invoke('plugin:app|version', {})).toBe('0.1.0');
  expect(await window.__TAURI_INTERNALS__.invoke('get_profiles', {})).toEqual([{ id: 'capture-shell', name: 'PowerShell 7', isDefault: true }]);
});

test('unrecognized native commands and an unregistered output listener stop a capture', async (): Promise<void> => {
  installScreenshot(seed);
  await expect(window.__TAURI_INTERNALS__.invoke('unknown-command', {})).rejects.toThrow('Unexpected app command');
  await expect(window.__TAURI_INTERNALS__.invoke('open_terminal', { id: 'capture-0' })).rejects.toThrow('Missing screenshot terminal listener');
});
