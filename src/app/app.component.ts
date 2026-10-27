import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, PendingTasks, ViewChild, computed, inject, signal } from '@angular/core';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';

import { themes } from './app.constants';
import { OutputEvent, ShellProfile, TabMenu } from './app.types';
import { parseSettings } from './settings/settings.utils';
import { tabIcons } from './terminal-tab/terminal-tab.constants';
import { readTabImage } from './terminal-tab/terminal-tab.image';
import { TabGroup, TerminalTab } from './terminal-tab/terminal-tab.types';
import { getTabIcon, getTabShortcut, moveTabToGroup, reorderTab } from './terminal-tab/terminal-tab.utils';

@Component({ selector: 'app-root', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, templateUrl: './app.component.html', styleUrl: './app.component.css' })
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('terminalHost', { static: true }) host!: ElementRef<HTMLElement>;
  @ViewChild('tabList', { static: true }) tabList!: ElementRef<HTMLElement>;
  @ViewChild('settingsDialog', { static: true }) settingsDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('aboutDialog', { static: true }) aboutDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('groupDialog', { static: true }) groupDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('iconDialog', { static: true }) iconDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('appMenu', { static: true }) appMenu!: ElementRef<HTMLDetailsElement>;
  readonly themes = themes;
  readonly tabIcons = tabIcons;
  readonly iconError = signal('');
  private editingIconId = '';
  readonly themeNames = Object.keys(themes) as (keyof typeof themes)[];
  readonly groupColors = [{ name: 'Purple', value: '#b79aff' }, { name: 'Blue', value: '#78b6ff' }, { name: 'Green', value: '#75d8b1' }, { name: 'Yellow', value: '#f0c674' }, { name: 'Pink', value: '#f38ba8' }, { name: 'Gray', value: '#9ba5b7' }];
  readonly theme = signal<keyof typeof themes>('Dracula');
  readonly tabs = signal<TerminalTab[]>([]);
  readonly groups = signal<TabGroup[]>([]);
  readonly closedTabs = signal<TerminalTab[]>([]);
  readonly closingIds = signal<string[]>([]);
  readonly activeId = signal('');
  readonly profiles = signal<ShellProfile[]>([]);
  readonly selectedProfile = signal<ShellProfile | undefined>(undefined);
  readonly startupError = signal<string | undefined>(undefined);
  readonly platform = signal('');
  readonly version = signal('');
  readonly settingsTab = signal<'main' | 'theme'>('main');
  readonly fonts = signal<string[]>([]);
  readonly fontFamily = signal('monospace');
  readonly fontSize = signal(13);
  readonly scale = signal(100);
  readonly fontError = signal<string | undefined>(undefined);
  readonly tabMenu = signal<TabMenu | undefined>(undefined);
  private readonly editingGroupId = signal<string | undefined>(undefined);
  readonly editingGroup = computed((): TabGroup | undefined => this.groups().find((group): boolean => group.id === this.editingGroupId()));
  private nextGroup = 1;
  private unlisten?: UnlistenFn;
  private readonly appWindow = getCurrentWindow();
  private readonly pendingTasks = inject(PendingTasks);
  private readonly instances = new Map<string, { terminal: Terminal; fit: FitAddon }>();
  private readonly openingTabs = new Map<string, Promise<void>>();
  private readonly resizeObserver = new ResizeObserver(() => this.instances.get(this.activeId())?.fit.fit());
  readonly minimizeWindow = (): Promise<void> => this.appWindow.minimize();
  readonly closeWindow = (): Promise<void> => this.appWindow.close();
  readonly maximizeWindow = async (): Promise<void> => {
    if (this.platform() === 'macos') await this.appWindow.setFullscreen(!await this.appWindow.isFullscreen());
    else await this.appWindow.toggleMaximize();
  };

  async ngAfterViewInit(): Promise<void> {
    const finish = this.pendingTasks.add();
    try {
      this.platform.set(await invoke<string>('get_platform'));
      const [profiles, version] = await Promise.all([invoke<ShellProfile[]>('get_profiles'), getVersion()]);
      this.profiles.set(profiles);
      this.version.set(version);
      this.selectedProfile.set(this.profiles().find((profile): boolean => profile.isDefault));
      if (!this.selectedProfile()) throw new Error('No default shell profile found - check your installed shells');
      await this.restoreSettings();
      this.unlisten = await listen<OutputEvent>('terminal-output', ({ payload }): void => { this.instances.get(payload.id)?.terminal.write(new Uint8Array(payload.data)); });
      this.resizeObserver.observe(this.host.nativeElement);
      window.addEventListener('keydown', this.handleShortcut, true);
      document.addEventListener('pointerdown', this.dismissTabMenu);
      await this.addTab();
    } catch (error: unknown) {
      this.startupError.set(`Could not start terminal: ${String(error)}`);
      throw error;
    } finally { finish(); }
  }

  async addTab(groupId: string | null = null): Promise<void> {
    const profile = this.selectedProfile();
    if (!profile) throw new Error('No shell profile selected - choose a profile in Settings');
    const tab: TerminalTab = { id: crypto.randomUUID(), icon: getTabIcon(this.tabs(), crypto.getRandomValues(new Uint32Array(1))[0]), profileId: profile.id, profileName: profile.name, groupId };
    await this.openTab(tab);
  }

  private async openTab(tab: TerminalTab): Promise<void> {
    this.tabs.set([...this.tabs(), tab]);
    if (tab.groupId) this.tabs.set(moveTabToGroup(this.tabs(), tab.id, tab.groupId));
    this.activeId.set(tab.id);
    const opening = this.mount(tab);
    this.openingTabs.set(tab.id, opening);
    try { await opening; } finally { this.openingTabs.delete(tab.id); }
    this.scrollActiveTab();
  }

  activate(tab: TerminalTab): void {
    this.activeId.set(tab.id);
    this.renderActive();
    this.scrollActiveTab();
  }

  async closeTab(id: string): Promise<void> {
    if (this.closingIds().includes(id)) return;
    const index = this.tabs().findIndex((tab): boolean => tab.id === id);
    if (index < 0) throw new Error('Unknown tab - select an open terminal tab');
    const tab = this.tabs()[index];
    this.closingIds.update((ids): string[] => [...ids, id]);
    try {
      const opening = this.openingTabs.get(id);
      if (opening) await opening;
      await invoke('close_terminal', { id });
      this.closedTabs.update((tabs): TerminalTab[] => [...tabs, tab]);
      this.instances.get(id)?.terminal.dispose();
      this.instances.delete(id);
      this.tabs.set(this.tabs().filter((tab): boolean => tab.id !== id));
      this.removeEmptyGroups();
      if (!this.tabs().length) { await this.closeWindow(); return; }
      if (this.activeId() === id) this.activate(this.tabs()[Math.min(index, this.tabs().length - 1)]);
      else this.instances.get(this.activeId())?.terminal.focus();
    } finally { this.closingIds.update((ids): string[] => ids.filter((closingId): boolean => closingId !== id)); }
  }

  async reopenTab(): Promise<void> {
    const previous = this.closedTabs().at(-1);
    if (!previous) return;
    this.closedTabs.update((tabs): TerminalTab[] => tabs.slice(0, -1));
    // shortcut: reopening starts a fresh shell; add session persistence when process restoration is required.
    const icon = this.tabs().some((tab): boolean => tab.icon === previous.icon) ? getTabIcon(this.tabs(), crypto.getRandomValues(new Uint32Array(1))[0]) : previous.icon;
    const tab = { ...previous, id: crypto.randomUUID(), icon, groupId: this.groups().some((group): boolean => group.id === previous.groupId) ? previous.groupId : null };
    await this.openTab(tab);
  }

  cycleTab(direction: number): void {
    if (!this.tabs().length) return;
    const index = this.tabs().findIndex((tab): boolean => tab.id === this.activeId());
    this.activate(this.tabs()[(index + direction + this.tabs().length) % this.tabs().length]);
  }

  moveActiveTab(direction: number): void {
    const index = this.tabs().findIndex((tab): boolean => tab.id === this.activeId());
    const target = index + direction;
    if (target < 0 || target >= this.tabs().length) return;
    const tab = { ...this.tabs()[index], groupId: this.tabs()[target].groupId };
    const reordered = this.tabs().filter((candidate): boolean => candidate.id !== tab.id);
    reordered.splice(target, 0, tab);
    this.tabs.set(reordered);
    this.removeEmptyGroups();
    this.scrollActiveTab();
  }

  readonly handleShortcut = async (event: KeyboardEvent): Promise<void> => {
    if (this.settingsDialog.nativeElement.open || this.aboutDialog.nativeElement.open || this.groupDialog.nativeElement.open || this.iconDialog.nativeElement.open) return;
    if (event.key === 'Escape' && (this.tabMenu() || this.appMenu.nativeElement.open)) {
      this.tabMenu.set(undefined);
      this.appMenu.nativeElement.open = false;
      this.focusTerminal();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const shortcut = getTabShortcut(event, this.platform());
    if (!shortcut) return;
    event.preventDefault();
    event.stopPropagation();
    switch (shortcut.action) {
      case 'new': await this.addTab(); break;
      case 'close': if (this.activeId()) await this.closeTab(this.activeId()); break;
      case 'reopen': await this.reopenTab(); break;
      case 'close-window': await this.closeWindow(); break;
      case 'next': this.cycleTab(1); break;
      case 'previous': this.cycleTab(-1); break;
      case 'move-left': this.moveActiveTab(-1); break;
      case 'move-right': this.moveActiveTab(1); break;
      case 'select': {
        const tab = this.tabs()[shortcut.index];
        if (tab) this.activate(tab);
      }
    }
  };

  handleTabKey(event: KeyboardEvent, tab: TerminalTab): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Delete'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Delete') { void this.closeTab(tab.id); return; }
    if (event.key === 'Home') this.activate(this.tabs()[0]);
    else if (event.key === 'End') this.activate(this.tabs()[this.tabs().length - 1]);
    else this.cycleTab(event.key === 'ArrowRight' ? 1 : -1);
    requestAnimationFrame((): void => { this.tabList.nativeElement.querySelector<HTMLButtonElement>(`[data-tab-id="${this.activeId()}"] .tab__select`)?.focus(); });
  }

  handleMiddleClick(event: MouseEvent, tab: TerminalTab): void {
    if (event.button !== 1) return;
    event.preventDefault();
    void this.closeTab(tab.id);
  }

  openTabMenu(event: MouseEvent, tab: TerminalTab): void {
    event.preventDefault();
    this.tabMenu.set({ tabId: tab.id, groupId: tab.groupId, x: Math.max(8, Math.min(event.clientX, window.innerWidth - 240)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 300)) });
    requestAnimationFrame((): void => { document.querySelector<HTMLButtonElement>('.context_menu button')?.focus(); });
  }

  readonly dismissTabMenu = (event: PointerEvent): void => {
    if (!(event.target instanceof Element) || !event.target.closest('.context_menu')) this.tabMenu.set(undefined);
    if (!(event.target instanceof Element) || !event.target.closest('.app_menu')) this.appMenu.nativeElement.open = false;
  };

  openIconEditor(tabId: string): void {
    if (!this.tabs().some((tab): boolean => tab.id === tabId)) throw new Error('Unknown tab - select an open terminal tab');
    this.editingIconId = tabId;
    this.iconError.set('');
    this.tabMenu.set(undefined);
    this.iconDialog.nativeElement.showModal();
  }

  isIconUsed(icon: string): boolean { return this.tabs().some((tab): boolean => tab.id !== this.editingIconId && tab.icon === icon); }

  setTabIcon(icon: string): void {
    if (!this.tabs().some((tab): boolean => tab.id === this.editingIconId)) throw new Error('Unknown tab - select an open terminal tab');
    if (this.isIconUsed(icon)) throw new Error('Icon is already used - choose another icon');
    this.tabs.update((tabs): TerminalTab[] => tabs.map((tab): TerminalTab => tab.id === this.editingIconId ? { ...tab, icon } : tab));
    this.iconDialog.nativeElement.close();
  }

  async uploadTabIcon(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const tabId = this.editingIconId;
    this.iconError.set('');
    try {
      const icon = await readTabImage(file);
      if (this.editingIconId !== tabId || !this.iconDialog.nativeElement.open) return;
      this.setTabIcon(icon);
    }
    catch (error: unknown) { this.iconError.set(String(error)); throw error; }
    finally { input.value = ''; }
  }

  handleMenuKey(event: KeyboardEvent): void {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Home') buttons[0].focus();
    else if (event.key === 'End') buttons[buttons.length - 1].focus();
    else buttons[(current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
  }

  handleSettingsKey(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    this.settingsTab.set(event.key === 'Home' ? 'main' : event.key === 'End' ? 'theme' : this.settingsTab() === 'main' ? 'theme' : 'main');
    this.settingsDialog.nativeElement.querySelector<HTMLButtonElement>(`#${this.settingsTab()}-settings-tab`)!.focus();
  }

  getGroup(id: string): TabGroup {
    const group = this.groups().find((group): boolean => group.id === id);
    if (!group) throw new Error('Unknown tab group - create a group first');
    return group;
  }

  isTabHidden(tab: TerminalTab): boolean { return tab.groupId !== null && this.getGroup(tab.groupId).isCollapsed && tab.id !== this.activeId(); }

  createGroup(tabId: string): void {
    const group = { id: crypto.randomUUID(), name: `Group ${this.nextGroup++}`, color: this.groupColors[this.groups().length % this.groupColors.length].value, isCollapsed: false };
    this.groups.set([...this.groups(), group]);
    this.tabs.set(moveTabToGroup(this.tabs(), tabId, group.id));
    this.removeEmptyGroups();
    this.openGroup(group);
  }

  assignGroup(tabId: string, groupId: string | null): void {
    this.tabs.set(moveTabToGroup(this.tabs(), tabId, groupId));
    this.removeEmptyGroups();
    this.tabMenu.set(undefined);
  }

  openGroup(group: TabGroup): void {
    this.tabMenu.set(undefined);
    this.editingGroupId.set(group.id);
    this.groupDialog.nativeElement.showModal();
  }

  toggleGroup(id: string): void {
    this.groups.update((groups): TabGroup[] => groups.map((group): TabGroup => group.id === id ? { ...group, isCollapsed: !group.isCollapsed } : group));
  }

  setGroupColor(color: string): void {
    const group = this.editingGroup();
    if (!group) throw new Error('No group selected - open a group to change its color');
    this.groups.update((groups): TabGroup[] => groups.map((candidate): TabGroup => candidate.id === group.id ? { ...candidate, color } : candidate));
  }

  renameGroup(event: Event): void {
    const input = event.target as HTMLInputElement;
    const name = input.value.trim();
    input.setCustomValidity(name ? '' : 'Enter a group name');
    if (!input.reportValidity()) return;
    const group = this.editingGroup();
    if (!group) throw new Error('No group selected - open a group to rename it');
    this.groups.update((groups): TabGroup[] => groups.map((candidate): TabGroup => candidate.id === group.id ? { ...candidate, name } : candidate));
  }

  ungroup(group: TabGroup): void {
    this.tabs.set(this.tabs().map((tab): TerminalTab => tab.groupId === group.id ? { ...tab, groupId: null } : tab));
    this.removeEmptyGroups();
    this.groupDialog.nativeElement.close();
  }

  async closeGroup(group: TabGroup): Promise<void> {
    this.groupDialog.nativeElement.close();
    for (const tab of this.tabs().filter((tab): boolean => tab.groupId === group.id)) await this.closeTab(tab.id);
  }

  startTabDrag(event: DragEvent, tab: TerminalTab): void {
    event.dataTransfer!.setData('application/x-tiii-tab', tab.id);
    event.dataTransfer!.effectAllowed = 'move';
    this.tabMenu.set(undefined);
  }

  dropTab(event: DragEvent, target: TerminalTab): void {
    event.preventDefault();
    this.tabs.set(reorderTab(this.tabs(), event.dataTransfer!.getData('application/x-tiii-tab'), target.id));
    this.removeEmptyGroups();
  }

  dropIntoGroup(event: DragEvent, group: TabGroup): void {
    event.preventDefault();
    this.assignGroup(event.dataTransfer!.getData('application/x-tiii-tab'), group.id);
  }

  private removeEmptyGroups(): void {
    this.groups.set(this.groups().filter((group): boolean => this.tabs().some((tab): boolean => tab.groupId === group.id)));
  }

  async openSettings(): Promise<void> {
    this.settingsDialog.nativeElement.showModal();
    if (this.fonts().length) return;
    try { this.fonts.set(await invoke<string[]>('get_fonts')); }
    catch (error: unknown) { this.fontError.set(`Could not detect fonts: ${String(error)}`); throw error; }
  }

  setProfile(event: Event): void {
    const profile = this.profiles().find((profile): boolean => profile.id === (event.target as HTMLSelectElement).value);
    if (!profile) throw new Error('Unknown shell profile - select an installed profile');
    this.selectedProfile.set(profile);
    this.saveSettings();
  }

  setTheme(theme: keyof typeof themes): void {
    this.theme.set(theme);
    for (const { terminal } of this.instances.values()) {
      terminal.options.theme = this.themes[theme];
      terminal.refresh(0, terminal.rows - 1);
    }
    this.saveSettings();
  }

  async setFont(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    input.setCustomValidity(input.value === 'monospace' || this.fonts().includes(input.value) ? '' : 'Choose an installed font from the list');
    if (!input.reportValidity()) return;
    this.fontFamily.set(input.value);
    await this.applyFont();
    this.saveSettings();
  }

  async setFontSize(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.reportValidity()) return;
    this.fontSize.set(input.valueAsNumber);
    await this.applyFont();
    this.saveSettings();
  }

  async setScale(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.reportValidity()) return;
    const scale = input.valueAsNumber;
    await getCurrentWebview().setZoom(scale / 100);
    this.scale.set(scale);
    this.instances.get(this.activeId())?.fit.fit();
    this.saveSettings();
  }

  private async restoreSettings(): Promise<void> {
    const stored = localStorage.getItem('tiii-terminal-settings');
    if (stored === null) { this.saveSettings(); return; }
    const settings = parseSettings(stored);
    const profile = this.profiles().find((profile): boolean => profile.id === settings.profileId);
    if (!profile) throw new Error('Saved shell profile is unavailable - reinstall the shell or reset saved settings');
    if (settings.fontFamily !== 'monospace') {
      this.fonts.set(await invoke<string[]>('get_fonts'));
      if (!this.fonts().includes(settings.fontFamily)) throw new Error('Saved font is unavailable - reinstall the font or reset saved settings');
    }
    this.selectedProfile.set(profile);
    this.theme.set(settings.theme);
    this.fontFamily.set(settings.fontFamily);
    this.fontSize.set(settings.fontSize);
    await this.applyFont();
    await getCurrentWebview().setZoom(settings.scale / 100);
    this.scale.set(settings.scale);
  }

  private saveSettings(): void {
    const profile = this.selectedProfile();
    if (!profile) throw new Error('No shell profile selected - choose a profile before saving settings');
    localStorage.setItem('tiii-terminal-settings', JSON.stringify({ theme: this.theme(), profileId: profile.id, fontFamily: this.fontFamily(), fontSize: this.fontSize(), scale: this.scale() }));
  }

  private get terminalFontFamily(): string { return this.fontFamily() === 'monospace' ? 'monospace' : JSON.stringify(this.fontFamily()); }

  clearInputValidity(event: Event): void { (event.target as HTMLInputElement).setCustomValidity(''); }

  focusTerminal(): void { this.instances.get(this.activeId())?.terminal.focus(); }

  private async applyFont(): Promise<void> {
    await document.fonts.load(`${this.fontSize()}px ${this.terminalFontFamily}`);
    for (const { terminal } of this.instances.values()) {
      terminal.options.fontFamily = this.terminalFontFamily;
      terminal.options.fontSize = this.fontSize();
    }
    this.instances.get(this.activeId())?.fit.fit();
  }

  private async mount(tab: TerminalTab): Promise<void> {
    const terminal = new Terminal({ theme: this.themes[this.theme()], fontFamily: this.terminalFontFamily, fontSize: this.fontSize(), cursorBlink: true });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    this.instances.set(tab.id, { terminal, fit });
    terminal.open(this.host.nativeElement);
    this.renderActive();
    fit.fit();
    const { cols, rows } = terminal;
    await invoke('open_terminal', { id: tab.id, cols, rows, profileId: tab.profileId });
    terminal.onData((data): void => { void invoke('write_terminal', { id: tab.id, data }); });
    terminal.onResize((size): void => { void invoke('resize_terminal', { id: tab.id, cols: size.cols, rows: size.rows }); });
    if (tab.id === this.activeId()) { fit.fit(); terminal.focus(); }
  }

  private renderActive(): void {
    for (const [id, { terminal }] of this.instances) terminal.element!.style.display = id === this.activeId() ? 'block' : 'none';
    const instance = this.instances.get(this.activeId());
    if (instance) { instance.fit.fit(); instance.terminal.focus(); }
  }

  private scrollActiveTab(): void {
    requestAnimationFrame((): void => { this.tabList.nativeElement.querySelector(`[data-tab-id="${this.activeId()}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
  }

  ngOnDestroy(): void {
    this.unlisten?.();
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.handleShortcut, true);
    document.removeEventListener('pointerdown', this.dismissTabMenu);
    for (const { terminal } of this.instances.values()) terminal.dispose();
  }
}
