# Future ideas

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

Promote the available features in the README. Present screenshots as the actual app interface with illustrative command output. Do not claim benchmark results, customer numbers, live-process restoration, cloud sync, or AI features. Do not advertise an installer until that installer exists. Link to source and platform build instructions in the meantime.
