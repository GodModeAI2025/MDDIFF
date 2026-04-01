# MDDIFF – Markdown Diff Editor

A side-by-side Markdown diff editor built with Electron. Compare, edit, and preview two Markdown files with Git-style diff highlighting.

![MDDIFF Screenshot](screenshot.png)

## Features

- **Split View** – Two Markdown files side by side
- **Git-style Diff** – Line-by-line comparison with additions (green) and deletions (red)
- **Diff Preview** – Toggle between raw source diff and rendered Markdown diff with visual markers
- **Live Preview** – Switch each panel between edit mode and rendered Markdown preview
- **Synchronized Scrolling** – Left and right panels scroll in sync (editor, preview, and diff)
- **Drag & Drop** – Drop `.md` files directly into either panel
- **MD-only** – File dialogs filter for Markdown files (`.md`, `.markdown`, `.mdown`, `.mkd`)
- **Dark Theme** – Catppuccin-inspired dark UI

## Installation

### Pre-built (macOS Apple Silicon)

Download the latest `.dmg` from [Releases](https://github.com/GodModeAI2025/MDDIFF/releases).

> Since the app is not notarized, right-click > **Open** on first launch, or run:
> ```bash
> xattr -cr /Applications/MDDIFF.app
> ```

### From Source

```bash
git clone https://github.com/GodModeAI2025/MDDIFF.git
cd MDDIFF
npm install
npm start
```

### Build Installer

```bash
npm run build       # DMG for Apple Silicon
```

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Open left file | `Cmd+O` |
| Open right file | `Cmd+Shift+O` |
| Save left file | `Cmd+S` |
| Save right file | `Cmd+Shift+S` |

## Tech Stack

- [Electron](https://www.electronjs.org/) – Desktop runtime
- Pure HTML/CSS/JS – No framework dependencies in the renderer
- LCS-based diff algorithm – Built-in, no external diff library needed at runtime

## License

MIT
