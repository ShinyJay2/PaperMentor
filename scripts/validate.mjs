import { existsSync, readFileSync, statSync, mkdtempSync, rmSync, writeFileSync, readdirSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deflateRawSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import { execFile, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { loadManifest, packageFiles, repoRoot, runtimeInstallDestinations } from './manifest.mjs';

const root = repoRoot;
const manifest = loadManifest(root);
const required = packageFiles(root, manifest);

const failures = [];
const internalSnapshotEnv = { ...process.env, PAPERMENTOR_INTERNAL_SNAPSHOT: '1' };

function stripAnsi(value) {
  return String(value || '')
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}

function visibleLineCount(value) {
  return stripAnsi(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n$/, '').split('\n').length;
}

function writePdfFixture(path, stream) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  writeFileSync(path, pdf);
}

function writeTinyPdfFixture(path) {
  const stream = [
    'BT /F1 18 Tf 72 740 Td (Tiny Retrieval Method) Tj ET',
    'BT /F1 11 Tf 72 716 Td (Ada Researcher) Tj ET',
    'BT /F1 12 Tf 72 682 Td (Abstract) Tj ET',
    'BT /F1 12 Tf 72 664 Td (This paper builds a retrieval encoder with a margin objective and a calibration metric.) Tj ET',
    'BT /F1 12 Tf 72 632 Td (1. Introduction) Tj ET',
    'BT /F1 12 Tf 72 614 Td (The method maps queries to vectors and compares them with document vectors.) Tj ET',
    'BT /F1 12 Tf 72 582 Td (2. Method) Tj ET',
    'BT /F1 12 Tf 72 564 Td (The encoder h: tokens -> vectors and Equation 1 defines a margin objective.) Tj ET',
    '0.2 0.37 0.62 RG 2 w',
    '72 452 96 64 re S',
    '222 452 96 64 re S',
    '372 452 120 64 re S',
    '168 484 m 222 484 l S',
    '318 484 m 372 484 l S',
    '216 490 m 222 484 l 216 478 l S',
    '366 490 m 372 484 l 366 478 l S',
    'BT /F1 12 Tf 92 492 Td (query) Tj ET',
    'BT /F1 12 Tf 238 492 Td (encoder) Tj ET',
    'BT /F1 12 Tf 390 492 Td (ranking score) Tj ET',
    'BT /F1 12 Tf 72 420 Td (Figure 1. Representative method figure.) Tj ET',
    'BT /F1 12 Tf 72 372 Td (3. Evaluation) Tj ET',
    'BT /F1 12 Tf 72 354 Td (Accuracy and calibration error evaluate retrieval quality.) Tj ET'
  ].join('\n');
  writePdfFixture(path, stream);
}

function writeVectorOnlyFigurePdfFixture(path) {
  const stream = [
    'BT',
    '/F1 18 Tf 72 740 Td (Vector Geometry Figure Paper) Tj',
    '/F1 11 Tf 0 -24 Td (Ada Researcher) Tj',
    '/F1 12 Tf 0 -34 Td (Abstract) Tj',
    '0 -18 Td (This paper has a method figure drawn as PDF vector geometry without figure-internal text.) Tj',
    '0 -32 Td (1. Method) Tj',
    '0 -18 Td (The method is represented by boxes and arrows in the figure below.) Tj',
    'ET',
    '0.1 0.32 0.62 RG 2 w',
    '72 390 96 64 re S',
    '222 390 96 64 re S',
    '372 390 96 64 re S',
    '168 422 m 222 422 l S',
    '318 422 m 372 422 l S',
    '216 428 m 222 422 l 216 416 l S',
    '366 428 m 372 422 l 366 416 l S',
    'BT /F1 12 Tf 72 350 Td (Figure 1. Sparse vector architecture.) Tj ET',
    'BT /F1 12 Tf 72 302 Td (2. Evaluation) Tj ET'
  ].join('\n');
  writePdfFixture(path, stream);
}

function hasPyMuPDFDetector() {
  try {
    execFileSync('python3', ['-c', 'import fitz'], { stdio: 'ignore', timeout: 30000 });
    return true;
  } catch {
    return false;
  }
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeZipFixture(path, entries) {
  const fileParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime(new Date('2020-01-01T00:00:00Z'));
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/^\/+/, ''), 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const compressed = deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    fileParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralOffset = offset;
  const centralBuffer = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
  writeFileSync(path, Buffer.concat([...fileParts, centralBuffer, end]));
}

function writeTinyPptxFixture(path) {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
  const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>
</p:presentation>`;
  const presentationRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
</Relationships>`;
  const slide = (title, body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>${body}</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`;
  writeZipFixture(path, [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'ppt/presentation.xml', data: presentation },
    { name: 'ppt/_rels/presentation.xml.rels', data: presentationRels },
    { name: 'ppt/slides/slide1.xml', data: slide('Slide 1: Retrieval Encoder Pipeline', 'query encoder ranking score Figure 1. The slide shows how tokens become retrieval scores.') },
    { name: 'ppt/slides/slide2.xml', data: slide('Slide 2: Evaluation', 'Accuracy and calibration error test the retrieval model.') }
  ]);
}


function writeRepresentativeChoicePdfFixture(path) {
  const stream = [
    'BT /F1 18 Tf 72 740 Td (Representative Figure Choice) Tj ET',
    'BT /F1 12 Tf 72 704 Td (Abstract) Tj ET',
    'BT /F1 12 Tf 72 686 Td (This paper proposes a retrieval method with an encoder pipeline.) Tj ET',
    '0.6 0.2 0.2 RG 2 w',
    '72 610 110 44 re S',
    '214 610 110 44 re S',
    '356 610 110 44 re S',
    'BT /F1 10 Tf 92 628 Td (metric) Tj ET',
    'BT /F1 10 Tf 236 628 Td (bar) Tj ET',
    'BT /F1 10 Tf 382 628 Td (score) Tj ET',
    'BT /F1 12 Tf 72 580 Td (Figure 1. Linear Evaluation. Accuracy results on a benchmark.) Tj ET',
    'BT /F1 12 Tf 72 532 Td (1. Method) Tj ET',
    'BT /F1 12 Tf 72 514 Td (The objective trains the encoder to score relevant documents higher.) Tj ET',
    '0.2 0.37 0.62 RG 2 w',
    '72 390 96 64 re S',
    '222 390 96 64 re S',
    '372 390 120 64 re S',
    '168 422 m 222 422 l S',
    '318 422 m 372 422 l S',
    '216 428 m 222 422 l 216 416 l S',
    '366 428 m 372 422 l 366 416 l S',
    'BT /F1 10 Tf 92 410 Td (query) Tj ET',
    'BT /F1 10 Tf 238 410 Td (encoder) Tj ET',
    'BT /F1 10 Tf 392 410 Td (ranking) Tj ET',
    'BT /F1 12 Tf 72 350 Td (Figure 2. Overall method pipeline. The encoder maps queries to vectors and ranks documents.) Tj ET'
  ].join('\n');
  writePdfFixture(path, stream);
}

function writeNoFigurePdfFixture(path) {
  const stream = [
    'BT',
    '/F1 18 Tf 72 740 Td (No Figure Paper) Tj',
    '/F1 12 Tf 0 -36 Td (Abstract) Tj',
    '0 -18 Td (This paper explains a retrieval method entirely in prose.) Tj',
    '0 -36 Td (1. Introduction) Tj',
    '0 -18 Td (There is no figure caption on this page.) Tj',
    '0 -36 Td (2. Method) Tj',
    '0 -18 Td (The method maps queries to vectors and compares scores.) Tj',
    'ET',
    '0.2 0.37 0.62 RG 72 520 360 52 re S'
  ].join('\n');
  writePdfFixture(path, stream);
}

function writeCaptionOnlyFigurePdfFixture(path) {
  const stream = [
    'BT',
    '/F1 18 Tf 72 740 Td (Caption Only Figure Paper) Tj',
    '/F1 12 Tf 0 -36 Td (Abstract) Tj',
    '0 -18 Td (This paper has a Figure caption but the figure geometry is unavailable.) Tj',
    '0 -36 Td (1. Method) Tj',
    '0 -18 Td (The method maps queries into vectors and compares scores.) Tj',
    '0 -36 Td (Figure 1. Intended method pipeline, but no PDF drawing or image object is present.) Tj',
    '0 -36 Td (2. Evaluation) Tj',
    '0 -18 Td (Accuracy checks whether the scoring pipeline works.) Tj',
    'ET'
  ].join('\n');
  writePdfFixture(path, stream);
}


function writeResultOnlyPdfFixture(path) {
  const stream = [
    'BT',
    '/F1 18 Tf 72 740 Td (Result Only Figure Paper) Tj',
    '/F1 12 Tf 0 -36 Td (Abstract) Tj',
    '0 -18 Td (This paper analyzes a kernel but does not include a method diagram.) Tj',
    '0 -36 Td (1. Introduction) Tj',
    '0 -18 Td (The theory is proved with equations rather than an architecture figure.) Tj',
    '0 -36 Td (Figure 1. Test accuracy results on benchmark tasks.) Tj',
    '0 -32 Td (Figure 2. Ablation comparison for different learning rates.) Tj',
    'ET',
    '0.6 0.2 0.2 RG 72 560 300 42 re S',
    '0.6 0.2 0.2 RG 72 500 300 42 re S'
  ].join('\n');
  writePdfFixture(path, stream);
}

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return fallback; }
}

function markdownSection(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  const next = start === -1 ? -1 : markdown.indexOf('\n## ', start + 4);
  return start === -1 ? '' : markdown.slice(start, next === -1 ? undefined : next).trim();
}

function markdownPlainText(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' math ')
    .replace(/\$[^$\n]+\$/g, ' math ')
    .replace(/[#>*_`|[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

for (const rel of required) {
  const p = join(root, rel);
  if (!existsSync(p)) failures.push(`missing ${rel}`);
  else if (statSync(p).isFile() && readFileSync(p, 'utf8').trim().length < 40) failures.push(`too little content ${rel}`);
}

function parseFrontmatter(rel) {
  const text = readFileSync(join(root, rel), 'utf8');
  if (!text.startsWith('---\n')) {
    failures.push(`${rel} missing YAML frontmatter`);
    return {};
  }
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) {
    failures.push(`${rel} missing closing YAML frontmatter fence`);
    return {};
  }
  const block = text.slice(4, end).trim().split('\n');
  const parsed = {};
  for (const line of block) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (!match) failures.push(`${rel} invalid frontmatter line: ${line}`);
    else parsed[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  const keys = Object.keys(parsed).sort().join(',');
  if (keys !== 'description,name') failures.push(`${rel} frontmatter must contain only description,name; got ${keys}`);
  if (parsed.name !== 'papermentor') failures.push(`${rel} name must be papermentor`);
  if (!parsed.description || parsed.description.length < 80) failures.push(`${rel} description too short for reliable triggering`);
  return parsed;
}

for (const rel of ['SKILL.md', 'skills/papermentor/SKILL.md']) parseFrontmatter(rel);

const readme = readFileSync(join(root, 'README.md'), 'utf8');
for (const phrase of ['Do not summarize papers. Debug understanding.', 'Claude Code', 'assets/papermentor-demo.svg', 'HTML-first reading room', 'Start in one command', 'preview-crops', 'Try the sample paper', 'Trace a derivation', 'Map a dependency chain', 'Plan a visualization', 'Product boundaries']) {
  if (!readme.includes(phrase)) failures.push(`README missing phrase: ${phrase}`);
}

const sessionScript = readFileSync(join(root, 'scripts/papermentor-session.mjs'), 'utf8');
for (const phrase of ['Satoshi-400.woff2', 'PretendardVariable.woff2', '@font-face', 'copyBundledReportAssets', 'paper-figure', 'assets/mathjax/tex-svg.js', 'extractFigure', 'previewCrops', 'launchSession', 'inferMetadataFromText', 'pendingBlockPrompt', 'pdftoppm']) {
  if (!sessionScript.includes(phrase)) failures.push(`session renderer missing phrase: ${phrase}`);
}
for (const phrase of ['api.fontshare.com', 'orioncactus/pretendard/dist/web/static/pretendard.css', 'cdn.jsdelivr.net/npm/mathjax']) {
  if (sessionScript.includes(phrase)) failures.push(`session renderer should not rely on remote font CSS: ${phrase}`);
}

for (const phrase of ['auto crop could not locate Figure', 'boundedInteger', 'uniqueOutputPath', 'clearPendingPrompt', 'shellQuote', 'googleDriveDirectUrl', 'uc?export=download', 'docs.google.com/presentation', 'assertSafeRemoteUrl', 'safeMarkdownHref', 'readFileProbe', 'allow-insecure-http', '--skip-git-repo-check']) {
  if (!sessionScript.includes(phrase)) failures.push(`session helper missing hardened flow phrase: ${phrase}`);
}
for (const phrase of ['renderWelcomeScreen', 'learningQuote', 'renderPaletteScreen', 'pm <file-or-url>', 'pm open', 'pm ask "question"', 'pm qa']) {
  if (!sessionScript.includes(phrase)) failures.push(`session helper missing simplified main-menu phrase: ${phrase}`);
}
if (/mode\s*===\s*['"]paper['"][\s\S]{0,240}I-JEPA|I-JEPA[\s\S]{0,240}return\s*\[\s*['"`]## Preliminary ladder/.test(sessionScript)) {
  failures.push('session helper must not use a paper-specific I-JEPA preliminary ladder branch');
}
for (const phrase of ['Concept / method role', 'How to read it', 'Parts to identify', 'In-figure math / symbols', 'Equations / claims it supports']) {
  if (!sessionScript.includes(phrase)) failures.push(`session helper missing fixed figure explanation schema phrase: ${phrase}`);
}
for (const phrase of ['follow the visual objects and arrows before reading', 'First name each box/object, then read arrows in order', 'then follow the flow / sequence item in order']) {
  if (sessionScript.includes(phrase)) failures.push(`session helper still ships generic "move your eyes" figure meta-advice instead of a concrete reading: ${phrase}`);
}
if (!sessionScript.includes('Transcribe in LaTeX every equation')) failures.push('session helper figure scaffold should force in-figure math transcription, not generic advice');

// Source-derived explanations (figure reading, one-sentence model, preliminary ladder)
// must be authored by the model/prompt, never synthesised from text by the script.
for (const phrase of ['preliminaryLadderFromText', 'prerequisiteConceptSpecs', 'modePrimitiveLayer', 'detectNotationCandidates', 'abstractSnippet']) {
  if (sessionScript.includes(phrase)) failures.push(`session helper should not synthesise source-derived Start Here content: ${phrase}`);
}
if (!sessionScript.includes('preliminaryLadderScaffold') || !sessionScript.includes('Not built yet')) failures.push('session helper should ship a preliminary-ladder scaffold for the model to fill, not a synthesised ladder');


const mathjaxReadme = readFileSync(join(root, 'assets/mathjax/README.md'), 'utf8');
for (const phrase of ['MathJax v3.2.2', 'Apache License 2.0', 'SHA-256', 'LICENSE.txt']) {
  if (!mathjaxReadme.includes(phrase)) failures.push(`MathJax vendor README missing phrase: ${phrase}`);
}

const prerequisitePrompt = readFileSync(join(root, 'prompts/prerequisite-analyzer.md'), 'utf8');
for (const phrase of ['concrete example', 'one-sentence reconstruction', 'bit', 'binary string', 'unbiased estimator']) {
  if (!prerequisitePrompt.toLowerCase().includes(phrase.toLowerCase())) failures.push(`prerequisite analyzer missing depth phrase: ${phrase}`);
}

const sectionNavPrompt = readFileSync(join(root, 'prompts/section-navigator.md'), 'utf8');
for (const phrase of ['weak position prior', '--choices', 'word-matching', 'Ask anything about']) {
  if (!sectionNavPrompt.toLowerCase().includes(phrase.toLowerCase())) failures.push(`section navigator prompt missing phrase: ${phrase}`);
}

const slideNavPrompt = readFileSync(join(root, 'prompts/slide-navigator.md'), 'utf8');
for (const phrase of ['slide image', 'temporal', 'narration', 'build slides', '--choices']) {
  if (!slideNavPrompt.toLowerCase().includes(phrase.toLowerCase())) failures.push(`slide navigator prompt missing phrase: ${phrase}`);
}

const turboExample = readFileSync(join(root, 'examples/turboquant_prerequisite_ladder_example.md'), 'utf8');
for (const phrase of ['bit', 'binary string', '$\\mathbb{R}^d$', '$\\{0,1\\}^B$', '$Q^{-1}', '$\\mathbb{E}_Q', 'unbiased', 'One-sentence reconstruction']) {
  if (!turboExample.includes(phrase)) failures.push(`TurboQuant ladder example missing phrase: ${phrase}`);
}

const publicDocs = ['README.md', 'SKILL.md', 'skills/papermentor/SKILL.md', 'templates/prerequisite_ladder.md', 'templates/concept_ladder.md', 'templates/start_here.md']
  .map((rel) => readFileSync(join(root, rel), 'utf8'))
  .join('\n');
for (const phrase of ['primitive vocabulary', 'concrete example', 'diagnostic check']) {
  if (!publicDocs.toLowerCase().includes(phrase)) failures.push(`public ladder docs missing phrase: ${phrase}`);
}

for (const phrase of ['term-purpose', 'functional role']) {
  if (!publicDocs.toLowerCase().includes(phrase)) failures.push(`public math-term docs missing phrase: ${phrase}`);
}

const skill = readFileSync(join(root, 'skills/papermentor/SKILL.md'), 'utf8');
for (const phrase of ['LaTeX', 'derivation', 'dependency', 'recursive why', 'Korean', 'visualization', 'conceptual diagram', 'mono-tone SVG', 'Reading Path', 'index.html', 'Satoshi', 'Pretendard', 'Report structure', 'HTML-first']) {
  if (!skill.toLowerCase().includes(phrase.toLowerCase())) failures.push(`skill missing policy phrase: ${phrase}`);
}

for (const rel of ['SKILL.md', 'README.md', 'skills/papermentor/commands.md', 'prompts/visualization-planner.md', 'templates/visualization_card.md']) {
  const text = readFileSync(join(root, rel), 'utf8').toLowerCase();
  for (const phrase of ['question', 'concept', 'visual encoding', 'what to observe', 'conclusion', 'limitation']) {
    if (!text.includes(phrase)) failures.push(`${rel} missing visualization contract phrase: ${phrase}`);
  }
}

for (const rel of ['SKILL.md', 'skills/papermentor/SKILL.md', 'skills/papermentor/commands.md', 'prompts/paper-scanner.md', 'templates/paper_map.md']) {
  const text = readFileSync(join(root, rel), 'utf8').toLowerCase();
  for (const phrase of ['exact', 'crop', 'figure', 'method', 'algorithm', 'what to observe', 'mermaid']) {
    if (!text.includes(phrase)) failures.push(`${rel} missing figure explanation phrase: ${phrase}`);
  }
  for (const phrase of ['concept / method role', 'how to read it', 'parts to identify', 'in-figure math / symbols', 'equations / claims it supports']) {
    if (!text.includes(phrase)) failures.push(`${rel} missing fixed figure schema phrase: ${phrase}`);
  }
}

const commandCoverage = [
  ['scan', 'templates/paper_map.md', 'prompts/paper-scanner.md'],
  ['prerequisites', 'templates/prerequisite_ladder.md', 'prompts/prerequisite-analyzer.md'],
  ['equation', 'templates/equation_card.md', 'prompts/equation-analyzer.md'],
  ['derive', 'templates/derivation_trace.md', 'prompts/derivation-tracer.md'],
  ['dependencies', 'templates/dependency_trace.md', 'prompts/dependency-tracer.md'],
  ['proof', 'templates/proof_walkthrough.md', 'prompts/proof-analyzer.md'],
  ['method', 'templates/method_dissection.md', 'prompts/method-analyzer.md'],
  ['confusion', 'templates/confusion_response.md', 'prompts/confusion-resolver.md'],
  ['why', 'templates/recursive_why.md', 'prompts/confusion-resolver.md'],
  ['final-insight', 'templates/final_insight.md', 'prompts/final-insight-extractor.md'],
  ['visualize', 'templates/visualization_card.md', 'prompts/visualization-planner.md'],
  ['diagram', 'templates/conceptual_diagram.md', 'prompts/visualization-planner.md']
];
const commandsText = readFileSync(join(root, 'skills/papermentor/commands.md'), 'utf8');
for (const [command, template, prompt] of commandCoverage) {
  if (!commandsText.includes(`/papermentor ${command}`)) failures.push(`commands.md missing /papermentor ${command}`);
  if (!existsSync(join(root, template))) failures.push(`missing template for ${command}: ${template}`);
  if (!existsSync(join(root, prompt))) failures.push(`missing prompt for ${command}: ${prompt}`);
}

for (const command of ['launch', 'start', 'analyze', 'tui', 'sections', 'section', 'mode', 'choose', 'run', 'diagram', 'preview-crops', 'extract-figure', 'qa', 'qa-batch', 'figure-audit', 'proof-audit', 'render', 'state', 'pause', 'resume', 'turn', 'promote', 'doctor']) {
  if (!commandsText.includes(`/papermentor ${command}`)) failures.push(`commands.md missing /papermentor ${command}`);
}

const packageJson = readJson(join(root, 'package.json'), {});
if (packageJson.bin?.papermentor !== 'scripts/papermentor-session.mjs') failures.push('package.json should expose a papermentor CLI bin');
if (packageJson.bin?.pm !== 'scripts/papermentor-session.mjs') failures.push('package.json should expose a pm main-menu CLI bin');
if (!packageJson.scripts?.launch?.includes('papermentor-session.mjs launch')) failures.push('package.json should expose npm run launch');
const npmIgnore = readFileSync(join(root, '.npmignore'), 'utf8');
for (const phrase of ['.papermentor/', '*.pdf', '*.ppt', '*.pptx', 'papermentor-skill-*.tgz']) {
  if (!npmIgnore.includes(phrase)) failures.push(`.npmignore should exclude local source/package artifact: ${phrase}`);
}

for (const rel of ['docs/ci/github-actions-ci.yml']) {
  const ci = readFileSync(join(root, rel), 'utf8');
  for (const phrase of ['poppler-utils', 'imagemagick', 'npm test', 'npm run pack:check']) {
    if (!ci.includes(phrase)) failures.push(`${rel} missing phrase: ${phrase}`);
  }
}

const golden = readFileSync(join(root, 'examples/golden_quality_contracts.md'), 'utf8');
for (const phrase of ['Golden equation card', 'Golden derivation trace', 'Golden dependency trace', 'Golden confusion repair', 'Golden Korean explanation', 'Symbol table', 'Backward dependencies', 'Missing dependency', 'Reconnection to original text']) {
  if (!golden.includes(phrase)) failures.push(`golden quality contracts missing phrase: ${phrase}`);
}
const goldenContracts = {
  'Golden equation card': ['### Equation', '### Role', '### Symbol table', '### Reconstruction checkpoint', '| Symbol | Meaning | Domain / codomain | Notes |'],
  'Golden derivation trace': ['### Previous equation', '### Next equation', '**What changed:**', '**Operation applied:**', '**Property / theorem / definition used:**', '**Assumption invoked:**', '**Why valid:**'],
  'Golden dependency trace': ['### Backward dependencies', '### Forward dependencies', '### Missing dependency check', '### Recommended explanation order'],
  'Golden confusion repair': ['User question:', 'Paused location:', '### Direct answer', '### Missing dependency', '### Minimal example', '### Reconnection to original text', '### Resume point'],
  'Golden Korean explanation': ['사용자가 한국어로 질문하면', '$\\mathbb{E}$', '원래 논문 위치']
};
for (const [heading, requiredPhrases] of Object.entries(goldenContracts)) {
  const section = markdownSection(golden, heading);
  for (const phrase of requiredPhrases) {
    if (!section.includes(phrase)) failures.push(`${heading} contract missing structural phrase: ${phrase}`);
  }
}

for (const forbidden of ['Compare training-time drifting with inference-time diffusion', 'Explain Proposition 3.1 and why anti-symmetry gives zero drift', 'Connect implementation choices back to the drifting objective']) {
  if (sessionScript.includes(forbidden)) failures.push(`session helper retains paper-specific hardcoded action: ${forbidden}`);
}

function expectedInstalledResources() {
  return runtimeInstallDestinations(root, manifest);
}

function assertInstalledArtifact(dest, label) {
  const installedRequired = expectedInstalledResources();
  for (const rel of installedRequired) {
    if (!existsSync(join(dest, rel))) failures.push(`${label} installed artifact missing ${rel}`);
  }
  for (const rel of ['scripts/validate.mjs', 'assets/papermentor-demo.svg', 'assets/papermentor-hero.svg', 'assets/social-preview.svg', 'assets/social-preview.png']) {
    if (existsSync(join(dest, rel))) failures.push(`${label} installed artifact should exclude non-runtime file ${rel}`);
  }
}

function validateInstalledArtifact() {
  const temp = mkdtempSync(join(tmpdir(), 'papermentor-validate-'));
  try {
    const codexHome = join(temp, '.codex');
    const binDir = join(temp, 'bin');
    execFileSync(join(root, 'install.sh'), ['codex'], { cwd: root, env: { ...process.env, CODEX_HOME: codexHome, PAPERMENTOR_BIN_DIR: binDir }, stdio: 'pipe' });
    assertInstalledArtifact(join(codexHome, 'skills', 'papermentor'), 'codex');
    const installedHelp = execFileSync('papermentor', ['--help'], { cwd: temp, env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` }, encoding: 'utf8' });
    if (!installedHelp.includes('pm <file-or-url>') || !installedHelp.includes('papermentor launch <file-or-url>') || installedHelp.includes('node scripts/papermentor-session.mjs')) failures.push('installed CLI help should use papermentor/pm commands, not development node script paths');
    const installedPalette = execFileSync('pm', ['--help'], { cwd: temp, env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` }, encoding: 'utf8' });
    if (!installedPalette.includes('pm open') || !installedPalette.includes('pm ask')) failures.push('installed pm shortcut should expose simplified main-menu commands');
    const installedDoctor = execFileSync('papermentor', ['doctor', '--json'], { cwd: temp, env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` }, encoding: 'utf8' });
    if (!installedDoctor.includes('"status": "ok"') || installedDoctor.includes('python3-pptx') || installedDoctor.includes('LibreOffice')) failures.push('installed papermentor doctor should run through the installed CLI shim without PPTX renderer dependencies');

    const claudeHome = join(temp, '.claude');
    execFileSync(join(root, 'install.sh'), ['claude'], { cwd: root, env: { ...process.env, CLAUDE_HOME: claudeHome, PAPERMENTOR_BIN_DIR: binDir }, stdio: 'pipe' });
    assertInstalledArtifact(join(claudeHome, 'skills', 'papermentor'), 'claude');
  } catch (error) {
    failures.push(`install smoke failed: ${error.message}`);
  } finally {
    if (process.env.PAPERMENTOR_KEEP_VALIDATE_TEMP) console.warn(`[keep] validate temp: ${temp}`);
    else rmSync(temp, { recursive: true, force: true });
  }
}

function execFileAsync(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

async function withTextServer(file, fn) {
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'text/plain');
    res.end(readFileSync(file));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const { port } = server.address();
    return await fn(port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function validateSessionHelper() {
  const temp = mkdtempSync(join(tmpdir(), 'papermentor-session-'));
  try {
    const helpOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--help'], { cwd: temp, encoding: 'utf8' });
    if (!helpOutput.includes('pm <file-or-url>') || !helpOutput.includes('papermentor launch <file-or-url>')) failures.push('start --help should print simplified help plus advanced pointer');
    if (existsSync(join(temp, '.papermentor'))) failures.push('start --help should not create a session directory');
    const welcomeOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), '--snapshot'], { cwd: temp, encoding: 'utf8', env: internalSnapshotEnv });
    if (!welcomeOutput.includes('PaperMentor') || !welcomeOutput.includes('Drop Source') || !welcomeOutput.includes('Reading Room') || !welcomeOutput.includes('drop file/url or type a question')) failures.push('pm --snapshot should render the minimal PaperMentor chat launcher');
    if (welcomeOutput.includes('Recent:') || welcomeOutput.includes('Keys:') || welcomeOutput.includes('Start here')) failures.push('pm --snapshot should keep the launcher minimal without recent/key/start blocks');
    const paletteOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'menu', '--snapshot'], { cwd: temp, encoding: 'utf8', env: internalSnapshotEnv });
    if (!paletteOutput.includes('✦ PaperMentor') || !paletteOutput.includes('Main menu') || !paletteOutput.includes('New reading room from file / URL')) failures.push('menu --snapshot should render the simplified main menu');
    if (paletteOutput.includes('Keys:') || paletteOutput.includes('Status') || paletteOutput.includes('Quality:')) failures.push('menu --snapshot should not show shortcut keys or status panels');
    const terminalMockFile = join(temp, 'terminal-reroute.jsonl');
    const nonTtyOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'menu'], { cwd: temp, encoding: 'utf8', env: { ...process.env, PAPERMENTOR_TERMINAL_MOCK_FILE: terminalMockFile } });
    const nonTtyTerminal = readFileSync(terminalMockFile, 'utf8');
    if (!nonTtyOutput.includes('Opening PaperMentor in an external terminal')) failures.push('non-TTY menu should announce external terminal reroute');
    if (!nonTtyTerminal.includes('"argv":["menu"]') || nonTtyTerminal.includes('renderPaletteScreen') || nonTtyOutput.includes('Main menu')) failures.push('non-TTY menu should not render an inline PaperMentor UI fallback');
    const doctorOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'doctor'], { cwd: temp, encoding: 'utf8' });
    for (const phrase of ['PaperMentor dependency doctor', 'Status:', 'Core:', 'PDF text:', 'PDF render:', 'Visual:', 'Export:', 'AI generation provider', 'pdftotext', 'pdftoppm', 'PyMuPDF', 'pdfinfo', 'ImageMagick']) {
      if (!doctorOutput.includes(phrase)) failures.push(`doctor command should report local extraction dependency: ${phrase}`);
    }
    const doctorJson = JSON.parse(execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'doctor', '--json'], { cwd: temp, encoding: 'utf8' }));
    if (doctorJson.schema !== 'papermentor.doctor.v2' || !['ok', 'needs-fix', 'usable-with-optional-gaps'].includes(doctorJson.status) || doctorJson.checks?.length < 7 || !doctorJson.checks?.some((row) => /AI generation provider/.test(row.name)) || !doctorJson.checks?.some((row) => row.name === 'PyMuPDF') || !doctorJson.checks?.some((row) => row.name === 'pdfinfo')) failures.push('doctor --json should report capability-tier provider/PDF/image checks');
    const doctorFix = JSON.parse(execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'doctor', '--fix', 'poppler', '--dry-run', '--json'], { cwd: temp, encoding: 'utf8' }));
    if (doctorFix.schema !== 'papermentor.doctor.fix.v1' || !doctorFix.targets?.includes('poppler') || !doctorFix.commands?.length) failures.push('doctor --fix poppler --dry-run --json should emit an install plan without executing it');
    const smokeJson = JSON.parse(execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'smoke', '--json'], { cwd: temp, encoding: 'utf8', env: { ...process.env, PAPERMENTOR_TERMINAL_MOCK_FILE: join(temp, 'smoke-terminal.jsonl') } }));
    if (smokeJson.schema !== 'papermentor.smoke.v1' || smokeJson.status !== 'pass' || !existsSync(smokeJson.html) || !smokeJson.checks?.some((row) => row.id === 'section-detection' && row.ok)) failures.push('pm smoke --json should create a sample HTML reading room and verify section detection');
    try {
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Bad Slug', '--slug', '../evil'], { cwd: temp, stdio: 'pipe' });
      failures.push('start should reject path-traversal session slugs');
    } catch {
      // expected
    }
    const figurePath = join(temp, 'exact-pdf-crop-fixture.svg');
    const mapPath = join(temp, 'map.md');
    const equationPath = join(temp, 'equation.md');
    const paperTextPath = join(temp, 'paper.txt');
    // This is a test fixture for attachment/copy/render behavior only. Product guidance rejects
    // Mermaid/redrawn schematics for real papers; real sessions must pass an actual PDF crop.
    writeFileSync(figurePath, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 280"><rect width="720" height="280" fill="#fbfaf6"/><rect x="26" y="24" width="668" height="210" rx="2" fill="#fff" stroke="#d8d0c3"/><text x="50" y="58" font-family="Times New Roman, serif" font-size="18" fill="#1f2937">Exact PDF crop fixture — replace with actual paper figure in real sessions</text><path d="M68 190 C150 88, 260 92, 338 170 S520 226, 626 112" fill="none" stroke="#222" stroke-width="2.5"/><circle cx="68" cy="190" r="4" fill="#222"/><circle cx="338" cy="170" r="4" fill="#222"/><circle cx="626" cy="112" r="4" fill="#222"/><line x1="68" y1="216" x2="626" y2="216" stroke="#222"/><line x1="68" y1="86" x2="68" y2="216" stroke="#222"/><text x="330" y="254" font-family="Times New Roman, serif" font-size="14" fill="#374151">Figure 1: fixture crop region</text></svg>');
    writeFileSync(mapPath, '## One-sentence paper model\n\nThe paper trains a generator by moving samples with a drifting field.\n\n## Figure explanation under image\n\n- Figure / location: Figure 1.\n- Why this is the representative figure: it shows the training-time generator-to-drift-target loop rather than experiment results.\n- What it shows: the generator, generated samples, real samples, and the drift field.\n- Components: prior samples, generator, generated distribution, target distribution.\n- How to read it: three boxes — prior samples on the left, the generator $f$ in the middle, the data target on the right.\n- In-figure math / symbols: the pushforward $q=f_{\\#}p_{\\epsilon}$ labels the generator output and the drift field $V_{p,q}(x)$ labels the arrows.\n- Flow or sequence: sample, generate, drift, train.\n- What to observe: the field points generated samples toward data structure.\n- Equations or claims it supports: Eq. (6).\n\n## Preliminary ladder\n\n| Prerequisite | Minimal explanation | Used in |\n| --- | --- | --- |\n| Pushforward | $q=f_{\\#}p_{\\epsilon}$ is the generated distribution. | Eq. (1) |\n| Drift field | $V_{p,q}(x)$ moves samples during training. | Eq. (2) |\n\n## CLI-only likely confusion points\n\n- This should stay in CLI/state, not rendered HTML.\n');
    writeFileSync(equationPath, '- **Symbol:** $V_{p,q}$ is the drifting field.\n- **Checkpoint:** explain the update target.\n\n## Likely blockers\n\n- This should also stay in CLI/state, not rendered HTML.\n');
    writeFileSync(paperTextPath, '1. Introduction\nGenerative modeling learns a mapping f such that the pushforward distribution matches the data distribution. The paper proposes Drifting Models, a training-time drifting field, one-step inference, and a contrast with diffusion/flow models.\n\n2. Related Work\nDiffusion-/Flow-based Models. Sohl-Dickstein et al., 2015 and Lipman et al., 2022 formulate iterative mappings. Generative Adversarial Networks. Goodfellow et al., 2014 train a generator adversarially. Variational Autoencoders. Kingma & Welling, 2013 optimize ELBO.\n\n3. Drifting Models for Generation\nWe denote the pushforward distribution as q = f# p epsilon. (1) A sample drifts as xi+1 = xi + Vp,q(xi). (2) Proposition 3.1 uses an anti-symmetric drifting field. The training objective uses stopgrad. (6)\n');
    const launchTextPath = join(temp, 'launch-source.txt');
    writeFileSync(launchTextPath, `TurboQuant: Extreme Quantization for Vector Search
Jane Researcher John Vector

Abstract
This paper designs a quantization map Q from real-valued vectors into binary strings while preserving mean-squared error and inner-product estimates.

1. Introduction
Vector search systems need compact representations.

2. Problem Definition
The quantizer Q maps x in R^d to B bits. Equation (1) defines MSE and Equation (2) defines inner-product distortion.

3. Method
The method uses randomized quantization and unbiased inner-product estimates.`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', launchTextPath, '--slug', 'launch-smoke', '--no-figure', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const legacyScaffoldPath = join(temp, 'legacy-scaffold.md');
    writeFileSync(legacyScaffoldPath, '## One-sentence orientation\n\n_Not written yet. Replace this with exactly one sentence stating what this paper does._\n\n## Preliminary\n\n_Not built yet. Replace this with the real preliminary._\n');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Legacy Scaffold Smoke', '--source', 'paper.pdf', '--slug', 'legacy-scaffold-smoke', '--sections', '1. Introduction', '--body-file', legacyScaffoldPath], { cwd: temp, stdio: 'pipe' });
    const legacyScaffoldHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'legacy-scaffold-smoke', 'index.html'), 'utf8');
    if (/Not written yet|Not built yet|Replace this/.test(legacyScaffoldHtml)) failures.push('legacy Start Here scaffolds should never render raw placeholder text in HTML');
    if (!/Start Here pending|PaperMentor is reading this/.test(legacyScaffoldHtml)) failures.push('legacy Start Here scaffolds should render a safe pending notice instead');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', launchTextPath, '--slug', 'launch-provider-off-smoke', '--auto', '--no-figure', '--no-preview'], {
      cwd: temp,
      stdio: 'pipe',
      env: { ...process.env, PAPERMENTOR_AGENT: 'off' }
    });
    const launchProviderOffState = readJson(join(temp, '.papermentor', 'sessions', 'launch-provider-off-smoke', 'state.json'), {});
    const launchProviderOffHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'launch-provider-off-smoke', 'index.html'), 'utf8');
    if (!launchProviderOffState.pendingProvider || !launchProviderOffState.startHerePending || !/did not change|변경되지/i.test(launchProviderOffState.tuiNotice || '')) failures.push('launch --auto with provider disabled should mark provider unavailable instead of silently pretending to generate');
    if (/Not written yet|Not built yet|Replace this/.test(launchProviderOffHtml)) failures.push('launch --auto provider-off HTML should not expose raw Start Here placeholders');
    const slideLaunchPath = join(temp, 'Lecture 09.md');
    writeFileSync(slideLaunchPath, `sungwoong kim © All rights Reserved. Lecture 09

Slide 1: Diffusion Models
- Why likelihood models are hard to sample from.

Slide 14: DDPM
- Forward noising process.

Slide 15: DDPM
- Reverse denoising model.

Slide 16: DDPM
- Training objective build.

Slide 17: Sampling
- How the reverse chain generates samples.`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', slideLaunchPath, '--slug', 'slide-launch-smoke', '--mode', 'slide', '--no-figure', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const slideLaunchState = readJson(join(temp, '.papermentor', 'sessions', 'slide-launch-smoke', 'state.json'), {});
    const slideLaunchCards = readJson(join(temp, '.papermentor', 'sessions', 'slide-launch-smoke', 'cards.json'), { cards: [] });
    const slidePendingPrompt = readFileSync(join(temp, '.papermentor', 'sessions', 'slide-launch-smoke', 'pending-prompt.md'), 'utf8');
    if (slideLaunchCards.cards?.length !== 1 || slideLaunchCards.cards?.[0]?.type !== 'reading-guide') failures.push('slide launch should render only the reading guide until the Start Here writer prompt is filled');
    if (slideLaunchState.readingPath?.find((item) => item.key === 'narration')?.status === 'current') failures.push('slide launch should not skip key-slide explanation and jump to narration');
    if (/rights reserved|copyright|©/i.test(slideLaunchState.title || '')) failures.push(`slide title inference should not promote copyright footers, got ${slideLaunchState.title}`);
    if (!slideLaunchState.paperSections?.includes('Slides 14–16 — DDPM')) failures.push(`slide build slides should fold repeated titles into one topic, got ${JSON.stringify(slideLaunchState.paperSections)}`);
    if (slideLaunchState.pendingBlockType !== 'start-here' || !slideLaunchState.startHerePending) failures.push('slide launch should mark Start Here as pending instead of rendering a scaffold');
    for (const phrase of ['Slide Start Here Writer Prompt', 'Topic timeline map', 'Do not output placeholder text', 'Do not use these field names', 'Topic role']) {
      if (!slidePendingPrompt.includes(phrase)) failures.push(`slide Start Here pending prompt missing phrase: ${phrase}`);
    }
    writeFileSync(join(temp, 'slide-start-here.md'), '## One-sentence orientation\n\nThese slides introduce diffusion model sampling.\n\n## Topic timeline map\n\nflow: Diffusion Models -> DDPM -> Sampling\n\n## Preliminary\n\nNo extra prerequisites.');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'slide-launch-smoke', '--type', 'start-here', '--title', 'Start Here', '--body-file', join(temp, 'slide-start-here.md')], { cwd: temp, stdio: 'pipe' });
    const slideAfterStartHere = readJson(join(temp, '.papermentor', 'sessions', 'slide-launch-smoke', 'state.json'), {});
    if (!/Diffusion Models/.test(slideAfterStartHere.currentSection || '') || slideAfterStartHere.pendingBlockPrompt) failures.push('slide should enter the first meaningful topic and clear the Start Here prompt after Start Here is filled');
    const launchDir = join(temp, '.papermentor', 'sessions', 'launch-smoke');
    const launchState = readJson(join(launchDir, 'state.json'), {});
    const launchHtml = readFileSync(join(launchDir, 'index.html'), 'utf8');
    if (launchState.title !== 'TurboQuant: Extreme Quantization for Vector Search' || launchState.authors !== 'Jane Researcher, John Vector') failures.push('launch should infer title and authors from source text');
    if (!launchState.paperSections?.some((section) => section.includes('Problem Definition'))) failures.push('launch should detect source sections from one command');
    if (!launchHtml.includes('Jane Researcher, John Vector') || launchHtml.includes(launchTextPath)) failures.push('launch report should show authors and hide source paths');
    if (!launchHtml.includes('How to use this reading room') || !launchHtml.includes('Start Here pending') || !(launchHtml.indexOf('How to use this reading room') < launchHtml.indexOf('Start Here'))) failures.push('launch should create a reading guide block before a localized/pending Start Here');
    if (!launchHtml.includes('PaperMentor is reading this paper') || /Not written yet|Not built yet|List the prerequisites in order/.test(launchHtml) || (launchHtml.match(/class="ladder-heading"/g) || []).length) failures.push('launch Start Here should ship a user-facing pending notice, not internal scaffold text or script-synthesized ladder rows');

    const webArticlePath = join(temp, 'scaling-laws.html');
    writeFileSync(webArticlePath, `<!doctype html><html><head><title>Scaling Laws for World Models</title><meta property="og:title" content="Scaling Laws for World Models"></head><body><article><h1>Scaling Laws for World Models</h1><p>This post explains why model scale, data scale, and compute scale interact.</p><h2>Why scaling laws matter</h2><p>Scaling laws connect loss L(N, D) to parameter count N and dataset tokens D, so readers can estimate whether adding compute helps.</p><h2>Emergent bottlenecks</h2><p>The article warns that evaluation, data quality, and architecture can bend the trend.</p><h3>A small calculation</h3><p>If loss drops from 2.0 to 1.6 after doubling compute, the exponent summarizes that slope.</p></article></body></html>`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', webArticlePath, '--slug', 'url-mode-smoke', '--mode', 'url', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const urlState = readJson(join(temp, '.papermentor', 'sessions', 'url-mode-smoke', 'state.json'), {});
    const urlHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'url-mode-smoke', 'index.html'), 'utf8');
    if (urlState.sourceMode !== 'url' || urlState.title !== 'Scaling Laws for World Models') failures.push(`url mode should launch HTML/web sources with URL mode and title, got ${urlState.sourceMode}/${urlState.title}`);
    if (!urlState.paperSections?.some((section) => section.includes('Why scaling laws matter')) || !urlState.paperSections?.some((section) => section.includes('Emergent bottlenecks'))) failures.push(`url mode should use webpage headings as reading sections, got ${JSON.stringify(urlState.paperSections)}`);
    if (/Representative figure/.test(urlHtml) || urlState.figureSelectionWarning) failures.push('url mode should not force paper representative-figure scaffolding or warnings');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'launch-smoke', '--type', 'note', '--title', 'Unsafe link smoke', '--body', '[bad](javascript:alert(1)) [file](file:///tmp/x) [ok](https://example.com/path?a=1&b=2)'], { cwd: temp, stdio: 'pipe' });
    const safeLinkHtml = readFileSync(join(launchDir, 'index.html'), 'utf8');
    if (/href="(?:javascript:|file:|data:)/i.test(safeLinkHtml)) failures.push('rendered markdown links should reject unsafe URL schemes');
    if (!safeLinkHtml.includes('href="https://example.com/path?a=1&amp;b=2"')) failures.push('rendered markdown links should preserve safe https links');
    try {
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', 'http://example.com/paper.pdf', '--slug', 'http-source-blocked'], { cwd: temp, stdio: 'pipe' });
      failures.push('launch should reject insecure http source URLs by default');
    } catch (error) {
      if (!String(error.stderr || error.message).includes('must use https')) failures.push('http source rejection should explain the https requirement');
    }
    try {
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--slug', 'data-figure-blocked', '--title', 'Unsafe figure', '--figure-url', 'data:image/svg+xml,<svg/>', '--body', 'Body'], { cwd: temp, stdio: 'pipe' });
      failures.push('figure-url should reject data: URLs');
    } catch (error) {
      if (!String(error.stderr || error.message).includes('figure URL must be an http(s) URL')) failures.push('data figure rejection should explain safe figure URL schemes');
    }
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'launch-smoke', '--paper-text-file', launchTextPath], { cwd: temp, stdio: 'pipe' });
    const genericLaunchState = readJson(join(launchDir, 'state.json'), {});
    const genericLaunchActions = JSON.stringify(genericLaunchState.sectionActions || {});
    for (const forbidden of ['drifting', 'pushforward', 'stopgrad', 'anti-symmetric', 'diffusion-time', 'inference-time diffusion']) {
      if (launchHtml.toLowerCase().includes(forbidden) || genericLaunchActions.toLowerCase().includes(forbidden)) failures.push(`generic TurboQuant launch/analyze leaked Drifting-specific helper text: ${forbidden}`);
    }

    const noisySourcePath = join(temp, 'noisy-source.txt');
    writeFileSync(noisySourcePath, `Noisy OCR Robustness Fixture
Anonymous Copy

Abstract
This document has sparse OCR and no reliable method claim.

COPYRIGHT ALL RIGHTS RESERVED. This page intentionally blank.
Generated by Scanner 0.0. Downloaded from Example Conference Proceedings.
HEADER HEADER HEADER 12 12 12
1. Notes
The source gives too little technical evidence for confident concept extraction.`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', noisySourcePath, '--slug', 'noisy-launch-smoke', '--no-figure', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const noisyHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'noisy-launch-smoke', 'index.html'), 'utf8');
    const noisyLadderRows = (noisyHtml.match(/class="ladder-heading"/g) || []).length;
    if (noisyLadderRows !== 0 || !noisyHtml.includes('Start Here pending')) failures.push(`noisy/malformed launch should ship a pending Start Here notice with no script-synthesized rows, got ${noisyLadderRows} ladder rows`);
    for (const forbidden of ['All Rights Reserved', 'Generated by Scanner', 'Example Conference Proceedings', 'page intentionally blank']) {
      if (noisyHtml.includes(`<h3 class="ladder-heading">`) && noisyHtml.includes(forbidden)) failures.push(`noisy/malformed launch should not promote boilerplate into concept ladder: ${forbidden}`);
    }

    const brokenMathPath = join(temp, 'broken-pdf-math.txt');
    writeFileSync(brokenMathPath, `Self-Supervised Learning from Images with a Joint-Embedding Predictive Architecture
Jane Vision

Abstract
Compared to generative methods that predict in pixel/token space, I-JEPA predicts abstract target representations and learns semantic features.

1. Method
The objective uses M_{i=1} fragments from PDF layout and broken text such as i = 1} {D}\\left and i = 1}\\sum _{j \\in B_i} \\lVert \\hat {\\vs }_{
The clean notation B_i and y_j identify target blocks and representations.
We evaluate I-JEPA with ViT-H and ViT-L encoders in a self-supervised setup.`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', brokenMathPath, '--slug', 'broken-math-launch', '--no-figure', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const brokenMathHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'broken-math-launch', 'index.html'), 'utf8');
    for (const forbidden of ['i is defined by', '{D}\\left', '\\lVert \\hat', 'M_{i=1}', 'vit-h']) {
      if (brokenMathHtml.includes(forbidden)) failures.push(`broken PDF math should not leak malformed notation/concept into Start Here: ${forbidden}`);
    }
    for (const expected of ['Start Here pending', 'PaperMentor is reading this paper']) {
      if (!brokenMathHtml.includes(expected)) failures.push(`broken PDF launch should still ship a user-facing pending Start Here notice: ${expected}`);
    }

    const representativeChoicePdfPath = join(temp, 'representative-choice-paper.pdf');
    writeRepresentativeChoicePdfFixture(representativeChoicePdfPath);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', representativeChoicePdfPath, '--slug', 'representative-choice-pdf', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const representativeChoiceDir = join(temp, '.papermentor', 'sessions', 'representative-choice-pdf');
    const representativeChoiceState = readJson(join(representativeChoiceDir, 'state.json'), {});
    const representativeChoiceCards = readJson(join(representativeChoiceDir, 'cards.json'), { cards: [] });
    const representativeChoiceStartCard = representativeChoiceCards.cards?.find((card) => card.type === 'start-here');
    const representativePrompt = readFileSync(join(representativeChoiceDir, 'representative-figure-prompt.md'), 'utf8');
    if (representativeChoiceState.representativeFigure) failures.push('representative figure selection should not be decided by script scoring');
    if (!representativeChoiceState.representativeFigureCandidates?.some((candidate) => candidate.label === '2')) failures.push('representative figure prompt should include Figure 2 candidate');
    if (representativeChoiceStartCard?.figure) failures.push('representative figure selection should not auto-attach a figure before model judgment');
    if (!/selected: Figure <label>|selected: none|Do not choose from/i.test(representativePrompt)) failures.push('representative figure prompt should ask the model to choose or reject candidates');
    if (!/Figure 1[\s\S]+Figure 2/.test(representativePrompt)) failures.push('representative figure prompt should include collected caption candidates in source order');
    const pdffiguresJsonPath = join(temp, 'representative-choice-pdffigures.json');
    writeFileSync(pdffiguresJsonPath, JSON.stringify([
      {
        page: 0,
        name: '1',
        figType: 'Figure',
        caption: 'Figure 1. Linear Evaluation. Accuracy results on a benchmark.',
        regionBoundary: { x1: 72, y1: 150, x2: 332, y2: 182 },
        captionBoundary: { x1: 72, y1: 184, x2: 380, y2: 198 }
      },
      {
        page: 0,
        name: '2',
        figType: 'Figure',
        caption: 'Figure 2. Overall method pipeline. The encoder maps queries to vectors and ranks documents.',
        regionBoundary: { x1: 72, y1: 220, x2: 492, y2: 272 },
        captionBoundary: { x1: 72, y1: 274, x2: 540, y2: 292 }
      }
    ]));

    const fakeCodexDir = join(temp, 'fake-codex-bin');
    mkdirSync(fakeCodexDir, { recursive: true });
    const fakeCodexScriptPath = join(fakeCodexDir, 'fake-codex.js');
    const fakeCodexPath = process.platform === 'win32' ? join(fakeCodexDir, 'codex.cmd') : join(fakeCodexDir, 'codex');
    const fakeCodexScript = `const fs = require('fs');
const path = require('path');
const input = fs.readFileSync(0, 'utf8');
const outFlag = process.argv.indexOf('--output-last-message');
const out = outFlag >= 0 ? process.argv[outFlag + 1] : '';
const write = (value) => { if (out) fs.writeFileSync(out, value); process.stdout.write(value); };
const countFile = process.env.PAPERMENTOR_FAKE_CODEX_COUNT_FILE;
if (countFile) {
  const key = /PaperMentor Start Here generator/i.test(input) ? 'start-here'
    : /representative figure (?:selection|selector)/i.test(input) ? 'representative-figure'
    : /PaperMentor representative figure visual reader/i.test(input) ? 'representative-figure-reading'
    : /PaperMentor section action generator/i.test(input) ? 'section-menu'
    : /PPTX to PDF conversion task/i.test(input) ? 'pptx-to-pdf'
    : 'other';
  const counts = fs.existsSync(countFile) ? JSON.parse(fs.readFileSync(countFile, 'utf8')) : {};
  counts[key] = (counts[key] || 0) + 1;
  fs.writeFileSync(countFile, JSON.stringify(counts));
}
if (/PPTX to PDF conversion task/i.test(input)) {
  const match = input.match(/Required output PDF:\\n([^\\n]+)/);
  const pdfPath = match ? match[1].trim() : '';
  if (pdfPath && process.env.PAPERMENTOR_FAKE_CONVERTED_PDF) {
    fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
    fs.copyFileSync(process.env.PAPERMENTOR_FAKE_CONVERTED_PDF, pdfPath);
    write(JSON.stringify({ ok: true, pdfPath }));
  } else {
    write(JSON.stringify({ ok: false, error: 'missing fake conversion target' }));
  }
} else if (/PaperMentor representative figure visual reader/i.test(input)) {
  write('# Start Here\\n\\n## One-sentence orientation\\n\\nThis slide deck teaches a retrieval encoder pipeline: tokens are encoded into vectors, vectors are compared with document vectors, and the resulting scores rank candidate documents.\\n\\n## Figure explanation under image\\n\\n- **Figure / location:** Figure 2, the representative method pipeline crop.\\n- **Concept / method role:** The visual is an encoder-to-ranking pipeline: query tokens enter an encoder box, document representations are compared against the query representation, and the final block emits ranking scores.\\n- **How to read it:** The query input box names the user text, the encoder box names the learned transformation into vectors, and the ranking score box names the decision output used by retrieval.\\n- **Parts to identify:** The arrows carry representations from input tokens through the encoder to score comparison; the boxes separate input, transformation, and scoring roles so the reader does not confuse data with the learned representation.\\n- **In-figure math / symbols:** The crop uses labels rather than equations; the matching score is connected to the surrounding equation $score(q,d)=q^{T}d$.\\n- **Flow / sequence:** Read the pipeline as query tokens -> encoder representation -> document comparison -> ranking score, with each step narrowing raw text into a retrieval decision.\\n- **What to observe:** The figure encodes that retrieval quality depends on representation learning before benchmark metrics can be interpreted.\\n- **Equations or claims it supports:** It anchors the margin objective and the claim that better encoder representations improve ranking.\\n\\n## Preliminary\\n\\n### Encoder scores\\n\\nA query vector and document vector are compared to rank relevant documents. The score rule can be read as a tiny equation anchor from Eq. (1):\\n\\n$$score(q,d)=q^{T}d$$\\n\\n### Reconstruction checkpoint\\n\\nBefore continuing, the reader should be able to reconstruct why query encoding, document encoding, and score comparison are three different roles.');
} else if (/PaperMentor section action generator/i.test(input)) {
  const marker = 'Section/slide:';
  const at = input.indexOf(marker);
  const firstSection = at >= 0 ? input.slice(at + marker.length).split(String.fromCharCode(10))[0].trim() : '1. Method';
  write(JSON.stringify(['Explain the encoder scoring pipeline', 'Trace the ranking objective', 'Ask anything about this']));
} else if (/PaperMentor Start Here generator/i.test(input)) {
  const body = '# Start Here\\n\\n## One-sentence orientation\\n\\nThis slide deck teaches a retrieval encoder pipeline: tokens are encoded into vectors, vectors are compared with document vectors, and the resulting scores rank candidate documents. Figure 2 is the entry point because it shows the visual flow from query tokens to encoder boxes to ranking score output, rather than only reporting a benchmark.\\n\\n## Figure explanation under image\\n\\n- **Figure / location:** Figure 2, the representative method pipeline crop.\\n- **Concept / method role:** The visual is an encoder-to-ranking pipeline: query tokens enter an encoder box, document representations are compared against the query representation, and the final block emits ranking scores.\\n- **How to read it:** The query input box names the user text, the encoder box names the learned transformation into vectors, and the ranking score box names the decision output used by retrieval.\\n- **Parts to identify:** The arrows carry representations from input tokens through the encoder to score comparison; the boxes separate input, transformation, and scoring roles so the reader does not confuse data with the learned representation.\\n- **In-figure math / symbols:** The crop uses labels rather than equations; the matching score is connected to the surrounding equation $score(q,d)=q^{T}d$.\\n- **Flow / sequence:** Read the pipeline as query tokens -> encoder representation -> document comparison -> ranking score, with each step narrowing raw text into a retrieval decision.\\n- **What to observe:** The figure encodes that retrieval quality depends on representation learning before benchmark metrics can be interpreted.\\n- **Equations or claims it supports:** It anchors the margin objective and the claim that better encoder representations improve ranking.\\n\\n## Preliminary\\n\\n### Encoder scores\\n\\nA query vector and document vector are compared to rank relevant documents. The score rule can be read as a tiny equation anchor from Eq. (1):\\n\\n$$score(q,d)=q^{T}d$$\\n\\nIf q=[1,2] and d=[3,4], then the score is 11, so larger alignment means a stronger match.\\n\\n### Margin objective\\n\\nThe method compares the score of a positive document against a negative document and pushes the positive one higher. This objective matters because the slide diagram is a pipeline, not a result plot: each arrow carries representations toward a ranking decision.\\n\\n### Reconstruction checkpoint\\n\\nBefore continuing, the reader should be able to reconstruct why query encoding, document encoding, and score comparison are three different roles, and then explain how the next slide evaluates whether those scores improve retrieval.';
  if (/Candidate figure crops to inspect/i.test(input)) write(JSON.stringify({ selectedFigureIndex: 2, reason: 'Figure 2 is the method pipeline, not a benchmark result.', mustVerifyFromPixels: ['encoder box', 'ranking flow'], body }));
  else write(body.replace(/Figure 2 is the entry point/, 'Figure 1 is the entry point').replace(/\\n\\n## Figure explanation under image[\\s\\S]*?\\n\\n## Preliminary/, '\\n\\n## Preliminary'));
} else if (/representative figure (?:selection|selector)/i.test(input)) {
  write(JSON.stringify({ selectedIndex: 2, reason: 'Figure 2 is the method pipeline, not a benchmark result.', mustVerifyFromPixels: ['encoder box', 'ranking flow'] }));
} else {
  write('## Generated block\\n\\nThis generated explanation block is long enough to pass the smoke path and names a checkpoint, Figure 1, and the retrieval score $score(q,d)$ so the HTML block has concrete teaching content.');
}
`;
    writeFileSync(fakeCodexScriptPath, fakeCodexScript);
    if (process.platform === 'win32') {
      writeFileSync(fakeCodexPath, `@echo off\r\nnode "%~dp0fake-codex.js" %*\r\n`);
    } else {
      writeFileSync(fakeCodexPath, `#!/usr/bin/env node
require('./fake-codex.js');
`);
      chmodSync(fakeCodexPath, 0o755);
    }
    const representativeAutoCountFile = join(temp, 'representative-auto-counts.json');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', representativeChoicePdfPath, '--slug', 'representative-choice-auto', '--auto', '--no-preview'], {
      cwd: temp,
      stdio: 'pipe',
      env: { ...process.env, PATH: `${fakeCodexDir}:${process.env.PATH}`, PAPERMENTOR_AGENT: 'codex', PAPERMENTOR_PDFFIGURES2_JSON: pdffiguresJsonPath, PAPERMENTOR_FAKE_CODEX_COUNT_FILE: representativeAutoCountFile }
    });
    const representativeAutoDir = join(temp, '.papermentor', 'sessions', 'representative-choice-auto');
    const representativeAutoState = readJson(join(representativeAutoDir, 'state.json'), {});
    const representativeAutoCards = readJson(join(representativeAutoDir, 'cards.json'), { cards: [] });
    const representativeAutoHtml = readFileSync(join(representativeAutoDir, 'index.html'), 'utf8');
    const representativeAutoStart = representativeAutoCards.cards?.find((card) => card.type === 'start-here');
    if (!representativeAutoStart?.figure?.src?.endsWith('.png')) failures.push(`representative auto-selection should attach the model-selected method figure crop; warning=${representativeAutoState.figureExtractionWarning || representativeAutoState.figureSelectionWarning || 'none'}`);
    if (representativeAutoState.representativeFigureSelection?.selectedIndex !== 2) failures.push(`representative auto-selection should preserve the model-selected candidate index, got ${JSON.stringify(representativeAutoState.representativeFigureSelection)}`);
    if (representativeAutoState.representativeFigureSelection?.source !== 'pymupdf') failures.push(`representative auto-selection should preserve PyMuPDF figure-geometry source, got ${JSON.stringify(representativeAutoState.representativeFigureSelection)}`);
    if (!representativeAutoState.representativeFigureSelection?.crop) failures.push('representative auto-selection should pass PyMuPDF geometry crop into extract-figure');
    if (!representativeAutoState.representativeFigureCandidates?.some((candidate) => candidate.source === 'pymupdf' && candidate.crop)) failures.push('representative figure candidates should include PyMuPDF geometry crop metadata');
    if (representativeAutoState.figureReadingPending) failures.push(`representative auto-generation should finish the pixel-based visual reading, got warning=${representativeAutoState.figureReadingWarning || 'none'}`);
    const representativeAutoCounts = readJson(representativeAutoCountFile, {});
    if (representativeAutoCounts['start-here'] !== 1 || representativeAutoCounts['representative-figure'] || representativeAutoCounts['representative-figure-reading']) failures.push(`representative auto-generation should combine figure selection and visual reading into one Start Here provider call, got ${JSON.stringify(representativeAutoCounts)}`);
    if (!/Figure explanation under image|encoder-to-ranking pipeline|query tokens -> encoder representation/.test(representativeAutoStart?.body || '')) failures.push('representative auto-generation should add a pixel-based Figure explanation under image section to Start Here');
    for (const phrase of ['encoder-to-ranking pipeline', 'query tokens -&gt; encoder representation', 'Parts to identify', 'Flow / sequence']) {
      if (!representativeAutoHtml.includes(phrase)) failures.push(`representative auto-generation should render visual reading in HTML under the image: ${phrase}`);
    }
    if (!(representativeAutoHtml.indexOf('class="paper-figure"') < representativeAutoHtml.indexOf('Preliminary'))) failures.push('representative auto-generation should render the visual reading between the figure image and Preliminary content');
    if (/Full-page visual fallback/i.test(JSON.stringify(representativeAutoCards))) failures.push('representative auto-selection should not attach full-page fallback text');

    const captionOnlyFigurePath = join(temp, 'caption-only-figure-paper.pdf');
    writeCaptionOnlyFigurePdfFixture(captionOnlyFigurePath);
    const captionOnlyCountFile = join(temp, 'caption-only-auto-counts.json');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', captionOnlyFigurePath, '--slug', 'caption-only-auto', '--auto', '--no-preview'], {
      cwd: temp,
      stdio: 'pipe',
      env: { ...process.env, PATH: `${fakeCodexDir}:${process.env.PATH}`, PAPERMENTOR_AGENT: 'codex', PAPERMENTOR_FAKE_CODEX_COUNT_FILE: captionOnlyCountFile }
    });
    const captionOnlyDir = join(temp, '.papermentor', 'sessions', 'caption-only-auto');
    const captionOnlyState = readJson(join(captionOnlyDir, 'state.json'), {});
    const captionOnlyCards = readJson(join(captionOnlyDir, 'cards.json'), { cards: [] });
    const captionOnlyHtml = readFileSync(join(captionOnlyDir, 'index.html'), 'utf8');
    const captionOnlyStart = captionOnlyCards.cards?.find((card) => card.type === 'start-here');
    if (captionOnlyState.startHerePending || captionOnlyState.pendingBlockType === 'start-here') failures.push(`caption-only figure crop failure must not leave Start Here pending: ${JSON.stringify(captionOnlyState)}`);
    if (captionOnlyStart?.figure) failures.push('caption-only geometry failure should not attach a fake representative figure');
    if (!/One-sentence orientation|Preliminary|Encoder scores/.test(captionOnlyStart?.body || '')) failures.push('caption-only geometry failure should still produce a finished Start Here body');
    if (/Start Here pending|PaperMentor is reading this paper|Could not auto-generate/.test(captionOnlyHtml)) failures.push('caption-only geometry failure should render finished HTML instead of pending/error text');
    if (!/Could not prepare representative figure candidate crops|Start Here will be generated without a figure/i.test(`${captionOnlyState.figureCandidatePreparationWarning || ''} ${captionOnlyState.figureSelectionWarning || ''}`)) failures.push('caption-only geometry failure should persist a visible non-blocking warning');
    const captionOnlyCounts = readJson(captionOnlyCountFile, {});
    if (captionOnlyCounts['start-here'] !== 1) failures.push(`caption-only geometry failure should still call Start Here provider once, got ${JSON.stringify(captionOnlyCounts)}`);

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', representativeChoicePdfPath, '--slug', 'representative-choice-env-bin', '--auto', '--no-preview'], {
      cwd: temp,
      stdio: 'pipe',
      env: { ...process.env, PAPERMENTOR_CODEX_BIN: fakeCodexPath, PAPERMENTOR_AGENT: 'codex' }
    });
    const representativeEnvBinState = readJson(join(temp, '.papermentor', 'sessions', 'representative-choice-env-bin', 'state.json'), {});
    if (representativeEnvBinState.representativeFigureSelection?.selectedIndex !== 2) failures.push('PAPERMENTOR_CODEX_BIN should select the Codex executable path without relying on PATH lookup');

    const resultOnlyPdfPath = join(temp, 'result-only-figures.pdf');
    writeResultOnlyPdfFixture(resultOnlyPdfPath);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', resultOnlyPdfPath, '--slug', 'result-only-figures', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const resultOnlyDir = join(temp, '.papermentor', 'sessions', 'result-only-figures');
    const resultOnlyState = readJson(join(resultOnlyDir, 'state.json'), {});
    const resultOnlyCards = readJson(join(resultOnlyDir, 'cards.json'), { cards: [] });
    const resultOnlyStartCard = resultOnlyCards.cards?.find((card) => card.type === 'start-here');
    if (resultOnlyState.representativeFigure) failures.push(`result-only figures should not be selected as representative method figures, got ${JSON.stringify(resultOnlyState.representativeFigure)}`);
    if (resultOnlyStartCard?.figure) failures.push('result-only figure launch should not attach a benchmark/result plot as Start Here representative figure');
    if (!/No representative figure attached/i.test(resultOnlyStartCard?.body || '')) failures.push('result-only figure launch should write an explicit no-representative-figure fallback');

    const realPdfPath = join(temp, 'tiny-method-paper.pdf');
    writeTinyPdfFixture(realPdfPath);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', realPdfPath, '--slug', 'real-pdf-launch', '--page', '1', '--preview'], { cwd: temp, stdio: 'pipe' });
    const realPdfDir = join(temp, '.papermentor', 'sessions', 'real-pdf-launch');
    const realPdfState = readJson(join(realPdfDir, 'state.json'), {});
    const realPdfCards = readJson(join(realPdfDir, 'cards.json'), { cards: [] });
    const realPdfHtml = readFileSync(join(realPdfDir, 'index.html'), 'utf8');
    if (realPdfState.sourceMode !== 'paper') failures.push(`real PDF launch should detect paper mode, got ${realPdfState.sourceMode}`);
    if (!realPdfState.paperSections?.some((section) => section.includes('Method'))) failures.push('real PDF launch should detect Method section from extracted PDF text');
    if (!realPdfState.cropPreview || !existsSync(join(realPdfDir, 'crop-preview.html'))) failures.push('real PDF launch should write crop preview evidence');
    const realPdfStartCard = realPdfCards.cards?.find((card) => card.type === 'start-here');
    if (!realPdfStartCard?.figure?.src?.endsWith('.png')) failures.push('real PDF launch should attach a rendered/cropped PNG figure to Start Here');
    for (const phrase of ['Tiny Retrieval Method', 'Start Here pending', 'Figure 1. Representative method figure.']) {
      if (!realPdfHtml.includes(phrase)) failures.push(`real PDF launch report missing ${phrase}`);
    }
    for (const forbidden of ['Drifting Models', 'pushforward distribution', 'anti-symmetric drifting field', 'stop-gradient target']) {
      if (realPdfHtml.includes(forbidden)) failures.push(`real PDF Start Here should not leak paper-specific helper concept: ${forbidden}`);
    }
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'preview-crops', '--session', 'real-pdf-launch', '--source', realPdfPath, '--page', '1', '--overwrite'], { cwd: temp, stdio: 'pipe' });
    const realPdfPreviews = readJson(join(realPdfDir, 'crop-previews.json'), { previews: [] });
    if (!realPdfPreviews.previews?.some((preview) => preview.label === 'Full page / slide')) failures.push('real PDF preview-crops should include full-page candidate');
    if (!realPdfPreviews.previews?.some((preview) => /Auto Figure/.test(preview.label))) failures.push('real PDF preview-crops should include auto Figure candidate');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'extract-figure', '--session', 'real-pdf-launch', '--source', realPdfPath, '--page', '1', '--auto', 'figure1', '--title', 'PDF method figure', '--body', '## Extracted visual explanation\n\n- **Question:** What does the retrieval pipeline show?\n- **Concept:** encoder scoring pipeline.\n- **What to observe:** query tokens become ranking scores.\n- **Conclusion:** the method figure anchors the objective explanation.'], { cwd: temp, stdio: 'pipe' });
    const realPdfAfterExtract = readJson(join(realPdfDir, 'cards.json'), { cards: [] });
    if (!realPdfAfterExtract.cards?.some((card) => card.title === 'PDF method figure' && card.figure?.src?.endsWith('.png'))) failures.push('real PDF extract-figure should append a PNG figure card');

    const realPptxPath = join(temp, 'tiny-slide.pptx');
    writeTinyPptxFixture(realPptxPath);
    const unsupportedPptPath = join(temp, 'unsupported.ppt');
    const legacyPptHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    writeFileSync(unsupportedPptPath, legacyPptHeader);
    try {
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', unsupportedPptPath, '--slug', 'unsupported-ppt'], { cwd: temp, stdio: 'pipe' });
      failures.push('legacy .ppt launch should fail with an unsupported-source error');
    } catch (error) {
      const output = `${error.stdout || ''}${error.stderr || ''}`;
      if (!/PPT\/Keynote input is not supported|unsupported/i.test(output)) failures.push(`legacy .ppt launch should explain that PPT is unsupported, got ${output.slice(0, 300)}`);
    }
    const unsupportedPptWithoutExtension = join(temp, 'unsupported-legacy-ppt');
    writeFileSync(unsupportedPptWithoutExtension, legacyPptHeader);
    try {
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', unsupportedPptWithoutExtension, '--slug', 'unsupported-ppt-bytes'], { cwd: temp, stdio: 'pipe' });
      failures.push('extensionless legacy PPT launch should fail from content detection');
    } catch (error) {
      const output = `${error.stdout || ''}${error.stderr || ''}`;
      if (!/PPT\/Keynote input is not supported|unsupported/i.test(output)) failures.push(`extensionless legacy PPT should be rejected by bytes, got ${output.slice(0, 300)}`);
    }
    const noFigurePdfPath = join(temp, 'no-figure-paper.pdf');
    writeNoFigurePdfFixture(noFigurePdfPath);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'No Figure Preview', '--source', noFigurePdfPath, '--slug', 'no-figure-preview'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'preview-crops', '--session', 'no-figure-preview', '--source', noFigurePdfPath, '--page', '1', '--overwrite'], { cwd: temp, stdio: 'pipe' });
    const noFigurePreview = readJson(join(temp, '.papermentor', 'sessions', 'no-figure-preview', 'crop-previews.json'), { previews: [] });
    const noFigurePreviewState = readJson(join(temp, '.papermentor', 'sessions', 'no-figure-preview', 'state.json'), {});
    if (!noFigurePreview.previews?.some((preview) => preview.label === 'Full page / slide')) failures.push('preview-crops should still write full-page preview when auto Figure 1 is absent');
    if (noFigurePreview.previews?.some((preview) => /Auto Figure/.test(preview.label))) failures.push('preview-crops should not invent an auto Figure crop when no Figure 1 caption exists');
    if (!/Auto figure crop unavailable|PyMuPDF did not detect figure geometry|PyMuPDF figure detection/i.test(noFigurePreview.warning || noFigurePreviewState.cropPreviewWarning || '')) failures.push('preview-crops should persist a PyMuPDF auto-crop warning without aborting the preview');

    if (hasPyMuPDFDetector()) {
      const vectorOnlyFigurePath = join(temp, 'vector-only-figure-paper.pdf');
      writeVectorOnlyFigurePdfFixture(vectorOnlyFigurePath);
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Vector Geometry Figure', '--source', vectorOnlyFigurePath, '--slug', 'vector-geometry-figure'], { cwd: temp, stdio: 'pipe' });
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'preview-crops', '--session', 'vector-geometry-figure', '--source', vectorOnlyFigurePath, '--page', '1', '--overwrite'], { cwd: temp, stdio: 'pipe' });
      const vectorPreview = readJson(join(temp, '.papermentor', 'sessions', 'vector-geometry-figure', 'crop-previews.json'), { previews: [] });
      const vectorAuto = vectorPreview.previews?.find((preview) => /Auto Figure/.test(preview.label));
      if (!vectorAuto) failures.push(`geometry detector should crop vector-only figure objects above the caption; warning=${vectorPreview.warning || 'none'}`);
      if (!/--crop\s+['"]?\d+,\d+,\d+,\d+/.test(vectorAuto?.command || '')) failures.push(`geometry detector should produce an explicit crop rectangle, got command=${vectorAuto?.command || '(none)'}`);
    }
    const fakeConvertedPdf = join(temp, 'fake-converted-slide.pdf');
    writeTinyPdfFixture(fakeConvertedPdf);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', realPptxPath, '--slug', 'real-pptx-fake-pdf-launch', '--no-preview', '--no-figure'], {
      cwd: temp,
      stdio: 'pipe',
      env: { ...process.env, PAPERMENTOR_AGENT: 'codex', PAPERMENTOR_CODEX_BIN: fakeCodexPath, PAPERMENTOR_FAKE_CONVERTED_PDF: fakeConvertedPdf }
    });
    const fakePptxPdfState = readJson(join(temp, '.papermentor', 'sessions', 'real-pptx-fake-pdf-launch', 'state.json'), {});
    if (fakePptxPdfState.sourceMode !== 'slide') failures.push(`fake PPTX PDF conversion should preserve slide mode, got ${fakePptxPdfState.sourceMode}`);
    if (!String(fakePptxPdfState.source || '').endsWith('.pdf')) failures.push(`fake PPTX PDF conversion should store converted PDF as source, got ${fakePptxPdfState.source}`);

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'PPTX Preview Args', '--source', realPptxPath, '--slug', 'pptx-preview-args'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'preview-crops', '--session', 'pptx-preview-args', '--source', realPptxPath, '--page', '1', '--agent', 'codex', '--overwrite'], {
      cwd: temp,
      stdio: 'pipe',
      env: { ...process.env, PAPERMENTOR_CODEX_BIN: fakeCodexPath, PAPERMENTOR_FAKE_CONVERTED_PDF: fakeConvertedPdf }
    });
    const pptxPreview = readJson(join(temp, '.papermentor', 'sessions', 'pptx-preview-args', 'crop-previews.json'), { previews: [] });
    if (!pptxPreview.previews?.some((preview) => preview.label === 'Full page / slide')) failures.push('PPTX preview-crops should pass provider args into conversion and write full-page preview');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', realPptxPath, '--slug', 'real-pptx-auto-quality', '--auto', '--no-preview', '--no-figure'], {
      cwd: temp,
      stdio: 'pipe',
      env: { ...process.env, PAPERMENTOR_AGENT: 'codex', PAPERMENTOR_CODEX_BIN: fakeCodexPath, PAPERMENTOR_FAKE_CONVERTED_PDF: fakeConvertedPdf }
    });
    const pptxAutoDir = join(temp, '.papermentor', 'sessions', 'real-pptx-auto-quality');
    const pptxAutoState = readJson(join(pptxAutoDir, 'state.json'), {});
    const pptxAutoCards = readJson(join(pptxAutoDir, 'cards.json'), { cards: [] });
    const pptxAutoHtml = readFileSync(join(pptxAutoDir, 'index.html'), 'utf8');
    const pptxAutoStartCard = pptxAutoCards.cards?.find((card) => card.type === 'start-here');
    const pptxQa = JSON.parse(execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'qa', '--session', 'real-pptx-auto-quality', '--json', '--min', '82'], { cwd: temp, encoding: 'utf8' }));
    if (pptxAutoState.sourceMode !== 'slide') failures.push(`PPTX auto quality launch should stay in slide mode, got ${pptxAutoState.sourceMode}`);
    if (!String(pptxAutoState.source || '').endsWith('.pdf')) failures.push(`PPTX auto quality launch should read the converted PDF, got ${pptxAutoState.source}`);
    if (!pptxAutoStartCard || markdownPlainText(pptxAutoStartCard.body).length < 420) failures.push('PPTX auto quality launch should write a substantial Start Here card');
    if (!pptxAutoState.nextChoices?.length) failures.push('PPTX auto quality launch should keep default section choices available after Start Here');
    if (pptxAutoState.prefetchNotice) failures.push('PPTX auto quality launch should not block on provider-generated section menu prefetch by default');
    if (pptxQa.status !== 'pass' || pptxQa.overall < 82) failures.push(`PPTX auto quality launch should pass content QA, got ${pptxQa.overall}/${pptxQa.status}`);
    for (const phrase of ['Start Here', 'One-sentence orientation', 'Preliminary', 'Figure 1', 'retrieval encoder pipeline']) {
      if (!pptxAutoHtml.includes(phrase)) failures.push(`PPTX auto quality HTML missing ${phrase}`);
    }
    if (/Start Here pending|Not written yet|Not built yet|placeholder/i.test(pptxAutoHtml)) failures.push('PPTX auto quality HTML should contain finished Start Here content, not pending/scaffold text');

    const goldenFiles = {
      equation: join(temp, 'golden-equation-card.md'),
      derivation: join(temp, 'golden-derivation-trace.md'),
      dependency: join(temp, 'golden-dependency-trace.md'),
      confusion: join(temp, 'golden-confusion-repair.md'),
      korean: join(temp, 'golden-korean-explanation.md')
    };
    writeFileSync(goldenFiles.equation, markdownSection(golden, 'Golden equation card'));
    writeFileSync(goldenFiles.derivation, markdownSection(golden, 'Golden derivation trace'));
    writeFileSync(goldenFiles.dependency, markdownSection(golden, 'Golden dependency trace'));
    writeFileSync(goldenFiles.confusion, markdownSection(golden, 'Golden confusion repair'));
    writeFileSync(goldenFiles.korean, markdownSection(golden, 'Golden Korean explanation'));
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Golden Quality Structural Smoke', '--slug', 'golden-quality-smoke'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'golden-quality-smoke', '--type', 'equation', '--title', 'Golden equation card', '--latex', '\\mathcal{R}(f)=\\mathbb{E}_{(x,y)\\sim\\mathcal{D}}[\\ell(f(x),y)]', '--body-file', goldenFiles.equation, '--choices', 'Trace derivation|Map dependencies'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'golden-quality-smoke', '--type', 'derivation', '--title', 'Golden derivation trace', '--body-file', goldenFiles.derivation], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'golden-quality-smoke', '--type', 'dependency', '--title', 'Golden dependency trace', '--body-file', goldenFiles.dependency], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'golden-quality-smoke', '--type', 'confusion', '--title', 'Golden confusion repair', '--user-question', 'Why is the expectation outside the loss?', '--body-file', goldenFiles.confusion], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'golden-quality-smoke', '--type', 'note', '--title', 'Golden Korean explanation', '--body-file', goldenFiles.korean], { cwd: temp, stdio: 'pipe' });
    const goldenDir = join(temp, '.papermentor', 'sessions', 'golden-quality-smoke');
    const goldenHtml = readFileSync(join(goldenDir, 'index.html'), 'utf8');
    const goldenCards = readJson(join(goldenDir, 'cards.json'), { cards: [] });
    if ((goldenHtml.match(/class="block"/g) || []).length !== 5) failures.push('golden quality generated report should render five structural blocks');
    if ((goldenHtml.match(/<table>/g) || []).length < 1 || !goldenHtml.includes('<th>Symbol</th>')) failures.push('golden quality generated report should render the equation symbol table as HTML table structure');
    if ((goldenHtml.match(/<ol>/g) || []).length < 1 || (goldenHtml.match(/<ul>/g) || []).length < 3) failures.push('golden quality generated report should render dependency and explanation lists structurally');
    for (const phrase of ['<h3>Equation</h3>', '<h3>Role</h3>', '<h3>Previous equation</h3>', '<h3>Next equation</h3>', '<h3>Backward dependencies</h3>', '<h3>Forward dependencies</h3>', '<h3>Direct answer</h3>', '<h3>Missing dependency</h3>', '<h3>Reconnection to original text</h3>', 'class="user-question"', '가능한 sample들에 대한 평균']) {
      if (!goldenHtml.includes(phrase)) failures.push(`golden quality generated report missing structural output: ${phrase}`);
    }
    const goldenTypes = (goldenCards.cards || []).map((card) => card.type).join('|');
    if (goldenTypes !== 'equation|derivation|dependency|confusion|note') failures.push(`golden quality cards should preserve ordered block types, got ${goldenTypes}`);

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Figure Failure Render', '--slug', 'figure-failure-render'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'figure-failure-render', '--type', 'start-here', '--title', 'Start Here', '--body', '## One-sentence orientation\n\nA paper shell.\n\n## Representative figure\n\nPaperMentor could not auto-attach the representative figure. Run crop preview and recrop manually.'], { cwd: temp, stdio: 'pipe' });
    const failureHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'figure-failure-render', 'index.html'), 'utf8');
    if (!failureHtml.includes('could not auto-attach the representative figure') || !failureHtml.includes('Run crop preview')) failures.push('renderer should keep visible auto-crop failure guidance when no figure is attached');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', figurePath, '--slug', 'figure-failure-launch', '--crop', '1,1,999999,999999', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const failureLaunchDir = join(temp, '.papermentor', 'sessions', 'figure-failure-launch');
    const failureLaunchHtml = readFileSync(join(failureLaunchDir, 'index.html'), 'utf8');
    const failureLaunchState = readJson(join(failureLaunchDir, 'state.json'), {});
    if (failureLaunchHtml.includes('Full-page visual fallback') || failureLaunchHtml.includes('class="paper-figure"')) failures.push('launch should not attach a full-page visual fallback after an extraction failure');
    if (failureLaunchHtml.includes(temp) || failureLaunchHtml.includes(figurePath) || failureLaunchHtml.includes(String(failureLaunchState.figureExtractionWarning || '___never___'))) failures.push('launch extraction failure guidance should hide absolute paths and raw diagnostic messages from HTML');
    if (!/No representative figure attached|Representative figure|Start Here pending/.test(failureLaunchHtml)) failures.push('launch extraction fallback should render a safe no-representative-figure/pending notice');

    const spacedFigurePath = join(temp, 'source with spaces.svg');
    writeFileSync(spacedFigurePath, readFileSync(figurePath, 'utf8'));
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', spacedFigurePath, '--slug', 'spaced-source-failure', '--crop', '1,1,999999,999999', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const spacedFailureHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'spaced-source-failure', 'index.html'), 'utf8');
    if (spacedFailureHtml.includes('Full-page visual fallback') || spacedFailureHtml.includes('node scripts/papermentor-session.mjs')) failures.push('launch extraction fallback should avoid full-page fallback and never show development script paths for sources with spaces');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Agent Automation Smoke', '--source', 'paper.pdf', '--slug', 'agent-automation-smoke', '--sections', '1. Introduction|2. Method', '--body-file', mapPath, '--figure-file', figurePath], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'agent-automation-smoke', '--index', '2'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'agent-automation-smoke', '--index', '1', '--generate'], {
      cwd: temp,
      stdio: 'pipe',
      env: { ...process.env, PAPERMENTOR_AGENT_MOCK: JSON.stringify(['Explain the drifting field term by term', 'Trace the training objective primitive steps', 'Ask anything about this']) }
    });
    let agentState = readJson(join(temp, '.papermentor', 'sessions', 'agent-automation-smoke', 'state.json'), {});
    if (agentState.pendingBlockPrompt || !agentState.nextChoices?.some((choice) => choice.includes('drifting field'))) failures.push('agent automation should replace the internal section-menu handoff with model-authored choices');
    if (agentState.nextChoices?.at(-1) !== 'Ask anything about this') failures.push('agent-authored section menus should end with the stable Ask anything about this action');
    const generatedBody = '## Term-by-term microscope\n\nThe selected method block explains the drifting field by naming the source sample, the target direction, and the update that connects them. It spells out each symbol before interpreting the objective, then checks that the reader can reconstruct why the field moves generated samples toward the data distribution. This text is intentionally long enough to prove the generated block path appends real teaching content rather than a placeholder.';
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'agent-automation-smoke', '--index', '1', '--generate'], {
      cwd: temp,
      stdio: 'pipe',
      env: { ...process.env, PAPERMENTOR_AGENT_MOCK: generatedBody }
    });
    agentState = readJson(join(temp, '.papermentor', 'sessions', 'agent-automation-smoke', 'state.json'), {});
    const agentHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'agent-automation-smoke', 'index.html'), 'utf8');
    const agentCards = readJson(join(temp, '.papermentor', 'sessions', 'agent-automation-smoke', 'cards.json'), { cards: [] });
    if (agentState.pendingBlockPrompt || !agentHtml.includes('Term-by-term microscope') || !agentCards.cards?.some((card) => card.title === 'Explain the drifting field term by term')) failures.push('agent automation should append selected explanation blocks to HTML without exposing prompt files');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Agent Failure Fallback Smoke', '--source', 'paper.pdf', '--slug', 'agent-failure-fallback', '--sections', '1. Method', '--body-file', mapPath], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'agent-failure-fallback', '--index', '1'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'agent-failure-fallback', '--index', '1', '--generate'], {
      cwd: temp,
      stdio: 'pipe',
      env: { ...process.env, PAPERMENTOR_AGENT: 'bogus' }
    });
    const fallbackState = readJson(join(temp, '.papermentor', 'sessions', 'agent-failure-fallback', 'state.json'), {});
    if (fallbackState.pendingBlockType !== 'section-menu' || !fallbackState.pendingBlockPrompt || !/Could not auto-generate/.test(fallbackState.tuiNotice || '') || !/did not change the HTML/i.test(fallbackState.tuiNotice || '')) failures.push('agent automation failure should keep an internal handoff, explicitly say HTML was unchanged, and return a friendly non-crashing state');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Provider Off Smoke', '--source', 'paper.pdf', '--slug', 'provider-off-smoke', '--sections', '1. Method', '--body-file', mapPath], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'provider-off-smoke', '--index', '1'], { cwd: temp, stdio: 'pipe' });
    const providerOffDir = join(temp, '.papermentor', 'sessions', 'provider-off-smoke');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'provider-off-smoke', '--index', '1', '--generate'], {
      cwd: temp,
      stdio: 'pipe',
      env: { ...process.env, PAPERMENTOR_AGENT: 'off' }
    });
    const providerOffState = readJson(join(providerOffDir, 'state.json'), {});
    const providerOffCards = readJson(join(providerOffDir, 'cards.json'), { cards: [] });
    if (!providerOffState.pendingProvider || providerOffState.pendingBlockPrompt || existsSync(join(providerOffDir, 'pending-prompt.md'))) failures.push('provider-off generated run should not leave a fake preparing prompt or pending prompt file');
    if (!/HTML/.test(providerOffState.tuiNotice || '') || !/변경되지 않았습니다|did not change/i.test(providerOffState.tuiNotice || '')) failures.push('provider-off generated run should explicitly say the HTML was not changed');
    if ((providerOffCards.cards || []).length !== 1) failures.push('provider-off generated run should not append an HTML block without a provider');

    try {
      await withTextServer(launchTextPath, async (port) => {
        const launchUrl = `http://127.0.0.1:${port}/launch-source.txt`;
        const launchArgs = (slug) => [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', launchUrl, '--slug', slug, '--no-figure', '--no-preview', '--allow-insecure-http'];
        await execFileAsync('node', launchArgs('launch-url-smoke'), { cwd: temp, timeout: 30000 });
        await execFileAsync('node', launchArgs('launch-url-smoke-2'), { cwd: temp, timeout: 30000 });
        const sourceFiles = readdirSync(join(temp, '.papermentor', 'sources')).filter((name) => name.endsWith('.txt'));
        if (sourceFiles.length !== 1) failures.push(`URL launch should reuse deterministic source cache, got ${sourceFiles.join(',')}`);
        const urlHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'launch-url-smoke', 'index.html'), 'utf8');
        if (urlHtml.includes('127.0.0.1') || urlHtml.includes('/launch-source.txt')) failures.push('URL launch HTML should not expose source URL or cached source path');
      });
    } catch (error) {
      if (error?.code === 'EPERM' || /listen EPERM/.test(error?.message || '')) console.warn(`[skip] URL launch smoke requires local listen permission: ${error.message}`);
      else throw error;
    }
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Generative Modeling via Drifting', '--authors', 'Mingyang Deng, He Li, Tianhong Li, Yilun Du, Kaiming He', '--source', 'paper.pdf', '--sections', '1. Introduction|2. Related Work|3. Drifting Models for Generation', '--body-file', mapPath, '--figure-file', figurePath, '--figure-caption', 'Exact crop of Figure 1 from the paper.'], { cwd: temp, stdio: 'pipe' });
    const recentOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'recent'], { cwd: temp, encoding: 'utf8' });
    if (!recentOutput.includes('Recent PaperMentor reading rooms') || recentOutput.includes('PaperMentor Launch setup') || recentOutput.includes('Auto-detect mode')) failures.push('pm recent should list rooms and must not be parsed as a source launch wizard');
    writeFileSync(join(temp, 'recent'), 'reserved-command-collision');
    const recentCollisionOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'recent'], { cwd: temp, encoding: 'utf8' });
    if (!recentCollisionOutput.includes('Recent PaperMentor reading rooms') || recentCollisionOutput.includes('PaperMentor Launch setup') || recentCollisionOutput.includes('Auto-detect mode')) failures.push('pm recent should remain a command even when a local file named recent exists');
    let navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.paperSections?.length !== 3 || navState.nextChoices?.[2] !== '3. Drifting Models for Generation') failures.push('start should seed detected paper sections for the CLI navigator');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'generative-modeling-via-drifting', '--index', '3'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.currentSection !== '3. Drifting Models for Generation' || !navState.nextChoices?.some((choice) => choice.includes('Show what I can learn here')) || navState.pendingBlockType !== 'section-menu') failures.push('section command should request a model-authored section menu instead of showing generic fallback actions');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'mode', '--session', 'generative-modeling-via-drifting', '--mode', 'equations', '--items', 'Explain Eq. (1) pushforward symbol by symbol|Explain Eq. (6) training objective symbol by symbol'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.currentMode !== 'equations' || navState.detectedItems?.length !== 2 || !navState.nextChoices?.[0]?.includes('Eq. (1)')) failures.push('mode command should store dynamic section-local equation choices');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'generative-modeling-via-drifting', '--paper-text-file', paperTextPath], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    // Paper section menus are model-authored from the section excerpt. The script must
    // not seed generic Map/Decode/Trace/Connect menus or word-matched/scored menus.
    for (const key of ['1-introduction', '2-related-work', '3-drifting-models-for-generation']) {
      const acts = navState.sectionActions?.[key] || [];
      if (acts.length) failures.push(`analyze should not seed script-authored paper section menus for ${key}`);
    }
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'generative-modeling-via-drifting', '--index', '3', '--choices', 'Explain Eq. (10): attraction minus repulsion|Ask anything about 3. Drifting Models for Generation'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.nextChoices?.[0] !== 'Explain Eq. (10): attraction minus repulsion') failures.push('section --choices should let the model set a tailored menu on entry (model-classified navigation)');
    if (navState.nextChoices?.at(-1) !== 'Ask anything about this') failures.push('section --choices should normalize legacy section-specific ask labels to Ask anything about this');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'generative-modeling-via-drifting', '--index', String(navState.nextChoices.length), '--generate'], { cwd: temp, stdio: 'pipe', env: { ...process.env, PAPERMENTOR_AGENT_MOCK: 'This mock should not be consumed when selecting Ask anything about this.' } });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.currentSection !== '3. Drifting Models for Generation' || navState.lastChoiceKind !== 'ask' || !navState.awaitingQuestion || navState.topicPickerOpen || navState.currentLocation === 'Paper section navigator') failures.push('selecting Ask anything about this should stay on the current section and wait for a free-form question');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'generative-modeling-via-drifting', '--paper-text-file', paperTextPath], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    const tuiSnapshot = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'tui', '--session', 'generative-modeling-via-drifting', '--snapshot'], { cwd: temp, encoding: 'utf8', env: internalSnapshotEnv });
    for (const phrase of ['✦ PaperMentor', 'Reading room', 'Room', 'Title:', 'Topic:', 'HTML:']) {
      if (!tuiSnapshot.includes(phrase)) failures.push(`TUI snapshot missing phrase: ${phrase}`);
    }
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'generative-modeling-via-drifting', '--index', '1'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    const sectionMenuPrompt = readFileSync(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'pending-prompt.md'), 'utf8');
    if (navState.lastChoiceKind !== 'section' || navState.pendingBlockType !== 'section-menu' || !sectionMenuPrompt.includes('PaperMentor Section Menu Prompt')) failures.push('run should select a section and write a pending section-menu prompt for model-authored choices');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'mode', '--session', 'generative-modeling-via-drifting', '--mode', 'equations', '--items', 'Explain Eq. (6) $(touch should-not-run) symbol by symbol|Ask anything about Eq. (6)'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'generative-modeling-via-drifting', '--index', '1'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    const pendingPrompt = readFileSync(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'pending-prompt.md'), 'utf8');
    if (!navState.pendingBlockPrompt || !pendingPrompt.includes('PaperMentor HTML Block Runner Prompt') || !pendingPrompt.includes('Template to follow')) failures.push('run command should write a pending HTML block-generation prompt for action choices');
    if (!pendingPrompt.includes("--title 'Explain Eq. (6) $(touch should-not-run) symbol by symbol'") || existsSync(join(temp, 'should-not-run'))) failures.push('runner prompt should shell-quote dynamic action titles without executing them');
    for (const phrase of ['Requested output language', 'output the clean rendered formula first', 'Preserve variables, subscripts, superscripts', 'Never invent terms or change the mathematical object']) {
      if (!pendingPrompt.includes(phrase)) failures.push(`equation runner prompt should prevent weak or inaccurate equation generation: ${phrase}`);
    }
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'extract-figure', '--session', 'generative-modeling-via-drifting', '--source', figurePath, '--title', 'Representative method crop', '--caption', 'Figure 1. Method loop.', '--body', '## Extracted visual explanation\n\n- **Question:** What is the method loop?\n- **Concept:** generator-to-drift target.\n- **What to observe:** the generator is trained against a target.\n- **Conclusion:** this figure anchors the method explanation.'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.pendingBlockPrompt || existsSync(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'pending-prompt.md'))) failures.push('adding a card should clear consumed pending runner prompt state');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Korean Equation Prompt', '--source', 'paper.pdf', '--slug', 'korean-equation-prompt', '--language', 'ko', '--sections', '1. Method', '--body', '## One-sentence orientation\n\n정책 수식을 읽는 방입니다.\n\n## Preliminary\n\n정책과 loss를 구분합니다.'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'mode', '--session', 'korean-equation-prompt', '--mode', 'equations', '--items', 'Explain Eq. (1) policy objective'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'korean-equation-prompt', '--index', '1'], { cwd: temp, stdio: 'pipe' });
    const koreanPrompt = readFileSync(join(temp, '.papermentor', 'sessions', 'korean-equation-prompt', 'pending-prompt.md'), 'utf8');
    for (const phrase of ['Requested output language: Korean', 'Use Korean as the main prose language', 'write the explanation body in natural Korean', 'output the clean rendered formula first']) {
      if (!koreanPrompt.includes(phrase)) failures.push(`Korean equation prompt should preserve Korean output and exact-equation contract: ${phrase}`);
    }
    const nestedFigureBody = join(temp, 'nested-figure-body.md');
    writeFileSync(nestedFigureBody, 'This block keeps its visual reading under the image.\n\n## Representative figure explanation\n\n### Concept / method role\n\nNested role survives under the figure.\n\n### Flow / sequence\n\nNested flow survives under the figure.');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'generative-modeling-via-drifting', '--type', 'note', '--title', 'Nested figure explanation smoke', '--figure-file', figurePath, '--body-file', nestedFigureBody], { cwd: temp, stdio: 'pipe' });
    const nestedFigureHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'index.html'), 'utf8');
    if (!nestedFigureHtml.includes('Nested role survives under the figure') || !nestedFigureHtml.includes('Nested flow survives under the figure')) failures.push('figure explanations with nested headings should render under the image, not disappear');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'extract-figure', '--session', 'generative-modeling-via-drifting', '--source', figurePath, '--title', 'Representative method crop', '--caption', 'Figure 1. Method loop.', '--body', '## Extracted visual explanation\n\n- **Question:** What changed?\n- **Concept:** repeated crop.\n- **What to observe:** filename remains unique.\n- **Conclusion:** older cards are not overwritten.'], { cwd: temp, stdio: 'pipe' });
    const dir = join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting');
    for (const rel of ['index.html', 'state.json', 'cards.json', 'turns.jsonl', 'notes.md']) {
      if (!existsSync(join(dir, rel))) failures.push(`session helper missing ${rel}`);
    }
    const htmlFilesAfterFirst = readdirSync(dir).filter((name) => name.endsWith('.html'));
    if (htmlFilesAfterFirst.length !== 1 || htmlFilesAfterFirst[0] !== 'index.html') failures.push(`session helper should create exactly one HTML file, got ${htmlFilesAfterFirst.join(',')}`);
    let html = readFileSync(join(dir, 'index.html'), 'utf8');
    let cardData = readJson(join(dir, 'cards.json'), { cards: [] });
    if (!html.includes('Mingyang Deng, He Li, Tianhong Li, Yilun Du, Kaiming He')) failures.push('session title header should show paper authors');
    if (html.includes('paper.pdf') || html.includes('paper-source')) failures.push('session title header should not expose source file paths under the title');
    if ((html.match(/class="block"/g) || []).length < 1) failures.push('session helper should render at least one block after first card');
    if (!html.includes('assets/mathjax/tex-svg.js') || html.includes('cdn.jsdelivr.net/npm/mathjax')) failures.push('session HTML should use local bundled MathJax, not CDN');
    if (!existsSync(join(dir, 'assets', 'mathjax', 'tex-svg.js'))) failures.push('session should copy local MathJax bundle into report assets');
    for (const phrase of [`Main ${'method'} figure`, 'Figure explanation under image']) {
      if (html.includes(phrase)) failures.push(`session paper map should move the figure explanation under the image and remove the body heading: ${phrase}`);
    }
    if (!html.includes('class="paper-figure"') || !html.includes('<img src="assets/')) failures.push('session paper map should render the actual method figure image');
    if (!html.includes('fitPaperMentorStartFigure') || !html.includes('--papermentor-start-image-max-height') || !html.includes('--papermentor-start-figure-max-width')) failures.push('session report should include dynamic first-page figure fitting for PDF export');
    if (html.includes('loading="lazy"')) failures.push('session report figures should load eagerly for reliable browser screenshots and first-open rendering');
    if (!(html.indexOf('One-sentence paper model') < html.indexOf('class="paper-figure"') && html.indexOf('class="paper-figure"') < html.indexOf('Preliminary'))) failures.push('Start Here should render one-sentence model first, then representative figure, then preliminaries');
    for (const phrase of ['Figure 1', 'Concept / method role', 'How to read it', 'Parts to identify', 'In-figure math / symbols', 'Flow / sequence', 'What to observe', 'Equations / claims it supports']) {
      if (!html.includes(phrase)) failures.push(`session paper map should render figure explanation under image: ${phrase}`);
    }
    for (const phrase of ['Exact crop of Figure 1 from the paper.', 'Figure from the paper.']) {
      if (html.includes(phrase)) failures.push(`session paper map should suppress provenance-only figure captions: ${phrase}`);
    }
    for (const rel of ['assets/fonts/satoshi/Satoshi-400.woff2', 'assets/fonts/pretendard/PretendardVariable.woff2']) {
      if (!existsSync(join(dir, rel))) failures.push(`session helper should copy bundled report font into session: ${rel}`);
    }
    for (const phrase of ['assets/fonts/satoshi/Satoshi-400.woff2', 'assets/fonts/pretendard/PretendardVariable.woff2']) {
      if (!html.includes(phrase)) failures.push(`session HTML should load local bundled font: ${phrase}`);
    }
    for (const phrase of ['api.fontshare.com', 'orioncactus/pretendard/dist/web/static/pretendard.css', 'cdn.jsdelivr.net/npm/mathjax']) {
      if (html.includes(phrase)) failures.push(`session HTML should not depend on remote font CSS: ${phrase}`);
    }
    if (!cardData.cards?.[0]?.figure?.src?.startsWith('assets/')) failures.push('session card should persist copied figure asset metadata');
    if (!existsSync(join(dir, cardData.cards?.[0]?.figure?.src || 'missing'))) failures.push('session helper should copy figure file into session assets');
    cardData.cards[0].figure.caption = 'Exact crop of Figure 1 from the paper: legacy caption.';
    writeFileSync(join(dir, 'cards.json'), `${JSON.stringify(cardData, null, 2)}\n`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'status', '--session', 'generative-modeling-via-drifting'], { cwd: temp, stdio: 'pipe' });
    html = readFileSync(join(dir, 'index.html'), 'utf8');
    if (html.includes('Exact crop of Figure 1 from the paper: legacy caption.')) failures.push('session renderer should suppress provenance-only captions already stored in legacy cards.json');
    const notes = readFileSync(join(dir, 'notes.md'), 'utf8');
    if (!notes.includes('![Start Here figure](assets/')) failures.push('session notes should include the attached figure link');
    if (notes.includes('Exact crop of Figure 1 from the paper.')) failures.push('session notes should suppress provenance-only figure captions');
    if (notes.includes('## Figure explanation under image')) failures.push('session notes should move the figure explanation under the image and remove the heading');
    const renderOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'render', '--session', 'generative-modeling-via-drifting'], { cwd: temp, encoding: 'utf8' });
    if (!renderOutput.includes('.papermentor/sessions/generative-modeling-via-drifting/index.html')) failures.push('render command should print the refreshed block document path');
    const stateOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'state', '--session', 'generative-modeling-via-drifting'], { cwd: temp, encoding: 'utf8' });
    for (const phrase of ['PaperMentor state', 'Location', 'Blocks in HTML', 'Source mode:']) {
      if (!stateOutput.includes(phrase)) failures.push(`state command should print Reading Console phrase: ${phrase}`);
    }
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'pause', '--session', 'generative-modeling-via-drifting', '--question', 'Why does Eq. (6) freeze the target branch?'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    const pausePrompt = readFileSync(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'pending-prompt.md'), 'utf8');
    if (!navState.pausedReading?.location || !pausePrompt.includes('Answer interruption: Why does Eq. (6) freeze the target branch?')) failures.push('pause command should preserve reading location and write a pending interruption prompt');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'resume', '--session', 'generative-modeling-via-drifting', '--repaired', 'stop-gradient target branch'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.pausedReading || existsSync(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'pending-prompt.md')) || !navState.currentFocus?.includes('Resumed from')) failures.push('resume command should restore the paused location and clear pending interruption state');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'generative-modeling-via-drifting', '--index', '3'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'diagram', '--session', 'generative-modeling-via-drifting', '--kind', 'equation-dependency', '--nodes', 'Eq. (1) pushforward|Eq. (2) drift update|Eq. (6) training objective'], { cwd: temp, stdio: 'pipe' });
    let diagramHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'index.html'), 'utf8');
    let diagramCards = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'cards.json'), { cards: [] });
    const diagramCard = diagramCards.cards?.find((card) => card.type === 'concept-diagram');
    if (!diagramCard?.figure?.src?.endsWith('.svg')) failures.push('diagram command should create a concept-diagram card with an SVG figure');
    if (diagramHtml.includes('mermaid')) failures.push('diagram command should not use Mermaid');
    for (const phrase of ['Conceptual diagram generated by PaperMentor', 'Not a figure from the paper', 'Question', 'Visual encoding', 'What to observe', 'Conclusion', 'Limitation']) {
      if (!diagramHtml.includes(phrase)) failures.push(`diagram block missing required phrase: ${phrase}`);
    }

    const badDiagramPath = join(temp, 'bad-mermaid.md');
    writeFileSync(badDiagramPath, `${'```'}${'mermaid'}\n${'flowchart'} ${'TD'}\nA-->B\n${'```'}\n`);
    try {
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'generative-modeling-via-drifting', '--type', 'paper-map', '--title', 'Bad diagram substitute', '--body-file', badDiagramPath], { cwd: temp, stdio: 'pipe' });
      failures.push('session helper should reject Mermaid/flowchart diagram substitutes in report bodies');
    } catch {
      // expected: representative figures must be actual crops/screenshots or prose, not Mermaid substitutes.
    }

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'turn', '--session', 'generative-modeling-via-drifting', '--role', 'user', '--text', '전체 흐름이 안 보여. Eq. (1)이 Eq. (6)이랑 어떻게 연결돼?', '--promote', '--reason', 'paper equation confusion'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (!navState.nextChoices?.some((choice) => choice.includes('Generate conceptual diagram'))) failures.push('turn logging should suggest visual repair when user confusion asks for flow/dependency');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'turn', '--session', 'generative-modeling-via-drifting', '--role', 'assistant', '--text', 'It freezes the drift target branch so the generator output moves toward a fixed target.', '--promote', '--saved-as', 'confusion-003'], { cwd: temp, stdio: 'pipe' });
    const turns = readFileSync(join(dir, 'turns.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    if (turns.length !== 2 || turns[0].promotion !== 'promote' || turns[1].savedAs !== 'confusion-003') failures.push('turns.jsonl should record promoted user/assistant turns with metadata');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'generative-modeling-via-drifting', '--type', 'equation', '--title', 'Equation (6)', '--latex', '\mathcal{L}=\mathbb{E}\|x-\operatorname{stopgrad}(x+V_{p,q}(x))\|^2', '--user-question', 'Why is stopgrad used in Eq. (6)?', '--origin-turn', 'turn-001', '--promotion-reason', 'paper equation confusion', '--body-file', equationPath, '--choices', 'Trace derivation|Explain stopgrad'], { cwd: temp, stdio: 'pipe' });
    const htmlFiles = readdirSync(dir).filter((name) => name.endsWith('.html'));
    if (htmlFiles.length !== 1 || htmlFiles[0] !== 'index.html') failures.push(`session helper should keep exactly one HTML file, got ${htmlFiles.join(',')}`);
    html = readFileSync(join(dir, 'index.html'), 'utf8');
    cardData = readJson(join(dir, 'cards.json'), { cards: [] });
    if ((cardData.cards || []).length !== 6) failures.push('session helper should persist six cards after repeated extraction, nested figure, diagram, and equation card');
    for (const requiredField of ['id', 'type', 'title', 'location', 'userQuestion', 'originTurn', 'promotionReason', 'body', 'choices', 'createdAt']) {
      if (!(requiredField in (cardData.cards?.[0] || {}))) failures.push(`session card should keep structured report field: ${requiredField}`);
    }
    if (!cardData.schema || !cardData.cards?.[0]?.figure?.src) failures.push('session cards.json should keep schema and figure asset data');
    const extractedFigureSrcs = (cardData.cards || []).filter((card) => card.title === 'Representative method crop').map((card) => card.figure?.src).filter(Boolean);
    if (new Set(extractedFigureSrcs).size !== extractedFigureSrcs.length) failures.push('repeated extract-figure calls should create unique asset filenames, not overwrite older cards');
    if (cardData.cards?.[5]?.userQuestion !== 'Why is stopgrad used in Eq. (6)?' || cardData.cards?.[5]?.originTurn !== 'turn-001') failures.push('promoted conversation cards should persist user question and origin turn metadata');
    if ((html.match(/class="block"/g) || []).length !== 6) failures.push('session helper should render six blocks after repeated extraction, nested figure, diagram, and equation card');
    for (const phrase of ['MathJax', 'Generative Modeling via Drifting', 'Equation block — Eq. (6)', 'User question', 'Why is stopgrad used in Eq. (6)?', 'class="user-question"', 'class="paper-title"', 'class="block"', 'class="paper-figure"', 'data-index="1"', 'data-index="2"', 'data-index="3"', 'data-index="4"', 'data-index="5"', 'data-index="6"']) {
      if (!html.includes(phrase)) failures.push(`session block document missing ${phrase}`);
    }
    for (const phrase of ['Reading Path', 'Choose next', 'class="sidebar"', 'class="topbar"', 'session-head', 'CLI-only likely confusion points', 'Likely blockers', 'This should stay in CLI/state', 'This should also stay in CLI/state', 'Block 01', 'Block 02', 'updated ']) {
      if (html.includes(phrase)) failures.push(`session block document should not render CLI-only content, timestamps, block badges, or dashboard chrome: ${phrase}`);
    }
    if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(html)) failures.push('session block document should not display ISO timestamps');

    const koreanMapPath = join(temp, 'korean-map.md');
    const koreanEquationPath = join(temp, 'korean-equation.md');
    writeFileSync(koreanMapPath, '## 이 논문이 하는 일\n\n이 논문은 생성 분포 $q_i$가 학습 중에 데이터 분포 $p_{\\mathrm{data}}$ 쪽으로 이동하도록 generator $f$를 훈련한다.\n\n## 그림 설명\n\n- 그림 / 위치: Figure 1, Drifting Model.\n- 무엇을 보여주는가: 주황색 생성 분포 $q_i$가 학습 반복마다 파란색 데이터 분포 $p_{\\mathrm{data}}$에 가까워지는 과정을 보여준다.\n- 보는 법: 왼쪽 prior, 가운데 generator $f$, 오른쪽 데이터 분포 $p_{\\mathrm{data}}$ 세 부분으로 읽는다.\n- 그림 속 수식 / 기호: 그림 안에 pushforward $q=f_{\\#}p_{\\mathrm{prior}}$와 화살표 위의 drift field $V_{p,q}(x)$가 적혀 있다.\n- 흐름 / 순서: prior에서 샘플을 뽑고 → $f$로 pushforward 분포를 만들고 → drift field로 이동 방향을 정하고 → $f$를 업데이트한다.\n- 관찰할 점: inference 때 반복 샘플러를 돌리는 것이 아니라, 학습 중 $f$ 자체가 반복적으로 바뀐다는 점이다.\n- 연결되는 수식 / 주장: $q=f_{\\#}p_{\\mathrm{prior}}$, 분포열 $\\{q_i\\}$, 그리고 drift가 0에 가까워지게 만드는 training objective.\n\n## 핵심 객체\n\n- $p_{\\mathrm{prior}}$ — 생성 전에 샘플링하는 source distribution.\n- $f$ — prior sample을 데이터 공간으로 보내는 generator.\n- $V_{p,q}(x)$ — 현재 샘플 $x$를 어느 방향으로 움직일지 알려주는 drift field.\n\n## 의존성 체인\n\n1. pushforward $q=f_{\\#}p_{\\mathrm{prior}}$를 이해한다.\n2. 학습을 분포열 $q_1,q_2,\\ldots$의 변화로 본다.\n3. drift field $V_{p,q}(x)$가 왜 필요한지 연결한다.\n');
    writeFileSync(koreanEquationPath, '## 수식이 하는 일\n\n이 블록은 training objective이 왜 등장하는지 설명한다. $V_{p,q}(x)$는 이동 목표를 만들고, $\\operatorname{stopgrad}$는 그 목표 쪽으로 gradient가 새지 않도록 고정한다.\n\n## 기호 역할\n\n- $x$ — 현재 generator가 만든 sample.\n- $V_{p,q}(x)$ — sample을 이동시키는 drift vector.\n- $\\|\\cdot\\|_2^2$ — 이동 목표와 현재 sample 사이의 제곱 거리.\n');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', '드리프팅을 통한 생성 모델링', '--source', 'https://arxiv.org/pdf/2602.04770', '--slug', 'korean-report'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'korean-report', '--type', 'paper-map', '--title', '논문 지도', '--figure-file', figurePath, '--figure-caption', 'Figure 1. Drifting Model.', '--body-file', koreanMapPath, '--choices', '수식 (6) 설명|stopgrad 설명|의존성 추적'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'korean-report', '--type', 'equation', '--title', 'Training objective — Eq. (6)', '--latex', '\mathcal{L}=\\mathbb{E}\\left[\\left\\|x-\\operatorname{stopgrad}(x+V_{p,q}(x))\\right\\|_2^2\\right]', '--body-file', koreanEquationPath, '--choices', '유도 추적|기호 설명'], { cwd: temp, stdio: 'pipe' });
    const koreanDir = join(temp, '.papermentor', 'sessions', 'korean-report');
    const koreanHtml = readFileSync(join(koreanDir, 'index.html'), 'utf8');
    const koreanCards = readJson(join(koreanDir, 'cards.json'), { cards: [] });
    const koreanNotes = readFileSync(join(koreanDir, 'notes.md'), 'utf8');
    for (const phrase of ['<html lang="ko"', 'Satoshi', 'Pretendard', 'assets/fonts/satoshi/Satoshi-400.woff2', 'assets/fonts/pretendard/PretendardVariable.woff2', ':lang(ko)', 'word-break:keep-all']) {
      if (!koreanHtml.includes(phrase)) failures.push(`Korean report should load/apply report typography: ${phrase}`);
    }
    for (const rel of ['assets/fonts/satoshi/Satoshi-400.woff2', 'assets/fonts/pretendard/PretendardVariable.woff2']) {
      if (!existsSync(join(koreanDir, rel))) failures.push(`Korean report should have local bundled font asset: ${rel}`);
    }
    for (const phrase of ['api.fontshare.com', 'orioncactus/pretendard/dist/web/static/pretendard.css', 'cdn.jsdelivr.net/npm/mathjax']) {
      if (koreanHtml.includes(phrase)) failures.push(`Korean report should not depend on remote font CSS: ${phrase}`);
    }
    const awkwardObjective = '학습' + ' ' + '목적' + '식';
    for (const phrase of ['그림 설명', 'Figure explanation under image', `Main ${'method'} figure`, awkwardObjective, `목적${'식'} — Eq. (6)`]) {
      if (koreanHtml.includes(phrase)) failures.push(`Korean report should remove headings/provenance/awkward terms: ${phrase}`);
    }
    for (const phrase of ['주황색 생성 분포', '개념 / 방법 역할', '보는 법', '그림 속 수식 / 기호', '흐름 / 순서', '관찰할 점', '연결되는 수식 / 주장', 'Training objective — Eq. (6)', 'training objective', 'gradient']) {
      if (!koreanHtml.includes(phrase)) failures.push(`Korean report should keep structured Korean explanation content and standard English terms: ${phrase}`);
    }
    if ((koreanHtml.match(/class="block"/g) || []).length !== 2) failures.push('Korean report should render two ordered report blocks');
    if ((koreanHtml.match(/<ol>/g) || []).length < 1) failures.push('Korean report should render ordered dependency lists structurally');
    if (koreanCards.cards?.length !== 2 || koreanCards.cards?.[0]?.type !== 'paper-map' || koreanCards.cards?.[1]?.type !== 'equation') failures.push('Korean cards.json should keep ordered structured card types');
    if (!koreanNotes.includes('보는 법') || koreanNotes.includes('## 그림 설명')) failures.push('Korean notes.md should mirror figure explanation under the image without the heading');
    const exportZip = join(temp, 'korean-report-export.zip');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'export', '--session', 'korean-report', '--output', exportZip, '--overwrite'], { cwd: temp, stdio: 'pipe' });
    if (!existsSync(exportZip) || statSync(exportZip).size < 1000) failures.push('export command should write a non-empty portable report zip');
    const zipList = execFileSync('python3', ['-c', 'import sys,zipfile; print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', exportZip], { encoding: 'utf8' });
    for (const rel of ['index.html', 'assets/mathjax/tex-svg.js', 'assets/fonts/pretendard/PretendardVariable.woff2', 'cards.json', 'notes.md', 'state.json']) {
      if (!zipList.includes(rel)) failures.push(`export zip missing ${rel}`);
    }
    if (zipList.includes('paper.pdf') || zipList.includes('source.pdf')) failures.push('export zip should not include original source PDF by default');
  } catch (error) {
    failures.push(`session helper smoke failed: ${error.message}`);
  } finally {
    if (process.env.PAPERMENTOR_KEEP_VALIDATE_TEMP) console.warn(`[keep] session temp: ${temp}`);
    else rmSync(temp, { recursive: true, force: true });
  }
}

function validateSourceModes() {
  const temp = mkdtempSync(join(tmpdir(), 'papermentor-modes-'));
  try {
    const slideText = join(temp, 'slides.txt');
    const paperText = join(temp, 'paper.txt');
    writeFileSync(slideText, `Slide 1: Sequence Modeling and Transformers
- Robot learning needs policies over observation-action histories.
- Attention lets a model select relevant tokens.

Slide 2: Decision Transformer
- Treat reinforcement learning as sequence modeling.
- Return-to-go conditions the action sequence.
- Return-to-go is G_t = r_t + r_{t+1} + ...
- Citation: Chen et al., 2021.

Slide 3: Transformer Policy Diagram
- image tokens -> encoder -> action decoder
- arrows show information flow
- robot trajectory visual

Slide 4: Missing Narration
- Why this matters for imitation learning
- How the architecture connects to behavior cloning`);
    writeFileSync(paperText, `Abstract
We propose a method for generative modeling.

1. Introduction
This paper introduces a pushforward distribution and a drift field.

2. Method
The pushforward distribution is q=f#p. (1) The training objective uses stopgrad. (6)

3. Experiments
FID and ablations evaluate sample quality.`);

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Robot Learning Transformer Slides', '--source', 'lecture-slides.pdf', '--slug', 'robot-slides'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'robot-slides', '--paper-text-file', slideText], { cwd: temp, stdio: 'pipe' });
    let state = readJson(join(temp, '.papermentor', 'sessions', 'robot-slides', 'state.json'), {});
    if (state.sourceMode !== 'slide') failures.push(`slide source mode not detected: ${state.sourceMode}`);
    const slideActions = Object.values(state.sectionActions || {}).flat();
    for (const phrase of ['Reconstruct the', 'builds on the earlier slides', 'Continue to the next slide', 'Ask anything about']) {
      if (!slideActions.some((action) => action.includes(phrase))) failures.push(`slide actions missing ${phrase}`);
    }
    const slideTui = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'tui', '--session', 'robot-slides', '--snapshot'], { cwd: temp, encoding: 'utf8', env: internalSnapshotEnv });
    if (!slideTui.includes('Slides') || !slideTui.includes('✦ PaperMentor') || !slideTui.includes('Reading room')) failures.push('slide TUI should show the slide reading room');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'robot-slides', '--index', '2', '--choices', 'Slide 2의 긴 한국어 설명 선택지가 좁은 터미널에서도 화면 높이를 넘지 않아야 한다|AlphaGo와 Gemini 같은 Recent AI Advances가 로봇 정책 학습 논의에 어떻게 연결되는지 해석하기|Open X-Embodiment와 RT-X가 데이터 스케일링 문제에 어떤 답을 주는지 미리 보기|robotics as multimodal sequence modeling이라는 핵심 아이디어가 관측 언어 행동을 어떻게 묶는지 설명하기|Ask anything about Slide 2'], { cwd: temp, stdio: 'pipe' });
    state = readJson(join(temp, '.papermentor', 'sessions', 'robot-slides', 'state.json'), {});
    if (state.nextChoices?.at(-1) !== 'Ask anything about this' || state.topicPickerOpen || state.lastChoiceKind !== 'section') failures.push('slide section menus should normalize their free-form chat choice to Ask anything about this and stay inside the selected section');
    const compactSlideTui = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'tui', '--session', 'robot-slides', '--snapshot', '--cursor', '3'], { cwd: temp, encoding: 'utf8', env: { ...process.env, PAPERMENTOR_INTERNAL_SNAPSHOT: '1', COLUMNS: '80', LINES: '20' } });
    if (visibleLineCount(compactSlideTui) > 20) failures.push('compact slide TUI should cap rendered rows to the terminal height even when Korean menu items wrap');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'robot-slides', '--index', '2'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'robot-slides', '--index', '3'], { cwd: temp, stdio: 'pipe' });
    const slidePendingActionPrompt = readFileSync(join(temp, '.papermentor', 'sessions', 'robot-slides', 'pending-prompt.md'), 'utf8');
    if (!slidePendingActionPrompt.includes('Source excerpt for this selected range') || !slidePendingActionPrompt.includes('G_t = r_t')) failures.push('slide action prompt should include the selected slide range text/equation preview');
    const slideBodyPath = join(temp, 'slide-explanation.md');
    writeFileSync(slideBodyPath, '## Slide role\n\nExplain the Transformer policy diagram.');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'robot-slides', '--type', 'slide-explanation', '--title', 'Slide explanation — Transformer policy diagram', '--body-file', slideBodyPath], { cwd: temp, stdio: 'pipe' });
    state = readJson(join(temp, '.papermentor', 'sessions', 'robot-slides', 'state.json'), {});
    if (state.readingPath?.find((item) => item.key === 'slides')?.status !== 'done') failures.push('slide slide explanation should complete the slides reading-path step');
    if (state.readingPath?.find((item) => item.key === 'narration')?.status !== 'current') failures.push('slide slide explanation should advance to missing narration');
    const fencedCodeBodyPath = join(temp, 'slide-fenced-code.md');
    writeFileSync(fencedCodeBodyPath, '## Sequence view\n\n```text\nobservation sequence + language/task condition + action sequence\n```\n\nThe prose after the fence must render as prose, not as code.');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'robot-slides', '--type', 'note', '--title', 'Fenced code rendering smoke', '--body-file', fencedCodeBodyPath], { cwd: temp, stdio: 'pipe' });
    const fencedCodeHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'robot-slides', 'index.html'), 'utf8');
    if (!fencedCodeHtml.includes('<pre class="code-block"><code class="language-text">observation sequence + language/task condition + action sequence</code></pre>') || fencedCodeHtml.includes('<p>```text</p>')) failures.push('markdown fenced code blocks should render as code blocks, not visible fence paragraphs');
    const freeQuestion = 'multimodal sequence modeling이 어떻게 이루어지는거야?';
    const freeAnswer = '## Direct answer\n\nMultimodal sequence modeling turns the selected robot-learning range into a single ordered prediction problem. The observation tokens describe what the robot sees, the language tokens condition the task, and the action tokens describe what the robot should do next. A policy can then model $p(a_t \mid o_{\le t}, x)$ and break down each term: $o_{\le t}$ carries visual and proprioceptive history, $x$ carries the task instruction, and $a_t$ is the next command. This answer is intentionally long enough to prove that a free-form question is answered and appended as a real HTML block rather than bouncing back to the topic picker.';
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'ask', '--session', 'robot-slides', freeQuestion], { cwd: temp, stdio: 'pipe', env: { ...process.env, PAPERMENTOR_AGENT_MOCK: freeAnswer } });
    const askedHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'robot-slides', 'index.html'), 'utf8');
    const askedCards = readJson(join(temp, '.papermentor', 'sessions', 'robot-slides', 'cards.json'), { cards: [] });
    if (!askedHtml.includes('class="user-question"') || !askedHtml.includes(freeQuestion) || !askedHtml.includes('Direct answer') || !askedCards.cards.some((card) => card.userQuestion === freeQuestion && card.type === 'confusion')) failures.push('free-form Ask anything questions should generate a PaperMentor answer card with the user question preserved in HTML');

    const numberedOnlySlideText = join(temp, 'numbered-only-slides.txt');
    writeFileSync(numberedOnlySlideText, `Slide 1: Convex Optimization
- Why convexity matters.

Slide 2: 1. Introduction
- Optimization problem form.

Slide 3: Optimization problem
- minimize f_0(x) subject to f_i(x) <= 0.

Slide 4: Summary
- Convex problems can be solved reliably.

Slide 5: 2. Convex sets
- Sets closed under convex combinations.

Slide 6: Convex set
- theta x + (1-theta)y stays in C.`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Numbered Only Slides', '--source', 'numbered-only-slides.pdf', '--slug', 'numbered-only-slides', '--mode', 'slide'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'numbered-only-slides', '--mode', 'slide', '--paper-text-file', numberedOnlySlideText], { cwd: temp, stdio: 'pipe' });
    state = readJson(join(temp, '.papermentor', 'sessions', 'numbered-only-slides', 'state.json'), {});
    if (state.paperSections?.some((section) => /^Slides 2–4 — 1\. Introduction|^Slides 5–6 — 2\. Convex sets/.test(section))) failures.push('slide grouping should not infer semantic sections from numbered titles; the LLM regroup prompt owns that judgment');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Method Paper', '--source', 'paper.pdf', '--slug', 'method-paper'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'method-paper', '--paper-text-file', paperText], { cwd: temp, stdio: 'pipe' });
    state = readJson(join(temp, '.papermentor', 'sessions', 'method-paper', 'state.json'), {});
    if (state.sourceMode !== 'paper') failures.push(`paper source mode not detected: ${state.sourceMode}`);

    const repoText = ['README.md', 'SKILL.md', 'skills/papermentor/SKILL.md', 'skills/papermentor/commands.md'].map((rel) => readFileSync(join(root, rel), 'utf8')).join('\n').toLowerCase();
  } catch (error) {
    failures.push(`source mode smoke failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function commandAvailable(name) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function validateAllBlockTypes() {
  const temp = mkdtempSync(join(tmpdir(), 'papermentor-all-blocks-'));
  try {
    const figurePath = join(temp, 'representative-figure.svg');
    writeFileSync(figurePath, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 260"><rect width="720" height="260" fill="#fffef9"/><rect x="50" y="52" width="150" height="74" fill="#eef2f8" stroke="#405f9f"/><rect x="286" y="52" width="150" height="74" fill="#fff" stroke="#405f9f"/><rect x="520" y="52" width="150" height="74" fill="#eef2f8" stroke="#405f9f"/><path d="M214 89h58M450 89h58" stroke="#405f9f" stroke-width="4"/><text x="125" y="95" text-anchor="middle" font-family="Arial" font-size="18">prior</text><text x="361" y="95" text-anchor="middle" font-family="Arial" font-size="18">generator</text><text x="595" y="95" text-anchor="middle" font-family="Arial" font-size="18">data</text><text x="54" y="210" font-family="Times New Roman" font-size="16">Figure 1: representative method fixture</text></svg>');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Block Coverage Report', '--source', 'fixture-paper.pdf', '--slug', 'block-coverage-report'], { cwd: temp, stdio: 'pipe' });
    const bodies = {
      'paper-map': '## What this paper is doing\n\nThe paper trains a generator by moving samples toward a target distribution.\n\n## Figure explanation under image\n\n- Figure / location: Figure 1.\n- Why this is the representative figure: it shows the method flow rather than experiment results.\n- What it shows: prior samples pass through a generator and approach the data distribution.\n- Flow or sequence: prior sample → generator → pushforward distribution → data target.\n- What to observe: training changes the generator, not an inference-time sampler.\n- Equations or claims it supports: Eq. (6).',
      prerequisite: '## Target concept\n\nDrift field $V_{p,q}(x)$.\n\n## Ladder\n\n### 1. Distribution $q$\n\nUnderstand a distribution $q$.\n\n### 2. Pushforward $q=f_{\\#}p_{\\mathrm{prior}}$\n\nUnderstand how a function moves a prior distribution.\n\n### 3. Vector field $V_{p,q}(x)$\n\nUnderstand the direction assigned to each generated sample.\n\n## Readiness check\n\nYou should be able to say what object moves and what defines the direction.',
      method: '## Method mechanism\n\n1. Sample $z\\sim p_{\\mathrm{prior}}$.\n2. Produce $x=f(z)$.\n3. Estimate $V_{p,q}(x)$.\n4. Update $f$ against the training objective.\n\n## Method-level final insight\n\nThe method learns a one-pass generator by turning distribution matching into a drift target.',
      equation: '## Equation role\n\nThis training objective makes the generator output imitate a stop-gradient drift target.\n\n## Symbol roles\n\n- $x$ — generated sample.\n- $V_{p,q}(x)$ — drift vector.\n- $\\operatorname{stopgrad}$ — fixed target operator.',
      derivation: '## Transition\n\n### Previous equation\n\n$$x^{+}=x+V_{p,q}(x)$$\n\n### Next equation\n\n$$\\mathcal{L}=\\mathbb{E}\\left[\\left\\|x-\\operatorname{stopgrad}(x^{+})\\right\\|_2^2\\right]$$\n\n- Operation: substitute $x^{+}$.\n- Property used: definition of the drift target.\n- Assumption invoked: target is fixed by $\\operatorname{stopgrad}$.\n- Why valid: the target branch should not receive gradient.',
      dependency: '## Backward dependencies\n\n- Definition of pushforward.\n- Definition of drift field.\n- Stop-gradient training target.\n\n## Forward dependencies\n\n- Training objective.\n- Equilibrium claim.\n\n## Missing dependency check\n\nThe reader must know why $q=p_{\\mathrm{data}}$ implies near-zero drift.',
      proof: '## Claim statement\n\nAt equilibrium, the drift objective is minimized.\n\n## Notation and objects\n\n$q$ is the generated distribution, $p_{\\mathrm{data}}$ is fixed, and $V_{p,q}(x)$ is the drift vector averaged over generated samples.\n\n## Line transition microscope\n\n### Transition 1 → 2\n\nPrevious line:\n\n$$q=p_{\\mathrm{data}}$$\n\nNext line:\n\n$$V_{p,q}(x)\\approx 0$$\n\nWhat changed: substitute the equilibrium distribution into the drift definition; the density mismatch term cancels, so the expected vector field vanishes.\n\n## Cancellation / substitution audit\n\nThe substituted definition is $q=p_{\\mathrm{data}}$; the recognized expectation is over $x\\sim q$.\n\n## Reconstruction checkpoint\n\nThe reader should be able to explain why matching distributions removes the drift signal.',
      confusion: '## Paused location\n\nEq. (6), inside $\\operatorname{stopgrad}(x+V_{p,q}(x))$.\n\n## Missing dependency\n\nThe user is missing why the target branch is frozen.\n\n## Minimal example\n\nIf both prediction and target move together, the loss can collapse without learning the intended direction.\n\n## Resume point\n\nReturn to Eq. (6) and trace which side receives gradient.',
      'recursive-why': '## Recursive why\n\n| Layer | Why question | Answer | Missing dependency | Stop? |\n| --- | --- | --- | --- | --- |\n| 1 | Why stopgrad? | Freeze target. | gradient flow | no |\n| 2 | Why freeze target? | Avoid chasing a moving target. | optimization objective | yes |\n\n## Root dependency\n\nUnderstand which computational graph branch receives gradient.',
      visualization: '## Visualization card\n\n- Question: Why does drift move samples toward data?\n- Concept: vector field on generated samples.\n- Visual encoding: arrows from generated points to nearby data structure.\n- What to observe: arrows shrink as distributions match.\n- Conclusion: the field is a conceptual guide for training.\n- Limitation: this does not prove convergence.',
      'final-insight': '## One-sentence final insight\n\nThe paper trains a one-pass generator by converting distribution mismatch into a stop-gradient drift target.\n\n## Equation map\n\n- $q=f_{\\#}p_{\\mathrm{prior}}$ defines generated distribution.\n- Eq. (6) trains against the drift target.\n\n## Dependency chain\n\nPushforward → drift field → stop-gradient target → training objective → final generator.'
    };
    const cards = [
      ['paper-map', 'Paper map', bodies['paper-map'], ['--figure-file', figurePath, '--figure-caption', 'Figure 1. Method flow.']],
      ['prerequisite', 'Prerequisite ladder — Drift field', bodies.prerequisite, []],
      ['method', 'Method dissection — Drifting Model', bodies.method, []],
      ['equation', 'Training objective — Eq. (6)', bodies.equation, ['--latex', '\\mathcal{L}=\\mathbb{E}\\left[\\left\\|x-\\operatorname{stopgrad}(x+V_{p,q}(x))\\right\\|_2^2\\right]']],
      ['derivation', 'Derivation trace — Drift target to Eq. (6)', bodies.derivation, []],
      ['dependency', 'Dependency trace — Eq. (6)', bodies.dependency, []],
      ['proof', 'Proof walkthrough — Zero drift claim', bodies.proof, []],
      ['confusion', 'Confusion repair — stopgrad', bodies.confusion, ['--user-question', 'Why is stopgrad used here?', '--origin-turn', 'turn-009']],
      ['recursive-why', 'Recursive why — stopgrad', bodies['recursive-why'], []],
      ['visualization', 'Visualization card — Drift field', bodies.visualization, []],
      ['final-insight', 'Final insight', bodies['final-insight'], []]
    ];
    for (const [type, title, body, extra] of cards) {
      const bodyPath = join(temp, `${type}.md`);
      writeFileSync(bodyPath, body);
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'block-coverage-report', '--type', type, '--title', title, '--body-file', bodyPath, '--choices', 'Continue|Ask confusion', ...extra], { cwd: temp, stdio: 'pipe' });
    }
    const dir = join(temp, '.papermentor', 'sessions', 'block-coverage-report');
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    const data = readJson(join(dir, 'cards.json'), { cards: [] });
    if ((html.match(/class="block"/g) || []).length !== cards.length) failures.push(`all-block report should render ${cards.length} blocks`);
    if (data.cards?.length !== cards.length) failures.push(`all-block cards.json should persist ${cards.length} cards`);
    for (const [type, title] of cards) {
      if (!data.cards?.some((card) => card.type === type && card.title === title)) failures.push(`all-block cards.json missing ${type}: ${title}`);
      if (!html.includes(title)) failures.push(`all-block HTML missing title: ${title}`);
    }
    for (const phrase of ['Prerequisite ladder', 'Method dissection', 'Training objective', 'Derivation trace', 'Dependency trace', 'Proof walkthrough', 'Confusion repair', 'Recursive why', 'Visualization card', 'Final insight']) {
      if (!html.includes(phrase)) failures.push(`all-block HTML missing stage phrase: ${phrase}`);
    }
    for (const phrase of ['MathJax', 'assets/mathjax/tex-svg.js', '<ol>', '<table>', 'Line transition microscope', 'User question', 'Why is stopgrad used here?', 'class="paper-figure"', 'assets/fonts/satoshi/Satoshi-400.woff2', 'assets/fonts/pretendard/PretendardVariable.woff2']) {
      if (!html.includes(phrase)) failures.push(`all-block HTML missing structural phrase: ${phrase}`);
    }
    if (!html.includes('class="ladder-heading"')) failures.push('all-block HTML should style numbered ladder headings for long prerequisite ladders');
    if (html.includes('학습' + ' ' + '목적' + '식')) failures.push('all-block HTML should not contain awkward Korean technical phrasing');
    if (html.includes('Block 01') || /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(html)) failures.push('all-block HTML should not display block badges or ISO timestamps');
  } catch (error) {
    failures.push(`all-block report smoke failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function validatePaperStageRunnerPrompts() {
  const temp = mkdtempSync(join(tmpdir(), 'papermentor-paper-stages-'));
  try {
    const paperTextPath = join(temp, 'stage-paper.txt');
    writeFileSync(paperTextPath, `Stage Runner Verification Paper
Ada Verifier

Abstract
This paper learns a calibrated retrieval scorer with a margin objective, a projected update, and a proof that the margin gap decreases.

1. Introduction
The reader needs a map of why retrieval scoring, calibration, and a margin gap are connected.

2. Method
The encoder h_theta maps a query q and document d to vectors. Equation (1) defines the margin objective L(theta)=E[max(0, m - s(q,d+) + s(q,d-))]. Equation (2) updates theta_{t+1}=Pi_C(theta_t - eta grad L(theta_t)). Algorithm 1 alternates scoring positives and negatives, then applying the projected update.

3. Theory
Proposition 1 states that the projected update decreases the margin gap under a Lipschitz gradient assumption. Proof. By convexity, L(theta') >= L(theta)+grad L(theta)^T(theta'-theta). The projection step and the step-size bound give the one-step decrease.

4. Discussion
The final insight is that calibration is not a post-processing trick; it is enforced by the training objective and the proof assumptions.`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Stage Runner Verification Paper', '--source', 'stage-paper.pdf', '--slug', 'paper-stage-runner'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'paper-stage-runner', '--paper-text-file', paperTextPath], { cwd: temp, stdio: 'pipe' });
    const sessionDir = join(temp, '.papermentor', 'sessions', 'paper-stage-runner');
    const cases = [
      ['Build concept ladder from first principles for the margin objective', 'prerequisite', 'templates/prerequisite_ladder.md', 'L(theta)=E', '2. Method'],
      ['Explain the method pipeline in 2. Method', 'method', 'templates/method_dissection.md', 'Algorithm 1', '2. Method'],
      ['Explain Eq. (1) margin objective symbol by symbol', 'equation', 'templates/equation_card.md', 'Eq. (1)', '2. Method'],
      ['Trace derivation from Eq. (1) to Eq. (2)', 'derivation', 'templates/derivation_trace.md', 'Eq. (2)', '2. Method'],
      ['Connect dependencies for Proposition 1', 'dependency', 'templates/dependency_trace.md', 'Proposition 1', '3. Theory'],
      ['Walk through proof of Proposition 1 line by line', 'proof', 'templates/proof_walkthrough.md', 'Proof. By convexity', '3. Theory'],
      ['Ask anything about why projection is allowed', 'confusion', 'templates/confusion_response.md', 'missing dependency', '3. Theory'],
      ['Recursive why chain for the projection assumption', 'recursive-why', 'templates/recursive_why.md', 'projection', '3. Theory'],
      ['Draw dependency diagram for Eq. (1) to Proposition 1', 'visualization', 'templates/visualization_card.md', 'Proposition 1', '3. Theory'],
      ['Extract final insight one-sentence', 'final-insight', 'templates/final_insight.md', 'final insight', '4. Discussion']
    ];
    const qualityPhraseByType = {
      prerequisite: 'For each rung, teach the concept, give a real-number example',
      method: 'Make the method executable in the reader',
      equation: 'Start with the clean mathematical formula',
      derivation: 'Trace only one transition at a time',
      dependency: 'Separate definitions, assumptions, lemmas, algorithms, equations, theorem statements, and claims',
      proof: 'Use a line transition microscope rather than a fixed overview table',
      confusion: 'Answer the user',
      'recursive-why': 'Make each why-layer strictly deeper',
      visualization: 'Use visualization only for relationship, sequence, geometry, dependency, or flow confusion',
      'final-insight': 'Use the form "not merely X; rather Y"'
    };

    for (const [action, expectedType, expectedTemplate, expectedLocalSignal, section] of cases) {
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'paper-stage-runner', '--section', section], { cwd: temp, stdio: 'pipe' });
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'mode', '--session', 'paper-stage-runner', '--mode', expectedType, '--items', action], { cwd: temp, stdio: 'pipe' });
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'paper-stage-runner', '--index', '1'], { cwd: temp, stdio: 'pipe' });
      const state = readJson(join(sessionDir, 'state.json'), {});
      const prompt = readFileSync(join(sessionDir, 'pending-prompt.md'), 'utf8');
      if (state.sourceMode !== 'paper') failures.push(`paper-stage runner should stay in paper mode for ${expectedType}`);
      if (state.pendingBlockType !== expectedType) failures.push(`paper-stage runner mapped "${action}" to ${state.pendingBlockType}, expected ${expectedType}`);
      for (const phrase of [
        'PaperMentor HTML Block Runner Prompt',
        `--type '${expectedType}'`,
        expectedTemplate,
        'Mode: Paper',
        section,
        'Equation / notation preview from this selected range',
        'Source excerpt for this selected range',
        'Stage-specific quality bar',
        'Do not write a generic summary',
        qualityPhraseByType[expectedType],
        'Show every non-trivial equation in LaTeX',
        expectedLocalSignal
      ]) {
        if (!prompt.includes(phrase)) failures.push(`paper-stage pending prompt for ${expectedType} missing phrase: ${phrase}`);
      }
      if (prompt.includes('Mode: Slides') || prompt.includes('templates/slide_')) failures.push(`paper-stage pending prompt for ${expectedType} should not leak slide-mode templates`);
    }
  } catch (error) {
    failures.push(`paper-stage runner prompt smoke failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function validateContentQualityQa() {
  const temp = mkdtempSync(join(tmpdir(), 'papermentor-quality-qa-'));
  try {
    const highBodies = {
      method: `## Input / output contract

Input: a vector $x\\in\\mathbb{R}^d$ and bit-width $b$. Output: an index vector $\\mathrm{idx}\\in[2^b]^d$ plus a reconstruction $\\tilde{x}$.

## Stored objects, variables, and randomness

Algorithm 1 stores a random rotation $\\Pi$ and centroids $c_1,\\ldots,c_{2^b}$. The online input is $x$; the carried quantity is $y=\\Pi x$.

## Algorithm walk-through

| Step | Paper line / equation | Quantity carried | Operation | Output of the step |
| --- | --- | --- | --- | --- |
| 1 | Algorithm 1 line 5 | $x$ | rotate | $y=\\Pi x$ |
| 2 | Algorithm 1 line 6 | $y_j$ | nearest centroid | $\\mathrm{idx}_j$ |
| 3 | Algorithm 1 lines 9--10 | $c_{\\mathrm{idx}_j}$ | rotate back | $\\tilde{x}=\\Pi^\\top\\tilde{y}$ |

## Training vs inference / preprocessing vs online use

The centroids are precomputed; the online path only rotates, indexes, and reconstructs. This is why the method is online rather than dataset-trained.

## Equation dependencies

Eq. (4) defines the scalar centroid cost used in line 6. Theorem 1 turns this scalar cost into vector MSE.

## Reconstruction checkpoint

You should now be able to run Algorithm 1 on one coordinate: rotate, choose nearest centroid, store the index, and rotate back.`,
      proof: `## Claim statement

Theorem 2 has two subclaims: the estimator is unbiased, $\\mathbb{E}[\\langle y,\\tilde{x}\\rangle]=\\langle y,x\\rangle$, and the distortion is bounded by a variance term.

## Proof strategy

Condition on $\\tilde{x}_{\\mathrm{mse}}$, prove the QJL residual is unbiased, then use the QJL variance bound to control distortion.

## Notation and objects

$\\tilde{x}_{\\mathrm{mse}}$ is the fixed MSE reconstruction under conditioning, $r=x-\\tilde{x}_{\\mathrm{mse}}$ is the residual, $\\tilde{x}_{\\mathrm{qjl}}$ is the random QJL residual estimate, and $y$ is the query vector held fixed while the QJL randomness is averaged.

## Line transition microscope

### Transition 1 → 2

Previous line:

$$\\tilde{x}=\\tilde{x}_{\\mathrm{mse}}+\\tilde{x}_{\\mathrm{qjl}}$$

Next line:

$$\\mathbb{E}[\\langle y,\\tilde{x}\\rangle\\mid\\tilde{x}_{\\mathrm{mse}}]=\\langle y,\\tilde{x}_{\\mathrm{mse}}\\rangle+\\mathbb{E}[\\langle y,\\tilde{x}_{\\mathrm{qjl}}\\rangle\\mid\\tilde{x}_{\\mathrm{mse}}]$$

What changed: substitute the decomposition into the inner product, distribute $\\langle y,\\cdot\\rangle$ over the sum, then move the fixed term $\\langle y,\\tilde{x}_{\\mathrm{mse}}\\rangle$ outside the conditional expectation.

### Transition 2 → 3

Previous line:

$$\\mathbb{E}[\\langle y,\\tilde{x}_{\\mathrm{qjl}}\\rangle\\mid\\tilde{x}_{\\mathrm{mse}}]$$

Next line:

$$\\langle y,r\\rangle$$

What changed: apply Lemma 4's unbiasedness statement to the QJL residual estimator. The residual $r=x-\\tilde{x}_{\\mathrm{mse}}$ is fixed under the conditioning event.

### Transition 3 → 4

Previous line:

$$\\langle y,\\tilde{x}_{\\mathrm{mse}}\\rangle+\\langle y,r\\rangle$$

Next line:

$$\\langle y,x\\rangle$$

What changed: substitute $r=x-\\tilde{x}_{\\mathrm{mse}}$, distribute the inner product, and cancel $+\\langle y,\\tilde{x}_{\\mathrm{mse}}\\rangle$ with $-\\langle y,\\tilde{x}_{\\mathrm{mse}}\\rangle$.

### Transition 4 → 5

Previous line:

$$\\operatorname{Var}(\\langle y,\\tilde{x}_{\\mathrm{qjl}}\\rangle)$$

Next line:

$$\\operatorname{Var}(\\langle y,\\tilde{x}_{\\mathrm{qjl}}\\rangle)\\le \\frac{\\pi}{2d}\\|r\\|_2^2\\|y\\|_2^2$$

What changed: invoke Lemma 4's variance bound; no algebra cancels here, the operation is applying an inequality in the correct upper-bound direction.

## Cancellation / substitution audit

Substitutions: $\\tilde{x}=\\tilde{x}_{\\mathrm{mse}}+\\tilde{x}_{\\mathrm{qjl}}$ and $r=x-\\tilde{x}_{\\mathrm{mse}}$. Cancellation: $\\langle y,\\tilde{x}_{\\mathrm{mse}}\\rangle-\\langle y,\\tilde{x}_{\\mathrm{mse}}\\rangle=0$. Expectation regrouping: fixed MSE terms leave the conditional expectation; only QJL randomness remains averaged.

## Expectation / conditioning audit

Conditioning fixes $\\tilde{x}_{\\mathrm{mse}}$ and therefore fixes $r$. The remaining randomness is QJL. The law of total expectation then removes the conditioning.

## Inequality / bound audit

The inequality direction comes from the QJL variance upper bound; it upper-bounds squared inner-product error by residual norm times query norm.

## Closure

The first three lines prove unbiasedness, while the final variance line proves the error/distortion part of Theorem 2.

## Proof coverage / compression audit

This fixture covers every conceptual transition in the theorem proof and compresses only repeated expectation notation after the conditional proof is complete.

## Reconstruction checkpoint

You should be able to say what is fixed under conditioning, which lemma gives unbiasedness, and which lemma gives the variance bound.`,
      final: `## One-sentence final insight

TurboQuant is not merely a better reconstruction quantizer; rather, it separates reconstruction quality from unbiased inner-product estimation and repairs the latter with a residual QJL stage.

## Problem

VQ must compress $x\\in\\mathbb{R}^d$ while preserving both $\\|x-\\tilde{x}\\|_2^2$ and $\\langle y,x\\rangle$.

## Core intuition

Random rotation makes coordinates scalar-quantizable; residual QJL adds back the part MSE quantization misses.

## Equation map

| Equation / claim | Role | Dependency it closes |
| --- | --- | --- |
| Eq. (1) | MSE distortion | reconstruction goal |
| Eq. (4) | scalar centroid cost | Algorithm 1 |
| Theorem 2 | unbiased inner product and bound | residual QJL |

## Dependency chain

random rotation $\\Pi$ → coordinate density $f_X$ → scalar centroids → small residual $r$ → QJL residual estimator → unbiased inner-product estimate.

## Assumptions and breakpoints

If random rotation does not regularize coordinates, Eq. (4) is not reusable. If QJL is not unbiased, Theorem 2's expectation claim breaks.

## Reconstruction checklist

Restate why MSE optimality is insufficient, where $r$ comes from, and how QJL closes the inner-product gap.`
    };
    const weakProof = `## Proof strategy

The proof is intuitive. Since QJL is good, the theorem follows.
`;
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Quantization QA Fixture', '--slug', 'quantization-qa'], { cwd: temp, stdio: 'pipe' });
    for (const [type, body] of Object.entries(highBodies)) {
      const file = join(temp, `${type}.md`);
      writeFileSync(file, body);
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'quantization-qa', '--type', type === 'final' ? 'final-insight' : type, '--title', `${type} quality block`, '--body-file', file], { cwd: temp, stdio: 'pipe' });
    }
    const qa = JSON.parse(execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'qa', '--session', 'quantization-qa', '--json'], { cwd: temp, encoding: 'utf8' }));
    if (qa.overall < 82 || qa.status !== 'pass') failures.push(`content QA should pass high-quality multi-stage fixture, got ${qa.overall}/${qa.status}`);
    if (!qa.cards?.some((card) => card.type === 'proof' && card.score >= 82)) failures.push('content QA should recognize proof blocks that cover expectation and variance/bound');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Weak Proof QA Fixture', '--slug', 'weak-proof-qa'], { cwd: temp, stdio: 'pipe' });
    const weakFile = join(temp, 'weak-proof.md');
    writeFileSync(weakFile, weakProof);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'weak-proof-qa', '--type', 'proof', '--title', 'Weak proof', '--body-file', weakFile], { cwd: temp, stdio: 'pipe' });
    const weakQa = JSON.parse(execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'qa', '--session', 'weak-proof-qa', '--json'], { cwd: temp, encoding: 'utf8' }));
    if (weakQa.overall >= 68 || weakQa.status !== 'fail') failures.push(`content QA should fail shallow proof fixture, got ${weakQa.overall}/${weakQa.status}`);
    const weakIssues = weakQa.cards?.[0]?.issues?.join(' ') || '';
    if (!/too short|line|conditioning|bound|checkpoint/i.test(weakIssues)) failures.push(`weak proof QA should report actionable proof issues, got ${weakIssues}`);
  } catch (error) {
    failures.push(`content QA smoke failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function validateProductGradeAudits() {
  const temp = mkdtempSync(join(tmpdir(), 'papermentor-product-audits-'));
  const script = join(root, 'scripts', 'papermentor-session.mjs');
  const run = (args, options = {}) => execFileSync('node', [script, ...args], { cwd: temp, encoding: 'utf8', stdio: options.stdio || ['ignore', 'pipe', 'pipe'] });
  const writeBody = (name, body) => {
    const file = join(temp, name);
    writeFileSync(file, body);
    return file;
  };
  const start = (slug, title = slug) => run(['start', '--title', title, '--slug', slug, '--mode', 'paper']);
  const addBlock = (slug, type, title, body, extra = []) => {
    const file = writeBody(`${slug}-${type}.md`, body);
    run(['card', '--session', slug, '--type', type, '--title', title, '--body-file', file, ...extra]);
  };
  const methodBody = `## Input / output contract

Input: examples $x_i\\in\\mathbb{R}^d$, labels $y_i$, and a temperature $\\tau$. Output: a trained encoder $f_\\theta$ and calibrated score $s(q,d)=f_\\theta(q)^\\top f_\\theta(d)$.

## Algorithm 1 walk-through

| Step | Paper anchor | Quantity carried | Operation | Output |
| --- | --- | --- | --- | --- |
| 1 | Algorithm 1 line 2 | minibatch $B$ | encode queries and documents | vectors $z_q,z_d$ |
| 2 | Eq. (1) | logits $z_q^\\top z_d/\\tau$ | softmax contrastive loss | $\\mathcal{L}_{\\mathrm{NCE}}$ |
| 3 | Eq. (2) | validation scores | fit calibration map | probability $p(y=1\\mid q,d)$ |

## Training vs inference / preprocessing vs online use

Training updates $\\theta$ using Eq. (1). Inference stores document vectors once, then computes only an inner product and the calibration map. This separation prevents the reader from confusing the expensive training loop with the deployed retrieval path.

## Reconstruction checkpoint

You should now be able to reconstruct the method as: encode → compare with Eq. (1) → calibrate with Eq. (2) → retrieve.`;
  const expectationProof = `## Claim statement

Theorem 2 claims the estimator is unbiased, $\\mathbb{E}[\\hat{g}(x)]=g(x)$, and has bounded variance.

## Notation and objects

$x$ is held fixed under conditioning, $h_j(x)$ is the sampled estimator term, $m$ is the number of samples, and $\\hat{g}(x)=m^{-1}\\sum_{j=1}^m h_j(x)$ averages those terms.

## Line transition microscope

### Transition 1 → 2

Previous line:

$$\\hat{g}(x)=\\frac{1}{m}\\sum_{j=1}^m h_j(x)$$

Next line:

$$\\mathbb{E}[\\hat{g}(x)\\mid x]=\\frac{1}{m}\\sum_{j=1}^m\\mathbb{E}[h_j(x)\\mid x]$$

Primitive micro-steps: first put the conditional expectation around both sides; then keep $1/m$ fixed because it is not random; then move the finite sum outside the expectation one term at a time. Each micro-step is a local transformation of the previous expression.

### Transition 2 → 3

Previous line:

$$\\frac{1}{m}\\sum_{j=1}^m\\mathbb{E}[h_j(x)\\mid x]$$

Next line:

$$\\frac{1}{m}\\sum_{j=1}^m g(x)=g(x)$$

Primitive micro-steps: replace each term $\\mathbb{E}[h_j(x)\\mid x]$ using Lemma 1; then recognize the sum contains $m$ identical copies of $g(x)$; finally cancel the scalar factor $m/m$.

### Transition 3 → 4

Previous line:

$$\\operatorname{Var}\\!\\left(\\frac{1}{m}\\sum_{j=1}^m h_j(x)\\right)$$

Next line:

$$\\operatorname{Var}(\\hat{g}(x))\\le \\sigma^2/m$$

Primitive micro-steps: keep the variance operator on the averaged estimator, use the independence condition to remove cross terms, then use Lemma 2's per-sample variance bound.

## Operation audit

The selected proof uses only operations visible in these transitions: expectation is pushed through a fixed scalar and finite sum, identical terms are collapsed, a scalar factor cancels, and a variance bound is applied.

## Expectation / conditioning audit

Conditioning fixes $x$; the only randomness left is the sampling of $h_j$. The law of total expectation then removes conditioning.

## Inequality / bound audit

The variance inequality is an upper bound; it shrinks by $m$ because independent terms add variances and the average contributes $1/m^2$.

## Proof coverage / compression audit

This fixture covers every conceptual displayed transition and compresses no algebra beyond repeated identical summands.

## Reconstruction checkpoint

You should be able to identify what is fixed, which lemma proves expectation, and which lemma gives the bound.`;
  const convexProof = `## Claim statement

Proposition 3 states that the objective in Eq. (4), $F(w)=\\sum_i \\ell(y_i x_i^\\top w)+\\lambda\\|w\\|_2^2$, is convex.

## Notation and objects

$w$ is the optimization variable, $x_i,y_i$ are fixed data, $\\ell$ is the loss, and $\\lambda\\ge0$ is a fixed regularization weight.

## Line transition microscope

### Transition 1 → 2

Previous line:

$$w\\mapsto y_i x_i^\\top w$$

Next line:

$$w\\mapsto \\ell(y_i x_i^\\top w)$$

Primitive micro-steps: first identify the inner expression as a function of $w$; then hold $x_i,y_i$ fixed; then apply the paper's composition rule to the outer function $\\ell$.

### Transition 2 → 3

Previous line:

$$\\ell(y_i x_i^\\top w) \\text{ is convex for each } i$$

Next line:

$$\\sum_i \\ell(y_i x_i^\\top w) \\text{ is convex}$$

Primitive micro-steps: add the first two convex terms, preserve convexity under that addition, then repeat the same local step over the finite index set.

### Transition 3 → 4

Previous line:

$$\\sum_i \\ell(y_i x_i^\\top w)$$

Next line:

$$F(w)=\\sum_i \\ell(y_i x_i^\\top w)+\\lambda\\|w\\|_2^2$$

Primitive micro-steps: introduce the regularizer, use $\\lambda\\ge0$ so scaling preserves convexity, then add it to the already convex data-fit term.

## Operation audit

The selected proof repeatedly transforms a statement about one function into a statement about a larger expression; each transition preserves convexity by a local rule named in the surrounding proof text.

## Expectation / conditioning audit

There is no stochastic conditioning in this proof; all $x_i,y_i$ are treated as fixed observed quantities.

## Inequality / bound audit

The key inequality is Jensen's definition of convexity: $F(\\alpha u+(1-\\alpha)v)\\le \\alpha F(u)+(1-\\alpha)F(v)$ for $\\alpha\\in[0,1]$.

## Proof coverage / compression audit

This fixture covers every conceptual proof step; it compresses repeated finite-sum additions into the phrase “repeat over the finite index set.”

## Reconstruction checkpoint

You should now be able to prove convexity by naming affine composition, finite-sum closure, and nonnegative quadratic regularization.`;
  const inductionProof = `## Claim statement

Lemma 4 proves by induction that after $t$ dynamic-programming updates, Eq. (7) satisfies the error bound $\\|V_t-V^\\star\\|_\\infty\\le \\gamma^t\\|V_0-V^\\star\\|_\\infty$.

## Notation and objects

$T$ is the Bellman update operator, $V^\\star$ is its fixed point, $\\gamma$ is the contraction factor, and $\\|\\cdot\\|_\\infty$ measures the largest statewise error.

## Line transition microscope

### Transition 1 → 2

Previous line:

$$\\|V_{t+1}-V^\\star\\|_\\infty$$

Next line:

$$\\|TV_t-TV^\\star\\|_\\infty$$

Primitive micro-steps: replace $V_{t+1}$ with $TV_t$; replace $V^\\star$ with $TV^\\star$; keep the norm unchanged around the expression.

### Transition 2 → 3

Previous line:

$$\\|TV_t-TV^\\star\\|_\\infty$$

Next line:

$$\\|TV_t-TV^\\star\\|_\\infty\\le\\gamma\\|V_t-V^\\star\\|_\\infty$$

Primitive micro-steps: identify the two inputs to $T$ as $V_t$ and $V^\\star$, then apply Lemma 3's contraction statement to those exact inputs.

### Transition 3 → 4

Previous line:

$$\\gamma\\|V_t-V^\\star\\|_\\infty$$

Next line:

$$\\gamma^{t+1}\\|V_0-V^\\star\\|_\\infty$$

Primitive micro-steps: substitute the induction hypothesis for $\\|V_t-V^\\star\\|_\\infty$; then multiply the outside $\\gamma$ into $\\gamma^t$.

## Operation audit

The selected proof uses fixed-point replacement, contraction of the transformed error, and exponent arithmetic. Each micro-step changes exactly one local part of the expression.

## Expectation / conditioning audit

The Bellman expectation is already inside $T$; the proof does not resample trajectories, so the contraction is deterministic once the MDP is fixed.

## Inequality / bound audit

The only inequality is the contraction bound. Its direction matters: it upper-bounds the next error by $\\gamma$ times the previous error.

## Proof coverage / compression audit

This fixture covers the base-case-to-induction-step structure and compresses only the trivial base case $t=0$.

## Reconstruction checkpoint

You should now be able to reconstruct base case, fixed-point substitution, contraction, and induction closure.`;
  try {
    for (const [slug, body] of [
      ['batch-method-paper', methodBody],
      ['batch-proof-expectation', expectationProof],
      ['batch-proof-convexity', convexProof]
    ]) {
      start(slug);
      addBlock(slug, slug.includes('method') ? 'method' : 'proof', `${slug} block`, body);
    }
    const batch = JSON.parse(run(['qa-batch', '--sessions', 'batch-method-paper|batch-proof-expectation|batch-proof-convexity', '--json']));
    if (batch.reports?.length !== 3 || batch.overall < 82 || batch.status !== 'pass') failures.push(`qa-batch should pass three high-quality paper fixtures, got ${batch.overall}/${batch.status}`);

    start('figure-audit-bad');
    const smallSvg = join(temp, 'small.svg');
    writeFileSync(smallSvg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect width="120" height="60" fill="#ddd"/></svg>');
    addBlock('figure-audit-bad', 'start-here', 'Start Here', '## One-sentence orientation\n\nThis is a paper with a tiny unresolved representative figure placeholder.\n\n## Preliminary\n\nEq. (1) states $y=x+1$.\n\nplaceholder', ['--figure-file', smallSvg]);
    const figureAudit = JSON.parse(run(['figure-audit', '--sessions', 'figure-audit-bad', '--json']));
    const figureIssues = JSON.stringify(figureAudit);
    if (figureAudit.status !== 'review' || !/small figure crop|schema|scaffold|placeholder/i.test(figureIssues)) failures.push(`figure-audit should collect crop/schema/scaffold failures, got ${figureIssues}`);

    start('proof-induction-paper');
    addBlock('proof-induction-paper', 'proof', 'Induction proof', inductionProof);
    start('proof-weak-paper');
    addBlock('proof-weak-paper', 'proof', 'Weak proof', '## Proof strategy\n\nTheorem 1 follows because the method is good.');
    const proofAudit = JSON.parse(run(['proof-audit', '--sessions', 'batch-proof-expectation|batch-proof-convexity|proof-induction-paper|proof-weak-paper', '--json']));
    const proofReports = proofAudit.reports || [];
    const passingProofs = proofReports.filter((report) => report.status === 'pass').length;
    const weakReport = proofReports.find((report) => report.session === 'proof-weak-paper');
    if (passingProofs < 3 || proofAudit.status !== 'review' || weakReport?.status !== 'review') failures.push(`proof-audit should pass three proof shapes and review weak proof, got ${JSON.stringify(proofAudit)}`);
  } catch (error) {
    failures.push(`product-grade audit smoke failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

validateContentQualityQa();
validateProductGradeAudits();
validatePaperStageRunnerPrompts();
validateInstalledArtifact();
await validateSessionHelper();
validateSourceModes();
validateAllBlockTypes();

if (failures.length) {
  console.error('PaperMentor validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PaperMentor validation passed (${required.length} required files checked).`);
