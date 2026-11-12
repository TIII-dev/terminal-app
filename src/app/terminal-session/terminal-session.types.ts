import { TabGroup, TerminalTab } from '../terminal-tab/terminal-tab.types';

export type TerminalSession = {
  tabs: TerminalTab[];
  groups: TabGroup[];
  activeId: string;
  nextGroup: number;
};
