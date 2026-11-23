import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { verifySignOffIntegrity } from '../core/certificate.ts';
import type { BoardMetrics, LaunchSignOff, Locale, ReviewBoard } from '../core/types.ts';
import {
  formatMoney,
  formatShortDate,
  getCopy,
  pinStatusLabel,
  priorityLabel,
} from '../lib/i18n.ts';

interface CertificateViewProps {
  certificate: LaunchSignOff;
  board?: ReviewBoard | null;
  metrics?: BoardMetrics | null;
  locale: Locale;
  onBackToStudio?: () => void;
}

export function CertificateView({
  certificate,
  board,
  metrics,
  locale,
  onBackToStudio,
}: CertificateViewProps) {
  const copy = getCopy(locale);
  const [integrityValid, setIntegrityValid] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    if (!board || !board.signOff) {
      setIntegrityValid(null);
      return;
    }
    void verifySignOffIntegrity(board).then((res) => {
      if (active) setIntegrityValid(res.valid);
    });
    return () => {
      active = false;
    };
  }, [board]);

  const BackIcon = locale === 'ar' ? ArrowRight : ArrowLeft;
  const projectTitle = board
    ? locale === 'ar'
      ? board.titleAr || board.title
      : board.title
    : certificate.certificateNumber;

  const extraFees = metrics?.estimatedExtraFees ?? 0;
  const currency = board?.currency ?? 'USD';

  return (
    <div className="space-y-5" data-testid="certificate-view">
      {/* Action Bar (.no-print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          {onBackToStudio && (
            <button
              type="button"
              onClick={onBackToStudio}
              data-testid="cert-back-studio-btn"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            >
              <BackIcon className="h-4 w-4" />
              {copy.backToStudio}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          data-testid="print-cert-btn"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-coral)] px-4 py-2 text-sm font-bold text-[var(--accent-coral-fg)] hover:bg-[var(--accent-coral-hover)]"
        >
          <Printer className="h-4 w-4" />
          {copy.printPdfBtn}
        </button>
      </div>

      <article className="pin-card rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-emerald-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-emerald)]">
              <Award className="h-3.5 w-3.5" />
              {copy.certTitle}
            </span>
            <h1 className="pin-display text-2xl font-extrabold text-[var(--text-primary)]">
              {projectTitle}
            </h1>
            {board?.stagingUrl && (
              <p className="text-xs text-[var(--text-secondary)]">
                {copy.stagingUrlLabel}:{' '}
                <span dir="ltr" className="inline-block break-all">
                  {board.stagingUrl}
                </span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-sm">
            <div>
              <div className="text-xs text-[var(--text-secondary)]">{copy.certNumberLabel}</div>
              <div className="num-tabular font-bold text-[var(--text-primary)]" dir="ltr">
                {certificate.certificateNumber}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-secondary)]">{copy.approvedAtLabel}</div>
              <div className="num-tabular font-semibold text-[var(--text-primary)]">
                {formatShortDate(certificate.approvedAt, locale)}
              </div>
            </div>
          </div>
        </header>

        {/* Integrity Seal */}
        {integrityValid !== null && (
          <div
            className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs sm:text-sm font-bold ${
              integrityValid
                ? 'border-[var(--accent-emerald)]/35 bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]'
                : 'border-[var(--accent-coral)]/35 bg-[var(--bg-soft)] text-[var(--accent-coral)]'
            }`}
          >
            {integrityValid ? (
              <ShieldCheck className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{integrityValid ? copy.verifiedSealText : copy.tamperWarningText}</span>
          </div>
        )}

        {/* Parties & KPI Summary */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2 text-sm">
            <div>
              <span className="text-xs text-[var(--text-secondary)]">{copy.clientLabel}: </span>
              <span className="font-bold text-[var(--text-primary)]">{board?.clientName || certificate.signerName}</span>
            </div>
            <div>
              <span className="text-xs text-[var(--text-secondary)]">{copy.studioLabel}: </span>
              <span className="font-bold text-[var(--text-primary)]">{board?.studioName || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-[var(--text-secondary)]">{copy.signerBlockLabel}: </span>
              <span className="font-bold text-[var(--text-primary)]">
                {certificate.signerName}
                {certificate.signerTitle ? ` — ${certificate.signerTitle}` : ''}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-sm">
            <div>
              <div className="text-xs text-[var(--text-secondary)]">{copy.roundsSummaryLabel}</div>
              <div className="num-tabular text-base font-extrabold text-[var(--text-primary)]">
                <span dir="ltr" className="inline-block">
                  {certificate.totalRoundsUsed} / {board?.agreedRounds ?? certificate.totalRoundsUsed}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-secondary)]">{copy.resolvedPinsSummaryLabel}</div>
              <div className="num-tabular text-base font-extrabold text-[var(--accent-emerald)]">
                {certificate.resolvedPinsCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-secondary)]">{copy.outOfScopeSummaryLabel}</div>
              <div className="num-tabular text-base font-extrabold text-[var(--accent-amber)]">
                {certificate.outOfScopeCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-secondary)]">{copy.extraFeesSummaryLabel}</div>
              <div className="num-tabular text-base font-extrabold text-[var(--text-primary)]">
                {formatMoney(extraFees, currency, locale)}
              </div>
            </div>
          </div>
        </section>

        {/* Signed Proof & SHA-256 Digest */}
        <section className="print-avoid-break rounded-xl border border-[var(--accent-emerald)]/35 bg-[var(--accent-emerald-soft)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-bold text-[var(--accent-emerald)]">
              {copy.digestLabel}
            </div>
            <span className="text-xs font-medium text-[var(--text-secondary)]">{copy.poweredBy}</span>
          </div>

          {certificate.signatureType === 'drawn' && certificate.signatureDataUrl ? (
            <div className="inline-block rounded-lg border border-[var(--border-subtle)] bg-white p-2">
              <img
                src={certificate.signatureDataUrl}
                alt={certificate.signerName}
                className="h-14 w-auto object-contain"
              />
            </div>
          ) : (
            <div className="pin-display text-lg font-bold text-[var(--text-primary)]">
              {certificate.signerName}
            </div>
          )}

          <code
            className="block break-all rounded-lg bg-[var(--bg-surface)] px-3 py-2 font-mono text-xs text-[var(--text-primary)]"
            dir="ltr"
            data-testid="cert-scope-digest"
          >
            {certificate.scopeDigestHex}
          </code>
        </section>

        {/* Locked Pin Audit Log */}
        {board && board.pins.length > 0 && (
          <section className="space-y-3">
            <h2 className="pin-display text-base font-extrabold text-[var(--text-primary)]">
              {copy.auditTableTitle}
            </h2>

            {/* Mobile Stacked Cards (<sm, hidden on print) */}
            <div className="space-y-2.5 sm:hidden print:hidden">
              {board.pins.map((pin) => (
                <div
                  key={pin.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="num-tabular font-extrabold text-[var(--text-primary)]">
                        #{pin.pinNumber}
                      </span>
                      <span className="rounded bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                        {copy.colRound} {pin.roundNumber}
                      </span>
                      <span className="rounded bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                        {priorityLabel(pin.priority, locale)}
                      </span>
                    </div>
                    <span className="rounded-full bg-[var(--accent-emerald-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent-emerald)]">
                      {pinStatusLabel(pin.status, locale)}
                    </span>
                  </div>
                  <p className="leading-relaxed text-[var(--text-primary)]">{pin.comment}</p>
                  {typeof pin.outOfScopeQuote === 'number' && pin.outOfScopeQuote > 0 && (
                    <div className="num-tabular font-bold text-[var(--accent-amber)]">
                      {copy.colExtraFee}: {formatMoney(pin.outOfScopeQuote, currency, locale)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop & Print Audit Table */}
            <div className="hidden sm:block print:block overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full min-w-[540px] border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                    <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">{copy.colPinNum}</th>
                    <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">{copy.colRound}</th>
                    <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">{copy.colPriority}</th>
                    <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">{copy.colStatus}</th>
                    <th className="min-w-[220px] px-3 py-2.5 text-start font-bold">{copy.colComment}</th>
                    <th className="px-3 py-2.5 text-end font-bold whitespace-nowrap">{copy.colExtraFee}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {board.pins.map((pin) => (
                    <tr key={pin.id}>
                      <td className="num-tabular px-3 py-2.5 font-bold text-[var(--text-primary)]">
                        #{pin.pinNumber}
                      </td>
                      <td className="num-tabular px-3 py-2.5 text-center text-[var(--text-secondary)]">
                        {pin.roundNumber}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-[var(--text-secondary)]">
                        {priorityLabel(pin.priority, locale)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-[var(--text-primary)]">
                        {pinStatusLabel(pin.status, locale)}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-primary)]">{pin.comment}</td>
                      <td className="num-tabular px-3 py-2.5 text-end whitespace-nowrap font-semibold text-[var(--text-primary)]">
                        {typeof pin.outOfScopeQuote === 'number' && pin.outOfScopeQuote > 0
                          ? formatMoney(pin.outOfScopeQuote, currency, locale)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
