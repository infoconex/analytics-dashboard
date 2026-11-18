import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { platform, release, arch } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFixtures } from '../ux13/lab-fixtures.mjs';
import { dashboardId as kibanaId } from '../ux13/kibana-dashboard.mjs';
import { basicHeader } from '../ux13/elastic-lab.mjs';
import { dashboardId as analyticsId, restrictAnalytics, assertNoApiWrites } from './analytics-fixture.mjs';
import { tasks, decidePair, assertEvidenceSafe } from './task-parity.mjs';
import { classifyConsoleError, summarizeBrowserErrors } from './browser-observations.mjs';

// Captures automation-only, synthetic evidence. Does not score human task
// success; no participant fields, recordings, telemetry or stored credentials.
const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '../../../');
const output = join(root, 'lab/ux14/evidence');
const raw = join(output, 'raw');
const web = 'http://127.0.0.1:5173';
const elasticUi = 'http://127.0.0.1:15601';
const source = JSON.parse(await readFile(join(root, 'lab/ux13/fixtures/manifest.json'), 'utf8'));
const environments = JSON.parse(await readFile(join(root, 'lab/ux13/evidence/environment.json'), 'utf8'));
const osRelease = await readFile('/etc/os-release', 'utf8').catch(() => '');
const osName = osRelease.match(/^PRETTY_NAME=(.*)$/m)?.[1].replace(/^"|"$/g, '') ?? null;
await checkFixtures();
await mkdir(raw, { recursive: true });
const summary = { schemaVersion: 1, status: 'SCRIPTED_FICTIONAL_BROWSER_EVIDENCE_NOT_HUMAN_RESEARCH',
  issue: 54, sourceFixtureSha256: source.sourceSha256, fictionalOnly: true, participantCount: 0,
  environment: { platform: platform(), release: release(), distribution: osName, architecture: arch(), node: process.version,
    analyticsCommit: process.env.GITHUB_SHA ?? null, githubRunId: process.env.GITHUB_RUN_ID ?? null,
    githubRef: process.env.GITHUB_REF ?? null, prHeadSha: process.env.UX14_PR_HEAD_SHA ?? null,
    elasticVersion: '9.5.6', kibanaVersion: '9.5.6',
    elasticImages: environments.images ?? null, docker: environments.docker, compose: environments.compose,
    ux13EnvironmentGitHead: environments.gitHead },
  paths: [], captures: [], taskDecisions: [], findings: [], limitations: [
    'Script follows predefined labels; it does not demonstrate unassisted human discovery or effort.',
    'Task equivalence, organization/security models, actual AT speech, WCAG conformance and independent study gates remain distinct.',
    'Kibana relative-time label applies to undated source rows; visual context differs and must not be read as a real time period.',
  ] };
const errors = [];

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
summary.environment.chromium = browser.version();
const auth = basicHeader('ux13-northstar-viewer', process.env.UX13_VIEWER_PASSWORD);
const modes = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
  { id: 'narrow', width: 320, height: 900 },
  { id: 'forced-colors', width: 1440, height: 900, forcedColors: 'active' },
];

async function restrictKibana(context) {
  const blocked = [];
  await context.route('**/*', route => {
    if (!route.request().url().startsWith(`${elasticUi}/`)) {
      blocked.push({ type: 'external-network-blocked' });
      return route.abort();
    }
    return route.continue({ headers: { ...route.request().headers(), authorization: auth } });
  });
  return blocked;
}

async function connect(context, product) {
  return product === 'analytics' ? restrictAnalytics(context, web) : restrictKibana(context);
}

async function measure(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    const heading = document.querySelector('main h1, h1');
    return { viewportCss: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio,
      documentWidth: document.documentElement.scrollWidth, focusTag: active?.tagName ?? null,
      focusText: (active?.getAttribute('aria-label') || active?.textContent || '').trim().slice(0, 100),
      headingText: heading?.textContent?.trim().slice(0, 100) ?? null,
      chartNodes: document.querySelectorAll('.echChartContent, .recharts-responsive-container').length,
      forcedColors: matchMedia('(forced-colors: active)').matches };
  });
}

async function capture(page, product, task, state, mode, zoom = 1) {
  const file = `${product}-${task}-${state}-${mode}.png`;
  await page.screenshot({ path: join(raw, file), animations: 'disabled', timeout: 30_000 });
  const dimensions = await measure(page);
  summary.captures.push({ product, task, state, mode, screenshot: `raw/${file}`, zoom, ...dimensions });
}

async function captureNativeCdp(page, product, task, state, mode, zoom) {
  // Native zoom can cause Playwright's page screenshot and CSS geometry to
  // disagree after scroll. Independently capture Chrome's compositor viewport
  // (the path used by the UX-11 native-zoom regression) for visual adjudication.
  const session = await page.context().newCDPSession(page);
  try {
    const rawScreenshot = await session.send('Page.captureScreenshot', {
      format: 'png', fromSurface: false, captureBeyondViewport: false,
    });
    const file = `${product}-${task}-${state}-${mode}.png`;
    await writeFile(join(raw, file), Buffer.from(rawScreenshot.data, 'base64'));
    summary.captures.push({ product, task, state, mode, screenshot: `raw/${file}`, zoom,
      captureMethod: 'chromium-cdp-fromSurface-false', ...await measure(page) });
  } finally { await session.detach(); }
}

async function openFromCatalog(page, product) {
  const initial = product === 'analytics'
    ? `${web}/#/organization/northstar/dashboards` : `${elasticUi}/app/dashboards`;
  await page.goto(initial, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (product === 'analytics') {
    await page.getByRole('heading', { name: 'Dashboards', exact: true }).waitFor({ timeout: 60_000 });
    await page.getByRole('button', { name: 'View dashboard' }).click();
    await page.getByRole('article', { name: 'Revenue over time' }).waitFor({ timeout: 30_000 });
  } else {
    await page.getByText('Business performance', { exact: true }).first().waitFor({ timeout: 90_000 });
    await page.getByText('Business performance', { exact: true }).first().click();
    await page.getByText('Revenue over time', { exact: true }).first().waitFor({ timeout: 90_000 });
    await page.waitForFunction(() => document.querySelectorAll('.echChartContent').length >= 2, null,
      { timeout: 90_000 });
    await page.waitForTimeout(750);
  }
  const destination = page.url();
  assert.ok(product === 'analytics' ? destination.includes(analyticsId)
    : destination.includes(kibanaId), 'Browser did not arrive at expected saved dashboard');
  return destination;
}

async function runDiscovery(product, mode) {
  const context = await browser.newContext({ viewport: { width: mode.width, height: mode.height },
    forcedColors: mode.forcedColors, reducedMotion: 'reduce' });
  const blocked = await connect(context, product);
  const page = await context.newPage();
  page.on('pageerror', () => errors.push({ product, mode: mode.id, category: 'browser-pageerror' }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ product, mode: mode.id,
    category: 'browser-console-error', kind: classifyConsoleError(message.text()) }); });
  const result = { product, task: 'T02', mode: mode.id, initial: 'dashboard-catalog',
    role: 'read-only', fixtureSha: source.sourceSha256, completed: false };
  try {
    await page.goto(product === 'analytics' ? `${web}/#/organization/northstar/dashboards`
      : `${elasticUi}/app/dashboards`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    if (product === 'analytics') await page.getByRole('heading', { name: 'Dashboards', exact: true }).waitFor();
    else await page.getByText('Business performance', { exact: true }).first().waitFor({ timeout: 90_000 });
    await capture(page, product, 'T02', 'catalog', mode.id);
    // Navigation is a real UI click from a clean catalog, never a direct link to the goal.
    if (product === 'analytics') await page.getByRole('button', { name: 'View dashboard' }).click();
    else await page.getByText('Business performance', { exact: true }).first().click();
    if (product === 'analytics') await page.getByRole('article', { name: 'Revenue over time' }).waitFor();
    else {
      await page.getByText('Revenue over time', { exact: true }).first().waitFor({ timeout: 90_000 });
      await page.waitForFunction(() => document.querySelectorAll('.echChartContent').length >= 2, null, { timeout: 90_000 });
      await page.waitForTimeout(750);
    }
    assert.ok(page.url().includes(product === 'analytics' ? analyticsId : kibanaId));
    await page.keyboard.press('Tab');
    await capture(page, product, 'T02', 'revenue', mode.id);
    result.endpoint = 'revenue-view';
    result.completed = true;
  } catch {
    result.failureClass = 'script-or-task-path-unverified';
    await capture(page, product, 'T02', 'incomplete', mode.id).catch(() => {});
  } finally {
    result.blockedExternalRequests = blocked.filter(item => item.type === 'external-network-blocked').length;
    summary.paths.push(result);
    await context.close();
  }
}

async function runAnalyticsTaskChecks() {
  let currentTask = 'T03';
  async function freshTask(taskId, verification) {
    currentTask = taskId;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const writes = await restrictAnalytics(context, web);
    const page = await context.newPage();
    try {
      await openFromCatalog(page, 'analytics');
      await verification(page);
      assertNoApiWrites(writes);
    } finally { await context.close(); }
  }
  try {
    await freshTask('T03', async page => {
      const revenue = page.getByRole('article', { name: 'Revenue over time' });
      await revenue.getByText('What this means').click();
      const meaning = await revenue.getByText('Cannot conclude').isVisible();
      summary.paths.push({ product: 'analytics', task: 'T03', completed: meaning, endpoint: 'metric-limit-disclosure', initial: 'fresh-revenue-view' });
    });
    await freshTask('T04', async page => {
      const revenue = page.getByRole('article', { name: 'Revenue over time' });
      await revenue.getByText('View data table').click();
      const october = await revenue.getByRole('table').getByText('$41,400').isVisible();
      assert.ok(october, 'October exact value absent from source table');
      await revenue.getByRole('row').filter({ hasText: 'Oct' }).scrollIntoViewIfNeeded();
      await capture(page, 'analytics', 'T04', 'october-row', 'desktop');
      summary.paths.push({ product: 'analytics', task: 'T04', completed: true, endpoint: 'source-table-october-41400', initial: 'fresh-revenue-view' });
    });
    // T05 -> T06 -> T07 is the explicitly dependent exception: preserve the
    // verified previous filter selection, and do not reset between substeps.
    await freshTask('T05-T07', async page => {
      const revenue = page.getByRole('article', { name: 'Revenue over time' });
      await revenue.getByText('View data table').click();
      await page.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m');
      await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
      assert.equal(await revenue.getByRole('table').getByText('$18,400').count(), 0);
      assert.ok(await revenue.getByRole('table').getByText('$41,400').isVisible());
      await capture(page, 'analytics', 'T05', 'independent-filters', 'desktop');
      summary.paths.push({ product: 'analytics', task: 'T05', completed: true, endpoint: 'oct-dec-and-direct', initial: 'fresh-unfiltered-view' });
      await page.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('12m');
      assert.ok(await revenue.getByRole('table').getByText('$18,400').isVisible());
      assert.equal(await page.getByRole('combobox', { name: 'Marketing channel' }).inputValue(), 'Direct');
      summary.paths.push({ product: 'analytics', task: 'T06', completed: true, endpoint: 'jan-dec-and-direct', initial: 'verified-T05-state' });
      await page.getByRole('button', { name: 'Reset filters' }).click();
      assert.equal(await page.getByRole('combobox', { name: 'Marketing channel' }).inputValue(), '');
      summary.paths.push({ product: 'analytics', task: 'T07', completed: true, endpoint: 'all-sample-records', initial: 'verified-T06-state' });
    });
    await freshTask('T08', async page => {
      await page.getByRole('combobox', { name: 'Find a visualization' }).selectOption('996e3063-18e9-4ddb-887a-229198c6dd12');
      await page.getByRole('button', { name: 'Go to visualization' }).click();
      await page.getByRole('heading', { name: 'Insight 12' }).waitFor();
      await page.getByRole('button', { name: 'Back to visualization list from Insight 12' }).click();
      assert.ok(await page.getByRole('button', { name: '12. Insight 12' }).evaluate(el => el === document.activeElement));
      await capture(page, 'analytics', 'T08', 'index-focus', 'desktop');
      summary.paths.push({ product: 'analytics', task: 'T08', completed: true, endpoint: 'focused-index-12', initial: 'fresh-dense-dashboard' });
    });
    await freshTask('T09', async page => {
      const revenue = page.getByRole('article', { name: 'Revenue over time' });
      await page.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m');
      await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
      // The per-insight handoff is inside the optional disclosure, not a
      // persistent filter-bearing URL. Inspect the actual read-only link.
      await revenue.getByText('What this means').click();
      await revenue.getByRole('button', { name: 'Share this insight’s context' }).click();
      const dialog = page.getByRole('dialog', { name: 'Share insight context' });
      await dialog.waitFor();
      const link = await dialog.getByRole('textbox', { name: 'Saved dashboard link' }).inputValue();
      assert.equal(new URL(link).origin, new URL(web).origin);
      assert.ok(link.endsWith(analyticsId) && !link.includes('?'), 'Saved URL must not serialize temporary selections');
      await dialog.getByText('Include this insight’s context and exact values').click();
      const note = await dialog.getByRole('textbox', { name: 'Context note (selectable text)' }).inputValue();
      assert.ok(note.includes('Final 3 sample months') && note.includes('Marketing channels: Direct') &&
        note.includes('Oct: $41,400'), 'Standalone snapshot must disclose exact selected fictional rows');
      await capture(page, 'analytics', 'T09', 'handoff', 'desktop');
      const revisit = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const revisitWrites = await restrictAnalytics(revisit, web);
      try {
        const revisitPage = await revisit.newPage();
        await revisitPage.goto(link);
        await revisitPage.getByRole('article', { name: 'Revenue over time' }).waitFor();
        assert.equal(await revisitPage.getByRole('combobox', { name: 'Date range (commerce only)' }).inputValue(), '12m');
        assert.equal(await revisitPage.getByRole('combobox', { name: 'Marketing channel' }).inputValue(), '');
        assert.ok(!await revisitPage.getByRole('article', { name: 'Revenue over time' }).getByText('Cannot conclude').isVisible());
        assertNoApiWrites(revisitWrites);
      } finally { await revisit.close(); }
      summary.paths.push({ product: 'analytics', task: 'T09', completed: true, endpoint: 'independent-authorized-saved-link-revisit-defaults', initial: 'fresh-saved-view-with-transient-filters' });
    });
  } catch (error) {
    summary.findings.push({ category: 'test-script-defect-or-product-defect', id: 'UX14-ANALYTICS-PATH',
      task: currentTask, note: 'A scripted Analytics endpoint assertion failed; not a participant failure.' });
    process.stderr.write(`UX-14 scripted Analytics ${currentTask}: ${error?.name ?? 'Error'}: ${String(error?.message ?? '').split('\n')[0].slice(0, 200)}\n`);
    throw new Error(`Analytics ${currentTask} scripted task verification failed; do not approve paired scoring`);
  }
}

async function runKibanaTaskChecks() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await restrictKibana(context);
  const page = await context.newPage();
  try {
    await openFromCatalog(page, 'kibana');
    await capture(page, 'kibana', 'T04', 'dashboard-no-source-row', 'desktop');
    summary.paths.push({ product: 'kibana', task: 'T04', completed: false,
      failureClass: 'task-parity-limitation', note: 'Original October _source row not yet reached by a verified UI path; a plotted point is insufficient' });
    summary.paths.push({ product: 'kibana', task: 'T05', completed: false,
      failureClass: 'task-parity-limitation', note: 'No verified independent per-dataset filter/reset control path' });
    const share = page.getByRole('button', { name: 'Share', exact: true }).first();
    if (await share.isVisible()) {
      await share.click();
      await capture(page, 'kibana', 'T09', 'share-options', 'desktop');
    }
    summary.paths.push({ product: 'kibana', task: 'T09', completed: false,
      failureClass: 'task-parity-limitation', note: 'Saved link state and transient-filter behavior not verified end to end' });
  } catch {
    summary.paths.push({ product: 'kibana', task: 'T04', completed: false,
      failureClass: 'script-or-environment-setup', note: 'Kibana detail path failed; inspect CI lab artifacts' });
  } finally { await context.close(); }
}

async function runAnalyticsSpecialStates() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const attempts = await restrictAnalytics(context, web);
  const page = await context.newPage();
  try {
    await page.goto(`${web}/#/organization/northstar/dashboard/not-found`);
    await page.getByRole('heading', { name: 'Dashboard not found' }).waitFor();
    await capture(page, 'analytics', 'T10A', 'missing-recovery', 'desktop');
    await page.getByRole('button', { name: 'Back to dashboards' }).click();
    assert.ok(await page.getByRole('heading', { name: 'Dashboards', exact: true }).evaluate(el => el === document.activeElement));
    summary.paths.push({ product: 'analytics', task: 'T10A', completed: true });
    await page.goto(`${web}/sample-host.html`);
    const frame = page.frameLocator('iframe.host-frame');
    await frame.getByRole('heading', { name: 'Business performance' }).waitFor();
    await frame.getByRole('article', { name: 'Revenue over time' }).getByText('View data table').click();
    assert.ok(await frame.getByRole('table').getByText('$41,400').isVisible());
    await frame.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
    assert.equal(await frame.getByRole('combobox', { name: 'Marketing channel' }).inputValue(), 'Direct');
    await frame.getByRole('button', { name: 'Reset filters' }).click();
    assert.equal(await frame.getByRole('combobox', { name: 'Marketing channel' }).inputValue(), '');
    await frame.getByRole('button', { name: 'Share', exact: true }).click();
    const share = frame.getByRole('dialog', { name: 'Share dashboard' });
    const embeddedLink = await share.getByRole('textbox', { name: 'Saved dashboard link' }).inputValue();
    assert.ok(embeddedLink.endsWith(analyticsId) && !embeddedLink.includes('?'));
    await frame.getByRole('row').filter({ hasText: 'Oct' }).scrollIntoViewIfNeeded();
    await capture(page, 'analytics', 'T13', 'same-origin-host', 'desktop');
    summary.paths.push({ product: 'analytics', task: 'T13', completed: true, note: 'Same-origin sample only; no equivalent Kibana host' });
    assertNoApiWrites(attempts);
  } finally { await context.close(); }
  const failureContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await restrictAnalytics(failureContext, web);
  await failureContext.route('**/api/organizations/northstar/dashboards', route =>
    route.fulfill({ status: 503, body: 'Disposable synthetic list outage' }));
  const failurePage = await failureContext.newPage();
  try {
    await failurePage.goto(`${web}/#/organization/northstar/dashboards`);
    await failurePage.getByRole('heading', { name: 'Dashboards temporarily unavailable' }).waitFor();
    await capture(failurePage, 'analytics', 'T10B', 'list-unavailable', 'desktop');
    summary.paths.push({ product: 'analytics', task: 'T10B', completed: true,
      note: 'Controlled Analytics-only 503 state; no cross-product outage parity' });
  } finally { await failureContext.close(); }
}

async function runZoom(product) {
  const extension = resolve(scriptDir, '../../e2e/zoom-extension');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium',
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, headless: true,
    viewport: null, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=1440,900'],
  });
  await connect(context, product);
  const page = context.pages()[0] ?? await context.newPage();
  try {
    await openFromCatalog(page, product);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const baseline = await measure(page);
    for (const factor of [2, 4]) {
      // Reset scroll before each independent zoom condition; chart-target
      // inspection below deliberately scrolls after the initial screenshot.
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        for (const element of document.querySelectorAll('*')) if (element.scrollTop > 0) element.scrollTop = 0;
      });
      const actual = await worker.evaluate(async ({ target, factor }) => {
        const tab = (await chrome.tabs.query({})).find(t => t.url?.includes(target));
        if (tab?.id === undefined) throw new Error('Native-zoom target tab absent');
        await chrome.tabs.setZoom(tab.id, factor);
        return chrome.tabs.getZoom(tab.id);
      }, { target: product === 'analytics' ? analyticsId : kibanaId, factor });
      await page.waitForFunction(w => innerWidth <= w, baseline.viewportCss.width / factor + 2);
      const observed = await measure(page);
      assert.ok(Math.abs(actual - factor) < 0.05 &&
        Math.abs(observed.dpr / baseline.dpr - factor) < 0.05, 'Zoom must be genuine Chromium tab zoom');
      await capture(page, product, 'T02', 'revenue', `native-${factor * 100}`, actual);
      const target = product === 'analytics'
        ? page.getByRole('heading', { name: 'Revenue over time', exact: true }).first()
        : page.getByText('Revenue over time', { exact: true }).first();
      try {
        await target.scrollIntoViewIfNeeded({ timeout: 10_000 });
        await page.waitForTimeout(350);
        const visibility = await target.evaluate(element => {
          const r = element.getBoundingClientRect();
          const x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2));
          const y = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
          const hit = document.elementFromPoint(x, y);
          return { targetTopCss: Math.round(r.top), targetBottomCss: Math.round(r.bottom),
            withinViewport: r.bottom > 0 && r.top < innerHeight && r.width > 0,
            unobscuredAtCenter: hit === element || element.contains(hit) };
        });
        await capture(page, product, 'T02', 'chart-target', `native-${factor * 100}`, actual);
        try {
          await captureNativeCdp(page, product, 'T02', 'chart-target-cdp', `native-${factor * 100}`, actual);
        } catch {
          summary.findings.push({ category: 'test-script-or-browser-capture-limitation', id: `CDP-14-${product}-${factor}`,
            note: 'Independent native Chromium compositor screenshot was not available; never infer visibility from DOM geometry alone.' });
        }
        summary.paths.push({ product, task: 'T02', mode: `native-${factor * 100}-chart-target`,
          completed: true, ...visibility });
      } catch {
        await capture(page, product, 'T02', 'chart-target-unverified', `native-${factor * 100}`, actual).catch(() => {});
        summary.paths.push({ product, task: 'T02', mode: `native-${factor * 100}-chart-target`,
          completed: false, failureClass: 'zoom-target-or-test-script-limitation' });
      }
    }
    summary.paths.push({ product, task: 'T02', mode: 'native-zoom', completed: true });
  } catch {
    summary.findings.push({ category: 'environment-or-test-script-defect', id: `UX14-${product}-ZOOM`,
      note: 'Native Chromium zoom path incomplete; related screenshots must not be labeled complete' });
  } finally { await context.close(); }
}

async function makeSheet(productA, productB, mode) {
  // At real browser zoom, chart-target DevTools captures show the actual
  // scrolled pixels; the Playwright top-of-page snapshot may show only chrome.
  const state = mode.startsWith('native-') ? 'chart-target-cdp' : 'revenue';
  const a = summary.captures.find(item => item.product === productA && item.task === 'T02' && item.state === state && item.mode === mode);
  const b = summary.captures.find(item => item.product === productB && item.task === 'T02' && item.state === state && item.mode === mode);
  if (!a || !b) return;
  const aData = (await readFile(join(output, a.screenshot))).toString('base64');
  const bData = (await readFile(join(output, b.screenshot))).toString('base64');
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    // Visual review sheet is a labeled derivative; original PNGs remain intact.
    await page.setContent(`<style>body{font-family:Arial,sans-serif;margin:0;padding:18px;background:#fafafa;color:#111}
      h1{font-size:20px;margin:0 0 8px}p{font-size:12px;margin:0 0 14px}.pair{display:flex;gap:12px}
      figure{width:50%;margin:0;min-width:0}figcaption{font-weight:bold;margin-bottom:8px}
      img{width:100%;height:auto;border:1px solid #888;box-sizing:border-box}</style>
      <h1>UX-14 T02 — scripted catalog to fictional revenue view (${mode})</h1>
      <p>Both images scaled equally for visual review; open original PNGs for native pixels. No human superiority or WCAG claim.</p>
      <div class=pair><figure><figcaption>Analytics Dashboard</figcaption><img src="data:image/png;base64,${aData}"></figure>
      <figure><figcaption>Kibana 9.5.6</figcaption><img src="data:image/png;base64,${bData}"></figure></div>`);
    await page.locator('img').last().evaluate(async () => Promise.all([...document.images].map(image => image.decode())));
    const file = `review-T02-${mode}.png`;
    await page.screenshot({ path: join(output, file), fullPage: true });
    summary.captures.push({ product: 'paired-derivative', task: 'T02', state: 'review-sheet', mode, screenshot: file });
  } finally { await context.close(); }
}

try {
  for (const mode of modes) {
    for (const product of ['analytics', 'kibana']) await runDiscovery(product, mode);
  }
  await runAnalyticsTaskChecks();
  await runKibanaTaskChecks();
  await runAnalyticsSpecialStates();
  await runZoom('analytics');
  await runZoom('kibana');
  for (const product of ['analytics', 'kibana']) {
    for (const mode of modes) {
      assert.ok(summary.paths.some(path => path.product === product && path.task === 'T02' &&
        path.mode === mode.id && path.completed), `${product} ${mode.id} catalog path incomplete`);
    }
    for (const zoom of [200, 400]) {
      assert.ok(summary.paths.some(path => path.product === product && path.mode === `native-${zoom}-chart-target` && path.completed),
        `${product} native ${zoom}% chart target incomplete`);
      assert.ok(summary.captures.some(capture => capture.product === product && capture.task === 'T02' &&
        capture.state === 'chart-target-cdp' && capture.mode === `native-${zoom}`),
      `${product} native ${zoom}% original Chromium pixel capture missing`);
    }
  }
  const desktop = Object.fromEntries(['analytics', 'kibana'].map(product => [product,
    summary.paths.find(path => path.task === 'T02' && path.product === product && path.mode === 'desktop')]));
  for (const task of tasks) summary.taskDecisions.push({ id: task.id, goal: task.goal,
    decision: decidePair(task, task.id === 'T02' ? desktop : {}), gate: task.gate });
  if (decidePair(tasks[1], desktop) === 'conditional-scripted-pair') {
    for (const mode of [...modes.map(item => item.id), 'native-200', 'native-400'])
      await makeSheet('analytics', 'kibana', mode);
  }
  summary.findings.push({ id: 'PARITY-14-01', category: 'task-parity-limitation',
    note: 'Only T02 can qualify a scripted comparison once both fresh catalog UI paths pass; no R1 or R2 study approval' });
  summary.findings.push({ id: 'HYP-14-01', category: 'hypothesis-requiring-human-research',
    note: 'Different context, time-picker and dashboard index treatments may affect understanding; no participant evidence' });
  summary.findings.push(...summarizeBrowserErrors(errors).map(item => ({ id: 'BROWSER-14', ...item })));
  await copyFile(join(root, 'lab/ux13/evidence/environment.json'), join(output, 'ux13-environment.json'));
  await copyFile(join(root, 'lab/ux13/fixtures/manifest.json'), join(output, 'ux13-fixture-manifest.json'));
  assertEvidenceSafe(summary);
  const files = (await readdir(raw)).filter(file => file.endsWith('.png'));
  const fileNames = [...files.map(file => `raw/${file}`), ...(await readdir(output)).filter(file =>
    file.startsWith('review-') || file.startsWith('ux13-'))];
  summary.checksums = Object.fromEntries(await Promise.all(fileNames.sort().map(async file => [file,
    createHash('sha256').update(await readFile(join(output, file))).digest('hex')])));
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify(summary, null, 2)}\n`);
  assert.ok(summary.paths.some(path => path.task === 'T02' && path.product === 'analytics' && path.completed));
  assert.ok(summary.paths.some(path => path.task === 'T02' && path.product === 'kibana' && path.completed),
    'Kibana catalog-to-dashboard browser path must complete before this evaluation can pass');
  assert.equal(errors.filter(error => error.category === 'browser-pageerror').length, 0,
    'Browser page errors must be triaged');
  process.stdout.write(`UX-14 synthetic browser evidence: ${summary.captures.length} images, ${summary.paths.length} paths; T02 ${summary.taskDecisions[1].decision}; no human scoring.\n`);
} catch (error) {
  summary.status = 'INCOMPLETE_SCRIPTED_EVIDENCE_NOT_FOR_PAIRING';
  summary.failClosed = true;
  assertEvidenceSafe(summary);
  await writeFile(join(output, 'incomplete-diagnostic.json'), `${JSON.stringify(summary, null, 2)}\n`);
  throw error;
} finally { await browser.close(); }
