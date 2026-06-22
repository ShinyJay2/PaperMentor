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
  color-scheme: light;
  --field:#f3efe6;
  --paper:#fbf8ef;
  --paper2:#fffdf7;
  --ink:#161616;
  --muted:#6f6b63;
  --hair:#1b1b1b;
  --soft:#ded6c8;
  --soft2:#ebe4d8;
  --accent:#5b21ff;
  --accent2:#7c3aed;
  --accentSoft:#ebe5ff;
  --green:#087f5b;
  --amber:#a16207;
  --red:#be123c;
  --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --sans: Satoshi, Avenir Next, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
  --serif: Charter, Iowan Old Style, Georgia, serif;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin:0;
  color:var(--ink);
  font-family:var(--sans);
  background:
    linear-gradient(90deg, rgba(22,22,22,.035) 1px, transparent 1px),
    linear-gradient(180deg, rgba(22,22,22,.035) 1px, transparent 1px),
    var(--field);
  background-size: 32px 32px;
}
body:before {
  content:'';
  position:fixed;
  inset:18px;
  border:1px solid rgba(22,22,22,.22);
  pointer-events:none;
  z-index:20;
}
.shell { max-width: 1320px; margin: 0 auto; padding: 38px 34px 74px; }
.topbar {
  display:grid;
  grid-template-columns: 1fr auto;
  align-items:start;
  gap:22px;
  border:1px solid var(--hair);
  background:rgba(251,248,239,.76);
  padding:18px 20px;
  margin-bottom:18px;
}
.brand { display:flex; align-items:flex-start; gap:16px; }
.logo {
  width:42px; height:42px;
  display:grid; place-items:center;
  border:1px solid var(--hair);
  background:var(--accent);
  color:white;
  font-family:var(--mono);
  font-weight:900;
  letter-spacing:-.08em;
}
.brand h1 { margin:0; font-size:25px; letter-spacing:-.055em; text-transform:uppercase; }
.brand p { margin:3px 0 0; color:var(--muted); font-family:var(--mono); font-size:11px; text-transform:uppercase; letter-spacing:.08em; }
.open-pill {
  border:1px dashed var(--hair);
  color:var(--ink);
  background:var(--paper2);
  padding:10px 12px;
  font-family:var(--mono);
  font-size:11px;
  max-width:560px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.workspace {
  display:grid;
  grid-template-columns: 336px minmax(0, 1fr);
  gap:18px;
  align-items:start;
}
.sidebar { position:sticky; top:34px; display:grid; gap:18px; }
.panel {
  background:var(--paper);
  border:1px solid var(--hair);
  box-shadow: 8px 8px 0 rgba(22,22,22,.08);
}
.paper-title { padding:18px; }
.kicker {
  color:var(--accent);
  text-transform:uppercase;
  letter-spacing:.18em;
  font-size:10px;
  font-family:var(--mono);
  font-weight:900;
}
.paper-title h2 {
  margin:10px 0 16px;
  font-size:27px;
  line-height:.96;
  letter-spacing:-.07em;
  text-transform:uppercase;
}
.meta { display:grid; grid-template-columns:1fr; gap:7px; }
.badge {
  border:1px dashed rgba(22,22,22,.48);
  padding:7px 9px;
  color:var(--ink);
  font-family:var(--mono);
  font-size:11px;
  background:rgba(255,255,255,.36);
}
.panel-title {
  display:flex;
  align-items:center;
  justify-content:space-between;
  border-bottom:1px solid var(--hair);
  padding:12px 14px;
  background:var(--soft2);
}
.panel-title strong { font-size:12px; font-family:var(--mono); text-transform:uppercase; letter-spacing:.12em; }
.hint { color:var(--muted); font-size:10px; font-family:var(--mono); text-transform:uppercase; }
.path { list-style:none; padding:12px; margin:0; display:grid; gap:8px; }
.path li {
  display:grid;
  grid-template-columns:28px 1fr;
  align-items:center;
  gap:10px;
  min-height:43px;
  padding:8px 10px;
  border:1px solid rgba(22,22,22,.38);
  background:rgba(255,255,255,.26);
  color:var(--ink);
}
.path .icon {
  width:24px; height:24px;
  display:grid;
  place-items:center;
  border:1px solid var(--hair);
  font-family:var(--mono);
  font-weight:900;
  background:var(--paper2);
}
.path li.done .icon { background:var(--green); color:white; }
.path li.current {
  border:2px solid var(--accent);
  background:var(--accentSoft);
  box-shadow: 4px 4px 0 rgba(91,33,255,.18);
}
.path li.current .icon { background:var(--accent); color:white; }
.path li.blocked .icon { background:var(--red); color:white; }
.choices { counter-reset: choice; display:grid; gap:8px; padding:12px; }
.choice {
  position:relative;
  border:1px solid var(--hair);
  background:var(--paper2);
  padding:11px 12px 11px 42px;
  color:var(--ink);
  font-size:13px;
  line-height:1.35;
}
.choice:before {
  counter-increment: choice;
  content:'[' counter(choice) ']';
  position:absolute;
  left:10px;
  top:10px;
  color:var(--accent);
  font-family:var(--mono);
  font-weight:950;
}
.content { min-width:0; }
.session-head {
  position:relative;
  border:1px solid var(--hair);
  background:var(--paper2);
  min-height:260px;
  padding:28px 32px;
  margin-bottom:18px;
  overflow:hidden;
  box-shadow: 8px 8px 0 rgba(22,22,22,.08);
}
.session-head:before {
  content:'PM / READING SPECIMEN';
  position:absolute;
  right:24px;
  top:22px;
  border:1px dashed var(--hair);
  padding:8px 10px;
  font-family:var(--mono);
  font-size:10px;
  letter-spacing:.12em;
  color:var(--muted);
}
.session-head:after {
  content:'';
  position:absolute;
  right:-70px;
  bottom:-70px;
  width:260px;
  height:260px;
  border:1px solid rgba(91,33,255,.36);
  background:
    linear-gradient(90deg, rgba(91,33,255,.13) 1px, transparent 1px),
    linear-gradient(180deg, rgba(91,33,255,.13) 1px, transparent 1px);
  background-size:18px 18px;
  transform:rotate(-12deg);
}
.session-head .kicker { color:var(--accent); }
.session-head h2 {
  position:relative;
  z-index:1;
  max-width:780px;
  margin:14px 0 18px;
  font-size: clamp(58px, 8vw, 124px);
  line-height:.78;
  letter-spacing:-.095em;
  text-transform:uppercase;
}
.session-head p {
  position:relative;
  z-index:1;
  margin:0;
  max-width:700px;
  color:#31302d;
  line-height:1.65;
  font-size:16px;
}
.session-head code {
  background:#eee6d8;
  color:var(--ink);
  padding:2px 6px;
  border:1px solid #cfc4b3;
}
.timeline { position:relative; display:grid; gap:18px; padding-bottom:20px; }
.block {
  position:relative;
  background:var(--paper2);
  color:var(--ink);
  border:1px solid var(--hair);
  box-shadow: 8px 8px 0 rgba(22,22,22,.08);
}
.block:before {
  content:attr(data-index);
  position:absolute;
  left:-1px;
  top:-1px;
  width:48px;
  height:48px;
  display:grid;
  place-items:center;
  border-right:1px solid var(--hair);
  border-bottom:1px solid var(--hair);
  background:var(--accent);
  color:white;
  font-family:var(--mono);
  font-weight:950;
  z-index:2;
}
.block:after {
  content:'';
  position:absolute;
  inset:0;
  pointer-events:none;
  background:
    linear-gradient(90deg, rgba(22,22,22,.03) 1px, transparent 1px),
    linear-gradient(180deg, rgba(22,22,22,.026) 1px, transparent 1px);
  background-size:24px 24px;
  mask-image: linear-gradient(90deg, transparent, black 12%, black 100%);
}
.block-inner { position:relative; z-index:1; padding:30px 34px 34px 72px; }
.block-head {
  display:grid;
  grid-template-columns: 1fr auto;
  gap:16px;
  align-items:start;
  padding-bottom:16px;
  border-bottom:1px solid var(--hair);
  margin-bottom:18px;
}
.block h2 {
  margin:0;
  color:var(--ink);
  font-size:34px;
  line-height:.95;
  letter-spacing:-.065em;
  text-transform:uppercase;
}
.type-chip {
  border:1px solid var(--hair);
  background:var(--accentSoft);
  color:var(--accent);
  padding:7px 10px;
  font-size:10px;
  white-space:nowrap;
  font-family:var(--mono);
  font-weight:900;
  text-transform:uppercase;
  letter-spacing:.09em;
}
.location { color:var(--muted); font-size:11px; margin-top:8px; font-family:var(--mono); text-transform:uppercase; letter-spacing:.04em; }
.latex {
  border:1px solid var(--hair);
  padding:20px;
  background:#f4eee2;
  overflow-x:auto;
  margin:18px 0 22px;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.5);
}
.body { color:#22211f; line-height:1.66; font-size:16px; max-width:880px; }
.body h1,.body h2,.body h3 { color:var(--ink); letter-spacing:-.055em; line-height:1; text-transform:uppercase; }
.body h2 { margin-top:24px; font-size:27px; }
.body h3 { font-size:20px; }
.body code { background:#eee6d8; border:1px solid #cfc4b3; padding:2px 6px; color:var(--ink); font-family:var(--mono); }
.body p { margin:12px 0; }
.body ul { padding-left:22px; }
.body li { margin:8px 0; }
.empty { padding:30px; color:var(--muted); }
.footer {
  margin-top:24px;
  border:1px dashed var(--hair);
  background:rgba(251,248,239,.72);
  padding:12px;
  color:var(--muted);
  font-family:var(--mono);
  font-size:11px;
  text-align:center;
  text-transform:uppercase;
  letter-spacing:.08em;
}
@media (max-width: 980px) {
  .workspace { grid-template-columns: 1fr; }
  .sidebar { position:static; }
  .topbar { grid-template-columns:1fr; }
}
@media (max-width: 640px) {
  body:before { inset:10px; }
  .shell { padding:22px 18px 54px; }
  .session-head { min-height:220px; padding:24px; }
  .session-head h2 { font-size:54px; }
  .block-inner { padding:70px 22px 26px; }
  .block-head { grid-template-columns:1fr; }
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
