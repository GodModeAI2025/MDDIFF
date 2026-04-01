const state = {
  left:  { filePath: null, content: '', dirty: false },
  right: { filePath: null, content: '', dirty: false },
  preview: false,
  theme: 'dark',
  lastDiffKey: null,
  lastDiffKeyLen: 0,
  lastDiffResult: null
};

const els = {
  editorLeft:       document.getElementById('editorLeft'),
  editorRight:      document.getElementById('editorRight'),
  highlightLeft:    document.getElementById('highlightLeft'),
  highlightRight:   document.getElementById('highlightRight'),
  gutterLeft:       document.getElementById('gutterLeft'),
  gutterRight:      document.getElementById('gutterRight'),
  editorWrapperLeft:  document.getElementById('editorWrapperLeft'),
  editorWrapperRight: document.getElementById('editorWrapperRight'),
  previewWrapperLeft: document.getElementById('previewWrapperLeft'),
  previewWrapperRight:document.getElementById('previewWrapperRight'),
  previewLeft:      document.getElementById('previewLeft'),
  previewRight:     document.getElementById('previewRight'),
  fileNameLeft:     document.getElementById('fileNameLeft'),
  fileNameRight:    document.getElementById('fileNameRight'),
  saveLeft:         document.getElementById('saveLeft'),
  saveRight:        document.getElementById('saveRight'),
  diffStats:        document.getElementById('diffStats'),
  previewToggle:    document.getElementById('previewToggle'),
  themeToggle:      document.getElementById('themeToggle'),
  historyBtn:       document.getElementById('historyBtn'),
  historyDropdown:  document.getElementById('historyDropdown'),
};

/* ─── Helpers ───────────────────────────────────────────────── */
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function el(prefix, side) { return els[`${prefix}${cap(side)}`]; }
function basename(p) { return p ? p.split('/').pop() : null; }

function escapeHtml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function insertTab(ta) {
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.substring(0, s) + '  ' + ta.value.substring(e);
  ta.selectionStart = ta.selectionEnd = s + 2;
  ta.dispatchEvent(new Event('input'));
}

/* ─── Theme ─────────────────────────────────────────────────── */
els.themeToggle.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  els.themeToggle.textContent = state.theme === 'dark' ? '\u263E' : '\u2600';
});

/* ─── Markdown Renderer ─────────────────────────────────────── */
function renderMarkdown(md) {
  const codeBlocks = [];
  md = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(`<pre><code class="lang-${lang}">${escapeHtml(code)}</code></pre>`);
    return `%%CB_${codeBlocks.length - 1}%%`;
  });

  const lines = md.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (/^\|.+\|$/.test(lines[i].trim())) {
      const tbl = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) { tbl.push(lines[i].trim()); i++; }
      out.push(buildTable(tbl));
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
  codeBlocks.forEach((b, idx) => { html = html.replace(`%%CB_${idx}%%`, b); });
  return '<p>' + html + '</p>';
}

function buildTable(lines) {
  if (lines.length < 2) return lines.join('\n');
  const parse = l => l.slice(1, -1).split('|').map(c => c.trim());
  let sep = -1;
  for (let i = 1; i < lines.length; i++) {
    if (parse(lines[i]).every(c => /^[-:]+$/.test(c))) { sep = i; break; }
  }
  let h = '<table>';
  if (sep > 0) {
    for (let i = 0; i < sep; i++) h += '<tr>' + parse(lines[i]).map(c => `<th>${c}</th>`).join('') + '</tr>';
    for (let i = sep + 1; i < lines.length; i++) h += '<tr>' + parse(lines[i]).map(c => `<td>${c}</td>`).join('') + '</tr>';
  } else {
    for (const l of lines) h += '<tr>' + parse(l).map(c => `<td>${c}</td>`).join('') + '</tr>';
  }
  return h + '</table>';
}

/* ─── Diff Engine ────────────────────────────────────────────── */
function computeDiff(a, b) {
  const la = a.split('\n'), lb = b.split('\n');
  const m = la.length, n = lb.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = la[i-1] === lb[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);

  const res = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && la[i-1] === lb[j-1]) {
      res.unshift({ type: 'eq', la: i, lb: j, text: la[i-1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      res.unshift({ type: 'add', lb: j, text: lb[j-1] }); j--;
    } else {
      res.unshift({ type: 'del', la: i, text: la[i-1] }); i--;
    }
  }
  return res;
}

function getCachedDiff() {
  const kl = (state.left.content || '').length + (state.right.content || '').length;
  if (state.lastDiffKeyLen === kl) {
    const k = state.left.content + '\0' + state.right.content;
    if (state.lastDiffKey === k) return state.lastDiffResult;
  }
  const k = state.left.content + '\0' + state.right.content;
  state.lastDiffKey = k;
  state.lastDiffKeyLen = kl;
  state.lastDiffResult = computeDiff(state.left.content || '', state.right.content || '');
  return state.lastDiffResult;
}

/* ─── Gutter (line numbers + diff colors) ────────────────────── */
function updateGutters() {
  const diff = getCachedDiff();

  const leftLines = (state.left.content || '').split('\n');
  const rightLines = (state.right.content || '').split('\n');
  const leftStatus = new Array(leftLines.length).fill('');
  const rightStatus = new Array(rightLines.length).fill('');

  let adds = 0, dels = 0;
  for (const e of diff) {
    if (e.type === 'del') { leftStatus[e.la - 1] = 'del'; dels++; }
    if (e.type === 'add') { rightStatus[e.lb - 1] = 'add'; adds++; }
  }

  // Gutter line numbers
  els.gutterLeft.innerHTML = leftLines.map((_, i) =>
    `<span class="line-num ${leftStatus[i] ? 'diff-' + leftStatus[i] : ''}">${i + 1}</span>`
  ).join('');

  els.gutterRight.innerHTML = rightLines.map((_, i) =>
    `<span class="line-num ${rightStatus[i] ? 'diff-' + rightStatus[i] : ''}">${i + 1}</span>`
  ).join('');

  // Highlight overlay behind textarea
  els.highlightLeft.innerHTML = leftLines.map((_, i) =>
    `<span class="hl-line ${leftStatus[i] ? 'hl-' + leftStatus[i] : ''}">\n</span>`
  ).join('');

  els.highlightRight.innerHTML = rightLines.map((_, i) =>
    `<span class="hl-line ${rightStatus[i] ? 'hl-' + rightStatus[i] : ''}">\n</span>`
  ).join('');

  // Sync highlight scroll position with textarea
  els.highlightLeft.style.top = -els.editorLeft.scrollTop + 'px';
  els.highlightRight.style.top = -els.editorRight.scrollTop + 'px';

  els.diffStats.innerHTML = adds || dels
    ? `<span class="add">+${adds}</span><span class="del">-${dels}</span>`
    : '';
}

let gutterTimer = null;
function updateGuttersDebounced() {
  clearTimeout(gutterTimer);
  gutterTimer = setTimeout(updateGutters, 120);
}

/* ─── Sync Scroll ────────────────────────────────────────────── */
let scrolling = false;

function syncScroll(src, targets) {
  src.addEventListener('scroll', () => {
    if (scrolling) return;
    scrolling = true;
    const ratio = src.scrollTop / (src.scrollHeight - src.clientHeight || 1);
    for (const t of targets) {
      t.scrollTop = ratio * (t.scrollHeight - t.clientHeight);
    }
    requestAnimationFrame(() => { scrolling = false; });
  });
}

// Editor scroll syncs: other editor + both gutters
syncScroll(els.editorLeft, [els.editorRight, els.gutterLeft, els.gutterRight]);
syncScroll(els.editorRight, [els.editorLeft, els.gutterLeft, els.gutterRight]);

// Preview scroll syncs
syncScroll(els.previewLeft, [els.previewRight]);
syncScroll(els.previewRight, [els.previewLeft]);

/* ─── Preview Toggle ─────────────────────────────────────────── */
els.previewToggle.addEventListener('click', () => {
  state.preview = !state.preview;
  els.previewToggle.classList.toggle('active', state.preview);

  ['left', 'right'].forEach(side => {
    const ew = el('editorWrapper', side);
    const pw = el('previewWrapper', side);
    const editor = el('editor', side);
    const preview = el('preview', side);

    // Scroll-Position merken (als Ratio)
    const scrollRatio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);

    if (state.preview) {
      ew.classList.add('hidden');
      pw.classList.add('visible');
      preview.innerHTML = renderMarkdown(state[side].content);
      // Scroll-Position auf Preview übertragen
      requestAnimationFrame(() => {
        preview.scrollTop = scrollRatio * (preview.scrollHeight - preview.clientHeight);
      });
    } else {
      // Scroll-Position aus Preview merken
      const previewRatio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1);
      ew.classList.remove('hidden');
      pw.classList.remove('visible');
      requestAnimationFrame(() => {
        editor.scrollTop = previewRatio * (editor.scrollHeight - editor.clientHeight);
        editor.focus();
      });
    }
  });
});

/* ─── Input Handling ──────────────────────────────────────────── */
function updateContent(side, content) {
  state[side].content = content;
  state[side].dirty = true;
  state.lastDiffKey = null;
  updateFileName(side);
  updateSaveBtn(side);
}

function setupEditor(side) {
  const editor = el('editor', side);
  const gutter = el('gutter', side);

  editor.addEventListener('input', () => {
    updateContent(side, editor.value);
    updateGuttersDebounced();
    if (state.preview) {
      el('preview', side).innerHTML = renderMarkdown(state[side].content);
    }
  });

  editor.addEventListener('scroll', () => {
    gutter.scrollTop = editor.scrollTop;
    el('highlight', side).style.top = -editor.scrollTop + 'px';
  });

  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); insertTab(editor); }
  });
}

setupEditor('left');
setupEditor('right');

/* ─── File Name & Save ────────────────────────────────────────── */
function updateFileName(side) {
  const nameEl = el('fileName', side);
  const s = state[side];
  if (s.filePath) {
    nameEl.innerHTML = basename(s.filePath) + (s.dirty ? ' <span class="unsaved">(geändert)</span>' : '');
    nameEl.classList.add('has-file');
  } else {
    nameEl.textContent = 'Keine Datei';
    nameEl.classList.remove('has-file');
  }
}

function updateSaveBtn(side) {
  el('save', side).classList.toggle('visible', state[side].dirty);
}

els.saveLeft.addEventListener('click', () => saveFile('left'));
els.saveRight.addEventListener('click', () => saveFile('right'));

async function saveFile(side) {
  const s = state[side];
  const result = await window.api.saveFile({ filePath: s.filePath, content: s.content });
  if (result.success) {
    s.filePath = result.filePath;
    s.dirty = false;
    updateFileName(side);
    updateSaveBtn(side);
  }
}

// Menu-triggered save
window.api.onSaveFile((side) => saveFile(side));

/* ─── Load Content ────────────────────────────────────────────── */
function loadContent(side, content, filePath, dirty) {
  state[side].content = content;
  state[side].filePath = filePath;
  state[side].dirty = dirty;
  state.lastDiffKey = null;
  el('editor', side).value = content;
  updateFileName(side);
  updateSaveBtn(side);
  updateGutters();
  if (state.preview) {
    el('preview', side).innerHTML = renderMarkdown(content);
  }
}

/* ─── IPC ─────────────────────────────────────────────────────── */
window.api.onFileOpened(({ side, filePath, content }) => {
  loadContent(side, content, filePath, false);
  addToHistory();
});

/* ─── Drag & Drop ─────────────────────────────────────────────── */
['left', 'right'].forEach(side => {
  const panel = document.getElementById(`panel${cap(side)}`);
  panel.addEventListener('dragover', (e) => { e.preventDefault(); panel.classList.add('drag-over'); });
  panel.addEventListener('dragleave', () => panel.classList.remove('drag-over'));
  panel.addEventListener('drop', (e) => {
    e.preventDefault();
    panel.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && /\.(md|markdown|mdown|mkd)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => loadContent(side, reader.result, file.path || file.name, false);
      reader.readAsText(file);
    }
  });
});

/* ─── History ─────────────────────────────────────────────────── */
let compareHistory = [];

async function initHistory() {
  compareHistory = await window.api.loadHistory() || [];
}

async function addToHistory() {
  if (!state.left.filePath && !state.right.filePath) return;
  const entry = { left: state.left.filePath, right: state.right.filePath, time: Date.now() };
  compareHistory = compareHistory.filter(h => !(h.left === entry.left && h.right === entry.right));
  compareHistory.unshift(entry);
  compareHistory = compareHistory.slice(0, 5);
  await window.api.saveHistory(compareHistory);
}

function formatTimeAgo(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

function renderHistory() {
  if (!compareHistory.length) {
    els.historyDropdown.innerHTML = '<div class="history-empty">Noch keine Vergleiche</div>';
    return;
  }
  els.historyDropdown.innerHTML = compareHistory.map((h, i) => `
    <div class="history-item" data-index="${i}">
      <div class="history-files">
        <div class="history-file left">${escapeHtml(basename(h.left) || '—')}</div>
        <div class="history-file right">${escapeHtml(basename(h.right) || '—')}</div>
      </div>
      <span class="history-time">${formatTimeAgo(h.time)}</span>
    </div>`).join('');
}

els.historyBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  renderHistory();
  els.historyDropdown.classList.toggle('open');
});

document.addEventListener('click', () => els.historyDropdown.classList.remove('open'));

els.historyDropdown.addEventListener('click', async (e) => {
  const item = e.target.closest('.history-item');
  if (!item) return;
  const entry = compareHistory[parseInt(item.dataset.index)];
  if (!entry) return;
  els.historyDropdown.classList.remove('open');
  await Promise.all(['left', 'right'].map(async (side) => {
    if (entry[side]) {
      const r = await window.api.readFile(entry[side]);
      if (r.success) loadContent(side, r.content, entry[side], false);
    }
  }));
});

/* ─── Init ────────────────────────────────────────────────────── */
document.getElementById('openTwoBtn').addEventListener('click', () => window.api.openTwoFiles());

updateGutters();
initHistory();
