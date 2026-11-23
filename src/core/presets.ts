import type { ReviewBoard } from './types.ts';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createPlaceholderScreenSvgDataUrl(
  title: string,
  subtitle: string,
  width: number,
  height: number,
  accentHex: string = '#E11D48',
): string {
  const w = Math.max(320, Math.round(width));
  const h = Math.max(240, Math.round(height));
  const safeTitle = escapeXml(title);
  const safeSubtitle = escapeXml(subtitle);
  const safeAccent = /^#[0-9a-fA-F]{3,8}$/.test(accentHex) ? accentHex : '#E11D48';

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="${w}" height="${h}" fill="#F8FAFC"/>`,
    `<rect x="0" y="0" width="${w}" height="64" fill="#0F172A"/>`,
    `<circle cx="28" cy="32" r="7" fill="${safeAccent}"/>`,
    `<circle cx="52" cy="32" r="7" fill="#F59E0B"/>`,
    `<circle cx="76" cy="32" r="7" fill="#10B981"/>`,
    `<rect x="116" y="22" width="${Math.max(120, Math.round(w * 0.25))}" height="20" rx="6" fill="#1E293B"/>`,
    `<rect x="48" y="96" width="${Math.max(180, w - 96)}" height="${Math.round(h * 0.34)}" rx="16" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>`,
    `<rect x="76" y="128" width="120" height="24" rx="12" fill="${safeAccent}" fill-opacity="0.14"/>`,
    `<text x="76" y="188" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#0F172A">${safeTitle}</text>`,
    `<text x="76" y="224" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="#475569">${safeSubtitle}</text>`,
    `<rect x="76" y="248" width="168" height="42" rx="10" fill="${safeAccent}"/>`,
    `<rect x="48" y="${Math.round(h * 0.34) + 124}" width="${Math.round((w - 136) / 3)}" height="${Math.max(96, Math.round(h * 0.28))}" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>`,
    `<rect x="${68 + Math.round((w - 136) / 3)}" y="${Math.round(h * 0.34) + 124}" width="${Math.round((w - 136) / 3)}" height="${Math.max(96, Math.round(h * 0.28))}" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>`,
    `<rect x="${88 + 2 * Math.round((w - 136) / 3)}" y="${Math.round(h * 0.34) + 124}" width="${Math.round((w - 136) / 3)}" height="${Math.max(96, Math.round(h * 0.28))}" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>`,
    `</svg>`,
  ].join('');

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export interface PinSignPresetMeta {
  id: 'saas-landing' | 'shopify-store' | 'brand-deck';
  nameEn: string;
  nameAr: string;
  badgeEn: string;
  badgeAr: string;
  factory: (nowIso: string) => Omit<ReviewBoard, 'id' | 'slug' | 'createdAt' | 'updatedAt'>;
}

export const PINSIGN_PRESETS: PinSignPresetMeta[] = [
  {
    id: 'saas-landing',
    nameEn: 'SaaS Marketing Site Redesign (Webflow)',
    nameAr: 'إعادة تصميم موقع تسويقي لمنتج SaaS',
    badgeEn: 'Webflow / Framer',
    badgeAr: 'موقع إطلاق',
    factory: (nowIso) => ({
      presetId: 'saas-landing',
      defaultLocale: 'en',
      status: 'review_open',
      title: 'Northstar Cloud — Marketing Site v2',
      titleAr: 'نورث ستار كلاود — مراجعة الموقع التسويقي v2',
      clientName: 'Liam Carter',
      studioName: 'Northwind Studio',
      stagingUrl: 'https://staging-northstar.example.com',
      currency: 'USD',
      agreedRounds: 2,
      currentRound: 1,
      extraRoundFee: 250,
      screens: [
        {
          id: 'scr-home',
          title: 'Hero & Value Proposition (Desktop)',
          titleAr: 'الواجهة الرئيسية والعرض القيمي (سطح المكتب)',
          urlPath: '/',
          width: 1280,
          height: 820,
          imageDataUrl: createPlaceholderScreenSvgDataUrl(
            'Northstar Cloud v2 Hero',
            'Staging review: Hero headline contrast, CTA hierarchy & 3-column bento',
            1280,
            820,
            '#E11D48',
          ),
          createdAt: nowIso,
        },
        {
          id: 'scr-pricing',
          title: 'Pricing & FAQ Comparison',
          titleAr: 'صفحة الباقات والأسئلة الشائعة',
          urlPath: '/pricing',
          width: 1280,
          height: 820,
          imageDataUrl: createPlaceholderScreenSvgDataUrl(
            'Pricing & Annual Toggle',
            '3 pricing tiers, annual savings badge & enterprise comparison table',
            1280,
            820,
            '#2563EB',
          ),
          createdAt: nowIso,
        },
      ],
      pins: [
        {
          id: 'pin-1',
          pinNumber: 1,
          screenId: 'scr-home',
          xPct: 24.5,
          yPct: 30.2,
          roundNumber: 1,
          status: 'open',
          priority: 'blocker',
          device: 'desktop',
          authorName: 'Liam Carter',
          authorRole: 'client',
          selectorHint: 'section.hero > h1.display-title',
          comment: 'Tighten the hero CTA copy to "Start Free Trial" before launch approval.',
          replies: [],
          createdAt: nowIso,
        },
        {
          id: 'pin-2',
          pinNumber: 2,
          screenId: 'scr-pricing',
          xPct: 58.0,
          yPct: 44.5,
          roundNumber: 1,
          status: 'resolved',
          priority: 'normal',
          device: 'mobile',
          authorName: 'Liam Carter',
          authorRole: 'client',
          comment: 'Center the annual billing discount pill cleanly on 390px mobile screens.',
          replies: [
            {
              id: 'rep-2-1',
              authorName: 'Northwind Studio',
              authorRole: 'designer',
              body: 'Fixed centering on mobile breakpoint and tightened badge spacing.',
              createdAt: nowIso,
            },
          ],
          createdAt: nowIso,
          resolvedAt: nowIso,
        },
      ],
      roundHistory: [
        {
          roundNumber: 1,
          status: 'open',
          startedAt: nowIso,
        },
      ],
      signOff: null,
      notes: 'Agreed 2 full revision rounds before final Webflow DNS cutover.',
    }),
  },
  {
    id: 'shopify-store',
    nameEn: 'Bilingual E-Commerce Storefront (UAE/GCC)',
    nameAr: 'متجر إلكتروني ثنائي اللغة (الإمارات والخليج)',
    badgeEn: 'Shopify / RTL',
    badgeAr: 'تجارة إلكترونية',
    factory: (nowIso) => ({
      presetId: 'shopify-store',
      defaultLocale: 'ar',
      status: 'review_open',
      title: 'Rawaa Botanicals — Storefront Staging',
      titleAr: 'متجر رواء للعطور — مراجعة بيئة الإطلاق',
      clientName: 'مها المزروعي',
      studioName: 'استوديو أفق الرقمي',
      stagingUrl: 'https://staging-rawaa.example.com',
      currency: 'AED',
      agreedRounds: 2,
      currentRound: 1,
      extraRoundFee: 900,
      screens: [
        {
          id: 'scr-catalog',
          title: 'Product Catalog & Arabic RTL Drawer',
          titleAr: 'صفحة المنتجات وسلة الشراء RTL',
          urlPath: '/ar/collections/all',
          width: 1280,
          height: 820,
          imageDataUrl: createPlaceholderScreenSvgDataUrl(
            'Rawaa Storefront (AR/EN)',
            'Catalog grid, Apple Pay sticky bar & instant cart drawer',
            1280,
            820,
            '#0F766E',
          ),
          createdAt: nowIso,
        },
      ],
      pins: [
        {
          id: 'pin-1',
          pinNumber: 1,
          screenId: 'scr-catalog',
          xPct: 32.0,
          yPct: 48.0,
          roundNumber: 1,
          status: 'in_progress',
          priority: 'blocker',
          device: 'mobile',
          authorName: 'مها المزروعي',
          authorRole: 'client',
          comment: 'تأكيد ظهور أيقونة الدفع بـ Apple Pay باللون المناسب أعلى زر الشراء على الجوال.',
          replies: [],
          createdAt: nowIso,
        },
      ],
      roundHistory: [
        {
          roundNumber: 1,
          status: 'open',
          startedAt: nowIso,
        },
      ],
      signOff: null,
      notes: 'Includes 2 review rounds prior to domain transfer.',
    }),
  },
  {
    id: 'brand-deck',
    nameEn: 'Brand Guidelines & Visual System Review',
    nameAr: 'مراجعة دليل الهوية البصرية ونظام العلامة',
    badgeEn: 'Brand & UI Deck',
    badgeAr: 'هوية بصرية',
    factory: (nowIso) => ({
      presetId: 'brand-deck',
      defaultLocale: 'en',
      status: 'review_open',
      title: 'Kestrel Robotics — Brand Identity Final Check',
      titleAr: 'كيستريل روبوتيكس — الاعتماد النهائي للهوية',
      clientName: 'Daniel Park',
      studioName: 'Atelier Form',
      currency: 'USD',
      agreedRounds: 3,
      currentRound: 1,
      extraRoundFee: 300,
      screens: [
        {
          id: 'scr-brand',
          title: 'Logo Clearspace & Typography Scale',
          titleAr: 'مساحة أمان الشعار وتدرج الخطوط',
          urlPath: '/brand-guidelines',
          width: 1280,
          height: 820,
          imageDataUrl: createPlaceholderScreenSvgDataUrl(
            'Brand Guidelines v3',
            'Primary wordmark, dark slate tokens & editorial grid',
            1280,
            820,
            '#D97706',
          ),
          createdAt: nowIso,
        },
      ],
      pins: [],
      roundHistory: [
        {
          roundNumber: 1,
          status: 'open',
          startedAt: nowIso,
        },
      ],
      signOff: null,
      notes: 'All source vector & Figma libraries unlock upon signed Launch Certificate.',
    }),
  },
];

export function createBoardFromPreset(
  presetId: PinSignPresetMeta['id'],
  overrides: Partial<ReviewBoard> = {},
): ReviewBoard {
  const now = new Date().toISOString();
  const preset = PINSIGN_PRESETS.find((p) => p.id === presetId) ?? PINSIGN_PRESETS[0]!;
  const base = preset.factory(now);
  const rand = Math.random().toString(36).slice(2, 7);

  return {
    id: overrides.id ?? `brd-${Date.now().toString(36)}-${rand}`,
    slug: overrides.slug ?? `${preset.id}-${rand}`,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...base,
    ...overrides,
  };
}
