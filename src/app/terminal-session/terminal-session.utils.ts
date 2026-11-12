import { TabGroup, TerminalTab } from '../terminal-tab/terminal-tab.types';
import { TerminalSession } from './terminal-session.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is string =>
  typeof value === 'string' && /^[\w-]+$/.test(value);

const isTab = (value: unknown): value is TerminalTab =>
  isRecord(value) &&
  isId(value['id']) &&
  isId(value['profileId']) &&
  typeof value['profileName'] === 'string' &&
  value['profileName'].trim().length > 0 &&
  (value['groupId'] === null || isId(value['groupId'])) &&
  (value['directory'] === undefined ||
    (typeof value['directory'] === 'string' &&
      value['directory'].length > 0 &&
      !value['directory'].includes('\0'))) &&
  typeof value['icon'] === 'string' &&
  (/^[MmLlHhVvCcSsQqTtAaZz0-9\s.,+-]+$/.test(value['icon']) ||
    /^data:image\/(svg\+xml|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      value['icon'],
    ));

const isGroup = (value: unknown): value is TabGroup =>
  isRecord(value) &&
  isId(value['id']) &&
  typeof value['name'] === 'string' &&
  value['name'].trim().length > 0 &&
  value['name'].length <= 32 &&
  typeof value['color'] === 'string' &&
  /^#[\da-f]{6}$/i.test(value['color']) &&
  typeof value['isCollapsed'] === 'boolean';

export const parseTerminalSession = (stored: string): TerminalSession => {
  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch (error: unknown) {
    throw new Error(
      'Unreadable saved tabs - remove tiii-terminal-tabs from local storage to reset',
      { cause: error },
    );
  }
  if (
    !isRecord(value) ||
    !Array.isArray(value['tabs']) ||
    !value['tabs'].every(isTab) ||
    !Array.isArray(value['groups']) ||
    !value['groups'].every(isGroup) ||
    typeof value['activeId'] !== 'string' ||
    typeof value['nextGroup'] !== 'number' ||
    !Number.isSafeInteger(value['nextGroup']) ||
    value['nextGroup'] < 1
  ) {
    throw new Error(
      'Invalid saved tabs - remove tiii-terminal-tabs from local storage to reset',
    );
  }
  const tabs = value['tabs'];
  const groups = value['groups'];
  const groupIds = new Set(groups.map((group): string => group.id));
  if (
    new Set(tabs.map((tab): string => tab.id)).size !== tabs.length ||
    new Set(tabs.map((tab): string => tab.icon)).size !== tabs.length ||
    groupIds.size !== groups.length ||
    tabs.some(
      (tab): boolean => tab.groupId !== null && !groupIds.has(tab.groupId),
    ) ||
    groups.some(
      (group): boolean =>
        !tabs.some((tab): boolean => tab.groupId === group.id),
    ) ||
    (tabs.length === 0
      ? value['activeId'] !== ''
      : !tabs.some((tab): boolean => tab.id === value['activeId']))
  ) {
    throw new Error(
      'Inconsistent saved tabs - remove tiii-terminal-tabs from local storage to reset',
    );
  }
  const visited = new Set<string>();
  for (const [index, tab] of tabs.entries()) {
    if (tab.groupId === null || tabs[index - 1]?.groupId === tab.groupId)
      continue;
    if (visited.has(tab.groupId))
      throw new Error(
        'Split saved tab group - remove tiii-terminal-tabs from local storage to reset',
      );
    visited.add(tab.groupId);
  }
  return {
    tabs,
    groups,
    activeId: value['activeId'],
    nextGroup: value['nextGroup'],
  };
};
