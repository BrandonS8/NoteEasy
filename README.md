# NoteEasy

A lightweight Windows Notepad clone with **inline text highlighting** and tabbed session restore. Built with [Tauri 2](https://v2.tauri.app/) (WebView2 — no Electron) and TipTap.

## Features

- Multi-tab editing
- Yellow / color highlight on selected text (inline, like a highlighter)
- Word wrap, font, zoom, find & replace, status bar
- Open / save `.txt` (plain) and `.nte` (keeps highlights)
- Session restore: close the app and reopen — tabs and highlights come back

## Develop

Requirements: Node.js, Rust (rustup), Windows WebView2 (usually preinstalled).

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

The installer / exe lands under `src-tauri/target/release/bundle/`.
