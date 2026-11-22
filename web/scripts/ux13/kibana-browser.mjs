import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { basicHeader } from './elastic-lab.mjs';
import { dashboardId } from './kibana-dashboard.mjs';

// Independent scripted Kibana UI setup evidence. A data-view screenshot is not
// evidence that its 12 charts, saved links, filter scope or study tasks have parity.
const origin = 'http://127.0.0.1:15601';
const evidence = resolve(dirname(fileURLToPath(import.meta.url)), '../../../lab/ux13/evidence');
const auth = basicHeader('ux13-northstar-viewer', process.env.UX13_VIEWER_PASSWORD);
await mkdir(evidence, { recursive: true });
const records = [];
const failures = [];

async function chartState(page) {
  return page.evaluate(() => {
    const visible = element => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight;
    };
    return {
      visibleCharts: [...document.querySelectorAll('.echChartContent')].filter(visible).length,
      totalCharts: document.querySelectorAll('.echChartContent').length,
      visibleLoadingCharts: [...document.querySelectorAll('[class*="euiLoadingChart"]')].filter(visible).length,
      totalLoadingCharts: document.querySelectorAll('[class*="euiLoadingChart"]').length,
      revenueHeader: document.body.innerText.includes('Revenue over time'),
      channelHeader: document.body.innerText.includes('Orders by channel'),
    };
  });
}

async function requireRenderedCharts(page, name, minimumVisible) {
  try {
    // EUI recommends component-level readiness, rather than the global Kibana
    // spinner. Requiring rendered Elastic Charts avoids accepting skeletons.
    await page.waitForFunction(minimum => {
      const visible = element => {
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < innerHeight;
      };
      const charts = [...document.querySelectorAll('.echChartContent')].filter(visible).length;
      const loading = [...document.querySelectorAll('[class*="euiLoadingChart"]')].filter(visible).length;
      return charts >= minimum && loading === 0;
    }, minimumVisible, { timeout: 90_000 });
  } catch {
    await page.screenshot({ path: join(evidence, `kibana-incomplete-${name}.png`) });
    const state = await chartState(page);
    await writeFile(join(evidence, `kibana-incomplete-${name}.json`), `${JSON.stringify(state, null, 2)}\n`);
    throw new Error(`Kibana ${name} did not render ${minimumVisible} visible charts within 90 seconds; see fictional diagnostic artifact`);
  }
  // A short repaint stabilization after the measured component-level signal.
  await page.waitForTimeout(750);
}

async function restrictToLocalKibana(context) {
  await context.route('**/*', route => {
    const request = route.request();
    if (!request.url().startsWith(`${origin}/`)) return route.abort();
    return route.continue({ headers: { ...request.headers(), authorization: auth } });
  });
}

async function measure(page, name, zoom = 1) {
  const values = await page.evaluate(() => ({ width: innerWidth, height: innerHeight,
    dpr: devicePixelRatio, documentWidth: document.documentElement.scrollWidth,
    focusTag: document.activeElement?.tagName ?? null }));
  const charts = await chartState(page);
  const file = `kibana-${name}.png`;
  await page.screenshot({ path: join(evidence, file), animations: 'disabled' });
  records.push({ name, screenshot: file, zoom, ...values, ...charts });
}

async function confirmDashboard(page) {
  await page.goto(`${origin}/app/dashboards#/view/${dashboardId}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByText('Business performance', { exact: true }).first().waitFor({ timeout: 90_000 });
  assert.equal(page.url().includes('/login'), false, 'Viewer did not reach the saved Kibana dashboard');
}

const browser = await chromium.launch({ headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
try {
  for (const [width, height, name] of [[1440, 900, 'desktop'], [390, 844, 'mobile'], [320, 900, 'narrow']]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    await restrictToLocalKibana(context);
    const page = await context.newPage();
    page.on('pageerror', () => failures.push(`${name}: page error`));
    await confirmDashboard(page);
    await requireRenderedCharts(page, name, width >= 1000 ? 2 : 1);
    await page.keyboard.press('Tab');
    await measure(page, name);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, forcedColors: 'active' });
  await restrictToLocalKibana(context);
  const page = await context.newPage();
  page.on('pageerror', () => failures.push('forced-colors: page error'));
  await confirmDashboard(page);
  await requireRenderedCharts(page, 'forced-colors', 2);
  await measure(page, 'forced-colors');
  await context.close();
} finally { await browser.close(); }

const extension = resolve(dirname(fileURLToPath(import.meta.url)), '../../e2e/zoom-extension');
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  headless: true, viewport: null, args: [
    `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=1440,900',
  ],
});
try {
  await restrictToLocalKibana(context);
  const page = context.pages()[0] ?? await context.newPage();
  await confirmDashboard(page);
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const baseline = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
  for (const zoom of [2, 4]) {
    const actual = await worker.evaluate(async factor => {
      const tabs = chrome.tabs;
      const tab = (await tabs.query({})).find(item => item.url?.includes('/app/dashboards'));
      if (tab?.id === undefined) throw new Error('Kibana tab missing for native zoom');
      await tabs.setZoom(tab.id, factor);
      return tabs.getZoom(tab.id);
    }, zoom);
    await page.waitForFunction(width => innerWidth <= width, baseline.width / zoom + 2);
    const dimensions = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
    assert.ok(Math.abs(actual - zoom) < 0.05);
    assert.ok(Math.abs(dimensions.dpr / baseline.dpr - zoom) < 0.05);
    await page.getByText('Revenue over time', { exact: true }).first().waitFor({ state: 'attached', timeout: 90_000 });
    await page.getByText('Revenue over time', { exact: true }).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1_500);
    await measure(page, `native-${zoom * 100}`, actual);
  }
} finally { await context.close(); }

await writeFile(join(evidence, 'kibana-browser.json'), `${JSON.stringify({
  evidenceKind: 'SCRIPTED_UI_SETUP_ONLY', os: process.platform,
  chromiumVersion: browser.version(), records, pageErrorCount: failures.length,
  parityStatus: 'UNVERIFIED: a 12-panel Kibana setup is not a matched end-to-end task workflow',
  participantCount: 0, limitations: 'No human usability research, screen-reader speech, tenant equivalence or WCAG conformance',
}, null, 2)}\n`);
assert.deepEqual(failures, [], 'Kibana scripted setup encountered page errors');
process.stdout.write(`Kibana 9.5.6 scripted dashboard rendered at ${records.length} viewport/zoom/forced-colors conditions; task parity is unverified.\n`);
