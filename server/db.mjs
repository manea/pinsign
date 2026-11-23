import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
}

function makeError(message, code, statusCode) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

export function slugify(input, fallback = 'board') {
  const cleaned = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function parseJsonSafe(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function openPinSignDatabase(dataDir) {
  const resolvedDataDir = path.resolve(dataDir);
  const uploadsDir = path.join(resolvedDataDir, 'uploads');
  fs.mkdirSync(resolvedDataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });

  const dbPath = path.join(resolvedDataDir, 'pinsign.sqlite');
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      board_json TEXT NOT NULL,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_boards_status ON boards(status);
    CREATE INDEX IF NOT EXISTS idx_boards_updated ON boards(updated_at DESC);

    CREATE TABLE IF NOT EXISTS certificates (
      certificate_number TEXT PRIMARY KEY,
      board_id TEXT NOT NULL UNIQUE REFERENCES boards(id) ON DELETE CASCADE,
      signer_name TEXT NOT NULL,
      scope_digest_hex TEXT NOT NULL,
      certificate_json TEXT NOT NULL,
      ip_hash TEXT,
      user_agent_hash TEXT,
      approved_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_certificates_approved ON certificates(approved_at DESC);

    CREATE TABLE IF NOT EXISTS certificate_counters (
      year INTEGER PRIMARY KEY,
      last_seq INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      meta_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_board ON audit_events(board_id, id DESC);
  `);

  function ensureUniqueSlug(desiredSlug, excludeId = null) {
    const base = slugify(desiredSlug, 'board');
    let candidate = base;
    let suffix = 2;
    const checkStmt = db.prepare('SELECT id FROM boards WHERE slug = ?');
    while (true) {
      const existing = checkStmt.get(candidate);
      if (!existing || (excludeId && existing.id === excludeId)) {
        return candidate;
      }
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }

  function insertAudit(boardId, eventType, actor, meta = {}, createdAt = new Date().toISOString()) {
    db.prepare(
      'INSERT INTO audit_events (board_id, event_type, actor, meta_json, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(boardId, eventType, actor, JSON.stringify(meta), createdAt);
  }

  function hydrateBundle(boardRow) {
    if (!boardRow) return null;
    const board = parseJsonSafe(boardRow.board_json, null);
    if (!board) return null;

    const certRow = db
      .prepare('SELECT certificate_json FROM certificates WHERE board_id = ?')
      .get(board.id);
    const certificate = certRow ? parseJsonSafe(certRow.certificate_json, null) : board.signOff ?? null;

    const events = db
      .prepare(
        'SELECT id, board_id, event_type, actor, meta_json, created_at FROM audit_events WHERE board_id = ? ORDER BY id DESC LIMIT 30',
      )
      .all(board.id)
      .map((row) => ({
        id: row.id,
        boardId: row.board_id,
        eventType: row.event_type,
        actor: row.actor,
        meta: parseJsonSafe(row.meta_json, {}),
        createdAt: row.created_at,
      }));

    return {
      board,
      viewCount: Number(boardRow.view_count || 0),
      certificate,
      auditEvents: events,
    };
  }

  function getStats() {
    const totalRow = db.prepare('SELECT COUNT(*) AS cnt FROM boards').get();
    const byStatusRows = db.prepare('SELECT status, COUNT(*) AS cnt FROM boards GROUP BY status').all();
    const certRow = db.prepare('SELECT COUNT(*) AS cnt FROM certificates').get();
    const statusMap = {
      review_open: 0,
      round_submitted: 0,
      approved_for_launch: 0,
    };
    for (const row of byStatusRows) {
      if (row.status in statusMap) {
        statusMap[row.status] = Number(row.cnt || 0);
      }
    }
    return {
      total: Number(totalRow?.cnt || 0),
      reviewOpen: statusMap.review_open,
      roundSubmitted: statusMap.round_submitted,
      approvedForLaunch: statusMap.approved_for_launch,
      certificatesCount: Number(certRow?.cnt || 0),
    };
  }

  function listBoards() {
    const rows = db
      .prepare(
        `SELECT b.*, c.certificate_number AS cert_num, c.approved_at AS cert_approved_at
         FROM boards b
         LEFT JOIN certificates c ON c.board_id = b.id
         ORDER BY b.updated_at DESC`,
      )
      .all();
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      status: row.status,
      viewCount: Number(row.view_count || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      certificateNumber: row.cert_num || null,
      approvedAt: row.cert_approved_at || null,
      board: parseJsonSafe(row.board_json, null),
    }));
  }

  function getBoardById(id) {
    const row = db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
    return hydrateBundle(row);
  }

  function getBoardBySlug(slug) {
    const row = db.prepare('SELECT * FROM boards WHERE slug = ?').get(slug);
    return hydrateBundle(row);
  }

  function recordPublicView(slug, ipHash = '', userAgentHash = '') {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = db.prepare('SELECT * FROM boards WHERE slug = ?').get(slug);
      if (!row) {
        db.exec('ROLLBACK');
        return null;
      }
      db.prepare('UPDATE boards SET view_count = view_count + 1 WHERE id = ?').run(row.id);
      insertAudit(row.id, 'PUBLIC_VIEW', 'client', { ipHash, userAgentHash });
      db.exec('COMMIT');
      return getBoardById(row.id);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  function createBoard(boardInput) {
    const now = new Date().toISOString();
    const id = boardInput.id || `brd-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const slug = ensureUniqueSlug(boardInput.slug || boardInput.title || id);
    const board = {
      ...boardInput,
      id,
      slug,
      status: 'review_open',
      currentRound: Math.max(1, Number(boardInput.currentRound || 1)),
      agreedRounds: Math.max(1, Number(boardInput.agreedRounds || 2)),
      extraRoundFee: Number.isFinite(Number(boardInput.extraRoundFee))
        ? Math.max(0, Number(boardInput.extraRoundFee))
        : 0,
      signOff: null,
      createdAt: boardInput.createdAt || now,
      updatedAt: now,
    };

    db.prepare(
      'INSERT INTO boards (id, slug, status, board_json, view_count, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
    ).run(board.id, board.slug, board.status, JSON.stringify(board), board.createdAt, board.updatedAt);

    insertAudit(board.id, 'BOARD_CREATED', 'studio', { slug: board.slug }, board.createdAt);
    return getBoardById(board.id);
  }

  function mutateBoardInternal(lookupSql, lookupVal, mutatorFn, actor = 'studio', eventType = 'BOARD_UPDATED', eventMeta = {}) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = db.prepare(lookupSql).get(lookupVal);
      if (!row) {
        db.exec('ROLLBACK');
        return null;
      }
      const current = parseJsonSafe(row.board_json, null);
      if (!current) {
        throw makeError('Corrupted board record', 'CORRUPT_RECORD', 500);
      }
      if (current.status === 'approved_for_launch' || current.signOff !== null) {
        throw makeError('Board is locked after final launch sign-off', 'BOARD_LOCKED', 409);
      }

      const result = mutatorFn(current);
      const nextBoard = result.board;
      const resolvedSlug =
        nextBoard.slug && nextBoard.slug !== current.slug
          ? ensureUniqueSlug(nextBoard.slug, current.id)
          : current.slug;

      const updatedAt = nextBoard.updatedAt || new Date().toISOString();
      const persisted = {
        ...nextBoard,
        id: current.id,
        slug: resolvedSlug,
        signOff: null,
        updatedAt,
      };

      db.prepare('UPDATE boards SET slug = ?, status = ?, board_json = ?, updated_at = ? WHERE id = ?').run(
        persisted.slug,
        persisted.status,
        JSON.stringify(persisted),
        persisted.updatedAt,
        current.id,
      );

      insertAudit(
        current.id,
        eventType,
        actor,
        typeof result.auditMeta === 'object' && result.auditMeta ? result.auditMeta : eventMeta,
        persisted.updatedAt,
      );
      db.exec('COMMIT');

      const bundle = getBoardById(current.id);
      return {
        ...bundle,
        extra: result.extra ?? null,
      };
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    }
  }

  function mutateBoardAtomic(id, mutatorFn, actor = 'studio', eventType = 'BOARD_UPDATED', eventMeta = {}) {
    return mutateBoardInternal('SELECT * FROM boards WHERE id = ?', id, mutatorFn, actor, eventType, eventMeta);
  }

  function mutateBoardBySlugAtomic(slug, mutatorFn, actor = 'client', eventType = 'BOARD_UPDATED', eventMeta = {}) {
    return mutateBoardInternal('SELECT * FROM boards WHERE slug = ?', slug, mutatorFn, actor, eventType, eventMeta);
  }

  function deleteBoard(id) {
    const existing = db.prepare('SELECT status FROM boards WHERE id = ?').get(id);
    if (!existing) return { deleted: false };
    if (existing.status === 'approved_for_launch') {
      throw makeError('Cannot delete an approved & signed-off launch board', 'BOARD_LOCKED', 409);
    }
    const result = db.prepare('DELETE FROM boards WHERE id = ?').run(id);
    return { deleted: result.changes > 0 };
  }

  function duplicateBoard(id) {
    const existing = db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
    if (!existing) return null;
    const current = parseJsonSafe(existing.board_json, null);
    if (!current) return null;

    const now = new Date().toISOString();
    const newId = `brd-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const newSlug = ensureUniqueSlug(`${current.slug}-v2`);
    const cloned = {
      ...current,
      id: newId,
      slug: newSlug,
      status: 'review_open',
      currentRound: 1,
      pins: [],
      roundHistory: [
        {
          roundNumber: 1,
          status: 'open',
          startedAt: now,
        },
      ],
      signOff: null,
      createdAt: now,
      updatedAt: now,
    };

    db.prepare(
      'INSERT INTO boards (id, slug, status, board_json, view_count, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
    ).run(cloned.id, cloned.slug, cloned.status, JSON.stringify(cloned), now, now);
    insertAudit(cloned.id, 'BOARD_DUPLICATED', 'studio', { sourceBoardId: id }, now);
    return getBoardById(cloned.id);
  }

  function approveBoardAtomic({
    slug,
    signerName,
    signerTitle,
    signerEmail,
    signatureType,
    signatureDataUrl,
    confirmedAllPinsReviewed,
    allowOpenBlockers,
    buildCanonicalText,
    computeMetrics,
    ipHash = '',
    userAgentHash = '',
  }) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = db.prepare('SELECT * FROM boards WHERE slug = ?').get(slug);
      if (!row) {
        db.exec('ROLLBACK');
        return null;
      }
      const current = parseJsonSafe(row.board_json, null);
      if (!current) {
        throw makeError('Corrupted board record', 'CORRUPT_RECORD', 500);
      }
      if (current.status === 'approved_for_launch' || current.signOff !== null) {
        throw makeError('Board has already been approved for launch', 'ALREADY_APPROVED', 409);
      }

      const cleanSigner = String(signerName ?? '').trim();
      if (cleanSigner.length < 2) {
        throw makeError('Signer full name must be at least 2 characters', 'INVALID_SIGNER', 400);
      }
      if (confirmedAllPinsReviewed !== true) {
        throw makeError(
          'Client must confirm all feedback pins have been reviewed',
          'CONFIRMATION_REQUIRED',
          400,
        );
      }
      if (signatureType !== 'drawn' && signatureType !== 'typed') {
        throw makeError("signatureType must be 'drawn' or 'typed'", 'INVALID_SIGNATURE', 400);
      }
      if (
        signatureType === 'drawn' &&
        (!signatureDataUrl || !String(signatureDataUrl).startsWith('data:image/png;base64,'))
      ) {
        throw makeError('Drawn signature PNG payload is required', 'INVALID_SIGNATURE', 400);
      }

      const metrics = computeMetrics(current);
      if (metrics.unresolvedBlockerPins > 0 && allowOpenBlockers !== true) {
        throw makeError(
          'Resolve or reclassify all open blocker pins before launch sign-off',
          'UNRESOLVED_BLOCKER_PINS',
          409,
        );
      }

      const approvedAt = new Date().toISOString();
      const year = new Date().getUTCFullYear();
      db.prepare(
        'INSERT INTO certificate_counters (year, last_seq) VALUES (?, 1) ON CONFLICT(year) DO UPDATE SET last_seq = last_seq + 1',
      ).run(year);
      const seqRow = db.prepare('SELECT last_seq FROM certificate_counters WHERE year = ?').get(year);
      const seq = Number(seqRow?.last_seq || 1);
      const certificateNumber = `SIGN-${year}-${String(seq).padStart(4, '0')}`;

      const canonical = buildCanonicalText(current, cleanSigner, approvedAt);
      const scopeDigestHex = sha256Hex(canonical);

      const signOff = {
        certificateNumber,
        signerName: cleanSigner,
        signatureType,
        confirmedAllPinsReviewed: true,
        scopeDigestHex,
        approvedAt,
        totalRoundsUsed: metrics.roundsUsed,
        resolvedPinsCount: metrics.resolvedPins,
        outOfScopeCount: metrics.outOfScopePins,
      };
      if (signerTitle && String(signerTitle).trim()) {
        signOff.signerTitle = String(signerTitle).trim();
      }
      if (signerEmail && String(signerEmail).trim()) {
        signOff.signerEmail = String(signerEmail).trim();
      }
      if (signatureType === 'drawn' && signatureDataUrl) {
        signOff.signatureDataUrl = signatureDataUrl;
      }

      const updatedBoard = {
        ...current,
        status: 'approved_for_launch',
        signOff,
        updatedAt: approvedAt,
      };

      db.prepare('UPDATE boards SET status = ?, board_json = ?, updated_at = ? WHERE id = ?').run(
        updatedBoard.status,
        JSON.stringify(updatedBoard),
        updatedBoard.updatedAt,
        current.id,
      );

      db.prepare(
        `INSERT INTO certificates
         (certificate_number, board_id, signer_name, scope_digest_hex, certificate_json, ip_hash, user_agent_hash, approved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        certificateNumber,
        current.id,
        cleanSigner,
        scopeDigestHex,
        JSON.stringify(signOff),
        ipHash,
        userAgentHash,
        approvedAt,
      );

      insertAudit(
        current.id,
        'LAUNCH_APPROVED',
        cleanSigner,
        { certificateNumber, scopeDigestHex, ipHash, userAgentHash },
        approvedAt,
      );

      db.exec('COMMIT');
      return getBoardById(current.id);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  function listCertificates() {
    return db
      .prepare(
        `SELECT c.certificate_json, b.id AS board_id, b.slug AS board_slug, b.board_json
         FROM certificates c
         JOIN boards b ON b.id = c.board_id
         ORDER BY c.approved_at DESC`,
      )
      .all()
      .map((row) => {
        const certificate = parseJsonSafe(row.certificate_json, null);
        const board = parseJsonSafe(row.board_json, null);
        return {
          certificate,
          boardId: row.board_id,
          boardSlug: row.board_slug,
          boardTitle: board?.title ?? '',
          boardTitleAr: board?.titleAr ?? '',
          clientName: board?.clientName ?? '',
          studioName: board?.studioName ?? '',
        };
      })
      .filter((entry) => entry.certificate !== null);
  }

  function getCertificateByNumber(certificateNumber) {
    const row = db
      .prepare(
        `SELECT c.certificate_json, b.board_json
         FROM certificates c
         JOIN boards b ON b.id = c.board_id
         WHERE c.certificate_number = ?`,
      )
      .get(certificateNumber);
    if (!row) return null;
    return {
      certificate: parseJsonSafe(row.certificate_json, null),
      board: parseJsonSafe(row.board_json, null),
    };
  }

  return {
    sha256Hex,
    uploadsDir,
    getStats,
    listBoards,
    getBoardById,
    getBoardBySlug,
    recordPublicView,
    createBoard,
    mutateBoardAtomic,
    mutateBoardBySlugAtomic,
    deleteBoard,
    duplicateBoard,
    approveBoardAtomic,
    listCertificates,
    getCertificateByNumber,
    close: () => db.close(),
  };
}
