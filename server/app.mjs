import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSignOffCanonicalText } from '../src/core/certificate.ts';
import { PINSIGN_PRESETS, createBoardFromPreset } from '../src/core/presets.ts';
import {
  PinSignCoreError,
  addPinReply,
  advanceRevisionRound,
  computeBoardMetrics,
  createNextPin,
  updatePinStatus,
} from '../src/core/revisions.ts';
import { openPinSignDatabase, slugify } from './db.mjs';

const __serverDir = path.dirname(fileURLToPath(import.meta.url));
let APP_VERSION = '0.5.0';
try {
  const pkgJson = JSON.parse(
    fs.readFileSync(path.resolve(__serverDir, '../package.json'), 'utf8'),
  );
  if (typeof pkgJson.version === 'string' && pkgJson.version.trim()) {
    APP_VERSION = pkgJson.version.trim();
  }
} catch {
  // fallback version
}

const MAX_JSON_BODY = 5 * 1024 * 1024; // 5 MB to support uploaded screenshot previews
const MAX_UPLOAD_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB decoded binary
const VALID_PIN_STATUSES = new Set(['open', 'in_progress', 'resolved', 'out_of_scope']);
const VALID_PRIORITIES = new Set(['blocker', 'normal', 'polish']);
const VALID_DEVICES = new Set(['desktop', 'tablet', 'mobile']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

const PUBLIC_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_JSON_BODY) {
      const err = new Error('JSON body exceeds 5 MB limit');
      err.statusCode = 413;
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('Invalid JSON payload');
    err.statusCode = 400;
    err.code = 'INVALID_JSON';
    throw err;
  }
}

function normalizeBasePath(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let trimmed = raw.trim();
  if (!trimmed || trimmed === '/') return '';
  if (!trimmed.startsWith('/')) trimmed = `/${trimmed}`;
  return trimmed.replace(/\/+$/, '');
}

function resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath = '') {
  if (normalizedAppOrigin) return normalizedAppOrigin;
  const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const proto = protoHeader || (req.socket?.encrypted ? 'https' : 'http');
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1:4183')
    .split(',')[0]
    .trim();
  return `${proto}://${hostHeader}${normalizedBasePath}`;
}

function extractClientFingerprints(req, sha256Hex) {
  const ipRaw = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .split(',')[0]
    .trim();
  const uaRaw = String(req.headers['user-agent'] || '').trim();
  return {
    ipHash: ipRaw ? sha256Hex(ipRaw) : '',
    userAgentHash: uaRaw ? sha256Hex(uaRaw) : '',
  };
}

function detectImageExtension(mime, buf) {
  if (mime === 'image/png') {
    const isPng =
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a;
    return isPng ? 'png' : null;
  }
  if (mime === 'image/jpeg') {
    const isJpg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    return isJpg ? 'jpg' : null;
  }
  if (mime === 'image/webp') {
    const isWebp =
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP';
    return isWebp ? 'webp' : null;
  }
  return null;
}

function persistScreenImage(rawDataUrl, screenId, uploadsDir, normalizedBasePath) {
  const value = String(rawDataUrl ?? '').trim();
  if (value.startsWith('data:image/svg+xml;charset=utf-8,')) {
    if (value.length > MAX_UPLOAD_IMAGE_BYTES) {
      const err = new Error('SVG data URL too large');
      err.statusCode = 400;
      err.code = 'IMAGE_TOO_LARGE';
      throw err;
    }
    return value;
  }

  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) {
    const err = new Error('Unsupported screen image format (allowed: PNG, JPEG, WebP, SVG data URL)');
    err.statusCode = 400;
    err.code = 'UNSUPPORTED_IMAGE';
    throw err;
  }

  const mime = match[1];
  const base64Body = match[2];
  const buf = Buffer.from(base64Body, 'base64');
  if (buf.byteLength === 0 || buf.byteLength > MAX_UPLOAD_IMAGE_BYTES) {
    const err = new Error('Decoded image exceeds 4 MB limit or is empty');
    err.statusCode = 400;
    err.code = 'INVALID_IMAGE_SIZE';
    throw err;
  }

  const ext = detectImageExtension(mime, buf);
  if (!ext) {
    const err = new Error(`Image binary signature does not match ${mime}`);
    err.statusCode = 400;
    err.code = 'INVALID_IMAGE_BYTES';
    throw err;
  }

  const safeName = `${slugify(screenId, 'scr')}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, safeName), buf);
  return `${normalizedBasePath}/api/uploads/${safeName}`;
}

function buildEmbedWidgetJs() {
  return `(function(){
  var s = document.currentScript;
  if (!s || window.__pinsignWidgetMounted) return;
  window.__pinsignWidgetMounted = true;
  var slug = s.getAttribute('data-pinsign-slug') || '';
  if (!slug) return;
  var pos = s.getAttribute('data-position') === 'bottom-left' ? 'bottom-left' : 'bottom-right';
  var locale = s.getAttribute('data-locale') === 'ar' ? 'ar' : 'en';
  var baseUrl = '';
  try {
    var u = new URL(s.src, window.location.href);
    baseUrl = u.origin + u.pathname.replace(/\\/embed\\.js$/, '');
  } catch (e) { return; }

  var host = document.createElement('div');
  host.id = 'pinsign-widget-root';
  host.style.cssText = 'position:fixed;z-index:2147483000;bottom:20px;' + (pos === 'bottom-left' ? 'left:20px;' : 'right:20px;');
  var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = locale === 'ar' ? 'إضافة ملاحظة PinSign' : 'Pin Feedback (PinSign)';
  btn.style.cssText = 'font-family:system-ui,sans-serif;font-size:13px;font-weight:700;padding:10px 16px;border-radius:999px;border:none;cursor:pointer;background:#E11D48;color:#FFFFFF;box-shadow:0 8px 24px rgba(15,23,42,0.28);';
  shadow.appendChild(btn);

  var active = false;
  function getSelectorHint(el) {
    if (!el || !el.tagName) return '';
    var tag = el.tagName.toLowerCase();
    var idPart = el.id ? '#' + el.id : '';
    var clsPart = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.')
      : '';
    return tag + idPart + clsPart;
  }

  function detectDevice() {
    var w = window.innerWidth || 1280;
    if (w < 640) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  }

  function onPageClick(ev) {
    if (!active || host.contains(ev.target)) return;
    ev.preventDefault();
    ev.stopPropagation();
    active = false;
    btn.style.background = '#E11D48';
    btn.textContent = locale === 'ar' ? 'إضافة ملاحظة PinSign' : 'Pin Feedback (PinSign)';
    var msg = window.prompt(locale === 'ar' ? 'اكتب ملاحظتك على هذا العنصر:' : 'Enter your design feedback for this spot:');
    if (!msg || !msg.trim()) return;
    var author = window.prompt(locale === 'ar' ? 'اسمك:' : 'Your name:', 'Client') || 'Client';
    var xPct = Math.round((ev.clientX / Math.max(1, window.innerWidth)) * 10000) / 100;
    var yPct = Math.round((ev.clientY / Math.max(1, window.innerHeight)) * 10000) / 100;
    fetch(baseUrl + '/api/public/boards/' + encodeURIComponent(slug) + '/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenId: 'first',
        xPct: xPct,
        yPct: yPct,
        comment: msg.trim(),
        authorName: author.trim(),
        authorRole: 'client',
        priority: 'normal',
        device: detectDevice(),
        selectorHint: getSelectorHint(ev.target)
      })
    }).catch(function(){});
  }

  btn.addEventListener('click', function () {
    active = !active;
    btn.style.background = active ? '#0F172A' : '#E11D48';
    btn.textContent = active
      ? (locale === 'ar' ? 'انقر في الصفحة لوضع الدبوس…' : 'Click anywhere to drop pin…')
      : (locale === 'ar' ? 'إضافة ملاحظة PinSign' : 'Pin Feedback (PinSign)');
  });

  document.addEventListener('click', onPageClick, true);
  (document.body || document.documentElement).appendChild(host);
})();
`;
}

function serveStaticAsset(res, pathname, resolvedDist, method = 'GET', normalizedBasePath = '') {
  if (!resolvedDist || !fs.existsSync(resolvedDist)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(pathname || '/');
  } catch {
    sendJson(res, 400, { error: 'Malformed path' });
    return;
  }

  const cleanRel = decodedPath.replace(/^\/+/, '');
  const candidate = path.resolve(resolvedDist, cleanRel || 'index.html');
  if (candidate !== resolvedDist && !candidate.startsWith(resolvedDist + path.sep)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  let fileToServe = null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    fileToServe = candidate;
  } else {
    const indexFallback = path.join(resolvedDist, 'index.html');
    if (fs.existsSync(indexFallback) && fs.statSync(indexFallback).isFile()) {
      fileToServe = indexFallback;
    }
  }

  if (!fileToServe) {
    sendJson(res, 404, { error: 'Static asset not found' });
    return;
  }

  const ext = path.extname(fileToServe).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';

  if (ext === '.html' && normalizedBasePath) {
    let html = fs.readFileSync(fileToServe, 'utf8');
    html = html
      .replaceAll('href="/', `href="${normalizedBasePath}/`)
      .replaceAll('src="/', `src="${normalizedBasePath}/`);
    const baseScript = `<script>window.__PINSIGN_BASE__=${JSON.stringify(normalizedBasePath)};</script>`;
    html = html.includes('</head>') ? html.replace('</head>', `${baseScript}</head>`) : `${baseScript}${html}`;
    const bodyBuf = Buffer.from(html, 'utf8');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': bodyBuf.byteLength,
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    if (method === 'HEAD') {
      res.end();
      return;
    }
    res.end(bodyBuf);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    ...SECURITY_HEADERS,
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(fileToServe).pipe(res);
}

function mapCoreErrorStatus(err) {
  if (err?.statusCode) return err.statusCode;
  if (err instanceof PinSignCoreError) {
    if (err.code === 'BOARD_LOCKED' || err.code === 'ALREADY_APPROVED' || err.code === 'UNRESOLVED_BLOCKER_PINS') {
      return 409;
    }
    if (err.code === 'SCREEN_NOT_FOUND' || err.code === 'PIN_NOT_FOUND') {
      return 404;
    }
    return 400;
  }
  return 500;
}

export function createPinSignServer({ dataDir, distDir = '', appOrigin = '', basePath = '' }) {
  const db = openPinSignDatabase(dataDir);
  const resolvedDist = distDir ? path.resolve(distDir) : null;
  const normalizedAppOrigin = String(appOrigin || '').replace(/\/+$/, '');
  const normalizedBasePath = normalizeBasePath(basePath);
  const embedScriptBody = buildEmbedWidgetJs();

  function enrichBundle(bundle) {
    if (!bundle || !bundle.board) return null;
    return {
      ...bundle,
      metrics: computeBoardMetrics(bundle.board),
    };
  }

  async function handleApiRequest(req, res, method, pathname) {
    // Public CORS preflight support
    if (method === 'OPTIONS' && (pathname.startsWith('/api/public/') || pathname === '/embed.js')) {
      res.writeHead(204, { ...PUBLIC_CORS_HEADERS, ...SECURITY_HEADERS });
      res.end();
      return;
    }

    // 1. Health & Presets
    if (method === 'GET' && pathname === '/api/health') {
      const stats = db.getStats();
      return sendJson(res, 200, {
        ok: true,
        service: 'pinsign',
        version: APP_VERSION,
        basePath: normalizedBasePath || '/',
        ...stats,
        timestamp: new Date().toISOString(),
      });
    }

    if (method === 'GET' && pathname === '/api/presets') {
      return sendJson(res, 200, {
        presets: PINSIGN_PRESETS.map(({ id, nameEn, nameAr, badgeEn, badgeAr }) => ({
          id,
          nameEn,
          nameAr,
          badgeEn,
          badgeAr,
        })),
      });
    }

    // 2. Uploaded Screen Images
    const uploadMatch = pathname.match(/^\/api\/uploads\/([a-zA-Z0-9_-]+\.(?:png|jpg|webp))$/);
    if (method === 'GET' && uploadMatch) {
      const filename = path.basename(uploadMatch[1] || '');
      const fullPath = path.join(db.uploadsDir, filename);
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        return sendJson(res, 404, { error: 'Uploaded asset not found' });
      }
      const ext = path.extname(filename).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_BY_EXT[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...SECURITY_HEADERS,
      });
      fs.createReadStream(fullPath).pipe(res);
      return;
    }

    // 3. Boards Collection
    if (method === 'GET' && pathname === '/api/boards') {
      const boards = db.listBoards().map((item) => ({
        ...item,
        metrics: computeBoardMetrics(item.board),
      }));
      return sendJson(res, 200, { boards, stats: db.getStats() });
    }

    if (method === 'POST' && pathname === '/api/boards') {
      const body = await readJsonBody(req);
      const presetId = PINSIGN_PRESETS.some((p) => p.id === body?.presetId)
        ? body.presetId
        : 'saas-landing';
      const overrides = body?.overrides && typeof body.overrides === 'object' ? body.overrides : {};
      const board = createBoardFromPreset(presetId, overrides);
      const created = db.createBoard(board);
      const reviewUrl = `${resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath)}/r/${encodeURIComponent(created.board.slug)}`;
      return sendJson(res, 201, { ...enrichBundle(created), reviewUrl });
    }

    // 4. Board Sub-Resources (/api/boards/:id/*)
    const duplicateMatch = pathname.match(/^\/api\/boards\/([^/]+)\/duplicate$/);
    if (method === 'POST' && duplicateMatch) {
      const id = decodeURIComponent(duplicateMatch[1] || '');
      const cloned = db.duplicateBoard(id);
      if (!cloned) return sendJson(res, 404, { error: 'Board not found' });
      return sendJson(res, 201, enrichBundle(cloned));
    }

    const screenMatch = pathname.match(/^\/api\/boards\/([^/]+)\/screens$/);
    if (method === 'POST' && screenMatch) {
      const id = decodeURIComponent(screenMatch[1] || '');
      const body = await readJsonBody(req);
      const title = String(body?.title ?? '').trim();
      if (!title) {
        return sendJson(res, 400, { error: 'Screen title is required', code: 'EMPTY_TITLE' });
      }
      const screenId = slugify(body?.id || `scr-${Date.now().toString(36)}`, 'scr');
      const storedUrl = persistScreenImage(body?.imageDataUrl, screenId, db.uploadsDir, normalizedBasePath);
      const now = new Date().toISOString();
      const updated = db.mutateBoardAtomic(
        id,
        (current) => {
          const newScreen = {
            id: current.screens.some((s) => s.id === screenId)
              ? `${screenId}-${crypto.randomBytes(2).toString('hex')}`
              : screenId,
            title,
            titleAr: typeof body?.titleAr === 'string' && body.titleAr.trim() ? body.titleAr.trim() : undefined,
            urlPath: typeof body?.urlPath === 'string' && body.urlPath.trim() ? body.urlPath.trim() : '/',
            width: Math.max(320, Number(body?.width || 1280)),
            height: Math.max(240, Number(body?.height || 820)),
            imageDataUrl: storedUrl,
            createdAt: now,
          };
          return {
            board: {
              ...current,
              screens: [...current.screens, newScreen],
              updatedAt: now,
            },
            auditMeta: { screenId: newScreen.id },
            extra: { screen: newScreen },
          };
        },
        'studio',
        'SCREEN_ADDED',
      );
      if (!updated) return sendJson(res, 404, { error: 'Board not found' });
      return sendJson(res, 201, { ...enrichBundle(updated), screen: updated.extra.screen });
    }

    const advanceMatch = pathname.match(/^\/api\/boards\/([^/]+)\/advance-round$/);
    if (method === 'POST' && advanceMatch) {
      const id = decodeURIComponent(advanceMatch[1] || '');
      const body = await readJsonBody(req);
      const submittedBy = typeof body?.submittedBy === 'string' && body.submittedBy.trim() ? body.submittedBy.trim() : 'Client';
      const summaryNote = typeof body?.summaryNote === 'string' ? body.summaryNote : undefined;
      const updated = db.mutateBoardAtomic(
        id,
        (current) => {
          const resAdvance = advanceRevisionRound(current, submittedBy, summaryNote);
          return {
            board: resAdvance.board,
            auditMeta: {
              round: resAdvance.board.currentRound,
              exceededAgreedCap: resAdvance.exceededAgreedCap,
            },
            extra: { exceededAgreedCap: resAdvance.exceededAgreedCap },
          };
        },
        submittedBy,
        'ROUND_ADVANCED',
      );
      if (!updated) return sendJson(res, 404, { error: 'Board not found' });
      return sendJson(res, 200, {
        ...enrichBundle(updated),
        exceededAgreedCap: updated.extra.exceededAgreedCap,
      });
    }

    const pinReplyStudioMatch = pathname.match(/^\/api\/boards\/([^/]+)\/pins\/([^/]+)\/replies$/);
    if (method === 'POST' && pinReplyStudioMatch) {
      const id = decodeURIComponent(pinReplyStudioMatch[1] || '');
      const pinId = decodeURIComponent(pinReplyStudioMatch[2] || '');
      const body = await readJsonBody(req);
      const authorName = String(body?.authorName ?? 'Studio').trim();
      const authorRole = body?.authorRole === 'client' ? 'client' : 'designer';
      const replyBody = String(body?.body ?? '');
      const updated = db.mutateBoardAtomic(
        id,
        (current) => ({
          board: addPinReply(current, pinId, authorName, authorRole, replyBody),
          auditMeta: { pinId },
        }),
        authorName,
        'PIN_REPLIED',
      );
      if (!updated) return sendJson(res, 404, { error: 'Board not found' });
      return sendJson(res, 201, enrichBundle(updated));
    }

    const pinPatchMatch = pathname.match(/^\/api\/boards\/([^/]+)\/pins\/([^/]+)$/);
    if (method === 'PATCH' && pinPatchMatch) {
      const id = decodeURIComponent(pinPatchMatch[1] || '');
      const pinId = decodeURIComponent(pinPatchMatch[2] || '');
      const body = await readJsonBody(req);
      const nextStatus = String(body?.status ?? '');
      if (!VALID_PIN_STATUSES.has(nextStatus)) {
        return sendJson(res, 400, { error: 'Invalid pin status', code: 'INVALID_STATUS' });
      }
      const quote =
        body?.outOfScopeQuote !== undefined && body.outOfScopeQuote !== null
          ? Number(body.outOfScopeQuote)
          : undefined;

      const updated = db.mutateBoardAtomic(
        id,
        (current) => ({
          board: updatePinStatus(current, pinId, nextStatus, new Date().toISOString(), quote),
          auditMeta: { pinId, status: nextStatus, outOfScopeQuote: quote ?? null },
        }),
        'studio',
        'PIN_STATUS_UPDATED',
      );
      if (!updated) return sendJson(res, 404, { error: 'Board not found' });
      return sendJson(res, 200, enrichBundle(updated));
    }

    const pinCreateStudioMatch = pathname.match(/^\/api\/boards\/([^/]+)\/pins$/);
    if (method === 'POST' && pinCreateStudioMatch) {
      const id = decodeURIComponent(pinCreateStudioMatch[1] || '');
      const body = await readJsonBody(req);
      const updated = db.mutateBoardAtomic(
        id,
        (current) => {
          const resolvedScreenId =
            body?.screenId === 'first' ? current.screens[0]?.id || '' : String(body?.screenId ?? '');
          const nextPin = createNextPin(current, {
            screenId: resolvedScreenId,
            xPct: Number(body?.xPct ?? 50),
            yPct: Number(body?.yPct ?? 50),
            comment: String(body?.comment ?? ''),
            authorName: String(body?.authorName ?? 'Studio'),
            authorRole: body?.authorRole === 'client' ? 'client' : 'designer',
            priority: VALID_PRIORITIES.has(body?.priority) ? body.priority : 'normal',
            device: VALID_DEVICES.has(body?.device) ? body.device : 'desktop',
            selectorHint: typeof body?.selectorHint === 'string' ? body.selectorHint : undefined,
          });
          return {
            board: { ...current, pins: [...current.pins, nextPin], updatedAt: nextPin.createdAt },
            auditMeta: { pinId: nextPin.id, pinNumber: nextPin.pinNumber },
            extra: { pin: nextPin },
          };
        },
        String(body?.authorName ?? 'Studio'),
        'PIN_CREATED',
      );
      if (!updated) return sendJson(res, 404, { error: 'Board not found' });
      return sendJson(res, 201, { ...enrichBundle(updated), pin: updated.extra.pin });
    }

    // 5. Board Single Item CRUD (/api/boards/:id)
    const boardMatch = pathname.match(/^\/api\/boards\/([^/]+)$/);
    if (boardMatch) {
      const id = decodeURIComponent(boardMatch[1] || '');
      if (method === 'GET') {
        const bundle = db.getBoardById(id);
        if (!bundle) return sendJson(res, 404, { error: 'Board not found' });
        const reviewUrl = `${resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath)}/r/${encodeURIComponent(bundle.board.slug)}`;
        return sendJson(res, 200, { ...enrichBundle(bundle), reviewUrl });
      }
      if (method === 'PATCH') {
        const patch = await readJsonBody(req);
        const updated = db.mutateBoardAtomic(
          id,
          (current) => {
            const nextBoard = {
              ...current,
              ...(typeof patch.title === 'string' ? { title: patch.title.trim() || current.title } : {}),
              ...(typeof patch.titleAr === 'string' ? { titleAr: patch.titleAr.trim() } : {}),
              ...(typeof patch.clientName === 'string'
                ? { clientName: patch.clientName.trim() || current.clientName }
                : {}),
              ...(typeof patch.studioName === 'string'
                ? { studioName: patch.studioName.trim() || current.studioName }
                : {}),
              ...(typeof patch.stagingUrl === 'string' ? { stagingUrl: patch.stagingUrl.trim() } : {}),
              ...(typeof patch.slug === 'string' && patch.slug.trim() ? { slug: patch.slug.trim() } : {}),
              ...(patch.agreedRounds !== undefined
                ? { agreedRounds: Math.max(1, Number(patch.agreedRounds) || 1) }
                : {}),
              ...(patch.extraRoundFee !== undefined
                ? { extraRoundFee: Math.max(0, Number(patch.extraRoundFee) || 0) }
                : {}),
              ...(typeof patch.defaultLocale === 'string' && (patch.defaultLocale === 'en' || patch.defaultLocale === 'ar')
                ? { defaultLocale: patch.defaultLocale }
                : {}),
              ...(typeof patch.notes === 'string' ? { notes: patch.notes } : {}),
              updatedAt: new Date().toISOString(),
            };
            return { board: nextBoard };
          },
          'studio',
          'BOARD_UPDATED',
        );
        if (!updated) return sendJson(res, 404, { error: 'Board not found' });
        return sendJson(res, 200, enrichBundle(updated));
      }
      if (method === 'DELETE') {
        const del = db.deleteBoard(id);
        if (!del.deleted) return sendJson(res, 404, { error: 'Board not found' });
        return sendJson(res, 200, { deleted: true, id });
      }
    }

    // 6. Public Client Portal & Widget Endpoints (/api/public/boards/:slug/*)
    const pubPinMatch = pathname.match(/^\/api\/public\/boards\/([^/]+)\/pins$/);
    if (method === 'POST' && pubPinMatch) {
      const slug = decodeURIComponent(pubPinMatch[1] || '');
      const body = await readJsonBody(req);
      const updated = db.mutateBoardBySlugAtomic(
        slug,
        (current) => {
          const resolvedScreenId =
            body?.screenId === 'first' ? current.screens[0]?.id || '' : String(body?.screenId ?? '');
          const nextPin = createNextPin(current, {
            screenId: resolvedScreenId,
            xPct: Number(body?.xPct ?? 50),
            yPct: Number(body?.yPct ?? 50),
            comment: String(body?.comment ?? ''),
            authorName: String(body?.authorName ?? 'Client'),
            authorRole: 'client',
            priority: VALID_PRIORITIES.has(body?.priority) ? body.priority : 'normal',
            device: VALID_DEVICES.has(body?.device) ? body.device : 'desktop',
            selectorHint: typeof body?.selectorHint === 'string' ? body.selectorHint : undefined,
          });
          return {
            board: { ...current, pins: [...current.pins, nextPin], updatedAt: nextPin.createdAt },
            auditMeta: { pinId: nextPin.id, pinNumber: nextPin.pinNumber },
            extra: { pin: nextPin },
          };
        },
        String(body?.authorName ?? 'Client'),
        'PUBLIC_PIN_CREATED',
      );
      if (!updated) {
        return sendJson(res, 404, { error: 'Review board not found' }, PUBLIC_CORS_HEADERS);
      }
      return sendJson(
        res,
        201,
        { ...enrichBundle(updated), pin: updated.extra.pin },
        PUBLIC_CORS_HEADERS,
      );
    }

    const pubReplyMatch = pathname.match(/^\/api\/public\/boards\/([^/]+)\/pins\/([^/]+)\/replies$/);
    if (method === 'POST' && pubReplyMatch) {
      const slug = decodeURIComponent(pubReplyMatch[1] || '');
      const pinId = decodeURIComponent(pubReplyMatch[2] || '');
      const body = await readJsonBody(req);
      const authorName = String(body?.authorName ?? 'Client').trim();
      const updated = db.mutateBoardBySlugAtomic(
        slug,
        (current) => ({
          board: addPinReply(current, pinId, authorName, 'client', String(body?.body ?? '')),
          auditMeta: { pinId },
        }),
        authorName,
        'PUBLIC_PIN_REPLIED',
      );
      if (!updated) {
        return sendJson(res, 404, { error: 'Review board not found' }, PUBLIC_CORS_HEADERS);
      }
      return sendJson(res, 201, enrichBundle(updated), PUBLIC_CORS_HEADERS);
    }

    const pubApproveMatch = pathname.match(/^\/api\/public\/boards\/([^/]+)\/approve$/);
    if (method === 'POST' && pubApproveMatch) {
      const slug = decodeURIComponent(pubApproveMatch[1] || '');
      const body = await readJsonBody(req);
      const { ipHash, userAgentHash } = extractClientFingerprints(req, db.sha256Hex);
      const approvedBundle = db.approveBoardAtomic({
        slug,
        signerName: body?.signerName,
        signerTitle: body?.signerTitle,
        signerEmail: body?.signerEmail,
        signatureType: body?.signatureType,
        signatureDataUrl: body?.signatureDataUrl,
        confirmedAllPinsReviewed: body?.confirmedAllPinsReviewed,
        allowOpenBlockers: body?.allowOpenBlockers,
        buildCanonicalText: buildSignOffCanonicalText,
        computeMetrics: computeBoardMetrics,
        ipHash,
        userAgentHash,
      });
      if (!approvedBundle) {
        return sendJson(res, 404, { error: 'Review board not found' });
      }
      return sendJson(res, 201, enrichBundle(approvedBundle));
    }

    const pubBoardMatch = pathname.match(/^\/api\/public\/boards\/([^/]+)$/);
    if (method === 'GET' && pubBoardMatch) {
      const slug = decodeURIComponent(pubBoardMatch[1] || '');
      const { ipHash, userAgentHash } = extractClientFingerprints(req, db.sha256Hex);
      const bundle = db.recordPublicView(slug, ipHash, userAgentHash);
      if (!bundle) {
        return sendJson(res, 404, { error: 'Review board not found' }, PUBLIC_CORS_HEADERS);
      }
      return sendJson(res, 200, enrichBundle(bundle), PUBLIC_CORS_HEADERS);
    }

    // 7. Launch Certificates Registry
    if (method === 'GET' && pathname === '/api/certificates') {
      return sendJson(res, 200, { certificates: db.listCertificates() });
    }

    const certMatch = pathname.match(/^\/api\/certificates\/([^/]+)$/);
    if (method === 'GET' && certMatch) {
      const certNum = decodeURIComponent(certMatch[1] || '');
      const detail = db.getCertificateByNumber(certNum);
      if (!detail) return sendJson(res, 404, { error: 'Certificate not found' });
      return sendJson(res, 200, {
        certificate: detail.certificate,
        board: detail.board,
        metrics: detail.board ? computeBoardMetrics(detail.board) : null,
      });
    }

    return sendJson(res, 404, { error: 'API endpoint not found' });
  }

  async function handler(req, res) {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      let pathname = parsedUrl.pathname;
      if (
        normalizedBasePath &&
        (pathname === normalizedBasePath || pathname.startsWith(`${normalizedBasePath}/`))
      ) {
        pathname = pathname.slice(normalizedBasePath.length) || '/';
      }
      const method = String(req.method || 'GET').toUpperCase();

      if (pathname === '/embed.js') {
        if (method === 'OPTIONS') {
          res.writeHead(204, { ...PUBLIC_CORS_HEADERS, ...SECURITY_HEADERS });
          res.end();
          return;
        }
        if (method !== 'GET' && method !== 'HEAD') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }
        const buf = Buffer.from(embedScriptBody, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Content-Length': buf.byteLength,
          'Cache-Control': 'public, max-age=300',
          ...PUBLIC_CORS_HEADERS,
          ...SECURITY_HEADERS,
        });
        if (method === 'HEAD') {
          res.end();
          return;
        }
        res.end(buf);
        return;
      }

      if (pathname.startsWith('/api/')) {
        await handleApiRequest(req, res, method, pathname);
        return;
      }

      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      serveStaticAsset(res, pathname, resolvedDist, method, normalizedBasePath);
    } catch (err) {
      const statusCode = mapCoreErrorStatus(err);
      const payload = {
        error: err?.message || 'Internal server error',
        ...(err?.code ? { code: err.code } : {}),
      };
      if (!res.headersSent) {
        sendJson(res, statusCode, payload);
      } else {
        res.end();
      }
    }
  }

  return {
    handler,
    close: () => db.close(),
  };
}
