# MDDIFF – Markdown Diff Editor

Side-by-side Markdown comparison tool built with Electron. Compare an original against a modified version with clear diff highlighting.

## Features

- **Always-on Diff** – Original (left, read-only) vs. Modified (right, editable) side by side
- **Green (+) Highlighting** – Lines unique to each side are marked with green gutter indicators
- **Cursor Sync** – Moving the cursor on the right highlights the corresponding line in the left gutter
- **Line-synced Scrolling** – Right scroll maps to the matching original line on the left
- **Markdown Preview** – Toggle rendered preview with diff markers preserved
- **Table of Contents** – Navigate headings via dropdown per panel
- **Delta Navigation** – Jump between changes with arrow buttons
- **Compare History** – Last 5 comparisons stored, reload with one click
- **Two-file Open** – Select two files at once for quick comparison
- **Save** – Save modified file (right side only)
- **Dark / Light Theme** – Toggle in top bar
- **Drag & Drop** – Drop `.md` files into either panel
- **Whitespace-tolerant** – Trailing whitespace ignored in comparison

## Layout

```
[History] [2 Dateien öffnen] | [Vorschau] [+N Unterschiede] [Theme]
┌─────────────────────────┬─────────────────────────┐
│ ORIGINAL (read-only)    │ GEAENDERT (editable)    │
│ Gutter with line nums   │ Gutter with +N markers  │
│ Cursor-line indicator   │ Editor textarea         │
│ TOC | Delta nav         │ TOC | Delta nav | Save  │
└─────────────────────────┴─────────────────────────┘
```

## Installation

### Pre-built (macOS Apple Silicon)

Download the latest `.dmg` from [Releases](https://github.com/GodModeAI2025/MDDIFF/releases).

> First launch: right-click > **Open**, or run:
> ```bash
> xattr -cr /Applications/MDDIFF.app
> ```

### From Source

```bash
git clone https://github.com/GodModeAI2025/MDDIFF.git
cd MDDIFF
npm install
npm run check
npm start
```

### Build Installer

```bash
npm run build       # DMG for Apple Silicon
```

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Open two files | `Cmd+O` |
| Open left file | `Cmd+Shift+O` |
| Open right file | `Cmd+Alt+O` |
| Save right file | `Cmd+S` |

## Tech Stack

- [Electron](https://www.electronjs.org/) – Desktop runtime
- Pure HTML/CSS/JS – No framework dependencies
- LCS-based diff algorithm with whitespace trimming

## License

MIT
