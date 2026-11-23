import { useEffect, useRef, useState } from 'react';
import { Eraser, PenTool, Type } from 'lucide-react';
import type { Locale } from '../core/types.ts';
import { getCopy } from '../lib/i18n.ts';

interface SignaturePadProps {
  mode: 'typed' | 'drawn';
  signerName: string;
  drawnDataUrl: string;
  locale: Locale;
  onModeChange: (mode: 'typed' | 'drawn') => void;
  onDrawnChange: (dataUrl: string) => void;
}

export function SignaturePad({
  mode,
  signerName,
  drawnDataUrl,
  locale,
  onModeChange,
  onDrawnChange,
}: SignaturePadProps) {
  const copy = getCopy(locale);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(Boolean(drawnDataUrl));

  useEffect(() => {
    setHasStroke(Boolean(drawnDataUrl));
  }, [drawnDataUrl]);

  useEffect(() => {
    if (mode !== 'drawn') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [mode]);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const pt = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    drawingRef.current = true;
    setHasStroke(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const pt = getPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }

  function finishStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if already released
    }
    onDrawnChange(canvas.toDataURL('image/png'));
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setHasStroke(false);
    onDrawnChange('');
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onModeChange('typed')}
          data-testid="sig-mode-typed"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            mode === 'typed'
              ? 'border-[var(--accent-coral)] bg-[var(--bg-soft)] text-[var(--accent-coral)]'
              : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Type className="h-4 w-4" />
          {copy.signatureModeTyped}
        </button>
        <button
          type="button"
          onClick={() => onModeChange('drawn')}
          data-testid="sig-mode-drawn"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            mode === 'drawn'
              ? 'border-[var(--accent-coral)] bg-[var(--bg-soft)] text-[var(--accent-coral)]'
              : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <PenTool className="h-4 w-4" />
          {copy.signatureModeDrawn}
        </button>
      </div>

      {mode === 'typed' ? (
        <div
          className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-elevated)] px-5 py-6 text-center"
          data-testid="typed-signature-preview"
        >
          <p className="pin-display text-2xl font-bold tracking-wide text-[var(--text-primary)]">
            {signerName.trim() || (locale === 'ar' ? 'التوقيع المعتمد' : 'Authorized Signature Preview')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-[var(--border-strong)] bg-white">
            <canvas
              ref={canvasRef}
              width={560}
              height={160}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
              style={{ touchAction: 'none' }}
              className="block h-36 w-full cursor-crosshair bg-white"
              data-testid="signature-canvas"
            />
            {!hasStroke && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                {copy.drawSignatureHint}
              </span>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearCanvas}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <Eraser className="h-3.5 w-3.5" />
              {copy.clearSignature}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
