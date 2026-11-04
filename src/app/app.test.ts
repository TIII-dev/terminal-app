import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { plugin } from 'bun';
import { Window } from 'happy-dom';
import type { ITerminalOptions } from '@xterm/xterm';

import { themes } from './app.constants';
import { tabIcons } from './terminal-tab/terminal-tab.constants';
import { readTabImage } from './terminal-tab/terminal-tab.image';

const browser = new Window({ url: 'http://localhost:4200' });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: browser.localStorage });
Object.defineProperty(browser.document, 'fonts', { configurable: true, value: { load: (): Promise<FontFace[]> => Promise.resolve([]) } });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'EventTarget', 'Event', 'MouseEvent', 'KeyboardEvent', 'ResizeObserver', 'File', 'FileReader', 'Image', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? browser : browser[name] });
}
await import('@angular/compiler');

plugin({ setup(build): void {
  build.onLoad({ filter: /app\.component\.ts$/ }, (args): { contents: string; loader: 'ts' } => ({
    contents: readFileSync(args.path, 'utf8')
      .replace("templateUrl: './app.component.html'", `template: ${JSON.stringify(readFileSync(new URL('./app.component.html', import.meta.url), 'utf8'))}`)
      .replace("styleUrl: './app.component.css'", 'styles: []'),
    loader: 'ts',
  }));
} });

const windowActions: string[] = [];
const action = (name: string): Promise<void> => { windowActions.push(name); return Promise.resolve(); };
mock.module('@tauri-apps/api/window', (): object => ({ getCurrentWindow: (): object => ({
  minimize: (): Promise<void> => action('minimize'),
  toggleMaximize: (): Promise<void> => action('maximize'),
  close: (): Promise<void> => action('close'),
  isFullscreen: (): Promise<boolean> => Promise.resolve(false),
  setFullscreen: (): Promise<void> => action('fullscreen'),
}) }));
mock.module('@tauri-apps/api/app', (): object => ({ getVersion: (): Promise<string> => Promise.resolve('0.1.0') }));
mock.module('@tauri-apps/api/webview', (): object => ({ getCurrentWebview: (): object => ({ setZoom: (): Promise<void> => action('zoom') }) }));
const eventListeners = new Map<string, (event: { payload: { id: string; directory: string } }) => void>();
mock.module('@tauri-apps/api/event', (): object => ({ listen: (name: string, callback: (event: { payload: { id: string; directory: string } }) => void): Promise<() => void> => {
  eventListeners.set(name, callback);
  return Promise.resolve((): void => { eventListeners.delete(name); });
} }));
const openedDirectories: unknown[] = [];
const clipboardWrites: string[] = [];
mock.module('@tauri-apps/api/core', (): object => ({ invoke: (command: string, args?: { text: string }): Promise<unknown> => {
  if (command === 'open_terminal') openedDirectories.push((args as unknown as { directory: unknown }).directory);
  if (command === 'read_clipboard') return Promise.resolve('first\nsecond');
  if (command === 'write_clipboard') { clipboardWrites.push(args!.text); return Promise.resolve(); }
  if (command === 'get_platform') return Promise.resolve('windows');
  if (command === 'get_profiles') return Promise.resolve([{ id: 'pwsh', name: 'PowerShell 7', isDefault: true }, { id: 'powershell', name: 'Windows PowerShell', isDefault: false }]);
  if (command === 'get_fonts') return Promise.resolve(['Cascadia Mono', 'Consolas']);
  if (['open_terminal', 'close_terminal', 'resize_terminal', 'write_terminal'].includes(command)) return Promise.resolve();
  throw new Error(`Unexpected native command: ${command}`);
} }));

const terminals: TerminalSurface[] = [];
class TerminalSurface {
  readonly cols = 80;
  readonly rows = 24;
  readonly options: ITerminalOptions;
  constructor(options: ITerminalOptions) { this.options = options; terminals.push(this); }
  element: HTMLDivElement | undefined;
  open(host: HTMLElement): void { this.element = document.createElement('div'); host.appendChild(this.element); }
  loadAddon(): void {}
  onData(): void {}
  onResize(): void {}
  focus(): void {}
  write(): void {}
  refresh(): void {}
  selection = '';
  readonly pasted: string[] = [];
  hasSelection(): boolean { return this.selection.length > 0; }
  getSelection(): string { return this.selection; }
  paste(text: string): void { this.pasted.push(text); }
  selectAll(): void { this.selection = 'all output'; }
  clear(): void { this.selection = ''; }
  dispose(): void { this.element?.remove(); }
}
mock.module('@xterm/xterm', (): object => ({ Terminal: TerminalSurface }));
mock.module('@xterm/addon-fit', (): object => ({ FitAddon: class { fit(): void {} } }));

const { TestBed } = await import('@angular/core/testing');
const { BrowserTestingModule, platformBrowserTesting } = await import('@angular/platform-browser/testing');
const { AppComponent } = await import('./app.component');
TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
let fixture: ReturnType<typeof TestBed.createComponent<InstanceType<typeof AppComponent>>>;

beforeEach(async (): Promise<void> => {
  windowActions.length = 0;
  clipboardWrites.length = 0;
  terminals.length = 0;
  localStorage.clear();
  TestBed.configureTestingModule({ imports: [AppComponent] });
  await TestBed.compileComponents();
  fixture = TestBed.createComponent(AppComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
});
afterEach((): void => { TestBed.resetTestingModule(); mock.restore(); });

const click = async (label: string): Promise<void> => {
  const buttons = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'));
  const button = buttons.find((button): boolean => button.getAttribute('aria-label') === label || button.textContent.trim() === label);
  if (!button) throw new Error(`Missing button: ${label}`);
  button.click();
  await fixture.whenStable();
};

const restartApp = async (): Promise<void> => {
  TestBed.resetTestingModule();
  terminals.length = 0;
  TestBed.configureTestingModule({ imports: [AppComponent] });
  fixture = TestBed.createComponent(AppComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
};

test('the application runs without loading ZoneJS', (): void => {
  expect(Reflect.has(globalThis, 'Zone')).toBe(false);
});

test('the tab context menu opens an icon picker and selecting a preset updates that tab', async (): Promise<void> => {
  const selected = fixture.componentInstance.tabs()[0];
  fixture.nativeElement.querySelector('.tab').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  await fixture.whenStable();
  await click('Edit icon');
  expect(fixture.componentInstance.iconDialog.nativeElement.open).toBe(true);
  const index = tabIcons.findIndex((icon): boolean => icon !== selected.icon);
  await click(`Choose icon ${index + 1}`);
  expect(fixture.nativeElement.querySelector('.tab__icon path').getAttribute('d')).toBe(tabIcons[index]);
  expect(fixture.componentInstance.iconDialog.nativeElement.open).toBe(false);
});

test('SVG, JPG, and PNG uploads render as tab images and survive moving and reopening', async (): Promise<void> => {
  spyOn(browser.HTMLImageElement.prototype, 'decode').mockResolvedValue();
  await click('New terminal tab');
  const id = fixture.componentInstance.tabs()[1].id;
  for (const type of ['image/svg+xml', 'image/jpeg', 'image/png']) {
    fixture.componentInstance.openIconEditor(id);
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['image bytes'], 'icon', { type })] });
    await fixture.componentInstance.uploadTabIcon({ target: input } as unknown as Event);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.tab--active img').getAttribute('src')).toStartWith(`data:${type};base64,`);
  }
  const icon = fixture.componentInstance.tabs()[1].icon;
  fixture.componentInstance.moveActiveTab(-1);
  await fixture.componentInstance.closeTab(id);
  await fixture.componentInstance.reopenTab();
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('.tab--active img').getAttribute('src')).toBe(icon);
});

test('icons belonging to another open tab cannot be selected in the picker', async (): Promise<void> => {
  await click('New terminal tab');
  const tabs = fixture.componentInstance.tabs();
  fixture.componentInstance.openIconEditor(tabs[1].id);
  await fixture.whenStable();
  const index = tabIcons.indexOf(tabs[0].icon);
  const button = fixture.nativeElement.querySelector(`[aria-label="Choose icon ${index + 1}"]`) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  button.click();
  expect(fixture.componentInstance.tabs()[1].icon).toBe(tabs[1].icon);
});

test('unsupported, empty, and undecodable images are rejected without changing the tab icon', async (): Promise<void> => {
  const icon = fixture.componentInstance.tabs()[0].icon;
  fixture.componentInstance.openIconEditor(fixture.componentInstance.tabs()[0].id);
  await expect(readTabImage(new File(['text'], 'icon.txt', { type: 'text/plain' }))).rejects.toThrow('Unsupported icon');
  await expect(readTabImage(new File([], 'icon.png', { type: 'image/png' }))).rejects.toThrow('Unsupported icon');
  spyOn(browser.HTMLImageElement.prototype, 'decode').mockRejectedValue(new Error('Invalid image'));
  const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [new File(['broken'], 'icon.png', { type: 'image/png' })] });
  await expect(fixture.componentInstance.uploadTabIcon({ target: input } as unknown as Event)).rejects.toThrow('Invalid icon image');
  await fixture.whenStable();
  expect(fixture.componentInstance.tabs()[0].icon).toBe(icon);
  expect(fixture.nativeElement.querySelector('.dialog--icon [role="alert"]').textContent).toContain('Invalid icon image');
});

test('asynchronous startup displays the first tab and window controls without another click', (): void => {
  expect(fixture.nativeElement.querySelectorAll('.tab').length).toBe(1);
  expect(fixture.nativeElement.querySelector('.tab__select').textContent.trim()).toBe('1');
  expect(fixture.nativeElement.querySelectorAll('.window_controls__button').length).toBe(3);
});

test('closing a tab updates the strip after the native close completes', async (): Promise<void> => {
  await click('New terminal tab');
  expect(fixture.nativeElement.querySelectorAll('.tab').length).toBe(2);
  await click('Close terminal 2');
  expect(fixture.nativeElement.querySelectorAll('.tab').length).toBe(1);
  expect(fixture.nativeElement.querySelector('[aria-selected="true"]').textContent.trim()).toBe('1');
});

test('native keyboard shortcuts open and switch tabs in the rendered strip', async (): Promise<void> => {
  const event = new KeyboardEvent('keydown', { key: 't', ctrlKey: true, bubbles: true, cancelable: true });
  fixture.nativeElement.querySelector('.terminal_host').dispatchEvent(event);
  await fixture.whenStable();
  expect(event.defaultPrevented).toBe(true);
  expect(fixture.componentInstance.tabs().length).toBe(2);
  expect(fixture.nativeElement.querySelectorAll('.tab').length).toBe(2);
  fixture.nativeElement.querySelector('.terminal_host').dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true, cancelable: true }));
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('[aria-selected="true"]').textContent.trim()).toBe('1');
});

test('window buttons request minimize, maximize and close on the native window', async (): Promise<void> => {
  await click('Minimize');
  await click('Maximize or restore');
  await click('Close window');
  expect(windowActions).toEqual(['minimize', 'maximize', 'close']);
});

test('Linux clipboard shortcuts copy selections and paste through the terminal without intercepting Ctrl+C', async (): Promise<void> => {
  fixture.componentInstance.platform.set('linux');
  const terminal = terminals[0];
  const host = fixture.nativeElement.querySelector('.terminal_host');
  const press = (key: string, shiftKey = true): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, ctrlKey: true, shiftKey, bubbles: true, cancelable: true });
    host.dispatchEvent(event);
    return event;
  };
  expect(press('C').defaultPrevented).toBe(true);
  await fixture.whenStable();
  expect(clipboardWrites).toEqual([]);
  terminal.selection = 'selected output';
  press('C');
  await fixture.whenStable();
  expect(clipboardWrites).toEqual(['selected output']);
  expect(press('V').defaultPrevented).toBe(true);
  await fixture.whenStable();
  expect(terminal.pasted).toEqual(['first\nsecond']);
  expect(press('c', false).defaultPrevented).toBe(false);
  await click('Settings');
  expect(press('V').defaultPrevented).toBe(false);
  expect(terminal.pasted).toHaveLength(1);
});

test('terminal context menu supports clipboard and buffer actions separately from tab actions', async (): Promise<void> => {
  fixture.componentInstance.platform.set('linux');
  const terminal = terminals[0];
  const open = async (): Promise<void> => {
    fixture.nativeElement.querySelector('.terminal_host').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
  };
  await open();
  expect(fixture.nativeElement.querySelector('[aria-label="Terminal actions"] button').disabled).toBe(true);
  terminal.selection = 'selected output';
  await open();
  await click('Copy');
  expect(clipboardWrites).toEqual(['selected output']);
  expect(fixture.componentInstance.terminalMenu()).toBeUndefined();
  await open();
  await click('Paste');
  expect(terminal.pasted).toEqual(['first\nsecond']);
  await open();
  await click('Select all');
  expect(terminal.selection).toBe('all output');
  await open();
  await click('Clear scrollback');
  expect(terminal.selection).toBe('');
  await open();
  fixture.nativeElement.querySelector('[aria-label="Terminal actions"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await fixture.whenStable();
  expect(fixture.componentInstance.terminalMenu()).toBeUndefined();
  await open();
  fixture.nativeElement.querySelector('.tab').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('[aria-label="Terminal actions"]')).toBeNull();
  expect(fixture.nativeElement.querySelector('[aria-label="Tab actions"]')).not.toBeNull();
});

test('moving a tab renumbers it while its icon and numeric shortcut follow the new position', async (): Promise<void> => {
  await click('New terminal tab');
  const moved = fixture.componentInstance.tabs()[1];
  fixture.nativeElement.querySelector('.terminal_host').dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
  await fixture.whenStable();
  expect(Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.tab__select')).map((button): string => button.textContent.trim())).toEqual(['1', '2']);
  expect(fixture.nativeElement.querySelector('.tab').getAttribute('data-tab-id')).toBe(moved.id);
  expect(fixture.nativeElement.querySelector('.tab__icon path').getAttribute('d')).toBe(moved.icon);
  fixture.nativeElement.querySelector('.terminal_host').dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true, cancelable: true }));
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('.tab--active').getAttribute('data-tab-id')).toBe(moved.id);
});

test('closing a middle tab leaves consecutive numbers and new tabs continue the current order', async (): Promise<void> => {
  await click('New terminal tab');
  await click('New terminal tab');
  await click('Close terminal 2');
  expect(Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.tab__select')).map((button): string => button.textContent.trim())).toEqual(['1', '2']);
  await click('New terminal tab');
  expect(Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.tab__select')).map((button): string => button.textContent.trim())).toEqual(['1', '2', '3']);
});

test('more tabs than preset icons stay unique and shortcut nine selects number nine', async (): Promise<void> => {
  for (let index = 1; index < 12; index++) await click('New terminal tab');
  const icons = Array.from<SVGPathElement>(fixture.nativeElement.querySelectorAll('.tab__icon path')).map((path): string | null => path.getAttribute('d'));
  expect(new Set(icons).size).toBe(12);
  fixture.nativeElement.querySelector('.terminal_host').dispatchEvent(new KeyboardEvent('keydown', { key: '9', ctrlKey: true, bubbles: true, cancelable: true }));
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('[aria-selected="true"]').textContent.trim()).toBe('9');
});

test('reopening a tab replaces its icon if another open tab already owns it', async (): Promise<void> => {
  const original = fixture.componentInstance.tabs()[0];
  fixture.componentInstance.closedTabs.set([{ ...original, id: 'closed-tab' }]);
  await fixture.componentInstance.reopenTab();
  await fixture.whenStable();
  const tabs = fixture.componentInstance.tabs();
  expect(tabs[0].icon).toBe(original.icon);
  expect(tabs[1].icon).not.toBe(original.icon);
  expect(Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.tab__select')).map((button): string => button.textContent.trim())).toEqual(['1', '2']);
});

test('detected fonts appear after the native font query completes', async (): Promise<void> => {
  await click('Settings');
  expect(Array.from<HTMLOptionElement>(fixture.nativeElement.querySelectorAll('#installed-fonts option')).map((option): string => option.value)).toEqual(['monospace', 'Cascadia Mono', 'Consolas']);
  expect(fixture.nativeElement.textContent).toContain('2 installed font families');
});

test('selecting a theme updates every terminal palette and new tabs inherit it', async (): Promise<void> => {
  expect(terminals[0].options.theme).toEqual({ ...themes.Dracula, background: '#00000000' });
  expect(terminals[0].options.allowTransparency).toBe(true);
  await click('New terminal tab');
  await click('Settings');
  await click('Theme');
  await click('Nord');
  for (const terminal of terminals) expect(terminal.options.theme).toEqual({ ...themes.Nord, background: '#00000000' });
  expect(fixture.nativeElement.querySelector('.shell').style.getPropertyValue('--terminal-bg')).toBe(themes.Nord.background);
  await click('Close settings');
  await click('New terminal tab');
  expect(terminals[2].options.theme).toEqual({ ...themes.Nord, background: '#00000000' });
});

test('changed settings are saved and restored before the first terminal opens after restart', async (): Promise<void> => {
  await click('Settings');
  const profile = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
  profile.value = 'powershell';
  profile.dispatchEvent(new Event('change', { bubbles: true }));
  for (const [selector, value] of [['input[list]', 'Consolas'], ['input[min="8"]', '16'], ['input[min="50"]', '125']]) {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
  }
  await click('Theme');
  await click('Nord');
  const saved = localStorage.getItem('tiii-terminal-settings');
  expect(saved).not.toBeNull();
  expect(JSON.parse(saved!)).toEqual({ theme: 'Nord', profileId: 'powershell', fontFamily: 'Consolas', fontSize: 16, scale: 125, backgroundOpacity: 100 });
  await restartApp();
  expect(fixture.componentInstance.tabs()[0].profileId).toBe('pwsh');
  expect(fixture.componentInstance.selectedProfile()?.id).toBe('powershell');
  expect(fixture.componentInstance.scale()).toBe(125);
  expect(windowActions).toEqual(['zoom', 'zoom']);
  expect(terminals[0].options).toMatchObject({ theme: { ...themes.Nord, background: '#00000000' }, fontFamily: '"Consolas"', fontSize: 16 });
  expect(localStorage.getItem('tiii-terminal-settings')).toBe(saved);
});

test('acrylic opacity changes the background without fading terminal text and survives restart', async (): Promise<void> => {
  await click('Settings');
  const input = fixture.nativeElement.querySelector('input[aria-label="Acrylic opacity"]') as HTMLInputElement;
  input.value = '65';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('.shell').style.getPropertyValue('--terminal-opacity')).toBe('65%');
  expect(fixture.componentInstance.backgroundOpacity()).toBe(65);
  expect(terminals[0].options.theme?.foreground).toBe(themes.Dracula.foreground);
  await restartApp();
  expect(fixture.componentInstance.backgroundOpacity()).toBe(65);
  expect(fixture.nativeElement.querySelector('.shell').style.getPropertyValue('--terminal-opacity')).toBe('65%');
  expect(terminals[0].options.theme?.background).toBe('#00000000');
});

test('tabs restore their order, uploaded icons, groups, shell profiles, and active selection after restart', async (): Promise<void> => {
  await click('New terminal tab');
  await click('New terminal tab');
  const app = fixture.componentInstance;
  const [first, second, third] = app.tabs();
  app.createGroup(first.id);
  app.setGroupColor('#75d8b1');
  await fixture.whenStable();
  const input = fixture.nativeElement.querySelector('.dialog--group input') as HTMLInputElement;
  input.value = 'Work';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  app.groupDialog.nativeElement.close();
  app.assignGroup(second.id, app.groups()[0].id);
  app.toggleGroup(app.groups()[0].id);
  app.openIconEditor(third.id);
  app.setTabIcon('data:image/png;base64,aWNvbg==');
  app.moveActiveTab(1);
  app.activate(app.tabs()[0]);
  await app.closeTab(second.id);
  await fixture.whenStable();
  const saved = localStorage.getItem('tiii-terminal-tabs');
  const tabs = app.tabs();
  const groups = app.groups();
  await restartApp();
  expect(fixture.componentInstance.tabs()).toEqual(tabs);
  expect(fixture.componentInstance.groups()).toEqual(groups);
  expect(fixture.componentInstance.activeId()).toBe(first.id);
  expect(fixture.nativeElement.querySelectorAll('.tab').length).toBe(2);
  expect(fixture.nativeElement.querySelector('img.tab__icon').getAttribute('src')).toBe(tabs[1].icon);
  expect(terminals.length).toBe(2);
  expect(localStorage.getItem('tiii-terminal-tabs')).toBe(saved);
});

test('closing the last tab stores an empty layout and the next startup opens one new tab', async (): Promise<void> => {
  const id = fixture.componentInstance.tabs()[0].id;
  await fixture.componentInstance.closeTab(id);
  expect(JSON.parse(localStorage.getItem('tiii-terminal-tabs')!).tabs).toEqual([]);
  await restartApp();
  expect(fixture.componentInstance.tabs().length).toBe(1);
  expect(fixture.componentInstance.tabs()[0].id).not.toBe(id);
});

test('renamed and recolored groups collapse their inactive tabs', async (): Promise<void> => {
  await click('New terminal tab');
  fixture.nativeElement.querySelector('.tab').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  await fixture.whenStable();
  await click('Add tab to new group');
  const input = fixture.nativeElement.querySelector('.dialog--group input') as HTMLInputElement;
  input.value = 'Work';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await fixture.whenStable();
  await click('Green');
  await click('Close group settings');
  const label = fixture.nativeElement.querySelector('.group_label') as HTMLButtonElement;
  expect(label.textContent.trim()).toBe('Work');
  expect(label.style.getPropertyValue('--group-color')).toBe('#75d8b1');
  await click('Work');
  expect(fixture.nativeElement.querySelector('.tab[hidden] .tab__select').textContent.trim()).toBe('2');
});


test('Linux directory changes persist per tab and are passed back to the shell on restart', async (): Promise<void> => {
  const id = fixture.componentInstance.tabs()[0].id;
  const directory = '/home/user/Projects/space and ünicode';
  eventListeners.get('terminal-directory')!({ payload: { id, directory } });
  await fixture.whenStable();
  expect(JSON.parse(localStorage.getItem('tiii-terminal-tabs')!).tabs[0].directory).toBe(directory);
  await restartApp();
  expect(openedDirectories.at(-1)).toBe(directory);
});
