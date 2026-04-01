/* ─── State ─────────────────────────────────────────────────────── */
const state = {
  left:  { filePath: null, content: '', mode: 'edit', dirty: false },
  right: { filePath: null, content: '', mode: 'edit', dirty: false },
  view: 'split',
  diffMode: 'source',
  theme: 'dark',
  syncScroll: true
};

/* ─── DOM refs ──────────────────────────────────────────────────── */
const els = {
  editorLeft:    document.getElementById('editorLeft'),
  editorRight:   document.getElementById('editorRight'),
  previewLeft:   document.getElementById('previewLeft'),
  previewRight:  document.getElementById('previewRight'),
  fileNameLeft:  document.getElementById('fileNameLeft'),
  fileNameRight: document.getElementById('fileNameRight'),
  contentLeft:   document.getElementById('contentLeft'),
  contentRight:  document.getElementById('contentRight'),
  diffLeft:      document.getElementById('diffLeft'),
  diffRight:     document.getElementById('diffRight'),
  diffStats:     document.getElementById('diffStats'),
  diffContentSource:   document.getElementById('diffContentSource'),
  diffContentPreview:  document.getElementById('diffContentPreview'),
  diffPreviewLeft:     document.getElementById('diffPreviewLeft'),
  diffPreviewRight:    document.getElementById('diffPreviewRight'),
  diffEditorLeft:      document.getElementById('diffEditorLeft'),
  diffEditorRight:     document.getElementById('diffEditorRight'),
  diffLeftOverlay:     document.getElementById('diffLeftOverlay'),
  diffRightOverlay:    document.getElementById('diffRightOverlay'),
  diffPreviewEditorLeft:   document.getElementById('diffPreviewEditorLeft'),
  diffPreviewEditorRight:  document.getElementById('diffPreviewEditorRight'),
  diffPreviewLeftOverlay:  document.getElementById('diffPreviewLeftOverlay'),
  diffPreviewRightOverlay: document.getElementById('diffPreviewRightOverlay'),
  diffFileNameLeft:        document.getElementById('diffFileNameLeft'),
  diffFileNameRight:       document.getElementById('diffFileNameRight'),
  diffPreviewFileNameLeft: document.getElementById('diffPreviewFileNameLeft'),
  diffPreviewFileNameRight:document.getElementById('diffPreviewFileNameRight'),
  mainContainer: document.getElementById('mainContainer'),
  diffPanel:     document.getElementById('diffPanel'),
  themeToggle:   document.getElementById('themeToggle'),
};

/* ─── Theme Toggle ──────────────────────────────────────────────── */
els.themeToggle.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  els.themeToggle.textContent = state.theme === 'dark' ? '\u263E' : '\u2600';
});

/* ─── Markdown Renderer (improved tables) ───────────────────────── */
function renderMarkdown(md) {
  // Protect code blocks first
  const codeBlocks = [];
  md = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(`<pre><code class="lang-${lang}">${escapeHtml(code)}</code></pre>`);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

  // Tables: parse contiguous lines starting with |
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    // Detect table block
    if (/^\|.+\|$/.test(lines[i].trim())) {
      let tableLines = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        tableLines.push(lines[i].trim());
        i++;
      }
      out.push(buildTable(tableLines));
      continue;
    }
    out.push(lines[i]);
    i++;
  }

  let html = out.join('\n');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links & Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr>');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered lists
  html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>');

  // Paragraphs & breaks
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Wrap loose li in ul
  html = html.replace(/((?:<li>.*?<\/li>(?:<br>)?)+)/g, '<ul>$1</ul>');

  // Restore code blocks
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`%%CODEBLOCK_${idx}%%`, block);
  });

  return '<p>' + html + '</p>';
}

function buildTable(lines) {
  if (lines.length < 2) return lines.join('\n');

  const parseCells = line => line.slice(1, -1).split('|').map(c => c.trim());

  // Find separator line (contains only -, :, |, spaces)
  let sepIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCells(lines[i]);
    if (cells.every(c => /^[-:]+$/.test(c))) {
      sepIdx = i;
      break;
    }
  }

  let html = '<table>';

  if (sepIdx > 0) {
    // Header rows (before separator)
    for (let i = 0; i < sepIdx; i++) {
      const cells = parseCells(lines[i]);
      html += '<tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr>';
    }
    // Body rows (after separator)
    for (let i = sepIdx + 1; i < lines.length; i++) {
      const cells = parseCells(lines[i]);
      html += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    }
  } else {
    // No separator found, all body
    for (const line of lines) {
      const cells = parseCells(line);
      html += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    }
  }

  html += '</table>';
  return html;
}

/* ─── Diff Engine (LCS) ────────────────────────────────────────── */
function computeDiff(textA, textB) {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  const m = linesA.length, n = linesB.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = linesA[i - 1] === linesB[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

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
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderDiff() {
  const diff = computeDiff(state.left.content || '', state.right.content || '');

  let leftHtml = '', rightHtml = '';
  let additions = 0, deletions = 0;

  for (const entry of diff) {
    if (entry.type === 'equal') {
      leftHtml += `<div class="diff-line"><span class="diff-line-number">${entry.lineA}</span><span class="diff-line-content">${escapeHtml(entry.text)}</span></div>`;
      rightHtml += `<div class="diff-line"><span class="diff-line-number">${entry.lineB}</span><span class="diff-line-content">${escapeHtml(entry.text)}</span></div>`;
    } else if (entry.type === 'removed') {
      deletions++;
      leftHtml += `<div class="diff-line removed"><span class="diff-line-number">${entry.lineA}</span><span class="diff-line-content">- ${escapeHtml(entry.text)}</span></div>`;
      rightHtml += `<div class="diff-line empty"><span class="diff-line-number"></span><span class="diff-line-content"></span></div>`;
    } else {
      additions++;
      leftHtml += `<div class="diff-line empty"><span class="diff-line-number"></span><span class="diff-line-content"></span></div>`;
      rightHtml += `<div class="diff-line added"><span class="diff-line-number">${entry.lineB}</span><span class="diff-line-content">+ ${escapeHtml(entry.text)}</span></div>`;
    }
  }

  els.diffLeft.innerHTML = leftHtml;
  els.diffRight.innerHTML = rightHtml;
  els.diffStats.innerHTML = `<span class="additions">+${additions}</span><span class="deletions">-${deletions}</span>`;

  // Update diff file names
  updateDiffFileNames();
}

function renderDiffPreview() {
  const diff = computeDiff(state.left.content || '', state.right.content || '');
  let leftMd = '', rightMd = '';

  for (const entry of diff) {
    if (entry.type === 'equal') {
      leftMd += entry.text + '\n';
      rightMd += entry.text + '\n';
    } else if (entry.type === 'removed') {
      leftMd += '%%DIFF_REMOVED_START%%' + entry.text + '%%DIFF_REMOVED_END%%\n';
    } else {
      rightMd += '%%DIFF_ADDED_START%%' + entry.text + '%%DIFF_ADDED_END%%\n';
    }
  }

  let leftHtml = renderMarkdown(leftMd);
  let rightHtml = renderMarkdown(rightMd);

  leftHtml = leftHtml
    .replace(/%%DIFF_REMOVED_START%%/g, '<span class="diff-mark-removed">')
    .replace(/%%DIFF_REMOVED_END%%/g, '</span>');
  rightHtml = rightHtml
    .replace(/%%DIFF_ADDED_START%%/g, '<span class="diff-mark-added">')
    .replace(/%%DIFF_ADDED_END%%/g, '</span>');

  els.diffPreviewLeft.innerHTML = leftHtml;
  els.diffPreviewRight.innerHTML = rightHtml;
  updateDiffFileNames();
}

function updateDiffFileNames() {
  ['left', 'right'].forEach(side => {
    const name = state[side].filePath ? state[side].filePath.split('/').pop() : (side === 'left' ? 'Links' : 'Rechts');
    const cls = state[side].filePath ? 'file-name has-file' : 'file-name';
    els[`diffFileName${cap(side)}`].textContent = name;
    els[`diffFileName${cap(side)}`].className = cls;
    els[`diffPreviewFileName${cap(side)}`].textContent = name;
    els[`diffPreviewFileName${cap(side)}`].className = cls;
  });
}

/* ─── Diff Edit Toggle ──────────────────────────────────────────── */
// Source diff: switch between diff view and editable textarea
document.querySelectorAll('.diff-edit-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const side = btn.dataset.side;
    const mode = btn.dataset.mode;
    const overlay = els[`diff${cap(side)}Overlay`];
    const editor = els[`diffEditor${cap(side)}`];

    // Update button states
    document.querySelectorAll(`.diff-edit-btn[data-side="${side}"]`).forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });

    if (mode === 'edit') {
      overlay.style.display = 'none';
      editor.style.display = 'block';
      editor.value = state[side].content;
      editor.focus();
    } else {
      overlay.style.display = '';
      editor.style.display = 'none';
      renderDiff();
    }
  });
});

// Preview diff: switch between preview view and editable textarea
document.querySelectorAll('.diff-preview-edit-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const side = btn.dataset.side;
    const mode = btn.dataset.mode;
    const overlay = els[`diffPreview${cap(side)}Overlay`];
    const editor = els[`diffPreviewEditor${cap(side)}`];

    document.querySelectorAll(`.diff-preview-edit-btn[data-side="${side}"]`).forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });

    if (mode === 'edit') {
      overlay.style.display = 'none';
      editor.style.display = 'block';
      editor.value = state[side].content;
      editor.focus();
    } else {
      overlay.style.display = '';
      editor.style.display = 'none';
      renderDiffPreview();
    }
  });
});

// Handle input from diff editors
function setupDiffEditor(editorEl, side) {
  editorEl.addEventListener('input', () => {
    state[side].content = editorEl.value;
    state[side].dirty = true;
    // Sync back to split-view editor
    els[`editor${cap(side)}`].value = editorEl.value;
    updateFileName(side);
  });

  editorEl.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editorEl.selectionStart;
      const end = editorEl.selectionEnd;
      editorEl.value = editorEl.value.substring(0, start) + '  ' + editorEl.value.substring(end);
      editorEl.selectionStart = editorEl.selectionEnd = start + 2;
      editorEl.dispatchEvent(new Event('input'));
    }
  });
}

setupDiffEditor(els.diffEditorLeft, 'left');
setupDiffEditor(els.diffEditorRight, 'right');
setupDiffEditor(els.diffPreviewEditorLeft, 'left');
setupDiffEditor(els.diffPreviewEditorRight, 'right');

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
      renderDiff();
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

setupSyncScroll(els.editorLeft, els.editorRight);
setupSyncScroll(els.editorRight, els.editorLeft);
setupSyncScroll(els.previewLeft, els.previewRight);
setupSyncScroll(els.previewRight, els.previewLeft);
setupSyncScroll(els.diffLeftOverlay, els.diffRightOverlay);
setupSyncScroll(els.diffRightOverlay, els.diffLeftOverlay);
setupSyncScroll(els.diffPreviewLeftOverlay, els.diffPreviewRightOverlay);
setupSyncScroll(els.diffPreviewRightOverlay, els.diffPreviewLeftOverlay);

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

  document.querySelectorAll(`.mode-btn[data-side="${side}"]`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => setMode(btn.dataset.side, btn.dataset.mode));
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
      if (state.diffMode === 'preview') renderDiffPreview();
    } else {
      els.mainContainer.classList.remove('diff-mode');
      // Sync content back to split editors
      els.editorLeft.value = state.left.content;
      els.editorRight.value = state.right.content;
      if (state.left.mode === 'preview') {
        els.previewLeft.innerHTML = renderMarkdown(state.left.content);
      }
      if (state.right.mode === 'preview') {
        els.previewRight.innerHTML = renderMarkdown(state.right.content);
      }
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
      if (state.diffMode === 'preview') renderDiffPreview();
    }
  };
}

els.editorLeft.addEventListener('input', handleInput('left'));
els.editorRight.addEventListener('input', handleInput('right'));

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

  els[`editor${cap(side)}`].value = content;
  updateFileName(side);

  if (state[side].mode === 'preview') {
    els[`preview${cap(side)}`].innerHTML = renderMarkdown(content);
  }

  if (state.view === 'diff') {
    renderDiff();
    if (state.diffMode === 'preview') renderDiffPreview();
  }
});

/* ─── IPC: Save File ────────────────────────────────────────────── */
window.api.onSaveFile(async (side) => {
  const s = state[side];
  const result = await window.api.saveFile({ filePath: s.filePath, content: s.content });
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

  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));

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
