export type TerminalTab = {
  id: string;
  icon: string;
  profileId: string;
  profileName: string;
  groupId: string | null;
};

export type TabGroup = { id: string; name: string; color: string; isCollapsed: boolean };

export type TabShortcut =
  | { action: 'new' | 'close' | 'reopen' | 'next' | 'previous' | 'move-left' | 'move-right' | 'close-window' }
  | { action: 'select'; index: number };
