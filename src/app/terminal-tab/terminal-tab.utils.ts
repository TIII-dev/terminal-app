import { tabIcons } from './terminal-tab.constants';
import { TabShortcut, TerminalTab } from './terminal-tab.types';

export const getTabIcon = (
  tabs: Pick<TerminalTab, 'icon'>[],
  randomValue: number,
): string => {
  const used = new Set(tabs.map((tab): string => tab.icon));
  const available = tabIcons.filter((icon): boolean => !used.has(icon));
  if (available.length) return available[randomValue % available.length];
  for (let value = randomValue + 1; ; value++) {
    const bits = value.toString(2);
    const columns = Math.ceil(Math.sqrt(bits.length));
    const size = 16 / columns;
    const icon =
      'M3 3h18v18H3z ' +
      Array.from(bits, (bit, index): string =>
        bit === '1'
          ? `M${4 + ((index % columns) + 0.5) * size} ${4 + (Math.floor(index / columns) + 0.5) * size}h.01`
          : '',
      ).join('');
    if (!used.has(icon)) return icon;
  }
};

export const getTabShortcut = (
  event: Pick<
    KeyboardEvent,
    'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'
  >,
  platform: string,
): TabShortcut | undefined => {
  const key = event.key.toLowerCase();
  const isPrimary =
    platform === 'macos'
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey;
  if (event.ctrlKey && !event.metaKey && !event.altKey) {
    if (key === 'tab') return { action: event.shiftKey ? 'previous' : 'next' };
    if (key === 'pageup')
      return { action: event.shiftKey ? 'move-left' : 'previous' };
    if (key === 'pagedown')
      return { action: event.shiftKey ? 'move-right' : 'next' };
  }
  if (platform === 'macos' && isPrimary && event.altKey && !event.shiftKey) {
    if (key === 'arrowleft') return { action: 'previous' };
    if (key === 'arrowright') return { action: 'next' };
  }
  if (!isPrimary || event.altKey) return undefined;
  if (key === 't') return { action: event.shiftKey ? 'reopen' : 'new' };
  if (key === 'w') return { action: event.shiftKey ? 'close-window' : 'close' };
  if (!event.shiftKey && /^[1-9]$/.test(key))
    return { action: 'select', index: Number(key) - 1 };
  return undefined;
};

export const moveTabToGroup = (
  tabs: TerminalTab[],
  tabId: string,
  groupId: string | null,
): TerminalTab[] => {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index < 0) throw new Error('Unknown tab - select an open terminal tab');
  const remaining = tabs.filter((tab) => tab.id !== tabId);
  let insertAt = remaining.length;
  for (let i = remaining.length - 1; groupId !== null && i >= 0; i--) {
    if (remaining[i].groupId === groupId) {
      insertAt = i + 1;
      break;
    }
  }
  remaining.splice(insertAt, 0, { ...tabs[index], groupId });
  return remaining;
};

export const reorderTab = (
  tabs: TerminalTab[],
  tabId: string,
  targetId: string,
): TerminalTab[] => {
  const source = tabs.find((tab) => tab.id === tabId);
  const target = tabs.find((tab) => tab.id === targetId);
  if (!source || !target)
    throw new Error('Unknown tab - drag an open terminal tab');
  if (tabId === targetId) return tabs;
  const remaining = tabs.filter((tab) => tab.id !== tabId);
  remaining.splice(tabs.indexOf(target), 0, {
    ...source,
    groupId: target.groupId,
  });
  return remaining;
};
