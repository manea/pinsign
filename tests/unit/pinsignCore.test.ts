import { describe, expect, it } from 'vitest';
import {
  generateLaunchSignOff,
  verifySignOffIntegrity,
} from '../../src/core/certificate.ts';
import {
  buildEmbedScriptTag,
  buildReviewShareMessage,
} from '../../src/core/embedSnippet.ts';
import { PINSIGN_PRESETS, createBoardFromPreset } from '../../src/core/presets.ts';
import {
  PinSignCoreError,
  addPinReply,
  advanceRevisionRound,
  canAddPinInRound,
  clampPercent,
  computeBoardMetrics,
  createNextPin,
  updatePinStatus,
} from '../../src/core/revisions.ts';

describe('PinSign Core Engine — Annotations, Revisions & Launch Sign-Off', () => {
  it('clamps pin coordinates cleanly, assigns monotonic pinNumbers, and validates inputs', () => {
    expect(clampPercent(-12)).toBe(0);
    expect(clampPercent(145.678)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(50);
    expect(clampPercent(42.126)).toBe(42.13);

    const board = createBoardFromPreset('saas-landing', { id: 'brd-1', slug: 'northstar-v2' });
    const pin3 = createNextPin(
      board,
      {
        screenId: 'scr-home',
        xPct: -8,
        yPct: 120.444,
        comment: 'Increase card gutter spacing by 8px',
        authorName: 'Liam Carter',
        selectorHint: '.features-grid > div',
      },
      '2026-11-24T01:00:00Z',
    );

    expect(pin3.pinNumber).toBe(3);
    expect(pin3.xPct).toBe(0);
    expect(pin3.yPct).toBe(100);
    expect(pin3.priority).toBe('normal');
    expect(pin3.device).toBe('desktop');
    expect(pin3.selectorHint).toBe('.features-grid > div');

    expect(() =>
      createNextPin(board, {
        screenId: 'unknown-screen',
        xPct: 20,
        yPct: 30,
        comment: 'Check spacing',
        authorName: 'Liam',
      }),
    ).toThrowError(PinSignCoreError);

    try {
      createNextPin(board, {
        screenId: 'scr-home',
        xPct: 20,
        yPct: 30,
        comment: '   ',
        authorName: 'Liam',
      });
    } catch (err) {
      expect((err as PinSignCoreError).code).toBe('EMPTY_COMMENT');
    }
  });

  it('computes board metrics across pin statuses, extra rounds, out-of-scope quotes, and blockers', () => {
    let board = createBoardFromPreset('saas-landing', {
      agreedRounds: 2,
      currentRound: 3,
      extraRoundFee: 250,
    });
    const extraPin = createNextPin(board, {
      screenId: 'scr-pricing',
      xPct: 35,
      yPct: 60,
      comment: 'Build an animated interactive ROI calculator widget',
      authorName: 'Liam Carter',
    });
    board = { ...board, pins: [...board.pins, extraPin] };
    board = updatePinStatus(board, extraPin.id, 'out_of_scope', '2026-11-24T01:05:00Z', 400);

    const metrics = computeBoardMetrics(board);
    expect(metrics.totalPins).toBe(3);
    expect(metrics.openPins).toBe(1);
    expect(metrics.resolvedPins).toBe(1);
    expect(metrics.outOfScopePins).toBe(1);
    expect(metrics.unresolvedBlockerPins).toBe(1);
    expect(metrics.roundsRemaining).toBe(0);
    expect(metrics.extraRoundsUsed).toBe(1);
    expect(metrics.isOverRoundLimit).toBe(true);
    // 1 extra round * $250 + $400 out-of-scope quote = $650
    expect(metrics.estimatedExtraFees).toBe(650);
    expect(metrics.canApproveForLaunch).toBe(false);
    expect(metrics.approvalBlockers).toContain('UNRESOLVED_BLOCKER_PINS');
  });

  it('advances revision rounds cleanly and flags when agreed revision cap is exceeded', () => {
    const board = createBoardFromPreset('shopify-store', { agreedRounds: 2, currentRound: 1 });
    expect(canAddPinInRound(board).requiresExtraRoundApproval).toBe(false);

    const round2Res = advanceRevisionRound(
      board,
      'مها المزروعي',
      'First round tweaks submitted',
      '2026-11-24T01:10:00Z',
    );
    expect(round2Res.exceededAgreedCap).toBe(false);
    expect(round2Res.board.currentRound).toBe(2);
    expect(round2Res.board.roundHistory[0]?.status).toBe('submitted');
    expect(round2Res.board.roundHistory[0]?.openPinsAtClose).toBe(1);
    expect(canAddPinInRound(round2Res.board).requiresExtraRoundApproval).toBe(false);

    const round3Res = advanceRevisionRound(
      round2Res.board,
      'مها المزروعي',
      'Extra requested tweak round',
      '2026-11-24T01:20:00Z',
    );
    expect(round3Res.exceededAgreedCap).toBe(true);
    expect(round3Res.board.currentRound).toBe(3);
    expect(canAddPinInRound(round3Res.board).requiresExtraRoundApproval).toBe(true);
  });

  it('manages replies, resolution timestamps, and rejects mutations once board is locked', () => {
    let board = createBoardFromPreset('shopify-store');
    board = addPinReply(
      board,
      'pin-1',
      'استوديو أفق الرقمي',
      'designer',
      'Updated Apple Pay dark contrast pill for mobile viewports.',
      '2026-11-24T01:12:00Z',
    );
    expect(board.pins[0]?.replies).toHaveLength(1);

    board = updatePinStatus(board, 'pin-1', 'resolved', '2026-11-24T01:13:00Z');
    expect(board.pins[0]?.resolvedAt).toBe('2026-11-24T01:13:00Z');

    board = updatePinStatus(board, 'pin-1', 'open', '2026-11-24T01:14:00Z');
    expect(board.pins[0]?.resolvedAt).toBeUndefined();

    const lockedBoard = { ...board, status: 'approved_for_launch' as const };
    expect(canAddPinInRound(lockedBoard)).toEqual({
      allowed: false,
      reasonCode: 'BOARD_LOCKED',
      requiresExtraRoundApproval: false,
    });
    expect(() =>
      addPinReply(lockedBoard, 'pin-1', 'Client', 'client', 'One more late change'),
    ).toThrowError(PinSignCoreError);
    expect(() => updatePinStatus(lockedBoard, 'pin-1', 'resolved')).toThrowError(PinSignCoreError);
    expect(() => advanceRevisionRound(lockedBoard, 'Client')).toThrowError(PinSignCoreError);
  });

  it('gates Launch Sign-Off on unresolved blockers & explicit confirmation and validates drawn PNG', async () => {
    const board = createBoardFromPreset('saas-landing');

    await expect(
      generateLaunchSignOff(
        board,
        {
          signerName: 'Liam Carter',
          signatureType: 'typed',
          confirmedAllPinsReviewed: true,
        },
        'SIGN-2026-0001',
      ),
    ).rejects.toMatchObject({ code: 'UNRESOLVED_BLOCKER_PINS' });

    const resolvedBoard = updatePinStatus(board, 'pin-1', 'resolved', '2026-11-24T01:15:00Z');

    await expect(
      generateLaunchSignOff(
        resolvedBoard,
        {
          signerName: 'Liam Carter',
          signatureType: 'typed',
          confirmedAllPinsReviewed: false,
        },
        'SIGN-2026-0001',
      ),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });

    await expect(
      generateLaunchSignOff(
        resolvedBoard,
        {
          signerName: 'Liam Carter',
          signatureType: 'drawn',
          signatureDataUrl: 'javascript:alert(1)',
          confirmedAllPinsReviewed: true,
        },
        'SIGN-2026-0001',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });

    const signOff = await generateLaunchSignOff(
      resolvedBoard,
      {
        signerName: 'Liam Carter',
        signerTitle: 'Head of Growth',
        signatureType: 'typed',
        confirmedAllPinsReviewed: true,
      },
      'SIGN-2026-0001',
      '2026-11-24T01:16:00Z',
    );

    expect(signOff.certificateNumber).toBe('SIGN-2026-0001');
    expect(signOff.scopeDigestHex).toMatch(/^[0-9a-f]{64}$/);
    expect(signOff.resolvedPinsCount).toBe(2);
  });

  it('detects any post-approval tampering via SHA-256 verifySignOffIntegrity', async () => {
    const resolvedBoard = updatePinStatus(
      createBoardFromPreset('saas-landing'),
      'pin-1',
      'resolved',
      '2026-11-24T01:17:00Z',
    );
    const signOff = await generateLaunchSignOff(
      resolvedBoard,
      {
        signerName: 'Liam Carter',
        signatureType: 'typed',
        confirmedAllPinsReviewed: true,
      },
      'SIGN-2026-0001',
      '2026-11-24T01:18:00Z',
    );

    const signedBoard = {
      ...resolvedBoard,
      status: 'approved_for_launch' as const,
      signOff,
    };

    const validResult = await verifySignOffIntegrity(signedBoard);
    expect(validResult.valid).toBe(true);
    expect(validResult.expectedDigest).toBe(validResult.actualDigest);

    // Mutate pin comment post-approval -> integrity fails
    const tamperedBoard = {
      ...signedBoard,
      pins: signedBoard.pins.map((p) =>
        p.id === 'pin-1' ? { ...p, comment: 'Secretly added unpaid scope!' } : p,
      ),
    };
    const tamperedResult = await verifySignOffIntegrity(tamperedBoard);
    expect(tamperedResult.valid).toBe(false);
    expect(tamperedResult.expectedDigest).not.toBe(tamperedResult.actualDigest);
  });

  it('generates XSS-escaped embed script snippets and bilingual EN/AR client share messages', () => {
    const tag = buildEmbedScriptTag('https://pinsign.example.com/', 'client" onerror="alert(1)<script>', {
      position: 'bottom-left',
      locale: 'ar',
    });

    expect(tag).toContain('src="https://pinsign.example.com/embed.js"');
    expect(tag).toContain('data-pinsign-slug="client&quot; onerror=&quot;alert(1)&lt;script&gt;"');
    expect(tag).toContain('data-position="bottom-left"');
    expect(tag).toContain('data-locale="ar"');

    const board = createBoardFromPreset('shopify-store');
    const enMsg = buildReviewShareMessage(board, 'https://pinsign.example.com/r/rawaa', 'en');
    const arMsg = buildReviewShareMessage(board, 'https://pinsign.example.com/r/rawaa', 'ar');

    expect(enMsg).toContain('Round 1 of 2 included');
    expect(enMsg).toContain('https://pinsign.example.com/r/rawaa');
    expect(arMsg).toContain('الجولة 1 من أصل 2');
    expect(arMsg).toContain('https://pinsign.example.com/r/rawaa');
  });

  it('builds all 3 PinSign starter presets with crisp SVG data-URI previews and consistent metrics', () => {
    expect(PINSIGN_PRESETS).toHaveLength(3);
    for (const preset of PINSIGN_PRESETS) {
      const board = createBoardFromPreset(preset.id);
      expect(board.screens.length).toBeGreaterThanOrEqual(1);
      for (const scr of board.screens) {
        expect(scr.imageDataUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
      }
      const metrics = computeBoardMetrics(board);
      expect(metrics.roundsUsed).toBe(1);
      expect(metrics.agreedRounds).toBeGreaterThanOrEqual(2);
    }
  });
});
