/* ─── State ─────────────────────────────────────────────────────── */
const state = {
  left:  { filePath: null, content: '', mode: 'edit', dirty: false },
  right: { filePath: null, content: '', mode: 'edit', dirty: false },
  view: 'split',          // 'split' | 'diff'
  diffMode: 'source',     // 'source' | 'preview'
  syncScroll: true
};

/* ─── DOM refs ──────────────────────────────────────────────────── */
const els = {
  editorLeft:   document.getElementById('editorLeft'),
  editorRight:  document.getElementById('editorRight'),
  previewLeft:  document.getElementById('previewLeft'),
  previewRight: document.getElementById('previewRight'),
  fileNameLeft: document.getElementById('fileNameLeft'),
  fileNameRight:document.getElementById('fileNameRight'),
  contentLeft:  document.getElementById('contentLeft'),
  contentRight: document.getElementById('contentRight'),
  diffLeft:     document.getElementById('diffLeft'),
  diffRight:    document.getElementById('diffRight'),
  diffStats:    document.getElementById('diffStats'),
  diffContentSource:  document.getElementById('diffContentSource'),
  diffContentPreview: document.getElementById('diffContentPreview'),
  diffPreviewLeft:    document.getElementById('diffPreviewLeft'),
  diffPreviewRight:   document.getElementById('diffPreviewRight'),
  mainContainer:document.getElementById('mainContainer'),
  diffPanel:    document.getElementById('diffPanel'),
};

/* ─── Minimal Markdown → HTML (no external dep in renderer) ───── */
function renderMarkdown(md) {
  let html = md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headings
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    // Bold & Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Links & Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Horizontal rule
    .replace(/^---+$/gm, '<hr>')
    // Blockquotes
    .replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered lists
    .replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>')
    // Tables (basic)
    .replace(/^\|(.+)\|$/gm, (match, content) => {
      const cells = content.split('|').map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) return '';
      const tag = 'td';
      return '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
    })
    // Paragraphs
    .replace(/\n{2,}/g, '</p><p>')
    // Line breaks
    .replace(/\n/g, '<br>');

  // Wrap loose li in ul
  html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');
  // Wrap tr in table
  html = html.replace(/((?:<tr>.*?<\/tr>\s*)+)/g, '<table>$1</table>');

  return '<p>' + html + '</p>';
}

/* ─── Diff Engine (Myers-like line diff) ────────────────────────── */
function computeDiff(textA, textB) {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');

  // LCS-based diff
  const m = linesA.length, n = linesB.length;
  // Build LCS table
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      result.unshift({ type: 'equal', lineA: i, lineB: j, text: linesA[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', lineB: j, text: linesB[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', lineA: i, text: linesA[i - 1] });
      i--;
    }
  }

  return result;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderDiff() {
  const diff = computeDiff(
    state.left.content || '',
    state.right.content || ''
  );

  let leftHtml = '';
  let rightHtml = '';
  let additions = 0, deletions = 0;

  for (const entry of diff) {
    if (entry.type === 'equal') {
      const line = `<div class="diff-line">
        <span class="diff-line-number">${entry.lineA}</span>
        <span class="diff-line-content">${escapeHtml(entry.text)}</span>
      </div>`;
      leftHtml += line;
      rightHtml += `<div class="diff-line">
        <span class="diff-line-number">${entry.lineB}</span>
        <span class="diff-line-content">${escapeHtml(entry.text)}</span>
      </div>`;
    } else if (entry.type === 'removed') {
      deletions++;
      leftHtml += `<div class="diff-line removed">
        <span class="diff-line-number">${entry.lineA}</span>
        <span class="diff-line-content">- ${escapeHtml(entry.text)}</span>
      </div>`;
      rightHtml += `<div class="diff-line empty">
        <span class="diff-line-number"></span>
        <span class="diff-line-content"></span>
      </div>`;
    } else if (entry.type === 'added') {
      additions++;
      leftHtml += `<div class="diff-line empty">
        <span class="diff-line-number"></span>
        <span class="diff-line-content"></span>
      </div>`;
      rightHtml += `<div class="diff-line added">
        <span class="diff-line-number">${entry.lineB}</span>
        <span class="diff-line-content">+ ${escapeHtml(entry.text)}</span>
      </div>`;
    }
  }

  els.diffLeft.innerHTML = leftHtml;
  els.diffRight.innerHTML = rightHtml;
  els.diffStats.innerHTML = `
    <span class="additions">+${additions}</span>
    <span class="deletions">-${deletions}</span>
  `;
}

/* ─── Diff Preview (gerenderte Vorschau mit Markierungen) ───────── */
function renderDiffPreview() {
  const diff = computeDiff(
    state.left.content || '',
    state.right.content || ''
  );

  // Gruppiere Zeilen nach Typ für linke und rechte Seite
  let leftMd = '', rightMd = '';

  for (const entry of diff) {
    if (entry.type === 'equal') {
      leftMd += entry.text + '\n';
      rightMd += entry.text + '\n';
    } else if (entry.type === 'removed') {
      // Markierung für entfernte Zeilen (links)
      leftMd += '%%DIFF_REMOVED_START%%' + entry.text + '%%DIFF_REMOVED_END%%\n';
    } else if (entry.type === 'added') {
      // Markierung für hinzugefügte Zeilen (rechts)
      rightMd += '%%DIFF_ADDED_START%%' + entry.text + '%%DIFF_ADDED_END%%\n';
    }
  }

  // Render Markdown und ersetze Marker durch HTML-Klassen
  let leftHtml = renderMarkdown(leftMd);
  let rightHtml = renderMarkdown(rightMd);

  // Marker in gestylte Spans umwandeln
  leftHtml = leftHtml
    .replace(/%%DIFF_REMOVED_START%%/g, '<span class="diff-mark-removed">')
    .replace(/%%DIFF_REMOVED_END%%/g, '</span>');
  rightHtml = rightHtml
    .replace(/%%DIFF_ADDED_START%%/g, '<span class="diff-mark-added">')
    .replace(/%%DIFF_ADDED_END%%/g, '</span>');

  els.diffPreviewLeft.innerHTML = leftHtml;
  els.diffPreviewRight.innerHTML = rightHtml;
}

/* ─── Diff Mode Toggle (Quelltext / Vorschau) ───────────────────── */
document.querySelectorAll('.diff-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.diffMode = btn.dataset.diffMode;
    document.querySelectorAll('.diff-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (state.diffMode === 'preview') {
      els.diffContentSource.style.display = 'none';
      els.diffContentPreview.style.display = '';
      renderDiffPreview();
    } else {
      els.diffContentSource.style.display = '';
      els.diffContentPreview.style.display = 'none';
    }
  });
});

/* ─── Sync Scroll ───────────────────────────────────────────────── */
let scrollLock = false;

function setupSyncScroll(sourceEl, targetEl) {
  sourceEl.addEventListener('scroll', () => {
    if (scrollLock) return;
    scrollLock = true;
    const ratio = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight || 1);
    targetEl.scrollTop = ratio * (targetEl.scrollHeight - targetEl.clientHeight);
    requestAnimationFrame(() => { scrollLock = false; });
  });
}

// Sync editors
setupSyncScroll(els.editorLeft, els.editorRight);
setupSyncScroll(els.editorRight, els.editorLeft);

// Sync previews
setupSyncScroll(els.previewLeft, els.previewRight);
setupSyncScroll(els.previewRight, els.previewLeft);

// Sync diff sides
setupSyncScroll(els.diffLeft, els.diffRight);
setupSyncScroll(els.diffRight, els.diffLeft);

// Sync diff preview sides
setupSyncScroll(els.diffPreviewLeft, els.diffPreviewRight);
setupSyncScroll(els.diffPreviewRight, els.diffPreviewLeft);

/* ─── Mode Toggle (Edit / Preview) ──────────────────────────────── */
function setMode(side, mode) {
  state[side].mode = mode;
  const editor = els[`editor${cap(side)}`];
  const preview = els[`preview${cap(side)}`];

  if (mode === 'preview') {
    editor.classList.add('hidden');
    preview.classList.add('visible');
    preview.innerHTML = renderMarkdown(state[side].content);
  } else {
    editor.classList.remove('hidden');
    preview.classList.remove('visible');
  }

  // Update button states
  document.querySelectorAll(`.mode-btn[data-side="${side}"]`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setMode(btn.dataset.side, btn.dataset.mode);
  });
});

/* ─── View Toggle (Split / Diff) ────────────────────────────────── */
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.view = btn.dataset.view;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (state.view === 'diff') {
      els.mainContainer.classList.add('diff-mode');
      renderDiff();
      if (state.diffMode === 'preview') {
        renderDiffPreview();
      }
    } else {
      els.mainContainer.classList.remove('diff-mode');
    }
  });
});

/* ─── Editor Input Handling ─────────────────────────────────────── */
function handleInput(side) {
  const editor = els[`editor${cap(side)}`];
  return () => {
    state[side].content = editor.value;
    state[side].dirty = true;
    updateFileName(side);

    if (state[side].mode === 'preview') {
      els[`preview${cap(side)}`].innerHTML = renderMarkdown(state[side].content);
    }

    if (state.view === 'diff') {
      renderDiff();
      if (state.diffMode === 'preview') {
        renderDiffPreview();
      }
    }
  };
}

els.editorLeft.addEventListener('input', handleInput('left'));
els.editorRight.addEventListener('input', handleInput('right'));

// Tab key support
[els.editorLeft, els.editorRight].forEach(editor => {
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
      editor.dispatchEvent(new Event('input'));
    }
  });
});

/* ─── File Name Display ─────────────────────────────────────────── */
function updateFileName(side) {
  const el = els[`fileName${cap(side)}`];
  const s = state[side];
  if (s.filePath) {
    const name = s.filePath.split('/').pop();
    el.innerHTML = name + (s.dirty ? ' <span class="unsaved">(geändert)</span>' : '');
    el.classList.add('has-file');
  } else {
    el.textContent = 'Keine Datei geladen';
    el.classList.remove('has-file');
  }
}

/* ─── IPC: File Opened ──────────────────────────────────────────── */
window.api.onFileOpened(({ side, filePath, content }) => {
  state[side].filePath = filePath;
  state[side].content = content;
  state[side].dirty = false;

  const editor = els[`editor${cap(side)}`];
  editor.value = content;
  updateFileName(side);

  if (state[side].mode === 'preview') {
    els[`preview${cap(side)}`].innerHTML = renderMarkdown(content);
  }

  if (state.view === 'diff') {
    renderDiff();
  }
});

/* ─── IPC: Save File ────────────────────────────────────────────── */
window.api.onSaveFile(async (side) => {
  const s = state[side];
  const result = await window.api.saveFile({
    filePath: s.filePath,
    content: s.content
  });
  if (result.success) {
    s.filePath = result.filePath;
    s.dirty = false;
    updateFileName(side);
  }
});

/* ─── Drag & Drop ───────────────────────────────────────────────── */
['left', 'right'].forEach(side => {
  const el = els[`content${cap(side)}`];

  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.add('drag-over');
  });

  el.addEventListener('dragleave', () => {
    el.classList.remove('drag-over');
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file && /\.(md|markdown|mdown|mkd)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => {
        state[side].content = reader.result;
        state[side].filePath = file.path || file.name;
        state[side].dirty = false;
        els[`editor${cap(side)}`].value = reader.result;
        updateFileName(side);
        if (state[side].mode === 'preview') {
          els[`preview${cap(side)}`].innerHTML = renderMarkdown(reader.result);
        }
        if (state.view === 'diff') renderDiff();
      };
      reader.readAsText(file);
    }
  });
});

/* ─── Init ──────────────────────────────────────────────────────── */
setMode('left', 'edit');
setMode('right', 'edit');
