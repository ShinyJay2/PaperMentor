#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const sessionScript = join(repoRoot, 'scripts', 'papermentor-session.mjs');
const temp = mkdtempSync(join(tmpdir(), 'papermentor-perf-prompts-'));
const capture = join(temp, 'captured-prompts');
mkdirSync(capture, { recursive: true });

function run(args, env = {}) {
  return execFileSync('node', [sessionScript, ...args], {
    cwd: temp,
    env: { ...process.env, PAPERMENTOR_CLI: 'papermentor', ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function longPaperFixture() {
  const methodParagraph = `The method constructs a context encoder f_theta, a target encoder f_bar, and a predictor g_phi. For each image, patches are divided into visible context blocks C and target blocks B_i. Equation (1) minimizes L = (1/M) sum_i sum_{j in B_i} || hat{s}_{y_j} - s_{y_j} ||_2^2, where s_y is the target-encoder representation and hat{s}_y is the predictor output. The target encoder is updated by exponential moving average, not by direct gradient descent. This matters because the predictor should chase a stable representation, not a target that changes every gradient step.`;
  return `Prompt Budget Regression Paper\nAda Researcher\n\nAbstract\nThis paper studies joint-embedding prediction for visual representation learning. It predicts representation vectors for masked target patches rather than reconstructing raw pixels.\n\n1. Introduction\nSelf-supervised visual learning can use generated targets instead of labels. The paper argues that predicting in representation space avoids wasting capacity on pixel-level detail.\n\n2. Background\nMasked image modeling reconstructs pixels, while contrastive joint embedding compares views. This paper keeps the masked-region setup but replaces pixel targets with target-encoder embeddings.\n\n3. Method\n${Array.from({ length: 18 }, () => methodParagraph).join('\n\n')}\n\n4. Experiments\nThe model is evaluated with linear probing, fine tuning, and transfer tasks.\n`;
}

function readMetrics() {
  const path = join(capture, 'metrics.jsonl');
  const raw = readFileSync(path, 'utf8').trim();
  return raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

const source = join(temp, 'long-paper.txt');
writeFileSync(source, longPaperFixture());

try {
  const commonCapture = { PAPERMENTOR_AGENT_CAPTURE_PROMPT_DIR: capture };
  const firstAction = 'Explain the source goal from the Abstract excerpt';
  const startHere = `## One-sentence orientation\n\nThis paper teaches joint-embedding prediction by explaining why masked target patches are predicted in representation space rather than pixel space.\n\n## Preliminary\n\n### 1. Patch representations\nAn image is split into patches, and each patch can be represented by a vector $s_j\\in\\mathbb{R}^d$. For example, a tiny three-dimensional patch vector might be $[0.2,-0.1,0.7].\n\n### 2. Squared distance\nThe loss compares a predicted vector with a target vector using $\\|\\hat{s}-s\\|_2^2$. If $\\hat{s}=[1,2]$ and $s=[1,4]$, the error is $(1-1)^2+(2-4)^2=4.\n\n### 3. Stable target encoder\nThe target encoder changes slowly, so the predictor learns against a stable representation rather than chasing a target that moves every step.\n\nCheckpoint: the reader should be able to say that Eq. (1) compares predicted and target patch representations, not pixels.`;
  run(['launch', source, '--slug', 'perf-prompt-source', '--auto', '--no-figure', '--no-preview'], {
    ...commonCapture,
    PAPERMENTOR_AGENT_MOCK: JSON.stringify({
      startHereMarkdown: startHere,
      firstSection: 'Abstract',
      sectionChoices: [
        firstAction,
        'Locate where representation prediction first enters the paper',
        'Separate pixel reconstruction from representation prediction',
        'Ask anything about Abstract'
      ]
    })
  });
  // Selecting the bundled first section should not call the provider.
  run(['run', '--session', 'perf-prompt-source', '--index', '1', '--generate'], {
    ...commonCapture,
    PAPERMENTOR_AGENT: 'bogus'
  });
  const block = `## Equation microscope\n\nThe selected method objective compares predicted target-patch representations with target-encoder representations. The important object is not a pixel value but a vector $s_{y_j}\in\mathbb{R}^d$ for patch $j$. The term $\|\hat{s}_{y_j}-s_{y_j}\|_2^2$ measures the squared coordinate-wise error for that one patch. The inner sum adds errors over patches in one target block $B_i$, and the outer average adds those block losses over $M$ sampled target blocks. This teaches that the predictor learns semantic representation compatibility, not RGB reconstruction. Checkpoint: the reader should be able to identify $B_i$, $j$, $M$, $\hat{s}_{y_j}$, and $s_{y_j}$ in Eq. (1).`;
  run(['prefetch', '--session', 'perf-prompt-source', '--action', firstAction], {
    ...commonCapture,
    PAPERMENTOR_AGENT_MOCK: block
  });
  // Choosing a prefetched action should append the cached block rather than
  // spending another live-provider call. Use an intentionally invalid provider
  // to prove the cache path does not call Codex/Claude.
  run(['run', '--session', 'perf-prompt-source', '--index', '1', '--generate'], {
    ...commonCapture,
    PAPERMENTOR_AGENT: 'bogus'
  });

  const metrics = readMetrics();
  const byLabel = Object.fromEntries(metrics.map((item) => [item.label, item]));
  const failures = [];
  const limits = {
    'launch-bundle': 9000,
    'html-block-prefetch': 7000
  };
  for (const [label, maxBytes] of Object.entries(limits)) {
    if (!byLabel[label]) failures.push(`missing captured prompt for ${label}`);
    else if (byLabel[label].bytes > maxBytes) failures.push(`${label} prompt too large: ${byLabel[label].bytes} > ${maxBytes}`);
  }
  if (metrics.length !== 2) failures.push(`expected exactly 2 provider prompts after bundled launch and prefetched cached action, saw ${metrics.length}`);
  const summary = {
    schema: 'papermentor.prompt-perf.v1',
    limits,
    metrics,
    totalBytes: metrics.reduce((sum, item) => sum + item.bytes, 0),
    status: failures.length ? 'fail' : 'pass',
    failures
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) process.exit(1);
} finally {
  if (!process.env.PAPERMENTOR_KEEP_PERF_TMP) rmSync(temp, { recursive: true, force: true });
}
