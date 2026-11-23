import { expect, test, type Page } from '@playwright/test';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function assertNoHorizontalOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dims.scrollWidth).toBeLessThanOrEqual(dims.innerWidth);
}

test.describe('PinSign — Visual Review Pins, Revision Rounds & Launch Sign-Off E2E', () => {
  test('persists Studio Slate / EN LTR and toggles Midnight Dark / Arabic RTL cleanly', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.getByTestId('create-preset-saas-landing')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'slate');

    await page.screenshot({
      path: 'test-results/qa-screenshots/01-studio-en-slate.png',
    });

    await page.getByTestId('toggle-theme-btn').click();
    await page.getByTestId('toggle-locale-btn').click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

    await page.screenshot({
      path: 'test-results/qa-screenshots/02-studio-ar-midnight.png',
    });

    await page.reload();
    await expect(page.getByTestId('create-preset-saas-landing')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

    await page.getByTestId('toggle-theme-btn').click();
    await page.getByTestId('toggle-locale-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'slate');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    expect(errors).toEqual([]);
  });

  test('executes full review lifecycle: click-to-pin, out-of-scope fee, revision round advance, embed modal, blocker guard, typed sign-off & /embed.js CORS', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const year = new Date().getUTCFullYear();
    const expectedCertNum = `SIGN-${year}-0001`;

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.getByTestId('create-preset-saas-landing').click();
    await expect(page.getByTestId('review-canvas-board')).toBeVisible();
    await expect(page.getByTestId('round-counter-badge')).toContainText('1 / 2');

    const canvas = page.getByTestId('pin-canvas');
    await expect(canvas).toBeVisible();
    const canvasImg = canvas.locator('img');
    await expect
      .poll(() =>
        canvasImg.evaluate((el) => el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0),
      )
      .toBe(true);

    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) {
      throw new Error('Pin canvas bounding box not available');
    }
    // Click at (65%, 58%) away from preset pin #1 (24.5%, 30.2%)
    await canvas.click({
      position: {
        x: Math.round(canvasBox.width * 0.65),
        y: Math.round(canvasBox.height * 0.58),
      },
    });

    await expect(page.getByTestId('new-pin-form')).toBeVisible();
    await page.getByTestId('new-pin-comment').fill('Refine pricing footer badge contrast');
    await page.getByTestId('new-pin-priority').selectOption('polish');
    await page.getByTestId('submit-pin-btn').click();

    await expect(page.getByTestId('canvas-pin-3')).toBeVisible();

    // Mark pin #3 out of scope with a $350 extra fee quote
    await page.getByTestId('oos-pin-3').click();
    await page.getByTestId('oos-quote-3').fill('350');
    await page.getByTestId('save-oos-3').click();
    await expect(page.getByTestId('review-canvas-board')).toContainText('350');

    // Advance revision round (1 -> 2)
    await page.getByTestId('advance-round-btn').click();
    await expect(page.getByTestId('round-counter-badge')).toContainText('2 / 2');

    // Open Embed Snippet & Share Modal
    await page.getByTestId('open-embed-modal-btn').click();
    const embedModal = page.getByTestId('embed-modal');
    await expect(embedModal).toBeVisible();
    await expect(embedModal).toContainText('/embed.js');
    await expect(embedModal).toContainText('data-pinsign-slug=');
    await embedModal.getByRole('button', { name: /Close|إغلاق/ }).click();
    await expect(embedModal).toHaveCount(0);

    // Verify Blocker Guard disables sign-off submission until blocker pin #1 is resolved
    await page.getByTestId('open-signoff-btn').click();
    await expect(page.getByTestId('signoff-panel')).toBeVisible();
    await expect(page.getByTestId('submit-signoff-btn')).toBeDisabled();

    await page.getByTestId('resolve-pin-1').click();
    await expect(page.getByTestId('submit-signoff-btn')).toBeEnabled();

    // Close sign-off drawer so the board screenshot shows canvas + pins cleanly
    await page.getByTestId('open-signoff-btn').click();
    await expect(page.getByTestId('signoff-panel')).toHaveCount(0);

    await page.screenshot({
      path: 'test-results/qa-screenshots/03-board-canvas-desktop.png',
    });

    // Return to Studio Dashboard and launch Client Review Portal (/r/:slug)
    await page.getByTestId('board-back-studio-btn').click();
    await expect(page.getByTestId('boards-list')).toBeVisible();
    await page.locator('[data-testid^="open-client-saas-landing-"]').first().click();

    await expect(page.getByTestId('review-canvas-board')).toBeVisible();
    await expect(page).toHaveURL(/\/r\/saas-landing-/);

    // Complete Typed Launch Sign-Off in Client Mode
    await page.getByTestId('open-signoff-btn').click();
    await page.getByTestId('signoff-name-input').fill('Liam Carter');
    await page.getByTestId('signoff-confirm-checkbox').check();
    await page.getByTestId('submit-signoff-btn').click();

    await expect(page.getByTestId('certificate-view')).toBeVisible();
    await expect(page.getByTestId('certificate-view')).toContainText(expectedCertNum);
    await expect(page.getByTestId('cert-scope-digest')).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.getByTestId('print-cert-btn')).toBeVisible();

    await page.screenshot({
      path: 'test-results/qa-screenshots/04-certificate-desktop.png',
      fullPage: true,
    });

    // Reload public slug -> board remains locked with Launch Certificate and no sign-off controls
    await page.reload();
    await expect(page.getByTestId('certificate-view')).toBeVisible();
    await expect(page.getByTestId('certificate-view')).toContainText(expectedCertNum);
    await expect(page.getByTestId('open-signoff-btn')).toHaveCount(0);

    // Navigate back to Studio -> Certificates Ledger -> standalone /cert/:certificateNumber route
    await page.getByTestId('cert-back-studio-btn').click();
    await page.getByTestId('nav-certs-btn').click();
    await expect(page.getByTestId('certificates-ledger')).toBeVisible();
    await expect(page.getByTestId('certificates-ledger')).toContainText(expectedCertNum);

    await page.getByTestId('certificates-ledger').locator('tbody tr button').first().click();
    await expect(page).toHaveURL(new RegExp(`/cert/${expectedCertNum}$`));
    await expect(page.getByTestId('certificate-view')).toBeVisible();
    await expect(page.getByTestId('certificate-view')).toContainText(expectedCertNum);

    // Verify /embed.js CORS and payload
    const embedRes = await page.request.get('/embed.js');
    expect(embedRes.status()).toBe(200);
    expect(embedRes.headers()['content-type'] ?? '').toContain('application/javascript');
    expect(embedRes.headers()['access-control-allow-origin']).toBe('*');
    const embedBody = await embedRes.text();
    expect(embedBody).toContain('pinsign-widget-root');

    expect(errors).toEqual([]);
  });

  test('completes Arabic RTL board with PNG upload, drawn canvas signature, and zero horizontal overflow on 390x844 mobile across all views', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const year = new Date().getUTCFullYear();
    const expectedCertNum = `SIGN-${year}-0002`;

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.getByTestId('toggle-locale-btn').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.getByTestId('create-preset-shopify-store').click();
    await expect(page.getByTestId('review-canvas-board')).toBeVisible();

    // Resolve blocker pin #1 and wait for completion before uploading a real PNG screen
    await page.getByTestId('resolve-pin-1').click();
    await expect(page.getByTestId('resolve-pin-1')).toHaveCount(0);
    await page.getByTestId('upload-screen-input').setInputFiles({
      name: 'checkout-mobile.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TINY_PNG_BASE64, 'base64'),
    });

    const screenTabs = page.locator('[data-testid^="screen-tab-"]');
    await expect(screenTabs).toHaveCount(2);
    // Switch back to storefront preset SVG tab for rich mobile screenshot capture
    await screenTabs.first().click();
    await expect(screenTabs.nth(1)).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    // Switch to mobile viewport 390x844 and assert zero horizontal overflow across views
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page); // (a) Studio Review Canvas

    await page.screenshot({
      path: 'test-results/qa-screenshots/05-board-ar-mobile.png',
      fullPage: true,
    });

    await page.getByTestId('board-back-studio-btn').click();
    await expect(page.getByTestId('boards-list')).toBeVisible();
    await assertNoHorizontalOverflow(page); // (b) Studio Dashboard

    await page.locator('[data-testid^="open-client-shopify-store-"]').first().click();
    await expect(page.getByTestId('review-canvas-board')).toBeVisible();
    await assertNoHorizontalOverflow(page); // (c) Client Portal

    // Open sign-off panel and complete drawn signature
    await page.getByTestId('open-signoff-btn').click();
    await page.getByTestId('signoff-name-input').fill('مها المزروعي');
    await page.getByTestId('sig-mode-drawn').click();

    const sigCanvas = page.getByTestId('signature-canvas');
    await expect(sigCanvas).toBeVisible();
    const sigBox = await sigCanvas.boundingBox();
    if (!sigBox) {
      throw new Error('Signature canvas bounding box not available');
    }
    await page.mouse.move(sigBox.x + 24, sigBox.y + sigBox.height * 0.55);
    await page.mouse.down();
    await page.mouse.move(sigBox.x + sigBox.width * 0.65, sigBox.y + sigBox.height * 0.35, {
      steps: 10,
    });
    await page.mouse.up();

    await page.getByTestId('signoff-confirm-checkbox').check();
    await page.getByTestId('submit-signoff-btn').click();

    const certView = page.getByTestId('certificate-view');
    await expect(certView).toBeVisible();
    await expect(certView).toContainText(expectedCertNum);
    await expect(page.getByTestId('cert-scope-digest')).toHaveText(/^[0-9a-f]{64}$/);
    await expect(certView.locator('img')).toBeVisible();
    await expect(certView.locator('img')).toHaveAttribute('src', /^data:image\/png;base64,/);

    await assertNoHorizontalOverflow(page); // (d) Launch Certificate view
    await page.screenshot({
      path: 'test-results/qa-screenshots/06-certificate-ar-mobile.png',
      fullPage: true,
    });

    await page.getByTestId('cert-back-studio-btn').click();
    await page.getByTestId('nav-certs-btn').click();
    await expect(page.getByTestId('certificates-ledger')).toBeVisible();
    await assertNoHorizontalOverflow(page); // (e) Certificates Ledger

    expect(errors).toEqual([]);
  });
});
