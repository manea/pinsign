import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  ImagePlus,
  Languages,
  Layers,
  MapPin,
  MessageSquare,
  Moon,
  Send,
  Sun,
  X,
} from 'lucide-react';
import { buildEmbedScriptTag, buildReviewShareMessage } from '../core/embedSnippet.ts';
import type { Locale, PinPriority, PinStatus } from '../core/types.ts';
import {
  ApiError,
  advanceRoundApi,
  approvePublicBoard,
  createPublicPin,
  createStudioPin,
  getBoard,
  getPublicBoard,
  patchPinStatus,
  replyToPublicPin,
  replyToStudioPin,
  uploadBoardScreen,
  type BoardBundle,
} from '../lib/api.ts';
import { getBasePath, withBase } from '../lib/basePath.ts';
import {
  formatMoney,
  getCopy,
  pinStatusLabel,
  priorityLabel,
} from '../lib/i18n.ts';
import { CertificateView } from './CertificateView.tsx';
import { SignaturePad } from './SignaturePad.tsx';

interface ReviewCanvasBoardProps {
  mode: 'studio' | 'client';
  boardIdOrSlug: string;
  locale: Locale;
  theme: 'slate' | 'midnight';
  onToggleLocale?: () => void;
  onToggleTheme?: () => void;
  onBackToStudio?: () => void;
  onBoardChanged?: () => void;
}

type PinFilter = 'all' | 'open' | 'resolved' | 'out_of_scope';

export function ReviewCanvasBoard({
  mode,
  boardIdOrSlug,
  locale,
  theme,
  onToggleLocale,
  onToggleTheme,
  onBackToStudio,
  onBoardChanged,
}: ReviewCanvasBoardProps) {
  const copy = getCopy(locale);
  const [bundle, setBundle] = useState<BoardBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [activeScreenId, setActiveScreenId] = useState<string>('');
  const [pinFilter, setPinFilter] = useState<PinFilter>('all');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  // Inline click-to-pin composer
  const [draftPoint, setDraftPoint] = useState<{ xPct: number; yPct: number } | null>(null);
  const [draftComment, setDraftComment] = useState('');
  const [draftAuthor, setDraftAuthor] = useState('');
  const [draftPriority, setDraftPriority] = useState<PinPriority>('normal');
  const [submittingPin, setSubmittingPin] = useState(false);

  // Pin reply & out-of-scope fee controls
  const [replyText, setReplyText] = useState('');
  const [oosPinId, setOosPinId] = useState<string | null>(null);
  const [oosQuoteInput, setOosQuoteInput] = useState('250');

  // Modals & action states
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [showSignOffPanel, setShowSignOffPanel] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const [busyAction, setBusyAction] = useState(false);

  // Sign-Off form
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn'>('typed');
  const [drawnSignature, setDrawnSignature] = useState('');
  const [confirmedReviewed, setConfirmedReviewed] = useState(false);
  const [signOffError, setSignOffError] = useState('');
  const [submittingSignOff, setSubmittingSignOff] = useState(false);

  const loadBundle = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res =
        mode === 'studio' ? await getBoard(boardIdOrSlug) : await getPublicBoard(boardIdOrSlug);
      setBundle(res);
      setActiveScreenId((prev) =>
        res.board.screens.some((s) => s.id === prev) ? prev : (res.board.screens[0]?.id ?? ''),
      );
      if (!draftAuthor) {
        setDraftAuthor(mode === 'client' ? res.board.clientName : res.board.studioName);
      }
      if (!signerName && mode === 'client') {
        setSignerName(res.board.clientName);
      }
    } catch (err) {
      setBundle(null);
      setErrorMsg(err instanceof Error ? err.message : copy.notFoundBody);
    } finally {
      setLoading(false);
    }
  }, [boardIdOrSlug, copy.notFoundBody, mode]);

  useEffect(() => {
    void loadBundle();
  }, [loadBundle]);

  const activeScreen = useMemo(() => {
    if (!bundle) return null;
    return (
      bundle.board.screens.find((s) => s.id === activeScreenId) ?? bundle.board.screens[0] ?? null
    );
  }, [bundle, activeScreenId]);

  const filteredPins = useMemo(() => {
    if (!bundle) return [];
    const onScreen = activeScreen
      ? bundle.board.pins.filter((p) => p.screenId === activeScreen.id)
      : bundle.board.pins;
    if (pinFilter === 'all') return onScreen;
    if (pinFilter === 'open') {
      return onScreen.filter((p) => p.status === 'open' || p.status === 'in_progress');
    }
    return onScreen.filter((p) => p.status === pinFilter);
  }, [bundle, activeScreen, pinFilter]);

  function resolveScreenSrc(src: string): string {
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }
    const base = getBasePath();
    if (base && src.startsWith(base)) return src;
    return withBase(src);
  }

  function flashCopied(key: string, text: string) {
    try {
      void navigator.clipboard.writeText(text);
    } catch {
      // ignore clipboard restriction in headless tests
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? '' : prev)), 2000);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!bundle || !activeScreen) return;
    if (bundle.board.status === 'approved_for_launch') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = Math.round(((e.clientX - rect.left) / Math.max(1, rect.width)) * 10000) / 100;
    const yPct = Math.round(((e.clientY - rect.top) / Math.max(1, rect.height)) * 10000) / 100;
    setDraftPoint({
      xPct: Math.min(100, Math.max(0, xPct)),
      yPct: Math.min(100, Math.max(0, yPct)),
    });
    setSelectedPinId(null);
  }

  async function handleSubmitPin(e: React.FormEvent) {
    e.preventDefault();
    if (!bundle || !activeScreen || !draftPoint || submittingPin) return;
    if (!draftComment.trim()) return;
    setSubmittingPin(true);
    setErrorMsg('');
    try {
      const payload = {
        screenId: activeScreen.id,
        xPct: draftPoint.xPct,
        yPct: draftPoint.yPct,
        comment: draftComment.trim(),
        authorName:
          draftAuthor.trim() || (mode === 'client' ? bundle.board.clientName : bundle.board.studioName),
        priority: draftPriority,
      };
      const updated =
        mode === 'studio'
          ? await createStudioPin(bundle.board.id, payload)
          : await createPublicPin(bundle.board.slug, payload);
      setBundle(updated);
      setDraftPoint(null);
      setDraftComment('');
      onBoardChanged?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save pin');
    } finally {
      setSubmittingPin(false);
    }
  }

  async function handlePinStatus(pinId: string, nextStatus: PinStatus, quote?: number) {
    if (!bundle || busyAction) return;
    setBusyAction(true);
    setErrorMsg('');
    try {
      const updated = await patchPinStatus(bundle.board.id, pinId, nextStatus, quote);
      setBundle(updated);
      setOosPinId(null);
      onBoardChanged?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update pin status');
    } finally {
      setBusyAction(false);
    }
  }

  async function handleSendReply(pinId: string) {
    if (!bundle || !replyText.trim() || busyAction) return;
    setBusyAction(true);
    setErrorMsg('');
    try {
      const author = mode === 'client' ? bundle.board.clientName : bundle.board.studioName;
      const updated =
        mode === 'studio'
          ? await replyToStudioPin(bundle.board.id, pinId, author, replyText.trim())
          : await replyToPublicPin(bundle.board.slug, pinId, author, replyText.trim());
      setBundle(updated);
      setReplyText('');
      onBoardChanged?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add reply');
    } finally {
      setBusyAction(false);
    }
  }

  async function handleAdvanceRound() {
    if (!bundle || busyAction) return;
    setBusyAction(true);
    setErrorMsg('');
    try {
      const updated = await advanceRoundApi(bundle.board.id, bundle.board.clientName);
      setBundle(updated);
      onBoardChanged?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to advance round');
    } finally {
      setBusyAction(false);
    }
  }

  async function handleScreenFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !bundle || busyAction) return;
    setBusyAction(true);
    setErrorMsg('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      const updated = await uploadBoardScreen(bundle.board.id, {
        title: file.name.replace(/\.[^.]+$/, '') || 'Uploaded Screen',
        imageDataUrl: dataUrl,
      });
      setBundle(updated);
      const latest = updated.board.screens[updated.board.screens.length - 1];
      if (latest) setActiveScreenId(latest.id);
      onBoardChanged?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload screen');
    } finally {
      setBusyAction(false);
    }
  }

  async function handleSignOffSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bundle || submittingSignOff) return;
    setSignOffError('');
    if (signerName.trim().length < 2) {
      setSignOffError(
        locale === 'ar'
          ? 'يرجى إدخال الاسم الكامل للمفوّض بالاعتماد.'
          : 'Please enter the authorized signer full name.',
      );
      return;
    }
    if (signatureType === 'drawn' && !drawnSignature.startsWith('data:image/png;base64,')) {
      setSignOffError(
        locale === 'ar'
          ? 'يرجى رسم التوقيع داخل اللوح أو اختيار التوقيع المكتوب.'
          : 'Please draw a signature or switch to typed mode.',
      );
      return;
    }
    if (!confirmedReviewed) {
      setSignOffError(
        locale === 'ar'
          ? 'يجب تأكيد مراجعة جميع الملاحظات والموافقة على الإطلاق.'
          : 'Please check the final confirmation box before signing off.',
      );
      return;
    }

    setSubmittingSignOff(true);
    try {
      const approved = await approvePublicBoard(bundle.board.slug, {
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim() || undefined,
        signerEmail: signerEmail.trim() || undefined,
        signatureType,
        signatureDataUrl: signatureType === 'drawn' ? drawnSignature : undefined,
        confirmedAllPinsReviewed: true,
      });
      setBundle(approved);
      setShowSignOffPanel(false);
      onBoardChanged?.();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Sign-off failed';
      setSignOffError(msg);
    } finally {
      setSubmittingSignOff(false);
    }
  }

  const BackIcon = locale === 'ar' ? ArrowRight : ArrowLeft;

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-[var(--text-secondary)]">
        {copy.loadingLabel}
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="pin-card mx-auto max-w-xl rounded-2xl p-8 text-center space-y-4">
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--accent-amber)]" />
        <h1 className="pin-display text-xl font-bold text-[var(--text-primary)]">{copy.notFoundTitle}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{errorMsg || copy.notFoundBody}</p>
        {onBackToStudio && (
          <button
            type="button"
            onClick={onBackToStudio}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-coral)] px-4 py-2 text-sm font-bold text-[var(--accent-coral-fg)]"
          >
            <BackIcon className="h-4 w-4" />
            {copy.backToStudio}
          </button>
        )}
      </div>
    );
  }

  const { board, metrics } = bundle;
  const projectTitle = locale === 'ar' ? board.titleAr || board.title : board.title;
  const reviewUrl =
    bundle.reviewUrl || `${window.location.origin}${withBase(`/r/${encodeURIComponent(board.slug)}`)}`;
  const embedOrigin = `${window.location.origin}${getBasePath()}`;
  const snippetCode = buildEmbedScriptTag(embedOrigin, board.slug, { locale });
  const shareMessage = buildReviewShareMessage(board, reviewUrl, locale);

  if (board.status === 'approved_for_launch' && board.signOff) {
    return (
      <div className="space-y-5">
        {mode === 'client' && (
          <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--accent-emerald)]/35 bg-[var(--accent-emerald-soft)] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--accent-emerald)]">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>{copy.approvedLockedBanner}</span>
            </div>
            <div className="flex items-center gap-2">
              {onToggleLocale && (
                <button
                  type="button"
                  onClick={onToggleLocale}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
                >
                  <Languages className="h-3.5 w-3.5" />
                  {copy.langSwitch}
                </button>
              )}
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
                >
                  {theme === 'slate' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          </div>
        )}
        <CertificateView
          certificate={board.signOff}
          board={board}
          metrics={metrics}
          locale={locale}
          onBackToStudio={onBackToStudio}
        />
      </div>
    );
  }

  const pinBadgeColor = (pinStatus: PinStatus) => {
    if (pinStatus === 'resolved') return 'bg-[var(--accent-emerald)] text-white';
    if (pinStatus === 'out_of_scope') return 'bg-[var(--accent-amber)] text-white';
    if (pinStatus === 'in_progress') return 'bg-[var(--accent-cobalt)] text-white';
    return 'bg-[var(--accent-coral)] text-white';
  };

  return (
    <div className="space-y-5" data-testid="review-canvas-board">
      {/* Top Action & Revision Cap Banner */}
      <section className="pin-card rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {onBackToStudio && (
              <button
                type="button"
                onClick={onBackToStudio}
                data-testid="board-back-studio-btn"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              >
                <BackIcon className="h-3.5 w-3.5" />
                {copy.backToStudio}
              </button>
            )}
            <h1 className="pin-display text-lg sm:text-xl font-extrabold text-[var(--text-primary)]">
              {projectTitle}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {mode === 'client' && onToggleLocale && (
              <button
                type="button"
                onClick={onToggleLocale}
                data-testid="portal-locale-toggle"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
              >
                <Languages className="h-3.5 w-3.5" />
                {copy.langSwitch}
              </button>
            )}
            {mode === 'client' && onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
              >
                {theme === 'slate' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSignOffPanel((v) => !v)}
              data-testid="open-signoff-btn"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-emerald)] px-4 py-2 text-xs font-bold text-white hover:opacity-95"
            >
              <Award className="h-4 w-4" />
              {copy.approveForLaunchBtn}
            </button>
          </div>
        </div>

        {/* Revision Rounds Bar & Studio Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span
              className={`num-tabular inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold ${
                metrics.isOverRoundLimit
                  ? 'bg-[var(--accent-amber-soft)] text-[var(--accent-amber)]'
                  : 'bg-[var(--accent-cobalt-soft)] text-[var(--accent-cobalt)]'
              }`}
              data-testid="round-counter-badge"
            >
              <Layers className="h-3.5 w-3.5" />
              {copy.roundCounter}{' '}
              <span dir="ltr" className="inline-block">
                {metrics.roundsUsed} / {metrics.agreedRounds}
              </span>
            </span>
            <span className="num-tabular text-[var(--text-secondary)]">
              ({metrics.roundsRemaining} {copy.roundsRemainingLabel})
            </span>
            {metrics.estimatedExtraFees > 0 && (
              <span className="num-tabular rounded-full bg-[var(--accent-amber-soft)] px-3 py-1 font-bold text-[var(--accent-amber)]">
                {copy.extraFeesLabel}: {formatMoney(metrics.estimatedExtraFees, board.currency, locale)}
              </span>
            )}
          </div>

          {mode === 'studio' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busyAction}
                onClick={() => void handleAdvanceRound()}
                data-testid="advance-round-btn"
                className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] disabled:opacity-60"
              >
                {copy.advanceRoundBtn}
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]">
                <ImagePlus className="h-3.5 w-3.5 text-[var(--accent-cobalt)]" />
                {copy.uploadScreenBtn}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busyAction}
                  className="hidden"
                  onChange={(e) => void handleScreenFileChange(e)}
                  data-testid="upload-screen-input"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowEmbedModal(true)}
                data-testid="open-embed-modal-btn"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]"
              >
                <Code2 className="h-3.5 w-3.5 text-[var(--accent-coral)]" />
                {copy.embedBtn}
              </button>
              <button
                type="button"
                onClick={() => flashCopied('client-link', reviewUrl)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-coral)] px-3 py-1.5 text-xs font-bold text-[var(--accent-coral-fg)]"
              >
                {copiedKey === 'client-link' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedKey === 'client-link' ? copy.copiedLabel : copy.copyClientLinkBtn}
              </button>
            </div>
          )}
        </div>

        {metrics.isOverRoundLimit && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--accent-amber)]/35 bg-[var(--accent-amber-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-amber)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{copy.overCapWarning}</span>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--accent-coral)]/35 bg-[var(--bg-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-coral)]"
          >
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg('')} className="underline">
              ×
            </button>
          </div>
        )}
      </section>

      {/* Launch Sign-Off Drawer/Panel */}
      {showSignOffPanel && (
        <section
          className="pin-card rounded-2xl border-2 border-[var(--accent-emerald)]/40 p-5 sm:p-6 space-y-4"
          data-testid="signoff-panel"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="pin-display flex items-center gap-2 text-lg font-extrabold text-[var(--text-primary)]">
              <Award className="h-5 w-5 text-[var(--accent-emerald)]" />
              {copy.signoffTitle}
            </h2>
            <button
              type="button"
              onClick={() => setShowSignOffPanel(false)}
              className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {metrics.unresolvedBlockerPins > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-[var(--accent-amber)]/40 bg-[var(--accent-amber-soft)] px-4 py-3 text-xs sm:text-sm font-semibold text-[var(--accent-amber)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {copy.signoffBlockerWarning} ({metrics.unresolvedBlockerPins})
              </span>
            </div>
          )}

          <form onSubmit={(e) => void handleSignOffSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  {copy.signerNameLabel}
                </label>
                <input
                  type="text"
                  required
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  data-testid="signoff-name-input"
                  className="pin-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  {copy.signerTitleLabel}
                </label>
                <input
                  type="text"
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  className="pin-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                  {copy.signerEmailLabel}
                </label>
                <input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  className="pin-input"
                  dir="ltr"
                />
              </div>
            </div>

            <SignaturePad
              mode={signatureType}
              signerName={signerName}
              drawnDataUrl={drawnSignature}
              locale={locale}
              onModeChange={setSignatureType}
              onDrawnChange={setDrawnSignature}
            />

            <label className="flex cursor-pointer items-start gap-2.5 text-xs sm:text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={confirmedReviewed}
                onChange={(e) => setConfirmedReviewed(e.target.checked)}
                data-testid="signoff-confirm-checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--accent-emerald)]"
              />
              <span>{copy.confirmAllPinsLabel}</span>
            </label>

            {signOffError && (
              <p className="text-xs font-bold text-[var(--accent-coral)]">{signOffError}</p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingSignOff || metrics.unresolvedBlockerPins > 0}
                data-testid="submit-signoff-btn"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-emerald)] px-5 py-2.5 text-sm font-bold text-white hover:opacity-95 disabled:opacity-50"
              >
                <Award className="h-4 w-4" />
                {submittingSignOff ? copy.submittingSignoffBtn : copy.submitSignoffBtn}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Main Split Workspace: Interactive Canvas + Feedback Pins Sidebar */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="lg:col-span-8 space-y-3 min-w-0">
          {/* Screen Switcher Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {board.screens.map((scr) => {
              const active = scr.id === activeScreen?.id;
              return (
                <button
                  key={scr.id}
                  type="button"
                  onClick={() => {
                    setActiveScreenId(scr.id);
                    setDraftPoint(null);
                  }}
                  data-testid={`screen-tab-${scr.id}`}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    active
                      ? 'bg-[var(--accent-coral)] text-[var(--accent-coral-fg)]'
                      : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {locale === 'ar' ? scr.titleAr || scr.title : scr.title}
                </button>
              );
            })}
          </div>

          <p className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <MapPin className="h-3.5 w-3.5 text-[var(--accent-coral)] shrink-0" />
            <span>{copy.clickCanvasHint}</span>
          </p>

          {/* Click-to-Pin Screen Canvas */}
          {activeScreen && (
            <div className="pin-card overflow-hidden rounded-2xl p-2">
              <div
                onClick={handleCanvasClick}
                data-testid="pin-canvas"
                className="relative w-full cursor-crosshair select-none overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white"
              >
                <img
                  src={resolveScreenSrc(activeScreen.imageDataUrl)}
                  alt={activeScreen.title}
                  className="block h-auto w-full object-contain"
                />

                {filteredPins.map((pin) => {
                  const selected = selectedPinId === pin.id;
                  return (
                    <button
                      key={pin.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedPinId(pin.id);
                        setDraftPoint(null);
                      }}
                      data-testid={`canvas-pin-${pin.pinNumber}`}
                      style={{ left: `${pin.xPct}%`, top: `${pin.yPct}%` }}
                      className={`num-tabular absolute -translate-x-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-extrabold shadow-md transition ${pinBadgeColor(
                        pin.status,
                      )} ${selected ? 'scale-125 ring-4 ring-[var(--accent-coral)]/30' : ''}`}
                      title={pin.comment}
                    >
                      {pin.pinNumber}
                    </button>
                  );
                })}

                {draftPoint && (
                  <span
                    style={{ left: `${draftPoint.xPct}%`, top: `${draftPoint.yPct}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 h-7 w-7 animate-pulse rounded-full border-2 border-white bg-[var(--accent-coral)] shadow-md"
                  />
                )}
              </div>
            </div>
          )}

          {/* Inline New Pin Form */}
          {draftPoint && (
            <form
              onSubmit={(e) => void handleSubmitPin(e)}
              className="pin-card rounded-2xl border-2 border-[var(--accent-coral)]/45 p-4 space-y-3"
              data-testid="new-pin-form"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  {copy.newPinTitle} ({draftPoint.xPct}%, {draftPoint.yPct}%)
                </span>
                <button
                  type="button"
                  onClick={() => setDraftPoint(null)}
                  className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {copy.cancelBtn}
                </button>
              </div>
              <textarea
                rows={2}
                required
                placeholder={copy.pinCommentPlaceholder}
                value={draftComment}
                onChange={(e) => setDraftComment(e.target.value)}
                data-testid="new-pin-comment"
                className="pin-input"
              />
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder={copy.authorNamePlaceholder}
                  value={draftAuthor}
                  onChange={(e) => setDraftAuthor(e.target.value)}
                  data-testid="new-pin-author"
                  className="pin-input"
                />
                <select
                  value={draftPriority}
                  onChange={(e) => setDraftPriority(e.target.value as PinPriority)}
                  data-testid="new-pin-priority"
                  className="pin-input"
                >
                  <option value="blocker">{priorityLabel('blocker', locale)}</option>
                  <option value="normal">{priorityLabel('normal', locale)}</option>
                  <option value="polish">{priorityLabel('polish', locale)}</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={submittingPin}
                  data-testid="submit-pin-btn"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-coral)] px-4 py-2 text-xs font-bold text-[var(--accent-coral-fg)] disabled:opacity-60"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {copy.dropPinBtn}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Feedback Sidebar */}
        <aside className="lg:col-span-4 space-y-3 min-w-0" data-testid="pins-sidebar">
          <div className="pin-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="pin-display text-sm font-extrabold text-[var(--text-primary)]">
                {copy.pinsSidebarTitle}
              </h2>
              <span className="num-tabular rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 text-xs font-bold text-[var(--text-secondary)]">
                {filteredPins.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { key: 'all', label: copy.filterPinAll },
                  { key: 'open', label: copy.filterPinOpen },
                  { key: 'resolved', label: copy.filterPinResolved },
                  { key: 'out_of_scope', label: copy.filterPinOutOfScope },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setPinFilter(pill.key)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    pinFilter === pill.key
                      ? 'bg-[var(--accent-coral)] text-[var(--accent-coral-fg)]'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {filteredPins.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--text-secondary)]">
                {copy.noPinsMatch}
              </p>
            ) : (
              <div className="space-y-2.5">
                {filteredPins.map((pin) => {
                  const expanded = selectedPinId === pin.id;
                  return (
                    <div
                      key={pin.id}
                      onClick={() => setSelectedPinId(pin.id)}
                      className={`cursor-pointer rounded-xl border p-3 space-y-2 transition ${
                        expanded
                          ? 'border-[var(--accent-coral)] bg-[var(--bg-elevated)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`num-tabular inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold ${pinBadgeColor(
                              pin.status,
                            )}`}
                          >
                            {pin.pinNumber}
                          </span>
                          <span className="text-xs font-bold text-[var(--text-primary)]">
                            {pin.authorName}
                          </span>
                        </div>
                        <span className="rounded bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                          {priorityLabel(pin.priority, locale)} · {pinStatusLabel(pin.status, locale)}
                        </span>
                      </div>

                      <p className="text-xs leading-relaxed text-[var(--text-primary)]">{pin.comment}</p>

                      {typeof pin.outOfScopeQuote === 'number' && pin.outOfScopeQuote > 0 && (
                        <div className="num-tabular text-[11px] font-bold text-[var(--accent-amber)]">
                          {copy.extraFeesLabel}: {formatMoney(pin.outOfScopeQuote, board.currency, locale)}
                        </div>
                      )}

                      {pin.replies.length > 0 && (
                        <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-2">
                          {pin.replies.map((rep) => (
                            <div key={rep.id} className="text-[11px] text-[var(--text-secondary)]">
                              <strong className="text-[var(--text-primary)]">{rep.authorName}: </strong>
                              <span>{rep.body}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {mode === 'studio' && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {pin.status !== 'resolved' ? (
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                void handlePinStatus(pin.id, 'resolved');
                              }}
                              data-testid={`resolve-pin-${pin.pinNumber}`}
                              className="rounded-lg bg-[var(--accent-emerald-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent-emerald)]"
                            >
                              {copy.resolvePinBtn}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                void handlePinStatus(pin.id, 'open');
                              }}
                              className="rounded-lg bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]"
                            >
                              {copy.reopenPinBtn}
                            </button>
                          )}

                          {pin.status === 'open' && (
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                void handlePinStatus(pin.id, 'in_progress');
                              }}
                              className="rounded-lg bg-[var(--accent-cobalt-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent-cobalt)]"
                            >
                              {copy.markInProgressBtn}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setOosPinId((prev) => (prev === pin.id ? null : pin.id));
                            }}
                            data-testid={`oos-pin-${pin.pinNumber}`}
                            className="rounded-lg bg-[var(--accent-amber-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent-amber)]"
                          >
                            {copy.markOutOfScopeBtn}
                          </button>
                        </div>
                      )}

                      {oosPinId === pin.id && (
                        <div
                          onClick={(ev) => ev.stopPropagation()}
                          className="flex items-center gap-2 pt-1"
                        >
                          <input
                            type="number"
                            min={0}
                            step="10"
                            value={oosQuoteInput}
                            onChange={(e) => setOosQuoteInput(e.target.value)}
                            placeholder={copy.extraQuotePlaceholder}
                            data-testid={`oos-quote-${pin.pinNumber}`}
                            className="pin-input text-xs py-1"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              void handlePinStatus(pin.id, 'out_of_scope', Number(oosQuoteInput) || 0)
                            }
                            data-testid={`save-oos-${pin.pinNumber}`}
                            className="shrink-0 rounded-lg bg-[var(--accent-amber)] px-2.5 py-1.5 text-[11px] font-bold text-white"
                          >
                            {copy.saveOutOfScopeBtn}
                          </button>
                        </div>
                      )}

                      {expanded && (
                        <div
                          onClick={(ev) => ev.stopPropagation()}
                          className="flex items-center gap-1.5 border-t border-[var(--border-subtle)] pt-2"
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={copy.replyPlaceholder}
                            data-testid="pin-reply-input"
                            className="pin-input text-xs py-1"
                          />
                          <button
                            type="button"
                            disabled={busyAction || !replyText.trim()}
                            onClick={() => void handleSendReply(pin.id)}
                            data-testid="pin-reply-submit"
                            className="shrink-0 rounded-lg bg-[var(--accent-cobalt)] p-1.5 text-white disabled:opacity-50"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Embed Snippet & Share Modal */}
      {showEmbedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          data-testid="embed-modal"
        >
          <div className="pin-card w-full max-w-xl rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="pin-display text-lg font-extrabold text-[var(--text-primary)]">
                {copy.embedModalTitle}
              </h2>
              <button
                type="button"
                onClick={() => setShowEmbedModal(false)}
                className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{copy.embedModalSub}</p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)]">
                <span>{copy.snippetLabel}</span>
                <button
                  type="button"
                  onClick={() => flashCopied('snippet', snippetCode)}
                  className="inline-flex items-center gap-1 text-[var(--accent-coral)] hover:underline"
                >
                  {copiedKey === 'snippet' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedKey === 'snippet' ? copy.copiedLabel : copy.copySnippetBtn}
                </button>
              </div>
              <pre
                className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 font-mono text-xs text-[var(--text-primary)]"
                dir="ltr"
              >
                {snippetCode}
              </pre>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)]">
                <span>{copy.inviteMessageLabel}</span>
                <button
                  type="button"
                  onClick={() => flashCopied('invite', shareMessage)}
                  className="inline-flex items-center gap-1 text-[var(--accent-cobalt)] hover:underline"
                >
                  {copiedKey === 'invite' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedKey === 'invite' ? copy.copiedLabel : copy.copyInviteBtn}
                </button>
              </div>
              <textarea
                readOnly
                rows={4}
                value={shareMessage}
                className="pin-input text-xs"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowEmbedModal(false)}
                className="rounded-xl border border-[var(--border-strong)] px-4 py-2 text-xs font-bold text-[var(--text-primary)]"
              >
                {copy.closeBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
