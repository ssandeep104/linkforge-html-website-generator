// Loads templates.js for tests.
//
// templates.js is a classic (non-module) script — index.html loads it with a
// plain <script> tag, and it publishes itself via `window.LINKFORGE_TEMPLATES`
// / `module.exports` rather than ES exports. `import`ing it under this
// package's "type": "module" would therefore hand back an empty namespace, so
// we evaluate the source with a CommonJS-shaped shim instead, exactly as the
// browser and Node consumers each see it.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '..', '..', 'templates.js'), 'utf8');

const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

export const { TEMPLATES, suggestTemplate, splitItems, partitionGroups } = sandbox.module.exports;

// Build one item. `thumbnail: null` routes the item to a template's link tail.
export function item(source, index, { thumbnail = true } = {}) {
  return {
    id: `${source}-${index}`,
    sourceName: source,
    href: `https://${source}.example/item-${index}`,
    title: `${source} item ${index}`,
    thumbnail: thumbnail ? `https://cdn.${source}.example/thumb-${index}.jpg` : null,
    video: null,
    domain: `${source}.example`,
    category: thumbnail ? 'article' : 'link',
    enabled: true,
  };
}

export function items(source, count, opts) {
  return Array.from({ length: count }, (_, i) => item(source, i, opts));
}

export function context(sourceGroups) {
  const all = sourceGroups.flatMap((g) => g.items);
  return {
    title: 'Test Collection',
    tagline: 'Test tagline',
    today: '2026-07-27',
    sourceGroups,
    all,
    articles: all.filter((i) => i.category === 'article'),
    videos: [],
    gallery: [],
    links: all.filter((i) => i.category === 'link'),
  };
}

export function buildHtml(key, ctx) {
  const out = TEMPLATES[key].build(ctx);
  return out.html || out;
}

export const TEMPLATE_KEYS = Object.keys(sandbox.module.exports.TEMPLATES);
