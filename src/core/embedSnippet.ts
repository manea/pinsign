import { computeBoardMetrics } from './revisions.ts';
import type { Locale, ReviewBoard } from './types.ts';

export function escapeHtmlAttr(val: string): string {
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildEmbedScriptTag(
  appOrigin: string,
  boardSlug: string,
  options?: { position?: 'bottom-right' | 'bottom-left'; locale?: Locale },
): string {
  const normalizedOrigin = appOrigin.trim().replace(/\/+$/, '');
  const pos = options?.position === 'bottom-left' ? 'bottom-left' : 'bottom-right';
  const loc = options?.locale === 'ar' ? 'ar' : 'en';
  const scriptSrc = escapeHtmlAttr(`${normalizedOrigin}/embed.js`);
  const safeSlug = escapeHtmlAttr(boardSlug.trim());

  return `<script defer src="${scriptSrc}" data-pinsign-slug="${safeSlug}" data-position="${pos}" data-locale="${loc}"></script>`;
}

export function buildReviewShareMessage(
  board: ReviewBoard,
  reviewUrl: string,
  locale: Locale,
): string {
  const metrics = computeBoardMetrics(board);

  if (locale === 'ar') {
    const title = board.titleAr || board.title;
    return [
      `مرحباً ${board.clientName}،`,
      `رابط مراجعة واعتماد «${title}» جاهز الآن عبر PinSign (الجولة ${metrics.roundsUsed} من أصل ${metrics.agreedRounds} جولات متفق عليها).`,
      `الملاحظات المفتوحة حالياً: ${metrics.openPins + metrics.inProgressPins} | المحلولة: ${metrics.resolvedPins}.`,
      `يمكنك إضافة ملاحظاتك مباشرة على الشاشات أو اعتماد الإطلاق النهائي عبر الرابط:`,
      reviewUrl,
    ].join('\n');
  }

  return [
    `Hi ${board.clientName},`,
    `Your visual review board for "${board.title}" is ready on PinSign (Round ${metrics.roundsUsed} of ${metrics.agreedRounds} included).`,
    `Open feedback pins: ${metrics.openPins + metrics.inProgressPins} | Resolved: ${metrics.resolvedPins}.`,
    `Drop feedback pins directly on the screens or sign off for launch here:`,
    reviewUrl,
  ].join('\n');
}
