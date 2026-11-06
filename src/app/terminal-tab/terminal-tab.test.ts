import { describe, expect, test } from 'bun:test';
import { TerminalTab } from './terminal-tab.types';
import { getTabIcon, getTabShortcut, moveTabToGroup, reorderTab } from './terminal-tab.utils';

const tab = (id: string, groupId: string | null): TerminalTab => ({ id, icon: '', profileId: 'pwsh', profileName: 'PowerShell 7', groupId });
const key = (value: string): Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> => ({ key: value, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false });

test('icons stay unique beyond the preset collection even when randomness repeats', (): void => {
  const tabs: Pick<TerminalTab, 'icon'>[] = [];
  for (let index = 0; index < 100; index++) tabs.push({ icon: getTabIcon(tabs, 0) });
  expect(new Set(tabs.map((tab): string => tab.icon)).size).toBe(100);
});

describe('browser shortcuts', (): void => {
  test('Windows and macOS use their platform modifier to open tabs', (): void => {
    expect(getTabShortcut(key('t'), 'windows')).toEqual({ action: 'new' });
    expect(getTabShortcut({ ...key('t'), ctrlKey: false, metaKey: true }, 'macos')).toEqual({ action: 'new' });
    expect(getTabShortcut(key('t'), 'macos')).toBeUndefined();
  });
  test('the ninth shortcut selects the tab numbered nine', (): void => {
    expect(getTabShortcut(key('9'), 'linux')).toEqual({ action: 'select', index: 8 });
  });
  test('shift cycles backwards and reopens closed tabs', (): void => {
    expect(getTabShortcut({ ...key('Tab'), shiftKey: true }, 'windows')).toEqual({ action: 'previous' });
    expect(getTabShortcut({ ...key('T'), shiftKey: true }, 'windows')).toEqual({ action: 'reopen' });
  });
  test('terminal copy and interrupt keys are left to the terminal', (): void => {
    expect(getTabShortcut(key('c'), 'windows')).toBeUndefined();
    expect(getTabShortcut({ ...key('t'), altKey: true }, 'windows')).toBeUndefined();
  });
});

describe('tab groups', (): void => {
  test('moving a tab joins the end of a group without splitting its members', (): void => {
    const result = moveTabToGroup([tab('1', 'work'), tab('2', 'work'), tab('3', null)], '3', 'work');
    expect(result.map(item => [item.id, item.groupId])).toEqual([['1', 'work'], ['2', 'work'], ['3', 'work']]);
  });
  test('removing a middle member leaves its original group together', (): void => {
    const result = moveTabToGroup([tab('1', 'work'), tab('2', 'work'), tab('3', 'work')], '2', null);
    expect(result.map(item => [item.id, item.groupId])).toEqual([['1', 'work'], ['3', 'work'], ['2', null]]);
  });
  test('creating a new group from a middle member keeps the old group contiguous', (): void => {
    const result = moveTabToGroup([tab('1', 'work'), tab('2', 'work'), tab('3', 'work')], '2', 'new');
    expect(result.map(item => [item.id, item.groupId])).toEqual([['1', 'work'], ['3', 'work'], ['2', 'new']]);
  });
  test('dropping onto a grouped tab moves and groups the dragged tab', (): void => {
    const result = reorderTab([tab('1', null), tab('2', 'work'), tab('3', 'work')], '1', '3');
    expect(result.map(item => [item.id, item.groupId])).toEqual([['2', 'work'], ['3', 'work'], ['1', 'work']]);
  });
  test('dragging right moves the tab to the target position, including adjacent and final positions', (): void => {
    expect(reorderTab([tab('1', null), tab('2', null)], '1', '2').map((item): string => item.id)).toEqual(['2', '1']);
    expect(reorderTab([tab('1', null), tab('2', null), tab('3', null)], '1', '3').map((item): string => item.id)).toEqual(['2', '3', '1']);
  });
  test('dragging left moves the tab before the target and dropping on itself keeps the order', (): void => {
    const tabs = [tab('1', null), tab('2', null), tab('3', null)];
    expect(reorderTab(tabs, '3', '1').map((item): string => item.id)).toEqual(['3', '1', '2']);
    expect(reorderTab(tabs, '2', '2')).toEqual(tabs);
  });
  test('unknown dragged tabs are rejected', (): void => {
    expect(() => reorderTab([tab('1', null)], 'missing', '1')).toThrow('Unknown tab');
  });
});
