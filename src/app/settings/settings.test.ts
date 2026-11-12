import { expect, test } from 'bun:test';

import { parseSettings } from './settings.utils';

const settings = {
  theme: 'Nord',
  profileId: 'pwsh',
  fontFamily: 'Consolas',
  fontSize: 16,
  scale: 125,
  backgroundOpacity: 70,
};

test('saved preferences survive a JSON round trip', (): void => {
  expect(parseSettings(JSON.stringify(settings))).toEqual(settings);
});

test('corrupt or incomplete saved settings are rejected', (): void => {
  for (const stored of ['{', 'null', '[]', '{}'])
    expect(() => parseSettings(stored)).toThrow();
});

test('unknown themes, empty names, and out-of-range settings are rejected', (): void => {
  for (const change of [
    { theme: 'unknown' },
    { theme: '__proto__' },
    { profileId: '' },
    { fontFamily: ' ' },
    { fontSize: 7 },
    { fontSize: 49 },
    { fontSize: 13.5 },
    { scale: 45 },
    { scale: 205 },
    { scale: 101 },
    { backgroundOpacity: -1 },
    { backgroundOpacity: 101 },
    { backgroundOpacity: 50.5 },
    { backgroundOpacity: null },
  ]) {
    expect(() =>
      parseSettings(JSON.stringify({ ...settings, ...change })),
    ).toThrow('Invalid saved settings');
  }
});

test('older saved preferences migrate to an opaque background without losing user choices', (): void => {
  const { backgroundOpacity, ...legacy } = settings;
  expect(parseSettings(JSON.stringify(legacy))).toEqual({
    ...legacy,
    backgroundOpacity: 100,
  });
});

test('fully transparent and fully opaque backgrounds are valid', (): void => {
  for (const backgroundOpacity of [0, 100])
    expect(
      parseSettings(JSON.stringify({ ...settings, backgroundOpacity }))
        .backgroundOpacity,
    ).toBe(backgroundOpacity);
});
