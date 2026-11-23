import type {
  BoardMetrics,
  CreatePinInput,
  PinStatus,
  ReviewBoard,
  ReviewPin,
} from './types.ts';

export class PinSignCoreError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'PinSignCoreError';
    this.code = code;
  }
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  const clamped = Math.min(100, Math.max(0, value));
  return roundTwo(clamped);
}

export function computeBoardMetrics(board: ReviewBoard): BoardMetrics {
  let openPins = 0;
  let inProgressPins = 0;
  let resolvedPins = 0;
  let outOfScopePins = 0;
  let unresolvedBlockerPins = 0;
  let outOfScopeQuoteTotal = 0;

  for (const pin of board.pins) {
    if (pin.status === 'open') openPins += 1;
    else if (pin.status === 'in_progress') inProgressPins += 1;
    else if (pin.status === 'resolved') resolvedPins += 1;
    else if (pin.status === 'out_of_scope') outOfScopePins += 1;

    if (pin.priority === 'blocker' && (pin.status === 'open' || pin.status === 'in_progress')) {
      unresolvedBlockerPins += 1;
    }

    if (
      pin.status === 'out_of_scope' &&
      typeof pin.outOfScopeQuote === 'number' &&
      Number.isFinite(pin.outOfScopeQuote) &&
      pin.outOfScopeQuote > 0
    ) {
      outOfScopeQuoteTotal += pin.outOfScopeQuote;
    }
  }

  const agreedRounds = Math.max(1, Math.floor(board.agreedRounds));
  const roundsUsed = Math.max(1, Math.floor(board.currentRound));
  const roundsRemaining = Math.max(0, agreedRounds - roundsUsed);
  const extraRoundsUsed = Math.max(0, roundsUsed - agreedRounds);
  const isOverRoundLimit = roundsUsed > agreedRounds;
  const extraRoundFee = Number.isFinite(board.extraRoundFee)
    ? Math.max(0, board.extraRoundFee)
    : 0;
  const estimatedExtraFees = roundTwo(extraRoundsUsed * extraRoundFee + outOfScopeQuoteTotal);

  const approvalBlockers: string[] = [];
  if (board.status === 'approved_for_launch' || board.signOff !== null) {
    approvalBlockers.push('ALREADY_APPROVED');
  }
  if (unresolvedBlockerPins > 0) {
    approvalBlockers.push('UNRESOLVED_BLOCKER_PINS');
  }

  return {
    totalPins: board.pins.length,
    openPins,
    inProgressPins,
    resolvedPins,
    outOfScopePins,
    unresolvedBlockerPins,
    roundsUsed,
    agreedRounds,
    roundsRemaining,
    extraRoundsUsed,
    isOverRoundLimit,
    estimatedExtraFees,
    canApproveForLaunch: approvalBlockers.length === 0,
    approvalBlockers,
  };
}

export function canAddPinInRound(board: ReviewBoard): {
  allowed: boolean;
  reasonCode?: 'BOARD_LOCKED';
  requiresExtraRoundApproval: boolean;
} {
  if (board.status === 'approved_for_launch' || board.signOff !== null) {
    return {
      allowed: false,
      reasonCode: 'BOARD_LOCKED',
      requiresExtraRoundApproval: false,
    };
  }
  const agreedRounds = Math.max(1, Math.floor(board.agreedRounds));
  const currentRound = Math.max(1, Math.floor(board.currentRound));
  return {
    allowed: true,
    requiresExtraRoundApproval: currentRound > agreedRounds,
  };
}

export function createNextPin(
  board: ReviewBoard,
  input: CreatePinInput,
  nowIso: string = new Date().toISOString(),
): ReviewPin {
  const gate = canAddPinInRound(board);
  if (!gate.allowed) {
    throw new PinSignCoreError('Board is locked after final launch sign-off', 'BOARD_LOCKED');
  }
  if (!board.screens.some((s) => s.id === input.screenId)) {
    throw new PinSignCoreError(`Unknown screenId: ${input.screenId}`, 'SCREEN_NOT_FOUND');
  }
  const comment = input.comment.trim();
  if (!comment) {
    throw new PinSignCoreError('Pin comment cannot be empty', 'EMPTY_COMMENT');
  }
  const authorName = input.authorName.trim();
  if (!authorName) {
    throw new PinSignCoreError('Author name is required', 'EMPTY_AUTHOR');
  }

  const maxPinNumber = board.pins.reduce((max, p) => Math.max(max, p.pinNumber), 0);
  const pinNumber = maxPinNumber + 1;
  const candidateId = `pin-${pinNumber}`;
  const uniqueId = board.pins.some((p) => p.id === candidateId)
    ? `pin-${pinNumber}-${Date.now().toString(36)}`
    : candidateId;

  const pin: ReviewPin = {
    id: uniqueId,
    pinNumber,
    screenId: input.screenId,
    xPct: clampPercent(input.xPct),
    yPct: clampPercent(input.yPct),
    roundNumber: Math.max(1, Math.floor(board.currentRound)),
    status: 'open',
    priority: input.priority ?? 'normal',
    device: input.device ?? 'desktop',
    authorName,
    authorRole: input.authorRole ?? 'client',
    comment,
    replies: [],
    createdAt: nowIso,
  };

  if (input.selectorHint && input.selectorHint.trim()) {
    pin.selectorHint = input.selectorHint.trim();
  }

  return pin;
}

export function addPinReply(
  board: ReviewBoard,
  pinId: string,
  authorName: string,
  authorRole: 'client' | 'designer',
  body: string,
  nowIso: string = new Date().toISOString(),
): ReviewBoard {
  if (board.status === 'approved_for_launch' || board.signOff !== null) {
    throw new PinSignCoreError('Board is locked after final launch sign-off', 'BOARD_LOCKED');
  }
  const trimmedAuthor = authorName.trim();
  if (!trimmedAuthor) {
    throw new PinSignCoreError('Reply author name is required', 'EMPTY_AUTHOR');
  }
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    throw new PinSignCoreError('Reply body cannot be empty', 'EMPTY_REPLY');
  }
  const targetIdx = board.pins.findIndex((p) => p.id === pinId);
  if (targetIdx === -1) {
    throw new PinSignCoreError(`Pin not found: ${pinId}`, 'PIN_NOT_FOUND');
  }

  const nextPins = board.pins.map((pin) => {
    if (pin.id !== pinId) return pin;
    const replyId = `rep-${pin.pinNumber}-${pin.replies.length + 1}`;
    return {
      ...pin,
      replies: [
        ...pin.replies,
        {
          id: replyId,
          authorName: trimmedAuthor,
          authorRole,
          body: trimmedBody,
          createdAt: nowIso,
        },
      ],
    };
  });

  return {
    ...board,
    pins: nextPins,
    updatedAt: nowIso,
  };
}

export function updatePinStatus(
  board: ReviewBoard,
  pinId: string,
  status: PinStatus,
  nowIso: string = new Date().toISOString(),
  outOfScopeQuote?: number,
): ReviewBoard {
  if (board.status === 'approved_for_launch' || board.signOff !== null) {
    throw new PinSignCoreError('Board is locked after final launch sign-off', 'BOARD_LOCKED');
  }
  const exists = board.pins.some((p) => p.id === pinId);
  if (!exists) {
    throw new PinSignCoreError(`Pin not found: ${pinId}`, 'PIN_NOT_FOUND');
  }

  const nextPins: ReviewPin[] = board.pins.map((pin) => {
    if (pin.id !== pinId) return pin;
    const updated: ReviewPin = {
      ...pin,
      status,
    };
    if (status === 'resolved') {
      updated.resolvedAt = nowIso;
    } else {
      delete updated.resolvedAt;
    }
    if (status === 'out_of_scope') {
      if (typeof outOfScopeQuote === 'number' && Number.isFinite(outOfScopeQuote) && outOfScopeQuote >= 0) {
        updated.outOfScopeQuote = roundTwo(outOfScopeQuote);
      }
    } else {
      delete updated.outOfScopeQuote;
    }
    return updated;
  });

  return {
    ...board,
    pins: nextPins,
    updatedAt: nowIso,
  };
}

export function advanceRevisionRound(
  board: ReviewBoard,
  submittedBy: string,
  summaryNote?: string,
  nowIso: string = new Date().toISOString(),
): { board: ReviewBoard; exceededAgreedCap: boolean } {
  if (board.status === 'approved_for_launch' || board.signOff !== null) {
    throw new PinSignCoreError('Board is locked after final launch sign-off', 'BOARD_LOCKED');
  }
  const actor = submittedBy.trim();
  if (!actor) {
    throw new PinSignCoreError('Submitted-by actor name is required', 'EMPTY_AUTHOR');
  }

  const metrics = computeBoardMetrics(board);
  const currentRoundNum = Math.max(1, Math.floor(board.currentRound));
  const openPinsAtClose = metrics.openPins + metrics.inProgressPins;
  const resolvedPinsAtClose = metrics.resolvedPins;

  let foundExisting = false;
  const updatedHistory = board.roundHistory.map((entry) => {
    if (entry.roundNumber !== currentRoundNum) return entry;
    foundExisting = true;
    return {
      ...entry,
      status: 'submitted' as const,
      submittedAt: nowIso,
      submittedBy: actor,
      summaryNote: summaryNote?.trim() || entry.summaryNote,
      openPinsAtClose,
      resolvedPinsAtClose,
    };
  });

  if (!foundExisting) {
    updatedHistory.push({
      roundNumber: currentRoundNum,
      status: 'submitted',
      startedAt: board.createdAt,
      submittedAt: nowIso,
      submittedBy: actor,
      summaryNote: summaryNote?.trim() || undefined,
      openPinsAtClose,
      resolvedPinsAtClose,
    });
  }

  const nextRound = currentRoundNum + 1;
  updatedHistory.push({
    roundNumber: nextRound,
    status: 'open',
    startedAt: nowIso,
  });

  const nextBoard: ReviewBoard = {
    ...board,
    status: 'review_open',
    currentRound: nextRound,
    roundHistory: updatedHistory,
    updatedAt: nowIso,
  };

  return {
    board: nextBoard,
    exceededAgreedCap: nextRound > Math.max(1, Math.floor(board.agreedRounds)),
  };
}
