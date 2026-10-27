import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { plugin } from 'bun';
import { Window } from 'happy-dom';

const browser = new Window({ url: 'http://localhost:4200' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'EventTarget', 'Event', 'MouseEvent', 'KeyboardEvent', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) {
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
mock.module('@tauri-apps/api/event', (): object => ({ listen: (): Promise<() => void> => Promise.resolve((): void => {}) }));
mock.module('@tauri-apps/api/core', (): object => ({ invoke: (command: string): Promise<unknown> => {
  if (command === 'get_platform') return Promise.resolve('windows');
  if (command === 'get_profiles') return Promise.resolve([{ id: 'pwsh', name: 'PowerShell 7', isDefault: true }]);
  if (command === 'get_fonts') return Promise.resolve(['Cascadia Mono', 'Consolas']);
  if (['open_terminal', 'close_terminal', 'resize_terminal', 'write_terminal'].includes(command)) return Promise.resolve();
  throw new Error(`Unexpected native command: ${command}`);
} }));

class TerminalSurface {
  readonly cols = 80;
  readonly rows = 24;
  readonly options = {};
  element: HTMLDivElement | undefined;
  open(host: HTMLElement): void { this.element = document.createElement('div'); host.appendChild(this.element); }
  loadAddon(): void {}
  onData(): void {}
  onResize(): void {}
  focus(): void {}
  write(): void {}
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
  TestBed.configureTestingModule({ imports: [AppComponent] });
  await TestBed.compileComponents();
  fixture = TestBed.createComponent(AppComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
});
afterEach((): void => { TestBed.resetTestingModule(); });

const click = async (label: string): Promise<void> => {
  const buttons = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'));
  const button = buttons.find((button): boolean => button.getAttribute('aria-label') === label || button.textContent.trim() === label);
  if (!button) throw new Error(`Missing button: ${label}`);
  button.click();
  await fixture.whenStable();
};

test('the application runs without loading ZoneJS', (): void => {
  expect(Reflect.has(globalThis, 'Zone')).toBe(false);
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
