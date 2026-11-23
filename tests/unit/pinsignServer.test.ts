import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPinSignServer } from '../../server/app.mjs';
import { verifySignOffIntegrity } from '../../src/core/certificate.ts';
import type { BoardMetrics, LaunchSignOff, ReviewBoard } from '../../src/core/types.ts';

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+8k0AAAAASUVORK5CYII=';

describe('PinSign HTTP Server, Upload, Embed & SQLite WAL Integration', () => {
  let tmpDir = '';
  let server: http.Server;
  let closeDb: () => void;
  let baseUrl = '';
  const currentYear = new Date().getUTCFullYear();

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pinsign-srv-test-'));
    const instance = createPinSignServer({ dataDir: tmpDir });
    closeDb = instance.close;
    server = http.createServer(instance.handler);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to bind ephemeral port');
    }
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    if (closeDb) closeDb();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  async function apiJson(route: string, init?: RequestInit) {
    const res = await fetch(`${baseUrl}${route}`, init);
    const data = (await res.json()) as Record<string, unknown>;
    return { res, data };
  }

  it('serves health check with security headers, lists 3 presets, and serves CORS-enabled embed.js', async () => {
    const health = await apiJson('/api/health');
    expect(health.res.status).toBe(200);
    expect(health.res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(health.res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(health.data.ok).toBe(true);
    expect(health.data.service).toBe('pinsign');
    const pkgVersion = (
      JSON.parse(
        fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
      ) as { version: string }
    ).version;
    expect(health.data.version).toBe(pkgVersion);

    const presets = await apiJson('/api/presets');
    expect(presets.res.status).toBe(200);
    expect(Array.isArray(presets.data.presets)).toBe(true);
    expect(presets.data.presets).toHaveLength(3);

    const embedRes = await fetch(`${baseUrl}/embed.js`);
    expect(embedRes.status).toBe(200);
    expect(embedRes.headers.get('content-type') ?? '').toContain('application/javascript');
    expect(embedRes.headers.get('access-control-allow-origin')).toBe('*');
    const embedCode = await embedRes.text();
    expect(embedCode).toContain('attachShadow');
    expect(embedCode).toContain('/api/public/boards/');
  });

  it('handles screen PNG uploads, public pin drop & replies, out-of-scope quotes, and extra round fees', async () => {
    const created = await apiJson('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presetId: 'saas-landing',
        overrides: { slug: 'northstar-qa', agreedRounds: 2, extraRoundFee: 250 },
      }),
    });
    expect(created.res.status).toBe(201);
    const createdBoard = created.data.board as ReviewBoard;
    expect(createdBoard.slug).toBe('northstar-qa');

    // Reject spoofed non-PNG payload
    const badUpload = await apiJson(`/api/boards/${createdBoard.id}/screens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Fake PNG',
        imageDataUrl: 'data:image/png;base64,bm90LWEtcG5n',
      }),
    });
    expect(badUpload.res.status).toBe(400);

    // Upload valid 1x1 PNG screen
    const goodUpload = await apiJson(`/api/boards/${createdBoard.id}/screens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Checkout Drawer Desktop',
        urlPath: '/checkout',
        width: 1440,
        height: 900,
        imageDataUrl: TINY_PNG_DATA_URL,
      }),
    });
    expect(goodUpload.res.status).toBe(201);
    const uploadedScreen = goodUpload.data.screen as { id: string; imageDataUrl: string };
    expect(uploadedScreen.imageDataUrl).toMatch(/^\/api\/uploads\/.+\.png$/);

    const imgFetch = await fetch(`${baseUrl}${uploadedScreen.imageDataUrl}`);
    expect(imgFetch.status).toBe(200);
    expect(imgFetch.headers.get('content-type')).toBe('image/png');

    // Drop a pin via public CORS endpoint
    const publicPin = await apiJson('/api/public/boards/northstar-qa/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenId: uploadedScreen.id,
        xPct: 48.25,
        yPct: 62.5,
        comment: 'Add Stripe badge + live currency converter',
        authorName: 'Liam Carter',
        priority: 'normal',
        device: 'desktop',
      }),
    });
    expect(publicPin.res.status).toBe(201);
    expect(publicPin.res.headers.get('access-control-allow-origin')).toBe('*');
    const pinObj = publicPin.data.pin as { id: string; pinNumber: number };
    expect(pinObj.pinNumber).toBe(3);

    // Reply via public endpoint
    const replyRes = await apiJson(`/api/public/boards/northstar-qa/pins/${pinObj.id}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorName: 'Liam Carter',
        body: 'Needs multi-currency switcher by launch.',
      }),
    });
    expect(replyRes.res.status).toBe(201);

    // Designer marks pin out_of_scope with $350 change-order quote
    const scopeRes = await apiJson(`/api/boards/${createdBoard.id}/pins/${pinObj.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'out_of_scope',
        outOfScopeQuote: 350,
      }),
    });
    expect(scopeRes.res.status).toBe(200);

    // Advance Round 1 -> 2 (within cap), then Round 2 -> 3 (exceeds cap)
    const r2 = await apiJson(`/api/boards/${createdBoard.id}/advance-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submittedBy: 'Liam Carter', summaryNote: 'Round 1 complete' }),
    });
    expect(r2.res.status).toBe(200);
    expect(r2.data.exceededAgreedCap).toBe(false);

    const r3 = await apiJson(`/api/boards/${createdBoard.id}/advance-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submittedBy: 'Liam Carter', summaryNote: 'Extra tweak round' }),
    });
    expect(r3.res.status).toBe(200);
    expect(r3.data.exceededAgreedCap).toBe(true);
    const r3Metrics = r3.data.metrics as BoardMetrics;
    // 1 extra round ($250) + $350 out_of_scope quote = $600
    expect(r3Metrics.estimatedExtraFees).toBe(600);
  });

  it('enforces open blocker gate, issues atomic SIGN-YYYY-0001 certificate, and verifies SHA-256 integrity', async () => {
    // Blocked because pin-1 (blocker) is still open on northstar-qa
    const blockedApprove = await apiJson('/api/public/boards/northstar-qa/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signerName: 'Liam Carter',
        signatureType: 'typed',
        confirmedAllPinsReviewed: true,
      }),
    });
    expect(blockedApprove.res.status).toBe(409);
    expect(blockedApprove.data.code).toBe('UNRESOLVED_BLOCKER_PINS');

    // Look up board id cleanly and resolve blocker pin-1
    const pubView = await apiJson('/api/public/boards/northstar-qa');
    expect(pubView.res.status).toBe(200);
    expect(pubView.data.viewCount).toBe(1);
    const boardId = (pubView.data.board as ReviewBoard).id;

    const resolvedPin = await apiJson(`/api/boards/${boardId}/pins/pin-1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    expect(resolvedPin.res.status).toBe(200);

    const approveRes = await apiJson('/api/public/boards/northstar-qa/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signerName: 'Liam Carter',
        signerTitle: 'VP Product',
        signerEmail: 'liam@northstar.example',
        signatureType: 'typed',
        confirmedAllPinsReviewed: true,
      }),
    });
    expect(approveRes.res.status).toBe(201);

    const approvedBoard = approveRes.data.board as ReviewBoard;
    const cert = approveRes.data.certificate as LaunchSignOff;
    expect(cert.certificateNumber).toBe(`SIGN-${currentYear}-0001`);
    expect(cert.scopeDigestHex).toMatch(/^[0-9a-f]{64}$/);
    expect(approvedBoard.status).toBe('approved_for_launch');

    const integrity = await verifySignOffIntegrity(approvedBoard);
    expect(integrity.valid).toBe(true);
    expect(integrity.actualDigest).toBe(cert.scopeDigestHex);
  });

  it('locks all mutations after approval, exposes certificate lookup, and clones cleanly via duplicate', async () => {
    const pub = await apiJson('/api/public/boards/northstar-qa');
    const boardId = (pub.data.board as ReviewBoard).id;
    const expectedCertNum = `SIGN-${currentYear}-0001`;

    const patchRes = await apiJson(`/api/boards/${boardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Sneaky Post-Approval Edit' }),
    });
    expect(patchRes.res.status).toBe(409);
    expect(patchRes.data.code).toBe('BOARD_LOCKED');

    const newPinRes = await apiJson('/api/public/boards/northstar-qa/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenId: 'scr-home',
        xPct: 50,
        yPct: 50,
        comment: 'One tiny change after signing off',
        authorName: 'Liam Carter',
      }),
    });
    expect(newPinRes.res.status).toBe(409);
    expect(newPinRes.data.code).toBe('BOARD_LOCKED');

    const pinPatchRes = await apiJson(`/api/boards/${boardId}/pins/pin-1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'open' }),
    });
    expect(pinPatchRes.res.status).toBe(409);
    expect(pinPatchRes.data.code).toBe('BOARD_LOCKED');

    const advRes = await apiJson(`/api/boards/${boardId}/advance-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submittedBy: 'Liam Carter' }),
    });
    expect(advRes.res.status).toBe(409);
    expect(advRes.data.code).toBe('BOARD_LOCKED');

    const delRes = await apiJson(`/api/boards/${boardId}`, { method: 'DELETE' });
    expect(delRes.res.status).toBe(409);
    expect(delRes.data.code).toBe('BOARD_LOCKED');

    const reApproveRes = await apiJson('/api/public/boards/northstar-qa/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signerName: 'Liam Carter',
        signatureType: 'typed',
        confirmedAllPinsReviewed: true,
      }),
    });
    expect(reApproveRes.res.status).toBe(409);
    expect(reApproveRes.data.code).toBe('ALREADY_APPROVED');

    // Duplicate produces a fresh unlocked board preserving screens with empty pins
    const dupRes = await apiJson(`/api/boards/${boardId}/duplicate`, { method: 'POST' });
    expect(dupRes.res.status).toBe(201);
    const clonedBoard = dupRes.data.board as ReviewBoard;
    expect(clonedBoard.id).not.toBe(boardId);
    expect(clonedBoard.slug).not.toBe('northstar-qa');
    expect(clonedBoard.status).toBe('review_open');
    expect(clonedBoard.pins).toHaveLength(0);
    expect(clonedBoard.signOff).toBeNull();

    // Certificate registry lookup
    const certsList = await apiJson('/api/certificates');
    expect(certsList.res.status).toBe(200);
    expect((certsList.data.certificates as unknown[]).length).toBe(1);

    const certDetail = await apiJson(`/api/certificates/${expectedCertNum}`);
    expect(certDetail.res.status).toBe(200);
    expect((certDetail.data.certificate as LaunchSignOff).certificateNumber).toBe(expectedCertNum);
  });

  it('supports subpath hosting (BASE_PATH=/pinsign) for health, HTML base injection, and /pinsign/embed.js', async () => {
    const subDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pinsign-sub-data-'));
    const subDistDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pinsign-sub-dist-'));
    fs.writeFileSync(
      path.join(subDistDir, 'index.html'),
      '<!doctype html><html><head><link rel="icon" href="/favicon.svg" /><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
      'utf8',
    );
    const subInstance = createPinSignServer({
      dataDir: subDataDir,
      distDir: subDistDir,
      appOrigin: 'https://example.test/pinsign',
      basePath: '/pinsign',
    });
    const subServer = http.createServer(subInstance.handler);
    await new Promise<void>((resolve) => subServer.listen(0, '127.0.0.1', () => resolve()));

    try {
      const addr = subServer.address();
      if (!addr || typeof addr === 'string') throw new Error('Failed to bind port');
      const subBaseUrl = `http://127.0.0.1:${addr.port}`;

      const preHealth = await fetch(`${subBaseUrl}/pinsign/api/health`);
      expect(preHealth.status).toBe(200);
      expect(((await preHealth.json()) as { basePath: string }).basePath).toBe('/pinsign');

      const stripHealth = await fetch(`${subBaseUrl}/api/health`);
      expect(stripHealth.status).toBe(200);
      expect(((await stripHealth.json()) as { basePath: string }).basePath).toBe('/pinsign');

      const htmlRes = await fetch(`${subBaseUrl}/pinsign/`);
      expect(htmlRes.status).toBe(200);
      const html = await htmlRes.text();
      expect(html).toContain('window.__PINSIGN_BASE__="/pinsign"');
      expect(html).toContain('src="/pinsign/assets/app.js"');
      expect(html).toContain('href="/pinsign/favicon.svg"');

      const subEmbedRes = await fetch(`${subBaseUrl}/pinsign/embed.js`);
      expect(subEmbedRes.status).toBe(200);
      expect(subEmbedRes.headers.get('content-type') ?? '').toContain('application/javascript');
    } finally {
      subInstance.close();
      await new Promise<void>((resolve) => subServer.close(() => resolve()));
      fs.rmSync(subDataDir, { recursive: true, force: true });
      fs.rmSync(subDistDir, { recursive: true, force: true });
    }
  });
});
