// POST /api/publish
// Body: { slug: string, html: string }
// Deploys the supplied HTML as index.html to a new Vercel project named
// linkforge-<slug>. Reuses an existing project of that name (re-deploys it)
// so the URL stays stable across edits. Returns the public Vercel URL.
//
// Requires VERCEL_TOKEN env var set on the deployment. Optional VERCEL_TEAM_ID
// when the token belongs to a team.

// Default Node runtime (Vercel picks the LTS version from package.json engines).

const VERCEL_API = 'https://api.vercel.com';

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52); // Vercel project names max 100; leave room for "linkforge-" prefix
}

function bad(res, code, message, detail) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: message, detail: detail || null }));
}

async function vercelFetch(path, token, teamId, init = {}) {
  const url = new URL(VERCEL_API + path);
  if (teamId) url.searchParams.set('teamId', teamId);
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    ...(init.headers || {}),
  };
  const resp = await fetch(url, { ...init, headers });
  const text = await resp.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep null */ }
  return { ok: resp.ok, status: resp.status, body: json, raw: text };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type');
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') return bad(res, 405, 'method not allowed');

  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID || null;
  if (!token) return bad(res, 500, 'server not configured: VERCEL_TOKEN missing');

  // Parse body (Vercel passes parsed body for application/json by default;
  // fall back to manual read if not).
  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = body ? JSON.parse(body) : await readJson(req); } catch { return bad(res, 400, 'invalid json'); }
  }
  const rawSlug = (body && body.slug) || '';
  const html = (body && body.html) || '';
  if (!html || typeof html !== 'string') return bad(res, 400, 'missing html');
  if (html.length > 5 * 1024 * 1024) return bad(res, 413, 'html too large (>5MB)');

  const slug = slugify(rawSlug);
  if (!slug) return bad(res, 400, 'slug is empty after normalisation');
  const projectName = `linkforge-${slug}`.slice(0, 100);

  // The deployment endpoint accepts an inline files array. We send a single
  // file (index.html) which Vercel serves as a static site.
  const deployBody = {
    name: projectName,
    project: projectName,
    target: 'production',
    files: [
      {
        file: 'index.html',
        data: Buffer.from(html, 'utf-8').toString('base64'),
        encoding: 'base64',
      },
    ],
    projectSettings: {
      framework: null,
      buildCommand: null,
      installCommand: null,
      outputDirectory: null,
      devCommand: null,
    },
  };

  const dep = await vercelFetch('/v13/deployments', token, teamId, {
    method: 'POST',
    body: JSON.stringify(deployBody),
  });

  if (!dep.ok) {
    return bad(res, 502, 'vercel deploy failed', dep.body || dep.raw);
  }

  // Pick the production-style URL: prefer the project's public alias
  // (<project>.vercel.app); fall back to the per-deployment URL.
  const aliases = (dep.body && (dep.body.alias || dep.body.aliasAssignedAt && dep.body.alias)) || [];
  const directUrl = dep.body?.url ? `https://${dep.body.url}` : null;
  const publicAlias = aliases && aliases.length
    ? `https://${aliases[0]}`
    : `https://${projectName}.vercel.app`;

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.setHeader('access-control-allow-origin', '*');
  res.end(JSON.stringify({
    ok: true,
    project: projectName,
    slug,
    url: publicAlias,
    deploymentUrl: directUrl,
    state: dep.body?.readyState || dep.body?.status || 'QUEUED',
  }));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 6 * 1024 * 1024) reject(new Error('payload too large')); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
