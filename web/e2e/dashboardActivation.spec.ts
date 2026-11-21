import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

async function capture(page: Page, info: TestInfo, name: string) {
  await page.mouse.move(8, 8);
  const path = info.outputPath(`ux28-${name}.png`);
  await page.screenshot({ path, animations: 'disabled', fullPage: false });
  const dialogs = page.getByRole('dialog');
  const bounds = await dialogs.count() ? await dialogs.first().boundingBox() : null;
  if (bounds) {
    const viewport = page.viewportSize()!;
    expect(bounds.x).toBeGreaterThanOrEqual(-1);
    expect(bounds.y).toBeGreaterThanOrEqual(-1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await info.attach(name, { path, contentType: 'image/png' });
  await writeFile(info.outputPath(`ux28-${name}.json`), JSON.stringify({
    viewport: page.viewportSize(), horizontalOverflow: overflow, sampleOnly: true,
  }, null, 2));
}

async function createEmpty(page: Page, name: string) {
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: 'New dashboard', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create dashboard' });
  await expect(dialog).toContainText('saved first');
  await dialog.getByRole('textbox', { name: 'Dashboard name' }).fill(name);
  await dialog.getByRole('textbox', { name: 'Description' }).fill('Fictional first-dashboard workflow');
  await dialog.getByRole('button', { name: 'Create dashboard' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Dashboard name' })).toHaveValue(name);
  await expect(page.getByRole('heading', { name: 'Start with your first visualization' })).toBeVisible();
  await expect(page.getByText('Your empty dashboard is already saved')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await expect(page.getByText('No changes yet')).toBeVisible();
}

test('UX-28 new dashboards enter saved, empty composition and progress through preview and explicit save at five widths', async ({ page }, info) => {
  test.setTimeout(240_000);
  const viewports = [
    { width: 320, height: 640 }, { width: 390, height: 844 },
    { width: 720, height: 850 }, { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];
  for (const { width, height } of viewports) {
    await page.setViewportSize({ width, height });
    const name = `UX28 activation ${width}`;
    const title = `UX28 first chart ${width}`;
    await createEmpty(page, name);
    await expect(page.getByRole('button', { name: 'Create visualization' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add saved visualization' })).toBeVisible();
    await capture(page, info, `empty-${width}`);
    if (width <= 390) {
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(audit.violations.map(item => item.id)).toEqual([]);
    }

    await page.getByRole('button', { name: 'Create visualization' }).click();
    const editor = page.getByRole('dialog', { name: 'Configure visualization' });
    await expect(editor).toContainText('Dashboard Save changes is still required');
    await editor.getByRole('button', { name: /Area chart/ }).click();
    await editor.getByRole('textbox', { name: 'Title' }).fill(title);
    await expect(editor.getByRole('region', { name: 'Live visualization preview' })).toBeVisible();
    await editor.getByRole('button', { name: 'Add to dashboard' }).scrollIntoViewIfNeeded();
    await capture(page, info, `preview-${width}`);
    await editor.getByRole('button', { name: 'Add to dashboard' }).click();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeFocused();
    await expect(page.locator('.canvas-item')).toHaveCount(1);
    await capture(page, info, `draft-${width}`);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('article', { name: title })).toBeVisible();
    await capture(page, info, `saved-${width}`);
  }
});

test('UX-28 canceling first visualization keeps saved empty dashboard and editing continuity', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createEmpty(page, 'UX28 intentional empty dashboard');
  await page.getByRole('button', { name: 'Create visualization' }).click();
  const builder = page.getByRole('dialog', { name: 'Configure visualization' });
  await builder.getByRole('textbox', { name: 'Title' }).fill('Discarded unfinished visualization');
  page.once('dialog', confirmation => confirmation.dismiss());
  await builder.getByRole('button', { name: 'Cancel' }).click();
  await expect(builder).toBeVisible();
  page.once('dialog', confirmation => confirmation.accept());
  await builder.getByRole('button', { name: 'Cancel' }).click();
  await expect(builder).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create visualization' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
  await expect(page.getByText('No visualizations yet')).toBeVisible();
  await capture(page, info, 'intentional-empty-view-390');
  await page.reload();
  await expect(page.getByText('No visualizations yet')).toBeVisible();
  await page.getByRole('button', { name: 'Add first visualization' }).click();
  await expect(page.getByRole('dialog', { name: 'Configure visualization' })).toBeVisible();
});

test('UX-28 existing library template becomes an unsaved independent first dashboard copy', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  const sourceTitle = (await page.locator('.canvas-item .widget-title').first().textContent())!.trim();
  const templateTitle = 'UX28 first-dashboard reusable sample';
  await page.getByRole('button', { name: `Save ${sourceTitle} to library` }).click();
  const saveTemplate = page.getByRole('dialog', { name: 'Save to visualization library' });
  await saveTemplate.getByRole('textbox', { name: 'Visualization name' }).fill(templateTitle);
  await saveTemplate.getByRole('button', { name: 'Save to library' }).click();
  await expect(saveTemplate).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to dashboards' }).click();

  await createEmpty(page, 'UX28 library first');
  await page.getByRole('button', { name: 'Add saved visualization' }).click();
  const library = page.getByRole('dialog', { name: 'Add saved visualization' });
  const choice = library.locator('.library-item').filter({ hasText: templateTitle });
  await expect(choice).toBeVisible();
  await choice.getByRole('button', { name: 'Preview' }).click();
  await expect(library.getByRole('region', { name: 'Saved visualization preview' })).toBeVisible();
  await capture(page, info, 'library-first-preview');
  await choice.getByRole('button', { name: 'Add copy' }).click();
  await expect(library).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  await expect(page.locator('.canvas-item')).toHaveCount(1);
  await capture(page, info, 'library-first-draft');
  page.once('dialog', confirmation => confirmation.dismiss());
  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('article', { name: templateTitle })).toBeVisible();
});

test('UX-28 failed first dashboard save keeps local draft available for retry', async ({ page }) => {
  await createEmpty(page, 'UX28 failed save');
  await page.getByRole('button', { name: 'Create visualization' }).click();
  await page.getByRole('dialog', { name: 'Configure visualization' }).getByRole('button', { name: 'Add to dashboard' }).click();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  await page.route('**/api/organizations/*/dashboards/*', route =>
    route.request().method() === 'PUT' ? route.fulfill({ status: 503, body: '' }) : route.continue());
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('Your unsaved work is still available');
  await expect(page.locator('.canvas-item')).toHaveCount(1);
  await page.unroute('**/api/organizations/*/dashboards/*');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
});
