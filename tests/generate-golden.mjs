// Regenerates tests/golden/*.json from parser.js's current output.
//
// Run this deliberately, after reviewing a diff, whenever a change to
// parser.js intentionally alters extraction behavior (Phase 3 accuracy
// fixes, etc.) — never run it blind to "make tests pass" without checking
// what changed and why. For everyday development, tests/sweep.test.js
// compares live output against the checked-in golden files and fails on
// any drift.
//
// Usage: node tests/generate-golden.mjs
import './helpers/dom.js';
import { parseSourceWithMeta } from '../parser.js';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');
const goldenDir = join(__dirname, 'golden');
mkdirSync(goldenDir, { recursive: true });

export function toGolden(result) {
  return {
    unresolvedCount: result.unresolvedCount,
    hasBase: result.hasBase,
    baseURL: result.baseURL,
    jsonLdMeta: result.jsonLdMeta,
    items: (result.items || []).map((it) => ({
      title: it.title,
      href: it.href,
      thumbnail: it.thumbnail,
      video: it.video ?? null,
      description: it.description ?? null,
      domain: it.domain,
      category: it.category,
      pageSection: it.pageSection,
      pattern: it.pattern,
      titleCandidateCount: it.titleCandidates?.length || 0,
      thumbCandidateCount: it.thumbCandidates?.length || 0,
      videoCandidateCount: it.videoCandidates?.length || 0,
    })),
  };
}

// Only run the regeneration loop when invoked directly (not when imported
// by sweep.test.js for the toGolden helper).
if (import.meta.url === `file://${process.argv[1]}`) {
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith('.html')).sort();
  for (const file of files) {
    const html = readFileSync(join(fixturesDir, file), 'utf8');
    const result = parseSourceWithMeta(html, 'Test Source');
    const golden = toGolden(result);
    const outPath = join(goldenDir, file.replace(/\.html$/, '.json'));
    writeFileSync(outPath, JSON.stringify(golden, null, 2) + '\n');
    console.log(`wrote ${outPath} (${golden.items.length} items)`);
  }
}
