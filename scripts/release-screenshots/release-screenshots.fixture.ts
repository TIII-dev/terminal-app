import type { ScreenshotEvent, ScreenshotSeed, ScreenshotTab } from './release-screenshots.types';

export const installScreenshot = (seed: ScreenshotSeed): void => {
  const callbacks = new Map<number, (event: ScreenshotEvent) => void>();
  let sequence = 0;
  let listener = 0;
  localStorage.setItem('tiii-terminal-settings', JSON.stringify({ theme: seed.theme, profileId: 'capture-shell', fontFamily: 'monospace', fontSize: 19, scale: 100, backgroundOpacity: 100 }));
  localStorage.setItem('tiii-terminal-tabs', JSON.stringify({
    tabs: seed.icons.map((icon, index): ScreenshotTab => ({ id: `capture-${index}`, profileId: 'capture-shell', profileName: seed.shell, groupId: index < 2 ? 'studio' : 'sandbox', icon })),
    groups: [{ id: 'studio', name: 'studio', color: '#b79aff', isCollapsed: false }, { id: 'sandbox', name: 'sandbox', color: '#75d8b1', isCollapsed: false }], activeId: 'capture-0', nextGroup: 3,
  }));
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    transformCallback: (callback): number => { callbacks.set(++sequence, callback); return sequence; },
    unregisterCallback: (id): void => { callbacks.delete(id); },
    invoke: async (command, args): Promise<unknown> => {
      if (command === 'get_platform') return seed.platform;
      if (command === 'get_profiles') return [{ id: 'capture-shell', name: seed.shell, isDefault: true }];
      if (command === 'get_fonts') return ['monospace'];
      if (command === 'plugin:app|version') return seed.version;
      if (command === 'plugin:event|listen') { if (args['event'] === 'terminal-output') listener = Number(args['handler']); return 1; }
      if (command === 'open_terminal') {
        const callback = callbacks.get(listener);
        if (!callback || typeof args['id'] !== 'string') throw new Error('Missing screenshot terminal listener — update the capture bridge for this app version');
        const id = args['id'];
        setTimeout((): void => callback({ event: 'terminal-output', id: 1, payload: { id, data: Array.from(new TextEncoder().encode(seed.output)) } }), 20);
        return;
      }
      if (['resize_terminal', 'write_terminal', 'close_terminal', 'plugin:event|unlisten', 'plugin:webview|set_webview_zoom'].includes(command)) return;
      throw new Error(`Unexpected app command ${command} — update the release screenshot bridge`);
    },
  };
};
