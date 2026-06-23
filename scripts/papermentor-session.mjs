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
  --field:#f4f1e8;
  --paper:#fffdf7;
  --paper2:#fbf8ef;
  --ink:#1b1b1b;
  --muted:#6a6a6a;
  --faint:#e7dfd0;
  --line:#bdb5a5;
  --rule:#222222;
  --accent:#2f54b8;
  --accent2:#5b21ff;
  --accentSoft:#eef2ff;
  --green:#18805b;
  --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --sans: "Helvetica Neue", Arial, ui-sans-serif, system-ui, sans-serif;
  --serif: "Times New Roman", Times, Charter, Georgia, serif;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin:0;
  color:var(--ink);
  font-family:var(--serif);
  background:
    linear-gradient(90deg, rgba(47,84,184,.045) 1px, transparent 1px),
    linear-gradient(180deg, rgba(47,84,184,.045) 1px, transparent 1px),
    radial-gradient(circle at 12% 0%, rgba(47,84,184,.06), transparent 30%),
    var(--field);
  background-size: 28px 28px, 28px 28px, auto, auto;
}
body:before {
  content:'';
  position:fixed;
  inset:14px;
  border:1px solid rgba(30,30,30,.16);
  pointer-events:none;
  z-index:20;
}
.shell { max-width: 1260px; margin: 0 auto; padding: 32px 28px 72px; }
.topbar {
  display:grid;
  grid-template-columns: 1fr auto;
  align-items:center;
  gap:20px;
  border:1px solid var(--line);
  background:rgba(255,253,247,.86);
  padding:14px 18px;
  margin-bottom:18px;
}
.brand { display:flex; align-items:center; gap:14px; }
.logo {
  width:38px; height:38px;
  display:grid; place-items:center;
  border:1px solid var(--rule);
  background:var(--paper);
  color:var(--accent);
  font-family:var(--mono);
  font-weight:900;
  font-size:13px;
}
.brand h1 { margin:0; font-family:var(--sans); font-size:22px; letter-spacing:-.035em; }
.brand p { margin:1px 0 0; color:var(--muted); font-family:var(--mono); font-size:10px; letter-spacing:.06em; }
.open-pill {
  border:1px dashed var(--line);
  color:#333;
  background:var(--paper2);
  padding:8px 10px;
  font-family:var(--mono);
  font-size:10px;
  max-width:520px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.workspace {
  display:grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap:22px;
  align-items:start;
}
.sidebar { position:sticky; top:28px; display:grid; gap:14px; font-family:var(--sans); }
.panel {
  background:rgba(255,253,247,.90);
  border:1px solid var(--line);
}
.paper-title { padding:16px; }
.kicker {
  color:var(--accent);
  text-transform:uppercase;
  letter-spacing:.13em;
  font-size:10px;
  font-family:var(--mono);
  font-weight:700;
}
.paper-title h2 {
  margin:9px 0 14px;
  font-family:var(--serif);
  font-size:21px;
  line-height:1.08;
  font-weight:700;
  letter-spacing:-.015em;
}
.meta { display:grid; grid-template-columns:1fr; gap:6px; }
.badge {
  border:1px dashed var(--line);
  padding:6px 8px;
  color:#333;
  font-family:var(--mono);
  font-size:10px;
  background:rgba(251,248,239,.72);
}
.panel-title {
  display:flex;
  align-items:center;
  justify-content:space-between;
  border-bottom:1px solid var(--line);
  padding:10px 12px;
  background:rgba(246,241,230,.86);
}
.panel-title strong { font-size:11px; font-family:var(--mono); text-transform:uppercase; letter-spacing:.08em; }
.hint { color:var(--muted); font-size:10px; font-family:var(--mono); }
.path { list-style:none; padding:10px; margin:0; display:grid; gap:7px; }
.path li {
  display:grid;
  grid-template-columns:24px 1fr;
  align-items:center;
  gap:9px;
  min-height:37px;
  padding:7px 8px;
  border:1px solid rgba(80,80,80,.28);
  background:rgba(255,253,247,.74);
  color:#222;
  font-size:13px;
}
.path .icon {
  width:20px; height:20px;
  display:grid;
  place-items:center;
  border:1px solid var(--line);
  font-family:var(--mono);
  font-weight:800;
  font-size:12px;
  background:var(--paper);
}
.path li.done .icon { background:var(--green); border-color:var(--green); color:white; }
.path li.current {
  border:1.5px solid var(--accent);
  background:var(--accentSoft);
}
.path li.current .icon { background:var(--accent); border-color:var(--accent); color:white; }
.choices { counter-reset: choice; display:grid; gap:7px; padding:10px; }
.choice {
  position:relative;
  border:1px solid rgba(80,80,80,.35);
  background:rgba(255,253,247,.82);
  padding:9px 10px 9px 36px;
  color:#222;
  font-size:12px;
  line-height:1.35;
}
.choice:before {
  counter-increment: choice;
  content:'[' counter(choice) ']';
  position:absolute;
  left:9px;
  top:9px;
  color:var(--accent);
  font-family:var(--mono);
  font-weight:800;
}
.content { min-width:0; }
.session-head {
  position:relative;
  border:1px solid var(--line);
  background:rgba(255,253,247,.94);
  padding:38px 54px 34px;
  margin-bottom:18px;
  overflow:hidden;
}
.session-head:before {
  content:'PaperMentor';
  position:absolute;
  right:24px;
  top:18px;
  border:1px dashed var(--line);
  padding:6px 9px;
  font-family:var(--mono);
  font-size:10px;
  color:var(--muted);
}
.session-head:after {
  content:'';
  position:absolute;
  right:-58px;
  bottom:-72px;
  width:230px;
  height:230px;
  border:1px solid rgba(47,84,184,.20);
  background:
    linear-gradient(90deg, rgba(47,84,184,.07) 1px, transparent 1px),
    linear-gradient(180deg, rgba(47,84,184,.07) 1px, transparent 1px);
  background-size:16px 16px;
  transform:rotate(-8deg);
}
.session-head .kicker { color:var(--accent); }
.session-head h2 {
  position:relative;
  z-index:1;
  max-width:720px;
  margin:18px auto 10px;
  font-family:var(--serif);
  font-size: clamp(34px, 4.3vw, 52px);
  line-height:1.03;
  letter-spacing:-.025em;
  text-align:center;
  font-weight:700;
}
.session-head p {
  position:relative;
  z-index:1;
  margin:0 auto;
  max-width:760px;
  color:#333;
  line-height:1.55;
  font-size:15px;
  text-align:center;
}
.session-meta {
  position:relative;
  z-index:1;
  margin:0 auto;
  max-width:760px;
  display:flex;
  justify-content:center;
  gap:10px;
  flex-wrap:wrap;
  color:var(--muted);
  font-family:var(--mono);
  font-size:10px;
  letter-spacing:.04em;
}
.abstract {
  position:relative;
  z-index:1;
  max-width:720px;
  margin:20px auto 0;
  border-top:1px solid var(--rule);
  padding-top:13px;
  text-align:left;
  font-size:15px;
  line-height:1.55;
}
.abstract strong {
  font-variant:small-caps;
  letter-spacing:.06em;
  font-size:12px;
}
.session-head code {
  background:#f0eadf;
  color:#111;
  padding:1px 5px;
  border:1px solid #d4cab8;
  font-family:var(--mono);
  font-size:.9em;
}
.timeline { display:grid; gap:18px; padding-bottom:20px; }
.block {
  position:relative;
  background:var(--paper);
  color:var(--ink);
  border:1px solid var(--line);
}
.block:before {
  content:attr(data-index);
  position:absolute;
  left:-1px;
  top:-1px;
  width:38px;
  height:34px;
  display:grid;
  place-items:center;
  border-right:1px solid var(--line);
  border-bottom:1px solid var(--line);
  background:#f0eadf;
  color:var(--accent);
  font-family:var(--mono);
  font-weight:800;
  z-index:2;
}
.block:after {
  content:'';
  position:absolute;
  inset:0;
  pointer-events:none;
  background:
    linear-gradient(90deg, rgba(47,84,184,.012) 1px, transparent 1px),
    linear-gradient(180deg, rgba(47,84,184,.012) 1px, transparent 1px);
  background-size:28px 28px;
}
.block-inner { position:relative; z-index:1; padding:34px 54px 42px; max-width:920px; margin:0 auto; }
.block-head {
  display:grid;
  grid-template-columns: 1fr auto;
  gap:16px;
  align-items:start;
  padding-bottom:12px;
  border-bottom:1px solid var(--rule);
  margin-bottom:20px;
}
.block h2 {
  margin:0;
  color:var(--ink);
  font-family:var(--serif);
  font-size:30px;
  line-height:1.05;
  letter-spacing:-.025em;
  font-weight:700;
}
.type-chip {
  border:1px solid var(--line);
  background:#f0eadf;
  color:var(--accent);
  padding:6px 8px;
  font-size:10px;
  white-space:nowrap;
  font-family:var(--mono);
  font-weight:800;
  text-transform:uppercase;
  letter-spacing:.05em;
}
.location { color:var(--muted); font-size:10px; margin-top:7px; font-family:var(--mono); text-transform:uppercase; letter-spacing:.04em; }
.latex {
  border:1px solid var(--line);
  padding:18px;
  background:#f7f1e6;
  overflow-x:auto;
  margin:18px 0 22px;
  font-size:16px;
}
.body {
  color:#1d1d1d;
  line-height:1.58;
  font-size:17px;
  max-width:760px;
  margin:0 auto;
}
.body h1,.body h2,.body h3 {
  color:var(--ink);
  font-family:var(--serif);
  letter-spacing:-.02em;
  line-height:1.12;
  font-weight:700;
}
.body h2 { margin-top:24px; font-size:24px; }
.body h3 { font-size:20px; }
.body code { background:#f0eadf; border:1px solid #d4cab8; padding:1px 5px; color:#111; font-family:var(--mono); font-size:.88em; }
.body p { margin:12px 0; }
.body ul { padding-left:24px; }
.body li { margin:7px 0; }
.empty { padding:30px; color:var(--muted); }
.footer {
  margin-top:24px;
  border:1px dashed var(--line);
  background:rgba(255,253,247,.74);
  padding:10px;
  color:var(--muted);
  font-family:var(--mono);
  font-size:10px;
  text-align:center;
}
@media (max-width: 980px) {
  .workspace { grid-template-columns: 1fr; }
  .sidebar { position:static; }
  .topbar { grid-template-columns:1fr; }
}
@media (max-width: 640px) {
  body:before { inset:10px; }
  .shell { padding:22px 18px 54px; }
  .session-head { padding:34px 22px 28px; }
  .session-head h2 { font-size:34px; }
  .block-inner { padding:58px 24px 30px; }
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
        <h2>${escapeHtml(state.title || 'Paper reading session')}</h2>
        <div class="session-meta">
          <span>${escapeHtml(state.currentLocation || 'Location not set')}</span>
          <span>·</span>
          <span>${escapeHtml(state.currentFocus || 'Focus not set')}</span>
        </div>
        <p class="abstract"><strong>Abstract.</strong> Each Reading Path action appends a new paper block below: map, equation, derivation, dependency, confusion repair, or final insight. This single <code>index.html</code> is rerendered from <code>state.json</code> and <code>cards.json</code>, so the session reads like a living annotated paper.</p>
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
