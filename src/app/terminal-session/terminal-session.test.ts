import { expect, test } from 'bun:test';

import { TerminalSession } from './terminal-session.types';
import { parseTerminalSession } from './terminal-session.utils';

const session: TerminalSession = {
  tabs: [
    {
      id: 'first',
      icon: 'M0 0h1',
      profileId: 'pwsh',
      profileName: 'PowerShell 7',
      groupId: 'work',
    },
    {
      id: 'second',
      icon: 'data:image/png;base64,aWNvbg==',
      profileId: 'pwsh',
      profileName: 'PowerShell 7',
      groupId: null,
    },
  ],
  groups: [{ id: 'work', name: 'Work', color: '#b79aff', isCollapsed: true }],
  activeId: 'second',
  nextGroup: 2,
};

test('saved tabs retain order, image icons, groups, active selection, and the next group number', (): void => {
  expect(parseTerminalSession(JSON.stringify(session))).toEqual(session);
  expect(
    parseTerminalSession(
      JSON.stringify({ tabs: [], groups: [], activeId: '', nextGroup: 1 }),
    ).tabs,
  ).toEqual([]);
});

test('malformed sessions and unsafe image sources are rejected', (): void => {
  for (const stored of [
    '{',
    'null',
    '{}',
    JSON.stringify({ ...session, nextGroup: 0 }),
  ])
    expect(() => parseTerminalSession(stored)).toThrow();
  for (const icon of [
    '',
    'javascript:alert(1)',
    'https://example.com/icon.svg',
    'data:text/html;base64,aWNvbg==',
  ]) {
    expect(() =>
      parseTerminalSession(
        JSON.stringify({
          ...session,
          tabs: [{ ...session.tabs[0], icon }, session.tabs[1]],
        }),
      ),
    ).toThrow('Invalid saved tabs');
  }
});

test('duplicate IDs, duplicate icons, and missing group or active tab references are rejected', (): void => {
  for (const change of [
    { id: 'first' },
    { icon: session.tabs[0].icon },
    { groupId: 'missing' },
    { id: 'unsafe"selector' },
  ]) {
    expect(() =>
      parseTerminalSession(
        JSON.stringify({
          ...session,
          tabs: [session.tabs[0], { ...session.tabs[1], ...change }],
        }),
      ),
    ).toThrow();
  }
  for (const change of [
    { activeId: 'missing' },
    { groups: [] },
    { groups: [...session.groups, session.groups[0]] },
    { groups: [...session.groups, { ...session.groups[0], id: 'unused' }] },
  ]) {
    expect(() =>
      parseTerminalSession(JSON.stringify({ ...session, ...change })),
    ).toThrow('Inconsistent saved tabs');
  }
});

test('group members separated by another tab are rejected', (): void => {
  const tabs = [
    ...session.tabs,
    { ...session.tabs[0], id: 'third', icon: 'M1 1h2' },
  ];
  expect(() =>
    parseTerminalSession(JSON.stringify({ ...session, tabs })),
  ).toThrow('Split saved tab group');
});

test('saved directories preserve Linux and Windows paths while rejecting invalid values', (): void => {
  for (const directory of [
    '/home/user/a space/ü',
    'C:\\Users\\user\\Projects',
  ]) {
    const saved = {
      ...session,
      tabs: [{ ...session.tabs[0], directory }, session.tabs[1]],
    };
    expect(parseTerminalSession(JSON.stringify(saved)).tabs[0].directory).toBe(
      directory,
    );
  }
  for (const directory of ['', null, 123, '/tmp/\0invalid']) {
    expect(() =>
      parseTerminalSession(
        JSON.stringify({
          ...session,
          tabs: [{ ...session.tabs[0], directory }, session.tabs[1]],
        }),
      ),
    ).toThrow('Invalid saved tabs');
  }
});
