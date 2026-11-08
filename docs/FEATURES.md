# TIIIErminal — features worth opening a terminal for

TIIIErminal is a compact desktop terminal for people who want their shell, their colors, and their working space back. This document separates what users can use today from ideas to explore next. Ideas are not release promises.

## Available today

### Your shell, with room to work

Run PowerShell 7 on Windows or detected shells such as Zsh, Bash, and Fish on macOS and Linux. Each tab runs its own independent shell. A single compact header keeps tabs, settings, and window controls together, leaving the rest of the window for terminal content.

### Tabs you can recognize at a glance

Drag tabs to reorder them. Give related terminals a named, colored group and collapse it when it is in the way. Choose a built-in tab icon or upload an SVG, JPG, or PNG. Images are embedded in the saved layout, so moving the original file does not break the icon. Tab numbers follow their current positions and match numeric keyboard shortcuts.

### A familiar space when you return

Tab order, icons, shell profiles, groups, the active tab, and user settings are saved on your computer. Restarting opens fresh shells in the saved layout. On Linux, available working folders are remembered too; live processes and scrollback are not restored. Closing or reopening a tab does not resume its former process.

### Color that reaches the whole interface

Choose TIII, Dracula, Tokyo Night, Catppuccin, Nord, or Gruvbox. Themes cover terminal colors, the tab header, menus, settings, and scrollbars. Terminal applications that explicitly paint their own RGB colors keep those colors. TIII is the default and shares the TIII editor's terminal palette.

### Make the window feel like yours

Choose an installed font, adjust terminal font size, and scale the interface from 50% to 200%. Windows acrylic and macOS vibrancy work with an adjustable background tint. Linux uses an opaque window and disables the opacity slider to preserve reliable rendering.

### Keep your hands on the keyboard

Open, close, reopen, switch, select, and reorder tabs with shortcuts. Use native clipboard actions from the terminal context menu. Linux supports Ctrl+Shift+C / Ctrl+Shift+V while leaving Ctrl+C available for interrupts. Pasting respects the terminal application's bracketed-paste mode.

## Potential features — not implemented

| Idea | Why a user would care | Smallest useful version | What must stay safe |
| --- | --- | --- | --- |
| Project workspaces | Open the right shells and folders for a project in one action. | Save and open a named tab layout with explicit working directories. | Do not execute project commands automatically. Clearly identify missing folders and shells. |
| Split panes | Watch a server, tests, and a shell side by side. | Horizontal and vertical splits with keyboard focus movement. | Keep resizing, selection, and screen-reader navigation predictable. |
| Searchable scrollback | Find an error or command result without leaving the terminal. | In-tab text search with next/previous matches and a visible match count. | Keep searches local; do not upload terminal output. |
| A command palette | Reach a setting or tab action without memorizing every shortcut. | A searchable list of existing actions with their shortcuts. | Do not intercept shell shortcuts while the palette is closed. |
| Session snapshots | Keep useful output across app restarts. | Opt-in, bounded, local scrollback snapshots with a clear delete action. | Output can contain secrets. Explain storage, exclude sensitive sessions, and avoid claiming to restore running processes. |
| Completion notifications | Stop repeatedly checking a long-running job. | Opt-in notification when a command completes in an inactive tab. | Use reliable shell integration; never guess success from output text. |
| Secure SSH profiles | Open frequent remote destinations with less repetition. | Named destinations that invoke the installed SSH client. | Leave keys, host verification, and agent access with SSH; never store passwords in a profile. |
| Reusable command snippets | Reuse a tricky command without searching old notes. | Named local snippets inserted into the prompt for review. | Never execute a snippet on selection. Treat pasted multiline commands as an explicit action. |
| Portable preferences | Move a familiar setup to another computer. | Import/export themes, typography, and layout as a versioned file. | Exclude secrets and output; validate imports before replacing existing settings. |
| Shareable themes | Bring a favorite palette into every part of the terminal. | A validated theme file with a live preview and cancel action. | Accept color data only, with no executable theme code. |

## Suggested order

Start with scrollback search, the command palette, and explicit project workspaces: each improves an everyday workflow without requiring remote services. Split panes come next. Persistence of terminal output, shell completion integration, and SSH profiles need a separate security and platform review before implementation.

## Landing-page content rules

Promote the available features above. Present screenshots as the actual app interface with illustrative command output. Do not claim benchmark results, customer numbers, live-process restoration, cloud sync, or AI features. Do not advertise an installer until that installer exists. Link to source and platform build instructions in the meantime.
