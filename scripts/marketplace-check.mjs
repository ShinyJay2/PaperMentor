#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { repoRoot } from './manifest.mjs';

const root = repoRoot;
const failures = [];

function run(label, command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
      env: { ...process.env, ...(options.env || {}) }
    });
  } catch (error) {
    failures.push(`${label} failed${error.stderr ? `: ${String(error.stderr).slice(0, 500)}` : ''}`);
    return '';
  }
}

function stripAnsi(value) {
  return String(value || '')
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}

function assertSnapshotWidth(label, output, columns, phrases = ['PaperMentor']) {
  const limit = Number(columns) + 1;
  const long = stripAnsi(output).split(/\r?\n/).filter((line) => line.length > limit);
  if (long.length) failures.push(`${label} has ${long.length} line(s) wider than ${columns} columns; first: ${long[0].slice(0, 120)}`);
  for (const phrase of phrases) {
    if (!stripAnsi(output).includes(phrase)) failures.push(`${label} missing visible phrase: ${phrase}`);
  }
}


function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const readme = read('README.md');
const skill = read('SKILL.md');
const checklist = existsSync(join(root, 'docs/marketplace-checklist.md')) ? read('docs/marketplace-checklist.md') : '';
for (const [rel, text, phrases] of [
  ['README.md', readme, ['Codex + Claude Code', 'Start from Codex or Claude', 'Agent automation', 'Product boundaries']],
  ['SKILL.md', skill, ['HTML-first reading room rule', 'Source modes', 'Strict policies']],
  ['docs/marketplace-checklist.md', checklist, ['Submission checklist', 'User promise', 'Verification commands', 'Known limits']]
]) {
  for (const phrase of phrases) if (!text.includes(phrase)) failures.push(`${rel} missing marketplace phrase: ${phrase}`);
}

const internalSnapshotEnv = { PAPERMENTOR_INTERNAL_SNAPSHOT: '1' };
const welcome = run('welcome snapshot', 'node', ['scripts/papermentor-session.mjs', '--snapshot'], { env: { ...internalSnapshotEnv, COLUMNS: '50', LINES: '18' } });
assertSnapshotWidth('welcome snapshot', welcome, 50, ['PaperMentor', 'Drop Source', 'Reading Room']);

const smokeSlug = 'marketplace-tui-smoke';
const smokeDir = join(root, '.papermentor', 'sessions', smokeSlug);
rmSync(smokeDir, { recursive: true, force: true });
const tempDir = join(root, '.papermentor', 'marketplace-smoke');
mkdirSync(tempDir, { recursive: true });
const source = join(tempDir, 'marketplace-paper.txt');
writeFileSync(source, 'Marketplace Smoke Paper\n\nAbstract\nThis paper explains a robust PaperMentor reading room.\n\n1. Method\nThe method turns a source excerpt into useful teaching choices.\n');
const startHere = '## One-sentence orientation\n\nThis smoke paper checks that PaperMentor opens a reading room and shows useful section choices.\n\n## Preliminary\n\n### 1. Source excerpt\nA source excerpt is the local text used to ground a teaching block. PaperMentor keeps the excerpt close to the selected section so the model explains what is actually present.\n\n### 2. Section choice\nA section choice is a concrete next action, such as explaining the method object or resolving a notation gap. The reader should be able to choose one action and get one HTML block.';
run('marketplace smoke launch', 'node', ['scripts/papermentor-session.mjs', 'launch', source, '--slug', smokeSlug, '--auto', '--no-figure', '--no-preview'], {
  env: {
    PAPERMENTOR_AGENT_MOCK: JSON.stringify({
      startHereMarkdown: startHere,
      firstSection: 'Abstract',
      sectionChoices: ['Explain the reading-room promise in the Abstract', 'Ask anything about Abstract']
    })
  }
});
const tui = run('tui snapshot', 'node', ['scripts/papermentor-session.mjs', 'tui', '--session', smokeSlug, '--snapshot'], { env: { ...internalSnapshotEnv, COLUMNS: '60', LINES: '20' } });
assertSnapshotWidth('tui snapshot', tui, 60, ['PaperMentor', 'Reading room', 'Open Reading Room', 'Choose']);

for (const [label, cmd, args] of [
  ['manifest:check', 'npm', ['run', 'manifest:check']],
  ['perf:prompts', 'npm', ['run', 'perf:prompts']],
  ['test', 'npm', ['test']],
  ['pack:check', 'npm', ['run', 'pack:check']]
]) run(label, cmd, args);

rmSync(tempDir, { recursive: true, force: true });

if (failures.length) {
  console.error(`PaperMentor marketplace check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('PaperMentor marketplace check passed.');
