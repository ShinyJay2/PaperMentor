#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const output = execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const [pack] = JSON.parse(output);
const files = pack.files || [];
const paths = files.map((file) => file.path);
const forbidden = paths.filter((path) => {
  if (/^(?:\.claude|\.github|\.omx|\.omc|\.papermentor)(?:\/|$)/.test(path)) return true;
  if (path === 'image.png' || /(?:^|\/)Screenshot[^/]*\.png$/i.test(path) || /(?:^|\/)스크린샷[^/]*\.png$/.test(path)) return true;
  if (path === 'assets/social-preview.png') return true;
  if (/\.(?:pdf|ppt|pptx|key)$/i.test(path)) return true;
  return false;
});
const maxPackageSize = Number(process.env.PAPERMENTOR_MAX_PACK_BYTES || 3500000);
const maxUnpackedSize = Number(process.env.PAPERMENTOR_MAX_UNPACKED_BYTES || 5500000);
const maxFiles = Number(process.env.PAPERMENTOR_MAX_PACK_FILES || 120);
const failures = [];
if (forbidden.length) failures.push(`forbidden package files: ${forbidden.join(', ')}`);
if (pack.size > maxPackageSize) failures.push(`package tarball too large: ${pack.size} > ${maxPackageSize}`);
if (pack.unpackedSize > maxUnpackedSize) failures.push(`package unpacked size too large: ${pack.unpackedSize} > ${maxUnpackedSize}`);
if (files.length > maxFiles) failures.push(`too many packed files: ${files.length} > ${maxFiles}`);
for (const required of ['scripts/papermentor-session.mjs', 'scripts/validate.mjs', 'assets/mathjax/tex-svg.js', 'assets/fonts/pretendard/PretendardVariable.woff2', 'skills/papermentor/SKILL.md']) {
  if (!paths.includes(required)) failures.push(`missing required package file: ${required}`);
}
if (failures.length) {
  console.error(`PaperMentor package check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`PaperMentor package check passed (${files.length} files, ${pack.size} bytes packed, ${pack.unpackedSize} bytes unpacked).`);
