#!/usr/bin/env node
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { copyInstallManifest, loadManifest, repoRoot, writeExecutable } from './manifest.mjs';

function homePath(...parts) {
  return join(process.env.HOME || process.env.USERPROFILE || '.', ...parts);
}

function parseArgs(argv) {
  const args = { targets: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--target' || token === '-t') args.targets.push(argv[++i]);
    else if (token === '--no-cli') args.installCli = false;
    else if (token === '--cli') args.installCli = true;
    else if (token === '--bin-dir') args.binDir = argv[++i];
    else if (token === '--codex-home') args.codexHome = argv[++i];
    else if (token === '--claude-home') args.claudeHome = argv[++i];
    else if (token === '--help' || token === '-h') args.help = true;
    else if (!token.startsWith('--')) args.targets.push(token);
    else throw new Error(`unknown install option: ${token}`);
  }
  return args;
}

function normalizeTargets(values) {
  const raw = values.length ? values : [process.env.PAPERMENTOR_TARGET || 'codex'];
  const expanded = [];
  for (const value of raw) {
    const target = String(value || '').toLowerCase();
    if (['all', 'both'].includes(target)) expanded.push('codex', 'claude');
    else if (target === 'claude-code') expanded.push('claude');
    else if (['codex', 'claude'].includes(target)) expanded.push(target);
    else throw new Error(`unsupported target: ${value}; use codex, claude, or all`);
  }
  return [...new Set(expanded)];
}

function bashQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function installUnixWrappers({ skillDir, binDir }) {
  mkdirSync(binDir, { recursive: true });
  const script = join(skillDir, 'scripts', 'papermentor-session.mjs');
  const papermentor = join(binDir, 'papermentor');
  const pm = join(binDir, 'pm');
  writeExecutable(papermentor, `#!/usr/bin/env bash\nset -euo pipefail\nexport PAPERMENTOR_CLI="papermentor"\nexec node ${bashQuote(script)} "$@"\n`);
  writeExecutable(pm, `#!/usr/bin/env bash\nset -euo pipefail\nexport PAPERMENTOR_CLI="pm"\nexec node ${bashQuote(script)} "$@"\n`);
  console.log(`PaperMentor CLI installed: ${papermentor}`);
  console.log(`PaperMentor palette shortcut installed: ${pm}`);
  if (!String(process.env.PATH || '').split(':').includes(binDir)) {
    console.log(`Note: add ${binDir} to PATH to run \`papermentor\` from any shell.`);
  }
}

function installWindowsWrappers({ skillDir, binDir }) {
  mkdirSync(binDir, { recursive: true });
  const script = join(skillDir, 'scripts', 'papermentor-session.mjs');
  const papermentor = join(binDir, 'papermentor.cmd');
  const pm = join(binDir, 'pm.cmd');
  writeFileSync(papermentor, `@echo off\r\nset PAPERMENTOR_CLI=papermentor\r\nnode "${script}" %*\r\n`);
  writeFileSync(pm, `@echo off\r\nset PAPERMENTOR_CLI=pm\r\nnode "${script}" %*\r\n`);
  console.log(`PaperMentor CLI installed: ${papermentor}`);
  console.log(`PaperMentor palette shortcut installed: ${pm}`);
  if (!String(process.env.PATH || '').split(';').includes(binDir)) {
    console.log(`Note: add ${binDir} to PATH to run 'papermentor' from any shell.`);
  }
}

function installCli(skillDir, args) {
  const installCli = args.installCli ?? process.env.PAPERMENTOR_INSTALL_CLI !== '0';
  if (!installCli) return;
  const binDir = resolve(args.binDir || process.env.PAPERMENTOR_BIN_DIR || (process.platform === 'win32' ? homePath('.papermentor', 'bin') : homePath('.local', 'bin')));
  if (process.platform === 'win32') installWindowsWrappers({ skillDir, binDir });
  else installUnixWrappers({ skillDir, binDir });
}

function installTarget(target, args, manifest) {
  const home = target === 'codex'
    ? resolve(args.codexHome || process.env.CODEX_HOME || homePath('.codex'))
    : resolve(args.claudeHome || process.env.CLAUDE_HOME || homePath('.claude'));
  const label = target === 'codex' ? 'Codex' : 'Claude Code';
  const skillDir = join(home, 'skills', 'papermentor');
  copyInstallManifest({ root: repoRoot, destination: skillDir, manifest });
  console.log(`PaperMentor installed for ${label}: ${skillDir}`);
  return { target, skillDir };
}

function usage() {
  console.log(`PaperMentor installer\n\nUsage:\n  node scripts/install.mjs [codex|claude|all] [--no-cli] [--bin-dir <dir>]\n\nEnvironment:\n  CODEX_HOME, CLAUDE_HOME, PAPERMENTOR_BIN_DIR, PAPERMENTOR_INSTALL_CLI=0\n`);
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { usage(); process.exit(0); }
  const manifest = loadManifest(repoRoot);
  const installed = normalizeTargets(args.targets).map((target) => installTarget(target, args, manifest));
  const cliInstall = installed.find((item) => item.target === 'codex') || installed[0];
  if (cliInstall) installCli(cliInstall.skillDir, args);
  console.log('Try: pm <paper.pdf-or-url>');
} catch (error) {
  console.error(`PaperMentor install error: ${error.message}`);
  process.exit(1);
}
