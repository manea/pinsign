import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Languages,
  Layers,
  MapPin,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react';
import { CertificateView } from './components/CertificateView.tsx';
import { ReviewCanvasBoard } from './components/ReviewCanvasBoard.tsx';
import type { BoardMetrics, LaunchSignOff, Locale, ReviewBoard } from './core/types.ts';
import {
  ApiError,
  createBoardFromPresetApi,
  deleteBoardApi,
  duplicateBoardApi,
  fetchPresets,
  getCertificate,
  listBoards,
  listCertificates,
  type BoardStats,
  type BoardSummary,
  type CertificateRecord,
  type PresetMeta,
} from './lib/api.ts';
import { stripBase, withBase } from './lib/basePath.ts';
import {
  boardStatusLabel,
  formatShortDate,
  getCopy,
} from './lib/i18n.ts';

type ThemeMode = 'slate' | 'midnight';
type StudioTab = 'studio' | 'certificates';
type BoardFilter = 'all' | 'review_open' | 'approved_for_launch';

type AppRoute =
  | { kind: 'studio' }
  | { kind: 'client'; slug: string }
  | { kind: 'certificate'; certificateNumber: string };

function parseRoute(pathname: string): AppRoute {
  const clean = stripBase(pathname).replace(/\/+$/, '') || '/';
  const clientMatch = /^\/r\/([^/]+)$/.exec(clean);
  if (clientMatch?.[1]) {
    try {
      return { kind: 'client', slug: decodeURIComponent(clientMatch[1]) };
    } catch {
      return { kind: 'client', slug: clientMatch[1] };
    }
  }
  const certMatch = /^\/cert\/([^/]+)$/.exec(clean);
  if (certMatch?.[1]) {
    try {
      return { kind: 'certificate', certificateNumber: decodeURIComponent(certMatch[1]) };
    } catch {
      return { kind: 'certificate', certificateNumber: certMatch[1] };
    }
  }
  return { kind: 'studio' };
}

function readInitialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem('pinsign_locale');
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // ignore storage errors
  }
  return 'en';
}

function readInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem('pinsign_theme');
    if (saved === 'midnight' || saved === 'slate') return saved;
  } catch {
    // ignore storage errors
  }
  return 'slate';
}

interface CertificateRoutePageProps {
  certificateNumber: string;
  locale: Locale;
  theme: ThemeMode;
  onToggleLocale: () => void;
  onToggleTheme: () => void;
  onBackToStudio: () => void;
}

function CertificateRoutePage({
  certificateNumber,
  locale,
  theme,
  onToggleLocale,
  onToggleTheme,
  onBackToStudio,
}: CertificateRoutePageProps) {
  const copy = getCopy(locale);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [certData, setCertData] = useState<{
    certificate: LaunchSignOff;
    board: ReviewBoard | null;
    metrics: BoardMetrics | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg('');
    void (async () => {
      try {
        const res = await getCertificate(certificateNumber);
        if (!active) return;
        setCertData(res);
      } catch (err) {
        if (!active) return;
        setCertData(null);
        setErrorMsg(err instanceof Error ? err.message : copy.notFoundBody);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [certificateNumber, copy.notFoundBody]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-coral)] text-white shadow-xs">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <div className="pin-display text-sm font-extrabold text-[var(--text-primary)]">
              {copy.brandName}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">{copy.certTitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLocale}
            data-testid="toggle-locale-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            <Languages className="h-3.5 w-3.5" />
            {copy.langSwitch}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            data-testid="toggle-theme-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            {theme === 'slate' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            {theme === 'slate' ? copy.themeMidnight : copy.themeSlate}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[var(--text-secondary)]">
          {copy.loadingLabel}
        </div>
      ) : !certData ? (
        <div className="pin-card mx-auto max-w-xl rounded-2xl p-8 text-center space-y-4">
          <AlertCircle className="mx-auto h-10 w-10 text-[var(--accent-amber)]" />
          <h1 className="pin-display text-xl font-bold text-[var(--text-primary)]">
            {copy.notFoundTitle}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{errorMsg || copy.notFoundBody}</p>
          <button
            type="button"
            onClick={onBackToStudio}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-coral)] px-4 py-2 text-sm font-bold text-[var(--accent-coral-fg)]"
          >
            {copy.backToStudio}
          </button>
        </div>
      ) : (
        <CertificateView
          certificate={certData.certificate}
          board={certData.board}
          metrics={certData.metrics}
          locale={locale}
          onBackToStudio={onBackToStudio}
        />
      )}
    </div>
  );
}

export function App() {
  const [locale, setLocale] = useState<Locale>(readInitialLocale);
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);
  const [route, setRoute] = useState<AppRoute>(() => parseRoute(window.location.pathname));

  const [activeTab, setActiveTab] = useState<StudioTab>('studio');
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [boardFilter, setBoardFilter] = useState<BoardFilter>('all');

  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [stats, setStats] = useState<BoardStats | null>(null);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loadingStudio, setLoadingStudio] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState('');

  const copy = getCopy(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    try {
      window.localStorage.setItem('pinsign_locale', locale);
    } catch {
      // ignore
    }
  }, [locale]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'midnight' ? '#090D16' : '#F7F8FA');
    }
    try {
      window.localStorage.setItem('pinsign_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    const onPopState = () => {
      const next = parseRoute(window.location.pathname);
      setRoute(next);
      if (next.kind === 'studio') {
        setActiveBoardId(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    const fullPath = withBase(to);
    if (window.location.pathname !== fullPath) {
      window.history.pushState({}, '', fullPath);
    }
    const next = parseRoute(fullPath);
    setRoute(next);
    if (next.kind === 'studio') {
      setActiveBoardId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const refreshStudioData = useCallback(async () => {
    setLoadingStudio(true);
    try {
      const [presetList, boardList, certList] = await Promise.all([
        fetchPresets(),
        listBoards(),
        listCertificates(),
      ]);
      setPresets(presetList);
      setBoards(boardList.boards);
      setStats(boardList.stats);
      setCertificates(certList);
      setErrorBanner('');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to load workspace');
    } finally {
      setLoadingStudio(false);
    }
  }, []);

  useEffect(() => {
    if (route.kind === 'studio') {
      void refreshStudioData();
    }
  }, [route.kind, refreshStudioData]);

  const toggleLocale = useCallback(() => {
    setLocale((prev) => (prev === 'en' ? 'ar' : 'en'));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'slate' ? 'midnight' : 'slate'));
  }, []);

  async function handleCreatePreset(presetId: PresetMeta['id']) {
    if (busyKey) return;
    setBusyKey(`pre:${presetId}`);
    setErrorBanner('');
    try {
      const created = await createBoardFromPresetApi(presetId);
      await refreshStudioData();
      setActiveTab('studio');
      setActiveBoardId(created.board.id);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to create board');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDuplicateBoard(id: string) {
    if (busyKey) return;
    setBusyKey(`dup:${id}`);
    setErrorBanner('');
    try {
      const cloned = await duplicateBoardApi(id);
      await refreshStudioData();
      setActiveTab('studio');
      setActiveBoardId(cloned.board.id);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to duplicate board');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteBoard(id: string) {
    if (busyKey) return;
    setBusyKey(`del:${id}`);
    setErrorBanner('');
    try {
      await deleteBoardApi(id);
      await refreshStudioData();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to delete board';
      setErrorBanner(msg);
    } finally {
      setBusyKey(null);
    }
  }

  const filteredBoards = useMemo(() => {
    if (boardFilter === 'all') return boards;
    if (boardFilter === 'approved_for_launch') {
      return boards.filter((b) => b.status === 'approved_for_launch');
    }
    return boards.filter((b) => b.status !== 'approved_for_launch');
  }, [boards, boardFilter]);

  const openPinsTotal = useMemo(() => {
    return boards.reduce(
      (sum, item) => sum + item.metrics.openPins + item.metrics.inProgressPins,
      0,
    );
  }, [boards]);

  if (route.kind === 'client') {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <ReviewCanvasBoard
            mode="client"
            boardIdOrSlug={route.slug}
            locale={locale}
            theme={theme}
            onToggleLocale={toggleLocale}
            onToggleTheme={toggleTheme}
            onBackToStudio={() => navigate('/')}
          />
        </main>
      </div>
    );
  }

  if (route.kind === 'certificate') {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <CertificateRoutePage
          certificateNumber={route.certificateNumber}
          locale={locale}
          theme={theme}
          onToggleLocale={toggleLocale}
          onToggleTheme={toggleTheme}
          onBackToStudio={() => navigate('/')}
        />
      </div>
    );
  }

  const boardStatusPill = (status: ReviewBoard['status']) => {
    if (status === 'approved_for_launch') {
      return 'bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)]';
    }
    if (status === 'round_submitted') {
      return 'bg-[var(--accent-cobalt-soft)] text-[var(--accent-cobalt)]';
    }
    return 'bg-[var(--bg-soft)] text-[var(--accent-coral)]';
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Studio Header */}
      <header className="no-print sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={() => {
              setActiveBoardId(null);
              setActiveTab('studio');
            }}
            className="flex items-center gap-2.5 text-start"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-coral)] text-white shadow-sm">
              <MapPin className="h-5 w-5" />
            </span>
            <span>
              <span className="pin-display block text-base font-extrabold leading-tight text-[var(--text-primary)]">
                {copy.brandName}
              </span>
              <span className="block text-xs text-[var(--text-secondary)]">
                {copy.brandTagline}
              </span>
            </span>
          </button>

          <nav className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
            <button
              type="button"
              onClick={() => {
                setActiveBoardId(null);
                setActiveTab('studio');
              }}
              data-testid="nav-studio-btn"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'studio' && !activeBoardId
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-coral)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              {copy.navStudio}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveBoardId(null);
                setActiveTab('certificates');
              }}
              data-testid="nav-certs-btn"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'certificates' && !activeBoardId
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-coral)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              {copy.navCertificates}
              <span className="num-tabular rounded-full bg-[var(--bg-soft)] px-1.5 py-0.5 text-[10px] text-[var(--accent-coral)]">
                {certificates.length}
              </span>
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busyKey !== null}
              onClick={() => void handleCreatePreset('saas-landing')}
              data-testid="quick-create-btn"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-coral)] px-3.5 py-2 text-xs font-bold text-[var(--accent-coral-fg)] hover:bg-[var(--accent-coral-hover)] disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              {copy.quickCreateBtn}
            </button>
            <button
              type="button"
              onClick={toggleLocale}
              data-testid="toggle-locale-btn"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            >
              <Languages className="h-3.5 w-3.5" />
              {copy.langSwitch}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              data-testid="toggle-theme-btn"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            >
              {theme === 'slate' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              {theme === 'slate' ? copy.themeMidnight : copy.themeSlate}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
        {errorBanner && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--accent-coral)]/35 bg-[var(--bg-soft)] px-4 py-3 text-sm text-[var(--accent-coral)]"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorBanner}
            </span>
            <button
              type="button"
              onClick={() => setErrorBanner('')}
              className="text-xs font-bold underline"
            >
              ×
            </button>
          </div>
        )}

        {activeBoardId ? (
          <ReviewCanvasBoard
            mode="studio"
            boardIdOrSlug={activeBoardId}
            locale={locale}
            theme={theme}
            onBackToStudio={() => {
              setActiveBoardId(null);
              void refreshStudioData();
            }}
            onBoardChanged={() => {
              void refreshStudioData();
            }}
          />
        ) : activeTab === 'certificates' ? (
          <section className="space-y-4" data-testid="certificates-ledger">
            <h1 className="pin-display text-2xl font-extrabold text-[var(--text-primary)]">
              {copy.navCertificates}
            </h1>

            {loadingStudio ? (
              <div className="py-12 text-center text-sm text-[var(--text-secondary)]">
                {copy.loadingLabel}
              </div>
            ) : certificates.length === 0 ? (
              <div className="pin-card rounded-2xl p-10 text-center text-sm text-[var(--text-secondary)]">
                {copy.noBoards}
              </div>
            ) : (
              <div className="pin-card overflow-x-auto rounded-2xl">
                <table className="w-full min-w-[600px] text-start text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs text-[var(--text-secondary)]">
                      <th className="px-4 py-3 text-start font-bold">{copy.certNumberLabel}</th>
                      <th className="px-4 py-3 text-start font-bold">{copy.boardsTitle}</th>
                      <th className="px-4 py-3 text-start font-bold">{copy.clientLabel}</th>
                      <th className="px-4 py-3 text-start font-bold">{copy.approvedAtLabel}</th>
                      <th className="px-4 py-3 text-start font-bold">SHA-256</th>
                      <th className="px-4 py-3 text-end font-bold" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {certificates.map((rec) => {
                      const title =
                        locale === 'ar'
                          ? rec.boardTitleAr || rec.boardTitle
                          : rec.boardTitle;
                      return (
                        <tr key={rec.certificate.certificateNumber} className="hover:bg-[var(--bg-elevated)]/60">
                          <td className="num-tabular px-4 py-3.5 font-bold text-[var(--text-primary)]">
                            {rec.certificate.certificateNumber}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-[var(--text-primary)]">
                            {title}
                          </td>
                          <td className="px-4 py-3.5 text-[var(--text-secondary)]">
                            {rec.clientName || rec.certificate.signerName}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-[var(--text-secondary)]">
                            {formatShortDate(rec.certificate.approvedAt, locale)}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-[var(--accent-emerald)]">
                            {rec.certificate.scopeDigestHex.slice(0, 12)}…
                          </td>
                          <td className="px-4 py-3.5 text-end">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/cert/${encodeURIComponent(rec.certificate.certificateNumber)}`)
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-emerald)] px-3 py-1.5 text-xs font-bold text-white"
                            >
                              <Award className="h-3.5 w-3.5" />
                              {copy.viewCertBtn}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Studio Hero + KPI Grid */}
            <section className="pin-card rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-3xl space-y-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-coral)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    {locale === 'ar'
                      ? 'دبابيس مراجعة بدون بروكسي · عدّاد الجولات · توثيق SHA-256'
                      : 'Zero-Proxy Visual Pins · Agreed Revision Caps · SHA-256 Sign-Off'}
                  </span>
                  <h1 className="pin-display text-2xl sm:text-3xl font-extrabold leading-snug text-[var(--text-primary)]">
                    {copy.heroTitle}
                  </h1>
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    {copy.heroSubtitle}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() => void handleCreatePreset('saas-landing')}
                  className="sm:hidden inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-coral)] px-4 py-2.5 text-sm font-bold text-[var(--accent-coral-fg)]"
                >
                  <Plus className="h-4 w-4" />
                  {copy.quickCreateBtn}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>{copy.statTotalBoards}</span>
                    <Layers className="h-4 w-4 text-[var(--accent-cobalt)]" />
                  </div>
                  <div className="num-tabular mt-1.5 text-2xl font-extrabold text-[var(--text-primary)]">
                    {stats?.total ?? boards.length}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>{copy.statOpenReviews}</span>
                    <MapPin className="h-4 w-4 text-[var(--accent-coral)]" />
                  </div>
                  <div className="num-tabular mt-1.5 text-2xl font-extrabold text-[var(--text-primary)]">
                    {stats?.reviewOpen ?? boards.filter((b) => b.status === 'review_open').length}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>{copy.statSignedLaunches}</span>
                    <CheckCircle2 className="h-4 w-4 text-[var(--accent-emerald)]" />
                  </div>
                  <div className="num-tabular mt-1.5 text-2xl font-extrabold text-[var(--text-primary)]">
                    {stats?.approvedForLaunch ?? boards.filter((b) => b.status === 'approved_for_launch').length}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>{copy.statOpenPins}</span>
                    <Sparkles className="h-4 w-4 text-[var(--accent-amber)]" />
                  </div>
                  <div className="num-tabular mt-1.5 text-2xl font-extrabold text-[var(--text-primary)]">
                    {openPinsTotal}
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Starter Presets */}
            <section className="space-y-3">
              <div>
                <h2 className="pin-display text-lg font-extrabold text-[var(--text-primary)]">
                  {copy.presetsTitle}
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                  {copy.presetsSubtitle}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                {presets.map((preset) => {
                  const creating = busyKey === `pre:${preset.id}`;
                  return (
                    <div
                      key={preset.id}
                      className="pin-card flex flex-col justify-between rounded-2xl p-4 space-y-4"
                    >
                      <div className="space-y-2">
                        <span className="inline-block rounded-full bg-[var(--bg-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent-coral)]">
                          {locale === 'ar' ? preset.badgeAr : preset.badgeEn}
                        </span>
                        <h3 className="pin-display text-sm font-bold leading-snug text-[var(--text-primary)]">
                          {locale === 'ar' ? preset.nameAr : preset.nameEn}
                        </h3>
                      </div>
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() => void handleCreatePreset(preset.id)}
                        data-testid={`create-preset-${preset.id}`}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent-coral)] hover:text-[var(--accent-coral)] disabled:opacity-60"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {creating ? copy.loadingLabel : copy.createPresetBtn}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Boards List */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="pin-display text-lg font-extrabold text-[var(--text-primary)]">
                  {copy.boardsTitle}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { key: 'all', label: copy.filterAll },
                      { key: 'review_open', label: copy.filterOpen },
                      { key: 'approved_for_launch', label: copy.filterApproved },
                    ] as const
                  ).map((pill) => (
                    <button
                      key={pill.key}
                      type="button"
                      onClick={() => setBoardFilter(pill.key)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        boardFilter === pill.key
                          ? 'bg-[var(--accent-coral)] text-[var(--accent-coral-fg)]'
                          : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingStudio ? (
                <div className="py-10 text-center text-sm text-[var(--text-secondary)]">
                  {copy.loadingLabel}
                </div>
              ) : filteredBoards.length === 0 ? (
                <div className="pin-card rounded-2xl p-8 text-center text-sm text-[var(--text-secondary)]">
                  {copy.noBoards}
                </div>
              ) : (
                <div className="space-y-3" data-testid="boards-list">
                  {filteredBoards.map((item) => {
                    const b = item.board;
                    const title = locale === 'ar' ? b.titleAr || b.title : b.title;
                    return (
                      <article
                        key={b.id}
                        className="pin-card flex flex-col gap-4 rounded-2xl p-5 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${boardStatusPill(
                                item.status,
                              )}`}
                            >
                              {boardStatusLabel(item.status, locale)}
                            </span>
                            <span className="font-mono text-xs text-[var(--text-secondary)]">
                              /r/{item.slug}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                              <Eye className="h-3.5 w-3.5" />
                              <span className="num-tabular">{item.viewCount}</span>
                            </span>
                            {item.certificateNumber && (
                              <span className="num-tabular rounded-full bg-[var(--accent-emerald-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent-emerald)]">
                                {item.certificateNumber}
                              </span>
                            )}
                          </div>

                          <h3 className="pin-display text-base font-extrabold text-[var(--text-primary)] truncate">
                            {title}
                          </h3>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {b.clientName} · {copy.roundCounter}{' '}
                            <span dir="ltr" className="num-tabular inline-block">
                              {item.metrics.roundsUsed}/{item.metrics.agreedRounds}
                            </span>{' '}
                            · {formatShortDate(item.updatedAt, locale)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveBoardId(b.id)}
                            data-testid={`open-board-${b.slug}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-coral)] px-3.5 py-2 text-xs font-bold text-[var(--accent-coral-fg)] hover:bg-[var(--accent-coral-hover)]"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            {copy.openBoardBtn}
                          </button>

                          <button
                            type="button"
                            onClick={() => navigate(`/r/${encodeURIComponent(b.slug)}`)}
                            data-testid={`open-client-${b.slug}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {copy.openClientLinkBtn}
                          </button>

                          {item.certificateNumber && (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/cert/${encodeURIComponent(item.certificateNumber!)}`)
                              }
                              data-testid={`open-cert-${item.certificateNumber}`}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent-emerald)]/40 bg-[var(--accent-emerald-soft)] px-3 py-2 text-xs font-bold text-[var(--accent-emerald)]"
                            >
                              <Award className="h-3.5 w-3.5" />
                              {copy.viewCertBtn}
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={busyKey !== null}
                            onClick={() => void handleDuplicateBoard(b.id)}
                            title={copy.duplicateBtn}
                            className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-60"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>

                          {item.status !== 'approved_for_launch' && (
                            <button
                              type="button"
                              disabled={busyKey !== null}
                              onClick={() => void handleDeleteBoard(b.id)}
                              title={copy.deleteBtn}
                              className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs font-medium text-[var(--accent-coral)] hover:bg-[var(--bg-soft)] disabled:opacity-60"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
