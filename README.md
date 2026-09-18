# NoteEasy

A fast, lightweight notepad for Windows — tabs, highlighting, and a clean Notepad-style chrome, without the Electron bloat.

Built with [Tauri 2](https://v2.tauri.app/) + React + [TipTap](https://tiptap.dev/). Uses the system WebView2 runtime, so installs stay small and snappy.

## Why NoteEasy?

Classic Notepad is great until you need more than plain text. NoteEasy keeps that familiar feel and adds the bits you actually use:

- **Tabs** — keep several notes open; session restores when you reopen the app
- **Inline highlight** — yellow, blue, pink, or a custom color, like a real highlighter
- **Rich basics** — bold, italic, strikethrough, font color, lists, paragraph styles
- **Find & replace** — search without leaving the editor
- **Dark mode** — one-click moon toggle, remembered next launch
- **Compact toolbar** — shrink the window and tools fold into a tidy overflow menu
- **`.nte` files** — save notes with formatting; plain `.txt` when you want portable text

## Download

Grab the latest Windows build from the [Releases](https://github.com/BrandonS8/NoteEasy/releases) page:

| Asset | What it is |
| --- | --- |
| **`.msi`** | Windows installer (recommended for most people) |
| **`.exe` (NSIS)** | Alternate installer |
| **Portable `.exe`** | Run without installing (from the release binaries) |

Windows 10/11 with [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (usually already installed).

## Screenshots

Frameless tabs, centered formatting toolbar, status bar with zoom — sized for everyday notes, not a dashboard.

## Develop

**Requirements:** Node.js 18+, Rust via [rustup](https://rustup.rs/), Windows WebView2.

```bash
npm install
npm run tauri dev
```

If your C: drive is tight on space, point Cargo elsewhere first:

```powershell
$env:CARGO_TARGET_DIR = "D:\cargo-target\NoteEasy"
$env:CARGO_HOME = "D:\cargo-home"
```

## Build a release

```bash
npm run tauri build
```

Installers land under your Cargo target dir, typically:

`src-tauri/target/release/bundle/`  
(or `$env:CARGO_TARGET_DIR/release/bundle/` if you set that)

## License

MIT — use it, fork it, ship it with your notes.
