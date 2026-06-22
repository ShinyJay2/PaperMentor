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
:root { color-scheme: dark; --bg:#07111f; --panel:#0f1b31; --panel2:#111f38; --line:#243550; --text:#e5edf8; --muted:#94a3b8; --blue:#38bdf8; --violet:#a78bfa; --green:#34d399; --amber:#f59e0b; --red:#fb7185; }
* { box-sizing: border-box; }
body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; background: radial-gradient(circle at 82% 0%, rgba(37,99,235,.22), transparent 34%), radial-gradient(circle at 0% 100%, rgba(14,165,233,.18), transparent 32%), var(--bg); color:var(--text); }
.shell { max-width: 1180px; margin: 0 auto; padding: 42px 24px 72px; }
.hero { display:grid; grid-template-columns: 1.2fr .8fr; gap: 28px; align-items: stretch; }
.card, .rail { background: linear-gradient(145deg, rgba(15,27,49,.92), rgba(17,31,56,.82)); border:1px solid rgba(125,211,252,.18); border-radius:28px; box-shadow: 0 24px 80px rgba(0,0,0,.28); }
.card { padding: 30px; }
.rail { padding: 24px; }
h1 { margin:0 0 12px; font-size: clamp(34px, 5vw, 62px); letter-spacing: -.04em; }
.subtitle { color:#bae6fd; font-size:20px; line-height:1.5; margin:0; }
.meta { display:flex; flex-wrap:wrap; gap:10px; margin-top:24px; }
.badge { border:1px solid rgba(148,163,184,.28); border-radius:999px; padding:8px 12px; color:#cbd5e1; font-size:13px; }
.path { list-style:none; padding:0; margin:18px 0 0; display:grid; gap:10px; }
.path li { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:16px; border:1px solid rgba(148,163,184,.16); background:rgba(15,23,42,.42); color:#cbd5e1; }
.path .icon { width:24px; height:24px; display:grid; place-items:center; border-radius:8px; font-weight:900; background:#1e293b; }
.path li.done .icon { background:rgba(52,211,153,.18); color:var(--green); }
.path li.current { border-color:rgba(56,189,248,.55); background:rgba(56,189,248,.10); color:#e0f2fe; }
.path li.current .icon { background:rgba(56,189,248,.2); color:var(--blue); }
.path li.blocked .icon { background:rgba(251,113,133,.18); color:var(--red); }
.choices { counter-reset: choice; display:grid; gap:10px; margin-top:16px; }
.choice { border:1px solid rgba(56,189,248,.22); background:rgba(56,189,248,.08); border-radius:16px; padding:12px 14px; color:#dbeafe; }
.choice:before { counter-increment: choice; content:'[' counter(choice) '] '; color:var(--blue); font-weight:900; }
.cards { display:grid; gap:22px; margin-top:28px; }
.output { padding:26px; }
.output h2 { margin:0 0 8px; font-size:24px; }
.location { color:var(--muted); font-size:13px; margin-bottom:16px; }
.latex { border:1px solid rgba(167,139,250,.25); border-radius:20px; padding:18px; background:rgba(167,139,250,.08); overflow-x:auto; margin:14px 0 18px; }
.body { color:#dbe4ef; line-height:1.68; }
.body h1,.body h2,.body h3 { color:#f8fafc; }
.body code { background:#0f172a; border:1px solid rgba(148,163,184,.2); padding:2px 6px; border-radius:6px; }
.body pre { background:#0f172a; border:1px solid rgba(148,163,184,.2); padding:16px; border-radius:16px; overflow:auto; }
.body li { margin:6px 0; }
.footer { margin-top:28px; color:var(--muted); font-size:13px; }
@media (max-width: 860px) { .hero { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="shell">
  <section class="hero">
    <div class="card">
      <h1>PaperMentor</h1>
      <p class="subtitle">${escapeHtml(state.title || 'Paper reading session')}</p>
      <div class="meta">
        <span class="badge">Location: ${escapeHtml(state.currentLocation || 'not set')}</span>
        <span class="badge">Focus: ${escapeHtml(state.currentFocus || 'not set')}</span>
        <span class="badge">Updated: ${escapeHtml(state.updatedAt || '')}</span>
      </div>
    </div>
    <aside class="rail">
      <strong>Reading Path</strong>
      <ul class="path">
        ${(state.readingPath || []).map((item) => `<li class="${statusClass(item.status)}"><span class="icon">${statusIcon(item.status)}</span><span>${escapeHtml(item.label)}</span></li>`).join('\n')}
      </ul>
      <strong style="display:block;margin-top:22px">Choose next</strong>
      <div class="choices">${(state.nextChoices || []).map((choice) => `<div class="choice">${escapeHtml(choice)}</div>`).join('\n')}</div>
    </aside>
  </section>
  <section class="cards">
    ${(cards.cards || []).slice().reverse().map((card) => `<article class="card output"><h2>${escapeHtml(card.title)}</h2><div class="location">${escapeHtml(card.location)} · ${escapeHtml(card.type)}</div>${card.latex ? `<div class="latex">$$\n${escapeHtml(card.latex)}\n$$</div>` : ''}<div class="body">${markdownToHtml(card.body || '')}</div></article>`).join('\n') || '<article class="card output"><h2>No cards yet</h2><div class="body">Start by adding a paper map or equation card.</div></article>'}
  </section>
  <div class="footer">Single-file dashboard. Data source: state.json and cards.json regenerated into this page by PaperMentor.</div>
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
