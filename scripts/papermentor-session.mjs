#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync, linkSync, rmSync, mkdtempSync, readdirSync, renameSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { basename, dirname, extname, join, resolve, sep, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import readline from 'node:readline';

const root = process.cwd();
const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = dirname(scriptDir);
const bundledAssetsDir = join(skillRoot, 'assets');
const baseDir = join(root, '.papermentor', 'sessions');
const pathItems = [
  ['map', 'Map the paper'],
  ['equations', 'Decode key equations'],
  ['derivations', 'Trace derivations'],
  ['dependencies', 'Connect dependencies'],
  ['confusion', 'Resolve confusion'],
  ['final', 'Extract final insight']
];

const sourceModePathItems = {
  paper: pathItems,
  'slide': [
    ['map', 'Map the slide'],
    ['slides', 'Explain key slides'],
    ['narration', 'Reconstruct missing narration'],
    ['flow', 'Connect slide flow'],
    ['confusion', 'Resolve confusion'],
    ['final', 'Extract final insight']
  ]
};

function normalizeSourceMode(value, fallback = 'paper') {
  const raw = String(value || '').toLowerCase().trim().replace(/_/g, '-');
  if (['paper', 'research-paper', 'article', 'pdf-paper'].includes(raw)) return 'paper';
  if (['slide', 'slides', 'ppt', 'pptx', 'presentation'].includes(raw)) return 'slide';
  if (raw === 'auto' || raw === '') return fallback;
  return fallback;
}

function explicitSourceMode(value, fallback = 'paper') {
  const raw = String(value || '').toLowerCase().trim().replace(/_/g, '-');
  if (!raw || raw === 'auto') return fallback;
  const mode = normalizeSourceMode(raw, '');
  if (mode) return mode;
  throw new Error(`unsupported source mode: ${value}; use --mode paper or --mode slide`);
}

function sourceModeLabel(mode) {
  return { paper: 'Paper', slide: 'Slides' }[normalizeSourceMode(mode)] || 'Paper';
}

function sourceModeNoun(mode) {
  return { paper: 'paper', slide: 'slide' }[normalizeSourceMode(mode)] || 'paper';
}

// Heading for the navigator's first-level list. Slides aren't "sections", so slide
// mode lists "Slides" rather than "<label> sections".
function sectionListHeading(mode) {
  return normalizeSourceMode(mode) === 'slide' ? 'Slides' : `${sourceModeLabel(mode)} sections`;
}

function readingPathForMode(mode) {
  return sourceModePathItems[normalizeSourceMode(mode)] || pathItems;
}

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

function cliCommand() {
  return process.env.PAPERMENTOR_CLI || 'papermentor';
}

function slugify(value) {
  return String(value || 'paper-session')
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'paper-session';
}

function validateSlug(value) {
  const slug = String(value || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) {
    throw new Error(`invalid session slug: ${slug || '(empty)'}; use lowercase letters, numbers, and hyphens only`);
  }
  return slug;
}

function safeSessionPath(slug, ...parts) {
  const safeSlug = validateSlug(slug);
  const base = resolve(baseDir);
  const target = resolve(join(base, safeSlug, ...parts));
  if (target !== join(base, safeSlug) && !target.startsWith(`${join(base, safeSlug)}${sep}`)) {
    throw new Error('resolved session path escaped the PaperMentor session directory');
  }
  return target;
}


function now() { return new Date().toISOString(); }

function sessionDir(slug) { return safeSessionPath(slug); }
function statePath(slug) { return safeSessionPath(slug, 'state.json'); }
function cardsPath(slug) { return safeSessionPath(slug, 'cards.json'); }
function notesPath(slug) { return safeSessionPath(slug, 'notes.md'); }
function turnsPath(slug) { return safeSessionPath(slug, 'turns.jsonl'); }
function indexPath(slug) { return safeSessionPath(slug, 'index.html'); }
function assetDir(slug) { return safeSessionPath(slug, 'assets'); }
function promptPath(slug) { return safeSessionPath(slug, 'pending-prompt.md'); }
function sourceCacheDir() { return join(root, '.papermentor', 'sources'); }
function papermentorDir() { return join(root, '.papermentor'); }
function recentPath() { return join(papermentorDir(), 'recent.json'); }

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function loadRecentSessions() {
  const raw = readJson(recentPath(), { sessions: [] });
  const sessions = Array.isArray(raw) ? raw : raw.sessions || [];
  const valid = sessions.filter((item) => item?.slug && existsSync(statePath(item.slug)));
  if (valid.length) return valid;
  if (!existsSync(baseDir)) return [];
  return readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readJson(statePath(entry.name), null))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, 20)
    .map((state) => ({
      slug: state.slug,
      title: state.title || state.slug,
      sourceMode: state.sourceMode || 'paper',
      html: `.papermentor/sessions/${state.slug}/index.html`,
      currentSection: state.currentSection || '',
      currentFocus: state.currentFocus || '',
      updatedAt: state.updatedAt || state.createdAt || ''
    }));
}

function touchRecentSession(state = {}) {
  if (!state.slug) return;
  mkdirSync(papermentorDir(), { recursive: true });
  const sessions = loadRecentSessions().filter((item) => item.slug !== state.slug);
  sessions.unshift({
    slug: state.slug,
    title: state.title || state.slug,
    sourceMode: state.sourceMode || 'paper',
    html: `.papermentor/sessions/${state.slug}/index.html`,
    currentSection: state.currentSection || '',
    currentFocus: state.currentFocus || '',
    updatedAt: now()
  });
  writeJson(recentPath(), { schema: 'papermentor.recent.v1', sessions: sessions.slice(0, 20) });
}

function latestSessionSlug() {
  return loadRecentSessions()[0]?.slug || '';
}


function argsModeFromSource(source) {
  const value = String(source || '').toLowerCase();
  if (/\.(pptx?|key)(\?|#|$)/.test(value) || /slide|presentation/.test(value)) return 'slide';
  return 'paper';
}

function defaultState({ title, authors = '', source, slug, sections = [], sourceMode = 'paper' }) {
  return {
    schema: 'papermentor.session.v1',
    title,
    authors,
    source,
    slug,
    sourceMode: normalizeSourceMode(sourceMode),
    createdAt: now(),
    updatedAt: now(),
    currentLocation: `${sourceModeLabel(sourceMode)} map`,
    currentFocus: `Open the HTML reading room first, then choose a ${sourceModeNoun(sourceMode)} section.`,
    readingPath: readingPathForMode(sourceMode).map(([key, label], index) => ({ key, label, status: index === 0 ? 'current' : 'pending' })),
    paperSections: sections,
    currentSection: '',
    currentMode: '',
    detectedItems: [],
    nextChoices: sections.length ? sections : [
      'Open the HTML reading room',
      `Detect ${sourceModeNoun(sourceMode)} sections`,
      `Ask a ${sourceModeNoun(sourceMode)} question`
    ],
    renderedView: `.papermentor/sessions/${slug}/index.html`
  };
}

function ensureSession({ title, authors = '', source, slug, sections = [], sourceMode }) {
  const dir = sessionDir(slug);
  mkdirSync(dir, { recursive: true });
  const state = existsSync(statePath(slug))
    ? readJson(statePath(slug), {})
    : defaultState({ title, authors, source, slug, sections, sourceMode: sourceMode || argsModeFromSource(source) });
  state.updatedAt = now();
  state.title = title || state.title;
  state.source = source || state.source;
  if (authors !== undefined) state.authors = authors || state.authors || '';
  const normalizedMode = normalizeSourceMode(sourceMode || argsModeFromSource(source) || state.sourceMode, state.sourceMode || 'paper');
  const modeChanged = state.sourceMode && normalizedMode !== state.sourceMode;
  state.sourceMode = normalizedMode;
  if (modeChanged || !Array.isArray(state.readingPath)) {
    state.readingPath = readingPathForMode(normalizedMode).map(([key, label], index) => ({ key, label, status: index === 0 ? 'current' : 'pending' }));
  }
  state.renderedView = `.papermentor/sessions/${slug}/index.html`;
  if (sections.length) {
    state.paperSections = sections;
    if (!state.currentSection) state.nextChoices = sections;
  }
  const cards = readJson(cardsPath(slug), { schema: 'papermentor.cards.v1', cards: [] });
  writeJson(statePath(slug), state);
  writeJson(cardsPath(slug), cards);
  if (!existsSync(notesPath(slug))) {
    writeFileSync(notesPath(slug), `# PaperMentor session: ${state.title}\n\nSource: ${state.source || 'not provided'}\n\n`);
  }
  if (!existsSync(turnsPath(slug))) {
    writeFileSync(turnsPath(slug), '');
  }
  renderHtml(slug);
  touchRecentSession(state);
  return { state, cards };
}

function setPathStatus(state, key, status) {
  state.readingPath = state.readingPath.map((item) => {
    if (item.key === key) return { ...item, status };
    if (status === 'current' && item.status === 'current') return { ...item, status: 'done' };
    return item;
  });
}

function inferPathKey(type, state = {}) {
  const normalizedType = String(type || '').toLowerCase();
  const sourceMode = normalizeSourceMode(state.sourceMode || 'paper');
  const shared = {
    'paper-map': 'map', scan: 'map', method: 'map', 'start-here': 'map',
    derivation: 'derivations', 'derivation-trace': 'derivations',
    confusion: 'confusion', why: 'confusion', 'recursive-why': 'confusion', visualization: 'confusion', visualize: 'confusion', diagram: 'confusion', 'concept-diagram': 'confusion',
    final: 'final', 'final-insight': 'final'
  };
  const byMode = {
    paper: {
      prerequisite: 'map', prerequisites: 'map', 'prerequisite-ladder': 'map',
      equation: 'equations', 'equation-card': 'equations',
      dependency: 'dependencies', dependencies: 'dependencies', proof: 'dependencies', 'proof-walkthrough': 'dependencies'
    },
    'slide': {
      'slide-explanation': 'slides', slide: 'slides',
      equation: 'slides', 'equation-card': 'slides',
      narration: 'narration', 'missing-narration': 'narration',
      transition: 'flow', 'slide-transition': 'flow', dependency: 'flow', dependencies: 'flow'
    }
  };
  return byMode[sourceMode]?.[normalizedType] || shared[normalizedType] || null;
}

function readBody(args) {
  if (args['body-file']) return readFileSync(resolve(args['body-file']), 'utf8');
  if (args.body) return args.body;
  return '';
}

function readTextArg(args) {
  if (args['text-file']) return readFileSync(resolve(args['text-file']), 'utf8');
  if (args.text) return String(args.text);
  if (args.body) return String(args.body);
  if (args['body-file']) return readFileSync(resolve(args['body-file']), 'utf8');
  return '';
}

function turnId(index) {
  return `turn-${String(index).padStart(3, '0')}`;
}

function readTurns(slug) {
  if (!existsSync(turnsPath(slug))) return [];
  return readFileSync(turnsPath(slug), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function appendTurn(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('turn requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const turns = readTurns(slug);
  const promotion = args.promote ? 'promote' : args['no-promote'] ? 'log-only' : (args.promotion || 'auto');
  const turn = {
    id: args.id || turnId(turns.length + 1),
    role: args.role || 'user',
    text: readTextArg(args),
    location: args.location || state.currentLocation,
    promotion,
    reason: args.reason || '',
    savedAs: args['saved-as'] || args.savedAs || '',
    createdAt: now()
  };
  appendFileSync(turnsPath(slug), `${JSON.stringify(turn)}\n`);
  if (turn.role === 'user' && isVisualRepairRequest(turn.text)) {
    const diagramChoices = [
      `Generate conceptual diagram for ${state.currentSection || state.currentLocation || state.title}`,
      'Map equation dependencies visually',
      'Draw method / concept flow',
      'Continue with text explanation only'
    ];
    state.nextChoices = unique([...(state.nextChoices || []), ...diagramChoices]).slice(0, 12);
    state.currentFocus = 'Visual repair suggested from user confusion';
  }
  state.updatedAt = now();
  writeJson(statePath(slug), state);
  if (!args.quiet) console.log(`Logged ${turn.id} (${turn.role}, ${turn.promotion}) to .papermentor/sessions/${slug}/turns.jsonl`);
}

function hasForbiddenDiagramSubstitute(markdown) {
  return /```\s*mermaid\b/i.test(markdown)
    || /^\s*(graph|flowchart)\s+(TD|TB|BT|RL|LR)\b/im.test(markdown)
    || /<div[^>]+class=["'][^"']*mermaid/i.test(markdown);
}

function splitChoices(value) {
  if (!value || value === true) return [];
  return String(value).split('|').map((x) => x.trim()).filter(Boolean);
}


function isUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function parseHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function assertSafeRemoteUrl(value, { label = 'URL', allowHttp = false } = {}) {
  const url = parseHttpUrl(value);
  if (!url) throw new Error(`${label} must be an http(s) URL`);
  if (url.protocol === 'http:' && !allowHttp) {
    throw new Error(`${label} must use https; pass --allow-insecure-http only for trusted local/test sources`);
  }
  return url.href;
}

function safeMarkdownHref(value) {
  const url = parseHttpUrl(String(value || '').replace(/&amp;/g, '&'));
  return url ? url.href : '';
}

function sourceExtensionFromUrl(value) {
  const clean = String(value || '').split(/[?#]/)[0];
  if (/arxiv\.org\/abs\//i.test(clean) || /arxiv\.org\/pdf\//i.test(clean)) return '.pdf';
  if (/docs\.google\.com\/(?:presentation|document)\/d\//i.test(clean)) return '.pdf';
  if (/drive\.google\.com\/(?:file\/d\/|open\b|uc\b)/i.test(clean)) return '.pdf';
  const extension = extname(clean).toLowerCase();
  if (extension) return extension;
  return '.pdf';
}

function googleDriveDirectUrl(value) {
  const raw = String(value || '');
  if (!/^https?:\/\//i.test(raw)) return raw;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  if (host === 'drive.google.com' || host.endsWith('.drive.google.com')) {
    const fileId = path.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get('id');
    if (fileId) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  }
  if (host === 'docs.google.com' || host.endsWith('.docs.google.com')) {
    const presentationId = path.match(/\/presentation\/d\/([^/]+)/)?.[1];
    if (presentationId) return `https://docs.google.com/presentation/d/${encodeURIComponent(presentationId)}/export/pdf`;
    const documentId = path.match(/\/document\/d\/([^/]+)/)?.[1];
    if (documentId) return `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/export?format=pdf`;
  }
  return raw;
}

function normalizePaperUrl(value) {
  const raw = String(value || '');
  return googleDriveDirectUrl(raw).replace(/https:\/\/arxiv\.org\/abs\/([^?#]+)/i, 'https://arxiv.org/pdf/$1');
}

function sourceCacheFile(url, slugHint = 'source') {
  const extension = sourceExtensionFromUrl(url);
  const key = createHash('sha256').update(url).digest('hex').slice(0, 12);
  const stem = slugify(slugHint || basename(url, extension)) || 'paper';
  return join(sourceCacheDir(), `${stem}-${key}${extension}`);
}

function readFileProbe(path, { headBytes = 4096, tailBytes = 1048576 } = {}) {
  const { size } = statSync(path);
  const fd = openSync(path, 'r');
  try {
    const head = Buffer.alloc(Math.min(headBytes, size));
    readSync(fd, head, 0, head.length, 0);
    if (size <= head.length) return head;
    const tailLength = Math.min(tailBytes, Math.max(0, size - head.length));
    const tail = Buffer.alloc(tailLength);
    readSync(fd, tail, 0, tail.length, Math.max(0, size - tail.length));
    return Buffer.concat([head, tail]);
  } finally {
    closeSync(fd);
  }
}

function detectSourceExtensionFromBytes(path) {
  const probe = readFileProbe(path);
  const head = probe.subarray(0, 4096);
  const textHead = head.toString('utf8').trimStart();
  if (head.subarray(0, 4).toString() === '%PDF') return '.pdf';
  if (head.length >= 8 && head[0] === 0x89 && head.subarray(1, 4).toString() === 'PNG') return '.png';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return '.jpg';
  if (head.subarray(0, 6).toString() === 'GIF87a' || head.subarray(0, 6).toString() === 'GIF89a') return '.gif';
  if (head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP') return '.webp';
  if (head.length >= 8 && head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return '.ppt';
  if (head.subarray(0, 2).toString() === 'PK') {
    const zipText = probe.toString('latin1');
    if (zipText.includes('ppt/presentation.xml')) return '.pptx';
    if (zipText.includes('word/document.xml')) return '.docx';
  }
  if (/^(?:<!doctype\s+html|<html\b)/i.test(textHead)) return '.html';
  return '';
}

function cachedSourceVariant(path) {
  if (existsSync(path)) return path;
  const extension = extname(path);
  const stem = extension ? path.slice(0, -extension.length) : path;
  for (const candidateExtension of ['.pdf', '.pptx', '.ppt', '.png', '.jpg', '.jpeg', '.webp', '.gif']) {
    const candidate = `${stem}${candidateExtension}`;
    if (existsSync(candidate)) return candidate;
  }
  return '';
}

function finalizeDownloadedSourceFile(path, url) {
  const detectedExtension = detectSourceExtensionFromBytes(path);
  if (detectedExtension === '.html') {
    throw new Error(`downloaded ${url} as HTML, not a paper/slide file; for Google Drive, make sure the file is shared with link access or use a direct PDF/PPTX download`);
  }
  if (!detectedExtension) return path;
  const currentExtension = extname(path).toLowerCase();
  if (detectedExtension === currentExtension) return path;
  const target = `${path.slice(0, currentExtension ? -currentExtension.length : undefined)}${detectedExtension}`;
  if (existsSync(target)) {
    rmSync(path, { force: true });
    return target;
  }
  renameSync(path, target);
  return target;
}

function downloadSourceIfNeeded(source, slugHint = 'source', args = {}) {
  if (!isHttpUrl(source)) return resolve(source);
  const curl = commandPath('curl');
  if (!curl) throw new Error('launching from a URL requires `curl` on PATH');
  const allowInsecureHttp = Boolean(args['allow-insecure-http']);
  const url = assertSafeRemoteUrl(normalizePaperUrl(source), { label: 'source URL', allowHttp: allowInsecureHttp });
  mkdirSync(sourceCacheDir(), { recursive: true });
  const out = sourceCacheFile(url, slugHint);
  const cached = cachedSourceVariant(out);
  if (cached) return finalizeDownloadedSourceFile(cached, url);
  const allowedProtocols = allowInsecureHttp ? '=http,https' : '=https';
  try {
    runTool(curl, [
      '-L',
      '--fail',
      '--silent',
      '--show-error',
      '--proto',
      allowedProtocols,
      '--proto-redir',
      allowedProtocols,
      '--connect-timeout',
      '15',
      '--max-time',
      '120',
      '--max-filesize',
      String(Number(process.env.PAPERMENTOR_MAX_SOURCE_BYTES || 209715200)),
      url,
      '-o',
      out
    ], `could not download ${url}`);
  } catch (error) {
    rmSync(out, { force: true });
    throw error;
  }
  return finalizeDownloadedSourceFile(out, url);
}

function extractTextFromSourceFile(source, args = {}) {
  const absolute = resolve(source);
  const extension = extname(absolute).toLowerCase();
  if (['.txt', '.md', '.tex'].includes(extension)) return readFileSync(absolute, 'utf8');
  const pdftotext = commandPath('pdftotext');
  if (!pdftotext) {
    if (['.pdf', '.ppt', '.pptx', '.key'].includes(extension)) throw new Error('text extraction requires `pdftotext` (Poppler) on PATH');
    return '';
  }
  const firstOnly = Boolean(args.firstPage || args['first-page']);
  const baseArgs = args.raw ? [] : ['-layout'];
  if (firstOnly) baseArgs.push('-f', '1', '-l', '1');
  if (extension === '.pdf') {
    return execFileSync(pdftotext, [...baseArgs, absolute, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  }
  if (['.ppt', '.pptx', '.key'].includes(extension)) {
    mkdirSync(sourceCacheDir(), { recursive: true });
    const tempDir = mkdtempSync(join(sourceCacheDir(), 'text-extract-tmp-'));
    try {
      mkdirSync(tempDir, { recursive: true });
      const pdf = convertPptToPdf(absolute, tempDir);
      return execFileSync(pdftotext, [...baseArgs, pdf, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
  return '';
}

function cleanMetadataLine(line) {
  return String(line || '')
    .replace(/\s+/g, ' ')
    .replace(/\b(arXiv:\S+|v\d+|\[[^\]]+\])\b/g, '')
    .trim();
}

function cleanTitleCandidate(value) {
  return String(value || '')
    .replace(/\.[A-Za-z0-9]{2,5}$/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function isSlideBoilerplateLine(line) {
  const value = String(line || '').trim();
  if (!value) return true;
  if (/^\d{1,3}\s*(?:\/\s*\d{1,3})?$/.test(value)) return true;
  if (/^(?:slide|page)\s*\d{1,3}\b\s*$/i.test(value)) return true;
  if (/(?:©|copyright|all rights reserved|rights reserved|confidential|proprietary|do not distribute)/i.test(value)) return true;
  if (/@|https?:\/\/|www\./i.test(value)) return true;
  if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(value)) return true;
  if (/^(?:presented by|presenter|author|instructor|professor|department|university|school of|college of)\b/i.test(value)) return true;
  return false;
}

function isBadMetadataTitle(value) {
  const title = String(value || '').trim();
  if (!title) return true;
  if (isSlideBoilerplateLine(title)) return true;
  if (/^(?:lecture|lec\.?)\s*\d{1,3}$/i.test(title)) return false;
  if (/^[a-z][a-z.'-]+\s+[a-z][a-z.'-]+$/.test(title)) return true;
  return false;
}

function titleFromSourceName(source) {
  const clean = String(source || '').split(/[?#]/)[0];
  const base = basename(clean, extname(clean));
  return cleanTitleCandidate(decodeURIComponent(base || ''));
}

function inferSlideTitleFromText(text) {
  const firstPage = String(text || '').replace(/\r/g, '').split('\f')[0] || '';
  const lines = firstPage.split(/\n/)
    .map(cleanMetadataLine)
    .filter(Boolean)
    .slice(0, 40);
  const candidates = [];
  lines.slice(0, 8).forEach((line, index) => {
    for (const span of [2, 3]) {
      const chunk = lines.slice(index, index + span);
      if (chunk.length !== span) continue;
      if (chunk.some((part) => part.length > 45 || /^(?:https?:\/\/|www\.)/i.test(part) || /^[•▪◦-]\s/.test(part))) continue;
      const combined = cleanTitleCandidate(chunk.join(' ').replace(/\s*[-–—]\s*/g, ' - '));
      if (!combined || combined.length < 6 || combined.length > 120 || isBadMetadataTitle(combined)) continue;
      const hasHangul = /[가-힣]/.test(combined);
      if (!hasHangul) continue;
      candidates.push({
        value: combined,
        score: 32 - index * 0.4 + (/[—–-]\s*[^—–-]+/.test(combined) ? 5 : 0)
      });
    }
  });
  lines.forEach((line, index) => {
    const parts = unique([line, ...line.split(/\s{2,}/)]).map(cleanTitleCandidate).filter(Boolean);
    for (const part of parts) {
      const value = part.replace(/^(?:slide|page)\s*\d{1,3}\s*[:.\-–—]?\s*/i, '').trim();
      if (isBadMetadataTitle(value)) continue;
      if (value.length < 3 || value.length > 110) continue;
      if (/^[•▪◦-]/.test(value)) continue;
      if (/[.!?。]$/.test(value) && value.split(/\s+/).length > 8) continue;
      const words = value.split(/\s+/).filter(Boolean);
      let score = 20 - index * 0.35;
      if (/\b[A-Z]{2,}\b/.test(value)) score += 5;
      if (/^(?:lecture|lec\.?)\s*\d{1,3}\s*:/i.test(value)) score += 8;
      if (/:\s*\S/.test(value) && words.length >= 4) score += 4;
      if (/^[A-Z0-9][A-Za-z0-9:()[\]/+&,\- ]+$/.test(value)) score += 3;
      if (words.length <= 8) score += 2;
      if (words.length <= 2 && index > 0) score -= 5;
      if (lines.slice(0, index).some((earlier) => earlier.includes(value) && earlier.length > value.length + 8)) score -= 10;
      if (/^(?:lecture|lec\.?)\s*\d{1,3}\b/i.test(value)) score -= 3;
      candidates.push({ value, score });
    }
  });
  candidates.sort((a, b) => b.score - a.score || a.value.length - b.value.length);
  return candidates[0]?.value || '';
}

function formatAuthors(value) {
  const cleaned = String(value || '')
    .replace(/\s+\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.includes(',')) return cleaned;
  const tokens = cleaned.split(/\s+/);
  if (tokens.length >= 4 && tokens.length % 2 === 0 && tokens.every((token) => /^[A-Z][A-Za-z.'-]+$/.test(token))) {
    const names = [];
    for (let i = 0; i < tokens.length; i += 2) names.push(`${tokens[i]} ${tokens[i + 1]}`);
    return names.join(', ');
  }
  return cleaned;
}

function looksLikeAuthorLine(line) {
  const value = String(line || '').trim();
  if (!value || /@|http|www\.|abstract|figure|fig\.|keywords?/i.test(value)) return false;
  if (/\b(university|institute|department|laborator(?:y|ies)|research\s+(?:lab|labs|center|centre|institute|group)|meta ai|fair|mila|mcgill)\b/i.test(value)) return false;
  const withoutMarks = value.replace(/\d|[*†‡§,]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = withoutMarks.split(/\s+/).filter(Boolean);
  if (tokens.length === 2 && tokens.every((token) => /^[A-Z][A-Za-z.'-]+$/.test(token))) return true;
  return tokens.length >= 4
    && tokens.length <= 24
    && tokens.filter((token) => /^[A-Z][A-Za-z.'-]+$/.test(token)).length >= Math.min(tokens.length, 8);
}

function looksLikeTitleContinuation(line) {
  const value = String(line || '').trim();
  if (value.length < 8 || value.length > 120) return false;
  if (/^(abstract|figure|fig\.|table|keywords?|introduction|related work|methods?)\b/i.test(value)) return false;
  if (/@|http|www\.|university|institute|department/i.test(value)) return false;
  if (looksLikeAuthorLine(value)) return false;
  return /[A-Za-z]/.test(value) && !/[.!?]$/.test(value);
}

function inferMetadataFromText(text, args = {}) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(cleanMetadataLine)
    .filter(Boolean)
    .filter((line) => !/^(\d+|abstract|figure\s+\d+|fig\.\s*\d+|table\s+\d+|keywords?|project page:?|conference|preprint)$/i.test(line))
    .filter((line) => !/^\d{1,2}\s+[A-Z][a-z]+\s+\d{4}$/.test(line));
  let title = args.title || '';
  let titleIndex = -1;
  if (!title) {
    titleIndex = lines.findIndex((line) => line.length >= 8 && line.length <= 140 && !/@/.test(line) && !looksLikeAuthorLine(line));
    title = titleIndex >= 0 ? lines[titleIndex] : '';
    if (titleIndex >= 0 && looksLikeTitleContinuation(lines[titleIndex + 1])) {
      title = `${title} ${lines[titleIndex + 1]}`.replace(/\s+/g, ' ').trim();
    }
  } else {
    titleIndex = lines.findIndex((line) => line === title);
  }
  const afterTitle = titleIndex >= 0 ? lines.slice(titleIndex + 1, titleIndex + 7) : lines.slice(1, 7);
  const authors = args.authors || args.author || afterTitle.find((line) => {
    if (/^(abstract|figure|fig\.|introduction|project page|keywords?)/i.test(line)) return false;
    if (/@|http|www\.|university|institute|department/i.test(line)) return false;
    return looksLikeAuthorLine(line) || line.includes(',');
  }) || '';
  return { title, authors: formatAuthors(authors) };
}



function representativeFigureExplanation({ sourceMode, text }) {
  const mode = normalizeSourceMode(sourceMode);
  // This is a deterministic scaffold, not a real reading: the launch script cannot
  // see the cropped image. Every bullet is an instruction to be replaced by what is
  // literally drawn in the figure crop above. It must never read as a finished,
  // generic "follow the arrows with your eyes" explanation.
  if (mode === 'slide') {
    return [
      '## Representative figure explanation',
      '',
      '_Not read yet. Open the slide crop above and replace every bullet with what is literally on the slide — each box, arrow, label, axis, and any equation printed on it, symbol by symbol. Delete this note once filled._',
      '',
      '- **Concept / method role:** Name what this exact slide visual is (architecture, pipeline, result, or mechanism) and the one thing the speaker wants remembered — in these slides’ own terms, not a generic description.',
      '- **How to read it:** Name every labelled box/object on the slide and say in one clause what each one is.',
      '- **Parts to identify:** List every arrow, line, shape, color, axis, legend, and callout, and state what each encodes — be exhaustive, not a sample.',
      '- **In-figure math / symbols:** Transcribe in LaTeX every equation, variable, subscript, and annotation printed inside the slide visual, and define each symbol; if none appear, say so explicitly.',
      '- **Flow / sequence:** Walk the arrows in order — for each arrow name the quantity it carries and for each box the operation it applies — and end at the slide’s conclusion. Do not write “follow the arrows” or “left to right”.',
      '- **What to observe:** Name the specific object or contrast this slide encodes, tied to a named element.',
      '- **Equations / claims it supports:** Map these elements to the slide’s equations and the claim it carries into the next slide.'
    ].join('\n');
  }
  return [
    '## Representative figure explanation',
    '',
    '_Not read yet. Open the figure crop above and replace every bullet with what is literally drawn — every box, arrow, line, shape, label, and any equation rendered inside the figure, symbol by symbol. Delete this note once filled._',
    '',
    '- **Concept / method role:** Name what this exact figure is — architecture, pipeline, algorithm, or mechanism — and the single transformation it makes possible, in this paper’s own terms. No generic boilerplate.',
    '- **How to read it:** Name every labelled box/module/object drawn in the crop and say in one clause what each one represents (a component glossary, not reading advice).',
    '- **Parts to identify:** List every arrow, line, shape, color, plate/loop, brace, axis, and legend, and state what each encodes — be exhaustive, not a sample.',
    '- **In-figure math / symbols:** Transcribe in LaTeX every equation, variable, subscript, and annotation printed inside the figure, and define each symbol; if none appear, say so explicitly.',
    '- **Flow / sequence:** Walk the arrows in execution order — for each arrow name the quantity/tensor it carries and for each box the transformation it applies — ending at the output or loss. Do not write “follow the arrows” or “left to right”.',
    '- **What to observe:** Name the specific design choice or contrast this figure encodes (e.g. prediction in representation space vs pixel space), tied to a named element.',
    '- **Equations / claims it supports:** Map these elements to the numbered equations and claims in the paper body.'
  ].join('\n');
}

function appendFigureFallbackNote(body, reason) {
  const text = String(body || '');
  if (/No representative figure attached|could not auto-attach|no figure|not present/i.test(text)) return text;
  const note = [
    '## Representative figure',
    '',
    `No representative figure attached: ${reason}`,
    '',
    'Use the crop preview to attach a real method/system figure if the source has one. Do not treat a full page, result plot, or placeholder as the representative method figure.'
  ].join('\n');
  if (/##\s+Representative figure explanation/i.test(text)) {
    return text.replace(/##\s+Representative figure explanation[\s\S]*?(?=\n##\s+Preliminary|\n##\s+Topic timeline map|$)/i, `${note}\n`);
  }
  return `${text.trim()}\n\n${note}\n`;
}

function hasBalancedDelimiters(value) {
  const text = String(value || '');
  const pairs = { '{': '}', '[': ']', '(': ')' };
  const stack = [];
  for (const char of text) {
    if (pairs[char]) stack.push(pairs[char]);
    else if (Object.values(pairs).includes(char)) {
      if (stack.pop() !== char) return false;
    }
  }
  return stack.length === 0;
}

function looksLikeBrokenPdfMath(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  if (!hasBalancedDelimiters(text)) return true;
  if (/[{}\\]/.test(text) && /\s(?:is defined by|maps to)\s/i.test(text)) return true;
  if (/(?:^|[^\w])(?:left|right|sum|lVert|rVert|vs|hat)\b/.test(text) && !/^\\/.test(text)) return true;
  if (/\b[a-z]\s+is defined by\s+\d+}/i.test(text)) return true;
  if ((text.match(/[{}]/g) || []).length > 4 && !/^\\(?:mathbb|mathcal|operatorname|mathrm)\{[^}]+\}$/.test(text)) return true;
  return false;
}

function cleanNotationCandidate(value) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .trim();
  if (!text || text.length > 64 || looksLikeBrokenPdfMath(text)) return '';
  if (/_\{[^}]*=/.test(text)) return '';
  return text;
}


function slideTopicTimelineScaffold(sections = []) {
  const topics = sections.length ? sections : ['Slides 1–? — Topic to detect'];
  const flowTopics = topics
    .slice(0, 14)
    .map((section) => {
      const { topic } = slideTitleParts(section);
      return topic || section;
    });
  const flow = flowTopics.length
    ? `flow: ${flowTopics.join(' → ')}${topics.length > flowTopics.length ? ' → …' : ''}`
    : 'flow: Topic 1 → Topic 2 → Topic 3';
  const topicBlocks = topics.slice(0, 24).map((section, index) => `### ${index + 1}. ${section}

_Not written yet. Replace this placeholder with one natural teaching paragraph: explain what changes at this point, why the learner needs it before the next topic, and which concrete slide element should be read first. Do not keep this instruction or convert it into labeled fields._`).join('\n\n');
  return `## Topic timeline map

${flow}

${topicBlocks}

## Slide reading contract

Use this timeline as the Start Here map. Read each topic as a temporal build: earlier topics define the vocabulary, repeated-title slides are progressive overlays, and the main work is to reconstruct the lecturer's missing narration between topics.`;
}

function slideStartHereWriterPrompt({ state, sections = [] }) {
  const topics = sections.length ? sections : ['No slide topics detected yet'];
  const command = `${cliCommand()} card --session ${shellQuote(state.slug)} --type start-here --title 'Start Here' --location 'Start Here' --body-file <your-markdown-file> --choices ${shellQuote(topics.join('|'))}`;
  const regroupCommand = `${cliCommand()} sections --session ${shellQuote(state.slug)} --mode slide --sections "<topic A>|<topic B>|<topic C>"`;
  return `# PaperMentor Slide Start Here Writer Prompt

You are writing the first real teaching block for a slide-based PaperMentor reading room.

Append the finished Markdown to HTML with:

\`${command}\`

## Source

- Title: ${state.title}
- Mode: Slides
- Detected slide topics:
${topics.map((topic, index) => `  ${index + 1}. ${topic}`).join('\n')}

## Topic grouping responsibility

The script only performs structural extraction and repeated-title/build folding. It must not decide semantic topic boundaries with hard-coded words.

Before writing the final Start Here body, read the detected topics as a teacher and decide the learner-facing topic timeline yourself. If the extracted topic list is too fragmented or wrongly grouped, first replace the navigator topics with your own semantic grouping:

\`${regroupCommand}\`

Use your grouped topics in the \`--sections\` value, separated by \`|\`. Group by teaching dependency and conceptual phase, not by matching title keywords. After regrouping, write the Start Here body and append it with the card command above.

## What to write

Write a finished Start Here explanation, not a scaffold and not a planning table.

Use this shape:

1. \`## One-sentence orientation\`
   - Exactly one natural sentence stating what these slides teach.
   - Do not say “this presentation”.
   - Do not forecast later material unless it is explicitly present in these slides.

2. \`## Topic timeline map\`
   - Include one \`flow:\` line that groups the major learning phases.
   - Then write 4–8 natural teaching paragraphs under \`###\` headings.
   - Each paragraph should explain what changes at that point, why the learner needs it before the next point, and which concrete slide object/example/diagram/equation to read first.
   - Write as a tutor speaking to a reader, not as metadata about slides.

3. \`## Preliminary\`
   - Build the prerequisite ladder needed to read these slides, using the same depth expected in paper mode.
   - Read the detected slide topics and any visible formulas/notation before choosing prerequisites.
   - Do not list broad labels like “probability”, “linear algebra”, “optimization”, “Markov decision processes”, or “reinforcement learning basics” unless you decompose them into the exact smaller ideas these slides require.
   - Start with a \`flow:\` line in dependency order. Use phase groups when helpful, e.g. \`flow: [interaction] agent → action → observation → reward || [math] random variable → expectation → return\`.
   - Then write natural \`### N. concept\` blocks. Each block must teach the concept from first principles, give a tiny concrete example, and name the exact slide symbol, equation, diagram, or claim it unlocks.
   - If the slides use mathematical notation, include the relevant LaTeX in the prerequisite block and define every symbol. For example, if a slide uses reward $R_t$, return $G_t$, policy $\\pi(a\\mid s)$, value $v_\\pi(s)$, transition probability $P(s'\\mid s,a)$, or an expectation $\\mathbb{E}[\\cdot]$, teach the minimum math needed to read that notation before using it.
   - Use equations when they genuinely clarify the slide content. A good block may include a tiny numeric example such as $G_1=1+0.9\\cdot2+0.9^2\\cdot3=5.23$, or $\\mathbb{E}[X]=0.7\\cdot10+0.3\\cdot0=7$.
   - Keep the final prose smooth: do not render field labels like “Why needed”, “Minimal explanation”, or “Diagnostic check” as headings. Those are internal checks only.

## Hard prohibitions

- Do not output placeholder text such as “Not written yet”.
- Do not leave internal labels or rubric fields in the final HTML body.
- Do not use these field names: “Topic role”, “Build slides folded”, “Likely missing narration”, “Key visual/equation to read”.
- Do not write tables for the timeline.
- Do not use internal tooling labels in the final user-facing prose; say “slides”, “lecture slides”, or “강의자료” when needed.
- Do not invent next-lecture claims or prerequisite targets that are not visible in the source.
- Do not summarize slide titles mechanically; teach the conceptual path.
`;
}

function writeSlideStartHerePrompt(state, sections = []) {
  const prompt = slideStartHereWriterPrompt({ state, sections });
  writeFileSync(promptPath(state.slug), prompt);
  state.pendingBlockPrompt = `.papermentor/sessions/${state.slug}/pending-prompt.md`;
  state.pendingBlockType = 'start-here';
  state.pendingBlockTitle = 'Start Here';
  state.startHerePending = true;
  delete state.figureReadingPending;
  return prompt;
}

function launchStartBody({ sourceMode, text, sections = [] }) {
  const noun = sourceModeNoun(sourceMode);
  if (normalizeSourceMode(sourceMode) === 'slide') {
    return `## One-sentence orientation

_Not written yet. Replace this with exactly one sentence stating what these slides teach or argue: name the topic, the learner's before/after state, and the central mechanism or timeline._

${slideTopicTimelineScaffold(sections)}

${preliminaryLadderScaffold(sourceMode)}
`;
  }
  // Launch ships only scaffolds. Every source-derived explanation below — the
  // one-sentence model, the figure reading, and the preliminary ladder — must be
  // written by the model after reading the source. The script never synthesises this
  // content from the text; that is exactly the work the prompt/skill owns.
  return `## One-sentence orientation

_Not written yet. Replace this with exactly one sentence stating what this ${noun} does or claims: name the problem, the object it transforms/predicts/proves, and the main idea. Write it from the source, not from priors._

${representativeFigureExplanation({ sourceMode, text })}

${preliminaryLadderScaffold(sourceMode)}
`;
}

function preliminaryLadderScaffold(sourceMode) {
  const noun = sourceModeNoun(sourceMode);
  return `## Preliminary

_Not built yet. Replace this with the real preliminary, written like a patient tutor — not a fixed form._

List the prerequisites in order — calibrated to this ${noun}'s actual reader: skip the trivial basics they already know and focus on the non-trivial, paper-specific concepts, up to its notation and key equations. Render the whole order as one \`flow:\` line (\`flow: A → B → C\`, or \`flow: [phase] A → B || [phase] C → D\` to group a longer chain into labeled phases), then write each prerequisite as its own \`### N. concept\` block with a concrete numeric example and the exact symbol, figure, equation, or claim it unlocks. No tables, field lists, or tiers beyond that. Follow \`prompts/prerequisite-analyzer.md\`.`;
}

function readingGuideBody({ slug, sourceMode, lang = 'en' }) {
  const isSlide = normalizeSourceMode(sourceMode) === 'slide';
  if (lang === 'ko') {
    const nounKo = isSlide ? '슬라이드' : '논문';
    const sectionNounKo = isSlide ? '슬라이드' : '섹션';
    return `PaperMentor는 서로 연결된 두 화면으로 동작합니다: 이 리포트(HTML)와 CLI/TUI. 이 HTML을 열어둔 채 터미널로 돌아가 ${sectionNounKo}·수식·유도·의존성·질문 중 하나를 고르세요. 고른 동작 하나가 이 리포트에 잘 정리된 설명 블록 하나로 덧붙습니다.

**새로고침 동작:** \`state.json\`이 바뀌면 HTML이 자동으로 새로고침을 시도합니다. 브라우저가 로컬 파일 폴링을 막으면, CLI 작업이 끝난 뒤 직접 새로고침하세요. PDF 내보내기는 스냅샷이므로 블록을 추가한 뒤 다시 내보내세요.

**복귀 명령:** \`papermentor tui --session ${slug}\` — 대화형 ${nounKo} 내비게이터.`;
  }
  const noun = sourceModeNoun(sourceMode);
  const sectionNoun = isSlide ? 'slide' : 'section';
  return `PaperMentor has two linked surfaces: this report and the CLI/TUI. Keep this HTML open, then return to the terminal and choose a ${sectionNoun}, equation, derivation, dependency, or question. Each chosen action appends one polished explanation block to this same report.

**Refresh behavior:** the HTML tries to auto-refresh when \`state.json\` changes. If your browser blocks local file polling, press reload after the CLI finishes. A PDF export is a snapshot, so re-export it after adding blocks.

**Return command:** \`papermentor tui --session ${slug}\` for the interactive ${noun} navigator.`;
}

// The reading guide is a script-generated meta block, so it follows the document
// language at render time: a Korean report shows the Korean guide automatically.
function localizeReadingGuide(card, lang, slug, sourceMode) {
  if (card.type !== 'reading-guide') return card;
  return {
    ...card,
    title: lang === 'ko' ? '이 리딩룸 사용법' : 'How to use this reading room',
    body: readingGuideBody({ slug, sourceMode, lang })
  };
}

function addReadingGuideBlock({ slug, sourceMode, sections, args = {} }) {
  addCard({
    ...args,
    session: slug,
    type: 'reading-guide',
    title: 'How to use this reading room',
    location: 'Reading guide',
    body: readingGuideBody({ slug, sourceMode }),
    choices: sections.join('|'),
    quiet: true,
    noPath: true
  });
}

function isProvenanceOnlyCaption(value) {
  const caption = String(value || '').trim().toLowerCase();
  if (!caption) return false;
  return /^(exact|actual)?\s*(crop|screenshot|capture|extraction)\s+(of|from)\b/.test(caption)
    || /^exact\s+crop\b/.test(caption)
    || /^captured\s+from\b/.test(caption)
    || /^extracted\s+from\b/.test(caption)
    || /^main\s+method\s+figure\s+from\s+the\s+paper\.?$/.test(caption)
    || /^figure\s+from\s+the\s+paper\.?$/.test(caption);
}

function figureCaption(args) {
  const caption = args['figure-caption'] || args.caption || '';
  return isProvenanceOnlyCaption(caption) ? '' : caption;
}

function linkOrCopyFile(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  rmSync(destination, { force: true });
  try {
    linkSync(source, destination);
  } catch {
    copyFileSync(source, destination);
  }
}

function linkOrCopyDir(source, destination) {
  if (!existsSync(source)) return;
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const destPath = join(destination, entry.name);
    if (entry.isDirectory()) linkOrCopyDir(sourcePath, destPath);
    else if (entry.isFile()) linkOrCopyFile(sourcePath, destPath);
  }
}

function copyBundledReportAssets(slug) {
  mkdirSync(assetDir(slug), { recursive: true });
  linkOrCopyDir(join(bundledAssetsDir, 'fonts'), join(assetDir(slug), 'fonts'));
  linkOrCopyDir(join(bundledAssetsDir, 'mathjax'), join(assetDir(slug), 'mathjax'));
}


function commandPath(name) {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(lookup, [name], { encoding: 'utf8' });
  if (result.status !== 0) return '';
  return String(result.stdout || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

function pythonModuleAvailable(moduleName) {
  const result = spawnSync('python3', ['-c', `import ${moduleName}`], { encoding: 'utf8' });
  return result.status === 0;
}

function dependencyStatusRows() {
  const libreOffice = commandPath('soffice') || commandPath('libreoffice');
  const imageMagick = commandPath('magick') || commandPath('convert') || (process.platform === 'darwin' ? commandPath('sips') : '');
  return [
    {
      name: 'pdftoppm',
      ok: Boolean(commandPath('pdftoppm')),
      purpose: 'render PDF pages for launch, preview-crops, and extract-figure',
      install: 'Ubuntu: sudo apt-get install poppler-utils; macOS: brew install poppler'
    },
    {
      name: 'LibreOffice',
      ok: Boolean(libreOffice),
      purpose: 'convert PPT/PPTX files to PDF before slide image extraction',
      install: 'Ubuntu: sudo apt-get install libreoffice; macOS: brew install --cask libreoffice'
    },
    {
      name: 'ImageMagick',
      ok: Boolean(imageMagick),
      purpose: 'crop rendered pages/slides when --crop or --auto is used',
      install: 'Ubuntu: sudo apt-get install imagemagick; macOS: brew install imagemagick'
    },
    {
      name: 'python3-pptx',
      ok: pythonModuleAvailable('pptx'),
      purpose: 'generate and validate PPTX fixture smoke tests',
      install: 'Ubuntu: sudo apt-get install python3-pptx; Python env: python3 -m pip install python-pptx'
    }
  ];
}

function runDoctor(args = {}) {
  const rows = dependencyStatusRows();
  const payload = {
    status: rows.every((row) => row.ok) ? 'ok' : 'missing-dependencies',
    checks: rows
  };
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log('PaperMentor dependency doctor');
    for (const row of rows) {
      console.log(`${row.ok ? '[ok]' : '[missing]'} ${row.name} — ${row.purpose}`);
      if (!row.ok) console.log(`  install: ${row.install}`);
    }
  }
  if (payload.status !== 'ok') process.exitCode = 1;
}


function ensurePngName(value, fallback = 'extracted-figure.png') {
  const raw = slugify(value || fallback) || slugify(fallback);
  return raw.endsWith('.png') ? raw : `${raw}.png`;
}


function boundedInteger(name, value, { min = 1, max = 10000 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return number;
}

function parseCrop(crop) {
  if (crop && typeof crop === 'object') return crop;
  if (!crop) return null;
  const match = String(crop).trim().match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/);
  if (!match) throw new Error('crop must use x,y,width,height pixels, for example --crop 120,80,640,360');
  const [, x, y, width, height] = match.map(Number);
  if (x < 0 || y < 0 || width <= 0 || height <= 0) throw new Error('crop x/y must be non-negative and width/height must be positive');
  if (x > 50000 || y > 50000 || width > 12000 || height > 12000 || width * height > 50000000) {
    throw new Error('crop rectangle is too large; keep x/y <= 50000, width/height <= 12000, and area <= 50M pixels');
  }
  return { x, y, width, height };
}

function runTool(command, args, errorHint) {
  try {
    execFileSync(command, args, { stdio: 'pipe' });
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr) : '';
    throw new Error(`${errorHint}${stderr ? `: ${stderr.trim().slice(0, 400)}` : ''}`);
  }
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function convertPptToPdf(source, outDir) {
  const soffice = commandPath('soffice') || commandPath('libreoffice');
  if (!soffice) throw new Error('PPT/PPTX extraction requires LibreOffice (`soffice`) on PATH to convert slides to PDF');
  mkdirSync(outDir, { recursive: true });
  const profileDir = mkdtempSync(join(outDir, 'libreoffice-profile-'));
  const args = ['--headless', `-env:UserInstallation=${pathToFileURL(profileDir).href}`, '--convert-to', 'pdf', '--outdir', outDir, source];
  try {
    execFileSync(soffice, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const stdout = error.stdout ? String(error.stdout).trim() : '';
    const stderr = error.stderr ? String(error.stderr).trim() : '';
    throw new Error(`LibreOffice could not convert the slides to PDF${stderr ? `: ${stderr.slice(0, 400)}` : stdout ? `: ${stdout.slice(0, 400)}` : ''}`);
  }
  const pdf = join(outDir, `${basename(source, extname(source))}.pdf`);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (existsSync(pdf)) return pdf;
    const candidates = readdirSync(outDir)
      .filter((name) => extname(name).toLowerCase() === '.pdf')
      .map((name) => join(outDir, name));
    if (candidates.length === 1) return candidates[0];
    if (attempt < 7) sleepMs(125);
  }
  const seen = readdirSync(outDir).filter((name) => !name.startsWith('libreoffice-profile-')).join(', ') || 'none';
  throw new Error(`LibreOffice conversion finished but no PDF was found at ${pdf}; outdir files: ${seen}`);
}

function renderPdfPageToImage(pdfPath, page, outFile, dpi = 180) {
  const pdftoppm = commandPath('pdftoppm');
  if (pdftoppm) {
    const outBase = outFile.replace(/\.png$/i, '');
    runTool(pdftoppm, ['-png', '-f', String(page), '-singlefile', '-r', String(dpi), pdfPath, outBase], 'pdftoppm could not render the requested PDF page');
    const generated = `${outBase}.png`;
    if (!existsSync(generated)) throw new Error(`pdftoppm did not create ${generated}`);
    if (generated !== outFile) copyFileSync(generated, outFile);
    return outFile;
  }
  const qlmanage = commandPath('qlmanage');
  if (qlmanage && Number(page) === 1) {
    const outDir = dirname(outFile);
    runTool(qlmanage, ['-t', '-s', '1600', '-o', outDir, pdfPath], 'qlmanage could not render a PDF thumbnail');
    const generated = join(outDir, `${basename(pdfPath)}.png`);
    if (existsSync(generated)) {
      copyFileSync(generated, outFile);
      return outFile;
    }
  }
  throw new Error('PDF extraction requires `pdftoppm` (Poppler) on PATH; macOS qlmanage fallback only supports page 1 thumbnails');
}

function cropImage(sourceImage, outImage, crop) {
  const rect = parseCrop(crop);
  if (!rect) {
    if (resolve(sourceImage) !== resolve(outImage)) copyFileSync(sourceImage, outImage);
    return outImage;
  }
  const magick = commandPath('magick');
  if (magick) {
    runTool(magick, [sourceImage, '-crop', `${rect.width}x${rect.height}+${rect.x}+${rect.y}`, '+repage', outImage], 'ImageMagick could not crop the extracted image');
    return outImage;
  }
  const convert = commandPath('convert');
  if (convert) {
    runTool(convert, [sourceImage, '-crop', `${rect.width}x${rect.height}+${rect.x}+${rect.y}`, '+repage', outImage], 'ImageMagick convert could not crop the extracted image');
    return outImage;
  }
  const sips = commandPath('sips');
  if (sips && process.platform === 'darwin') {
    copyFileSync(sourceImage, outImage);
    runTool(sips, ['-c', String(rect.height), String(rect.width), '--cropOffset', String(rect.y), String(rect.x), outImage], 'macOS sips could not crop the extracted image');
    return outImage;
  }
  throw new Error('cropping requires ImageMagick (`magick`/`convert`) or macOS `sips`; rerun without --crop to attach the full rendered page');
}

function imageDimensions(file) {
  const absolute = resolve(file);
  if (!existsSync(absolute)) return null;
  if (/\.svg$/i.test(absolute)) {
    const svg = readFileSync(absolute, 'utf8');
    const viewBox = svg.match(/viewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i);
    if (viewBox) return { width: Number(viewBox[1]), height: Number(viewBox[2]) };
    const width = svg.match(/\bwidth=["']([0-9.]+)/i);
    const height = svg.match(/\bheight=["']([0-9.]+)/i);
    if (width && height) return { width: Number(width[1]), height: Number(height[1]) };
  }
  const magick = commandPath('magick');
  if (magick) {
    try {
      const out = execFileSync(magick, ['identify', '-format', '%w %h', absolute], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const [width, height] = out.split(/\s+/).map(Number);
      if (width && height) return { width, height };
    } catch {
      // fall through
    }
  }
  const identify = commandPath('identify');
  if (identify) {
    try {
      const out = execFileSync(identify, ['-format', '%w %h', absolute], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const [width, height] = out.split(/\s+/).map(Number);
      if (width && height) return { width, height };
    } catch {
      // fall through
    }
  }
  const fileCmd = commandPath('file');
  if (fileCmd) {
    try {
      const out = execFileSync(fileCmd, [absolute], { encoding: 'utf8' });
      const match = out.match(/(?:PNG|JPEG|GIF|Web\/P).*?(\d+)\s*x\s*(\d+)/i) || out.match(/,\s*(\d+)\s*x\s*(\d+)/);
      if (match) return { width: Number(match[1]), height: Number(match[2]) };
    } catch {
      // fall through
    }
  }
  return null;
}

function figureQualityHints({ extracted, rendered, crop, autoCrop }) {
  const dims = imageDimensions(extracted);
  const renderedDims = rendered ? imageDimensions(rendered) : null;
  const warnings = [];
  if (!dims) warnings.push('Could not read extracted figure dimensions; inspect crop-preview.html before trusting the figure block.');
  else {
    if (dims.width < 220 || dims.height < 140) warnings.push(`Extracted figure is small (${dims.width}x${dims.height}); recrop from crop preview if labels are unreadable.`);
    const aspect = dims.width / Math.max(1, dims.height);
    if (aspect > 6 || aspect < 0.18) warnings.push(`Extracted figure has unusual aspect ratio (${aspect.toFixed(2)}); inspect before using it as the representative figure.`);
  }
  if (!crop && !autoCrop) warnings.push('A full-page/full-slide visual was attached; run preview-crops and recrop before writing final figure reading.');
  if (dims && renderedDims && dims.width * dims.height > renderedDims.width * renderedDims.height * 0.82) {
    warnings.push('Extracted visual covers most of the page; this is probably a fallback, not a tight representative figure crop.');
  }
  return { dimensions: dims, renderedDimensions: renderedDims, warnings };
}

function parsePdfBbox(xml) {
  const pageMatch = String(xml || '').match(/<page[^>]*width="([0-9.]+)"[^>]*height="([0-9.]+)"/);
  const page = pageMatch ? { width: Number(pageMatch[1]), height: Number(pageMatch[2]) } : { width: 612, height: 792 };
  const words = [];
  const wordRegex = /<word[^>]*xMin="([0-9.]+)"[^>]*yMin="([0-9.]+)"[^>]*xMax="([0-9.]+)"[^>]*yMax="([0-9.]+)"[^>]*>(.*?)<\/word>/g;
  for (const match of String(xml || '').matchAll(wordRegex)) {
    words.push({
      xMin: Number(match[1]),
      yMin: Number(match[2]),
      xMax: Number(match[3]),
      yMax: Number(match[4]),
      text: match[5].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    });
  }
  return { page, words };
}

function pdfPageSize(pdfPath, pageNumber) {
  const pdfinfo = commandPath('pdfinfo');
  if (!pdfinfo) return { width: 612, height: 792 };
  try {
    const out = execFileSync(pdfinfo, ['-f', String(pageNumber), '-l', String(pageNumber), pdfPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const match = out.match(/Page\s+\d+\s+size:\s+([0-9.]+)\s+x\s+([0-9.]+)\s+pts/i) || out.match(/Page size:\s+([0-9.]+)\s+x\s+([0-9.]+)\s+pts/i);
    if (match) return { width: Number(match[1]), height: Number(match[2]) };
  } catch {
    // Keep the conservative letter-size fallback below.
  }
  return { width: 612, height: 792 };
}

function rectFromPdfPoints({ page, dpi, leftPt, topPt, rightPt, bottomPt }) {
  const scaleX = Number(dpi || 180) / 72;
  const scaleY = Number(dpi || 180) / 72;
  const left = Math.max(0, Math.min(page.width - 1, leftPt));
  const top = Math.max(0, Math.min(page.height - 1, topPt));
  const right = Math.max(left + 20, Math.min(page.width, rightPt));
  const bottom = Math.max(top + 20, Math.min(page.height, bottomPt));
  return {
    x: Math.max(0, Math.round(left * scaleX)),
    y: Math.max(0, Math.round(top * scaleY)),
    width: Math.max(80, Math.round((right - left) * scaleX)),
    height: Math.max(80, Math.round((bottom - top) * scaleY))
  };
}

function autoFigureCropFromLayoutText(pdfPath, pageNumber, args = {}) {
  const pdftotext = commandPath('pdftotext');
  if (!pdftotext) return null;
  const label = String(args.auto || args.figure || args['figure-number'] || '1').replace(/^fig(?:ure)?\.?\s*/i, '') || '1';
  let text = '';
  try {
    text = execFileSync(pdftotext, ['-layout', '-f', String(pageNumber), '-l', String(pageNumber), pdfPath, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return null;
  }
  const lines = text.replace(/\f/g, '').split(/\r?\n/);
  const labelRegex = new RegExp(`\\bFig(?:ure)?\\.?\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.:]?`, 'i');
  const index = lines.findIndex((line) => labelRegex.test(line));
  if (index < 0) return null;
  const line = lines[index] || '';
  const column = Math.max(0, line.search(labelRegex));
  const maxColumns = Math.max(90, ...lines.map((item) => item.length));
  const page = pdfPageSize(pdfPath, pageNumber);
  const captionY = (index / Math.max(1, lines.length - 1)) * page.height;
  const rightColumn = column > maxColumns * 0.42;
  const leftColumn = column > 4 && column < maxColumns * 0.30;
  const leftPt = Number(args['auto-left'] || (rightColumn ? page.width * 0.49 : leftColumn ? 42 : 50));
  const rightPt = Number(args['auto-right'] || (rightColumn ? page.width - 38 : leftColumn ? page.width * 0.51 : page.width - 50));
  const topPt = Math.max(0, captionY - Number(args['auto-layout-top-pad'] || args['auto-top-pad'] || 260));
  const includeCaption = Boolean(args['include-caption'] || args.includeCaption);
  const bottomPt = includeCaption
    ? Math.min(page.height, captionY + Number(args['auto-layout-bottom-pad'] || args['auto-height'] || 110))
    : Math.max(topPt + 20, captionY - Number(args['auto-caption-gap'] || 8));
  return rectFromPdfPoints({ page, dpi: args.dpi, leftPt, topPt, rightPt, bottomPt });
}

function autoFigureCropFromPdf(pdfPath, pageNumber, args = {}) {
  const pdftotext = commandPath('pdftotext');
  if (!pdftotext) return null;
  if (args['force-layout-crop'] || process.env.PAPERMENTOR_FORCE_LAYOUT_CROP === '1') {
    return autoFigureCropFromLayoutText(pdfPath, pageNumber, args);
  }
  const label = String(args.auto || args.figure || args['figure-number'] || '1').replace(/^fig(?:ure)?\.?\s*/i, '') || '1';
  let xml = '';
  try {
    xml = execFileSync(pdftotext, ['-bbox', '-f', String(pageNumber), '-l', String(pageNumber), pdfPath, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return autoFigureCropFromLayoutText(pdfPath, pageNumber, args);
  }
  const { page, words } = parsePdfBbox(xml);
  const figureIndex = words.findIndex((word, index) => /^fig(?:ure)?\.?$/i.test(word.text) && new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.:]?$`).test(words[index + 1]?.text || ''));
  if (figureIndex < 0) return autoFigureCropFromLayoutText(pdfPath, pageNumber, args);
  const figureWord = words[figureIndex];
  const after = words.filter((word) => word.yMin > figureWord.yMin + 18);
  const nextHeading = after.find((word) => /^(Abstract|Introduction|Background|Preliminaries|Methods?|Experiments?|Conclusion|References)$/i.test(word.text));
  const topPt = Math.max(0, figureWord.yMin - Number(args['auto-top-pad'] || 114));
  const includeCaption = Boolean(args['include-caption'] || args.includeCaption);
  const bottomPt = includeCaption
    ? Math.min(page.height, (nextHeading?.yMin || figureWord.yMin + Number(args['auto-height'] || 86)) - Number(args['auto-bottom-pad'] || 8))
    : Math.max(topPt + 20, figureWord.yMin - Number(args['auto-caption-gap'] || 8));
  const leftPt = Number(args['auto-left'] || 50);
  const rightPt = Number(args['auto-right'] || (page.width - 50));
  return rectFromPdfPoints({ page, dpi: args.dpi, leftPt, topPt, rightPt, bottomPt });
}

function visualExplanationBody(args, state) {
  // No author-supplied reading was passed to extract-figure. Do NOT invent a generic
  // "follow the labeled objects and arrows" explanation — that is the filler this skill
  // exists to eliminate. Emit the same honest, element-by-element forcing scaffold the
  // launch flow uses, so the model is told to replace it by reading the actual crop.
  return representativeFigureExplanation({ sourceMode: state.sourceMode });
}


function uniqueOutputPath(dir, name, overwrite = false) {
  const candidate = join(dir, basename(name));
  if (overwrite || !existsSync(candidate)) return candidate;
  const extension = extname(candidate);
  const stem = basename(candidate, extension);
  for (let i = 2; i < 1000; i += 1) {
    const next = join(dir, `${stem}-${i}${extension}`);
    if (!existsSync(next)) return next;
  }
  throw new Error(`could not allocate a unique output filename for ${name}`);
}

function extractFigure(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('extract-figure requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const source = args.source || args['source-file'] || args.input || args['figure-file'];
  if (!source) throw new Error('extract-figure requires --source <pdf|ppt|pptx|image> or --figure-file <image>');
  const absoluteSource = resolve(source);
  if (!existsSync(absoluteSource) && !isUrl(source)) throw new Error(`source file not found: ${source}`);
  if (isUrl(source)) throw new Error('extract-figure currently expects a local PDF/PPT/image path; download the source first for deterministic crop extraction');
  mkdirSync(assetDir(slug), { recursive: true });
  const page = boundedInteger('page/slide', args.page || args.slide || 1, { min: 1, max: 10000 });
  const dpi = boundedInteger('dpi', args.dpi || 180, { min: 72, max: 300 });
  const title = args.title || `Extracted figure — ${state.currentSection || state.title}`;
  const extension = extname(absoluteSource).toLowerCase();
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
  const imagePassthrough = imageExtensions.includes(extension) && !args.crop;
  const existingCards = readJson(cardsPath(slug), { cards: [] });
  const defaultStem = `${slugify(title)}-${page}-${String((existingCards.cards || []).length + 1).padStart(3, '0')}`;
  const outName = args.output
    ? basename(args.output)
    : imagePassthrough
      ? `${defaultStem}${extension}`
      : ensurePngName(defaultStem);
  const extracted = args.output && existsSync(join(assetDir(slug), outName)) && !args.overwrite
    ? (() => { throw new Error(`output already exists: ${outName}; pass --overwrite to replace it`); })()
    : uniqueOutputPath(assetDir(slug), outName, Boolean(args.overwrite));
  mkdirSync(assetDir(slug), { recursive: true });
  const tempDir = mkdtempSync(join(assetDir(slug), 'extract-tmp-'));
  let rendered = absoluteSource;
  let renderedPdf = extension === '.pdf' ? absoluteSource : '';
  let autoCrop = null;
  let figureQuality = null;
  try {
    if (['.pdf'].includes(extension)) {
      const pageImage = join(tempDir, `${slugify(basename(absoluteSource, extension))}-page-${page}.png`);
      mkdirSync(tempDir, { recursive: true });
      rendered = renderPdfPageToImage(absoluteSource, page, pageImage, dpi);
    } else if (['.ppt', '.pptx', '.key'].includes(extension)) {
      mkdirSync(tempDir, { recursive: true });
      const pdf = convertPptToPdf(absoluteSource, tempDir);
      renderedPdf = pdf;
      const pageImage = join(tempDir, `${slugify(basename(absoluteSource, extension))}-slide-${page}.png`);
      rendered = renderPdfPageToImage(pdf, page, pageImage, dpi);
    } else if (!imageExtensions.includes(extension)) {
      throw new Error(`unsupported extraction source extension ${extension}; expected PDF, PPT/PPTX, or image`);
    }
    const requestedAutoCrop = Boolean(args.auto || args.figure || args['figure-number']);
    autoCrop = requestedAutoCrop && renderedPdf ? autoFigureCropFromPdf(renderedPdf, page, { ...args, dpi }) : null;
    if (requestedAutoCrop && renderedPdf && !autoCrop) {
      throw new Error(`auto crop could not locate Figure ${String(args.auto || args.figure || args['figure-number']).replace(/^fig(?:ure)?\.?\s*/i, '') || '1'} on page/slide ${page}; rerun with an explicit --crop x,y,width,height`);
    }
    cropImage(rendered, extracted, args.crop || autoCrop);
    figureQuality = figureQualityHints({ extracted, rendered, crop: args.crop, autoCrop });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
  const type = args.type || (normalizeSourceMode(state.sourceMode) === 'slide' ? 'slide-explanation' : 'paper-map');
  if (figureQuality?.warnings?.length) {
    state.figureQualityWarning = figureQuality.warnings.join(' ');
    state.figureQuality = figureQuality;
    state.nextChoices = unique([
      `Review crop preview / recrop representative figure`,
      ...(state.nextChoices || [])
    ]).slice(0, 12);
    state.updatedAt = now();
    writeJson(statePath(slug), state);
  }
  addCard({
    ...args,
    session: slug,
    type,
    title,
    location: args.location || state.currentSection || `Page ${page}`,
    body: readBody(args) || visualExplanationBody(args, state),
    'figure-file': extracted,
    'figure-caption': args['figure-caption'] || args.caption || (normalizeSourceMode(state.sourceMode) === 'slide' ? `Slide ${page}. Representative visual.` : `Figure ${String(args.auto || args.figure || args['figure-number'] || page).replace(/^fig(?:ure)?\.?\s*/i, '')}. Representative method figure.`),
    choices: args.choices || `${figureQuality?.warnings?.length ? 'Review crop preview / recrop figure|' : ''}Explain this visual|Connect it to the next equation|Ask anything about ${state.currentSection || state.title}`
  });
  if (!args.quiet) console.log(`Extracted visual saved to .papermentor/sessions/${slug}/assets/${basename(extracted)}`);
}

function renderSourcePageForPreview(source, page, dpi, tempDir) {
  const absoluteSource = resolve(source);
  const extension = extname(absoluteSource).toLowerCase();
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
  if (extension === '.pdf') {
    const pageImage = join(tempDir, `${slugify(basename(absoluteSource, extension))}-page-${page}.png`);
    return { rendered: renderPdfPageToImage(absoluteSource, page, pageImage, dpi), renderedPdf: absoluteSource, extension };
  }
  if (['.ppt', '.pptx', '.key'].includes(extension)) {
    const pdf = convertPptToPdf(absoluteSource, tempDir);
    const pageImage = join(tempDir, `${slugify(basename(absoluteSource, extension))}-slide-${page}.png`);
    return { rendered: renderPdfPageToImage(pdf, page, pageImage, dpi), renderedPdf: pdf, extension };
  }
  if (imageExtensions.includes(extension)) return { rendered: absoluteSource, renderedPdf: '', extension };
  throw new Error(`unsupported preview source extension ${extension}; expected PDF, PPT/PPTX, or image`);
}


function commandSourcePath(slug, absoluteSource) {
  const rootAbs = resolve(root);
  const sourceAbs = resolve(absoluteSource);
  if (sourceAbs === rootAbs || sourceAbs.startsWith(`${rootAbs}${sep}`)) {
    return relative(rootAbs, sourceAbs) || '.';
  }
  const extension = extname(sourceAbs);
  const stem = slugify(basename(sourceAbs, extension)) || 'source';
  const key = createHash('sha256').update(sourceAbs).digest('hex').slice(0, 10);
  const sourceDir = safeSessionPath(slug, 'sources');
  mkdirSync(sourceDir, { recursive: true });
  const copied = join(sourceDir, `${stem}-${key}${extension || '.source'}`);
  if (!existsSync(copied)) copyFileSync(sourceAbs, copied);
  return relative(rootAbs, copied);
}

function cropPreviewHtml({ title, slug, page, previews }) {
  const cards = previews.map((preview) => `<article class="preview-card">
  <h2>${escapeHtml(preview.label)}</h2>
  <img src="${escapeHtml(preview.src)}" alt="${escapeHtml(preview.label)}" />
  <code>${escapeHtml(preview.command)}</code>
</article>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PaperMentor crop preview · ${escapeHtml(title)}</title>
<style>
body{margin:0;padding:34px;background:#f3efe4;color:#191715;font-family:Satoshi,Inter,system-ui,sans-serif}
main{width:min(1120px,calc(100% - 40px));margin:0 auto}
h1{font-size:38px;letter-spacing:-.04em;margin:0 0 8px}
p{color:#70685d}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;margin-top:24px}
.preview-card{background:#fffef9;border:1px solid #d6ccba;padding:16px;box-shadow:0 12px 30px rgba(65,48,26,.07)}
.preview-card h2{font-size:18px;margin:0 0 12px}img{width:100%;height:auto;display:block;border:1px solid #d8cebd;background:white}
code{display:block;white-space:pre-wrap;word-break:break-word;margin-top:12px;padding:10px;background:#f8f2e8;border:1px solid #ded4c4;font-size:12px}
</style>
</head>
<body>
<main>
<h1>Crop preview</h1>
<p>Session <strong>${escapeHtml(slug)}</strong> · page/slide ${escapeHtml(page)}. Pick a candidate command, edit <code>--crop x,y,width,height</code> if needed, then rerun it.</p>
<section class="grid">${cards}</section>
</main>
</body>
</html>`;
}

function previewCrops(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('preview-crops requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const source = args.source || args['source-file'] || args.input || state.source;
  if (!source) throw new Error('preview-crops requires --source <pdf|ppt|pptx|image> or a session source');
  const absoluteSource = resolve(source);
  if (!existsSync(absoluteSource)) throw new Error(`source file not found: ${source}`);
  mkdirSync(assetDir(slug), { recursive: true });
  const page = boundedInteger('page/slide', args.page || args.slide || 1, { min: 1, max: 10000 });
  const dpi = boundedInteger('dpi', args.dpi || 160, { min: 72, max: 300 });
  mkdirSync(assetDir(slug), { recursive: true });
  const tempDir = mkdtempSync(join(assetDir(slug), 'preview-tmp-'));
  const previews = [];
  try {
    mkdirSync(tempDir, { recursive: true });
    const { rendered, renderedPdf } = renderSourcePageForPreview(absoluteSource, page, dpi, tempDir);
    const fullName = uniqueOutputPath(assetDir(slug), `crop-preview-page-${page}-full.png`, Boolean(args.overwrite));
    copyFileSync(rendered, fullName);
    previews.push({
      label: 'Full page / slide',
      src: `assets/${basename(fullName)}`,
      command: `${cliCommand()} extract-figure --session ${shellQuote(slug)} --source ${shellQuote(commandSourcePath(slug, absoluteSource))} --page ${page} --title ${shellQuote(args.title || 'Representative figure')}`
    });
    const autoCrop = renderedPdf ? autoFigureCropFromPdf(renderedPdf, page, { ...args, auto: args.auto || 'figure1', dpi }) : null;
    if (autoCrop) {
      const autoName = uniqueOutputPath(assetDir(slug), `crop-preview-page-${page}-auto-figure.png`, Boolean(args.overwrite));
      cropImage(rendered, autoName, autoCrop);
      const crop = `${autoCrop.x},${autoCrop.y},${autoCrop.width},${autoCrop.height}`;
      previews.push({
        label: `Auto Figure ${String(args.auto || '1').replace(/^fig(?:ure)?\.?\s*/i, '')}`,
        src: `assets/${basename(autoName)}`,
        command: `${cliCommand()} extract-figure --session ${shellQuote(slug)} --source ${shellQuote(commandSourcePath(slug, absoluteSource))} --page ${page} --crop ${shellQuote(crop)} --title ${shellQuote(args.title || 'Representative figure')}`
      });
    }
    const previewPath = safeSessionPath(slug, 'crop-preview.html');
    writeFileSync(previewPath, cropPreviewHtml({ title: state.title, slug, page, previews }));
    writeJson(safeSessionPath(slug, 'crop-previews.json'), { schema: 'papermentor.crop-previews.v1', source: commandSourcePath(slug, absoluteSource), page, dpi, previews });
    state.cropPreview = `.papermentor/sessions/${slug}/crop-preview.html`;
    state.nextChoices = unique([`Open crop preview: ${state.cropPreview}`, ...(state.nextChoices || [])]).slice(0, 12);
    state.updatedAt = now();
    writeJson(statePath(slug), state);
    if (!args.quiet) {
      console.log(`Crop preview written to .papermentor/sessions/${slug}/crop-preview.html`);
      for (const preview of previews) console.log(`- ${preview.label}: ${preview.command}`);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function prepareFigure(slug, cardId, args) {
  const source = args['figure-file'] || args.figure || args['figure-url'] || args['image-file'] || args.image;
  if (!source) return null;

  let src = String(source);
  const remoteFigureRequested = Boolean(args['figure-url']);
  if (remoteFigureRequested || isUrl(src)) {
    src = assertSafeRemoteUrl(src, { label: 'figure URL' });
  } else {
    const absoluteSource = resolve(src);
    if (!existsSync(absoluteSource)) throw new Error(`figure file not found: ${src}`);
    mkdirSync(assetDir(slug), { recursive: true });
    const absoluteAssetDir = resolve(assetDir(slug));
    if (absoluteSource.startsWith(`${absoluteAssetDir}${sep}`)) {
      src = `assets/${basename(absoluteSource)}`;
    } else {
      const extension = extname(absoluteSource) || '.png';
      const safeBase = slugify(`${cardId}-${basename(absoluteSource, extension)}`) || slugify(cardId);
      const fileName = `${safeBase}${extension.toLowerCase()}`;
      copyFileSync(absoluteSource, join(assetDir(slug), fileName));
      src = `assets/${fileName}`;
    }
  }

  return {
    src,
    alt: args['figure-alt'] || args.alt || `${args.title || 'Paper'} figure`,
    caption: figureCaption(args)
  };
}

// Generic, uniform section menu — no word-matching or scoring. The model tailors a
// section's menu on entry by reading its title+content and re-running `section
// --choices`. See prompts/section-navigator.md.
function defaultSectionActions(_section) {
  // Paper section menus are LLM-authored from the section excerpt. Do not ship
  // generic Map/Decode/Trace/Connect fallback actions here: fake specificity is
  // worse than an explicit pending menu prompt.
  return [];
}

function defaultModeItems(mode, section) {
  const scope = section || 'this section';
  const map = {
    equations: [`Detect equations in ${scope}`, `Explain the first key equation symbol by symbol`, `Choose an equation by number`],
    derivations: [`Detect derivation transitions in ${scope}`, `Trace the most important transition`, `Choose a transition by number`],
    dependencies: [`Map definitions and claims in ${scope}`, `Build backward dependencies`, `Build forward dependencies`],
    confusion: [`Ask a diagnostic question about ${scope}`, `Repair my current confusion`, `Resume the exact paused location`],
    method: [`Explain the method pipeline in ${scope}`, `Connect method steps to equations`, `Find assumptions and failure modes`]
  };
  return map[mode] || [`Detect choices in ${scope}`, `Ask a question about ${scope}`];
}

function sectionKey(section) {
  return slugify(section || 'current-section');
}

function plainSectionTitle(section) {
  return String(section || '')
    .replace(/^\s*\d+(?:\.\d+)*(?:\.|\s)+/g, '')
    .replace(/^\s*appendix\s+[A-Z]\s*/i, 'Appendix ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sectionKeyAliases(section) {
  const raw = String(section || '').trim();
  const plain = plainSectionTitle(raw);
  const aliases = [sectionKey(raw), sectionKey(plain)];
  if (/^appendix\b/i.test(raw)) aliases.push('appendix');
  return unique(aliases);
}

function sameSectionTitle(a, b) {
  const ak = new Set(sectionKeyAliases(a));
  return sectionKeyAliases(b).some((key) => ak.has(key));
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lineHeadingIndex(text, title, from = 0) {
  const clean = String(title || '').trim();
  if (!clean) return -1;
  const pattern = new RegExp(`(?:^|\\n)\\s*${escapeRegExp(clean)}\\s*(?:\\n|$)`, 'i');
  const slice = String(text || '').slice(Math.max(0, from));
  const match = slice.match(pattern);
  return match ? Math.max(0, from) + match.index + (match[0].startsWith('\n') ? 1 : 0) : -1;
}

function sectionExcerptFromSourceText(text, section, sections = []) {
  const source = String(text || '');
  const title = plainSectionTitle(section);
  const rawTitle = String(section || '').trim();
  const startCandidates = unique([rawTitle, title]).map((candidate) => lineHeadingIndex(source, candidate, 0)).filter((idx) => idx >= 0);
  if (!startCandidates.length) return '';
  const start = Math.min(...startCandidates);
  const currentIndex = (sections || []).findIndex((item) => sameSectionTitle(item, section));
  const nextCandidates = (sections || [])
    .slice(Math.max(0, currentIndex + 1))
    .flatMap((item) => unique([String(item || '').trim(), plainSectionTitle(item)]))
    .map((candidate) => lineHeadingIndex(source, candidate, start + Math.max(8, title.length)))
    .filter((idx) => idx > start);
  const end = nextCandidates.length ? Math.min(...nextCandidates) : Math.min(source.length, start + 9000);
  return sourceExcerptForPrompt(source.slice(start, end));
}

function sectionInsightFor(state, section) {
  const insights = state?.sectionInsights || {};
  for (const key of sectionKeyAliases(section)) {
    if (insights[key]) return insights[key];
  }
  return null;
}

function buildSectionInsight(block) {
  return {
    equations: detectEquationNumbers(block.body),
    equationSnippets: detectEquationSnippets(block.body),
    citations: detectCitations(block.body),
    concepts: detectConcepts(block.body),
    preview: block.body.replace(/\s+/g, ' ').slice(0, 500),
    sourceExcerpt: sourceExcerptForPrompt(block.body)
  };
}

function ensureSectionInsight(state, section) {
  const existing = sectionInsightFor(state, section);
  if (existing?.sourceExcerpt || existing?.preview) return existing;
  const source = state?.source || state?.sourceFile;
  if (!source || !existsSync(resolve(source))) return existing || {};
  try {
    const text = extractTextFromSourceFile(source, { raw: true });
    const blocks = extractSourceBlocks(text, state.paperSections || [], state.sourceMode || 'paper');
    const block = blocks.find((candidate) => sameSectionTitle(candidate.title, section));
    const excerpt = block?.body || sectionExcerptFromSourceText(text, section, state.paperSections || []);
    if (!excerpt) return existing || {};
    state.sectionInsights = state.sectionInsights || {};
    const insight = buildSectionInsight({ title: block?.title || section, body: excerpt });
    state.sectionInsights[sectionKey(section)] = insight;
    if (block?.title) state.sectionInsights[sectionKey(block.title)] = insight;
    return insight;
  } catch {
    return existing || {};
  }
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function readPaperText(args) {
  if (args['paper-text-file']) return readFileSync(resolve(args['paper-text-file']), 'utf8');
  if (args['section-file']) return readFileSync(resolve(args['section-file']), 'utf8');
  if (args['paper-text']) return String(args['paper-text']);
  if (args['section-text']) return String(args['section-text']);
  return readTextArg(args);
}

function detectSourceMode(text, args = {}, state = {}) {
  const explicit = args.mode || args['source-mode'] || args.sourceMode;
  if (explicit && String(explicit).toLowerCase() !== 'auto') return explicitSourceMode(explicit, state.sourceMode || 'paper');
  const sourceHint = `${args.source || state.source || ''} ${args.title || state.title || ''}`;
  const bySource = argsModeFromSource(sourceHint);
  if (bySource !== 'paper') return bySource;
  const value = String(text || '');
  const lower = value.toLowerCase();
  const slideMatches = (value.match(/^\s*(slide|page)\s+\d+\b/gim) || []).length;
  const pageBreaks = (value.match(/\f/g) || []).length;
  const bulletLines = (value.match(/^\s*[-•▪◦]\s+/gm) || []).length;
  const paragraphLines = value.split(/\r?\n/).filter((line) => line.trim().length > 120).length;
  if (slideMatches >= 2 || (/\bslides?\b|\bpresentation\b/.test(lower) && bulletLines >= 8) || (pageBreaks >= 5 && bulletLines > paragraphLines * 2)) {
    return 'slide';
  }
  return 'paper';
}

function cleanHeadingTitle(raw) {
  return String(raw || '')
    .replace(/\s{2,}.+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}



const sectionHeadingWords = /\b(abstract|introduction|background|preliminar(?:y|ies)|related work|method|methods|approach|model|algorithm|experiment|experiments|evaluation|results|analysis|discussion|conclusion|proof|appendix|lecture|notation|definition|problem setup|problem formulation)\b/i;

function headingLevel(number) {
  if (!number) return 1;
  return String(number).split('.').length;
}

function looksLikeSectionHeading(number, title, line, sourceMode = 'paper') {
  const clean = cleanHeadingTitle(title);
  if (clean.length < 3 || clean.length > 110) return false;
  if (/^(figure|fig\.?|table|algorithm|eq\.?|equation|remark|example)\s+\d+/i.test(clean)) return false;
  if (/\b(fid|resnet|simclr|nfe|task|setting|generated|retrieved)\b/i.test(clean) && !sectionHeadingWords.test(clean)) return false;
  if (/[.;,]$/.test(clean) && !sectionHeadingWords.test(clean)) return false;
  if ((line.match(/\s+/g) || []).length > 14 && !sectionHeadingWords.test(clean)) return false;
  const level = headingLevel(number);
  if (number && level === 1 && clean.split(/\s+/).length > 8 && !sectionHeadingWords.test(clean)) return false;
  if (normalizeSourceMode(sourceMode) === 'paper' && level > 3) return false;
  if (number && sectionHeadingWords.test(clean)) return true;
  if (number && /^[A-Z][A-Za-z0-9,&:/()\- ]+$/.test(clean)) return true;
  if (!number && sectionHeadingWords.test(clean)) return true;
  return false;
}

function extractSectionBlocks(text, preferredSections = [], sourceMode = 'paper') {
  const source = String(text || '').replace(/\r/g, '');
  const lines = source.split('\n');
  const found = [];
  let offset = 0;
  for (const rawLine of lines) {
    const segments = unique([rawLine.trim(), ...rawLine.split(/\s{2,}/).map((part) => part.trim())]);
    for (const segment of segments) {
      if (!segment) continue;
      const headingLine = cleanHeadingTitle(segment);
      const numbered = headingLine.match(/^(\d+(?:\.\d+)*)(?:\.|\s)\s+(.{3,120})$/);
      const unnumbered = headingLine.match(/^(Abstract|Introduction|Background|Preliminaries|Related Work|Methods?|Approach|Model|Algorithm|Experiments?|Evaluation|Results|Discussion|Conclusion|Appendix(?:\s+[A-Z])?)(?:\s*[:—-]\s*(.{2,90}))?$/);
      const segmentOffset = Math.max(0, rawLine.indexOf(segment));
      if (numbered) {
        const title = cleanHeadingTitle(`${numbered[1]}. ${numbered[2]}`);
        if (looksLikeSectionHeading(numbered[1], numbered[2], segment, sourceMode)) found.push({ title, index: offset + segmentOffset });
      } else if (unnumbered) {
        const title = cleanHeadingTitle(`${unnumbered[1]}${unnumbered[2] ? ` — ${unnumbered[2]}` : ''}`);
        if (looksLikeSectionHeading('', title, segment, sourceMode)) found.push({ title, index: offset + segmentOffset });
      }
    }
    offset += rawLine.length + 1;
  }
  const orderedHeadings = unique(found.map((item) => item.title))
    .map((title) => found.find((item) => item.title === title))
    .sort((a, b) => a.index - b.index);
  // Two-column PDF extraction often leaves a bare section word (e.g. "Method")
  // floating on its own line, which the unnumbered matcher picks up as a second
  // section alongside the real numbered "3. Method". Drop an unnumbered heading
  // when a numbered heading already covers the same core name.
  const numberedCoreNames = new Set(
    orderedHeadings.filter((item) => /^\d/.test(item.title)).map((item) => sectionCoreName(item.title))
  );
  const headings = orderedHeadings
    .filter((item) => /^\d/.test(item.title) || !numberedCoreNames.has(sectionCoreName(item.title)))
    .slice(0, 50);
  const sections = headings.length ? headings : preferredSections.map((title) => ({ title, index: source.indexOf(title) })).filter((item) => item.index >= 0);
  const blocks = sections.map((item, index) => {
    const next = sections[index + 1]?.index ?? source.length;
    return {
      title: item.title,
      body: source.slice(item.index, next).trim().slice(0, 26000)
    };
  });
  return blocks.sort(compareSectionBlocks);
}

function slideLineKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').trim();
}

function repeatedSlideHeaderKeys(chunks) {
  const counts = new Map();
  for (const chunk of chunks) {
    const seen = new Set();
    const lines = String(chunk || '').split(/\n/).slice(0, 8).map(cleanMetadataLine).filter(Boolean);
    for (const line of lines) {
      const key = slideLineKey(line);
      if (key.length >= 14) seen.add(key);
    }
    for (const key of seen) counts.set(key, (counts.get(key) || 0) + 1);
  }
  const threshold = Math.max(2, Math.ceil(Math.min(chunks.length, 8) * 0.35));
  return new Set([...counts.entries()].filter(([, count]) => count >= threshold).map(([key]) => key));
}

function firstSlideTitle(chunk, fallback, options = {}) {
  const repeatedHeaders = options.repeatedHeaders || new Set();
  const rawLines = String(chunk || '').split(/\n/);
  const candidates = [];
  rawLines.slice(0, 18).forEach((rawLine, index) => {
    const line = cleanMetadataLine(rawLine);
    if (!line) return;
    const lineLooksLikeBullet = /^\s{2,}(?:I|•|◦|▪|[-–])\s+\S/.test(rawLine);
    const nextLine = cleanMetadataLine(rawLines[index + 1] || '');
    const lineIsRepeatedHeader = repeatedHeaders.has(slideLineKey(line));
    const combined = !lineIsRepeatedHeader
      && nextLine
      && /^(?:lecture|lec\.?)\s*\d{1,3}\s*:/i.test(line)
      && line.length >= 18
      && line.length <= 80
      && !/[.!?。]$/.test(line)
      ? `${line} ${nextLine}`
      : '';
    const parts = unique([line, combined, ...line.split(/\s{2,}/)])
      .map((part) => cleanTitleCandidate(part.replace(/^(?:slide|page)\s*\d{1,3}\s*[:.\-–—]?\s*/i, '')))
      .filter(Boolean);
    for (const candidate of parts) {
      if (lineLooksLikeBullet) continue;
      const key = slideLineKey(candidate);
      const fromCombined = Boolean(combined && candidate === cleanTitleCandidate(combined));
      if (repeatedHeaders.has(key) && !fromCombined) continue;
      if (candidate.length < 3 || candidate.length > 96 || /^[-–•▪◦]/.test(candidate) || isBadMetadataTitle(candidate)) continue;
      if (/\bBoyd\s+and\s+Vandenberghe\b/i.test(candidate)) continue;
      if (/[=≤≥∈∉∑∏√{}|∇]/.test(candidate)) continue;
      const words = candidate.split(/\s+/).filter(Boolean);
      let score = 20 - index;
      if (words.length >= 2 && words.length <= 7) score += 4;
      if (words.length === 1 && index > 0) score -= 3;
      if (/^\d{1,2}\s+\S/.test(candidate)) score -= 8;
      if (fromCombined) score += 5;
      if (/[.!?。]$/.test(candidate)) score -= 6;
      candidates.push({ candidate, score });
    }
  });
  candidates.sort((a, b) => b.score - a.score || b.candidate.length - a.candidate.length);
  return cleanHeadingTitle(candidates[0]?.candidate || fallback);
}

function slideTitleParts(title) {
  const rangeMatch = String(title || '').match(/^Slides?\s+(\d{1,4})(?:\s*[–-]\s*(\d{1,4}))?(?:\s*[—-]\s*(.+))?$/i);
  if (!rangeMatch) return { slideNumber: null, endSlide: null, topic: cleanHeadingTitle(title) };
  return {
    slideNumber: Number(rangeMatch[1]),
    endSlide: Number(rangeMatch[2] || rangeMatch[1]),
    topic: cleanHeadingTitle(rangeMatch[3] || `Slide ${rangeMatch[1]}`)
  };
}

function normalizeSlideTopic(topic) {
  return String(topic || '')
    .toLowerCase()
    .replace(/\b(?:continued|cont\.?|build|part)\s*\d*\b/g, '')
    .replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/g, '')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim();
}

function slideRangeLabel(start, end) {
  if (!start || !end || start === end) return `Slide ${start || end || 1}`;
  return `Slides ${start}–${end}`;
}

function groupConsecutiveSlideBlocks(blocks) {
  const groups = [];
  for (const block of blocks) {
    const parts = slideTitleParts(block.title);
    const topic = parts.topic || block.title;
    const normalizedTopic = normalizeSlideTopic(topic);
    const previous = groups[groups.length - 1];
    const canFold = previous
      && normalizedTopic
      && previous.normalizedTopic === normalizedTopic
      && (parts.slideNumber === null || previous.endSlide === null || parts.slideNumber === previous.endSlide + 1);
    if (canFold) {
      previous.endSlide = parts.endSlide || parts.slideNumber || previous.endSlide;
      previous.body = `${previous.body}\n\n---\n\n${block.body}`.trim();
      previous.count += 1;
    } else {
      groups.push({
        topic,
        normalizedTopic,
        startSlide: parts.slideNumber,
        endSlide: parts.endSlide || parts.slideNumber,
        body: block.body,
        count: 1
      });
    }
  }
  return groups.map((group) => {
    const range = group.startSlide ? slideRangeLabel(group.startSlide, group.endSlide) : 'Slides';
    return {
      title: `${range} — ${group.topic}`,
      body: group.body.slice(0, 32000)
    };
  });
}

function extractSlideBlocks(text, preferredSections = []) {
  const source = String(text || '').replace(/\r/g, '');
  const markers = [];
  const markerRegex = /^\s*(?:#{1,3}\s*)?(?:slide|page)\s*(\d{1,3})(?:\s*[/|]\s*\d{1,3})?\s*[:.\-–]?\s*(.*)$/gim;
  for (const match of source.matchAll(markerRegex)) {
    const titleTail = cleanHeadingTitle(match[2] || '');
    markers.push({ title: `Slide ${match[1]}${titleTail ? ` — ${titleTail}` : ''}`, index: match.index });
  }
  if (!markers.length) {
    const separator = /(?:^|\n)\s*(?:---+\s*)?(?:slide\s*)?(\d{1,3})\s*\/\s*(\d{1,3})\s*(?:---+)?\s*(?=\n)/gim;
    for (const match of source.matchAll(separator)) markers.push({ title: `Slide ${match[1]}`, index: match.index });
  }
  if (!markers.length && source.includes('\f')) {
    let offset = 0;
    const chunks = source.split('\f');
    const repeatedHeaders = repeatedSlideHeaderKeys(chunks);
    chunks.forEach((chunk, index) => {
      markers.push({ title: `Slide ${index + 1} — ${firstSlideTitle(chunk, `Slide ${index + 1}`, { repeatedHeaders })}`, index: offset });
      offset += chunk.length + 1;
    });
  }
  if (!markers.length && preferredSections.length) {
    markers.push(...preferredSections.map((title) => ({ title, index: source.indexOf(title) })).filter((item) => item.index >= 0));
  }
  const slideBlocks = markers.slice(0, 160).map((item, index) => {
    const next = markers[index + 1]?.index ?? source.length;
    return { title: item.title, body: source.slice(item.index, next).trim().slice(0, 16000) };
  });
  return groupConsecutiveSlideBlocks(slideBlocks).slice(0, 80);
}

function extractSourceBlocks(text, preferredSections = [], sourceMode = 'paper') {
  if (normalizeSourceMode(sourceMode) === 'slide') return extractSlideBlocks(text, preferredSections);
  return extractSectionBlocks(text, preferredSections, sourceMode);
}

function sectionNumberParts(title) {
  const match = String(title || '').match(/^(\d+(?:\.\d+)*)\./);
  if (!match) return [];
  return match[1].split('.').map((part) => Number(part));
}

// Normalized section name for de-duplication: strip the leading number and any
// subtitle, lowercase, and fold a trailing plural so "3. Method" and a stray
// "Method" (or "Methods") collapse to the same key.
function sectionCoreName(title) {
  return String(title || '')
    .replace(/^\d+(?:\.\d+)*\.?\s*/, '')
    .replace(/\s*[—:-]\s.*$/, '')
    .toLowerCase()
    .replace(/s$/, '')
    .trim();
}

function compareSectionBlocks(a, b) {
  const left = sectionNumberParts(a.title);
  const right = sectionNumberParts(b.title);
  if (left.length && right.length) {
    const max = Math.max(left.length, right.length);
    for (let i = 0; i < max; i += 1) {
      const diff = (left[i] ?? -1) - (right[i] ?? -1);
      if (diff) return diff;
    }
  }
  return 0;
}

function detectEquationNumbers(text) {
  return unique([...String(text || '').matchAll(/\((\d{1,2})\)/g)].map((match) => match[1]))
    .filter((value) => Number(value) > 0 && Number(value) < 80)
    .slice(0, 12);
}

function detectEquationSnippets(text, max = 8) {
  const lines = String(text || '')
    .split(/\n/)
    .map((line) => cleanMetadataLine(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const snippets = [];
  for (let i = 0; i < lines.length; i += 1) {
    const joined = [lines[i], lines[i + 1] || '', lines[i + 2] || ''].join(' ').replace(/\s+/g, ' ').trim();
    const mathLike = /(?:\\[a-zA-Z]+|[=≤≥∈∉∑∏√∇]|[_^{}]|\b(?:minimize|maximize|subject to|s\.t\.|argmin|argmax|gradient|hessian|convex combination|expectation|variance)\b)/i.test(joined);
    if (!mathLike || joined.length < 6) continue;
    const clean = joined.slice(0, 240);
    if (!snippets.some((existing) => normalizeSlideTopic(existing) === normalizeSlideTopic(clean))) snippets.push(clean);
    if (snippets.length >= max) break;
  }
  return snippets;
}

function sourceExcerptForPrompt(text, max = 5200) {
  return String(text || '')
    .replace(/\r/g, '')
    .split(/\n/)
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .trim()
    .slice(0, max);
}

function detectCitations(text) {
  return unique([...String(text || '').matchAll(/\b([A-Z][A-Za-z\-]+(?:\s*&\s*[A-Z][A-Za-z\-]+)?|[A-Z][A-Za-z\-]+\s+et\s+al\.)[,\s]+(?:19|20)\d{2}\b/g)].map((match) => match[0].replace(/\s+/g, ' ')))
    .slice(0, 8);
}

function detectConcepts(text) {
  const source = String(text || '').replace(/\s+/g, ' ');
  const stopStarts = /^(this|that|these|those|paper|source|section|figure|table|equation|eq|we|our|the|a|an|it|they|there|their|its)\b/i;
  const stopEnds = /\b(and|or|with|while|that|which|where|when|using|uses?|is|are|be|being|been|to|from|for|of|in|on|by|as|at|than|then|into|over|under|after|before)\s*$/i;
  const noisy = /\b(copyright|rights reserved|all rights|header|footer|preprint|accepted manuscript|anonymous|supplementary|page intentionally blank|generated by|downloaded from|license|arxiv|doi|conference|proceedings)\b/i;
  const genericTail = /\b(section|paper|source|work|result|results|approach|problem|idea|example|study)\s*$/i;
  const canonicalConcept = (value) => {
    const phrase = String(value || '').trim();
    const known = new Map([
      ['vit-h', 'ViT-H'],
      ['vit-l', 'ViT-L'],
      ['vit-b', 'ViT-B'],
      ['data2vec', 'data2vec'],
      ['beit', 'BEiT'],
      ['mae', 'MAE']
    ]);
    return known.get(phrase.toLowerCase()) || phrase;
  };
  const clean = (value) => canonicalConcept(String(value || '')
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim());
  const scores = new Map();
  const addCandidate = (value, score = 1) => {
    for (const part of String(value || '').split(/\s+(?:and|or|with|versus|vs\.?|such that|so that)\s+|[,;:]/i)) {
      const phrase = clean(part)
        .replace(/^(?:a|an|the|new|novel|simple|current|local)\s+/i, '')
        .replace(/\s+as\s+[A-Za-z0-9#_{}\\-]+$/i, '')
        .replace(/\s+(?:we|this|that|these|those)\s*$/i, '')
        .replace(stopEnds, '')
        .trim();
      const words = phrase.split(/\s+/).filter(Boolean);
      const singleLower = words.length === 1 && /^[a-z]+$/.test(phrase);
      const signal = score
        + (/[A-Z]/.test(phrase[0] || '') ? 0.5 : 0)
        + (/-/.test(phrase) ? 0.5 : 0)
        + (/\b[A-Z]{2,}\b/.test(phrase) ? 0.5 : 0);
      if (
        phrase.length >= 5
        && phrase.length <= 72
        && words.length <= 5
        && !stopStarts.test(phrase)
        && !stopEnds.test(phrase)
        && !noisy.test(phrase)
        && !/^([A-Z]{3,})(?:\s+\1){1,}$/.test(phrase)
        && !genericTail.test(phrase)
        && (!singleLower || signal >= 2.5 || phrase.length >= 9)
      ) {
        const key = phrase.toLowerCase();
        const existing = scores.get(key);
        scores.set(key, existing ? { phrase: existing.phrase, score: existing.score + signal } : { phrase, score: signal });
      }
    }
  };
  for (const match of source.matchAll(/\b(?:proposes?|introduces?|presents?|develops?|defines?|studies?|evaluates?|optimizes?|learns?|builds?|designs?|uses?|denotes?|calls?)\s+(?:a|an|the|new|novel)?\s*([A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z][A-Za-z0-9-]*){0,5})/gi)) {
    addCandidate(match[1], 3);
  }
  for (const match of source.matchAll(/\b([A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z][A-Za-z0-9-]*){0,5})\s+(?:is|are|means|denotes|refers to|maps to|controls|measures|anchors|supports|matches|approximates|compares|changes|evaluates)\b/gi)) {
    addCandidate(match[1], 3);
  }
  for (const match of source.matchAll(/\b(?:Figure|Fig\.|Table|Algorithm)\s+\d+[A-Za-z]?\.\s*([^.\n]{5,90})/gi)) {
    addCandidate(match[1], 2.5);
  }
  for (const match of source.matchAll(/\b([A-Za-z][A-Za-z0-9- ]{2,40})\s+[A-Za-z]\s*[:=]\s*[^.\n]{1,80}/g)) {
    addCandidate(match[1], 2.5);
  }
  for (const match of source.matchAll(/\b([A-Z][A-Za-z0-9-]+(?:\s+(?:[A-Z][A-Za-z0-9-]+|[a-z]{3,})){1,4})\b/g)) {
    const phrase = clean(match[1]);
    if (phrase.length >= 6 && !stopStarts.test(phrase) && !/\b(Abstract|Introduction|Related Work|References)\b/.test(phrase)) addCandidate(phrase, 1.5);
  }
  for (const match of source.matchAll(/\b([A-Z]{2,6})\b/g)) addCandidate(match[1], 1.5);
  for (const match of source.matchAll(/\b([A-Za-z]+(?:-[A-Za-z]+){1,3})\b/g)) {
    const phrase = clean(match[1].toLowerCase());
    if (!stopStarts.test(phrase)) addCandidate(phrase, 1.5);
  }
  return [...scores.values()]
    .filter(({ score }) => score >= 2.5)
    .sort((a, b) => b.score - a.score || b.phrase.length - a.phrase.length)
    .map(({ phrase }) => phrase)
    .slice(0, 8);
}

function detectDefinitions(text) {
  return unique([...String(text || '').matchAll(/\b(?:Definition|Def\.|Assumption|Exercise|Theorem|Lemma|Proposition|Algorithm)\s+([0-9.]+)?\s*([^\n.]{0,80})/g)]
    .map((match) => `${match[0].replace(/\s+/g, ' ').trim()}`))
    .filter((value) => !/\b(copyright|rights reserved|page intentionally blank|generated by|downloaded from|conference proceedings)\b/i.test(value))
    .slice(0, 10);
}

function isVisualRepairRequest(text) {
  const value = String(text || '').toLowerCase();
  return /(diagram|visuali[sz]e|draw|flow|pipeline|graph|map|landscape|structure|how.*connect|connect.*how|dependency|relationship|big picture|overall flow)/i.test(value)
    || /(그림|다이어그램|시각화|구조|흐름|관계도|연결|큰\s*그림|전체\s*흐름|의존성|파이프라인)/.test(value);
}

function visualRepairActions(section, body) {
  const title = String(section || 'this section');
  const lowerTitle = title.toLowerCase();
  const equations = detectEquationNumbers(body);
  const citations = detectCitations(body);
  const concepts = detectConcepts(body);
  const actions = [];
  if (/introduction/.test(lowerTitle) && concepts.length >= 2) {
    actions.push(`Visualize problem → limitation → idea flow for ${title}`);
  }
  if (/related work/.test(lowerTitle) && citations.length >= 3) {
    actions.push(`Draw related-work landscape for ${title}`);
  }
  if (/\b(method|methods|approach|model|architecture|algorithm|framework|system|implementation)\b/.test(lowerTitle) || /Algorithm\s+\d+|objective|pipeline|optimizer|architecture|framework|procedure/i.test(body)) {
    actions.push(`Draw method pipeline for ${title}`);
  }
  if (equations.length >= 2 || /Eq\.\s*\(\d+\).*Eq\.\s*\(\d+\)/is.test(body)) {
    actions.push(`Map equation dependencies in ${title}`);
  }
  if ((concepts.length >= 3 || /definition|lemma|theorem|proposition|assumption/i.test(body)) && !/related work/i.test(lowerTitle)) {
    actions.push(`Build concept prerequisite graph for ${title}`);
  }
  if (/proof|proposition|lemma|theorem/i.test(body)) {
    actions.push(`Draw proof dependency graph for ${title}`);
  }
  if (/experiment|evaluation|results|analysis|ablation|benchmark|case study|table|figure/i.test(lowerTitle) || /metric|benchmark|ablation|Table\s+\d+|Figure\s+\d+/i.test(body)) {
    actions.push(`Visualize experimental evidence flow for ${title}`);
  }
  return unique(actions).slice(0, 4);
}

function equationLabel(number, body) {
  const source = String(body || '');
  const equationAt = source.indexOf(`(${number})`);
  const local = equationAt >= 0
    ? source.slice(Math.max(0, equationAt - 800), equationAt + 800)
    : source.slice(0, 1200);
  if (/pushforward/i.test(local)) return `Explain Eq. (${number}) pushforward symbol by symbol`;
  if (/anti-symmetric/i.test(local)) return `Explain Eq. (${number}) anti-symmetry condition`;
  if (/fixed-point|equilibrium/i.test(local)) return `Explain Eq. (${number}) equilibrium fixed point`;
  if (/stopgrad|stop-gradient/i.test(local)) return `Explain Eq. (${number}) stop-gradient target symbol by symbol`;
  if (/\b(loss|objective|risk|likelihood|regulari[sz]er|constraint)\b/i.test(local)) return `Explain Eq. (${number}) objective symbol by symbol`;
  if (/update|recurrence|iteration|x[i_{]?\s*\+?\s*1|t\s*\+\s*1/i.test(local)) return `Explain Eq. (${number}) update rule symbol by symbol`;
  if (/expectation|expected value|\\mathbb\{E\}|E\[/i.test(local)) return `Explain Eq. (${number}) expectation symbol by symbol`;
  if (/norm|distance|\\\|/.test(local)) return `Explain Eq. (${number}) distance or norm symbol by symbol`;
  if (/probability|distribution|density|p\(|q\(/i.test(local)) return `Explain Eq. (${number}) probabilistic statement symbol by symbol`;
  return `Explain Eq. (${number}) symbol by symbol`;
}

// Generic slide menu. Slides are TEMPORAL: the model reads the slide IMAGE,
// reconstructs the missing narration, and explains how the slide builds on the
// earlier ones. It tailors this menu on entry via `section --choices`.
// See prompts/slide-navigator.md.
function slideActionProfile(section, body) {
  const title = String(section || "this slide");
  return [
    `Reconstruct the lecturer's narration for ${title}`,
    `Read the figure(s) and visual elements on ${title}`,
    `Decode the equations on ${title}`,
    `How ${title} builds on the earlier slides`,
    `Continue to the next slide`,
    `Ask anything about ${title}`,
    `Chat about this slide`
  ];
}

function actionProfileForSection(section, body, sourceMode = 'paper') {
  const normalizedMode = normalizeSourceMode(sourceMode);
  if (normalizedMode === 'slide') return slideActionProfile(section, body);
  // Paper mode ships a GENERIC menu only. Classifying a section's role and proposing
  // tailored, template-mapped actions is the model's job: on entry it reads the
  // section title+content, infers the role (weak position prior), and re-runs
  // `section --choices` to replace this menu. No word-matching or scoring here.
  // See prompts/section-navigator.md.
  return defaultSectionActions(section);
}

function isMeaningfulSlideTopic(section) {
  const topic = slideTitleParts(section).topic || section;
  const normalized = normalizeSlideTopic(topic);
  if (!normalized) return false;
  if (/^(lecture|lec)\s+\d+/.test(normalized)) return false;
  if (/^(slide|page)\s+\d+$/.test(normalized)) return false;
  if (/copyright|all rights reserved/.test(normalized)) return false;
  return true;
}

function firstMeaningfulSlideTopic(sections = []) {
  return (sections || []).find(isMeaningfulSlideTopic) || sections?.[0] || '';
}
function analyzePaper(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('analyze requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const text = readPaperText(args);
  if (!text.trim()) throw new Error('analyze requires --paper-text-file, --paper-text, --section-file, or --section-text');
  const sourceMode = detectSourceMode(text, args, state);
  state.sourceMode = sourceMode;
  state.readingPath = readingPathForMode(sourceMode).map(([key, label], index) => {
    const existing = state.readingPath?.find((item) => item.key === key);
    return { key, label, status: existing?.status || (index === 0 ? 'current' : 'pending') };
  });
  const blocks = extractSourceBlocks(text, state.paperSections || [], sourceMode);
  if (!blocks.length) throw new Error(`could not detect ${sourceModeNoun(sourceMode)} sections from text`);
  state.paperSections = blocks.map((block) => block.title);
  state.sectionActions = {};
  state.sectionInsights = {};
  for (const block of blocks) {
    const key = sectionKey(block.title);
    const equations = detectEquationNumbers(block.body);
    const citations = detectCitations(block.body);
    const concepts = detectConcepts(block.body);
    const sectionActions = actionProfileForSection(block.title, block.body, sourceMode);
    if (sectionActions.length) state.sectionActions[key] = sectionActions;
    state.sectionInsights[key] = buildSectionInsight(block);
  }
  state.currentSection = '';
  state.currentMode = '';
  state.detectedItems = [];
  state.nextChoices = state.paperSections;
  state.currentLocation = `${sourceModeLabel(sourceMode)} section navigator`;
  state.currentFocus = `Arrow-key TUI ready. Choose a ${sourceModeNoun(sourceMode)} section; explanations render only in HTML.`;
  state.updatedAt = now();
  writeJson(statePath(slug), state);
  renderHtml(slug);
  printConsole(state);
}

function setSections(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('sections requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const sections = splitChoices(args.sections || readTextArg(args));
  if (!sections.length) throw new Error('sections requires --sections "A|B|C" or --text-file');
  if (args.mode || args['source-mode']) state.sourceMode = explicitSourceMode(args.mode || args['source-mode'], state.sourceMode || 'paper');
  state.paperSections = sections;
  state.currentLocation = `${sourceModeLabel(state.sourceMode)} section navigator`;
  state.currentFocus = `Choose a ${sourceModeNoun(state.sourceMode)} section; explanations render only in HTML.`;
  state.currentSection = '';
  state.currentMode = '';
  state.detectedItems = [];
  state.nextChoices = sections;
  state.updatedAt = now();
  writeJson(statePath(slug), state);
  renderHtml(slug);
  printConsole(state);
}

function selectSection(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('section requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const raw = args.section || args.name || args.title || '';
  const index = Number(args.index || args.choice || 0);
  const section = raw || (index ? state.paperSections?.[index - 1] : '');
  if (!section) throw new Error('section requires --section <name> or --index <n>');
  const providedChoices = splitChoices(args.choices);
  const key = sectionKey(section);
  if (providedChoices.length) {
    state.sectionActions = state.sectionActions || {};
    state.sectionActions[key] = providedChoices;
    if (state.sectionMenuPending?.key === key) delete state.sectionMenuPending;
    clearPendingPrompt(state);
  }
  const existingActions = state.sectionActions?.[key];
  const actions = providedChoices.length
    ? providedChoices
    : existingActions?.length ? existingActions : sectionMenuPendingChoices(section);
  state.currentSection = section;
  state.currentMode = '';
  state.detectedItems = [];
  state.currentLocation = section;
  state.currentFocus = providedChoices.length ? `Section menu installed: ${section}` : `Section selected: ${section}`;
  state.nextChoices = actions;
  if (!providedChoices.length && !existingActions?.length) writeSectionMenuPrompt(state, section);
  state.updatedAt = now();
  writeJson(statePath(slug), state);
  renderHtml(slug);
  printConsole(state);
}

function setMode(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('mode requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const mode = args.mode || args.type || 'equations';
  const items = splitChoices(args.items || args.choices || readTextArg(args));
  const section = args.section || state.currentSection || 'current section';
  state.currentSection = section;
  state.currentMode = mode;
  clearPendingPrompt(state);
  state.currentLocation = section;
  state.currentFocus = `${mode} menu for ${section}`;
  state.detectedItems = items;
  state.nextChoices = items.length ? items : defaultModeItems(mode, section);
  state.updatedAt = now();
  writeJson(statePath(slug), state);
  renderHtml(slug);
  printConsole(state);
}

function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]));
}

function wrapLabel(value, max = 22) {
  const words = String(value || '').replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function diagramKindFromAction(action, fallback = 'method-pipeline') {
  const text = String(action || '').toLowerCase();
  if (/related-work|related work|landscape|citation/.test(text)) return 'related-work-landscape';
  if (/equation|eq\./.test(text)) return 'equation-dependency';
  if (/prerequisite|concept/.test(text)) return 'concept-prerequisite';
  if (/proof|theorem|lemma|proposition/.test(text)) return 'proof-structure';
  if (/experiment|evidence|fid|result/.test(text)) return 'evidence-flow';
  if (/paper flow|problem/.test(text)) return 'paper-flow';
  return fallback;
}

function inferDiagramNodes(kind, state, args) {
  const explicit = splitChoices(args.nodes || args.items);
  if (explicit.length) return explicit.slice(0, 8);
  const insight = ensureSectionInsight(state, state.currentSection || '') || {};
  if (kind === 'equation-dependency' && insight.equations?.length) {
    return insight.equations.slice(0, 6).map((number) => `Eq. (${number})`);
  }
  if (kind === 'related-work-landscape' && insight.citations?.length) {
    return ['This paper', ...insight.citations.slice(0, 5)];
  }
  if (kind === 'concept-prerequisite' && insight.concepts?.length) {
    return insight.concepts.slice(0, 6);
  }
  if (kind === 'paper-flow') {
    return ['Problem', 'Limitation', 'Key idea', 'Mechanism', 'Final insight'];
  }
  if (kind === 'evidence-flow') {
    return ['Experiment setup', 'Metric', 'Observed result', 'Claim supported', 'Limitation'];
  }
  if (kind === 'proof-structure') {
    return ['Claim', 'Dependencies', 'Argument step', 'Conclusion'];
  }
  return ['Input object', 'Core transformation', 'Training signal', 'Updated model', 'Output behavior'];
}

function diagramTitle(kind) {
  const titles = {
    'paper-flow': 'Paper flow map',
    'method-pipeline': 'Method pipeline',
    'equation-dependency': 'Equation dependency map',
    'concept-prerequisite': 'Concept prerequisite graph',
    'related-work-landscape': 'Related-work landscape',
    'proof-structure': 'Proof structure',
    'evidence-flow': 'Experimental evidence flow'
  };
  return titles[kind] || 'Conceptual diagram';
}

function diagramBody({ question, concept, visualEncoding, observe, conclusion, limitation }) {
  return `## Question

${question}

## Concept

${concept}

## Visual encoding

${visualEncoding}

## What to observe

${observe}

## Conclusion

${conclusion}

## Limitation

${limitation}

## Provenance

Conceptual diagram generated by PaperMentor. Not a figure from the paper.`;
}

function generatedDiagramSvg({ title, kind, nodes }) {
  const width = 1120;
  const height = kind === 'related-work-landscape' ? 620 : 520;
  const paper = '#fffef9';
  const ink = '#1f1f1d';
  const muted = '#7a7166';
  const line = '#cfc5b4';
  const soft = '#f4efe6';
  const nodeW = kind === 'related-work-landscape' ? 210 : 185;
  const nodeH = 82;
  const safeNodes = nodes.slice(0, 8);
  const isRadial = kind === 'related-work-landscape' || kind === 'concept-prerequisite';
  let shapes = '';
  let arrows = '';
  const defs = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${ink}"/></marker></defs>`;
  const node = (x, y, label, index) => {
    const lines = wrapLabel(label);
    const text = lines.map((l, i) => `<text x="${x + nodeW / 2}" y="${y + 32 + i * 17}" text-anchor="middle" font-size="15" fill="${ink}" font-family="Satoshi, Pretendard, Arial">${escapeXml(l)}</text>`).join('');
    return `<g><rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="3" fill="${index === 0 ? '#ffffff' : soft}" stroke="${ink}" stroke-width="${index === 0 ? 1.8 : 1.2}"/><text x="${x + 16}" y="${y + 18}" font-size="10" fill="${muted}" font-family="Satoshi, Pretendard, Arial" letter-spacing=".08em">${String(index + 1).padStart(2, '0')}</text>${text}</g>`;
  };
  if (isRadial) {
    const cx = width / 2;
    const cy = 315;
    const centerLabel = safeNodes[0] || title;
    shapes += node(cx - nodeW / 2, cy - nodeH / 2, centerLabel, 0);
    const others = safeNodes.slice(1);
    const radiusX = 370;
    const radiusY = 180;
    others.forEach((label, i) => {
      const angle = (-Math.PI * 0.85) + (i * (Math.PI * 1.7 / Math.max(1, others.length - 1)));
      const x = cx + Math.cos(angle) * radiusX - nodeW / 2;
      const y = cy + Math.sin(angle) * radiusY - nodeH / 2;
      arrows += `<path d="M ${cx} ${cy} L ${x + nodeW / 2} ${y + nodeH / 2}" stroke="${muted}" stroke-width="1.2" fill="none" marker-end="url(#arrow)" opacity=".72"/>`;
      shapes += node(x, y, label, i + 1);
    });
  } else {
    const y = 250;
    const gap = (width - 140 - nodeW * safeNodes.length) / Math.max(1, safeNodes.length - 1);
    safeNodes.forEach((label, i) => {
      const x = 70 + i * (nodeW + gap);
      if (i > 0) {
        const px = 70 + (i - 1) * (nodeW + gap);
        arrows += `<path d="M ${px + nodeW + 10} ${y + nodeH / 2} L ${x - 12} ${y + nodeH / 2}" stroke="${ink}" stroke-width="1.4" fill="none" marker-end="url(#arrow)"/>`;
      }
      shapes += node(x, y, label, i);
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(title)}">
${defs}
<rect width="${width}" height="${height}" fill="${paper}"/>
<path d="M52 44 H${width - 52}" stroke="${ink}" stroke-width="1.4"/>
<text x="56" y="88" font-size="31" font-weight="700" fill="${ink}" font-family="Satoshi, Pretendard, Arial">${escapeXml(title)}</text>
<text x="56" y="118" font-size="13" fill="${muted}" font-family="Satoshi, Pretendard, Arial" letter-spacing=".08em">CONCEPTUAL DIAGRAM · GENERATED BY PAPERMENTOR · NOT A PAPER FIGURE</text>
${arrows}
${shapes}
<path d="M52 ${height - 52} H${width - 52}" stroke="${line}" stroke-width="1"/>
</svg>`;
}

function addDiagram(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('diagram requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const selected = args.action || state.selectedAction || state.currentFocus || '';
  const kind = args.kind || diagramKindFromAction(selected);
  const nodes = inferDiagramNodes(kind, state, args);
  const title = args.title || `${diagramTitle(kind)} — ${state.currentSection || state.currentLocation || state.title}`;
  const cardId = args.id || `concept-diagram-${String((readJson(cardsPath(slug), { cards: [] }).cards || []).length + 1).padStart(3, '0')}`;
  mkdirSync(assetDir(slug), { recursive: true });
  const fileName = `${slugify(cardId)}.svg`;
  writeFileSync(join(assetDir(slug), fileName), generatedDiagramSvg({ title, kind, nodes }));
  const question = args.question || `What structure in ${state.currentSection || 'this paper'} is hard to hold in working memory?`;
  const concept = args.concept || diagramTitle(kind);
  const visualEncoding = args['visual-encoding'] || `Mono-tone SVG: nodes represent paper objects; arrows represent dependency, sequence, or contrast.`;
  const observe = args.observe || args['what-to-observe'] || `Each arrow is a dependency: the object it points to relies on the object it leaves, so the upstream object must be understood first.`;
  const conclusion = args.conclusion || `The diagram is a visual repair aid: it shows the relationship structure before the detailed explanation is appended.`;
  const limitation = args.limitation || `This is a generated conceptual diagram, not an exact figure from the paper and not a substitute for the paper's own figures.`;
  addCard({
    ...args,
    session: slug,
    type: 'concept-diagram',
    title,
    location: state.currentSection || state.currentLocation || 'Conceptual diagram',
    body: diagramBody({ question, concept, visualEncoding, observe, conclusion, limitation }),
    'figure-file': join(assetDir(slug), fileName),
    'figure-caption': 'Conceptual diagram generated by PaperMentor. Not a figure from the paper.',
    choices: args.choices || `Explain this diagram|Continue text explanation only|Ask anything about ${state.currentSection || 'this paper'}`
  });
}

function addCard(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('card requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const cards = readJson(cardsPath(slug), { schema: 'papermentor.cards.v1', cards: [] });
  const type = args.type || 'note';
  const body = readBody(args);
  if (hasForbiddenDiagramSubstitute(body)) {
    throw new Error('report body contains a Mermaid/flowchart diagram substitute; attach an actual paper figure crop or write prose instead');
  }
  // Start Here and the reading guide are singleton blocks: a re-render or a real
  // fill replaces the existing one in place (same id and position) instead of
  // appending a duplicate.
  const singletonTypes = new Set(['start-here', 'reading-guide']);
  const existingIndex = singletonTypes.has(type)
    ? cards.cards.findIndex((existing) => existing.type === type)
    : -1;
  const existingSingleton = existingIndex >= 0 ? cards.cards[existingIndex] : null;
  const incomingIsScaffold = /Not built yet|Not written yet/.test(body);
  // A re-launch ships the scaffold again; never let it clobber an already-filled
  // Start Here, so re-running the same source keeps the reader's content.
  if (type === 'start-here' && existingSingleton && incomingIsScaffold
    && !/Not built yet|Not written yet/.test(existingSingleton.body || '')) {
    return existingSingleton;
  }
  const cardId = args.id
    || existingSingleton?.id
    || `${type}-${String(cards.cards.length + 1).padStart(3, '0')}`;
  const card = {
    id: cardId,
    type,
    title: args['title-file'] ? readFileSync(resolve(args['title-file']), 'utf8').trim() : (args.title || type),
    location: args.location || state.currentLocation,
    latex: args.latex || '',
    figure: prepareFigure(slug, cardId, args),
    userQuestion: args['user-question'] || args.question || '',
    promotionReason: args['promotion-reason'] || args.reason || '',
    originTurn: args['origin-turn'] || args.originTurn || '',
    body,
    choices: splitChoices(args.choices),
    createdAt: existingSingleton?.createdAt || now()
  };
  if (existingSingleton) cards.cards[existingIndex] = card;
  else cards.cards.push(card);
  // A real Start Here fill (not the "Not built yet/written yet" scaffold) clears
  // the pending flags so the navigator stops asking for the replacement.
  if (type === 'start-here' && !incomingIsScaffold) {
    state.startHerePending = false;
    if (card.figure && splitFigureExplanationSection(body).figure) state.figureReadingPending = false;
  }
  const shouldUpdatePath = !args.noPath && !args['no-path'];
  if (shouldUpdatePath) {
    const pathKey = inferPathKey(type, state);
    if (pathKey) setPathStatus(state, pathKey, args.status || 'done');
    const activePathItems = readingPathForMode(state.sourceMode || 'paper');
    const nextKey = args.next || activePathItems.find(([key]) => state.readingPath.find((item) => item.key === key)?.status === 'pending')?.[0];
    if (nextKey) setPathStatus(state, nextKey, 'current');
  }
  const shouldEnterFirstSlideTopic = type === 'start-here'
    && !incomingIsScaffold
    && normalizeSourceMode(state.sourceMode || 'paper') === 'slide'
    && (state.paperSections || []).length;
  if (shouldEnterFirstSlideTopic) {
    const firstTopic = firstMeaningfulSlideTopic(state.paperSections);
    state.currentSection = firstTopic;
    state.currentMode = '';
    state.detectedItems = [];
    state.currentLocation = firstTopic;
    state.currentFocus = `Section selected: ${firstTopic}`;
    state.selectedAction = '';
    state.lastChoiceKind = 'section';
    state.nextChoices = state.sectionActions?.[sectionKey(firstTopic)] || slideActionProfile(firstTopic, '');
  } else {
    state.currentLocation = card.location;
    state.currentFocus = card.title;
    state.nextChoices = card.choices.length ? card.choices : state.nextChoices;
  }
  clearPendingPrompt(state);
  state.updatedAt = now();
  writeJson(cardsPath(slug), cards);
  writeJson(statePath(slug), state);
  const noteFigureExplanation = figureExplanationMarkdown(card);
  const noteBody = card.figure ? bodyWithoutFigureExplanation(card.body || '') : (card.body || '');
  appendFileSync(notesPath(slug), `
## ${card.title}

Location: ${card.location}

${card.userQuestion ? `### User question\n\n${card.userQuestion}\n\n` : ''}${card.latex ? `$$
${card.latex}
$$

` : ''}${card.figure ? `![${card.figure.alt}](${card.figure.src})

${noteFigureExplanation ? `${noteFigureExplanation}

` : ''}` : ''}${noteBody}
`);
  renderHtml(slug);
  if (!args.quiet) printConsole(state, cards);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function containsKorean(value) {
  return /[\u3131-\u318e\uac00-\ud7a3]/.test(String(value || ''));
}

function documentLanguage(state, cards) {
  const text = [
    state?.title,
    state?.authors,
    state?.source,
    ...(cards?.cards || []).flatMap((card) => [card.title, card.location, card.userQuestion, card.body, card.figure?.caption])
  ].join('\n');
  return containsKorean(text) ? 'ko' : 'en';
}

function statusIcon(status) {
  return { done: '✓', current: '›', pending: ' ', blocked: '!', review: '↺' }[status] || ' ';
}

function statusClass(status) {
  return { done: 'done', current: 'current', pending: 'pending', blocked: 'blocked', review: 'review' }[status] || 'pending';
}

function renderHtml(slug) {
  copyBundledReportAssets(slug);
  const state = readJson(statePath(slug), {});
  const cards = readJson(cardsPath(slug), { cards: [] });
  const lang = documentLanguage(state, cards);
  const html = `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PaperMentor · ${escapeHtml(state.title)}</title>
<script>
window.MathJax = { tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']] }, svg: { fontCache: 'global' } };
</script>
<script defer src="assets/mathjax/tex-svg.js"></script>
<script>
try {
  if (new URLSearchParams(window.location.search).has('papermentor-print')) {
    document.documentElement.classList.add('papermentor-print-preview');
  }
} catch (_) {}
</script>
<style>
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-300.woff2") format("woff2"); font-weight:300; font-style:normal; font-display:swap; }
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-400.woff2") format("woff2"); font-weight:400; font-style:normal; font-display:swap; }
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-500.woff2") format("woff2"); font-weight:500; font-style:normal; font-display:swap; }
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-700.woff2") format("woff2"); font-weight:700; font-style:normal; font-display:swap; }
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-900.woff2") format("woff2"); font-weight:900; font-style:normal; font-display:swap; }
@font-face { font-family:"Pretendard"; src:url("assets/fonts/pretendard/PretendardVariable.woff2") format("woff2-variations"); font-weight:45 920; font-style:normal; font-display:swap; }
:root {
  color-scheme: light;
  --field:#f7f7f5;
  --paper:#ffffff;
  --ink:#191715;
  --muted:#66615a;
  --line:#d9d6cf;
  --rule:#242424;
  --accent:#405f9f;
  --accent-soft:#f1f4f8;
  --mono: "Anthropic Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --text: "Satoshi", "Pretendard", "Apple SD Gothic Neo", Inter, "Helvetica Neue", Arial, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
html, body, .page, .paper-title, .block, .paper-figure, .paper-figure figcaption { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body {
  margin:0;
  color:var(--ink);
  font-family:var(--text);
  background:
    linear-gradient(180deg, #ffffff 0%, #f7f7f5 42%, #f4f4f1 100%);
}
.page {
  width:min(820px, calc(100% - 40px));
  margin:0 auto;
  padding:32px 0 64px;
}
.paper-title {
  max-width:700px;
  margin:0 auto 24px;
  padding:18px 22px 20px;
  text-align:center;
  background:rgba(255,255,255,.82);
  border-top:3px double var(--rule);
  border-bottom:1px solid var(--line);
}
.paper-title h1 {
  margin:0;
  color:var(--ink);
  font-family:var(--text);
  font-size:clamp(26px, 4.1vw, 42px);
  line-height:1.06;
  font-weight:740;
  letter-spacing:-.045em;
}
.paper-authors {
  margin-top:8px;
  color:var(--muted);
  font-size:13px;
  line-height:1.55;
  font-weight:500;
  letter-spacing:-.01em;
  overflow-wrap:anywhere;
}
.blocks { display:grid; gap:22px; }
.block {
  position:relative;
  background:var(--paper);
  border:1px solid var(--line);
  border-radius:2px;
  padding:30px 44px 38px;
  box-shadow:0 10px 24px rgba(40,40,40,.055);
}
.block:after {
  content:'';
  position:absolute;
  inset:8px;
  border:1px solid rgba(217,214,207,.46);
  pointer-events:none;
}
.block-head {
  position:relative;
  z-index:1;
  display:grid;
  grid-template-columns:1fr;
  gap:10px;
  align-items:start;
  border-bottom:1px solid var(--rule);
  padding-bottom:11px;
  margin-bottom:18px;
}
.block h1,
.block h2,
.block h3 {
  color:var(--ink);
  font-family:var(--text);
  font-weight:740;
  line-height:1.12;
  letter-spacing:-.035em;
}
.block-title {
  margin:0;
  font-size:26px;
}
.block[data-type="reading-guide"] {
  background:#fbfbfa;
}
.block[data-type="reading-guide"] .body {
  color:#272521;
  font-size:14px;
  line-height:1.58;
}
.location {
  margin-top:5px;
  color:var(--muted);
  font-family:var(--mono);
  font-size:10px;
  letter-spacing:.04em;
  text-transform:uppercase;
}

.paper-figure {
  break-inside:avoid;
  page-break-inside:avoid;
  position:relative;
  z-index:1;
  margin:16px auto 22px;
  max-width:700px;
  border:1px solid #d9d6cf;
  background:#ffffff;
  padding:10px;
  box-shadow:0 8px 18px rgba(40,40,40,.045);
}
.paper-figure img {
  display:block;
  width:auto;
  max-width:100%;
  max-height:min(440px, 50vh);
  margin:0 auto;
  height:auto;
  object-fit:contain;
}
.paper-figure figcaption {
  margin-top:10px;
  padding:12px 14px 14px;
  border-top:1px solid #ddd9d2;
  background:#fafafa;
  color:#2c2c2a;
  font-size:13px;
  line-height:1.64;
  text-wrap:pretty;
}
.figure-title {
  margin:0 0 9px;
  color:var(--ink);
  font-size:13.5px;
  font-weight:740;
  letter-spacing:-.012em;
}
.figure-brief {
  margin:0;
  display:grid;
  gap:0;
}
.figure-brief-row {
  break-inside:avoid;
  page-break-inside:avoid;
  display:grid;
  grid-template-columns:minmax(116px, 0.34fr) minmax(0, 1fr);
  gap:16px;
  padding:7px 0;
  border-top:1px solid rgba(217,214,207,.74);
}
.figure-brief-row:first-child { border-top:0; padding-top:0; }
.figure-brief dt {
  margin:0;
  color:#68645d;
  font-size:11px;
  line-height:1.45;
  font-weight:780;
  letter-spacing:.015em;
}
.figure-brief dd {
  margin:0;
  min-width:0;
  color:#25221e;
}
.figure-brief mjx-container {
  max-width:100%;
  overflow-x:auto;
  overflow-y:hidden;
  padding-bottom:2px;
}

.user-question {
  position:relative;
  z-index:1;
  max-width:700px;
  margin:0 auto 22px;
  padding:14px 16px;
  border-left:3px solid var(--accent);
  background:#f4f0e8;
}
.user-question-label {
  margin-bottom:5px;
  color:var(--accent);
  font-family:var(--mono);
  font-size:10px;
  font-weight:700;
  letter-spacing:.06em;
  text-transform:uppercase;
}
.user-question-text {
  color:#1f1c18;
  font-size:15px;
  line-height:1.55;
}
.latex {
  break-inside:avoid;
  page-break-inside:avoid;
  position:relative;
  z-index:1;
  margin:18px 0 24px;
  padding:18px 20px;
  overflow-x:auto;
  border:1px solid #d9d6cf;
  background:#f5f5f3;
  font-size:15px;
}
.body {
  position:relative;
  z-index:1;
  max-width:700px;
  margin:0 auto;
  color:#1d1d1d;
  font-size:15px;
  line-height:1.64;
}
.body h1 { font-size:24px; margin:22px 0 10px; }
.body h2 { font-size:21px; margin:22px 0 10px; }
.body h3 { font-size:18px; margin:18px 0 8px; }
.body .flow {
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:10px 7px;
  margin:16px 0 24px;
  padding:16px 16px;
  max-width:100%;
  min-width:0;
  overflow-wrap:anywhere;
  border:1px solid var(--line);
  border-radius:10px;
  background:#fafafa;
}
.body .flow-box {
  min-width:0;
  max-width:100%;
  border:1px solid var(--line);
  border-radius:7px;
  padding:6px 11px;
  background:#fff;
  font-size:13px;
  line-height:1.3;
  white-space:normal;
  overflow-wrap:anywhere;
  word-break:normal;
  box-shadow:0 1px 2px rgba(40,40,40,.04);
}
.body .flow-arrow { color:#9a9a9a; font-size:12px; padding:0 1px; }

/* Grouped flow: each " || " phase becomes a labeled, bordered cluster, with a
   larger separator arrow between phases and generous spacing. */
.body .flow-grouped {
  align-items:stretch;
  gap:12px 10px;
  padding:18px 16px;
}
.body .flow-group {
  display:flex;
  flex-direction:column;
  flex:1 1 220px;
  min-width:0;
  max-width:100%;
  gap:9px;
  padding:11px 13px 13px;
  border:1px solid var(--line);
  border-radius:11px;
  background:#fff;
}
.body .flow-group-label {
  font-size:10.5px;
  font-weight:700;
  letter-spacing:.04em;
  text-transform:uppercase;
  color:#7a7a7a;
}
.body .flow-grouped .flow-row {
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  min-width:0;
  max-width:100%;
  gap:9px 6px;
}
.body .flow-grouped .flow-box { background:#fafafa; }
.body .flow-sep {
  display:flex;
  align-items:center;
  color:#c2c2c2;
  font-size:17px;
  padding:0 3px;
}

.ladder-heading {
  margin:20px 0 10px;
  padding:12px 14px 10px;
  border:1px solid var(--line);
  border-left:4px solid var(--rule);
  background:#fafafa;
  box-shadow:0 6px 14px rgba(40,40,40,.04);
}
.body h3.ladder-heading + p,
.body h3.ladder-heading + ul,
.body h3.ladder-heading + ol {
  margin-top:12px;
}
.body .ladder-meta {
  border:1px solid var(--line);
  background:#fafafa;
  padding:12px 14px;
  border-radius:2px;
}
.body p { margin:12px 0; }
.body ul { margin:12px 0; padding-left:24px; }
.body li { margin:7px 0; }
.body ol { margin:12px 0; padding-left:24px; }
.body table {
  width:100%;
  margin:18px 0;
  border-collapse:collapse;
  border:1px solid var(--line);
  background:#ffffff;
  font-size:13px;
}
.body th,
.body td {
  border:1px solid var(--line);
  padding:9px 10px;
  text-align:left;
  vertical-align:top;
}
.body th {
  background:#f1f1ef;
  font-weight:740;
}
.body code {
  background:#f1f1ef;
  border:1px solid #d7d4ce;
  padding:1px 5px;
  color:#111;
  font-family:var(--mono);
  font-size:.88em;
}
.empty {
  color:var(--muted);
  font-family:var(--mono);
  font-size:12px;
  text-align:center;
}
:lang(ko) .body,
:lang(ko) .paper-figure figcaption {
  word-break:keep-all;
  overflow-wrap:normal;
  line-break:strict;
  line-height:1.72;
}
:lang(ko) .figure-brief dt { letter-spacing:0; }
:lang(ko) .figure-brief dd { word-break:keep-all; overflow-wrap:normal; }

html.papermentor-print-preview .page { width:100%; padding:0; }
html.papermentor-print-preview .paper-title {
  max-width:100%;
  margin:0 auto 12px;
  padding:10px 14px 12px;
  border-top:2px solid var(--rule);
  border-bottom:1px solid var(--line);
}
html.papermentor-print-preview .paper-title h1 { font-size:25px; line-height:1.05; letter-spacing:-.035em; }
html.papermentor-print-preview .paper-authors { font-size:10.5px; line-height:1.35; margin-top:5px; }
html.papermentor-print-preview .blocks { gap:14px; }
html.papermentor-print-preview .block { padding:18px 28px 22px; box-shadow:none; }
html.papermentor-print-preview .block:after { inset:5px; }
html.papermentor-print-preview .block-head { padding-bottom:8px; margin-bottom:12px; }
html.papermentor-print-preview .block-title { font-size:19px; }
html.papermentor-print-preview .location { font-size:8.5px; margin-top:3px; }
html.papermentor-print-preview .body { max-width:100%; font-size:11.8px; line-height:1.42; }
html.papermentor-print-preview .block[data-type="reading-guide"] { padding:12px 22px 13px; }
html.papermentor-print-preview .block[data-type="reading-guide"] .block-head { padding-bottom:5px; margin-bottom:7px; }
html.papermentor-print-preview .block[data-type="reading-guide"] .block-title { font-size:15px; }
html.papermentor-print-preview .block[data-type="reading-guide"] .location { display:none; }
html.papermentor-print-preview .block[data-type="reading-guide"] .body { font-size:9.8px; line-height:1.28; }
html.papermentor-print-preview .block[data-type="reading-guide"] .body p { margin:3px 0; }
html.papermentor-print-preview .body h1 { font-size:19px; margin:13px 0 7px; }
html.papermentor-print-preview .body h2 { font-size:15.5px; margin:10px 0 5px; }
html.papermentor-print-preview .body h3 { font-size:15px; margin:11px 0 6px; }
html.papermentor-print-preview .body p { margin:5px 0; }
html.papermentor-print-preview .body ul,
html.papermentor-print-preview .body ol { margin:7px 0; }
html.papermentor-print-preview .body li { margin:3px 0; }
html.papermentor-print-preview .paper-figure { max-width:600px; margin:8px auto 10px; padding:7px; }
html.papermentor-print-preview .block[data-type="start-here"] .paper-figure { max-width:var(--papermentor-start-figure-max-width, 600px); }
html.papermentor-print-preview .paper-figure img { max-height:238px; }
html.papermentor-print-preview .block[data-type="start-here"] .paper-figure img { max-height:var(--papermentor-start-image-max-height, 260px); }
html.papermentor-print-preview .paper-figure figcaption { margin-top:7px; padding:7px 9px 8px; font-size:9.8px; line-height:1.28; }
html.papermentor-print-preview .figure-title { font-size:10.5px; margin-bottom:4px; }
html.papermentor-print-preview .figure-brief-row { grid-template-columns:102px minmax(0,1fr); gap:8px; padding:3px 0; }
html.papermentor-print-preview .figure-brief dt { font-size:7.8px; line-height:1.2; }
html.papermentor-print-preview .latex { font-size:12px; padding:10px 12px; margin:10px 0 12px; }

@media print {
  @page { size:A4; margin:10mm 10mm 12mm; }
  :root { --papermentor-start-image-max-height: 260px; --papermentor-start-figure-max-width: 600px; }
  html, body { background:var(--field); }
  .page { width:100%; padding:0; }
  .paper-title {
    max-width:100%;
    margin:0 auto 12px;
    padding:10px 14px 12px;
    border-top:2px solid var(--rule);
    border-bottom:1px solid var(--line);
  }
  .paper-title h1 {
    font-size:25px;
    line-height:1.05;
    letter-spacing:-.035em;
  }
  .paper-authors { font-size:10.5px; line-height:1.35; margin-top:5px; }
  .blocks { gap:14px; }
  .block {
    padding:18px 28px 22px;
    box-shadow:none;
    break-inside:auto;
    page-break-inside:auto;
    /* Re-draw the card border on every page fragment so a block that spans a
       page break closes cleanly at the bottom of one page and the top of the
       next, instead of leaving an open-looking edge. */
    -webkit-box-decoration-break:clone;
    box-decoration-break:clone;
  }
  /* The decorative inset frame is position:absolute, so it cannot fragment
     across pages and would otherwise leave a clipped stray rectangle on the
     trailing blank space. The cloned outer border already frames each page. */
  .block:after { display:none; }
  .block-head { padding-bottom:8px; margin-bottom:12px; }
  .block-title { font-size:19px; }
  .location { font-size:8.5px; margin-top:3px; }
  .body { max-width:100%; font-size:11.8px; line-height:1.42; }
  .block[data-type="reading-guide"] {
    padding:12px 22px 13px;
  }
  .block[data-type="reading-guide"] .block-head {
    padding-bottom:5px;
    margin-bottom:7px;
  }
  .block[data-type="reading-guide"] .block-title { font-size:15px; }
  .block[data-type="reading-guide"] .location { display:none; }
  .block[data-type="reading-guide"] .body {
    font-size:9.8px;
    line-height:1.28;
  }
  .block[data-type="reading-guide"] .body p { margin:3px 0; }
  .body h1 { font-size:19px; margin:13px 0 7px; }
  .body h2 { font-size:15.5px; margin:10px 0 5px; }
  .body h3 { font-size:15px; margin:11px 0 6px; }
  .body p { margin:5px 0; }
  .body ul, .body ol { margin:7px 0; }
  .body li { margin:3px 0; break-inside:avoid; page-break-inside:avoid; }
  /* Keep a ladder/section heading attached to the content beneath it so a
     heading never strands alone at the bottom of a page. */
  .body h1, .body h2, .body h3 { break-after:avoid; page-break-after:avoid; }
  .paper-figure {
    max-width:600px;
    margin:8px auto 10px;
    padding:7px;
    break-inside:avoid;
    page-break-inside:avoid;
  }
  .block[data-type="start-here"] .paper-figure {
    max-width:var(--papermentor-start-figure-max-width, 600px);
    break-after:page;
    page-break-after:always;
  }
  .paper-figure img { max-height:238px; }
  .block[data-type="start-here"] .paper-figure img { max-height:var(--papermentor-start-image-max-height, 260px); }
  .paper-figure figcaption {
    margin-top:7px;
    padding:7px 9px 8px;
    font-size:9.8px;
    line-height:1.28;
  }
  .figure-title { font-size:10.5px; margin-bottom:4px; }
  .figure-brief-row {
    grid-template-columns:102px minmax(0,1fr);
    gap:8px;
    padding:3px 0;
    break-inside:avoid;
    page-break-inside:avoid;
  }
  .figure-brief dt { font-size:7.8px; line-height:1.2; }
  .latex { font-size:12px; padding:10px 12px; margin:10px 0 12px; }
}

@media (max-width: 640px) {
  .page { width:min(100% - 24px, 900px); padding:24px 0 52px; }
  .paper-title { padding:18px 14px 20px; margin-bottom:22px; }
  .block { padding:30px 24px 34px; }
  .block:after { inset:7px; }
  .block-head { grid-template-columns:1fr; gap:10px; }
  .block-title { font-size:26px; }
  .body { font-size:15px; }
  .figure-brief-row { grid-template-columns:1fr; gap:4px; }
}
</style>
</head>
<body>
<main class="page">
  <header class="paper-title">
    <h1>${escapeHtml(state.title || 'Paper reading session')}</h1>
    ${state.authors ? `<div class="paper-authors">${escapeHtml(state.authors)}</div>` : ''}
  </header>
  <section class="blocks">
    ${(cards.cards || []).map((card, index) => renderCardArticle(localizeReadingGuide(card, lang, slug, state.sourceMode), index)).join('\n') || '<article class="block empty">No paper blocks yet.</article>'}
  </section>
</main>
<script>
(() => {
  function paperMentorCssPxPerMm() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-10000px;top:-10000px;width:100mm;height:1mm;visibility:hidden;';
    document.body.appendChild(probe);
    const px = probe.getBoundingClientRect().width / 100;
    probe.remove();
    return px || 3.78;
  }

  function fitPaperMentorStartFigure() {
    const figure = document.querySelector('.block[data-type="start-here"] .paper-figure');
    const image = figure && figure.querySelector('img');
    if (!figure || !image) return;
    const pxPerMm = paperMentorCssPxPerMm();
    const pageContentHeight = 275 * pxPerMm; // A4 height minus @page top/bottom margins: 297mm - 10mm - 12mm.
    const bodyTop = document.body.getBoundingClientRect().top;
    const figureRect = figure.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const nonImageHeight = Math.max(0, figureRect.height - imageRect.height);
    const usedBeforeFigure = figureRect.top - bodyTop;
    const bottomBreathingRoom = 4 * pxPerMm;
    const rawTargetHeight = Math.floor(pageContentHeight - usedBeforeFigure - nonImageHeight - bottomBreathingRoom);
    let targetHeight = rawTargetHeight;
    let targetWidth = 600;
    if (image.naturalWidth && image.naturalHeight) {
      const page = document.querySelector('.page');
      const availableFigureWidth = Math.max(600, Math.min(720, Math.floor((page?.clientWidth || 760) - 70)));
      const widthNeededForHeight = Math.floor(rawTargetHeight * image.naturalWidth / image.naturalHeight);
      targetWidth = Math.max(600, Math.min(availableFigureWidth, widthNeededForHeight));
      const widthLimitedHeight = image.naturalHeight * (targetWidth / image.naturalWidth);
      targetHeight = Math.min(rawTargetHeight, Math.floor(widthLimitedHeight));
    }
    targetHeight = Math.max(180, Math.min(targetHeight, 640));
    document.documentElement.style.setProperty('--papermentor-start-figure-max-width', targetWidth + 'px');
    document.documentElement.style.setProperty('--papermentor-start-image-max-height', targetHeight + 'px');
    document.documentElement.dataset.paperMentorStartFigureWidth = String(targetWidth);
    document.documentElement.dataset.paperMentorStartImageHeight = String(targetHeight);
  }

  function queuePaperMentorFigureFit() {
    requestAnimationFrame(() => requestAnimationFrame(fitPaperMentorStartFigure));
  }

  window.addEventListener('load', queuePaperMentorFigureFit);
  window.addEventListener('beforeprint', fitPaperMentorStartFigure);
  window.addEventListener('resize', queuePaperMentorFigureFit);
  if (document.readyState !== 'loading') queuePaperMentorFigureFit();
  if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
    window.MathJax.startup.promise.then(queuePaperMentorFigureFit).catch(() => {});
  }
})();

(() => {
  const initialUpdatedAt = ${JSON.stringify(Number(Date.parse(state.updatedAt || '')) || 0)};
  if (!initialUpdatedAt || window.__paperMentorAutoRefresh) return;
  window.__paperMentorAutoRefresh = true;
  async function checkForPaperMentorUpdate() {
    if (document.hidden) return;
    try {
      const response = await fetch('state.json?papermentor=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return;
      const latest = await response.json();
      const latestUpdatedAt = Number(Date.parse(latest && latest.updatedAt ? latest.updatedAt : '')) || 0;
      if (latestUpdatedAt && latestUpdatedAt !== initialUpdatedAt) window.location.reload();
    } catch (_) {
      // Some browsers block file:// polling. In that case the reading guide tells users to reload manually.
    }
  }
  window.setInterval(checkForPaperMentorUpdate, 2200);
})();
</script>
</body>
</html>`;
  writeFileSync(indexPath(slug), html);
}


function renderCardArticle(card, index) {
  const figureSourceBody = card.figure ? bodyWithoutFigureExplanation(card.body || '') : (card.body || '');
  const baseBody = htmlExplanationOnly(figureSourceBody);
  const figure = renderFigure(card.figure, figureExplanationMarkdown(card));
  const typeAttr = slugify(card.type || 'note');
  const head = `<article id="${escapeHtml(card.id)}" class="block" data-type="${escapeHtml(typeAttr)}" data-index="${index + 1}"><header class="block-head"><div><h2 class="block-title">${escapeHtml(displayCardTitle(card))}</h2><div class="location">${escapeHtml(card.location)}</div></div></header>${renderUserQuestion(card)}${card.latex ? `<div class="latex">$$
${escapeHtml(card.latex)}
$$</div>` : ''}`;
  if (card.type === 'start-here' && figure) {
    const { lead, rest } = splitStartHereLead(baseBody);
    return `${head}${lead ? `<div class="body">${markdownToHtml(lead)}</div>` : ''}${figure}${rest ? `<div class="body">${markdownToHtml(rest)}</div>` : ''}</article>`;
  }
  return `${head}${figure}<div class="body">${markdownToHtml(baseBody)}</div></article>`;
}

function renderUserQuestion(card) {
  const question = String(card?.userQuestion || '').trim();
  if (!question) return '';
  return `<aside class="user-question"><div class="user-question-label">User question</div><div class="user-question-text">${formatInline(escapeHtml(question))}</div></aside>`;
}

function renderFigure(figure, explanation = '') {
  if (!figure || !figure.src) return '';
  const captionMarkdown = String(explanation || figure.caption || '').trim();
  const caption = captionMarkdown ? `<figcaption>${figureCaptionHtml(captionMarkdown)}</figcaption>` : '';
  return `<figure class="paper-figure"><img src="${escapeHtml(figure.src)}" alt="${escapeHtml(figure.alt || 'Paper figure')}" decoding="sync" fetchpriority="high" />${caption}</figure>`;
}

function cleanFigureCaptionValue(value) {
  return String(value || '')
    .replace(/(\$\$[\s\S]*?\$\$)[.。]\s*$/g, '$1')
    .replace(/\s+([.,;:!?。])/g, '$1')
    .trim();
}

function figureCaptionHtml(markdown) {
  const lines = String(markdown || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let title = '';
  const rows = [];
  const prose = [];
  for (const line of lines) {
    const titleMatch = line.match(/^\*\*(.+)\*\*$/);
    if (titleMatch && !title) {
      title = titleMatch[1].trim();
      continue;
    }
    const rowMatch = line.match(/^-\s+\*\*([^*:]+):\*\*\s*([\s\S]+)$/);
    if (rowMatch) {
      rows.push({ label: rowMatch[1].trim(), value: cleanFigureCaptionValue(rowMatch[2]) });
      continue;
    }
    prose.push(line);
  }
  const titleHtml = title ? `<p class="figure-title">${formatInline(escapeHtml(title))}</p>` : '';
  if (rows.length) {
    const rowHtml = rows.map(({ label, value }) => `<div class="figure-brief-row"><dt>${escapeHtml(label)}</dt><dd>${formatInline(escapeHtml(value))}</dd></div>`).join('');
    const proseHtml = prose.length ? `<div class="figure-caption-prose">${markdownToHtml(prose.join('\n'))}</div>` : '';
    return `${titleHtml}<dl class="figure-brief">${rowHtml}</dl>${proseHtml}`;
  }
  return markdownToHtml(markdown);
}

function displayCardTitle(card) {
  const title = String(card?.title || card?.type || 'Paper block').trim();
  const bareEquation = title.match(/^Equation\s*\(([^)]+)\)$/i);
  if (bareEquation) return `Equation block — Eq. (${bareEquation[1].trim()})`;
  return title;
}

function normalizeHeading(value) {
  return String(value || '').trim().toLowerCase().replace(/[:.!?]+$/g, '');
}

function isFigureExplanationHeading(title) {
  const normalized = normalizeHeading(title);
  return /^(main\s+method\s+figu?re|main\s+figu?re|representative\s+(method\s+)?figu?re|representative\s+figu?re\s+explanation|figu?re\s+explanation|figu?re\s+explanation\s+under\s+image)$/.test(normalized)
    || /^(그림\s*설명|이미지\s*아래\s*설명|대표\s*(그림|도식|피겨)|대표\s*(그림|도식|피겨)\s*설명|방법\s*(그림|도식|피겨)\s*설명)$/.test(normalized);
}

function splitFigureExplanationSection(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const body = [];
  const figure = [];
  let inFigure = false;
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      if (isFigureExplanationHeading(heading[2])) {
        inFigure = true;
        continue;
      }
      if (inFigure) inFigure = false;
    }
    if (inFigure) figure.push(line);
    else body.push(line);
  }
  return { body: body.join('\n').trim(), figure: figure.join('\n').trim() };
}

function bodyWithoutFigureExplanation(markdown) {
  return splitFigureExplanationSection(markdown).body;
}

function isStartHereLeadHeading(title) {
  const normalized = normalizeHeading(title);
  return /^(one[-\s]?sentence\s+(paper\s+)?model|one[-\s]?sentence\s+summary|one[-\s]?sentence\s+orientation|what\s+this\s+(paper|source|note|slides)\s+does|(paper|source|note|slides)\s+model|paper\s+in\s+one\s+sentence)$/.test(normalized)
    || /^(한\s*문장\s*(논문\s*)?(요약|모델)|이\s*논문이\s*하는\s*일)$/.test(normalized);
}

function splitStartHereLead(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const lead = [];
  const rest = [];
  let inLead = false;
  let consumedLead = false;
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading && isStartHereLeadHeading(heading[2]) && !consumedLead) {
      inLead = true;
      consumedLead = true;
      lead.push(line);
      continue;
    }
    if (heading && inLead) inLead = false;
    if (inLead) lead.push(line);
    else rest.push(line);
  }
  return {
    lead: lead.join('\n').trim(),
    rest: rest.join('\n').trim()
  };
}

function stripBulletLabel(line) {
  return String(line || '')
    .replace(/^-\s+/, '')
    .replace(/^\*\*([^*:]+):\*\*\s*/, '$1: ')
    .replace(/^\*\*([^*]+)\*\*:\s*/, '$1: ')
    .trim();
}

function labeledFigureFacts(markdown) {
  const facts = {};
  for (const raw of String(markdown || '').split(/\r?\n/)) {
    const line = stripBulletLabel(raw);
    const match = line.match(/^([^:]{2,80}):\s*(.+)$/);
    if (!match) continue;
    const key = normalizeHeading(match[1]).replace(/\s+or\s+/g, ' / ');
    facts[key] = match[2].trim();
  }
  return facts;
}

function sentence(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function figureExplanationMarkdown(card) {
  if (!card?.figure) return '';
  const section = splitFigureExplanationSection(card.body || '').figure;
  const facts = labeledFigureFacts(section);
  const rawSemanticCaption = String(card.figure.caption || '').trim();
  const semanticCaption = isProvenanceOnlyCaption(rawSemanticCaption) ? '' : rawSemanticCaption;
  const korean = containsKorean(section || card.body || card.title);
  const identity = semanticCaption
    || facts['figure / location']
    || facts['figure location']
    || facts['그림 / 위치']
    || facts['그림 위치']
    || facts['위치']
    || '';
  const role = facts['concept / method role']
    || facts['concept / architecture role']
    || facts['architecture / method role']
    || facts['method role']
    || facts['what it shows']
    || facts['why this is the representative figure']
    || facts['why this figure matters']
    || facts['개념 / 방법 역할']
    || facts['아키텍처 / 방법 역할']
    || facts['방법 역할']
    || facts['무엇을 보여주는가']
    || facts['보여주는 것']
    || facts['왜 대표 그림인가']
    || facts['왜 이 그림이 중요한가']
    || '';
  const how = facts['how to read it']
    || facts['how to read']
    || facts['reading guide']
    || facts['보는 법']
    || facts['읽는 법']
    || facts['해석 방법']
    || '';
  const partsGuide = facts['parts to identify']
    || facts['component guide']
    || facts['components']
    || facts['parts']
    || facts['각 부분']
    || facts['구성요소']
    || facts['구성 요소']
    || '';
  const math = facts['in-figure math / symbols']
    || facts['in-figure math']
    || facts['figure math / symbols']
    || facts['figure math']
    || facts['math / symbols']
    || facts['math in the figure']
    || facts['equations in the figure']
    || facts['그림 속 수식 / 기호']
    || facts['그림 속 수식']
    || facts['그림 내 수식 / 기호']
    || facts['그림 내 수식']
    || facts['수식 / 기호']
    || '';
  const flow = facts['flow / sequence']
    || facts['flow or sequence']
    || facts['흐름 / 순서']
    || facts['흐름 또는 순서']
    || facts['해석 순서']
    || '';
  const observe = facts['what to observe']
    || facts['관찰할 점']
    || facts['핵심 관찰']
    || facts['봐야 할 점']
    || '';
  const supports = facts['equations / claims it supports']
    || facts['equations or claims it supports']
    || facts['연결되는 수식 / 주장']
    || facts['연결되는 수식 또는 주장']
    || facts['지원하는 수식 또는 주장']
    || facts['관련 수식']
    || '';
  const parts = [];
  if (identity) parts.push(`**${sentence(identity)}**`);
  const labels = korean
    ? {
        role: '개념 / 방법 역할',
        how: '보는 법',
        parts: '각 부분',
        math: '그림 속 수식 / 기호',
        flow: '흐름 / 순서',
        observe: '관찰할 점',
        supports: '연결되는 수식 / 주장'
      }
    : {
        role: 'Concept / method role',
        how: 'How to read it',
        parts: 'Parts to identify',
        math: 'In-figure math / symbols',
        flow: 'Flow / sequence',
        observe: 'What to observe',
        supports: 'Equations / claims it supports'
      };
  // Render only what the reader actually wrote. Do not synthesise generic "name the
  // parts then follow the arrows" filler when a slot is missing — an empty slot means
  // the figure has not been read at that depth yet, and fake advice hides that gap.
  if (role) parts.push(`- **${labels.role}:** ${sentence(role)}`);
  if (how) parts.push(`- **${labels.how}:** ${sentence(how)}`);
  if (partsGuide) parts.push(`- **${labels.parts}:** ${sentence(partsGuide)}`);
  if (math) parts.push(`- **${labels.math}:** ${sentence(math)}`);
  if (flow) parts.push(`- **${labels.flow}:** ${sentence(flow)}`);
  if (observe) parts.push(`- **${labels.observe}:** ${sentence(observe)}`);
  if (supports) parts.push(`- **${labels.supports}:** ${sentence(supports)}`);
  if (parts.length) return parts.join('\n');
  return semanticCaption;
}

function htmlExplanationOnly(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const kept = [];
  let skipping = false;
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const title = heading[2].trim().toLowerCase().replace(/[:.!?]+$/g, '');
      skipping = /^(cli-only.*|likely\s+blockers?|blockers?|likely\s+confusion.*|confusion\s+risk.*|recommended\s+next|next\s+actions?|choose\s+next|diagnostic\s+questions?)$/.test(title);
      if (skipping) continue;
    }
    if (!skipping) kept.push(line);
  }
  return kept.join('\n').trim();
}

function markdownToHtml(markdown) {
  const escaped = escapeHtml(markdown);
  const lines = escaped.split(/\r?\n/);
  let html = '';
  let listType = '';
  let tableRows = [];
  const closeList = () => {
    if (!listType) return;
    html += `</${listType}>`;
    listType = '';
  };
  const isTableRow = (line) => /^\s*\|.+\|\s*$/.test(line);
  const isTableSeparator = (line) => /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*$/.test(line);
  const tableCells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
  const closeTable = () => {
    if (!tableRows.length) return;
    const [head, ...body] = tableRows;
    html += '<table><thead><tr>';
    for (const cell of head) html += `<th>${formatInline(cell)}</th>`;
    html += '</tr></thead>';
    if (body.length) {
      html += '<tbody>';
      for (const row of body) {
        html += '<tr>';
        for (const cell of row) html += `<td>${formatInline(cell)}</td>`;
        html += '</tr>';
      }
      html += '</tbody>';
    }
    html += '</table>';
    tableRows = [];
  };
  const closeBlocks = () => { closeList(); closeTable(); };
  const displayMathBlock = (delimiter, endDelimiter, index) => {
    const collected = [lines[index]];
    let cursor = index;
    const sameLineClosed = delimiter === endDelimiter
      ? (lines[index].trim().startsWith(delimiter) && lines[index].trim().endsWith(endDelimiter) && lines[index].trim().length > delimiter.length * 2)
      : lines[index].trim() === endDelimiter;
    if (!sameLineClosed) {
      cursor += 1;
      while (cursor < lines.length) {
        collected.push(lines[cursor]);
        if (lines[cursor].trim() === endDelimiter || (endDelimiter === '$$' && lines[cursor].trim().endsWith('$$') && cursor !== index)) break;
        cursor += 1;
      }
    }
    closeBlocks();
    html += `<div class="latex">${collected.join('\n')}</div>`;
    return cursor;
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '\\[') { i = displayMathBlock('\\[', '\\]', i); }
    else if (trimmed === '$$' || (trimmed.startsWith('$$') && !trimmed.endsWith('$$'))) { i = displayMathBlock('$$', '$$', i); }
    else if (isTableRow(line)) {
      closeList();
      if (!isTableSeparator(line)) tableRows.push(tableCells(line));
    }
    else if (/^flow:\s*/i.test(trimmed)) {
      // Block diagram. "flow: A → B → C" renders as a spaced strip of pill boxes.
      // " || " splits the chain into phase groups, and a leading "[label]" names a
      // phase, e.g. "flow: [basics] A → B || [model] C → D". No Mermaid/SVG, and
      // never a paper-figure claim.
      closeBlocks();
      const arrow = '<span class="flow-arrow" aria-hidden="true">→</span>';
      const splitSteps = (text) => text.split(/\s*(?:→|-&gt;|->)\s*/).map((step) => step.trim()).filter(Boolean);
      const pill = (step) => `<span class="flow-box">${formatInline(step)}</span>`;
      const rawGroups = trimmed.replace(/^flow:\s*/i, '').split(/\s*\|\|\s*/).map((group) => group.trim()).filter(Boolean);
      const grouped = rawGroups.length > 1 || /^\[/.test(rawGroups[0] || '');
      if (!grouped) {
        const boxes = splitSteps(rawGroups[0] || '').map(pill).join(arrow);
        if (boxes) html += `<div class="flow">${boxes}</div>`;
      } else {
        const groupsHtml = rawGroups.map((group) => {
          const labelMatch = group.match(/^\[([^\]]+)\]\s*(.*)$/);
          const label = labelMatch ? labelMatch[1].trim() : '';
          const steps = splitSteps(labelMatch ? labelMatch[2] : group);
          if (!steps.length) return '';
          const labelHtml = label ? `<div class="flow-group-label">${formatInline(label)}</div>` : '';
          return `<div class="flow-group">${labelHtml}<div class="flow-row">${steps.map(pill).join(arrow)}</div></div>`;
        }).filter(Boolean);
        if (groupsHtml.length) {
          html += `<div class="flow flow-grouped">${groupsHtml.join('<span class="flow-sep" aria-hidden="true">→</span>')}</div>`;
        }
      }
    }
    else if (/^###\s+/.test(line)) {
      closeBlocks();
      const title = line.replace(/^###\s+/, '');
      const ladderClass = /^(?:\d+\.|Step\s+\d+|Layer\s+\d+)/i.test(stripAnsi(title)) ? ' class="ladder-heading"' : '';
      html += `<h3${ladderClass}>${title}</h3>`;
    }
    else if (/^##\s+/.test(line)) { closeBlocks(); html += `<h2>${line.replace(/^##\s+/, '')}</h2>`; }
    else if (/^#\s+/.test(line)) { closeBlocks(); html += `<h1>${line.replace(/^#\s+/, '')}</h1>`; }
    else if (/^-\s+/.test(line)) {
      closeTable();
      if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
      html += `<li>${formatInline(line.replace(/^-\s+/, ''))}</li>`;
    }
    else if (/^\d+\.\s+/.test(line)) {
      closeTable();
      if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
      html += `<li>${formatInline(line.replace(/^\d+\.\s+/, ''))}</li>`;
    }
    else if (trimmed === '') { closeBlocks(); }
    else { closeBlocks(); html += `<p>${formatInline(line)}</p>`; }
  }
  closeBlocks();
  return html;
}

function formatInline(value) {
  // Stash inline code and math first so emphasis/link rules never corrupt LaTeX
  // subscripts ($s_{y_j}$) or code spans. Sentinels are Private-Use-Area chars
  // built at runtime: they cannot appear in source text and escapeHtml ignores them.
  const L = String.fromCharCode(0xE000);
  const R = String.fromCharCode(0xE001);
  const stash = [];
  const hold = (html) => {
    const token = L + stash.length + R;
    stash.push(html);
    return token;
  };
  let s = String(value)
    .replace(/`([^`]+?)`/g, (_m, inner) => hold(`<code>${inner}</code>`))
    .replace(/\$\$[\s\S]+?\$\$/g, (m) => hold(m))
    .replace(/\$[^\$\n]+?\$/g, (m) => hold(m))
    .replace(/\\\([\s\S]+?\\\)/g, (m) => hold(m))
    .replace(/\\\[[\s\S]+?\\\]/g, (m) => hold(m));
  s = s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w$])_(?=\S)(.+?)(?<=\S)_(?![\w$])/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, href) => {
      const safeHref = safeMarkdownHref(href);
      return safeHref ? `<a href=\"${escapeHtml(safeHref)}\" target=\"_blank\" rel=\"noopener\">${label}</a>` : label;
    });
  const restore = new RegExp(L + "(\\d+)" + R, "g");
  return s.replace(restore, (_m, idx) => stash[Number(idx)]);
}

function line(width = 74) { return '─'.repeat(width); }
function trim(value, width = 62) {
  const s = String(value || '');
  return s.length > width ? `${s.slice(0, width - 1)}…` : s;
}
function printConsole(state, cards = readJson(cardsPath(state.slug), { cards: [] })) {
  const width = 78;
  const title = trim(state.title, 58);
  console.log(`╭${line(width)}╮`);
  console.log(`│  ✦ PaperMentor ${' '.repeat(width - 17)}│`);
  console.log(`│  HTML-first reading room · ${sourceModeLabel(state.sourceMode).padEnd(width - 30)}│`);
  console.log(`├${line(width)}┤`);
  console.log(`│  ${title.padEnd(width - 3)}│`);
  console.log(`│  View  ${trim(state.renderedView, width - 10).padEnd(width - 8)}│`);
  if (state.currentSection) console.log(`│  Focus ${trim(state.currentSection, width - 10).padEnd(width - 8)}│`);
  if (state.pendingBlockPrompt) console.log(`│  Prompt ${trim(state.pendingBlockPrompt, width - 11).padEnd(width - 9)}│`);
  console.log(`╰${line(width)}╯`);
  console.log('\nOpen the HTML first. Use the CLI for navigation, section choices, and questions.');
  if (state.figureQualityWarning) {
    console.log(`\nFigure QA: ${state.figureQualityWarning}`);
    console.log(`  Run: ${cliCommand()} preview-crops --session ${state.slug}`);
  }
  if ((state.paperSections || []).length && !state.currentSection) {
    console.log(`\n${sectionListHeading(state.sourceMode)}`);
    (state.paperSections || []).forEach((section, index) => console.log(`  ${index === 0 ? '◆' : '◇'} [${index + 1}] ${section}`));
  } else if (state.currentSection && !state.currentMode) {
    console.log(`\nSelected section: ${state.currentSection}`);
    console.log('\nSection actions');
    (state.nextChoices || []).forEach((choice, index) => console.log(`  ${index === 0 ? '◆' : '◇'} [${index + 1}] ${choice}`));
  } else {
    console.log('\nChoose next');
    (state.nextChoices || []).forEach((choice, index) => console.log(`  ${index === 0 ? '◆' : '◇'} [${index + 1}] ${choice}`));
  }
  console.log(`\nBlocks in HTML: ${(cards.cards || []).length} · Runner: ${cliCommand()} run --session ${state.slug} --index <n>`);
}

const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  amber: '\x1b[33m',
  inverse: '\x1b[7m',
  clear: '\x1b[2J\x1b[H',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  altScreen: '\x1b[?1049h',
  normalScreen: '\x1b[?1049l'
};

function stripAnsi(value) {
  return String(value || '').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}

function visibleLength(value) {
  return stripAnsi(value).length;
}

function padVisible(value, width) {
  const text = String(value || '');
  const pad = Math.max(0, width - visibleLength(text));
  return `${text}${' '.repeat(pad)}`;
}

function fitVisible(value, width) {
  const text = String(value || '');
  if (visibleLength(text) <= width) return text;
  return trim(stripAnsi(text), Math.max(1, width));
}

function terminalBoxWidth(defaultWidth = 96) {
  const columns = Number(process.stdout?.columns || process.env.COLUMNS || 0);
  if (!columns) return defaultWidth;
  return Math.max(52, Math.min(defaultWidth, columns - 1));
}

function terminalItemLimit(defaultLimit = 14) {
  const rows = Number(process.stdout?.rows || process.env.LINES || 0);
  if (!rows) return defaultLimit;
  return Math.max(3, Math.min(defaultLimit, rows - 13));
}

function visibleWindow(items, selected, limit) {
  const all = items || [];
  if (all.length <= limit) return { start: 0, entries: all };
  let start = Math.max(0, selected - Math.floor(limit / 2));
  start = Math.min(start, Math.max(0, all.length - limit));
  return { start, entries: all.slice(start, start + limit) };
}

function boxLine(content = '', width = 84, color = ansi.cyan) {
  const innerWidth = Math.max(1, width - 4);
  const fitted = fitVisible(content, innerWidth);
  return `${color}│${ansi.reset} ${padVisible(fitted, innerWidth)} ${color}│${ansi.reset}`;
}

function wrapPlainText(text, width) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (visibleLength(next) <= width || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function boxWrappedText(content = '', width = 84, color = ansi.cyan, style = '') {
  const innerWidth = Math.max(1, width - 4);
  return wrapPlainText(stripAnsi(content), innerWidth).map((line) => boxLine(`${style}${line}${style ? ansi.reset : ''}`, width, color));
}

function isTopicPickerOpen(state) {
  return Boolean(state?.topicPickerOpen);
}

function isChoosingTopic(state) {
  return Boolean((state?.paperSections || []).length && (!state.currentSection || isTopicPickerOpen(state)));
}

function currentMenuLabel(state) {
  if (isChoosingTopic(state)) return sectionListHeading(state.sourceMode);
  if (state.currentSection && !state.currentMode) return 'Section actions';
  return 'Choose next';
}

function currentMenuItems(state) {
  if (isChoosingTopic(state)) return state.paperSections || [];
  return state.nextChoices || [];
}

function tuiMenuItems(state) {
  const items = currentMenuItems(state);
  if (!isChoosingTopic(state) && (state.paperSections || []).length && state.currentSection) {
    return ['Change topic / section list', ...items];
  }
  return items;
}

function renderTuiScreen(state, selected = 0) {
  const cards = readJson(cardsPath(state.slug), { cards: [] });
  const width = terminalBoxWidth(96);
  const items = tuiMenuItems(state);
  const choosingTopic = isChoosingTopic(state);
  const label = currentMenuLabel(state);
  const focus = choosingTopic ? `choose a ${sourceModeNoun(state.sourceMode)} topic` : `${state.currentSection || state.title}${state.currentMode ? ` · ${state.currentMode}` : ''}`;
  const hasStartHere = (cards.cards || []).some((card) => card.type === 'start-here' && !/Not built yet|Not written yet/.test(card.body || ''));
  const startHereStatus = state.startHerePending || state.pendingBlockType === 'start-here'
    ? `${ansi.amber}pending${ansi.reset}`
    : hasStartHere ? `${ansi.green}complete${ansi.reset}` : `${ansi.dim}not started${ansi.reset}`;
  const top = `${ansi.green}╭${'─'.repeat(width - 2)}╮${ansi.reset}`;
  const bottom = `${ansi.green}╰${'─'.repeat(width - 2)}╯${ansi.reset}`;
  const rows = [
    top,
    boxLine(`${ansi.bold}${ansi.green}✦ PaperMentor Skill${ansi.reset} ${ansi.dim}command palette${ansi.reset}`, width, ansi.green),
    boxLine(`${ansi.dim}↑/↓ move · Enter select · b/← topics · / ask · o open HTML · n new · r Start Here · e export · q quit${ansi.reset}`, width, ansi.green),
    `${ansi.green}├${'─'.repeat(width - 2)}┤${ansi.reset}`,
    boxLine(`${ansi.dim}Current room:${ansi.reset} ${ansi.bold}${trim(state.title, 70)}${ansi.reset}`, width, ansi.green),
    boxLine(`${ansi.dim}HTML:${ansi.reset} ${ansi.green}${state.renderedView || `.papermentor/sessions/${state.slug}/index.html`}${ansi.reset}`, width, ansi.green),
    boxLine(`${ansi.dim}Start Here:${ansi.reset} ${startHereStatus}   ${ansi.dim}Blocks:${ansi.reset} ${cards.cards?.length || 0}   ${ansi.dim}Mode:${ansi.reset} ${sourceModeLabel(state.sourceMode)}`, width, ansi.green),
    boxLine(`${ansi.dim}Current topic:${ansi.reset} ${trim(focus, 72)}`, width, ansi.green),
    state.pendingBlockPrompt
      ? boxLine(`${ansi.dim}Pending prompt:${ansi.reset} ${ansi.amber}${trim(state.pendingBlockPrompt, 68)}${ansi.reset}`, width, ansi.green)
      : boxLine(`${ansi.dim}Runner:${ansi.reset} choose an item; explanations are appended to HTML, not dumped here`, width, ansi.green),
    `${ansi.green}├${'─'.repeat(width - 2)}┤${ansi.reset}`,
    boxLine(`${ansi.bold}${label}${ansi.reset}`, width, ansi.green)
  ];
  const visibleItems = items.length ? items : ['Section menu pending — generate content-adapted choices from the source excerpt'];
  const { start, entries } = visibleWindow(visibleItems, selected, terminalItemLimit(14));
  if (start > 0) rows.push(boxLine(`${ansi.dim}… ${start} item(s) above${ansi.reset}`, width, ansi.cyan));
  entries.forEach((item, offset) => {
    const index = start + offset;
    const active = index === selected;
    const pointer = active ? `${ansi.inverse}${ansi.bold} ${String(index + 1).padStart(2, '0')} ${ansi.reset}` : `${ansi.dim} ${String(index + 1).padStart(2, '0')} ${ansi.reset}`;
    const prefix = active ? `${ansi.green}◆${ansi.reset}` : `${ansi.dim}◇${ansi.reset}`;
    const text = active ? `${ansi.bold}${item}${ansi.reset}` : item;
    rows.push(boxLine(`${prefix} ${pointer} ${trim(text, Math.max(24, width - 24))}`, width, active ? ansi.green : ansi.cyan));
  });
  if (start + entries.length < visibleItems.length) rows.push(boxLine(`${ansi.dim}… ${visibleItems.length - start - entries.length} item(s) below${ansi.reset}`, width, ansi.cyan));
  rows.push(`${ansi.green}├${'─'.repeat(width - 2)}┤${ansi.reset}`);
  rows.push(boxLine(`${ansi.amber}Palette:${ansi.reset} pm open · pm go · pm ask "…" · pm <file-or-url>  ${ansi.dim}(also: ${cliCommand()} open)${ansi.reset}`, width, ansi.green));
  rows.push(bottom);
  return rows.join('\n');
}



function clearPendingPrompt(state) {
  if (!state?.slug) return;
  delete state.pendingBlockPrompt;
  delete state.pendingBlockType;
  delete state.pendingBlockTitle;
  rmSync(promptPath(state.slug), { force: true });
}

function shellQuote(value) {
  return `'${String(value ?? '').replace(/'/g, `'"'"'`)}'`;
}

function sectionMenuPendingChoices(section) {
  return [
    `Section menu pending — generate choices from ${section} excerpt`,
    `Ask anything about ${section}`,
    `Chat about this section`
  ];
}

function writeSectionMenuPrompt(state, section) {
  const slug = state.slug;
  const key = sectionKey(section);
  const index = Math.max(0, (state.paperSections || []).indexOf(section)) + 1;
  const insight = ensureSectionInsight(state, section) || {};
  const command = `${cliCommand()} section --session ${shellQuote(slug)} --index ${index || '<section-index>'} --choices ${shellQuote('Action A|Action B|…|Ask anything about ' + section + '|Chat about this section')}`;
  const prompt = `# PaperMentor Section Menu Prompt

You are generating the next TUI choices for one selected paper section. The CLI script must not invent generic actions; you must read the actual section excerpt and write a content-adapted menu.

## Hard rule

Do **not** use fixed fallback labels such as \`Map section\`, \`Decode key equations\`, \`Trace derivations\`, or \`Connect dependencies\`. Do **not** choose actions by word-matching the title. Infer the section role and the reader's likely blockers from the excerpt itself.

## Session

- Session: ${slug}
- Paper: ${state.title || '(untitled)'}
- Selected section: ${section}
- Section index: ${index || '(unknown)'}

## Section evidence

### Concepts detected for context only

${(insight.concepts || []).slice(0, 18).map((item) => `- ${item}`).join('\n') || '- (none extracted)'}

### Equation anchors detected for context only

${(insight.equations || []).slice(0, 18).map((item) => `- Eq. (${item})`).join('\n') || '- (none extracted)'}

### Equation/text snippets

${(insight.equationSnippets || []).slice(0, 8).map((item, idx) => `${idx + 1}. ${item}`).join('\n\n') || '(none extracted)'}

### Source excerpt

${insight.sourceExcerpt || insight.preview || '(section excerpt unavailable; use the section title and available session state, but do not fabricate details)'}

## Required output/action

Create 4–8 actions that are specific enough that they could only belong to this section of this paper. Good actions name the actual object, promise, equation role, proof obligation, conceptual gap, or method mechanism in the excerpt.

Always end with:

- Ask anything about ${section}
- Chat about this section

Then run exactly one command to install the menu into the TUI:

\`\`\`bash
${command}
\`\`\`
`;
  writeFileSync(promptPath(slug), prompt);
  state.pendingBlockPrompt = `.papermentor/sessions/${slug}/pending-prompt.md`;
  state.pendingBlockType = 'section-menu';
  state.pendingBlockTitle = `Generate section menu — ${section}`;
  state.sectionMenuPending = { section, key, prompt: state.pendingBlockPrompt, updatedAt: now() };
}

function actionTypeFromMode(currentMode, sourceMode = 'paper') {
  const normalizedMode = String(currentMode || '').toLowerCase().trim().replace(/_/g, '-');
  const paperModeMap = {
    prerequisite: 'prerequisite',
    prerequisites: 'prerequisite',
    equation: 'equation',
    equations: 'equation',
    derivation: 'derivation',
    derivations: 'derivation',
    dependency: 'dependency',
    dependencies: 'dependency',
    proof: 'proof',
    method: 'method',
    confusion: 'confusion',
    chat: 'confusion',
    'recursive-why': 'recursive-why',
    visualization: 'visualization',
    visualizations: 'visualization',
    'final-insight': 'final-insight',
    final: 'final-insight'
  };
  const slideModeMap = {
    slide: 'slide-explanation',
    slides: 'slide-explanation',
    narration: 'missing-narration',
    flow: 'slide-transition',
    transition: 'slide-transition',
    transitions: 'slide-transition',
    equation: 'equation',
    equations: 'equation',
    confusion: 'confusion',
    chat: 'confusion',
    visualization: 'visualization',
    final: 'final-insight',
    'final-insight': 'final-insight'
  };
  return (normalizeSourceMode(sourceMode) === 'slide' ? slideModeMap : paperModeMap)[normalizedMode] || '';
}

function actionType(action, state = {}) {
  const text = String(action || '').toLowerCase();
  const mode = normalizeSourceMode(state.sourceMode || 'paper');
  if (/concept ladder|prerequisite|from first principles|readiness/.test(text)) return 'prerequisite';
  if (/visualize|draw|diagram|graph|landscape/.test(text)) return 'visualization';
  if (/recursive why|why chain|keep asking why|deeper why/.test(text)) return 'recursive-why';
  if (/final insight|one-sentence/.test(text)) return 'final-insight';
  if (/confusion|diagnostic|ask anything|chat|answer question/.test(text)) return 'confusion';
  const modeType = actionTypeFromMode(state.currentMode, mode);
  if (modeType) return modeType;
  if (/derivation|trace|transition/.test(text)) return 'derivation';
  if (/eq\.|equation|symbol by symbol|notation/.test(text)) return 'equation';
  if (/dependenc|related-work|citation|contrast|connect/.test(text)) return mode === 'slide' ? 'slide-transition' : 'dependency';
  if (/proof|lemma|theorem|proposition/.test(text)) return 'proof';
  if (/method|pipeline|algorithm|visual element|slide/.test(text)) return mode === 'slide' ? 'slide-explanation' : 'method';
  if (/narration/.test(text)) return 'missing-narration';
  return mode === 'slide' ? 'slide-explanation' : 'note';
}

function promptTemplateForType(type) {
  const templates = {
    equation: 'templates/equation_card.md',
    derivation: 'templates/derivation_trace.md',
    dependency: 'templates/dependency_trace.md',
    proof: 'templates/proof_walkthrough.md',
    method: 'templates/method_dissection.md',
    prerequisite: 'templates/prerequisite_ladder.md',
    'concept-ladder': 'templates/concept_ladder.md',
    confusion: 'templates/confusion_response.md',
    'recursive-why': 'templates/recursive_why.md',
    visualization: 'templates/visualization_card.md',
    'slide-explanation': 'templates/slide_explanation.md',
    'missing-narration': 'templates/missing_narration.md',
    'slide-transition': 'templates/slide_transition.md',
    'final-insight': 'templates/final_insight.md'
  };
  return templates[type] || 'templates/method_dissection.md';
}

function stageQualityRules(type) {
  const shared = [
    '- Do not write a generic summary. Every substantive sentence must be anchored to the selected source excerpt, an equation, an algorithm line, a theorem/proof line, or a named paper object.',
    '- Start from the reader\'s likely blocker: name the role of the object before expanding details.',
    '- Prefer one precise toy numeric example over broad analogy when an abstract object would otherwise remain vague.',
    '- End with a reconstruction checkpoint: what the reader should now be able to restate or derive.'
  ];
  const byType = {
    prerequisite: [
      '- Choose only prerequisites actually needed for this selected paper range; skip broad course labels and trivial basics unless the excerpt truly requires them.',
      '- For each rung, teach the concept, give a real-number example, then point to the exact paper symbol/equation/claim it unlocks.'
    ],
    method: [
      '- Make the method executable in the reader\'s head: input, output, state variables, one pass through the algorithm, and what is stored or learned.',
      '- Tie every method step to the equation, algorithm line, or claim that justifies it.',
      '- Separate training-time, inference-time, preprocessing, and stored global parameters when the paper distinguishes them.'
    ],
    equation: [
      '- Show the equation before any prose, then explain its role: definition, objective, estimator, bound, update, or theorem statement.',
      '- Define every symbol including domains, randomness, conditioning, indices, constants, norms, expectations, and maps.',
      '- Explain what would be wrong if the reader interpreted the equation as a different object.'
    ],
    derivation: [
      '- Trace only one transition at a time. If the paper skips algebra, insert reconstructed intermediate lines and label them as reconstructed.',
      '- For every equality/inequality, name the operation and the dependency: substitution, definition, norm identity, expectation law, theorem, or assumption.',
      '- State exactly what changed from the previous line to the next line; do not hide it under "therefore".'
    ],
    dependency: [
      '- Separate definitions, assumptions, lemmas, algorithms, equations, theorem statements, and claims; do not collapse them into one prose chain.',
      '- For each dependency, explain why it is needed, what breaks without it, and where it is used next.',
      '- Include both backward dependencies needed to understand the current item and forward dependencies that reuse it later.'
    ],
    proof: [
      '- Walk the actual proof, not just the theorem intuition. Quote or rewrite the previous line and next line for each transition.',
      '- Use a line transition microscope rather than a fixed overview table: infer the actual operation from the displayed math and explain how it transforms the previous line into the next.',
      '- If a displayed transition compresses multiple operations, insert reconstructed intermediate lines and break it down until each micro-step is one primitive local transformation.',
      '- Define the proof notation first, especially random variables, conditioning events, indicators, denominators, distributions, and what is fixed versus averaged over.',
      '- Audit term movement at the right level for the selected proof. Do not use a predefined operation menu; infer the operation from the previous line, next line, and surrounding proof text.',
      '- Include the variance/bound part when the theorem has both unbiasedness/expectation and error/distortion claims; do not stop after the first claim.',
      '- Add a proof coverage / compression audit: say whether every proof line is covered, or name exactly which repeated algebra is compressed and why that is safe.',
      '- Close by explaining why the final line is sufficient for the theorem statement.'
    ],
    confusion: [
      '- Answer the user\'s question directly in the first explanatory paragraph.',
      '- Identify the missing dependency as a named concept, theorem, assumption, or equation role.',
      '- Give a minimal example that targets that missing dependency, then reconnect to the exact paper location and resume.'
    ],
    'recursive-why': [
      '- Make each why-layer strictly deeper than the previous one; do not repeat the same answer in different words.',
      '- Stop at a root dependency the reader can actually study next, not at a vague philosophical statement.'
    ],
    visualization: [
      '- Use visualization only for relationship, sequence, geometry, dependency, or flow confusion.',
      '- Describe the visual encoding precisely enough that the generated SVG can be drawn deterministically.',
      '- State the limitation: the diagram is a conceptual aid, not a paper figure or proof.'
    ],
    'final-insight': [
      '- Synthesize only from dependencies already explained; do not introduce new unsupported claims.',
      '- Use the form "not merely X; rather Y" when the paper\'s real contribution depends on a distinction.',
      '- Include an equation map, dependency chain, assumption breakpoints, and a reconstruction checklist.'
    ]
  };
  return [...shared, ...(byType[type] || [])].join('\n');
}

function markdownPlainText(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' math ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' math ')
    .replace(/\$[^$\n]+\$/g, ' math ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' image ')
    .replace(/\[[^\]]+]\([^)]+\)/g, (match) => match.replace(/^\[|\]\([^)]+\)$/g, ''))
    .replace(/[#>*_`|[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(value, patterns) {
  const text = String(value || '');
  return patterns.some((pattern) => pattern instanceof RegExp ? pattern.test(text) : text.toLowerCase().includes(String(pattern).toLowerCase()));
}

function addQualityCheck(result, condition, points, issue) {
  result.maxScore += points;
  if (condition) result.score += points;
  else result.issues.push(issue);
}

function evaluateCardQuality(card) {
  const type = String(card.type || 'note');
  const body = String(card.body || '');
  const plain = markdownPlainText(body);
  const result = { id: card.id, type, title: card.title, score: 0, maxScore: 0, issues: [] };
  addQualityCheck(result, plain.length >= 420, 12, 'body is too short for a production teaching block');
  addQualityCheck(result, !/Not read yet|Not built yet|Not written yet|placeholder|TODO/i.test(body), 10, 'body still contains scaffold/placeholder text');
  addQualityCheck(result, includesAny(body, [/checkpoint/i, /reconstruct/i, /resume point/i, /what.*now.*able/i]), 8, 'missing reconstruction/resume checkpoint');
  addQualityCheck(result, includesAny(body, [/\$\$[\s\S]+?\$\$/, /\\\[[\s\S]+?\\\]/, /\$[^$\n]+\$/]), 8, 'missing LaTeX/math anchor where paper teaching usually needs notation');
  addQualityCheck(result, includesAny(body, [/Eq\.?\s*\(?\d+/i, /Algorithm\s+\d+/i, /Theorem\s+\d+/i, /Lemma\s+\d+/i, /Proposition\s+\d+/i, /Figure\s+\d+/i, /line\s+\d+/i]), 8, 'missing explicit paper anchor such as equation, algorithm, theorem, lemma, proposition, or figure');

  const typeChecks = {
    'start-here': [
      [/One-sentence orientation|One-sentence/i, 8, 'Start Here should include one-sentence orientation'],
      [/Preliminary/i, 8, 'Start Here should include Preliminary'],
      [/flow:/i, 6, 'Start Here should include a flow line when dependencies are linear enough']
    ],
    prerequisite: [
      [/flow:/i, 10, 'prerequisite ladder should include dependency flow when appropriate'],
      [/###\s*\d+\./, 10, 'prerequisites should be taught as numbered concept blocks'],
      [/\d+(?:\.\d+)?|00|01|10|11|example/i, 8, 'prerequisites should include a concrete numeric example']
    ],
    method: [
      [/Input|output|contract/i, 8, 'method block should state input/output contract'],
      [/Algorithm|step|walk-through|pipeline/i, 10, 'method block should walk algorithm steps'],
      [/training|inference|preprocessing|online|stored/i, 8, 'method block should separate runtime phases or stored objects']
    ],
    equation: [
      [/Equation first|Equation role|Role/i, 8, 'equation block should state equation role'],
      [/Symbol|operator|constant|domain|codomain|random|fixed/i, 10, 'equation block should define symbols/operators/domains/randomness'],
      [/wrong reading|common confusion|misconception/i, 8, 'equation block should name a likely wrong interpretation']
    ],
    derivation: [
      [/Previous equation/i, 8, 'derivation should show previous equation'],
      [/Next equation/i, 8, 'derivation should show next equation'],
      [/Operation|Dependency|Assumption|Why valid|What changed/i, 12, 'derivation should justify each transition']
    ],
    dependency: [
      [/Backward dependencies/i, 8, 'dependency block should include backward dependencies'],
      [/Forward dependencies/i, 8, 'dependency block should include forward dependencies'],
      [/breaks|risk|misunderstood|missing dependency/i, 12, 'dependency block should say what breaks if misunderstood']
    ],
    proof: [
      [/Claim statement|Claim/i, 8, 'proof block should restate the claim'],
      [/Line transition microscope|Transition\s+\d+\s*(?:→|->|to)\s*\d+|Previous line[\s\S]+Next line/i, 14, 'proof block should explain transitions between adjacent proof lines'],
      [/Notation and objects|Symbol|random variable|conditioning event|indicator|denominator|distribution|fixed|averaged/i, 10, 'proof block should define proof notation and what is fixed versus random'],
      [/operation audit|term-by-term|term movement|what changed|previous line[\s\S]+next line/i, 12, 'proof block should audit the actual term-level operation used in each proof transition'],
      [/conditioning|expectation|variance|bound|inequality|distortion/i, 12, 'proof block should audit expectation/conditioning and bounds when present'],
      [/Proof coverage|Coverage audit|Completeness audit|compression audit|compressed|omitted|every proof line|full formal proof/i, 10, 'proof block should state whether it covers every proof line or compresses/omits repeated algebra']
    ],
    confusion: [
      [/Direct answer/i, 10, 'confusion block should answer directly'],
      [/Missing dependency/i, 10, 'confusion block should name missing dependency'],
      [/Reconnection|Resume point|Paused location/i, 10, 'confusion block should reconnect and resume']
    ],
    'recursive-why': [
      [/Layer|Why question|Root dependency/i, 12, 'recursive why should expose why layers and root dependency'],
      [/Paper reconnection|Reconnection/i, 8, 'recursive why should reconnect to paper text'],
      [/Stop\?/i, 6, 'recursive why should indicate a stop condition']
    ],
    visualization: [
      [/Question|Concept|Visual encoding|What to observe|Limitation/i, 12, 'visualization should include required diagram explanation fields'],
      [/node|arrow|edge|group|label|encoding/i, 8, 'visualization should specify drawable visual encoding'],
      [/Not a figure from the paper|conceptual aid|not.*proof/i, 8, 'visualization should state limitation']
    ],
    'final-insight': [
      [/One-sentence final insight|One-sentence model/i, 8, 'final insight should include one-sentence insight'],
      [/Equation map/i, 10, 'final insight should include equation map'],
      [/Dependency chain|Assumptions|breakpoints|Reconstruction checklist/i, 12, 'final insight should include dependency chain, breakpoints, and checklist']
    ]
  };
  for (const [pattern, points, issue] of (typeChecks[type] || [])) {
    addQualityCheck(result, pattern.test(body), points, issue);
  }
  if (card.figure) {
    addQualityCheck(result, /Concept \/ method role|How to read it|Parts to identify|In-figure math \/ symbols|Flow \/ sequence|What to observe|Equations \/ claims it supports/i.test(body), 12, 'figure block should contain the fixed element-by-element figure reading schema');
  }
  result.score = result.maxScore ? Math.round((result.score / result.maxScore) * 100) : 0;
  result.score = Math.max(0, Math.min(100, result.score));
  result.status = result.score >= 82 && result.issues.length <= 2 ? 'pass' : result.score >= 68 ? 'review' : 'fail';
  return result;
}

function qualityReportForSession(slug) {
  const cards = readJson(cardsPath(slug), { cards: [] });
  const results = (cards.cards || [])
    .filter((card) => !['reading-guide'].includes(card.type))
    .map(evaluateCardQuality);
  const overall = results.length
    ? Math.round(results.reduce((sum, item) => sum + item.score, 0) / results.length)
    : 0;
  const failed = results.filter((item) => item.status === 'fail').length;
  const review = results.filter((item) => item.status === 'review').length;
  return {
    schema: 'papermentor.quality.v1',
    session: slug,
    overall,
    status: overall < 68 ? 'fail' : failed || review || overall < 82 ? 'review' : 'pass',
    cards: results
  };
}

function runQualityQa(args = {}) {
  const slug = requireSessionSlug(args, 'qa');
  const report = qualityReportForSession(slug);
  writeJson(safeSessionPath(slug, 'quality-report.json'), report);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`PaperMentor content QA: ${report.overall}/100 (${report.status})`);
    for (const card of report.cards) {
      const icon = card.status === 'pass' ? '✓' : card.status === 'review' ? '↺' : '!';
      console.log(`${icon} ${String(card.score).padStart(3)}  ${card.type}  ${card.title}`);
      card.issues.slice(0, 3).forEach((issue) => console.log(`    - ${issue}`));
    }
    console.log(`\nReport: .papermentor/sessions/${slug}/quality-report.json`);
  }
  const min = Number(args.min || args.threshold || 0);
  if (min && report.overall < min) {
    throw new Error(`content QA score ${report.overall} is below threshold ${min}`);
  }
  return report;
}

function allSessionSlugs() {
  if (!existsSync(baseDir)) return [];
  return readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(statePath(entry.name)))
    .map((entry) => entry.name)
    .sort((a, b) => {
      const aState = readJson(statePath(a), {});
      const bState = readJson(statePath(b), {});
      return String(bState.updatedAt || bState.createdAt || '').localeCompare(String(aState.updatedAt || aState.createdAt || ''));
    });
}

function resolveSessionList(args = {}, verb = 'batch command') {
  const explicit = splitChoices(args.sessions || args.session || args.slug || args.slugs || args._?.slice(1).join('|') || '');
  if (explicit.length) return unique(explicit);
  if (args.all) return allSessionSlugs();
  const recent = loadRecentSessions().map((item) => item.slug);
  const count = Number(args.recent || args.limit || 0);
  if (count > 0) return recent.slice(0, count);
  const latest = latestSessionSlug();
  if (latest) return [latest];
  throw new Error(`${verb} needs --sessions "slugA|slugB", --recent <n>, or --all`);
}

function batchQualityQa(args = {}) {
  const slugs = resolveSessionList(args, 'qa-batch');
  const reports = [];
  for (const slug of slugs) {
    if (!readStateForSlug(slug)) {
      reports.push({ session: slug, status: 'missing', overall: 0, error: 'session not found' });
      continue;
    }
    try {
      const report = qualityReportForSession(slug);
      writeJson(safeSessionPath(slug, 'quality-report.json'), report);
      reports.push(report);
    } catch (error) {
      reports.push({ session: slug, status: 'error', overall: 0, error: error.message });
    }
  }
  const valid = reports.filter((item) => typeof item.overall === 'number' && !item.error && item.cards);
  const overall = valid.length ? Math.round(valid.reduce((sum, item) => sum + item.overall, 0) / valid.length) : 0;
  const summary = {
    schema: 'papermentor.quality-batch.v1',
    generatedAt: now(),
    sessions: slugs,
    overall,
    status: valid.some((item) => item.status === 'fail') || reports.some((item) => item.error) ? 'review' : valid.some((item) => item.status === 'review') ? 'review' : 'pass',
    reports
  };
  const output = args.output || join(papermentorDir(), 'quality-batch-report.json');
  writeJson(output, summary);
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`PaperMentor batch QA: ${overall}/100 across ${valid.length}/${slugs.length} session(s) (${summary.status})`);
    for (const report of reports) {
      const icon = report.error ? '!' : report.status === 'pass' ? '✓' : '↺';
      console.log(`${icon} ${String(report.overall || 0).padStart(3)}  ${report.session}${report.error ? ` — ${report.error}` : ` (${report.status})`}`);
    }
    console.log(`\nReport: ${output}`);
  }
  const min = Number(args.min || args.threshold || 0);
  if (min && overall < min) throw new Error(`batch QA score ${overall} is below threshold ${min}`);
  return summary;
}

function figureAuditForSession(slug) {
  const state = readStateForSlug(slug);
  const cards = readJson(cardsPath(slug), { cards: [] });
  const findings = [];
  for (const card of cards.cards || []) {
    const issues = [];
    let dimensions = null;
    if (card.figure?.src) {
      const src = card.figure.src.startsWith('assets/')
        ? safeSessionPath(slug, card.figure.src)
        : resolve(card.figure.src);
      dimensions = imageDimensions(src);
      if (!dimensions) issues.push('could not read attached figure dimensions');
      else {
        if (dimensions.width < 220 || dimensions.height < 140) issues.push(`small figure crop: ${dimensions.width}x${dimensions.height}`);
        const aspect = dimensions.width / Math.max(1, dimensions.height);
        if (aspect > 6 || aspect < 0.18) issues.push(`unusual aspect ratio: ${aspect.toFixed(2)}`);
      }
      if (!/Concept \/ method role|How to read it|Parts to identify|In-figure math \/ symbols|Flow \/ sequence|What to observe|Equations \/ claims it supports/i.test(card.body || '')) {
        issues.push('attached figure body does not contain the fixed element-by-element figure reading schema');
      }
      if (/Not read yet|replace every bullet|placeholder/i.test(card.body || '')) {
        issues.push('figure reading still contains scaffold instructions');
      }
    } else if (card.type === 'start-here' && state?.sourceMode === 'paper') {
      if (!/no figure|no representative figure attached|could not auto-attach|not present/i.test(card.body || '')) issues.push('paper Start Here has no figure and no explicit no-figure/fallback explanation');
    }
    if (issues.length) findings.push({ cardId: card.id, type: card.type, title: card.title, dimensions, issues });
  }
  const warning = [
    state?.figureSelectionWarning,
    state?.figureExtractionWarning,
    state?.figureExtractionFallbackWarning,
    state?.figureQualityWarning
  ].filter(Boolean);
  return {
    session: slug,
    title: state?.title || slug,
    sourceMode: state?.sourceMode || 'paper',
    status: findings.length || warning.length ? 'review' : 'pass',
    warnings: warning,
    findings
  };
}

function runFigureAudit(args = {}) {
  const slugs = resolveSessionList(args, 'figure-audit');
  const reports = slugs.map((slug) => readStateForSlug(slug)
    ? figureAuditForSession(slug)
    : { session: slug, status: 'missing', warnings: ['session not found'], findings: [] });
  const summary = {
    schema: 'papermentor.figure-audit.v1',
    generatedAt: now(),
    status: reports.some((item) => item.status !== 'pass') ? 'review' : 'pass',
    reports
  };
  const output = args.output || join(papermentorDir(), 'figure-audit-report.json');
  writeJson(output, summary);
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`PaperMentor figure audit: ${summary.status} across ${reports.length} session(s)`);
    for (const report of reports) {
      const count = (report.findings || []).reduce((sum, item) => sum + item.issues.length, 0) + (report.warnings || []).length;
      console.log(`${report.status === 'pass' ? '✓' : '↺'} ${report.session} — ${count} issue(s)`);
      [...(report.warnings || []), ...(report.findings || []).flatMap((item) => item.issues.map((issue) => `${item.title}: ${issue}`))].slice(0, 4)
        .forEach((issue) => console.log(`    - ${issue}`));
    }
    console.log(`\nReport: ${output}`);
  }
  return summary;
}

function proofAuditForSession(slug) {
  const state = readStateForSlug(slug);
  const cards = readJson(cardsPath(slug), { cards: [] });
  const proofCards = (cards.cards || []).filter((card) => {
    if (card.type === 'proof') return true;
    if (['reading-guide', 'start-here'].includes(card.type)) return false;
    const text = `${card.title}\n${card.body || ''}`;
    return /proof walkthrough|prove|proof of|line transition microscope|claim statement|theorem\s+\d+|lemma\s+\d+|proposition\s+\d+/i.test(text);
  });
  const results = proofCards.map((card) => evaluateCardQuality({ ...card, type: 'proof' }));
  return {
    session: slug,
    title: state?.title || slug,
    proofBlocks: results.length,
    status: results.length && results.every((item) => item.status === 'pass') ? 'pass' : results.length ? 'review' : 'missing',
    results
  };
}

function runProofAudit(args = {}) {
  const slugs = resolveSessionList(args, 'proof-audit');
  const reports = slugs.map((slug) => readStateForSlug(slug)
    ? proofAuditForSession(slug)
    : { session: slug, status: 'missing', proofBlocks: 0, results: [], error: 'session not found' });
  const summary = {
    schema: 'papermentor.proof-audit.v1',
    generatedAt: now(),
    status: reports.some((item) => item.status === 'review' || item.status === 'missing') ? 'review' : 'pass',
    reports
  };
  const output = args.output || join(papermentorDir(), 'proof-audit-report.json');
  writeJson(output, summary);
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`PaperMentor proof audit: ${summary.status} across ${reports.length} session(s)`);
    for (const report of reports) {
      console.log(`${report.status === 'pass' ? '✓' : report.status === 'missing' ? '!' : '↺'} ${report.session} — ${report.proofBlocks} proof block(s)`);
      (report.results || []).filter((item) => item.status !== 'pass').slice(0, 3).forEach((item) => {
        console.log(`    - ${item.title}: ${item.score}/100; ${item.issues.slice(0, 2).join('; ')}`);
      });
    }
    console.log(`\nReport: ${output}`);
  }
  return summary;
}

function buildActionPrompt(state, action) {
  const type = actionType(action, state);
  const insight = ensureSectionInsight(state, state.currentSection || '') || {};
  const equations = insight.equations?.length ? insight.equations.map((n) => `Eq. (${n})`).join(', ') : 'none detected yet';
  const equationSnippets = insight.equationSnippets?.length ? insight.equationSnippets.map((line) => `- ${line}`).join('\n') : '- none detected yet';
  const concepts = insight.concepts?.length ? insight.concepts.join(', ') : 'none detected yet';
  const citations = insight.citations?.length ? insight.citations.join(', ') : 'none detected yet';
  const sourceExcerpt = insight.sourceExcerpt || insight.preview || 'No extracted preview. Use the attached source/paper text available in context.';
  const command = `${cliCommand()} card --session ${shellQuote(state.slug)} --type ${shellQuote(type)} --title ${shellQuote(action)} --body-file <your-markdown-file>`;
  return `# PaperMentor HTML Block Runner Prompt\n\nYou are generating the next PaperMentor HTML block. Do not answer only in the CLI. Create a concrete explanation block and append it with:\n\n\`${command}\`\n\n## Selected action\n\n${action}\n\n## Source context\n\n- Mode: ${sourceModeLabel(state.sourceMode)}\n- Title: ${state.title}\n- Section / slide: ${state.currentSection || state.currentLocation || 'not selected'}\n- Current focus: ${state.currentFocus || ''}\n- Template to follow: ${promptTemplateForType(type)}\n\n## Detected local signals\n\n- Equations: ${equations}\n- Concepts: ${concepts}\n- Citations: ${citations}\n- Preview: ${insight.preview || 'No extracted preview yet.'}\n\n## Equation / notation preview from this selected range\n\n${equationSnippets}\n\n## Source excerpt for this selected range\n\n\`\`\`text\n${sourceExcerpt}\n\`\`\`\n\n## Stage-specific quality bar\n\n${stageQualityRules(type)}\n\n## Output rules\n\n- Actual explanation belongs in HTML, not in the CLI.\n- Use the source excerpt above as the local evidence for the selected section / slide range; do not explain unrelated slides unless the action asks for temporal context.\n- Show every non-trivial equation in LaTeX before explaining it.\n- Explain symbols, assumptions, substitutions, cancellations, and dependencies explicitly.\n- If this action is a user question/chat, answer the question, identify the missing dependency, reconnect to the exact section, and resume.\n- If a representative paper/slide figure is needed, use extract-figure with an actual crop; never use Mermaid as a substitute.\n`;
}

function writePendingActionPrompt(state, action) {
  const prompt = buildActionPrompt(state, action);
  writeFileSync(promptPath(state.slug), prompt);
  state.pendingBlockPrompt = `.papermentor/sessions/${state.slug}/pending-prompt.md`;
  state.pendingBlockType = actionType(action, state);
  state.pendingBlockTitle = action;
  return prompt;
}

function renderRunnerConsole(state, action) {
  const width = 82;
  const content = [
    `${ansi.bold}${ansi.green}✦ PaperMentor runner${ansi.reset} ${ansi.dim}choice → block prompt${ansi.reset}`,
    `${ansi.dim}Action:${ansi.reset} ${trim(action, 62)}`,
    `${ansi.dim}Block type:${ansi.reset} ${state.pendingBlockType}  ${ansi.dim}Prompt:${ansi.reset} ${state.pendingBlockPrompt}`,
    `${ansi.dim}HTML:${ansi.reset} ${state.renderedView}`,
    `${ansi.amber}Next:${ansi.reset} use the pending prompt to write the block body, then append it with the card command.`
  ];
  return [
    `${ansi.green}╭${'─'.repeat(width - 2)}╮${ansi.reset}`,
    ...content.map((line) => boxLine(line, width, ansi.green)),
    `${ansi.green}╰${'─'.repeat(width - 2)}╯${ansi.reset}`
  ].join('\n');
}

function runChoice(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('run requires --session <slug>');
  let state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const index = Number(args.index || args.choice || 1) - 1;
  state = applyTuiChoice(state, Math.max(0, index));
  const action = state.lastChoiceKind === 'action' ? state.selectedAction : '';
  if (action) {
    writePendingActionPrompt(state, action);
    state.updatedAt = now();
    writeJson(statePath(slug), state);
    renderHtml(slug);
    console.log(renderRunnerConsole(state, action));
  } else {
    state.updatedAt = now();
    writeJson(statePath(slug), state);
    renderHtml(slug);
    printConsole(state);
  }
}

function applyTuiChoice(state, selected, options = {}) {
  const items = options.tui ? tuiMenuItems(state) : currentMenuItems(state);
  const choice = items[selected];
  if (!choice) return state;
  if (isChoosingTopic(state)) {
    state.currentSection = choice;
    state.currentMode = '';
    state.detectedItems = [];
    state.currentLocation = choice;
    state.currentFocus = `Section selected: ${choice}`;
    state.selectedAction = '';
    state.lastChoiceKind = 'section';
    delete state.topicPickerOpen;
    const key = sectionKey(choice);
    const actions = state.sectionActions?.[key];
    if (actions?.length) {
      clearPendingPrompt(state);
      state.nextChoices = actions;
    } else {
      state.nextChoices = sectionMenuPendingChoices(choice);
      writeSectionMenuPrompt(state, choice);
    }
  } else if (/^Change topic \/ section list$/i.test(choice)) {
    state.topicPickerOpen = true;
    state.currentMode = '';
    state.currentFocus = `Choose a ${sourceModeNoun(state.sourceMode)} topic`;
    state.selectedAction = '';
    state.lastChoiceKind = 'topic-picker';
    clearPendingPrompt(state);
  } else if (/^Section menu pending/i.test(choice)) {
    writeSectionMenuPrompt(state, state.currentSection || 'current section');
    state.currentFocus = `Waiting for content-adapted menu for ${state.currentSection || 'current section'}`;
    state.selectedAction = '';
    state.lastChoiceKind = 'section-menu';
  } else {
    state.currentFocus = choice;
    state.selectedAction = choice;
    const selectedType = actionType(choice, state);
    const nextMode = {
      prerequisite: 'prerequisite',
      equation: 'equations',
      derivation: 'derivations',
      dependency: 'dependencies',
      proof: 'proof',
      method: 'method',
      confusion: 'chat',
      'recursive-why': 'recursive-why',
      visualization: 'visualization',
      'final-insight': 'final'
    }[selectedType];
    if (nextMode) state.currentMode = nextMode;
    state.lastChoiceKind = 'action';
    writePendingActionPrompt(state, choice);
  }
  state.updatedAt = now();
  writeJson(statePath(state.slug), state);
  renderHtml(state.slug);
  return state;
}

function runTui(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('tui requires --session <slug>');
  let state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  let selected = Math.min(Number(args.cursor || 0), Math.max(0, tuiMenuItems(state).length - 1));
  if (args.snapshot || args.demo || !process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(renderTuiScreen(state, selected));
    return;
  }

  const draw = () => {
    process.stdout.write(`${ansi.clear}${renderTuiScreen(state, selected)}`);
  };
  const cleanup = () => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write(`${ansi.showCursor}${ansi.normalScreen}`);
  };
  const exitForMissingSession = () => {
    cleanup();
    console.log(`No active reading room yet.\n\nStart one with:\n\n  ${cliCommand()} <file-or-url>\n`);
    process.exit(0);
  };

  process.stdout.write(`${ansi.altScreen}${ansi.hideCursor}`);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  draw();
  const handleKey = (key) => {
    const items = tuiMenuItems(state);
    if (key === '\u0003' || key === 'q') {
      cleanup();
      process.exit(0);
    } else if (key === '\u001b[A' || key === 'k') {
      selected = (selected - 1 + items.length) % Math.max(1, items.length);
      draw();
    } else if (key === '\u001b[B' || key === 'j') {
      selected = (selected + 1) % Math.max(1, items.length);
      draw();
    } else if (key === '\u001b[D' || key === 'b') {
      if ((state.paperSections || []).length && state.currentSection) {
        state.topicPickerOpen = true;
        state.currentMode = '';
        state.currentFocus = `Choose a ${sourceModeNoun(state.sourceMode)} topic`;
        state.selectedAction = '';
        clearPendingPrompt(state);
        selected = 0;
      }
      draw();
    } else if (key === '\r' || key === '\n') {
      state = applyTuiChoice(state, selected, { tui: true });
      selected = 0;
      draw();
    } else if (key === '/') {
      state.currentMode = 'chat';
      state.currentFocus = `Ask anything about ${state.currentSection || state.title}`;
      state.nextChoices = [`Ask anything about ${state.currentSection || state.title}`, `Chat about this section`, 'Return to section choices'];
      writeJson(statePath(state.slug), state);
      draw();
    } else if (key === 'o') {
      openSessionHtml(state.slug);
      draw();
    } else if (key === 'n') {
      cleanup();
      console.log(`Start a new room with:\n\n  ${cliCommand()} <file-or-url>\n`);
      process.exit(0);
    } else if (key === 'r') {
      state = prepareStartHerePrompt(state);
      draw();
    } else if (key === 'e') {
      cleanup();
      exportSession({ session: state.slug, format: 'pdf', overwrite: true });
      process.exit(0);
    }
  };
  process.on('SIGWINCH', draw);
  process.stdin.on('data', (chunk) => {
    const keys = String(chunk).match(/\x1b\[[ABCD]|[\s\S]/g) || [];
    for (const key of keys) handleKey(key);
  });
}

function isSourceLike(value) {
  const text = String(value || '');
  if (!text || text.startsWith('-')) return false;
  if (isUrl(text) || existsSync(resolve(text))) return true;
  return /\.(pdf|pptx?|key|md|txt|png|jpe?g|webp|gif|svg)(?:[?#].*)?$/i.test(text);
}

function readStateForSlug(slug) {
  if (!slug) return null;
  return readJson(statePath(slug), null);
}

function sessionSummary(slug) {
  const state = readStateForSlug(slug);
  if (!state) return null;
  const cards = readJson(cardsPath(slug), { cards: [] });
  const hasStartHere = (cards.cards || []).some((card) => card.type === 'start-here' && !/Not built yet|Not written yet/.test(card.body || ''));
  return {
    state,
    cards,
    hasStartHere,
    startHereStatus: state.startHerePending || state.pendingBlockType === 'start-here' ? 'pending' : hasStartHere ? 'complete' : 'not started'
  };
}

function sessionQualitySummary(slug) {
  if (!slug) return null;
  const existing = readJson(safeSessionPath(slug, 'quality-report.json'), null);
  if (existing) return existing;
  try {
    return qualityReportForSession(slug);
  } catch {
    return null;
  }
}

function defaultPaletteItems(slug, summary = null) {
  const hasSession = Boolean(slug);
  const state = summary?.state || {};
  const items = [
    hasSession ? (state.pendingBlockPrompt ? 'Continue pending HTML block' : 'Continue current reading room') : 'New reading room from file / URL',
    hasSession ? 'Open current HTML' : 'Show recent reading rooms',
    hasSession ? 'Ask about current topic' : 'Paste or pass a source path',
    hasSession ? 'Run content quality check' : 'Doctor / check setup',
    hasSession && state.figureQualityWarning ? 'Review / recrop representative figure' : '',
    hasSession ? 'Regenerate Start Here prompt' : 'Advanced help',
    hasSession ? 'Export PDF report' : '',
    'New reading room from file / URL',
    'Doctor / check setup',
    'Advanced help'
  ];
  return items.filter(Boolean);
}

function renderPaletteScreen({ slug = latestSessionSlug(), selected = 0 } = {}) {
  const width = terminalBoxWidth(96);
  const summary = sessionSummary(slug);
  const state = summary?.state || {};
  const quality = summary ? sessionQualitySummary(slug) : null;
  const recent = loadRecentSessions();
  const items = defaultPaletteItems(summary ? slug : '', summary).filter((item, index, arr) => arr.indexOf(item) === index);
  const top = `${ansi.green}╭${'─'.repeat(width - 2)}╮${ansi.reset}`;
  const bottom = `${ansi.green}╰${'─'.repeat(width - 2)}╯${ansi.reset}`;
  const title = summary ? state.title : 'No reading room selected';
  const html = summary ? (state.renderedView || `.papermentor/sessions/${state.slug}/index.html`) : 'Start with: pm <file-or-url>';
  const topic = summary ? (state.currentSection || state.currentLocation || 'choose a topic') : `${recent.length} recent session(s)`;
  const startHere = summary
    ? summary.startHereStatus === 'complete' ? `${ansi.green}complete${ansi.reset}` : summary.startHereStatus === 'pending' ? `${ansi.amber}pending${ansi.reset}` : `${ansi.dim}not started${ansi.reset}`
    : `${ansi.dim}none${ansi.reset}`;
  const qualityText = summary
    ? quality ? `${quality.status === 'pass' ? ansi.green : quality.status === 'review' ? ansi.amber : ansi.red}${quality.overall}/100 ${quality.status}${ansi.reset}` : `${ansi.dim}not run${ansi.reset}`
    : `${ansi.dim}none${ansi.reset}`;
  const figureText = state.figureQualityWarning ? `${ansi.amber}review crop${ansi.reset}` : `${ansi.dim}ok/no figure warning${ansi.reset}`;
  const rows = [
    top,
    boxLine(`${ansi.bold}${ansi.green}✦ PaperMentor Skill${ansi.reset} ${ansi.dim}Claude/Codex-style command palette${ansi.reset}`, width, ansi.green),
    boxLine(`${ansi.dim}↑/↓ move · Enter select · / ask · o open · v QA · c crop · n new · r Start Here · e export · q quit${ansi.reset}`, width, ansi.green),
    `${ansi.green}├${'─'.repeat(width - 2)}┤${ansi.reset}`,
    boxLine(`${ansi.dim}Current room:${ansi.reset} ${ansi.bold}${trim(title, 70)}${ansi.reset}`, width, ansi.green),
    boxLine(`${ansi.dim}HTML:${ansi.reset} ${ansi.green}${trim(html, 78)}${ansi.reset}`, width, ansi.green),
    boxLine(`${ansi.dim}Start Here:${ansi.reset} ${startHere}   ${ansi.dim}Quality:${ansi.reset} ${qualityText}   ${ansi.dim}Figure:${ansi.reset} ${figureText}`, width, ansi.green),
    boxLine(`${ansi.dim}Current topic:${ansi.reset} ${trim(topic, 76)}`, width, ansi.green),
    `${ansi.green}├${'─'.repeat(width - 2)}┤${ansi.reset}`,
    boxLine(`${ansi.bold}Choose next${ansi.reset}`, width, ansi.green)
  ];
  items.forEach((item, index) => {
    const active = index === selected;
    const pointer = active ? `${ansi.inverse}${ansi.bold} ${String(index + 1).padStart(2, '0')} ${ansi.reset}` : `${ansi.dim} ${String(index + 1).padStart(2, '0')} ${ansi.reset}`;
    const prefix = active ? `${ansi.green}◆${ansi.reset}` : `${ansi.dim}◇${ansi.reset}`;
    rows.push(boxLine(`${prefix} ${pointer} ${active ? `${ansi.bold}${item}${ansi.reset}` : item}`, width, active ? ansi.green : ansi.cyan));
  });
  if (recent.length) {
    rows.push(`${ansi.green}├${'─'.repeat(width - 2)}┤${ansi.reset}`);
    rows.push(boxLine(`${ansi.dim}Recent:${ansi.reset} ${recent.slice(0, 3).map((item) => item.title || item.slug).join('  ·  ')}`, width, ansi.green));
  }
  rows.push(`${ansi.green}├${'─'.repeat(width - 2)}┤${ansi.reset}`);
  rows.push(boxLine(`${ansi.amber}Shortcuts:${ansi.reset} pm <file> · pm open · pm go · pm ask "question" · pm qa · pm export`, width, ansi.green));
  rows.push(bottom);
  return { screen: rows.join('\n'), items };
}

function executePaletteItem(item, slug) {
  if (/continue/i.test(item)) return runTui({ session: slug });
  if (/open current html/i.test(item)) return openLatestSession({ session: slug });
  if (/ask/i.test(item)) return askCurrentSession({ session: slug, text: 'Ask anything about the current topic' });
  if (/quality check/i.test(item)) return runQualityQa({ session: slug });
  if (/recrop|crop/i.test(item)) return previewCrops({ session: slug, overwrite: true });
  if (/regenerate start/i.test(item)) return regenerateStartHere({ session: slug });
  if (/export pdf/i.test(item)) return exportSession({ session: slug, format: 'pdf', overwrite: true });
  if (/doctor/i.test(item)) return runDoctor({});
  if (/advanced help/i.test(item)) return usage({ advanced: true });
  if (/recent/i.test(item)) return listRecentSessions();
  console.log(`Start a new room with:\n\n  ${cliCommand()} <file-or-url>\n`);
}


function learningQuotes() {
  // Public-domain/classic quote references:
  // - Aristotle, Metaphysics I.1, MIT Classics Archive.
  // - Confucius, Analects II.11/15/17, Project Gutenberg / Wikisource Legge translation.
  return [
    'All men by nature desire to know. — Aristotle, Metaphysics I.1',
    'Learning without thought is labour lost; thought without learning is perilous. — Confucius, Analects II.15',
    'When you know a thing, to hold that you know it; and when you do not know a thing, to allow that you do not know it; this is knowledge. — Confucius, Analects II.17',
    'If a man keeps cherishing his old knowledge, so as continually to be acquiring new, he may be a teacher of others. — Confucius, Analects II.11'
  ];
}

function learningQuote({ deterministic = false } = {}) {
  const quotes = learningQuotes();
  if (deterministic) return quotes[0];
  return quotes[Math.floor(Math.random() * quotes.length)] || quotes[0];
}

function renderWelcomeScreen({ input = '', status = '', includePrompt = true, quote = learningQuote() } = {}) {
  const width = terminalBoxWidth(88);
  const top = `${ansi.green}╭${'─'.repeat(width - 2)}╮${ansi.reset}`;
  const bottom = `${ansi.green}╰${'─'.repeat(width - 2)}╯${ansi.reset}`;
  const prompt = input || `${ansi.dim}drop file/url or type a question${ansi.reset}`;
  const rows = [
    top,
    boxLine(`${ansi.bold}${ansi.green}✦ PaperMentor${ansi.reset}`, width, ansi.green),
    ...boxWrappedText(quote, width, ansi.green, ansi.dim),
    boxLine('', width, ansi.green),
    boxLine(`${ansi.bold}Add source:${ansi.reset} PDF · PPT/PPTX · URL`, width, ansi.green),
    boxLine(`${ansi.dim}Then choose topics with ↑/↓, or ask here.${ansi.reset}`, width, ansi.green)
  ];
  if (status) rows.push(boxLine(`${ansi.amber}${status}${ansi.reset}`, width, ansi.green));
  rows.push(bottom);
  return `${rows.join('\n')}${includePrompt ? `\n\n${ansi.green}›${ansi.reset} ${prompt}` : ''}`;
}

function runWelcome(args = {}) {
  let status = '';
  const snapshot = args.snapshot || args.demo || !process.stdin.isTTY || !process.stdout.isTTY;
  if (snapshot) {
    console.log(renderWelcomeScreen({ input: args.input || args.source || '', status, quote: learningQuote({ deterministic: true }) }));
    return;
  }
  const launchQuote = learningQuote();
  const launchInput = (value) => {
    const source = String(value || '').trim();
    if (!source) {
      status = 'Paste a source, or ask after a reading room exists.';
      askLine();
      return;
    }
    if (!isSourceLike(source)) {
      const slug = args.session || args.slug || latestSessionSlug();
      if (!slug) {
        status = 'Questions work after a room exists. Paste a paper or slides first.';
        askLine();
        return;
      }
      askCurrentSession({ ...args, session: slug, text: source });
      return;
    }
    const slug = launchSession({ ...args, _: ['launch', source], source });
    if (slug && process.stdin.isTTY && process.stdout.isTTY) {
      const state = readStateForSlug(slug);
      if (state?.paperSections?.length) {
        state.topicPickerOpen = true;
        state.currentMode = '';
        state.currentFocus = `Choose a ${sourceModeNoun(state.sourceMode)} topic`;
        writeJson(statePath(slug), state);
      }
      runTui({ session: slug });
    }
  };
  const askLine = () => {
    process.stdout.write(`${ansi.clear}${renderWelcomeScreen({ status, includePrompt: false, quote: launchQuote })}\n\n`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${ansi.green}›${ansi.reset} `, (answer) => {
      rl.close();
      status = '';
      launchInput(answer);
    });
  };
  const initial = args.input || args.source || '';
  if (initial) return launchInput(initial);
  askLine();
}

function runPalette(args = {}) {
  let slug = args.session || args.slug || latestSessionSlug();
  let selected = Math.max(0, Number(args.index || args.cursor || 1) - 1);
  const snapshot = args.snapshot || args.demo || !process.stdin.isTTY || !process.stdout.isTTY;
  const render = () => renderPaletteScreen({ slug, selected });
  if (snapshot) {
    const { screen, items } = render();
    console.log(screen);
    if (args.index) executePaletteItem(items[selected], slug);
    return;
  }
  let current = render();
  const draw = () => {
    current = render();
    process.stdout.write(`${ansi.clear}${current.screen}`);
  };
  const cleanup = () => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write(`${ansi.showCursor}${ansi.normalScreen}`);
  };
  process.stdout.write(`${ansi.altScreen}${ansi.hideCursor}`);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  draw();
  const handleKey = (key) => {
    const items = current.items;
    if (key === '\u0003' || key === 'q') {
      cleanup();
      process.exit(0);
    } else if (key === '\u001b[A' || key === 'k') {
      selected = (selected - 1 + items.length) % Math.max(1, items.length);
      draw();
    } else if (key === '\u001b[B' || key === 'j') {
      selected = (selected + 1) % Math.max(1, items.length);
      draw();
    } else if (key === '\r' || key === '\n') {
      cleanup();
      executePaletteItem(items[selected], slug);
      process.exit(0);
    } else if (key === 'o') {
      if (!slug) exitForMissingSession();
      cleanup();
      openLatestSession({ session: slug });
      process.exit(0);
    } else if (key === 'n') {
      cleanup();
      console.log(`Start a new room with:\n\n  ${cliCommand()} <file-or-url>\n`);
      process.exit(0);
    } else if (key === '/') {
      if (!slug) exitForMissingSession();
      cleanup();
      askCurrentSession({ session: slug, text: 'Ask anything about the current topic' });
      process.exit(0);
    } else if (key === 'v') {
      if (!slug) exitForMissingSession();
      cleanup();
      runQualityQa({ session: slug });
      process.exit(0);
    } else if (key === 'c') {
      if (!slug) exitForMissingSession();
      cleanup();
      previewCrops({ session: slug, overwrite: true });
      process.exit(0);
    } else if (key === 'r') {
      if (!slug) exitForMissingSession();
      cleanup();
      regenerateStartHere({ session: slug });
      process.exit(0);
    } else if (key === 'e') {
      if (!slug) exitForMissingSession();
      cleanup();
      exportSession({ session: slug, format: 'pdf', overwrite: true });
      process.exit(0);
    }
  };
  process.on('SIGWINCH', draw);
  process.stdin.on('data', (chunk) => {
    const keys = String(chunk).match(/\x1b\[[ABCD]|[\s\S]/g) || [];
    for (const key of keys) handleKey(key);
  });
}

function listRecentSessions() {
  const recent = loadRecentSessions();
  if (!recent.length) {
    console.log(`No recent reading rooms yet.\n\nStart one with:\n  ${cliCommand()} <file-or-url>`);
    return;
  }
  console.log('Recent PaperMentor reading rooms\n');
  recent.forEach((item, index) => {
    console.log(`${String(index + 1).padStart(2, ' ')}. ${item.title || item.slug}`);
    console.log(`    ${cliCommand()} go --session ${item.slug}`);
    console.log(`    ${cliCommand()} open --session ${item.slug}`);
  });
}

function requireSessionSlug(args = {}, verb = 'command') {
  const slug = args.session || args.slug || latestSessionSlug();
  if (!slug) throw new Error(`${verb} needs a reading room; start one with ${cliCommand()} <file-or-url>`);
  if (!readStateForSlug(slug)) throw new Error(`session not found: ${slug}`);
  return slug;
}

function openLatestSession(args = {}) {
  const slug = requireSessionSlug(args, 'open');
  renderHtml(slug);
  openSessionHtml(slug);
  const html = `.papermentor/sessions/${slug}/index.html`;
  console.log(`Opened ${html}`);
}

function goLatestSession(args = {}) {
  const slug = requireSessionSlug(args, 'go');
  const state = readStateForSlug(slug);
  if (state?.paperSections?.length) {
    state.topicPickerOpen = true;
    state.currentMode = '';
    state.currentFocus = `Choose a ${sourceModeNoun(state.sourceMode)} topic`;
    state.selectedAction = '';
    state.updatedAt = now();
    writeJson(statePath(slug), state);
  }
  return runTui({ ...args, session: slug, cursor: 0 });
}

function askCurrentSession(args = {}) {
  const slug = requireSessionSlug(args, 'ask');
  const state = readStateForSlug(slug);
  const question = args.text || args.question || args._?.slice(1).join(' ') || readTextArg(args) || 'Ask anything about the current topic';
  state.currentMode = 'chat';
  state.currentFocus = question;
  state.selectedAction = `Answer question: ${question}`;
  state.lastChoiceKind = 'action';
  writePendingActionPrompt(state, state.selectedAction);
  state.updatedAt = now();
  writeJson(statePath(slug), state);
  appendTurn({ session: slug, role: 'user', text: question, 'no-promote': true, quiet: true });
  renderHtml(slug);
  console.log(renderRunnerConsole(state, state.selectedAction));
}

function prepareStartHerePrompt(state) {
  const slug = state.slug;
  if (!slug) throw new Error('Start Here regeneration needs an active reading room');
  if (normalizeSourceMode(state.sourceMode || 'paper') === 'slide') {
    writeSlideStartHerePrompt(state, state.paperSections || []);
  } else {
    const command = `${cliCommand()} card --session ${shellQuote(slug)} --type start-here --title 'Start Here' --body-file <your-markdown-file>`;
    const prompt = `# PaperMentor Start Here Regeneration Prompt

Write a finished Start Here block for ${state.title}.

Use the existing reading-room state and source excerpts to produce a real teaching introduction, not a scaffold. Include only prerequisites actually needed for this source; use equations or concrete examples when they are required by the material.

Append it with:

\`${command}\`
`;
    writeFileSync(promptPath(slug), prompt);
    state.pendingBlockPrompt = `.papermentor/sessions/${slug}/pending-prompt.md`;
    state.pendingBlockType = 'start-here';
    state.pendingBlockTitle = 'Start Here';
  }
  state.startHerePending = true;
  state.updatedAt = now();
  writeJson(statePath(slug), state);
  renderHtml(slug);
  return readStateForSlug(slug) || state;
}

function regenerateStartHere(args = {}) {
  const slug = requireSessionSlug(args, 'regenerate Start Here');
  prepareStartHerePrompt(readStateForSlug(slug));
  console.log(`Start Here prompt ready: .papermentor/sessions/${slug}/pending-prompt.md`);
}

function renderSession(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('render requires --session <slug>');
  if (!readJson(statePath(slug), null)) throw new Error(`session not found: ${slug}`);
  renderHtml(slug);
  console.log(`Rendered .papermentor/sessions/${slug}/index.html`);
}

function chromeCommand() {
  return commandPath('google-chrome')
    || commandPath('chrome')
    || commandPath('chromium')
    || commandPath('chromium-browser')
    || commandPath('Microsoft Edge')
    || (process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '')
    || (process.platform === 'darwin' && existsSync('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge') ? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' : '');
}

function exportSession(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('export requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  renderHtml(slug);
  const exportRoot = join(root, '.papermentor', 'exports');
  mkdirSync(exportRoot, { recursive: true });
  const requestedOutput = args.output || args.out || '';
  const format = String(args.format || (requestedOutput.toLowerCase().endsWith('.pdf') ? 'pdf' : 'zip')).toLowerCase();
  const extension = format === 'pdf' ? 'pdf' : 'zip';
  const output = resolve(requestedOutput || join(exportRoot, `${slug}-report.${extension}`));
  mkdirSync(dirname(output), { recursive: true });
  if (existsSync(output) && !args.overwrite) throw new Error(`export already exists: ${output}; pass --overwrite or choose --output`);
  if (existsSync(output)) rmSync(output, { force: true });
  const dir = sessionDir(slug);
  if (format === 'pdf') {
    const chrome = chromeCommand();
    if (!chrome) throw new Error('PDF export requires Chrome/Chromium/Edge on PATH, or Google Chrome installed on macOS');
    execFileSync(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions',
      '--virtual-time-budget=5000',
      '--no-pdf-header-footer',
      '--print-to-pdf-no-header',
      `--print-to-pdf=${output}`,
      `${pathToFileURL(indexPath(slug)).href}?papermentor-print=1`
    ], { stdio: 'pipe' });
    console.log(`Exported PaperMentor PDF:
- PDF: ${output}`);
    return;
  }
  const entries = ['index.html', 'assets', 'cards.json', 'notes.md', 'state.json', 'turns.jsonl']
    .filter((entry) => existsSync(join(dir, entry)));
  const zip = commandPath('zip');
  if (zip) {
    execFileSync(zip, ['-qry', output, ...entries], { cwd: dir, stdio: 'pipe' });
  } else {
    const code = `
import os, sys, zipfile
out = sys.argv[1]
entries = sys.argv[2:]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for entry in entries:
        if os.path.isdir(entry):
            for root, dirs, files in os.walk(entry):
                dirs[:] = [d for d in dirs if not d.startswith('preview-tmp-')]
                for name in files:
                    path = os.path.join(root, name)
                    z.write(path, path)
        elif os.path.isfile(entry):
            z.write(entry, entry)
`;
    execFileSync('python3', ['-c', code, output, ...entries], { cwd: dir, stdio: 'pipe' });
  }
  console.log(`Exported PaperMentor report bundle:
- ZIP: ${output}
- Open after unzip: index.html
- Includes: ${entries.join(', ')}`);
}

function showState(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('state requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  renderHtml(slug);
  console.log(`PaperMentor state
Source mode: ${sourceModeLabel(state.sourceMode)}
Location: ${state.currentLocation || state.currentSection || 'not selected'}
Focus: ${state.currentFocus || 'not set'}
HTML: .papermentor/sessions/${slug}/index.html
`);
  printConsole(state);
}

function pauseBody({ location, question, answer, missingDependency, minimalExample, reconnect }) {
  const lines = [
    '## Paused location',
    '',
    location || 'Current reading location.',
    '',
    '## User interruption',
    '',
    question || 'User asked for help at this point.',
    '',
    '## Direct answer',
    '',
    answer || 'Pending: answer this interruption in the next HTML block.',
    '',
    '## Missing dependency',
    '',
    missingDependency || 'Pending: identify the missing prerequisite, definition, equation, or assumption.',
    '',
    '## Minimal example',
    '',
    minimalExample || 'Pending: give the smallest concrete example that repairs the dependency.',
    '',
    '## Reconnect to source',
    '',
    reconnect || 'Pending: reconnect the answer to the exact equation, sentence, figure, or slide and resume.'
  ];
  return lines.join('\n');
}

function pauseReading(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('pause requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const question = args.question || readTextArg(args) || 'User interruption';
  const location = args.location || state.currentSection || state.currentLocation || state.title;
  const missingDependency = args['missing-dependency'] || args.dependency || '';
  const minimalExample = args.example || args['minimal-example'] || '';
  const reconnect = args.reconnect || args.resume || '';
  const answer = args.answer || '';
  state.pausedReading = {
    location,
    question,
    missingDependency,
    minimalExample,
    reconnect,
    createdAt: now()
  };
  state.currentLocation = location;
  state.currentMode = 'chat';
  state.currentFocus = `Paused at ${location}; repair the interruption in HTML, then resume.`;
  state.nextChoices = [
    `Answer interruption: ${question}`,
    missingDependency ? `Repair missing dependency: ${missingDependency}` : 'Identify the missing dependency',
    minimalExample ? 'Use the minimal example in the explanation' : 'Create a minimal example',
    `Resume from ${location}`
  ];
  state.updatedAt = now();
  writeJson(statePath(slug), state);
  if (answer || missingDependency || minimalExample || reconnect) {
    addCard({
      ...args,
      session: slug,
      type: args.type || 'confusion',
      title: args.title || `Interruption — ${trim(question, 70)}`,
      location,
      userQuestion: question,
      body: pauseBody({ location, question, answer, missingDependency, minimalExample, reconnect }),
      choices: args.choices || state.nextChoices.join('|')
    });
  } else {
    writePendingActionPrompt(state, `Answer interruption: ${question}`);
    writeJson(statePath(slug), state);
    renderHtml(slug);
    printConsole(state);
  }
}

function resumeReading(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('resume requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const paused = state.pausedReading || {};
  const location = args.location || paused.location || state.currentSection || state.currentLocation || state.title;
  const repaired = args.repaired || args.dependency || paused.missingDependency || 'interruption dependency';
  state.currentLocation = location;
  state.currentFocus = `Resumed from ${location}; repaired ${repaired}.`;
  state.currentMode = '';
  state.nextChoices = splitChoices(args.choices).length
    ? splitChoices(args.choices)
    : state.sectionActions?.[sectionKey(state.currentSection || location)] || defaultSectionActions(state.currentSection || location);
  delete state.pausedReading;
  clearPendingPrompt(state);
  state.updatedAt = now();
  writeJson(statePath(slug), state);
  renderHtml(slug);
  printConsole(state);
}

function sourceSeedFromInput(input, args = {}) {
  const clean = String(input || '').split(/[?#]/)[0];
  try {
    const url = new URL(String(input || ''));
    const driveId = url.hostname.includes('drive.google.com')
      ? (url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get('id'))
      : url.hostname.includes('docs.google.com')
        ? url.pathname.match(/\/(?:presentation|document)\/d\/([^/]+)/)?.[1]
        : '';
    if (driveId) return args.title || `google-drive-${driveId.slice(0, 10)}`;
  } catch {
    // Local paths and non-URL inputs fall through to basename handling.
  }
  const extension = sourceExtensionFromUrl(clean);
  return args.title || cleanTitleCandidate(basename(clean, extension)) || 'paper';
}

function openSessionHtml(slug) {
  const opener = process.platform === 'darwin' ? commandPath('open') : process.platform === 'win32' ? commandPath('cmd') : commandPath('xdg-open');
  if (!opener) return false;
  const htmlPath = indexPath(slug);
  if (process.platform === 'win32') spawnSync(opener, ['/c', 'start', '', htmlPath], { stdio: 'ignore', detached: true });
  else spawnSync(opener, [htmlPath], { stdio: 'ignore', detached: true });
  return true;
}

function extractLaunchTexts(source, args = {}) {
  let text = '';
  try {
    text = extractTextFromSourceFile(source, args);
  } catch (error) {
    if (!args['allow-empty-text']) throw error;
  }
  let orientationText = text;
  try {
    orientationText = extractTextFromSourceFile(source, { ...args, raw: true }) || text;
  } catch {
    orientationText = text;
  }
  return { text, orientationText };
}

function createLaunchShell({ input, source, args }) {
  const seed = sourceSeedFromInput(input, args);
  const provisionalTitle = args.title || seed || 'PaperMentor reading session';
  const slug = args.slug || slugify(provisionalTitle);
  const sourceMode = explicitSourceMode(args.mode || args['source-mode'], argsModeFromSource(source || input));
  const { state } = ensureSession({ title: provisionalTitle, authors: args.authors || args.author || '', source, slug, sections: [], sourceMode });
  state.currentLocation = `${sourceModeLabel(sourceMode)} launch`;
  state.currentFocus = `Preparing the HTML-first reading room for this ${sourceModeNoun(sourceMode)}.`;
  state.nextChoices = [`Detect ${sourceModeNoun(sourceMode)} sections`, 'Open the HTML reading room', 'Ask a question'];
  writeJson(statePath(slug), state);
  renderHtml(slug);
  return { slug, state };
}

function updateLaunchNavigation({ slug, source, args, text }) {
  const state = readJson(statePath(slug), null);
  const provisionalTitle = args.title || state?.title || titleFromSourceName(source) || 'PaperMentor reading session';
  const sourceMode = detectSourceMode(text, { ...args, source, title: provisionalTitle, mode: args.mode || args['source-mode'] || 'auto' }, { title: provisionalTitle, source });
  const metadata = inferMetadataFromText(text || '', args);
  const sourceTitle = titleFromSourceName(source);
  const slideTitle = normalizeSourceMode(sourceMode) === 'slide' ? inferSlideTitleFromText(text) : '';
  const title = args.title
    || (normalizeSourceMode(sourceMode) === 'slide'
      ? (slideTitle || provisionalTitle || sourceTitle || 'PaperMentor slide session')
      : (metadata.title || provisionalTitle || sourceTitle || 'PaperMentor reading session'));
  const authors = args.authors || args.author || metadata.authors || state?.authors || '';
  const blocks = text ? extractSourceBlocks(text, [], sourceMode) : [];
  const sections = blocks.map((block) => block.title).slice(0, 60);
  const ensured = ensureSession({ title, authors, source, slug, sections, sourceMode });
  const nextState = ensured.state;
  nextState.sectionActions = {};
  nextState.sectionInsights = {};
  for (const block of blocks) {
    const key = sectionKey(block.title);
    nextState.sectionActions[key] = actionProfileForSection(block.title, block.body, sourceMode);
    nextState.sectionInsights[key] = buildSectionInsight(block);
  }
  nextState.paperSections = sections;
  nextState.nextChoices = sections.length ? sections : nextState.nextChoices;
  nextState.currentLocation = `${sourceModeLabel(sourceMode)} section navigator`;
  nextState.currentFocus = `Launched from one command. Open the HTML report, then choose a ${sourceModeNoun(sourceMode)} section.`;
  writeJson(statePath(slug), nextState);
  return { state: nextState, sourceMode, sections, blocks };
}


function collectRepresentativeFigureCandidates(text, blocks = []) {
  const fullText = String(text || '').replace(/\r/g, '');
  const pages = fullText.split('\f');
  const candidates = [];
  const captionRegex = /\b(?:Figure|Fig\.)\s*(\d{1,3}[A-Za-z]?)\s*[:.\-–—]\s*([^\n]{0,220})/i;
  pages.forEach((pageText, pageIndex) => {
    const lines = pageText.split(/\n/);
    lines.forEach((line, lineIndex) => {
      const match = line.match(captionRegex);
      if (!match) return;
      const label = match[1];
      const continuation = [];
      for (let cursor = lineIndex + 1; cursor < Math.min(lines.length, lineIndex + 4); cursor += 1) {
        const next = lines[cursor].trim();
        if (!next) break;
        if (/^(?:\d+(?:\.\d+)*\.?|[A-Z])\s+[A-Z][A-Za-z0-9 ,:;()/-]{2,80}$/.test(next)) break;
        if (/\b(?:Figure|Fig\.)\s*\d{1,3}[A-Za-z]?\b/i.test(next)) break;
        continuation.push(next);
      }
      const caption = `${match[2] || ''} ${continuation.join(' ')}`.replace(/\s+/g, ' ').trim().slice(0, 420);
      const nearbyLines = lines
        .slice(Math.max(0, lineIndex - 4), Math.min(lines.length, lineIndex + 5))
        .map((item) => item.trim())
        .filter(Boolean);
      const section = (blocks || []).find((block) => caption && String(block.body || '').includes(caption.slice(0, Math.min(80, caption.length))))?.title || '';
      candidates.push({
        label,
        auto: `figure${label}`,
        page: pageIndex + 1,
        caption,
        section,
        nearbyText: nearbyLines.join(' ').replace(/\s+/g, ' ').slice(0, 700)
      });
    });
  });
  return candidates.sort((a, b) => a.page - b.page || Number(String(a.label).match(/\d+/)?.[0] || 999) - Number(String(b.label).match(/\d+/)?.[0] || 999));
}

function representativeFigureSelectionPrompt({ state, source, candidates = [] }) {
  const commandSource = commandSourcePath(state.slug, resolve(source));
  const lines = [
    '# PaperMentor Representative Figure Selection Prompt',
    '',
    'You are choosing the representative figure for the Start Here block.',
    '',
    'The script only collected `Figure` / `Fig.` caption candidates and nearby source text. It did not score, rank, or semantically classify them. Do the representative-figure judgment yourself from the caption, nearby text, section context, and the source goal.',
    '',
    'Choose exactly one candidate only if it is the figure that best explains the paper’s method, system, algorithm, architecture, mechanism, or central construction. If all candidates are result plots, ablations, benchmark tables, generic illustrations, or not actually representative of the method, choose **no representative figure** and keep the explicit fallback in Start Here.',
    '',
    'When judging, consider whether the candidate appears in or near a method-like section, but do not decide by keyword matching. Read the section/caption semantically: ask whether this figure teaches how the paper’s main object works, not merely what result it achieved.',
    '',
    'If you choose a candidate, inspect the crop preview or run `preview-crops`, then attach the crop with `extract-figure`. After attaching, replace any placeholder figure explanation with a real element-by-element reading from the pixels.',
    '',
    '## Source',
    '',
    `- Session: ${state.slug}`,
    `- Title: ${state.title}`,
    `- Source: ${commandSource}`,
    '',
    '## Candidates',
    '',
    ...(candidates.length ? candidates.flatMap((candidate, index) => [
      `### ${index + 1}. Figure ${candidate.label} — page ${candidate.page}`,
      '',
      `- Auto selector: \`${candidate.auto}\``,
      `- Section context: ${candidate.section || '(unknown; use nearby text)'}`,
      `- Caption: ${candidate.caption || '(caption text unavailable)'}`,
      `- Nearby text: ${candidate.nearbyText || '(none extracted)'}`,
      `- Preview command: \`${cliCommand()} preview-crops --session ${shellQuote(state.slug)} --source ${shellQuote(commandSource)} --page ${candidate.page} --auto ${shellQuote(candidate.auto)} --overwrite\``,
      `- Attach command after visual inspection: \`${cliCommand()} extract-figure --session ${shellQuote(state.slug)} --source ${shellQuote(commandSource)} --page ${candidate.page} --auto ${shellQuote(candidate.auto)} --type start-here --title 'Start Here' --body-file <finished-start-here.md>\``,
      ''
    ]) : ['No `Figure` / `Fig.` caption candidates were extracted.', '']),
    '## Required decision',
    '',
    'Write one short decision note:',
    '',
    '- `selected: Figure <label>` or `selected: none`',
    '- why this is or is not representative',
    '- what crop/preview command to run next',
    '- what the figure reading must verify from the pixels before it is trusted'
  ];
  return lines.join('\n');
}

function writeRepresentativeFigureSelectionPrompt({ slug, source, candidates = [] }) {
  const state = readJson(statePath(slug), {});
  const prompt = representativeFigureSelectionPrompt({ state, source, candidates });
  const out = safeSessionPath(slug, 'representative-figure-prompt.md');
  writeFileSync(out, prompt);
  state.representativeFigureCandidates = candidates;
  state.representativeFigurePrompt = `.papermentor/sessions/${slug}/representative-figure-prompt.md`;
  if (candidates.length) {
    state.figureSelectionWarning = 'Representative figure candidates require model selection; no script score was used.';
  }
  state.updatedAt = now();
  writeJson(statePath(slug), state);
  return out;
}

function attachLaunchStartBlock({ slug, source, args, sourceMode, sections, body, representativeFigureCandidates = [] }) {
  const extension = extname(source).toLowerCase();
  const canExtractVisual = ['.pdf', '.ppt', '.pptx', '.key', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension);
  const sourceIsImage = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension);
  const isSlide = normalizeSourceMode(sourceMode) === 'slide';
  const explicitStartFigure = Boolean(args['start-figure'] || args['start-visual'] || args.auto || args.figure || args['figure-number'] || args.crop || args.page || args.slide);
  const shouldAutoAttachPaperFigure = !isSlide && canExtractVisual && !args['no-figure'] && (explicitStartFigure || sourceIsImage);
  const addStartHereOnly = (startBody = body) => addCard({ ...args, session: slug, type: 'start-here', title: args['card-title'] || 'Start Here', location: 'Start Here', body: startBody, choices: sections.join('|'), quiet: true, noPath: true });
  if (isSlide && !explicitStartFigure) {
    addStartHereOnly(body);
    return { canExtractVisual, attachedVisual: false };
  }
  if (args['no-figure']) {
    const state = readJson(statePath(slug), {});
    state.figureSelectionWarning = 'Representative figure attachment was disabled with --no-figure.';
    state.updatedAt = now();
    writeJson(statePath(slug), state);
    addStartHereOnly(appendFigureFallbackNote(body, 'figure attachment was disabled for this run.'));
  } else if (!canExtractVisual) {
    const state = readJson(statePath(slug), {});
    state.figureSelectionWarning = `Source type ${extension || '(none)'} cannot be rendered as a figure crop.`;
    state.updatedAt = now();
    writeJson(statePath(slug), state);
    addStartHereOnly(appendFigureFallbackNote(body, 'this source type cannot be rendered as a figure crop.'));
  } else if (!shouldAutoAttachPaperFigure) {
    const state = readJson(statePath(slug), {});
    state.figureSelectionWarning = representativeFigureCandidates.length
      ? 'Representative figure candidates require model selection; no script score was used.'
      : 'No Figure/Fig. caption candidates were detected for representative figure selection.';
    state.updatedAt = now();
    writeJson(statePath(slug), state);
    addStartHereOnly(appendFigureFallbackNote(
      body,
      representativeFigureCandidates.length
        ? `representative figure selection is pending in .papermentor/sessions/${slug}/representative-figure-prompt.md.`
        : 'no Figure/Fig. caption candidates were detected.'
    ));
  } else {
    const requestedPage = args.page || args.slide;
    const requestedAuto = args.auto || args.figure || args['figure-number'];
    const auto = requestedAuto || (extension === '.pdf' ? (requestedPage ? 'figure1' : undefined) : undefined);
    const page = requestedPage || 1;
    const representativeCaption = '';
    try {
      extractFigure({
        ...args,
        session: slug,
        source,
        page,
        auto,
        type: 'start-here',
        title: args['card-title'] || 'Start Here',
        location: 'Start Here',
        body,
        caption: args.caption || args['figure-caption'] || representativeCaption,
        quiet: true,
        noPath: true
      });
    } catch (error) {
      const state = readJson(statePath(slug), {});
      state.figureExtractionWarning = error.message;
      state.updatedAt = now();
      writeJson(statePath(slug), state);
      try {
        extractFigure({
          ...args,
          session: slug,
          source,
          page,
          auto: undefined,
          figure: undefined,
          'figure-number': undefined,
          crop: undefined,
          type: 'start-here',
          title: args['card-title'] || 'Start Here',
          location: 'Start Here',
          body,
          caption: args.caption || args['figure-caption'] || `Page ${page}. Full-page visual fallback; run ${cliCommand()} preview-crops for a tighter figure crop if needed.`,
          choices: sections.join('|'),
          quiet: true,
          noPath: true
        });
      } catch (fallbackError) {
        state.figureExtractionFallbackWarning = fallbackError.message;
        state.updatedAt = now();
        writeJson(statePath(slug), state);
        addStartHereOnly(appendFigureFallbackNote(body, `automatic extraction failed (${error.message}); full-page fallback also failed (${fallbackError.message}).`));
      }
    }
  }
  return { canExtractVisual, attachedVisual: shouldAutoAttachPaperFigure };
}

function maybeWriteCropPreview({ slug, source, args, canExtractVisual, representativeFigure = null }) {
  if (!canExtractVisual || args['no-preview']) return;
  try {
    previewCrops({
      ...args,
      session: slug,
      source,
      page: args.page || representativeFigure?.page || 1,
      auto: args.auto || representativeFigure?.auto,
      title: args['figure-title'] || 'Representative figure',
      overwrite: true,
      quiet: true
    });
  } catch (error) {
    console.error(`PaperMentor preview warning: ${error.message}`);
  }
}

function launchSession(args) {
  const input = args.source || args.input || args._[1];
  if (!input) throw new Error('launch requires a source URL or local file: launch <paper-url-or-file>');
  const sourceSeed = sourceSeedFromInput(input, args);
  const source = downloadSourceIfNeeded(input, sourceSeed, args);
  const { slug } = createLaunchShell({ input, source, args });
  const { text, orientationText } = extractLaunchTexts(source, args);
  const { state, sourceMode, sections, blocks } = updateLaunchNavigation({ slug, source, args, text });
  addReadingGuideBlock({ slug, sourceMode, sections, args });
  const extension = extname(source).toLowerCase();
  const canExtractVisualForPreview = ['.pdf', '.ppt', '.pptx', '.key', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension);
  const hasProvidedStartHereBody = Boolean(args.body || args['body-file']);
  if (normalizeSourceMode(sourceMode) === 'slide' && !hasProvidedStartHereBody) {
    const pendingState = readJson(statePath(slug), state);
    writeSlideStartHerePrompt(pendingState, sections);
    pendingState.updatedAt = now();
    writeJson(statePath(slug), pendingState);
    maybeWriteCropPreview({ slug, source, args, canExtractVisual: canExtractVisualForPreview });
    renderHtml(slug);
    if (args.open) openSessionHtml(slug);
    const finalState = readJson(statePath(slug), pendingState);
    printConsole(finalState);
    console.log(`\nLaunch complete:
- HTML: .papermentor/sessions/${slug}/index.html
- Start Here prompt: .papermentor/sessions/${slug}/pending-prompt.md
- TUI:  ${cliCommand()} tui --session ${slug}
${finalState.cropPreview ? `- Crop preview: ${finalState.cropPreview}\n` : ''}- Next: write the Start Here body from the pending prompt, then append it with ${cliCommand()} card --session ${slug} --type start-here --title 'Start Here' --body-file <file>`);
    return slug;
  }
  const body = args.body || launchStartBody({ sourceMode, text: orientationText, sections });
  const representativeFigureCandidates = normalizeSourceMode(sourceMode) === 'paper'
    ? collectRepresentativeFigureCandidates(text || orientationText, blocks)
    : [];
  if (representativeFigureCandidates.length && !args['no-figure'] && !args.auto && !args.figure && !args['figure-number'] && !args.crop && !args.page && !args.slide) {
    writeRepresentativeFigureSelectionPrompt({ slug, source, candidates: representativeFigureCandidates });
  }
  const launchVisual = attachLaunchStartBlock({ slug, source, args, sourceMode, sections, body, representativeFigureCandidates });
  const startHereCard = readJson(cardsPath(slug), { cards: [] }).cards.find((existing) => existing.type === 'start-here');
  const startHereIsScaffold = !startHereCard || /Not built yet|Not written yet/.test(startHereCard.body || '');
  const startHereScaffolded = !args.body && startHereIsScaffold;
  const figureScaffoldShipped = launchVisual.attachedVisual && !args.body && !args['no-figure'] && startHereIsScaffold;
  if (startHereScaffolded) {
    const pendingState = readJson(statePath(slug), {});
    pendingState.startHerePending = true;
    if (figureScaffoldShipped) pendingState.figureReadingPending = true;
    pendingState.updatedAt = now();
    writeJson(statePath(slug), pendingState);
  }
  maybeWriteCropPreview({ slug, source, args, canExtractVisual: launchVisual.canExtractVisual, representativeFigure: null });
  renderHtml(slug);
  if (args.open) openSessionHtml(slug);
  const finalState = readJson(statePath(slug), state);
  printConsole(finalState);
  console.log(`\nLaunch complete:
- HTML: .papermentor/sessions/${slug}/index.html
- TUI:  ${cliCommand()} tui --session ${slug}
${finalState.cropPreview ? `- Crop preview: ${finalState.cropPreview}\n` : ''}${finalState.startHerePending ? `- Next: read the source and replace the Start Here scaffold with real content — the one-sentence model, the figure reading (every box, arrow, line, and in-figure equation), and a beginner-facing preliminary ladder that teaches each prerequisite from zero with concrete numeric examples (see prompts/prerequisite-analyzer.md).` : ''}`);
  if (finalState.representativeFigurePrompt) {
    console.log(`- Representative figure selection prompt: ${finalState.representativeFigurePrompt}`);
  }
  return slug;
}

function usage(options = {}) {
  if (!options.advanced) {
    console.log(`PaperMentor

User commands:
  pm                         open the command palette
  pm <file-or-url>           start a reading room
  pm open                    open the latest/current HTML
  pm go                      continue in the arrow-key palette
  pm ask "question"          ask about the current topic
  pm qa                      score current HTML blocks for teaching quality
  pm export                  export the latest/current room as PDF
  pm recent                  list recent reading rooms
  pm doctor                  check local PDF/PPT extraction tools

Also available as: papermentor

Advanced/internal commands still exist for agents and scripts:
  papermentor launch <paper-url-or-file> [--open] [--slug <slug>]
  papermentor help --advanced
`);
    return;
  }
  console.log(`PaperMentor advanced/internal commands

Usage:
  papermentor launch <paper-url-or-file> [--open] [--slug <slug>]
  papermentor start --title <title> [--authors <names>] [--source <url>] [--mode paper|slide] [--slug <slug>] [--sections "1 Intro|2 Method"] [--body-file start.md] [--figure-file crop.png]
  papermentor analyze --session <slug> --paper-text-file source.txt
  papermentor tui --session <slug>
  papermentor run --session <slug> --index <n>
  ${cliCommand()} extract-figure --session <slug> --source paper.pdf --page 1 [--auto figure1|--crop x,y,w,h] [--title <title>]
  papermentor sections --session <slug> --sections "1 Intro|2 Method"
  papermentor section --session <slug> --index 2
  papermentor mode --session <slug> --mode equations --items "Explain Eq. (1)|Explain Eq. (6)"
  papermentor diagram --session <slug> [--kind method-pipeline] [--nodes "A|B|C"]
  papermentor preview-crops --session <slug> --source paper.pdf --page 1
  papermentor qa --session <slug> [--json] [--min 82]
  papermentor qa-batch --sessions "slugA|slugB" [--json] [--min 82]
  papermentor figure-audit --sessions "slugA|slugB" [--json]
  papermentor proof-audit --sessions "slugA|slugB" [--json]
  papermentor card --session <slug> --type equation --title <title> [--latex <tex>] [--user-question <text>] [--figure-file <path>] [--figure-caption <text>] [--body <text>|--body-file <path>] [--choices "A|B|C"]
  papermentor turn --session <slug> --role user --text <text> [--promote|--no-promote]
  papermentor promote --session <slug> --title <title> --user-question <text> --body-file <path>
  papermentor pause --session <slug> --question <text> [--answer <text>] [--missing-dependency <text>]
  papermentor resume --session <slug> [--repaired <text>]
  papermentor render --session <slug>
  papermentor export --session <slug> [--format zip|pdf] [--output report.zip|report.pdf] [--overwrite]
  papermentor state --session <slug>
  papermentor status --session <slug>
  papermentor doctor [--json]
`);
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
if (args.help || args.h || command === 'help' || command === '--help' || command === '-h') {
  usage({ advanced: args.advanced || args.a || args._.includes('--advanced') || args._[1] === 'advanced' });
  process.exit(0);
}
try {
  if (!command || command === '/papermentor' || command === 'papermentor') {
    runWelcome(args);
  } else if (command === 'menu' || command === 'palette') {
    runPalette(args);
  } else if (isSourceLike(command)) {
    launchSession({ ...args, _: ['launch', command], source: args.source || command });
  } else if (command === 'open' || command === 'last') {
    openLatestSession(args);
  } else if (command === 'go' || command === 'continue') {
    goLatestSession(args);
  } else if (command === 'recent' || command === 'rooms') {
    listRecentSessions();
  } else if (command === 'ask') {
    askCurrentSession({ ...args, text: args.text || args.question || args._.slice(1).join(' ') });
  } else if (command === 'new') {
    const source = args.source || args.input || args._[1];
    if (source) launchSession({ ...args, _: ['launch', source], source });
    else runPalette(args);
  } else if (command === 'regenerate-start' || command === 'start-here') {
    regenerateStartHere(args);
  } else if (command === 'launch') {
    launchSession(args);
  } else if (command === 'start') {
    const title = args.title || 'Paper reading session';
    const authors = args.authors || args.author || '';
    const slug = args.slug || slugify(title);
    const source = args.source || '';
    const sections = splitChoices(args.sections || '');
    const modeHint = argsModeFromSource(`${source} ${title}`);
    const sourceMode = explicitSourceMode(args.mode || args['source-mode'] || args.sourceMode, modeHint);
    const { state, cards } = ensureSession({ title, authors, source, slug, sections, sourceMode });
    const hasStartHereBody = Boolean(args.body || args['body-file'] || args['figure-file'] || args['figure-url'] || args.figure || args['image-file'] || args.image || args.latex);
    if (hasStartHereBody) {
      addCard({
        ...args,
        session: slug,
        type: args.type || 'start-here',
        title: args['card-title'] || args.cardTitle || 'Start Here',
        location: args.location || 'Start Here',
        choices: args.choices || sections.join('|')
      });
    } else {
      printConsole(state, cards);
    }
  } else if (command === 'sections') {
    setSections(args);
  } else if (command === 'analyze') {
    analyzePaper(args);
  } else if (command === 'tui') {
    runTui(args);
  } else if (command === 'run' || command === 'choose') {
    runChoice(args);
  } else if (command === 'section') {
    selectSection(args);
  } else if (command === 'mode') {
    setMode(args);
  } else if (command === 'diagram') {
    addDiagram(args);
  } else if (command === 'preview-crops' || command === 'preview') {
    previewCrops(args);
  } else if (command === 'qa' || command === 'quality' || command === 'check') {
    runQualityQa(args);
  } else if (command === 'qa-batch' || command === 'batch-qa' || command === 'quality-batch') {
    batchQualityQa(args);
  } else if (command === 'figure-audit' || command === 'figures' || command === 'crop-audit') {
    runFigureAudit(args);
  } else if (command === 'proof-audit' || command === 'proofs') {
    runProofAudit(args);
  } else if (command === 'extract-figure') {
    extractFigure(args);
  } else if (command === 'card') {
    addCard(args);
  } else if (command === 'turn') {
    appendTurn(args);
  } else if (command === 'promote') {
    addCard({ ...args, type: args.type || 'confusion' });
  } else if (command === 'pause') {
    pauseReading(args);
  } else if (command === 'resume') {
    resumeReading(args);
  } else if (command === 'render') {
    renderSession(args);
  } else if (command === 'export' || command === 'bundle') {
    const slug = args.session || args.slug || latestSessionSlug();
    exportSession({ ...args, session: slug });
  } else if (command === 'state') {
    showState(args);
  } else if (command === 'status') {
    const slug = args.session || args.slug;
    if (!slug) throw new Error('status requires --session <slug>');
    renderHtml(slug);
    printConsole(readJson(statePath(slug), {}));
  } else if (command === 'doctor') {
    runDoctor(args);
  } else {
    usage();
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(`PaperMentor session error: ${error.message}`);
  process.exit(1);
}
