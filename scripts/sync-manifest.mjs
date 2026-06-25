#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadManifest, repoRoot } from './manifest.mjs';

const write = process.argv.includes('--write');
const manifest = loadManifest(repoRoot);
const packagePath = join(repoRoot, 'package.json');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const expected = manifest.package.files;
const actual = pkg.files || [];
const same = JSON.stringify(actual) === JSON.stringify(expected);
if (!same) {
  if (!write) {
    console.error('package.json files array is out of sync with papermentor.manifest.json. Run: npm run manifest:write');
    process.exit(1);
  }
  pkg.files = expected;
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log('Updated package.json files from papermentor.manifest.json');
} else {
  console.log('Manifest sync check passed.');
}
