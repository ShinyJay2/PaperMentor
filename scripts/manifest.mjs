import { existsSync, readdirSync, readFileSync, statSync, mkdirSync, rmSync, copyFileSync, chmodSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const manifestPath = join(repoRoot, 'papermentor.manifest.json');

export function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
}

export function loadManifest(root = repoRoot) {
  return JSON.parse(readFileSync(join(root, 'papermentor.manifest.json'), 'utf8'));
}

export function walkFiles(root, rel = '') {
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  const stat = statSync(abs);
  if (stat.isFile()) return [normalizePath(rel)];
  if (!stat.isDirectory()) return [];
  const files = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    files.push(...walkFiles(root, join(rel, entry.name)));
  }
  return files.sort();
}

function escapeRegExp(value) {
  return String(value).replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function globToRegExp(pattern) {
  const normalized = normalizePath(pattern);
  let out = '^';
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    const next = normalized[i + 1];
    if (ch === '*' && next === '*') {
      out += '.*';
      i += 1;
    } else if (ch === '*') {
      out += '[^/]*';
    } else {
      out += escapeRegExp(ch);
    }
  }
  return new RegExp(`${out}$`);
}

export function matchesPattern(path, pattern) {
  return globToRegExp(pattern).test(normalizePath(path));
}

export function matchesAny(path, patterns = []) {
  return patterns.some((pattern) => matchesPattern(path, pattern));
}

export function expandPatterns(root, patterns = []) {
  const all = walkFiles(root);
  const expanded = new Set();
  for (const pattern of patterns) {
    const normalized = normalizePath(pattern);
    if (!normalized.includes('*')) {
      if (existsSync(join(root, normalized))) {
        const stat = statSync(join(root, normalized));
        if (stat.isDirectory()) for (const file of walkFiles(root, normalized)) expanded.add(file);
        else expanded.add(normalized);
      }
      continue;
    }
    for (const file of all) {
      if (matchesPattern(file, normalized)) expanded.add(file);
    }
  }
  return [...expanded].sort();
}

function installDestinationFor(entry, sourceFile) {
  const from = normalizePath(entry.from);
  const to = normalizePath(entry.to || '.');
  if (from.endsWith('/**')) {
    const base = from.slice(0, -3);
    const rel = normalizePath(relative(base, sourceFile));
    return normalizePath(to === '.' ? rel : join(to, rel));
  }
  return normalizePath(to === '.' ? sourceFile.split('/').pop() : to);
}

export function expandInstallEntries(root, entries = []) {
  const items = [];
  for (const entry of entries) {
    for (const source of expandPatterns(root, [entry.from])) {
      items.push({ source, destination: installDestinationFor(entry, source) });
    }
  }
  return items.sort((a, b) => a.destination.localeCompare(b.destination));
}

export function runtimeInstallDestinations(root = repoRoot, manifest = loadManifest(root)) {
  return expandInstallEntries(root, manifest.install).map((item) => item.destination);
}

export function packageFiles(root = repoRoot, manifest = loadManifest(root)) {
  return expandPatterns(root, manifest.package.files);
}

export function rimraf(path) {
  rmSync(path, { recursive: true, force: true });
}

export function copyFileEnsured(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

export function copyInstallManifest({ root = repoRoot, destination, manifest = loadManifest(root) }) {
  rimraf(destination);
  mkdirSync(destination, { recursive: true });
  for (const item of expandInstallEntries(root, manifest.install)) {
    copyFileEnsured(join(root, item.source), join(destination, item.destination));
  }
}

export function writeExecutable(path, body) {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}
