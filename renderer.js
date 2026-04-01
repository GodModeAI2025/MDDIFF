const SIDES = ['left', 'right'];

const state = {
  left:  { filePath: null, content: '', dirty: false },
  right: { filePath: null, content: '', dirty: false },
  preview: false,
  theme: 'dark',
  diffGen: 0,
  lastDiffGen: -1,
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

function buildLineSpans(count, statuses, prefix) {
  const parts = new Array(count);
  for (let i = 0; i < count; i++) {
    const cls = statuses[i];
    if (prefix === 'line-num') {
      const marker = cls === 'add' ? '+' : cls === 'del' ? '-' : '';
      parts[i] = `<span class="${prefix} ${cls ? 'diff-' + cls : ''}">${marker}${i + 1}</span>`;
    } else {
      parts[i] = `<span class="${prefix} ${cls ? 'hl-' + cls : ''}">\n</span>`;
    }
  }
  return parts.join('');
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
    return `\x00CB${codeBlocks.length - 1}\x00`;
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
  codeBlocks.forEach((b, idx) => { html = html.replace(`\x00CB${idx}\x00`, b); });
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

/* ─── Diff Engine (cached via generation counter) ────────────── */
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
  if (state.lastDiffGen === state.diffGen) return state.lastDiffResult;
  state.lastDiffGen = state.diffGen;
  state.lastDiffResult = computeDiff(state.left.content || '', state.right.content || '');
  return state.lastDiffResult;
}

function renderPreviewWithDiff(side) {
  const diff = getCachedDiff();
  const lines = (state[side].content || '').split('\n');
  const statuses = new Array(lines.length).fill('');

  for (const e of diff) {
    if (side === 'left' && e.type === 'del') statuses[e.la - 1] = 'del';
    if (side === 'right' && e.type === 'add') statuses[e.lb - 1] = 'add';
  }

  // Tabellenzeilen nicht mit Markern umschließen (zerstört Table-Parsing),
  // stattdessen tracken und nachträglich auf <tr> anwenden
  const tableRowDiffs = [];
  let tableIdx = -1;
  let inTable = false;
  let rowIdx = 0;

  const markedLines = lines.map((line, i) => {
    const trimmed = line.trim();
    const isTableLine = /^\|.+\|$/.test(trimmed);

    if (isTableLine) {
      if (!inTable) { inTable = true; tableIdx++; rowIdx = 0; }
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
      const isSep = cells.every(c => /^[-:]+$/.test(c));
      if (!isSep) {
        if (statuses[i]) tableRowDiffs.push({ table: tableIdx, row: rowIdx, status: statuses[i] });
        rowIdx++;
      }
      return line;
    }

    if (inTable) inTable = false;
    if (statuses[i] === 'add') return '\x00DIFFADD\x00' + line + '\x00/DIFFADD\x00';
    if (statuses[i] === 'del') return '\x00DIFFDEL\x00' + line + '\x00/DIFFDEL\x00';
    return line;
  });

  let html = renderMarkdown(markedLines.join('\n'));
  html = html
    .replace(/\x00DIFFADD\x00/g, '<span class="diff-mark-added">')
    .replace(/\x00\/DIFFADD\x00/g, '</span>')
    .replace(/\x00DIFFDEL\x00/g, '<span class="diff-mark-removed">')
    .replace(/\x00\/DIFFDEL\x00/g, '</span>');

  // Diff-Klassen auf Tabellenzeilen anwenden
  if (tableRowDiffs.length) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const tables = tmp.querySelectorAll('table');
    for (const d of tableRowDiffs) {
      if (tables[d.table]) {
        const rows = tables[d.table].querySelectorAll('tr');
        if (rows[d.row]) {
          rows[d.row].classList.add(d.status === 'add' ? 'diff-tr-added' : 'diff-tr-removed');
        }
      }
    }
    html = tmp.innerHTML;
  }

  return html;
}

/* ─── Gutter + Highlight ─────────────────────────────────────── */
function updateGutters() {
  const diff = getCachedDiff();
  const data = {};

  for (const side of SIDES) {
    const lines = (state[side].content || '').split('\n');
    data[side] = { lines, statuses: new Array(lines.length).fill('') };
  }

  let adds = 0, dels = 0;
  for (const e of diff) {
    if (e.type === 'del') { data.left.statuses[e.la - 1] = 'del'; dels++; }
    if (e.type === 'add') { data.right.statuses[e.lb - 1] = 'add'; adds++; }
  }

  for (const side of SIDES) {
    const { lines, statuses } = data[side];
    el('gutter', side).innerHTML = buildLineSpans(lines.length, statuses, 'line-num');
    el('highlight', side).innerHTML = buildLineSpans(lines.length, statuses, 'hl-line');
  }

  els.diffStats.innerHTML = adds || dels
    ? `<span class="add">+${adds}</span><span class="del">-${dels}</span>`
    : '';

  updateDeltaButtons();
}

let gutterTimer = null;
function updateGuttersDebounced() {
  clearTimeout(gutterTimer);
  gutterTimer = setTimeout(updateGutters, 120);
}

/* ─── Sync Scroll ────────────────────────────────────────────── */
function setupEditorScrollSync() {
  let syncing = false;

  function onScroll(sourceSide) {
    if (syncing) return;
    syncing = true;

    const src = el('editor', sourceSide);
    const otherSide = sourceSide === 'left' ? 'right' : 'left';
    const other = el('editor', otherSide);
    const ratio = src.scrollTop / (src.scrollHeight - src.clientHeight || 1);

    other.scrollTop = ratio * (other.scrollHeight - other.clientHeight);

    // Gutters
    els.gutterLeft.scrollTop = els.editorLeft.scrollTop;
    els.gutterRight.scrollTop = els.editorRight.scrollTop;

    // Highlights per translateY
    els.highlightLeft.style.transform = `translateY(${-els.editorLeft.scrollTop}px)`;
    els.highlightRight.style.transform = `translateY(${-els.editorRight.scrollTop}px)`;

    requestAnimationFrame(() => { syncing = false; });
  }

  els.editorLeft.addEventListener('scroll', () => onScroll('left'));
  els.editorRight.addEventListener('scroll', () => onScroll('right'));
}

function setupPreviewScrollSync() {
  let syncing = false;

  function onScroll(source) {
    if (syncing) return;
    syncing = true;
    const other = source === els.previewLeft ? els.previewRight : els.previewLeft;
    const ratio = source.scrollTop / (source.scrollHeight - source.clientHeight || 1);
    other.scrollTop = ratio * (other.scrollHeight - other.clientHeight);
    requestAnimationFrame(() => { syncing = false; });
  }

  els.previewLeft.addEventListener('scroll', () => onScroll(els.previewLeft));
  els.previewRight.addEventListener('scroll', () => onScroll(els.previewRight));
}

setupEditorScrollSync();
setupPreviewScrollSync();

/* ─── Preview Toggle ─────────────────────────────────────────── */
const scrollRatios = { left: 0, right: 0 };

function getScrollRatio(element) {
  const max = element.scrollHeight - element.clientHeight;
  return max > 0 ? element.scrollTop / max : 0;
}

els.previewToggle.addEventListener('click', () => {
  for (const side of SIDES) {
    scrollRatios[side] = getScrollRatio(state.preview ? el('preview', side) : el('editor', side));
  }

  state.preview = !state.preview;
  els.previewToggle.classList.toggle('active', state.preview);

  for (const side of SIDES) {
    const ew = el('editorWrapper', side);
    const pw = el('previewWrapper', side);
    const ratio = scrollRatios[side];

    if (state.preview) {
      ew.classList.add('hidden');
      pw.classList.add('visible');
      el('preview', side).innerHTML = renderPreviewWithDiff(side);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el('preview', side).scrollTop = ratio * (el('preview', side).scrollHeight - el('preview', side).clientHeight);
      }));
    } else {
      ew.classList.remove('hidden');
      pw.classList.remove('visible');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const scr = el('editor', side);
        scr.scrollTop = ratio * (scr.scrollHeight - scr.clientHeight);
        el('editor', side).focus();
      }));
    }
  }
});

/* ─── Input Handling ──────────────────────────────────────────── */
function updateContent(side, content) {
  if (state[side].content === content) return;
  state[side].content = content;
  state[side].dirty = true;
  state.diffGen++;
  updateFileName(side);
  updateSaveBtn(side);
}

function setupEditor(side) {
  const editor = el('editor', side);

  let previewTimer = null;
  editor.addEventListener('input', () => {
    updateContent(side, editor.value);
    updateGuttersDebounced();
    if (state.preview) {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        el('preview', side).innerHTML = renderPreviewWithDiff(side);
      }, 150);
    }
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

for (const side of SIDES) el('save', side).addEventListener('click', () => saveFile(side));

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

window.api.onSaveFile((side) => saveFile(side));

/* ─── Load Content ────────────────────────────────────────────── */
function loadContent(side, content, filePath, dirty) {
  state[side].filePath = filePath;
  state[side].dirty = dirty;
  state[side].content = '';
  state.diffGen++;
  el('editor', side).value = content;
  state[side].content = content;
  updateFileName(side);
  updateSaveBtn(side);
  updateGutters();
  if (state.preview) {
    el('preview', side).innerHTML = renderPreviewWithDiff(side);
  }
}

/* ─── IPC ─────────────────────────────────────────────────────── */
window.api.onFileOpened(({ side, filePath, content }) => {
  loadContent(side, content, filePath, false);
  addToHistory();
});

/* ─── Drag & Drop ─────────────────────────────────────────────── */
for (const side of SIDES) {
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
}

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

els.historyDropdown.addEventListener('click', async (e) => {
  const item = e.target.closest('.history-item');
  if (!item) return;
  const entry = compareHistory[parseInt(item.dataset.index)];
  if (!entry) return;
  els.historyDropdown.classList.remove('open');
  await Promise.all(SIDES.map(async (side) => {
    if (entry[side]) {
      const r = await window.api.readFile(entry[side]);
      if (r.success) loadContent(side, r.content, entry[side], false);
    }
  }));
});

/* ─── Open Two Files ──────────────────────────────────────────── */
document.getElementById('openTwoBtn').addEventListener('click', () => window.api.openTwoFiles());
document.getElementById('openLeft').addEventListener('click', () => window.api.openFile('left'));
document.getElementById('openRight').addEventListener('click', () => window.api.openFile('right'));

/* ─── TOC ─────────────────────────────────────────────────────── */
function buildToc(side) {
  const lines = (state[side].content || '').split('\n');
  const headings = [];
  let inCodeBlock = false;

  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('```')) inCodeBlock = !inCodeBlock;
    if (inCodeBlock) return;
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) headings.push({ level: match[1].length, text: match[2], line: i });
  });

  const dropdown = document.getElementById(`toc${cap(side)}`);
  if (!headings.length) {
    dropdown.innerHTML = '<div class="toc-empty">Keine Überschriften</div>';
    return;
  }

  dropdown.innerHTML = headings.map(h =>
    `<div class="toc-item toc-h${h.level}" data-line="${h.line}">` +
    `${escapeHtml(h.text)}<span class="toc-line">:${h.line + 1}</span></div>`
  ).join('');
}

function scrollToLine(side, lineIndex) {
  const editor = el('editor', side);
  const content = state[side].content;

  // Cursor-Position berechnen
  let pos = 0;
  for (let i = 0; i < lineIndex; i++) {
    const nl = content.indexOf('\n', pos);
    pos = nl === -1 ? content.length : nl + 1;
  }

  // Cursor setzen – das bewegt die interne Scroll-Position der Textarea
  editor.focus();
  editor.setSelectionRange(pos, pos);

  // Temporäres Element einfügen um die exakte Pixel-Position der Zeile zu messen
  // Fallback: Zeilenhöhe * Zeilenindex
  const style = getComputedStyle(editor);
  const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.6);
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const targetY = paddingTop + lineIndex * lineHeight;

  // Scroll so dass Zielzeile im oberen Drittel sichtbar ist
  editor.scrollTop = Math.max(0, targetY - editor.clientHeight / 3);

  // Gutter + Highlight synchronisieren
  el('gutter', side).scrollTop = editor.scrollTop;
  el('highlight', side).style.transform = `translateY(${-editor.scrollTop}px)`;
}

/* ─── Delta Navigation ────────────────────────────────────────── */
function getDeltaLines(side) {
  const diff = getCachedDiff();
  const lines = [];
  for (const e of diff) {
    if (side === 'left' && e.type === 'del') lines.push(e.la - 1);
    if (side === 'right' && e.type === 'add') lines.push(e.lb - 1);
  }
  return lines;
}

function getCurrentLine(side) {
  const editor = el('editor', side);
  const style = getComputedStyle(editor);
  const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.6);
  const paddingTop = parseFloat(style.paddingTop) || 0;
  return Math.round((editor.scrollTop - paddingTop + editor.clientHeight / 3) / lineHeight);
}

function scrollBothSidesToLine(side, lineIndex) {
  scrollToLine(side, lineIndex);

  // Andere Seite zum gleichen Zeilenindex scrollen
  const otherSide = side === 'left' ? 'right' : 'left';
  requestAnimationFrame(() => {
    scrollToLine(otherSide, lineIndex);
  });
}

function updateDeltaButtons() {
  document.querySelectorAll('.btn-delta').forEach(btn => {
    const side = btn.dataset.side;
    const deltas = getDeltaLines(side);
    btn.classList.toggle('has-target', deltas.length > 0);
  });
}

document.querySelectorAll('.btn-delta').forEach(btn => {
  btn.addEventListener('click', () => {
    const side = btn.dataset.side;
    const dir = btn.dataset.dir;
    const deltas = getDeltaLines(side);
    if (!deltas.length) return;

    const current = getCurrentLine(side);
    let target;

    if (dir === 'next') {
      target = deltas.find(l => l > current + 1);
      if (target === undefined) target = deltas[0];
    } else {
      for (let i = deltas.length - 1; i >= 0; i--) {
        if (deltas[i] < current - 1) { target = deltas[i]; break; }
      }
      if (target === undefined) target = deltas[deltas.length - 1];
    }

    scrollBothSidesToLine(side, target);
  });
});

document.querySelectorAll('.toc-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const side = btn.dataset.side;
    document.querySelectorAll('.toc-dropdown').forEach(d => {
      if (d.id !== `toc${cap(side)}`) d.classList.remove('open');
    });
    buildToc(side);
    document.getElementById(`toc${cap(side)}`).classList.toggle('open');
  });
});

document.querySelectorAll('.toc-dropdown').forEach(dropdown => {
  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.toc-item');
    if (!item) return;
    const lineIndex = parseInt(item.dataset.line);
    const side = dropdown.dataset.side;
    dropdown.classList.remove('open');

    if (state.preview) {
      const headings = el('preview', side).querySelectorAll('h1, h2, h3, h4, h5, h6');
      const idx = Array.from(dropdown.querySelectorAll('.toc-item')).indexOf(item);
      if (headings[idx]) headings[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      scrollToLine(side, lineIndex);
    }
  });
});

// Close all dropdowns on outside click
document.addEventListener('click', () => {
  els.historyDropdown.classList.remove('open');
  document.querySelectorAll('.toc-dropdown').forEach(d => d.classList.remove('open'));
});

/* ─── Init ────────────────────────────────────────────────────── */
updateGutters();
initHistory();
