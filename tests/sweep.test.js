// Regression net: runs parser.js against every tests/fixtures/*.html and
// deep-compares the output to the checked-in tests/golden/*.json snapshot.
//
// A failure here does NOT necessarily mean parser.js is wrong — it means
// output changed. If the change is an intentional accuracy fix, review the
// diff, then regenerate with `node tests/generate-golden.mjs` and commit the
// updated golden file alongside the code change.
import './helpers/dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSourceWithMeta } from '../parser.js';
import { toGolden } from './generate-golden.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');
const goldenDir = join(__dirname, 'golden');

const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith('.html')).sort();

for (const file of fixtures) {
  test(`parseSourceWithMeta matches golden output: ${file}`, () => {
    const html = readFileSync(join(fixturesDir, file), 'utf8');
    const result = parseSourceWithMeta(html, 'Test Source');
    const actual = toGolden(result);
    const goldenPath = join(goldenDir, file.replace(/\.html$/, '.json'));
    const expected = JSON.parse(readFileSync(goldenPath, 'utf8'));
    assert.deepEqual(actual, expected);
  });
}
