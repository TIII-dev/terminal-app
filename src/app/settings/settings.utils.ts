import { themes } from '../app.constants';
import { Settings } from './settings.types';

export const parseSettings = (stored: string): Settings => {
  let value: unknown;
  try { value = JSON.parse(stored); }
  catch (error: unknown) { throw new Error('Unreadable saved settings - remove tiii-terminal-settings from local storage to reset', { cause: error }); }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid saved settings - remove tiii-terminal-settings from local storage to reset');
  }
  // Migrate the settings format saved before background opacity was introduced.
  if (!('backgroundOpacity' in value)) Object.assign(value, { backgroundOpacity: 100 });
  if (!('theme' in value) || typeof value.theme !== 'string' || !Object.hasOwn(themes, value.theme)
    || !('profileId' in value) || typeof value.profileId !== 'string' || !value.profileId.trim()
    || !('fontFamily' in value) || typeof value.fontFamily !== 'string' || !value.fontFamily.trim()
    || !('fontSize' in value) || typeof value.fontSize !== 'number' || !Number.isInteger(value.fontSize) || value.fontSize < 8 || value.fontSize > 48
    || !('scale' in value) || typeof value.scale !== 'number' || !Number.isInteger(value.scale) || value.scale < 50 || value.scale > 200 || value.scale % 5 !== 0
    || !('backgroundOpacity' in value) || typeof value.backgroundOpacity !== 'number' || !Number.isInteger(value.backgroundOpacity) || value.backgroundOpacity < 0 || value.backgroundOpacity > 100) {
    throw new Error('Invalid saved settings - remove tiii-terminal-settings from local storage to reset');
  }
  return { theme: value.theme as Settings['theme'], profileId: value.profileId, fontFamily: value.fontFamily, fontSize: value.fontSize, scale: value.scale, backgroundOpacity: value.backgroundOpacity };
};
