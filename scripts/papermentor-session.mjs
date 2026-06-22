#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const baseDir = join(root, '.papermentor', 'sessions');
const pathItems = [
  ['map', 'Map the paper'],
  ['equations', 'Decode key equations'],
  ['derivations', 'Trace derivations'],
  ['dependencies', 'Connect dependencies'],
  ['confusion', 'Resolve confusion'],
  ['final', 'Extract final insight']
];

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) args._.push(token);
    else {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i += 1; }
    }
  }
  return args;
}

function slugify(value) {
  return String(value || 'paper-session')
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'paper-session';
}

function now() { return new Date().toISOString(); }

function sessionDir(slug) { return join(baseDir, slug); }
function statePath(slug) { return join(sessionDir(slug), 'state.json'); }
function cardsPath(slug) { return join(sessionDir(slug), 'cards.json'); }
function notesPath(slug) { return join(sessionDir(slug), 'notes.md'); }
function indexPath(slug) { return join(sessionDir(slug), 'index.html'); }

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function defaultState({ title, source, slug }) {
  return {
    schema: 'papermentor.session.v1',
    title,
    source,
    slug,
    createdAt: now(),
    updatedAt: now(),
    currentLocation: 'Paper map',
    currentFocus: 'Start with the paper map, then choose the next blocker.',
    readingPath: pathItems.map(([key, label], index) => ({ key, label, status: index === 0 ? 'current' : 'pending' })),
    nextChoices: [
      'Decode key equations',
      'Trace the first important derivation',
      'Build a dependency chain',
      'Ask me what feels confusing'
    ],
    renderedView: `.papermentor/sessions/${slug}/index.html`
  };
}

function ensureSession({ title, source, slug }) {
  const dir = sessionDir(slug);
  mkdirSync(dir, { recursive: true });
  const state = existsSync(statePath(slug))
    ? readJson(statePath(slug), {})
    : defaultState({ title, source, slug });
  state.updatedAt = now();
  state.title = title || state.title;
  state.source = source || state.source;
  state.renderedView = `.papermentor/sessions/${slug}/index.html`;
  const cards = readJson(cardsPath(slug), { schema: 'papermentor.cards.v1', cards: [] });
  writeJson(statePath(slug), state);
  writeJson(cardsPath(slug), cards);
  if (!existsSync(notesPath(slug))) {
    writeFileSync(notesPath(slug), `# PaperMentor session: ${state.title}\n\nSource: ${state.source || 'not provided'}\n\n`);
  }
  renderHtml(slug);
  return { state, cards };
}

function setPathStatus(state, key, status) {
  state.readingPath = state.readingPath.map((item) => {
    if (item.key === key) return { ...item, status };
    if (status === 'current' && item.status === 'current') return { ...item, status: 'done' };
    return item;
  });
}

function inferPathKey(type) {
  const map = {
    'paper-map': 'map', scan: 'map', equation: 'equations', 'equation-card': 'equations', derivation: 'derivations',
    dependency: 'dependencies', dependencies: 'dependencies', confusion: 'confusion', why: 'confusion', final: 'final',
    'final-insight': 'final'
  };
  return map[type] || null;
}

function readBody(args) {
  if (args['body-file']) return readFileSync(resolve(args['body-file']), 'utf8');
  if (args.body) return args.body;
  return '';
}

function splitChoices(value) {
  if (!value) return [];
  return String(value).split('|').map((x) => x.trim()).filter(Boolean);
}

function addCard(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('card requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const cards = readJson(cardsPath(slug), { schema: 'papermentor.cards.v1', cards: [] });
  const type = args.type || 'note';
  const card = {
    id: args.id || `${type}-${String(cards.cards.length + 1).padStart(3, '0')}`,
    type,
    title: args.title || type,
    location: args.location || state.currentLocation,
    latex: args.latex || '',
    body: readBody(args),
    choices: splitChoices(args.choices),
    createdAt: now()
  };
  cards.cards.push(card);
  const pathKey = inferPathKey(type);
  if (pathKey) setPathStatus(state, pathKey, args.status || 'done');
  const nextKey = args.next || pathItems.find(([key]) => state.readingPath.find((item) => item.key === key)?.status === 'pending')?.[0];
  if (nextKey) setPathStatus(state, nextKey, 'current');
  state.currentLocation = card.location;
  state.currentFocus = card.title;
  state.nextChoices = card.choices.length ? card.choices : state.nextChoices;
  state.updatedAt = now();
  writeJson(cardsPath(slug), cards);
  writeJson(statePath(slug), state);
  appendFileSync(notesPath(slug), `\n## ${card.title}\n\nLocation: ${card.location}\n\n${card.latex ? `$$\n${card.latex}\n$$\n\n` : ''}${card.body}\n`);
  renderHtml(slug);
  printConsole(state, cards);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function statusIcon(status) {
  return { done: '✓', current: '›', pending: ' ', blocked: '!', review: '↺' }[status] || ' ';
}

function statusClass(status) {
  return { done: 'done', current: 'current', pending: 'pending', blocked: 'blocked', review: 'review' }[status] || 'pending';
}

function renderHtml(slug) {
  const state = readJson(statePath(slug), {});
  const cards = readJson(cardsPath(slug), { cards: [] });
  const data = JSON.stringify({ state, cards }, null, 2).replace(/<\//g, '<\\/');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PaperMentor · ${escapeHtml(state.title)}</title>
<script>
window.MathJax = { tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']] }, svg: { fontCache: 'global' } };
</script>
<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
<style>
:root {
  color-scheme: light dark;
  --desk:#07101d;
  --desk2:#0d1728;
  --ink:#152033;
  --muted:#64748b;
  --paper:#f8f3e8;
  --paper2:#fffaf0;
  --paperLine:#e5dcc8;
  --console:#0b1322;
  --console2:#111c31;
  --consoleLine:#23344f;
  --blue:#0ea5e9;
  --blue2:#075985;
  --green:#059669;
  --amber:#b45309;
  --violet:#7c3aed;
  --red:#e11d48;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin:0;
  font-family: Avenir Next, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
  background:
    radial-gradient(circle at 78% 0%, rgba(14,165,233,.16), transparent 26%),
    radial-gradient(circle at 6% 100%, rgba(124,58,237,.13), transparent 28%),
    linear-gradient(120deg, #050914 0%, var(--desk) 48%, #111827 100%);
  color:#e8eef8;
}
.shell { max-width: 1280px; margin: 0 auto; padding: 26px 26px 76px; }
.topbar { display:flex; align-items:center; justify-content:space-between; gap:18px; padding: 8px 0 24px; }
.brand { display:flex; align-items:center; gap:14px; }
.logo {
  width:46px; height:46px; border-radius:18px;
  display:grid; place-items:center;
  background: linear-gradient(135deg, #e9d5ff, #38bdf8 58%, #0f172a);
  box-shadow:0 18px 48px rgba(14,165,233,.25);
  font-weight:950; color:#07101d; letter-spacing:-.05em;
}
.brand h1 { margin:0; font-size:27px; letter-spacing:-.055em; }
.brand p { margin:2px 0 0; color:#9fb2ca; font-size:13px; }
.open-pill {
  border:1px solid rgba(125,211,252,.32); color:#dff7ff;
  background:rgba(8,47,73,.40); border-radius:999px; padding:10px 14px;
  font-size:12px; white-space:nowrap; max-width:520px; overflow:hidden; text-overflow:ellipsis;
}
.workspace { display:grid; grid-template-columns: 330px minmax(0, 1fr); gap:28px; align-items:start; }
.sidebar { position:sticky; top:22px; display:grid; gap:16px; }
.panel {
  background: linear-gradient(145deg, rgba(11,19,34,.96), rgba(17,28,49,.92));
  border:1px solid rgba(148,163,184,.18);
  box-shadow: 0 24px 80px rgba(0,0,0,.34);
  border-radius:24px;
  padding:20px;
}
.paper-title { padding:22px; }
.kicker { color:#67e8f9; text-transform:uppercase; letter-spacing:.18em; font-size:10px; font-weight:950; }
.paper-title h2 { margin:8px 0 14px; font-size:22px; line-height:1.13; letter-spacing:-.045em; }
.meta { display:flex; flex-wrap:wrap; gap:8px; }
.badge {
  border:1px solid rgba(148,163,184,.20); border-radius:999px;
  padding:7px 10px; color:#d5e2f2; font-size:12px; background:rgba(15,23,42,.52);
}
.panel-title { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.panel-title strong { font-size:14px; }
.hint { color:#8aa0ba; font-size:12px; }
.path { list-style:none; padding:0; margin:0; display:grid; gap:9px; }
.path li {
  display:grid; grid-template-columns:28px 1fr; align-items:center; gap:10px;
  padding:11px 12px; border-radius:16px;
  border:1px solid rgba(148,163,184,.13); background:rgba(15,23,42,.48); color:#d5e2f2;
}
.path .icon { width:28px; height:28px; display:grid; place-items:center; border-radius:10px; font-weight:950; background:#1b2638; }
.path li.done .icon { background:rgba(5,150,105,.18); color:#34d399; }
.path li.current { border-color:rgba(14,165,233,.64); background:linear-gradient(135deg, rgba(14,165,233,.20), rgba(14,165,233,.06)); color:#f0fbff; }
.path li.current .icon { background:rgba(14,165,233,.25); color:#7dd3fc; }
.path li.blocked .icon { background:rgba(225,29,72,.18); color:#fb7185; }
.choices { counter-reset: choice; display:grid; gap:9px; }
.choice {
  border:1px solid rgba(14,165,233,.24); background:rgba(14,165,233,.08);
  border-radius:15px; padding:11px 12px; color:#e0f2fe; font-size:13px; line-height:1.35;
}
.choice:before { counter-increment: choice; content:'[' counter(choice) '] '; color:#38bdf8; font-weight:950; }
.content { min-width:0; }
.session-head {
  border-radius:30px; padding:34px 38px;
  background:
    linear-gradient(135deg, rgba(255,250,240,.98), rgba(248,243,232,.96)),
    repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(21,32,51,.045) 32px);
  color:var(--ink);
  border:1px solid rgba(229,220,200,.95);
  box-shadow: 0 30px 90px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.75);
  margin-bottom:24px;
}
.session-head .kicker { color:#0369a1; }
.session-head h2 {
  margin:6px 0 12px;
  font-family: Charter, Iowan Old Style, Georgia, serif;
  font-size: clamp(38px, 5vw, 68px);
  line-height:.92;
  letter-spacing:-.065em;
}
.session-head p { margin:0; color:#42526a; max-width:820px; line-height:1.65; font-family: Charter, Iowan Old Style, Georgia, serif; font-size:17px; }
.session-head code { background:#efe5d0; color:#0f172a; padding:2px 6px; border-radius:7px; border:1px solid #dfd2bb; }
.timeline { position:relative; display:grid; gap:22px; padding-bottom:20px; }
.timeline:before { content:''; position:absolute; left:26px; top:14px; bottom:16px; width:2px; background:linear-gradient(#38bdf8, rgba(56,189,248,.04)); }
.block {
  position:relative; margin-left:62px; padding:0;
  background:var(--paper2);
  color:var(--ink);
  border:1px solid var(--paperLine);
  border-radius:8px 28px 28px 8px;
  box-shadow: 0 30px 90px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.78);
  overflow:visible;
}
.block:before {
  content:attr(data-index); position:absolute; left:-62px; top:22px;
  width:48px; height:48px; display:grid; place-items:center;
  border-radius:50%; background:#0f172a; border:2px solid #38bdf8;
  color:#e0f2fe; font-weight:950; box-shadow:0 14px 38px rgba(56,189,248,.22);
  z-index:2;
}
.block:after {
  content:''; position:absolute; left:0; top:0; bottom:0; width:7px;
  background:linear-gradient(180deg, #38bdf8, #7c3aed);
  border-radius:8px 0 0 8px;
}
.block-inner { padding:30px 36px 34px; }
.block-head { display:flex; gap:14px; justify-content:space-between; align-items:flex-start; padding-bottom:16px; border-bottom:1px solid #eadfcb; margin-bottom:18px; }
.block h2 {
  margin:0;
  color:#111827;
  font-family: Charter, Iowan Old Style, Georgia, serif;
  font-size:32px;
  letter-spacing:-.04em;
}
.type-chip {
  border:1px solid #d7c8ad; background:#f2e8d5; color:#6b4e16;
  border-radius:999px; padding:7px 10px; font-size:12px; white-space:nowrap; font-weight:850;
}
.location { color:#64748b; font-size:13px; margin-top:7px; }
.latex {
  border:1px solid #d8c9ae; border-radius:20px;
  padding:20px; background:#f3ead8;
  overflow-x:auto; margin:18px 0 22px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
}
.body { color:#243244; line-height:1.76; font-size:16px; font-family: Charter, Iowan Old Style, Georgia, serif; }
.body h1,.body h2,.body h3 { color:#111827; letter-spacing:-.03em; line-height:1.08; }
.body h2 { margin-top:22px; font-size:24px; }
.body h3 { font-size:20px; }
.body code { background:#efe5d0; border:1px solid #dfd2bb; padding:2px 6px; border-radius:7px; color:#0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.body p { margin:12px 0; }
.body ul { padding-left:24px; }
.body li { margin:8px 0; }
.empty { margin-left:62px; padding:30px; color:#64748b; }
.footer { margin-top:30px; color:#8fa2b8; font-size:13px; text-align:center; }
@media (max-width: 960px) {
  .workspace { grid-template-columns: 1fr; }
  .sidebar { position:static; }
  .topbar { align-items:flex-start; flex-direction:column; }
}
@media (max-width: 640px) {
  .shell { padding:20px 14px 54px; }
  .block { margin-left:46px; }
  .block-inner { padding:24px 22px; }
  .timeline:before { left:20px; }
  .block:before { left:-46px; width:38px; height:38px; }
  .session-head { padding:26px 24px; }
}
</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <div class="brand">
      <div class="logo">PM</div>
      <div>
        <h1>PaperMentor</h1>
        <p>Debug understanding, one paper block at a time.</p>
      </div>
    </div>
    <div class="open-pill">Rendered view · ${escapeHtml(state.renderedView || 'index.html')}</div>
  </header>

  <main class="workspace">
    <aside class="sidebar">
      <section class="panel paper-title">
        <div class="kicker">Current paper</div>
        <h2>${escapeHtml(state.title || 'Paper reading session')}</h2>
        <div class="meta">
          <span class="badge">${escapeHtml(state.currentLocation || 'Location not set')}</span>
          <span class="badge">${escapeHtml(state.currentFocus || 'Focus not set')}</span>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><strong>Reading Path</strong><span class="hint">guided, interruptible</span></div>
        <ul class="path">
          ${(state.readingPath || []).map((item) => `<li class="${statusClass(item.status)}"><span class="icon">${statusIcon(item.status)}</span><span>${escapeHtml(item.label)}</span></li>`).join('\n')}
        </ul>
      </section>

      <section class="panel">
        <div class="panel-title"><strong>Choose next</strong><span class="hint">type a number</span></div>
        <div class="choices">${(state.nextChoices || []).map((choice) => `<div class="choice">${escapeHtml(choice)}</div>`).join('\n')}</div>
      </section>
    </aside>

    <section class="content">
      <div class="session-head">
        <div class="kicker">Reading session</div>
        <h2>${escapeHtml(state.currentFocus || 'Paper map')}</h2>
        <p>Each Reading Path action appends a new block below. The dashboard stays as one reusable <code>index.html</code>; PaperMentor updates <code>state.json</code> and <code>cards.json</code>, then rerenders this page.</p>
      </div>

      <section class="timeline">
        ${(cards.cards || []).map((card, index) => `<article id="${escapeHtml(card.id)}" class="block" data-index="${index + 1}"><div class="block-inner"><div class="block-head"><div><h2>${escapeHtml(card.title)}</h2><div class="location">${escapeHtml(card.location)} · ${escapeHtml(card.createdAt || '')}</div></div><span class="type-chip">${escapeHtml(card.type)}</span></div>${card.latex ? `<div class="latex">$$\n${escapeHtml(card.latex)}\n$$</div>` : ''}<div class="body">${markdownToHtml(card.body || '')}</div></div></article>`).join('\n') || '<article class="block empty" data-index="1"><h2>No blocks yet</h2><div class="body">Start by adding a paper map, equation card, derivation trace, dependency trace, or confusion repair block.</div></article>'}
      </section>
    </section>
  </main>

  <div class="footer">One session, one dashboard. Blocks are appended from cards.json and rendered with MathJax.</div>
</div>
<script id="papermentor-data" type="application/json">${data}</script>
</body>
</html>`;
  writeFileSync(indexPath(slug), html);
}

function markdownToHtml(markdown) {
  const escaped = escapeHtml(markdown);
  const lines = escaped.split(/\r?\n/);
  let html = '';
  let inList = false;
  for (const line of lines) {
    if (/^###\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h3>${line.replace(/^###\s+/, '')}</h3>`; }
    else if (/^##\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h2>${line.replace(/^##\s+/, '')}</h2>`; }
    else if (/^#\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h1>${line.replace(/^#\s+/, '')}</h1>`; }
    else if (/^-\s+/.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${formatInline(line.replace(/^-\s+/, ''))}</li>`; }
    else if (line.trim() === '') { if (inList) { html += '</ul>'; inList = false; } }
    else { if (inList) { html += '</ul>'; inList = false; } html += `<p>${formatInline(line)}</p>`; }
  }
  if (inList) html += '</ul>';
  return html;
}

function formatInline(value) {
  return value
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function line(width = 74) { return '─'.repeat(width); }
function trim(value, width = 62) {
  const s = String(value || '');
  return s.length > width ? `${s.slice(0, width - 1)}…` : s;
}
function printConsole(state, cards = readJson(cardsPath(state.slug), { cards: [] })) {
  const width = 74;
  console.log(`╭─ PaperMentor Reading Console ${line(width - 29)}╮`);
  console.log(`│ Paper: ${trim(state.title, width - 10).padEnd(width - 8)} │`);
  console.log(`│ Location: ${trim(state.currentLocation, width - 13).padEnd(width - 11)} │`);
  console.log(`│ Focus: ${trim(state.currentFocus, width - 10).padEnd(width - 8)} │`);
  console.log(`│ View: ${trim(state.renderedView, width - 9).padEnd(width - 7)} │`);
  console.log(`╰${line(width)}╯`);
  console.log('\nReading Path');
  for (const item of state.readingPath || []) {
    const mark = item.status === 'done' ? '✓' : item.status === 'current' ? '›' : item.status === 'blocked' ? '!' : ' ';
    console.log(`  [${mark}] ${item.label}`);
  }
  console.log('\nChoose next:');
  (state.nextChoices || []).forEach((choice, index) => console.log(`  [${index + 1}] ${choice}`));
  console.log(`\nCards: ${(cards.cards || []).length} · Open ${state.renderedView}`);
}

function usage() {
  console.log(`PaperMentor session helper\n\nUsage:\n  node scripts/papermentor-session.mjs start --title <title> [--source <url>] [--slug <slug>]\n  node scripts/papermentor-session.mjs card --session <slug> --type equation --title <title> [--latex <tex>] [--body <text>|--body-file <path>] [--choices "A|B|C"]\n  node scripts/papermentor-session.mjs status --session <slug>\n`);
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
try {
  if (command === 'start') {
    const title = args.title || 'Paper reading session';
    const slug = args.slug || slugify(title);
    const source = args.source || '';
    const { state, cards } = ensureSession({ title, source, slug });
    printConsole(state, cards);
  } else if (command === 'card') {
    addCard(args);
  } else if (command === 'status') {
    const slug = args.session || args.slug;
    if (!slug) throw new Error('status requires --session <slug>');
    renderHtml(slug);
    printConsole(readJson(statePath(slug), {}));
  } else {
    usage();
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(`PaperMentor session error: ${error.message}`);
  process.exit(1);
}
