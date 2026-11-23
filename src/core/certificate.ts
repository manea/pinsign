import { PinSignCoreError, computeBoardMetrics } from './revisions.ts';
import type { LaunchSignOff, ReviewBoard, SignOffInput } from './types.ts';

export function buildSignOffCanonicalText(
  board: ReviewBoard,
  signerName: string,
  approvedAt: string,
): string {
  const sortedScreens = [...board.screens]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => ({
      id: s.id,
      title: s.title,
      urlPath: s.urlPath,
      width: s.width,
      height: s.height,
    }));

  const sortedPins = [...board.pins]
    .sort((a, b) => a.pinNumber - b.pinNumber)
    .map((p) => ({
      pinNumber: p.pinNumber,
      screenId: p.screenId,
      roundNumber: p.roundNumber,
      status: p.status,
      priority: p.priority,
      comment: p.comment,
      outOfScopeQuote: p.outOfScopeQuote ?? null,
    }));

  const sortedRounds = [...board.roundHistory]
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .map((r) => ({
      roundNumber: r.roundNumber,
      status: r.status,
      submittedAt: r.submittedAt ?? null,
      submittedBy: r.submittedBy ?? null,
    }));

  return JSON.stringify({
    boardId: board.id,
    slug: board.slug,
    title: board.title,
    clientName: board.clientName,
    studioName: board.studioName,
    agreedRounds: board.agreedRounds,
    currentRound: board.currentRound,
    screens: sortedScreens,
    pins: sortedPins,
    roundHistory: sortedRounds,
    signerName: signerName.trim(),
    approvedAt,
  });
}

export async function computeSha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const digestBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(digestBuffer);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function generateLaunchSignOff(
  board: ReviewBoard,
  input: SignOffInput,
  certificateNumber: string,
  nowIso: string = new Date().toISOString(),
): Promise<LaunchSignOff> {
  if (board.status === 'approved_for_launch' || board.signOff !== null) {
    throw new PinSignCoreError('Board has already been approved for launch', 'ALREADY_APPROVED');
  }

  const signerName = input.signerName.trim();
  if (signerName.length < 2) {
    throw new PinSignCoreError('Signer full name must be at least 2 characters', 'INVALID_SIGNER');
  }

  if (input.confirmedAllPinsReviewed !== true) {
    throw new PinSignCoreError(
      'Client must confirm all feedback pins have been reviewed',
      'CONFIRMATION_REQUIRED',
    );
  }

  if (
    input.signatureType === 'drawn' &&
    (!input.signatureDataUrl || !input.signatureDataUrl.startsWith('data:image/png;base64,'))
  ) {
    throw new PinSignCoreError('Drawn signature PNG payload is required', 'INVALID_SIGNATURE');
  }

  const metrics = computeBoardMetrics(board);
  if (metrics.unresolvedBlockerPins > 0 && input.allowOpenBlockers !== true) {
    throw new PinSignCoreError(
      'Resolve or reclassify all open blocker pins before launch sign-off',
      'UNRESOLVED_BLOCKER_PINS',
    );
  }

  const canonical = buildSignOffCanonicalText(board, signerName, nowIso);
  const scopeDigestHex = await computeSha256Hex(canonical);

  const signOff: LaunchSignOff = {
    certificateNumber,
    signerName,
    signatureType: input.signatureType,
    confirmedAllPinsReviewed: true,
    scopeDigestHex,
    approvedAt: nowIso,
    totalRoundsUsed: metrics.roundsUsed,
    resolvedPinsCount: metrics.resolvedPins,
    outOfScopeCount: metrics.outOfScopePins,
  };

  if (input.signerTitle?.trim()) signOff.signerTitle = input.signerTitle.trim();
  if (input.signerEmail?.trim()) signOff.signerEmail = input.signerEmail.trim();
  if (input.signatureType === 'drawn' && input.signatureDataUrl) {
    signOff.signatureDataUrl = input.signatureDataUrl;
  }

  return signOff;
}

export async function verifySignOffIntegrity(board: ReviewBoard): Promise<{
  valid: boolean;
  expectedDigest: string;
  actualDigest: string;
}> {
  if (!board.signOff) {
    return {
      valid: false,
      expectedDigest: '',
      actualDigest: '',
    };
  }
  const canonical = buildSignOffCanonicalText(
    board,
    board.signOff.signerName,
    board.signOff.approvedAt,
  );
  const actualDigest = await computeSha256Hex(canonical);
  const expectedDigest = board.signOff.scopeDigestHex;
  return {
    valid: expectedDigest === actualDigest,
    expectedDigest,
    actualDigest,
  };
}
