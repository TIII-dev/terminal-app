import { expect, test } from 'bun:test';

import { parseSettings } from './settings.utils';

const settings = { theme: 'Nord', profileId: 'pwsh', fontFamily: 'Consolas', fontSize: 16, scale: 125 };

test('saved preferences survive a JSON round trip', (): void => {
  expect(parseSettings(JSON.stringify(settings))).toEqual(settings);
});

test('corrupt or incomplete saved settings are rejected', (): void => {
  for (const stored of ['{', 'null', '[]', '{}']) expect(() => parseSettings(stored)).toThrow();
});

test('unknown themes, empty names, and out-of-range settings are rejected', (): void => {
  for (const change of [{ theme: 'unknown' }, { theme: '__proto__' }, { profileId: '' }, { fontFamily: ' ' }, { fontSize: 7 }, { fontSize: 49 }, { fontSize: 13.5 }, { scale: 45 }, { scale: 205 }, { scale: 101 }]) {
    expect(() => parseSettings(JSON.stringify({ ...settings, ...change }))).toThrow('Invalid saved settings');
  }
});
