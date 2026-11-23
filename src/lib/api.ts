import { generateLaunchSignOff } from '../core/certificate.ts';
import { PINSIGN_PRESETS, createBoardFromPreset, type PinSignPresetMeta } from '../core/presets.ts';
import {
  addPinReply,
  advanceRevisionRound,
  computeBoardMetrics,
  createNextPin,
  updatePinStatus,
} from '../core/revisions.ts';
import type {
  BoardMetrics,
  CreatePinInput,
  LaunchSignOff,
  PinStatus,
  ReviewBoard,
  SignOffInput,
} from '../core/types.ts';
import { withBase } from './basePath.ts';

export interface AuditEventItem {
  id: number;
  boardId: string;
  eventType: string;
  actor: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface BoardSummary {
  id: string;
  slug: string;
  status: ReviewBoard['status'];
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  certificateNumber: string | null;
  approvedAt: string | null;
  board: ReviewBoard;
  metrics: BoardMetrics;
}

export interface BoardBundle {
  board: ReviewBoard;
  metrics: BoardMetrics;
  viewCount: number;
  certificate: LaunchSignOff | null;
  auditEvents?: AuditEventItem[];
  reviewUrl?: string;
}

export interface BoardStats {
  total: number;
  reviewOpen: number;
  roundSubmitted: number;
  approvedForLaunch: number;
  certificatesCount: number;
}

export interface PresetMeta {
  id: PinSignPresetMeta['id'];
  nameEn: string;
  nameAr: string;
  badgeEn: string;
  badgeAr: string;
}

export interface CertificateRecord {
  certificate: LaunchSignOff;
  boardId: string;
  boardSlug: string;
  boardTitle: string;
  boardTitleAr?: string;
  clientName: string;
  studioName: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const LOCAL_STORE_KEY = 'pinsign_local_store_v1';

interface LocalStoreShape {
  boards: ReviewBoard[];
  certificates: Record<string, LaunchSignOff>;
  views: Record<string, number>;
  seq: number;
}

function readLocalStore(): LocalStoreShape {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORE_KEY);
    if (raw) {
      return JSON.parse(raw) as LocalStoreShape;
    }
  } catch {
    // ignore storage errors
  }
  const starter = createBoardFromPreset('saas-landing', { slug: 'demo-northstar' });
  const initial: LocalStoreShape = {
    boards: [starter],
    certificates: {},
    views: {},
    seq: 0,
  };
  writeLocalStore(initial);
  return initial;
}

function writeLocalStore(store: LocalStoreShape): void {
  try {
    window.localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
}

async function requestApi<T>(url: string, init: RequestInit | undefined, fallbackFn: () => Promise<T>): Promise<T> {
  try {
    const res = await fetch(withBase(url), init);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return fallbackFn();
    }
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new ApiError(
        typeof data.error === 'string' ? data.error : `HTTP ${res.status}`,
        res.status,
        typeof data.code === 'string' ? data.code : undefined,
      );
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    return fallbackFn();
  }
}

function buildLocalBundle(store: LocalStoreShape, board: ReviewBoard): BoardBundle {
  return {
    board,
    metrics: computeBoardMetrics(board),
    viewCount: store.views[board.id] ?? 0,
    certificate: store.certificates[board.id] ?? board.signOff ?? null,
    reviewUrl: `${window.location.origin}${withBase(`/r/${encodeURIComponent(board.slug)}`)}`,
  };
}

export async function fetchPresets(): Promise<PresetMeta[]> {
  const data = await requestApi<{ presets: PresetMeta[] }>('/api/presets', undefined, async () => ({
    presets: PINSIGN_PRESETS.map(({ id, nameEn, nameAr, badgeEn, badgeAr }) => ({
      id,
      nameEn,
      nameAr,
      badgeEn,
      badgeAr,
    })),
  }));
  return data.presets;
}

export async function listBoards(): Promise<{ boards: BoardSummary[]; stats: BoardStats }> {
  return requestApi('/api/boards', undefined, async () => {
    const store = readLocalStore();
    const boards: BoardSummary[] = store.boards.map((b) => {
      const cert = store.certificates[b.id] ?? b.signOff;
      return {
        id: b.id,
        slug: b.slug,
        status: b.status,
        viewCount: store.views[b.id] ?? 0,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        certificateNumber: cert ? cert.certificateNumber : null,
        approvedAt: cert ? cert.approvedAt : null,
        board: b,
        metrics: computeBoardMetrics(b),
      };
    });
    return {
      boards,
      stats: {
        total: boards.length,
        reviewOpen: boards.filter((b) => b.status === 'review_open').length,
        roundSubmitted: boards.filter((b) => b.status === 'round_submitted').length,
        approvedForLaunch: boards.filter((b) => b.status === 'approved_for_launch').length,
        certificatesCount: Object.keys(store.certificates).length,
      },
    };
  });
}

export async function getBoard(id: string): Promise<BoardBundle> {
  return requestApi(`/api/boards/${encodeURIComponent(id)}`, undefined, async () => {
    const store = readLocalStore();
    const found = store.boards.find((b) => b.id === id);
    if (!found) throw new ApiError('Board not found', 404);
    return buildLocalBundle(store, found);
  });
}

export async function createBoardFromPresetApi(
  presetId: PinSignPresetMeta['id'],
  overrides: Partial<ReviewBoard> = {},
): Promise<BoardBundle> {
  return requestApi(
    '/api/boards',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId, overrides }),
    },
    async () => {
      const store = readLocalStore();
      const created = createBoardFromPreset(presetId, overrides);
      store.boards = [created, ...store.boards];
      writeLocalStore(store);
      return buildLocalBundle(store, created);
    },
  );
}

export async function updateBoardMeta(
  id: string,
  patch: Partial<ReviewBoard>,
): Promise<BoardBundle> {
  return requestApi(
    `/api/boards/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
    async () => {
      const store = readLocalStore();
      const idx = store.boards.findIndex((b) => b.id === id);
      if (idx === -1) throw new ApiError('Board not found', 404);
      const current = store.boards[idx]!;
      if (current.status === 'approved_for_launch' || current.signOff) {
        throw new ApiError('Board is locked', 409, 'BOARD_LOCKED');
      }
      const next: ReviewBoard = {
        ...current,
        ...patch,
        id: current.id,
        updatedAt: new Date().toISOString(),
      };
      store.boards[idx] = next;
      writeLocalStore(store);
      return buildLocalBundle(store, next);
    },
  );
}

export async function deleteBoardApi(id: string): Promise<void> {
  await requestApi(
    `/api/boards/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    async () => {
      const store = readLocalStore();
      const target = store.boards.find((b) => b.id === id);
      if (!target) throw new ApiError('Board not found', 404);
      if (target.status === 'approved_for_launch') {
        throw new ApiError('Board is locked', 409, 'BOARD_LOCKED');
      }
      store.boards = store.boards.filter((b) => b.id !== id);
      writeLocalStore(store);
      return { deleted: true };
    },
  );
}

export async function duplicateBoardApi(id: string): Promise<BoardBundle> {
  return requestApi(
    `/api/boards/${encodeURIComponent(id)}/duplicate`,
    { method: 'POST' },
    async () => {
      const store = readLocalStore();
      const src = store.boards.find((b) => b.id === id);
      if (!src) throw new ApiError('Board not found', 404);
      const now = new Date().toISOString();
      const cloned: ReviewBoard = {
        ...src,
        id: `brd-${Date.now().toString(36)}`,
        slug: `${src.slug}-v2`,
        status: 'review_open',
        currentRound: 1,
        pins: [],
        roundHistory: [{ roundNumber: 1, status: 'open', startedAt: now }],
        signOff: null,
        createdAt: now,
        updatedAt: now,
      };
      store.boards = [cloned, ...store.boards];
      writeLocalStore(store);
      return buildLocalBundle(store, cloned);
    },
  );
}

export async function uploadBoardScreen(
  boardId: string,
  payload: { title: string; titleAr?: string; urlPath?: string; width?: number; height?: number; imageDataUrl: string },
): Promise<BoardBundle> {
  return requestApi(
    `/api/boards/${encodeURIComponent(boardId)}/screens`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    async () => {
      const store = readLocalStore();
      const idx = store.boards.findIndex((b) => b.id === boardId);
      if (idx === -1) throw new ApiError('Board not found', 404);
      const current = store.boards[idx]!;
      if (current.status === 'approved_for_launch' || current.signOff) {
        throw new ApiError('Board is locked', 409, 'BOARD_LOCKED');
      }
      const now = new Date().toISOString();
      const screen = {
        id: `scr-${Date.now().toString(36)}`,
        title: payload.title,
        titleAr: payload.titleAr,
        urlPath: payload.urlPath || '/',
        width: payload.width || 1280,
        height: payload.height || 820,
        imageDataUrl: payload.imageDataUrl,
        createdAt: now,
      };
      const updated = { ...current, screens: [...current.screens, screen], updatedAt: now };
      store.boards[idx] = updated;
      writeLocalStore(store);
      return buildLocalBundle(store, updated);
    },
  );
}

export async function advanceRoundApi(
  boardId: string,
  submittedBy: string,
  summaryNote?: string,
): Promise<BoardBundle & { exceededAgreedCap?: boolean }> {
  return requestApi(
    `/api/boards/${encodeURIComponent(boardId)}/advance-round`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submittedBy, summaryNote }),
    },
    async () => {
      const store = readLocalStore();
      const idx = store.boards.findIndex((b) => b.id === boardId);
      if (idx === -1) throw new ApiError('Board not found', 404);
      const resAdv = advanceRevisionRound(store.boards[idx]!, submittedBy, summaryNote);
      store.boards[idx] = resAdv.board;
      writeLocalStore(store);
      return { ...buildLocalBundle(store, resAdv.board), exceededAgreedCap: resAdv.exceededAgreedCap };
    },
  );
}

export async function createStudioPin(boardId: string, input: CreatePinInput): Promise<BoardBundle> {
  return requestApi(
    `/api/boards/${encodeURIComponent(boardId)}/pins`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    async () => {
      const store = readLocalStore();
      const idx = store.boards.findIndex((b) => b.id === boardId);
      if (idx === -1) throw new ApiError('Board not found', 404);
      const current = store.boards[idx]!;
      const pin = createNextPin(current, input);
      const updated = { ...current, pins: [...current.pins, pin], updatedAt: pin.createdAt };
      store.boards[idx] = updated;
      writeLocalStore(store);
      return buildLocalBundle(store, updated);
    },
  );
}

export async function patchPinStatus(
  boardId: string,
  pinId: string,
  status: PinStatus,
  outOfScopeQuote?: number,
): Promise<BoardBundle> {
  return requestApi(
    `/api/boards/${encodeURIComponent(boardId)}/pins/${encodeURIComponent(pinId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, outOfScopeQuote }),
    },
    async () => {
      const store = readLocalStore();
      const idx = store.boards.findIndex((b) => b.id === boardId);
      if (idx === -1) throw new ApiError('Board not found', 404);
      const updated = updatePinStatus(store.boards[idx]!, pinId, status, new Date().toISOString(), outOfScopeQuote);
      store.boards[idx] = updated;
      writeLocalStore(store);
      return buildLocalBundle(store, updated);
    },
  );
}

export async function replyToStudioPin(
  boardId: string,
  pinId: string,
  authorName: string,
  body: string,
): Promise<BoardBundle> {
  return requestApi(
    `/api/boards/${encodeURIComponent(boardId)}/pins/${encodeURIComponent(pinId)}/replies`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorName, authorRole: 'designer', body }),
    },
    async () => {
      const store = readLocalStore();
      const idx = store.boards.findIndex((b) => b.id === boardId);
      if (idx === -1) throw new ApiError('Board not found', 404);
      const updated = addPinReply(store.boards[idx]!, pinId, authorName, 'designer', body);
      store.boards[idx] = updated;
      writeLocalStore(store);
      return buildLocalBundle(store, updated);
    },
  );
}

export async function getPublicBoard(slug: string): Promise<BoardBundle> {
  return requestApi(`/api/public/boards/${encodeURIComponent(slug)}`, undefined, async () => {
    const store = readLocalStore();
    const found = store.boards.find((b) => b.slug === slug);
    if (!found) throw new ApiError('Review board not found', 404);
    store.views[found.id] = (store.views[found.id] ?? 0) + 1;
    writeLocalStore(store);
    return buildLocalBundle(store, found);
  });
}

export async function createPublicPin(slug: string, input: CreatePinInput): Promise<BoardBundle> {
  return requestApi(
    `/api/public/boards/${encodeURIComponent(slug)}/pins`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    async () => {
      const store = readLocalStore();
      const idx = store.boards.findIndex((b) => b.slug === slug);
      if (idx === -1) throw new ApiError('Review board not found', 404);
      const current = store.boards[idx]!;
      const pin = createNextPin(current, { ...input, authorRole: 'client' });
      const updated = { ...current, pins: [...current.pins, pin], updatedAt: pin.createdAt };
      store.boards[idx] = updated;
      writeLocalStore(store);
      return buildLocalBundle(store, updated);
    },
  );
}

export async function replyToPublicPin(
  slug: string,
  pinId: string,
  authorName: string,
  body: string,
): Promise<BoardBundle> {
  return requestApi(
    `/api/public/boards/${encodeURIComponent(slug)}/pins/${encodeURIComponent(pinId)}/replies`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorName, body }),
    },
    async () => {
      const store = readLocalStore();
      const idx = store.boards.findIndex((b) => b.slug === slug);
      if (idx === -1) throw new ApiError('Review board not found', 404);
      const updated = addPinReply(store.boards[idx]!, pinId, authorName, 'client', body);
      store.boards[idx] = updated;
      writeLocalStore(store);
      return buildLocalBundle(store, updated);
    },
  );
}

export async function approvePublicBoard(slug: string, input: SignOffInput): Promise<BoardBundle> {
  return requestApi(
    `/api/public/boards/${encodeURIComponent(slug)}/approve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    async () => {
      const store = readLocalStore();
      const idx = store.boards.findIndex((b) => b.slug === slug);
      if (idx === -1) throw new ApiError('Review board not found', 404);
      const current = store.boards[idx]!;
      store.seq += 1;
      const year = new Date().getUTCFullYear();
      const certNum = `SIGN-${year}-${String(store.seq).padStart(4, '0')}`;
      const signOff = await generateLaunchSignOff(current, input, certNum);
      const updated: ReviewBoard = {
        ...current,
        status: 'approved_for_launch',
        signOff,
        updatedAt: signOff.approvedAt,
      };
      store.boards[idx] = updated;
      store.certificates[current.id] = signOff;
      writeLocalStore(store);
      return buildLocalBundle(store, updated);
    },
  );
}

export async function listCertificates(): Promise<CertificateRecord[]> {
  const data = await requestApi<{ certificates: CertificateRecord[] }>('/api/certificates', undefined, async () => {
    const store = readLocalStore();
    return {
      certificates: Object.entries(store.certificates).map(([boardId, certificate]) => {
        const b = store.boards.find((item) => item.id === boardId);
        return {
          certificate,
          boardId,
          boardSlug: b?.slug ?? boardId,
          boardTitle: b?.title ?? certificate.certificateNumber,
          boardTitleAr: b?.titleAr,
          clientName: b?.clientName ?? '',
          studioName: b?.studioName ?? '',
        };
      }),
    };
  });
  return data.certificates;
}

export async function getCertificate(
  certificateNumber: string,
): Promise<{ certificate: LaunchSignOff; board: ReviewBoard | null; metrics: BoardMetrics | null }> {
  return requestApi(
    `/api/certificates/${encodeURIComponent(certificateNumber)}`,
    undefined,
    async () => {
      const store = readLocalStore();
      const foundEntry = Object.entries(store.certificates).find(
        ([, cert]) => cert.certificateNumber === certificateNumber,
      );
      if (!foundEntry) throw new ApiError('Certificate not found', 404);
      const board = store.boards.find((b) => b.id === foundEntry[0]) ?? null;
      return {
        certificate: foundEntry[1],
        board,
        metrics: board ? computeBoardMetrics(board) : null,
      };
    },
  );
}
