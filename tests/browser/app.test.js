import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let server;
let browser;

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      // The server normally needs a few polling attempts to start.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Linkforge did not start at ${BASE_URL}`);
}

async function openApp(viewport = { width: 1440, height: 1000 }) {
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  return { page, pageErrors };
}

async function loadSampleAndReview(page) {
  await page.locator('[data-load-sample]').click();
  await assert.doesNotReject(() => page.locator('#btn-parse').click());
  await page.locator('#step-review.screen--active').waitFor();
}

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  server?.kill('SIGTERM');
});

test('the initial application shell renders visibly', async () => {
  const { page, pageErrors } = await openApp();
  try {
    await assert.doesNotReject(() => page.locator('#step-input.screen--active').waitFor());
    assert.equal(await page.locator('h1').first().isVisible(), true);
    assert.equal(await page.locator('[data-load-sample]').isVisible(), true);

    const shell = await page.locator('#step-input').boundingBox();
    assert.ok(shell?.width > 0 && shell?.height > 0, 'input screen should occupy visible space');
    assert.deepEqual(pageErrors, []);
  } finally {
    await page.close();
  }
});

test('sample content completes the review and generation flow', async () => {
  const { page, pageErrors } = await openApp();
  try {
    await loadSampleAndReview(page);
    assert.ok(await page.locator('.template-card').count() > 0, 'review should offer templates');
    const extraction = page.locator('#extraction-advanced');
    assert.equal(await extraction.getAttribute('open'), null, 'advanced extraction should start collapsed');
    assert.equal(await page.locator('#source-strategy').isVisible(), false);
    await extraction.locator('summary').click();
    assert.equal(await page.locator('#source-strategy').isVisible(), true);

    await page.locator('#btn-generate').click();
    await page.locator('#step-output.screen--active').waitFor();

    const preview = page.frameLocator('#preview-frame');
    await preview.locator('body').waitFor();
    assert.ok(await preview.locator('a').count() > 0, 'generated site should contain links');
    assert.ok((await preview.locator('body').innerText()).trim().length > 0);
    assert.deepEqual(pageErrors, []);
  } finally {
    await page.close();
  }
});

test('every available web template builds valid HTML', async () => {
  const { page, pageErrors } = await openApp();
  try {
    await loadSampleAndReview(page);

    const results = await page.evaluate(() => {
      const output = {};
      for (const [key, template] of Object.entries(window.LINKFORGE_TEMPLATES)) {
        try {
          __lfState.site.template = key;
          const html = buildGeneratedSite();
          const document = new DOMParser().parseFromString(html, 'text/html');
          output[key] = {
            bytes: html.length,
            title: document.title,
            bodyText: document.body.textContent.trim().length,
          };
        } catch (error) {
          output[key] = { error: error.message };
        }
      }
      return output;
    });

    assert.ok(Object.keys(results).length > 0, 'at least one web template should be registered');
    for (const [name, result] of Object.entries(results)) {
      assert.equal(result.error, undefined, `${name} should build without throwing`);
      assert.ok(result.bytes > 500, `${name} should produce a substantive HTML document`);
      assert.ok(result.title, `${name} should set a document title`);
      assert.ok(result.bodyText > 0, `${name} should render visible content`);
    }
    assert.deepEqual(pageErrors, []);
  } finally {
    await page.close();
  }
});

test('review does not overflow a mobile viewport', async () => {
  const { page, pageErrors } = await openApp({ width: 390, height: 844 });
  try {
    await loadSampleAndReview(page);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(
      dimensions.scrollWidth <= dimensions.clientWidth,
      `page width ${dimensions.scrollWidth}px exceeds viewport ${dimensions.clientWidth}px`,
    );
    assert.deepEqual(pageErrors, []);
  } finally {
    await page.close();
  }
});

test('theme toggle updates the active shell and persists across reloads', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('lf-theme', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    const activeToggle = page.locator('.screen--active [data-theme-toggle]');

    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await activeToggle.getAttribute('aria-label'), 'Switch to light mode');

    await activeToggle.click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.equal(await page.evaluate(() => localStorage.getItem('lf-theme')), 'light');
    assert.equal(await activeToggle.getAttribute('aria-label'), 'Switch to dark mode');

    await page.reload({ waitUntil: 'domcontentloaded' });
    const reloadedToggle = page.locator('.screen--active [data-theme-toggle]');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.equal(await reloadedToggle.getAttribute('aria-label'), 'Switch to dark mode');
    assert.deepEqual(pageErrors, []);
  } finally {
    await context.close();
  }
});

test('mobile review switches between edit and live preview without losing edits', async () => {
  const { page, pageErrors } = await openApp({ width: 390, height: 844 });
  try {
    await loadSampleAndReview(page);

    const editButton = page.locator('[data-review-mode="edit"]');
    const previewButton = page.locator('[data-review-mode="preview"]');
    const editor = page.locator('.review-editor');
    const previewPane = page.locator('.review-preview');

    assert.equal(await editButton.isVisible(), true);
    assert.equal(await previewButton.isVisible(), true);
    assert.equal(await editButton.getAttribute('aria-pressed'), 'true');
    assert.equal(await previewButton.getAttribute('aria-pressed'), 'false');
    assert.equal(await editor.isVisible(), true);
    assert.equal(await previewPane.isVisible(), false);

    const editedTitle = 'Mobile preview state';
    const collectionTitle = page.locator('#review-collection-heading');
    await collectionTitle.fill(editedTitle);
    await previewButton.click();

    assert.equal(await editButton.getAttribute('aria-pressed'), 'false');
    assert.equal(await previewButton.getAttribute('aria-pressed'), 'true');
    assert.equal(await editor.isVisible(), false);
    assert.equal(await previewPane.isVisible(), true);

    const preview = page.frameLocator('#review-live-preview');
    await preview.locator('body').waitFor();
    assert.ok((await preview.locator('body').innerText()).trim().length > 0);
    assert.ok(await preview.locator('a').count() > 0, 'live preview should contain generated links');

    await editButton.click();
    assert.equal(await editButton.getAttribute('aria-pressed'), 'true');
    assert.equal(await previewButton.getAttribute('aria-pressed'), 'false');
    assert.equal(await editor.isVisible(), true);
    assert.equal(await previewPane.isVisible(), false);
    assert.equal(await collectionTitle.innerText(), editedTitle);
    assert.equal(await page.locator('#site-title').inputValue(), editedTitle);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(dimensions.scrollWidth <= dimensions.clientWidth);
    assert.deepEqual(pageErrors, []);
  } finally {
    await page.close();
  }
});

test('review media filters only change visible rows and preserve inclusion state', async () => {
  const { page, pageErrors } = await openApp();
  try {
    await loadSampleAndReview(page);

    const filterValues = ['all', 'link', 'image', 'video'];
    const filterButtons = page.locator('[data-review-filter]');
    assert.equal(await filterButtons.count(), filterValues.length);

    const allRows = page.locator('#categories .item-row');
    const totalRows = await allRows.count();
    assert.ok(totalRows > 0, 'sample review should render extracted item rows');

    const bucketCounts = await allRows.evaluateAll((rows) => rows.reduce((counts, row) => {
      const bucket = row.dataset.reviewFilterKind;
      counts[bucket] = (counts[bucket] || 0) + 1;
      return counts;
    }, {}));
    assert.equal(
      (bucketCounts.link || 0) + (bucketCounts.image || 0) + (bucketCounts.video || 0),
      totalRows,
      'every review row should belong to exactly one filter bucket',
    );

    const enabledBefore = await page.evaluate(() => (
      window.__lfState.items.map((item) => ({ id: item.id, enabled: item.enabled }))
    ));

    for (const filter of filterValues) {
      await page.locator(`[data-review-filter="${filter}"]`).click();

      for (const value of filterValues) {
        assert.equal(
          await page.locator(`[data-review-filter="${value}"]`).getAttribute('aria-pressed'),
          value === filter ? 'true' : 'false',
          `${value} should expose the correct pressed state when ${filter} is active`,
        );
      }

      const visibleRows = page.locator('#categories .item-row:visible');
      const expectedCount = filter === 'all' ? totalRows : (bucketCounts[filter] || 0);
      assert.equal(await visibleRows.count(), expectedCount);

      const visibleBuckets = await visibleRows.evaluateAll((rows) => (
        rows.map((row) => row.dataset.reviewFilterKind)
      ));
      if (filter !== 'all') {
        assert.ok(
          visibleBuckets.every((bucket) => bucket === filter),
          `${filter} should only show rows from its own bucket`,
        );
      }
    }

    const enabledAfter = await page.evaluate(() => (
      window.__lfState.items.map((item) => ({ id: item.id, enabled: item.enabled }))
    ));
    assert.deepEqual(enabledAfter, enabledBefore, 'view filtering must not change item inclusion');
    assert.deepEqual(pageErrors, []);
  } finally {
    await page.close();
  }
});
