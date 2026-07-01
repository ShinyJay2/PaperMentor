#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expandPatterns, loadManifest, matchesAny, packageFiles, repoRoot } from './manifest.mjs';

const manifest = loadManifest(repoRoot);
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const expectedFilesArray = manifest.package.files;
const failures = [];
if (JSON.stringify(pkg.files || []) !== JSON.stringify(expectedFilesArray)) {
  failures.push('package.json files array is out of sync with papermentor.manifest.json; run npm run manifest:write');
}

const npmCache = mkdtempSync(join(tmpdir(), 'papermentor-npm-cache-'));
let pack;
try {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      npm_config_cache: npmCache,
      npm_config_update_notifier: 'false',
      npm_config_audit: 'false',
      npm_config_fund: 'false'
    }
  });
  [pack] = JSON.parse(output);
} finally {
  rmSync(npmCache, { recursive: true, force: true });
}
const files = pack.files || [];
const paths = files.map((file) => file.path);
const expectedPackageFiles = packageFiles(repoRoot, manifest);
const forbidden = paths.filter((path) => matchesAny(path, manifest.package.forbidden));
const missing = expectedPackageFiles.filter((path) => !paths.includes(path));
const limits = manifest.package.limits || {};
const maxPackageSize = Number(process.env.PAPERMENTOR_MAX_PACK_BYTES || limits.maxPackedBytes || 3500000);
const maxUnpackedSize = Number(process.env.PAPERMENTOR_MAX_UNPACKED_BYTES || limits.maxUnpackedBytes || 5500000);
const maxFiles = Number(process.env.PAPERMENTOR_MAX_PACK_FILES || limits.maxFiles || 130);

if (forbidden.length) failures.push(`forbidden package files: ${forbidden.join(', ')}`);
if (missing.length) failures.push(`missing expected package files: ${missing.join(', ')}`);
if (pack.size > maxPackageSize) failures.push(`package tarball too large: ${pack.size} > ${maxPackageSize}`);
if (pack.unpackedSize > maxUnpackedSize) failures.push(`package unpacked size too large: ${pack.unpackedSize} > ${maxUnpackedSize}`);
if (files.length > maxFiles) failures.push(`too many packed files: ${files.length} > ${maxFiles}`);
for (const required of expandPatterns(repoRoot, ['scripts/papermentor-session.mjs', 'scripts/install.mjs', 'scripts/manifest.mjs', 'assets/mathjax/tex-svg.js', 'assets/fonts/pretendard/PretendardVariable.woff2', 'skills/papermentor/SKILL.md'])) {
  if (!paths.includes(required)) failures.push(`missing required package file: ${required}`);
}
if (failures.length) {
  console.error(`PaperMentor package check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`PaperMentor package check passed (${files.length} files, ${pack.size} bytes packed, ${pack.unpackedSize} bytes unpacked).`);
