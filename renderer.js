/* ─── State ─────────────────────────────────────────────────────── */
const state = {
  left:  { filePath: null, content: '', mode: 'edit', dirty: false },
  right: { filePath: null, content: '', mode: 'edit', dirty: false },
  view: 'split',
  diffMode: 'source',
  theme: 'dark',
  lastDiffKey: null,
  lastDiffResult: null
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

/* ─── Helpers ───────────────────────────────────────────────────── */
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function el(prefix, side) { return els[`${prefix}${cap(side)}`]; }
function basename(path) { return path ? path.split('/').pop() : null; }

function insertTab(textarea) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + 2;
  textarea.dispatchEvent(new Event('input'));
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let diffDebounceTimer = null;
function refreshDiffDebounced() {
  clearTimeout(diffDebounceTimer);
  diffDebounceTimer = setTimeout(refreshDiff, 150);
}

function refreshDiff() {
  if (state.view !== 'diff') return;
  const diff = getCachedDiff();
  renderDiff(diff);
  if (state.diffMode === 'preview') renderDiffPreview(diff);
}

function refreshViews(side) {
  if (state[side].mode === 'preview') {
    el('preview', side).innerHTML = renderMarkdown(state[side].content);
  }
  if (state.view === 'diff') refreshDiffDebounced();
}

/* ─── Theme Toggle ──────────────────────────────────────────────── */
els.themeToggle.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  els.themeToggle.textContent = state.theme === 'dark' ? '\u263E' : '\u2600';
});

/* ─── Markdown Renderer ────────────────────────────────────────── */
function renderMarkdown(md) {
  const codeBlocks = [];
  md = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(`<pre><code class="lang-${lang}">${escapeHtml(code)}</code></pre>`);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    if (/^\|.+\|$/.test(lines[i].trim())) {
      const tableLines = [];
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

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^---+$/gm, '<hr>');
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/((?:<li>.*?<\/li>(?:<br>)?)+)/g, '<ul>$1</ul>');

  codeBlocks.forEach((block, idx) => {
    html = html.replace(`%%CODEBLOCK_${idx}%%`, block);
  });

  return '<p>' + html + '</p>';
}

function buildTable(lines) {
  if (lines.length < 2) return lines.join('\n');
  const parseCells = line => line.slice(1, -1).split('|').map(c => c.trim());

  let sepIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (parseCells(lines[i]).every(c => /^[-:]+$/.test(c))) {
      sepIdx = i;
      break;
    }
  }

  let html = '<table>';
  if (sepIdx > 0) {
    for (let i = 0; i < sepIdx; i++) {
      html += '<tr>' + parseCells(lines[i]).map(c => `<th>${c}</th>`).join('') + '</tr>';
    }
    for (let i = sepIdx + 1; i < lines.length; i++) {
      html += '<tr>' + parseCells(lines[i]).map(c => `<td>${c}</td>`).join('') + '</tr>';
    }
  } else {
    for (const line of lines) {
      html += '<tr>' + parseCells(line).map(c => `<td>${c}</td>`).join('') + '</tr>';
    }
  }
  return html + '</table>';
}

/* ─── Diff Engine (LCS, cached) ─────────────────────────────────── */
function computeDiff(textA, textB) {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  const m = linesA.length, n = linesB.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));

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

function getCachedDiff() {
  const key = state.left.content + '\0' + state.right.content;
  if (state.lastDiffKey === key) return state.lastDiffResult;
  state.lastDiffKey = key;
  state.lastDiffResult = computeDiff(state.left.content || '', state.right.content || '');
  return state.lastDiffResult;
}

function renderDiff(diff) {
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
  updateDiffFileNames();
}

function renderDiffPreview(diff) {
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
    const name = basename(state[side].filePath) || (side === 'left' ? 'Links' : 'Rechts');
    const cls = state[side].filePath ? 'file-name has-file' : 'file-name';
    [el('diffFileName', side), el('diffPreviewFileName', side)].forEach(e => {
      e.textContent = name;
      e.className = cls;
    });
  });
}

/* ─── Diff Edit/View Toggle (global) ────────────────────────────── */
function setDiffEditMode(editMode) {
  ['left', 'right'].forEach(side => {
    // Source diff
    const srcOverlay = els[`diff${cap(side)}Overlay`];
    const srcEditor = els[`diffEditor${cap(side)}`];
    // Preview diff
    const prvOverlay = els[`diffPreview${cap(side)}Overlay`];
    const prvEditor = els[`diffPreviewEditor${cap(side)}`];

    if (editMode) {
      srcOverlay.style.display = 'none';
      srcEditor.style.display = 'block';
      srcEditor.value = state[side].content;
      prvOverlay.style.display = 'none';
      prvEditor.style.display = 'block';
      prvEditor.value = state[side].content;
    } else {
      srcOverlay.style.display = '';
      srcEditor.style.display = 'none';
      prvOverlay.style.display = '';
      prvEditor.style.display = 'none';
    }
  });

  if (!editMode) {
    const diff = getCachedDiff();
    renderDiff(diff);
    if (state.diffMode === 'preview') renderDiffPreview(diff);
  }
}

/* ─── Diff Editor Input ─────────────────────────────────────────── */
function setupDiffEditor(editorEl, side) {
  editorEl.addEventListener('input', () => {
    state[side].content = editorEl.value;
    state[side].dirty = true;
    state.lastDiffKey = null;
    el('editor', side).value = editorEl.value;
    updateFileName(side);
  });
  editorEl.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); insertTab(editorEl); }
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

    const diff = getCachedDiff();
    if (state.diffMode === 'preview') {
      els.diffContentSource.style.display = 'none';
      els.diffContentPreview.style.display = '';
      renderDiffPreview(diff);
    } else {
      els.diffContentSource.style.display = '';
      els.diffContentPreview.style.display = 'none';
      renderDiff(diff);
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
  const editor = el('editor', side);
  const preview = el('preview', side);

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

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    setMode('left', mode);
    setMode('right', mode);
    setDiffEditMode(mode === 'edit');
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
      refreshDiff();
    } else {
      els.mainContainer.classList.remove('diff-mode');
      ['left', 'right'].forEach(side => {
        el('editor', side).value = state[side].content;
        if (state[side].mode === 'preview') {
          el('preview', side).innerHTML = renderMarkdown(state[side].content);
        }
      });
    }
  });
});

/* ─── Editor Input Handling ─────────────────────────────────────── */
function handleInput(side) {
  const editor = el('editor', side);
  return () => {
    state[side].content = editor.value;
    state[side].dirty = true;
    state.lastDiffKey = null;
    updateFileName(side);
    refreshViews(side);
  };
}

els.editorLeft.addEventListener('input', handleInput('left'));
els.editorRight.addEventListener('input', handleInput('right'));

[els.editorLeft, els.editorRight].forEach(editor => {
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); insertTab(editor); }
  });
});

/* ─── File Name Display ─────────────────────────────────────────── */
function updateFileName(side) {
  const nameEl = el('fileName', side);
  const s = state[side];
  if (s.filePath) {
    const name = basename(s.filePath);
    nameEl.innerHTML = name + (s.dirty ? ' <span class="unsaved">(geändert)</span>' : '');
    nameEl.classList.add('has-file');
  } else {
    nameEl.textContent = 'Keine Datei geladen';
    nameEl.classList.remove('has-file');
  }
}

/* ─── Content Loading (shared) ──────────────────────────────────── */
function loadContent(side, content, filePath, dirty) {
  state[side].content = content;
  state[side].filePath = filePath;
  state[side].dirty = dirty;
  state.lastDiffKey = null;
  el('editor', side).value = content;
  updateFileName(side);
  refreshViews(side);
}

/* ─── IPC ───────────────────────────────────────────────────────── */
window.api.onFileOpened(({ side, filePath, content }) => {
  loadContent(side, content, filePath, false);
  addToHistory();
});

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
  const contentEl = el('content', side);

  contentEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    contentEl.classList.add('drag-over');
  });

  contentEl.addEventListener('dragleave', () => contentEl.classList.remove('drag-over'));

  contentEl.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    contentEl.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file && /\.(md|markdown|mdown|mkd)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => loadContent(side, reader.result, file.path || file.name, false);
      reader.readAsText(file);
    }
  });
});

/* ─── History (letzte 5 Vergleiche) ─────────────────────────────── */
let compareHistory = [];
const historyBtn = document.getElementById('historyBtn');
const historyDropdown = document.getElementById('historyDropdown');

async function initHistory() {
  compareHistory = await window.api.loadHistory() || [];
}

async function addToHistory() {
  if (!state.left.filePath && !state.right.filePath) return;

  const entry = {
    left: state.left.filePath,
    right: state.right.filePath,
    time: Date.now()
  };

  compareHistory = compareHistory.filter(h =>
    !(h.left === entry.left && h.right === entry.right)
  );
  compareHistory.unshift(entry);
  compareHistory = compareHistory.slice(0, 5);
  await window.api.saveHistory(compareHistory);
}

function renderHistory() {
  if (compareHistory.length === 0) {
    historyDropdown.innerHTML = '<div class="history-empty">Noch keine Vergleiche</div>';
    return;
  }

  historyDropdown.innerHTML = compareHistory.map((h, i) => {
    const left = h.left ? basename(h.left) : '—';
    const right = h.right ? basename(h.right) : '—';
    const ago = formatTimeAgo(h.time);
    return `<div class="history-item" data-index="${i}">
      <div class="history-files">
        <div class="history-file left">${escapeHtml(left)}</div>
        <div class="history-file right">${escapeHtml(right)}</div>
      </div>
      <span class="history-time">${ago}</span>
    </div>`;
  }).join('');
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
}

historyBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  renderHistory();
  historyDropdown.classList.toggle('open');
});

document.addEventListener('click', () => {
  historyDropdown.classList.remove('open');
});

historyDropdown.addEventListener('click', async (e) => {
  const item = e.target.closest('.history-item');
  if (!item) return;

  const idx = parseInt(item.dataset.index);
  const entry = compareHistory[idx];
  if (!entry) return;

  historyDropdown.classList.remove('open');

  for (const side of ['left', 'right']) {
    if (entry[side]) {
      const result = await window.api.readFile(entry[side]);
      if (result.success) {
        loadContent(side, result.content, entry[side], false);
      }
    }
  }
});

/* ─── Init ──────────────────────────────────────────────────────── */
setMode('left', 'edit');
setMode('right', 'edit');
initHistory();
