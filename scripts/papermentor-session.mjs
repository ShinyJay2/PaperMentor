#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync, cpSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  'lecture-note': [
    ['map', 'Map the lecture note'],
    ['prerequisites', 'Build concept ladder'],
    ['notation', 'Decode notation and examples'],
    ['derivations', 'Trace derivations / proofs'],
    ['confusion', 'Resolve confusion'],
    ['final', 'Extract final insight']
  ],
  'slide-deck': [
    ['map', 'Map the slide deck'],
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
  if (['lecture-note', 'lecture-notes', 'note', 'notes', 'technical-note', 'monograph'].includes(raw)) return 'lecture-note';
  if (['slide', 'slides', 'slide-deck', 'deck', 'ppt', 'pptx', 'presentation'].includes(raw)) return 'slide-deck';
  if (raw === 'auto' || raw === '') return fallback;
  return fallback;
}

function sourceModeLabel(mode) {
  return { paper: 'Paper', 'lecture-note': 'Lecture note', 'slide-deck': 'Slide deck' }[normalizeSourceMode(mode)] || 'Paper';
}

function sourceModeNoun(mode) {
  return { paper: 'paper', 'lecture-note': 'lecture note', 'slide-deck': 'slide deck' }[normalizeSourceMode(mode)] || 'paper';
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

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}


function argsModeFromSource(source) {
  const value = String(source || '').toLowerCase();
  if (/\.(pptx?|key)(\?|#|$)/.test(value) || /slide|deck|presentation/.test(value)) return 'slide-deck';
  if (/lecture[-\s]?note|notes|monograph/.test(value)) return 'lecture-note';
  return 'paper';
}

function defaultState({ title, source, slug, sections = [], sourceMode = 'paper' }) {
  return {
    schema: 'papermentor.session.v1',
    title,
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

function ensureSession({ title, source, slug, sections = [], sourceMode }) {
  const dir = sessionDir(slug);
  mkdirSync(dir, { recursive: true });
  const state = existsSync(statePath(slug))
    ? readJson(statePath(slug), {})
    : defaultState({ title, source, slug, sections, sourceMode: sourceMode || argsModeFromSource(source) });
  state.updatedAt = now();
  state.title = title || state.title;
  state.source = source || state.source;
  state.sourceMode = normalizeSourceMode(sourceMode || argsModeFromSource(source) || state.sourceMode, state.sourceMode || 'paper');
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
    'lecture-note': {
      prerequisite: 'prerequisites', prerequisites: 'prerequisites', 'prerequisite-ladder': 'prerequisites', 'concept-ladder': 'prerequisites',
      equation: 'notation', 'equation-card': 'notation', example: 'notation', 'example-walkthrough': 'notation',
      dependency: 'derivations', dependencies: 'derivations', proof: 'derivations', 'proof-walkthrough': 'derivations'
    },
    'slide-deck': {
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
  console.log(`Logged ${turn.id} (${turn.role}, ${turn.promotion}) to .papermentor/sessions/${slug}/turns.jsonl`);
}

function hasForbiddenDiagramSubstitute(markdown) {
  return /```\s*mermaid\b/i.test(markdown)
    || /^\s*(graph|flowchart)\s+(TD|TB|BT|RL|LR)\b/im.test(markdown)
    || /<div[^>]+class=["'][^"']*mermaid/i.test(markdown);
}

function splitChoices(value) {
  if (!value) return [];
  return String(value).split('|').map((x) => x.trim()).filter(Boolean);
}


function isUrl(value) {
  return /^https?:\/\//i.test(String(value || '')) || /^data:/i.test(String(value || ''));
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

function copyBundledReportAssets(slug) {
  mkdirSync(assetDir(slug), { recursive: true });
  const sourceFonts = join(bundledAssetsDir, 'fonts');
  if (existsSync(sourceFonts)) cpSync(sourceFonts, join(assetDir(slug), 'fonts'), { recursive: true });
  const sourceMathJax = join(bundledAssetsDir, 'mathjax');
  if (existsSync(sourceMathJax)) cpSync(sourceMathJax, join(assetDir(slug), 'mathjax'), { recursive: true });
}


function commandPath(name) {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(lookup, [name], { encoding: 'utf8' });
  if (result.status !== 0) return '';
  return String(result.stdout || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
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

function convertPptToPdf(source, outDir) {
  const soffice = commandPath('soffice') || commandPath('libreoffice');
  if (!soffice) throw new Error('PPT/PPTX extraction requires LibreOffice (`soffice`) on PATH to convert slides to PDF');
  mkdirSync(outDir, { recursive: true });
  runTool(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', outDir, source], 'LibreOffice could not convert the deck to PDF');
  const pdf = join(outDir, `${basename(source, extname(source))}.pdf`);
  if (!existsSync(pdf)) throw new Error(`LibreOffice conversion finished but no PDF was found at ${pdf}`);
  return pdf;
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

function autoFigureCropFromPdf(pdfPath, pageNumber, args = {}) {
  const pdftotext = commandPath('pdftotext');
  if (!pdftotext) return null;
  const label = String(args.auto || args.figure || args['figure-number'] || '1').replace(/^fig(?:ure)?\.?\s*/i, '') || '1';
  let xml = '';
  try {
    xml = execFileSync(pdftotext, ['-bbox', '-f', String(pageNumber), '-l', String(pageNumber), pdfPath, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return null;
  }
  const { page, words } = parsePdfBbox(xml);
  const figureIndex = words.findIndex((word, index) => /^fig(?:ure)?\.?$/i.test(word.text) && new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.:]?$`).test(words[index + 1]?.text || ''));
  if (figureIndex < 0) return null;
  const figureWord = words[figureIndex];
  const after = words.filter((word) => word.yMin > figureWord.yMin + 18);
  const nextHeading = after.find((word) => /^(Abstract|Introduction|Background|Preliminaries|Methods?|Experiments?|Conclusion|References)$/i.test(word.text));
  const topPt = Math.max(0, figureWord.yMin - Number(args['auto-top-pad'] || 114));
  const bottomPt = Math.min(page.height, (nextHeading?.yMin || figureWord.yMin + Number(args['auto-height'] || 86)) - Number(args['auto-bottom-pad'] || 8));
  const leftPt = Number(args['auto-left'] || 50);
  const rightPt = Number(args['auto-right'] || (page.width - 50));
  const scaleX = Number(args.dpi || 180) / 72;
  const scaleY = Number(args.dpi || 180) / 72;
  return {
    x: Math.max(0, Math.round(leftPt * scaleX)),
    y: Math.max(0, Math.round(topPt * scaleY)),
    width: Math.max(80, Math.round((rightPt - leftPt) * scaleX)),
    height: Math.max(80, Math.round((bottomPt - topPt) * scaleY))
  };
}

function visualExplanationBody(args, state) {
  const question = args.question || `What does this visual explain in ${state.currentSection || state.title}?`;
  const concept = args.concept || args.title || 'Representative visual';
  const observe = args.observe || args['what-to-observe'] || 'Follow the labeled objects and arrows before reading the surrounding equations.';
  const conclusion = args.conclusion || 'Use this visual as the anchor for the next HTML explanation block.';
  return `## Extracted visual explanation\n\n- **Question:** ${question}\n- **Concept:** ${concept}\n- **What to observe:** ${observe}\n- **Conclusion:** ${conclusion}`;
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
  const tempDir = join(assetDir(slug), '.extract-tmp');
  let rendered = absoluteSource;
  let renderedPdf = extension === '.pdf' ? absoluteSource : '';
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
    const autoCrop = requestedAutoCrop && renderedPdf ? autoFigureCropFromPdf(renderedPdf, page, { ...args, dpi }) : null;
    if (requestedAutoCrop && renderedPdf && !autoCrop) {
      throw new Error(`auto crop could not locate Figure ${String(args.auto || args.figure || args['figure-number']).replace(/^fig(?:ure)?\.?\s*/i, '') || '1'} on page/slide ${page}; rerun with an explicit --crop x,y,width,height`);
    }
    cropImage(rendered, extracted, args.crop || autoCrop);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
  const type = args.type || (normalizeSourceMode(state.sourceMode) === 'slide-deck' ? 'slide-explanation' : 'paper-map');
  addCard({
    ...args,
    session: slug,
    type,
    title,
    location: args.location || state.currentSection || `Page ${page}`,
    body: readBody(args) || visualExplanationBody(args, state),
    'figure-file': extracted,
    'figure-caption': args['figure-caption'] || args.caption || `Representative visual extracted from page/slide ${page}.`,
    choices: args.choices || `Explain this visual|Connect it to the next equation|Ask anything about ${state.currentSection || state.title}`
  });
  console.log(`Extracted visual saved to .papermentor/sessions/${slug}/assets/${basename(extracted)}`);
}

function prepareFigure(slug, cardId, args) {
  const source = args['figure-file'] || args.figure || args['figure-url'] || args['image-file'] || args.image;
  if (!source) return null;

  let src = String(source);
  if (!isUrl(src)) {
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

function defaultSectionActions(section) {
  return [
    `Decode key equations in ${section}`,
    `Trace derivations in ${section}`,
    `Connect dependencies in ${section}`,
    `Resolve confusion in ${section}`,
    `Ask a question about ${section}`
  ];
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
  if (explicit && String(explicit).toLowerCase() !== 'auto') return normalizeSourceMode(explicit, state.sourceMode || 'paper');
  const sourceHint = `${args.source || state.source || ''} ${args.title || state.title || ''}`;
  const bySource = argsModeFromSource(sourceHint);
  if (bySource !== 'paper') return bySource;
  const value = String(text || '');
  const lower = value.toLowerCase();
  const slideMatches = (value.match(/^\s*(slide|page)\s+\d+\b/gim) || []).length;
  const pageBreaks = (value.match(/\f/g) || []).length;
  const bulletLines = (value.match(/^\s*[-•▪◦]\s+/gm) || []).length;
  const paragraphLines = value.split(/\r?\n/).filter((line) => line.trim().length > 120).length;
  if (slideMatches >= 2 || (/\bslides?\b|\bdeck\b|\bpresentation\b/.test(lower) && bulletLines >= 8) || (pageBreaks >= 5 && bulletLines > paragraphLines * 2)) {
    return 'slide-deck';
  }
  if (/lecture\s+notes?|course\s+notes?|chapter\s+\d+|exercise\s+\d+|problem\s+set|learning\s+objective|worked\s+example/.test(lower)) {
    return 'lecture-note';
  }
  if (/this\s+lecture\s+note|these\s+notes|aimed\s+at\s+students|without\s+prior\s+exposure/.test(lower)) {
    return 'lecture-note';
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
  if (normalizeSourceMode(sourceMode) === 'paper' && level > 3) return false;
  if (normalizeSourceMode(sourceMode) === 'lecture-note' && level > 4 && !sectionHeadingWords.test(clean)) return false;
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
    const line = rawLine.trim();
    const numbered = line.match(/^(\d+(?:\.\d+)*)(?:\.|\s)\s+(.{3,120})$/);
    const unnumbered = line.match(/^(Abstract|Introduction|Background|Preliminaries|Related Work|Methods?|Approach|Model|Algorithm|Experiments?|Evaluation|Results|Discussion|Conclusion|Appendix(?:\s+[A-Z])?)(?:\s*[:—-]\s*(.{2,90}))?$/i);
    if (numbered) {
      const title = cleanHeadingTitle(`${numbered[1]}. ${numbered[2]}`);
      if (looksLikeSectionHeading(numbered[1], numbered[2], line, sourceMode)) found.push({ title, index: offset });
    } else if (unnumbered) {
      const title = cleanHeadingTitle(`${unnumbered[1]}${unnumbered[2] ? ` — ${unnumbered[2]}` : ''}`);
      if (looksLikeSectionHeading('', title, line, sourceMode)) found.push({ title, index: offset });
    }
    offset += rawLine.length + 1;
  }
  const headings = unique(found.map((item) => item.title))
    .map((title) => found.find((item) => item.title === title))
    .sort((a, b) => a.index - b.index)
    .slice(0, normalizeSourceMode(sourceMode) === 'lecture-note' ? 80 : 50);
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

function firstSlideTitle(chunk, fallback) {
  const lines = String(chunk || '').split(/\n/).map((line) => line.trim()).filter(Boolean);
  const strong = lines.find((line) => line.length >= 4 && line.length <= 96 && !/^[-•▪◦]/.test(line) && !/^\d+$/.test(line));
  return cleanHeadingTitle(strong || fallback);
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
    source.split('\f').forEach((chunk, index) => {
      markers.push({ title: `Slide ${index + 1} — ${firstSlideTitle(chunk, `Slide ${index + 1}`)}`, index: offset });
      offset += chunk.length + 1;
    });
  }
  if (!markers.length && preferredSections.length) {
    markers.push(...preferredSections.map((title) => ({ title, index: source.indexOf(title) })).filter((item) => item.index >= 0));
  }
  return markers.slice(0, 80).map((item, index) => {
    const next = markers[index + 1]?.index ?? source.length;
    return { title: item.title, body: source.slice(item.index, next).trim().slice(0, 16000) };
  });
}

function extractSourceBlocks(text, preferredSections = [], sourceMode = 'paper') {
  if (normalizeSourceMode(sourceMode) === 'slide-deck') return extractSlideBlocks(text, preferredSections);
  return extractSectionBlocks(text, preferredSections, sourceMode);
}

function sectionNumberParts(title) {
  const match = String(title || '').match(/^(\d+(?:\.\d+)*)\./);
  if (!match) return [];
  return match[1].split('.').map((part) => Number(part));
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

function detectCitations(text) {
  return unique([...String(text || '').matchAll(/\b([A-Z][A-Za-z\-]+(?:\s*&\s*[A-Z][A-Za-z\-]+)?|[A-Z][A-Za-z\-]+\s+et\s+al\.)[,\s]+(?:19|20)\d{2}\b/g)].map((match) => match[0].replace(/\s+/g, ' ')))
    .slice(0, 8);
}

function detectConcepts(text) {
  const concepts = [
    ['pushforward', 'pushforward distribution'],
    ['drifting field', 'drifting field'],
    ['stop-gradient', 'stop-gradient target'],
    ['stopgrad', 'stop-gradient target'],
    ['anti-symmetric', 'anti-symmetric drifting field'],
    ['kernel', 'kernelized drift field'],
    ['mean-shift', 'mean-shift attraction/repulsion'],
    ['classifier-free guidance', 'classifier-free guidance'],
    ['one-step', 'one-step inference'],
    ['FID', 'FID evaluation'],
    ['ImageNet', 'ImageNet experiment setup'],
    ['robotic', 'robotic control experiment'],
    ['causal inference', 'causal inference'],
    ['causal', 'causal reasoning'],
    ['counterfactual', 'counterfactual reasoning'],
    ['confound', 'confounding'],
    ['intervention', 'intervention'],
    ['do-calculus', 'do-calculus'],
    ['structural causal model', 'structural causal model'],
    ['SCM', 'structural causal model'],
    ['DAG', 'directed acyclic graph'],
    ['potential outcome', 'potential outcomes'],
    ['OOD', 'out-of-distribution generalization'],
    ['out-of-distribution', 'out-of-distribution generalization'],
    ['transformer', 'Transformer sequence model'],
    ['attention', 'attention mechanism'],
    ['decision transformer', 'Decision Transformer'],
    ['imitation learning', 'imitation learning'],
    ['reinforcement learning', 'reinforcement learning'],
    ['foundation model', 'foundation model'],
    ['diffusion policy', 'diffusion policy'],
    ['ALOHA', 'ALOHA robotic imitation system']
  ];
  const lower = String(text || '').toLowerCase();
  return unique(concepts.filter(([needle]) => lower.includes(needle.toLowerCase())).map(([, label]) => label)).slice(0, 8);
}

function detectDefinitions(text) {
  return unique([...String(text || '').matchAll(/\b(?:Definition|Def\.|Assumption|Example|Exercise|Theorem|Lemma|Proposition)\s+([0-9.]+)?\s*([^\n.]{0,80})/gi)]
    .map((match) => `${match[0].replace(/\s+/g, ' ').trim()}`))
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
  if (/drifting models|method|generation|pushforward|field|implementation/.test(lowerTitle) || /Algorithm\s+\d+|training objective|pipeline|optimizer/i.test(body)) {
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
  if (/experiment|imagenet|toy|robot|fid|table|figure/i.test(lowerTitle) || /FID|ablation|Table\s+\d+|Figure\s+\d+/i.test(body)) {
    actions.push(`Visualize experimental evidence flow for ${title}`);
  }
  return unique(actions).slice(0, 4);
}

function equationLabel(number, body) {
  const local = String(body || '').slice(Math.max(0, String(body || '').indexOf(`(${number})`) - 800), String(body || '').indexOf(`(${number})`) + 800);
  if (number === '1') return `Explain Eq. (${number}) pushforward symbol by symbol`;
  if (number === '2') return `Explain Eq. (${number}) sample drifting update`;
  if (number === '3') return `Explain Eq. (${number}) anti-symmetry condition`;
  if (number === '4') return `Explain Eq. (${number}) equilibrium fixed point`;
  if (number === '5') return `Trace Eq. (${number}) training-time fixed-point iteration`;
  if (number === '6') return `Explain Eq. (${number}) training objective and stopgrad`;
  if (number === '7') return `Explain Eq. (${number}) drifting field expectation`;
  if (number === '8') return `Explain Eq. (${number}) attraction and repulsion fields`;
  if (number === '9') return `Explain Eq. (${number}) normalization factors`;
  if (number === '10') return `Explain Eq. (${number}) attraction minus repulsion`;
  if (/pushforward/i.test(local)) return `Explain Eq. (${number}) pushforward symbol by symbol`;
  if (/anti-symmetric/i.test(local)) return `Explain Eq. (${number}) anti-symmetry condition`;
  if (/fixed-point|equilibrium/i.test(local)) return `Explain Eq. (${number}) equilibrium fixed point`;
  if (/stopgrad|loss|objective/i.test(local)) return `Explain Eq. (${number}) training objective and stopgrad`;
  if (number === '2' || /xi\+1|drift/i.test(local)) return `Explain Eq. (${number}) sample drifting update`;
  return `Explain Eq. (${number}) symbol by symbol`;
}

function lectureNoteActionProfile(section, body) {
  const title = String(section || 'this lecture-note section');
  const equations = detectEquationNumbers(body);
  const concepts = detectConcepts(body);
  const definitions = detectDefinitions(body);
  const actions = [];
  actions.push(`Build the concept ladder for ${title}`);
  for (const concept of concepts.slice(0, 4)) actions.push(`Explain ${concept} from first principles`);
  for (const item of definitions.slice(0, 3)) actions.push(`Walk through ${item} and why it is needed`);
  for (const number of equations.slice(0, 5)) actions.push(equationLabel(number, body));
  if (/example|worked example/i.test(body)) actions.push(`Work through the example in ${title} step by step`);
  if (/exercise|problem/i.test(body)) actions.push(`Turn the exercise in ${title} into a guided solution path`);
  if (/proof|lemma|theorem|proposition/i.test(body)) actions.push(`Trace the proof logic in ${title}`);
  actions.push(...visualRepairActions(title, body));
  actions.push(`Run a readiness checkpoint for ${title}`);
  actions.push(`Ask anything about ${title}`);
  actions.push(`Chat about this section`);
  return unique(actions).slice(0, 12);
}

function slideDeckActionProfile(section, body) {
  const title = String(section || 'this slide');
  const equations = detectEquationNumbers(body);
  const concepts = detectConcepts(body);
  const citations = detectCitations(body);
  const actions = [];
  actions.push(`Explain ${title} as if the lecturer paused here`);
  actions.push(`Reconstruct the missing narration for ${title}`);
  for (const concept of concepts.slice(0, 4)) actions.push(`Explain slide concept: ${concept}`);
  for (const number of equations.slice(0, 4)) actions.push(equationLabel(number, body));
  if (/figure|diagram|architecture|pipeline|model|image|visual|robot|trajectory/i.test(body)) actions.push(`Explain every label/arrow/visual element on ${title}`);
  if (citations.length) actions.push(`Explain why ${citations[0]} appears on this slide`);
  actions.push(`Connect ${title} to the previous and next slide`);
  actions.push(...visualRepairActions(title, body));
  actions.push(`Ask anything about ${title}`);
  actions.push(`Chat about this slide`);
  return unique(actions).slice(0, 12);
}

function actionProfileForSection(section, body, sourceMode = 'paper') {
  const normalizedMode = normalizeSourceMode(sourceMode);
  if (normalizedMode === 'lecture-note') return lectureNoteActionProfile(section, body);
  if (normalizedMode === 'slide-deck') return slideDeckActionProfile(section, body);
  const title = String(section || '');
  const lowerTitle = title.toLowerCase();
  const equations = detectEquationNumbers(body);
  const citations = detectCitations(body);
  const concepts = detectConcepts(body);
  const actions = [];

  if (/introduction/.test(lowerTitle)) {
    actions.push('Explain the Introduction as a promise-and-mechanism story');
    for (const concept of concepts.slice(0, 4)) actions.push(`Unpack "${concept}" from the Introduction`);
    actions.push('Compare training-time drifting with inference-time diffusion');
    actions.push(...visualRepairActions(title, body));
  } else if (/related work/.test(lowerTitle)) {
    actions.push('Build a related-work map: what each family contributes and why PaperMentor cares');
    for (const family of ['Diffusion-/Flow-based Models', 'GANs', 'VAEs', 'Normalizing Flows', 'Moment Matching', 'Contrastive Learning']) {
      if (body.toLowerCase().includes(family.toLowerCase().replace('-/', '/').split(' ')[0].toLowerCase()) || body.includes(family.split(' ')[0])) {
        actions.push(`Explain the contrast with ${family}`);
      }
    }
    for (const citation of citations.slice(0, 4)) actions.push(`Follow citation: explain how ${citation} is used here`);
    actions.push(...visualRepairActions(title, body));
  } else if (/drifting models|method|generation|pushforward|field/.test(lowerTitle)) {
    actions.push('Give a compact method overview for this section');
    for (const number of equations.slice(0, 8)) actions.push(equationLabel(number, body));
    if (/Proposition\s+3\.1/i.test(body)) actions.push('Explain Proposition 3.1 and why anti-symmetry gives zero drift');
    if (/stopgrad|stop-gradient/i.test(body)) actions.push('Explain why stopgrad is used and what would break without it');
    actions.push('Build the dependency chain for the method section');
    actions.push(...visualRepairActions(title, body));
  } else if (/implementation/.test(lowerTitle)) {
    actions.push('Walk through the image-generation implementation step by step');
    if (/Algorithm\s+1/i.test(body)) actions.push('Explain Algorithm 1 as executable pseudocode');
    for (const concept of concepts.slice(0, 4)) actions.push(`Explain implementation detail: ${concept}`);
    actions.push('Connect implementation choices back to the drifting objective');
    actions.push(...visualRepairActions(title, body));
  } else if (/experiment|imageNet|toy|robot/i.test(lowerTitle)) {
    actions.push('Explain what the experiments are trying to prove');
    if (/FID/i.test(body)) actions.push('Explain FID and why it matters for these results');
    if (/ImageNet/i.test(body)) actions.push('Interpret the ImageNet results without hype');
    if (/robot/i.test(body)) actions.push('Explain the robotic-control experiment setup');
    actions.push(...visualRepairActions(title, body));
  } else if (/discussion|conclusion/.test(lowerTitle)) {
    actions.push('Extract the paper’s final insight from this section');
    actions.push('Identify limitations, assumptions, and open questions');
  }

  if (!actions.length) {
    for (const concept of concepts.slice(0, 4)) actions.push(`Explain "${concept}" in this section`);
    for (const number of equations.slice(0, 5)) actions.push(equationLabel(number, body));
    actions.push(...visualRepairActions(title, body));
    if (!actions.length) actions.push(`Explain the purpose of ${title}`);
  }

  actions.push(`Ask anything about ${title}`);
  actions.push(`Chat about this section`);
  return unique(actions).slice(0, 12);
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
    state.sectionActions[key] = actionProfileForSection(block.title, block.body, sourceMode);
    state.sectionInsights[key] = {
      equations,
      citations,
      concepts,
      preview: block.body.replace(/\s+/g, ' ').slice(0, 500)
    };
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
  if (args.mode || args['source-mode']) state.sourceMode = normalizeSourceMode(args.mode || args['source-mode'], state.sourceMode || 'paper');
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
  const actions = splitChoices(args.choices).length
    ? splitChoices(args.choices)
    : state.sectionActions?.[sectionKey(section)] || defaultSectionActions(section);
  state.currentSection = section;
  state.currentMode = '';
  state.detectedItems = [];
  state.currentLocation = section;
  state.currentFocus = `Section selected: ${section}`;
  state.nextChoices = actions;
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
  const insight = state.sectionInsights?.[sectionKey(state.currentSection || '')] || {};
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
  const observe = args.observe || args['what-to-observe'] || `Follow the arrows and check which object must be understood before the next one.`;
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
  const cardId = args.id || `${type}-${String(cards.cards.length + 1).padStart(3, '0')}`;
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
    createdAt: now()
  };
  cards.cards.push(card);
  const pathKey = inferPathKey(type, state);
  if (pathKey) setPathStatus(state, pathKey, args.status || 'done');
  const activePathItems = readingPathForMode(state.sourceMode || 'paper');
  const nextKey = args.next || activePathItems.find(([key]) => state.readingPath.find((item) => item.key === key)?.status === 'pending')?.[0];
  if (nextKey) setPathStatus(state, nextKey, 'current');
  state.currentLocation = card.location;
  state.currentFocus = card.title;
  state.nextChoices = card.choices.length ? card.choices : state.nextChoices;
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
  printConsole(state, cards);
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
<style>
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-300.woff2") format("woff2"); font-weight:300; font-style:normal; font-display:swap; }
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-400.woff2") format("woff2"); font-weight:400; font-style:normal; font-display:swap; }
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-500.woff2") format("woff2"); font-weight:500; font-style:normal; font-display:swap; }
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-700.woff2") format("woff2"); font-weight:700; font-style:normal; font-display:swap; }
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-900.woff2") format("woff2"); font-weight:900; font-style:normal; font-display:swap; }
@font-face { font-family:"Pretendard"; src:url("assets/fonts/pretendard/PretendardVariable.woff2") format("woff2-variations"); font-weight:45 920; font-style:normal; font-display:swap; }
:root {
  color-scheme: light;
  --field:#f3efe4;
  --paper:#fffef9;
  --ink:#191715;
  --muted:#726b60;
  --line:#d6ccba;
  --rule:#2a2723;
  --accent:#405f9f;
  --accent-soft:#eef2f8;
  --mono: "Anthropic Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --text: "Satoshi", "Pretendard", "Apple SD Gothic Neo", Inter, "Helvetica Neue", Arial, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body {
  margin:0;
  color:var(--ink);
  font-family:var(--text);
  background:
    linear-gradient(90deg, rgba(79,60,32,.035) 1px, transparent 1px),
    linear-gradient(180deg, rgba(79,60,32,.035) 1px, transparent 1px),
    radial-gradient(circle at 50% -10%, rgba(255,255,255,.7), transparent 34%),
    var(--field);
  background-size:28px 28px, 28px 28px, auto, auto;
}
.page {
  width:min(900px, calc(100% - 44px));
  margin:0 auto;
  padding:42px 0 84px;
}
.paper-title {
  max-width:820px;
  margin:0 auto 34px;
  padding:22px 24px 24px;
  text-align:center;
  background:rgba(255,254,249,.72);
  border-top:3px double var(--rule);
  border-bottom:1px solid var(--line);
}
.paper-title h1 {
  margin:0;
  color:var(--ink);
  font-family:var(--text);
  font-size:clamp(31px, 4.7vw, 50px);
  line-height:1.04;
  font-weight:760;
  letter-spacing:-.045em;
}
.paper-source {
  margin-top:10px;
  color:var(--muted);
  font-family:var(--mono);
  font-size:10px;
  letter-spacing:.04em;
  text-transform:uppercase;
  overflow-wrap:anywhere;
}
.blocks { display:grid; gap:30px; }
.block {
  position:relative;
  background:var(--paper);
  border:1px solid var(--line);
  border-radius:2px;
  padding:40px 56px 50px;
  box-shadow:0 16px 38px rgba(65,48,26,.075);
}
.block:after {
  content:'';
  position:absolute;
  inset:10px;
  border:1px solid rgba(214,204,186,.42);
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
  padding-bottom:13px;
  margin-bottom:23px;
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
  font-size:31px;
}
.location {
  margin-top:7px;
  color:var(--muted);
  font-family:var(--mono);
  font-size:10px;
  letter-spacing:.04em;
  text-transform:uppercase;
}

.paper-figure {
  position:relative;
  z-index:1;
  margin:18px auto 26px;
  max-width:760px;
  border:1px solid #d8cebd;
  background:#fbf7ef;
  padding:12px;
}
.paper-figure img {
  display:block;
  width:100%;
  height:auto;
  object-fit:contain;
}
.paper-figure figcaption {
  margin-top:10px;
  color:#3e3830;
  font-size:13.5px;
  line-height:1.55;
}
.paper-figure figcaption p { margin:6px 0; }
.paper-figure figcaption strong { color:var(--ink); font-weight:720; }

.user-question {
  position:relative;
  z-index:1;
  max-width:760px;
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
  position:relative;
  z-index:1;
  margin:18px 0 24px;
  padding:18px 20px;
  overflow-x:auto;
  border:1px solid #d8cebd;
  background:#f8f2e8;
  font-size:16px;
}
.body {
  position:relative;
  z-index:1;
  max-width:760px;
  margin:0 auto;
  color:#1d1d1d;
  font-size:16px;
  line-height:1.68;
}
.body h1 { font-size:28px; margin:26px 0 12px; }
.body h2 { font-size:24px; margin:26px 0 12px; }
.body h3 { font-size:20px; margin:22px 0 10px; }
.body h3.ladder-heading {
  margin:26px 0 12px;
  padding:14px 16px 12px;
  border:1px solid var(--line);
  border-left:4px solid var(--rule);
  background:linear-gradient(135deg, #fffdf7, #f4efe6);
  box-shadow:0 8px 18px rgba(65,48,26,.045);
}
.body h3.ladder-heading + p,
.body h3.ladder-heading + ul,
.body h3.ladder-heading + ol {
  margin-top:12px;
}
.body .ladder-meta {
  border:1px solid var(--line);
  background:#fffaf1;
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
  background:#fffbf3;
  font-size:14px;
}
.body th,
.body td {
  border:1px solid var(--line);
  padding:9px 10px;
  text-align:left;
  vertical-align:top;
}
.body th {
  background:#f0eadf;
  font-weight:740;
}
.body code {
  background:#f0eadf;
  border:1px solid #d4cab8;
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
  overflow-wrap:anywhere;
  line-height:1.72;
}
@media (max-width: 640px) {
  .page { width:min(100% - 24px, 900px); padding:24px 0 52px; }
  .paper-title { padding:18px 14px 20px; margin-bottom:22px; }
  .block { padding:30px 24px 34px; }
  .block:after { inset:7px; }
  .block-head { grid-template-columns:1fr; gap:10px; }
  .block-title { font-size:26px; }
  .body { font-size:15px; }
}
</style>
</head>
<body>
<main class="page">
  <header class="paper-title">
    <h1>${escapeHtml(state.title || 'Paper reading session')}</h1>
    ${state.source ? `<div class="paper-source">${escapeHtml(state.source)}</div>` : ''}
  </header>
  <section class="blocks">
    ${(cards.cards || []).map((card, index) => renderCardArticle(card, index)).join('\n') || '<article class="block empty">No paper blocks yet.</article>'}
  </section>
</main>
</body>
</html>`;
  writeFileSync(indexPath(slug), html);
}


function renderCardArticle(card, index) {
  const baseBody = htmlExplanationOnly(bodyWithoutFigureExplanation(card.body || ''));
  const figure = renderFigure(card.figure, figureExplanationMarkdown(card));
  const head = `<article id="${escapeHtml(card.id)}" class="block" data-index="${index + 1}"><header class="block-head"><div><h2 class="block-title">${escapeHtml(displayCardTitle(card))}</h2><div class="location">${escapeHtml(card.location)}</div></div></header>${renderUserQuestion(card)}${card.latex ? `<div class="latex">$$
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
  const caption = captionMarkdown ? `<figcaption>${markdownToHtml(captionMarkdown)}</figcaption>` : '';
  return `<figure class="paper-figure"><img src="${escapeHtml(figure.src)}" alt="${escapeHtml(figure.alt || 'Paper figure')}" loading="lazy" />${caption}</figure>`;
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
  return /^(one[-\s]?sentence\s+(paper\s+)?model|one[-\s]?sentence\s+summary|what\s+this\s+(paper|source|note|deck)\s+does|(paper|source|note|deck)\s+model|paper\s+in\s+one\s+sentence)$/.test(normalized)
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
  const what = facts['what it shows']
    || facts['why this is the representative figure']
    || facts['why this figure matters']
    || facts['무엇을 보여주는가']
    || facts['보여주는 것']
    || facts['왜 대표 그림인가']
    || facts['왜 이 그림이 중요한가']
    || '';
  const flow = facts['flow / sequence']
    || facts['flow or sequence']
    || facts['흐름 / 순서']
    || facts['흐름 또는 순서']
    || facts['읽는 법']
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
  if (what) parts.push(sentence(what));
  const reading = [
    flow && (korean ? `읽는 법: ${sentence(flow)}` : `Read it as ${sentence(flow).replace(/^./, (ch) => ch.toLowerCase())}`),
    observe && (korean ? `핵심 관찰: ${sentence(observe)}` : `The key observation is that ${sentence(observe).replace(/^the\s+/i, '')}`)
  ]
    .filter(Boolean)
    .join(' ');
  if (reading) parts.push(reading);
  if (supports) parts.push(korean ? `연결되는 내용: ${sentence(supports)}` : `This visual anchors ${sentence(supports).replace(/^the\s+/i, '')}`);
  if (parts.length) return parts.join('\n\n');
  if (section.trim()) return section.trim();
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
  if ((state.paperSections || []).length && !state.currentSection) {
    console.log(`\n${sourceModeLabel(state.sourceMode)} sections`);
    (state.paperSections || []).forEach((section, index) => console.log(`  ${index === 0 ? '◆' : '◇'} [${index + 1}] ${section}`));
  } else if (state.currentSection && !state.currentMode) {
    console.log(`\nSelected section: ${state.currentSection}`);
    console.log('\nSection actions');
    (state.nextChoices || []).forEach((choice, index) => console.log(`  ${index === 0 ? '◆' : '◇'} [${index + 1}] ${choice}`));
  } else {
    console.log('\nChoose next');
    (state.nextChoices || []).forEach((choice, index) => console.log(`  ${index === 0 ? '◆' : '◇'} [${index + 1}] ${choice}`));
  }
  console.log(`\nBlocks in HTML: ${(cards.cards || []).length} · Runner: node scripts/papermentor-session.mjs run --session ${state.slug} --index <n>`);
}

const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
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

function boxLine(content = '', width = 84, color = ansi.cyan) {
  return `${color}│${ansi.reset} ${padVisible(content, width - 4)} ${color}│${ansi.reset}`;
}

function currentMenuLabel(state) {
  if ((state.paperSections || []).length && !state.currentSection) return `${sourceModeLabel(state.sourceMode)} sections`;
  if (state.currentSection && !state.currentMode) return 'Section actions';
  return 'Choose next';
}

function currentMenuItems(state) {
  if ((state.paperSections || []).length && !state.currentSection) return state.paperSections || [];
  return state.nextChoices || [];
}

function renderTuiScreen(state, selected = 0) {
  const cards = readJson(cardsPath(state.slug), { cards: [] });
  const width = 90;
  const items = currentMenuItems(state);
  const label = currentMenuLabel(state);
  const focus = state.currentSection ? `${state.currentSection}${state.currentMode ? ` · ${state.currentMode}` : ''}` : `choose a ${sourceModeNoun(state.sourceMode)} section`;
  const top = `${ansi.magenta}╭${'─'.repeat(width - 2)}╮${ansi.reset}`;
  const bottom = `${ansi.magenta}╰${'─'.repeat(width - 2)}╯${ansi.reset}`;
  const rows = [
    top,
    boxLine(`${ansi.bold}${ansi.magenta}✦ PaperMentor Live${ansi.reset} ${ansi.dim}HTML-first ${sourceModeNoun(state.sourceMode)} navigator${ansi.reset}`, width, ansi.magenta),
    boxLine(`${ansi.dim}Claude-like start surface · arrow-key TUI · explanations render in HTML${ansi.reset}`, width, ansi.magenta),
    boxLine(`${ansi.bold}${trim(state.title, 72)}${ansi.reset}`, width, ansi.magenta),
    boxLine(`${ansi.dim}View:${ansi.reset} ${ansi.green}${state.renderedView}${ansi.reset}`, width, ansi.magenta),
    boxLine(`${ansi.dim}Focus:${ansi.reset} ${trim(focus, 72)}`, width, ansi.magenta),
    boxLine(`${ansi.dim}Blocks:${ansi.reset} ${cards.cards?.length || 0}  ${ansi.dim}Source mode:${ansi.reset} ${sourceModeLabel(state.sourceMode)}  ${state.pendingBlockPrompt ? `${ansi.dim}Prompt:${ansi.reset} ${state.pendingBlockPrompt}` : `${ansi.dim}Runner:${ansi.reset} choose action → prompt`}`, width, ansi.magenta),
    `${ansi.magenta}├${'─'.repeat(width - 2)}┤${ansi.reset}`,
    boxLine(`${ansi.bold}${label}${ansi.reset} ${ansi.dim}(↑/↓ select · Enter choose · / ask anything · q quit)${ansi.reset}`, width, ansi.magenta)
  ];
  const visibleItems = items.length ? items : ['No dynamic choices yet. Run analyze with source text or ask a question.'];
  visibleItems.slice(0, 14).forEach((item, index) => {
    const active = index === selected;
    const pointer = active ? `${ansi.inverse}${ansi.bold} ${String(index + 1).padStart(2, '0')} ${ansi.reset}` : `${ansi.dim} ${String(index + 1).padStart(2, '0')} ${ansi.reset}`;
    const prefix = active ? `${ansi.magenta}◆${ansi.reset}` : `${ansi.dim}◇${ansi.reset}`;
    const text = active ? `${ansi.bold}${item}${ansi.reset}` : item;
    rows.push(boxLine(`${prefix} ${pointer} ${trim(text, 70)}`, width, active ? ansi.magenta : ansi.cyan));
  });
  rows.push(`${ansi.magenta}├${'─'.repeat(width - 2)}┤${ansi.reset}`);
  rows.push(boxLine(`${ansi.amber}Ask/chat are first-class choices.${ansi.reset} Enter writes a pending HTML block prompt; the CLI stays navigation-only.`, width, ansi.magenta));
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

function actionType(action, state = {}) {
  const text = String(action || '').toLowerCase();
  const mode = normalizeSourceMode(state.sourceMode || 'paper');
  if (/concept ladder|prerequisite|from first principles|readiness/.test(text)) return mode === 'lecture-note' ? 'concept-ladder' : 'prerequisite';
  if (/eq\.|equation|symbol by symbol|notation/.test(text)) return 'equation';
  if (/derivation|trace|transition/.test(text)) return 'derivation';
  if (/dependenc|related-work|citation|contrast|connect/.test(text)) return mode === 'slide-deck' ? 'slide-transition' : 'dependency';
  if (/proof|lemma|theorem|proposition/.test(text)) return 'proof';
  if (/method|pipeline|algorithm|visual element|slide/.test(text)) return mode === 'slide-deck' ? 'slide-explanation' : 'method';
  if (/narration/.test(text)) return 'missing-narration';
  if (/confusion|diagnostic|ask anything|chat/.test(text)) return 'confusion';
  if (/final insight|one-sentence/.test(text)) return 'final-insight';
  if (/visualize|draw|diagram|graph|landscape/.test(text)) return 'visualization';
  return mode === 'slide-deck' ? 'slide-explanation' : mode === 'lecture-note' ? 'concept-ladder' : 'note';
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
    visualization: 'templates/visualization_card.md',
    'slide-explanation': 'templates/slide_explanation.md',
    'missing-narration': 'templates/missing_narration.md',
    'slide-transition': 'templates/slide_transition.md',
    'final-insight': 'templates/final_insight.md'
  };
  return templates[type] || 'templates/method_dissection.md';
}

function buildActionPrompt(state, action) {
  const type = actionType(action, state);
  const insight = state.sectionInsights?.[sectionKey(state.currentSection || '')] || {};
  const equations = insight.equations?.length ? insight.equations.map((n) => `Eq. (${n})`).join(', ') : 'none detected yet';
  const concepts = insight.concepts?.length ? insight.concepts.join(', ') : 'none detected yet';
  const citations = insight.citations?.length ? insight.citations.join(', ') : 'none detected yet';
  const command = `node scripts/papermentor-session.mjs card --session ${shellQuote(state.slug)} --type ${shellQuote(type)} --title ${shellQuote(action)} --body-file <your-markdown-file>`;
  return `# PaperMentor HTML Block Runner Prompt\n\nYou are generating the next PaperMentor HTML block. Do not answer only in the CLI. Create a concrete explanation block and append it with:\n\n\`${command}\`\n\n## Selected action\n\n${action}\n\n## Source context\n\n- Mode: ${sourceModeLabel(state.sourceMode)}\n- Title: ${state.title}\n- Section / slide: ${state.currentSection || state.currentLocation || 'not selected'}\n- Current focus: ${state.currentFocus || ''}\n- Template to follow: ${promptTemplateForType(type)}\n\n## Detected local signals\n\n- Equations: ${equations}\n- Concepts: ${concepts}\n- Citations: ${citations}\n- Preview: ${insight.preview || 'No extracted preview. Use the attached source/paper text available in context.'}\n\n## Output rules\n\n- Actual explanation belongs in HTML, not in the CLI.\n- Show every non-trivial equation in LaTeX before explaining it.\n- Explain symbols, assumptions, substitutions, cancellations, and dependencies explicitly.\n- If this action is a user question/chat, answer the question, identify the missing dependency, reconnect to the exact section, and resume.\n- If a representative paper/slide figure is needed, use extract-figure with an actual crop; never use Mermaid as a substitute.\n`;
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
    `${ansi.bold}${ansi.magenta}✦ PaperMentor runner${ansi.reset} ${ansi.dim}choice → block prompt${ansi.reset}`,
    `${ansi.dim}Action:${ansi.reset} ${trim(action, 62)}`,
    `${ansi.dim}Block type:${ansi.reset} ${state.pendingBlockType}  ${ansi.dim}Prompt:${ansi.reset} ${state.pendingBlockPrompt}`,
    `${ansi.dim}HTML:${ansi.reset} ${state.renderedView}`,
    `${ansi.amber}Next:${ansi.reset} use the pending prompt to write the block body, then append it with the card command.`
  ];
  return [
    `${ansi.magenta}╭${'─'.repeat(width - 2)}╮${ansi.reset}`,
    ...content.map((line) => boxLine(line, width, ansi.magenta)),
    `${ansi.magenta}╰${'─'.repeat(width - 2)}╯${ansi.reset}`
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

function applyTuiChoice(state, selected) {
  const items = currentMenuItems(state);
  const choice = items[selected];
  if (!choice) return state;
  if ((state.paperSections || []).length && !state.currentSection) {
    state.currentSection = choice;
    state.currentMode = '';
    state.detectedItems = [];
    state.currentLocation = choice;
    state.currentFocus = `Section selected: ${choice}`;
    state.selectedAction = '';
    state.lastChoiceKind = 'section';
    clearPendingPrompt(state);
    state.nextChoices = state.sectionActions?.[sectionKey(choice)] || defaultSectionActions(choice);
  } else {
    state.currentFocus = choice;
    state.selectedAction = choice;
    if (/equation|eq\./i.test(choice)) state.currentMode = 'equations';
    else if (/derivation|trace/i.test(choice)) state.currentMode = 'derivations';
    else if (/dependenc|citation|related-work|contrast/i.test(choice)) state.currentMode = 'dependencies';
    else if (/ask anything|chat about/i.test(choice)) state.currentMode = 'chat';
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
  let selected = Math.min(Number(args.cursor || 0), Math.max(0, currentMenuItems(state).length - 1));
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

  process.stdout.write(`${ansi.altScreen}${ansi.hideCursor}`);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  draw();
  const handleKey = (key) => {
    const items = currentMenuItems(state);
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
      state = applyTuiChoice(state, selected);
      selected = 0;
      draw();
    } else if (key === '/') {
      state.currentMode = 'chat';
      state.currentFocus = `Ask anything about ${state.currentSection || state.title}`;
      state.nextChoices = [`Ask anything about ${state.currentSection || state.title}`, `Chat about this section`, 'Return to section choices'];
      writeJson(statePath(state.slug), state);
      draw();
    }
  };
  process.stdin.on('data', (chunk) => {
    const keys = String(chunk).match(/\x1b\[[AB]|[\s\S]/g) || [];
    for (const key of keys) handleKey(key);
  });
}

function renderSession(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('render requires --session <slug>');
  if (!readJson(statePath(slug), null)) throw new Error(`session not found: ${slug}`);
  renderHtml(slug);
  console.log(`Rendered .papermentor/sessions/${slug}/index.html`);
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

function usage() {
  console.log(`PaperMentor session helper

Usage:
  node scripts/papermentor-session.mjs start --title <title> [--source <url>] [--mode paper|lecture-note|slide-deck|auto] [--slug <slug>] [--sections "1 Intro|2 Method"] [--body-file start.md] [--figure-file crop.png]
  node scripts/papermentor-session.mjs analyze --session <slug> --mode auto --paper-text-file source.txt
  node scripts/papermentor-session.mjs tui --session <slug>
  node scripts/papermentor-session.mjs run --session <slug> --index <n>
  node scripts/papermentor-session.mjs extract-figure --session <slug> --source paper.pdf --page 1 [--auto figure1|--crop x,y,w,h] [--title <title>]
  node scripts/papermentor-session.mjs sections --session <slug> --sections "1 Intro|2 Method"
  node scripts/papermentor-session.mjs section --session <slug> --index 2
  node scripts/papermentor-session.mjs mode --session <slug> --mode equations --items "Explain Eq. (1)|Explain Eq. (6)"
  node scripts/papermentor-session.mjs diagram --session <slug> [--kind method-pipeline] [--nodes "A|B|C"]
  node scripts/papermentor-session.mjs card --session <slug> --type equation --title <title> [--latex <tex>] [--user-question <text>] [--figure-file <path>] [--figure-caption <text>] [--body <text>|--body-file <path>] [--choices "A|B|C"]
  node scripts/papermentor-session.mjs turn --session <slug> --role user --text <text> [--promote|--no-promote]
  node scripts/papermentor-session.mjs promote --session <slug> --title <title> --user-question <text> --body-file <path>
  node scripts/papermentor-session.mjs pause --session <slug> --question <text> [--answer <text>] [--missing-dependency <text>]
  node scripts/papermentor-session.mjs resume --session <slug> [--repaired <text>]
  node scripts/papermentor-session.mjs render --session <slug>
  node scripts/papermentor-session.mjs state --session <slug>
  node scripts/papermentor-session.mjs status --session <slug>
`);
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
if (args.help || args.h || command === 'help' || command === '--help' || command === '-h') {
  usage();
  process.exit(0);
}
try {
  if (command === 'start') {
    const title = args.title || 'Paper reading session';
    const slug = args.slug || slugify(title);
    const source = args.source || '';
    const sections = splitChoices(args.sections || '');
    const modeHint = argsModeFromSource(`${source} ${title}`);
    const sourceMode = normalizeSourceMode(args.mode || args['source-mode'] || args.sourceMode || modeHint, modeHint);
    const { state, cards } = ensureSession({ title, source, slug, sections, sourceMode });
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
  } else if (command === 'state') {
    showState(args);
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
