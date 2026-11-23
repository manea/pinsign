import type {
  BoardStatus,
  CurrencyCode,
  Locale,
  PinPriority,
  PinStatus,
} from '../core/types.ts';

export interface CopyBundle {
  brandName: string;
  brandTagline: string;
  navStudio: string;
  navCertificates: string;
  themeSlate: string;
  themeMidnight: string;
  langSwitch: string;
  heroTitle: string;
  heroSubtitle: string;
  quickCreateBtn: string;
  statTotalBoards: string;
  statOpenReviews: string;
  statSignedLaunches: string;
  statOpenPins: string;
  presetsTitle: string;
  presetsSubtitle: string;
  createPresetBtn: string;
  boardsTitle: string;
  filterAll: string;
  filterOpen: string;
  filterApproved: string;
  noBoards: string;
  openBoardBtn: string;
  openClientLinkBtn: string;
  viewCertBtn: string;
  duplicateBtn: string;
  deleteBtn: string;
  backToStudio: string;
  loadingLabel: string;
  notFoundTitle: string;
  notFoundBody: string;
  // Review Canvas Board
  roundCounter: string;
  roundsRemainingLabel: string;
  overCapWarning: string;
  extraFeesLabel: string;
  advanceRoundBtn: string;
  embedBtn: string;
  copyClientLinkBtn: string;
  copiedLabel: string;
  uploadScreenBtn: string;
  approveForLaunchBtn: string;
  clickCanvasHint: string;
  approvedLockedBanner: string;
  newPinTitle: string;
  pinCommentPlaceholder: string;
  authorNamePlaceholder: string;
  priorityLabel: string;
  dropPinBtn: string;
  cancelBtn: string;
  pinsSidebarTitle: string;
  filterPinAll: string;
  filterPinOpen: string;
  filterPinResolved: string;
  filterPinOutOfScope: string;
  noPinsMatch: string;
  resolvePinBtn: string;
  reopenPinBtn: string;
  markInProgressBtn: string;
  markOutOfScopeBtn: string;
  extraQuotePlaceholder: string;
  saveOutOfScopeBtn: string;
  replyPlaceholder: string;
  sendReplyBtn: string;
  // Embed Modal
  embedModalTitle: string;
  embedModalSub: string;
  snippetLabel: string;
  inviteMessageLabel: string;
  copySnippetBtn: string;
  copyInviteBtn: string;
  closeBtn: string;
  // Sign-off Panel
  signoffTitle: string;
  signoffBlockerWarning: string;
  signerNameLabel: string;
  signerTitleLabel: string;
  signerEmailLabel: string;
  signatureModeTyped: string;
  signatureModeDrawn: string;
  clearSignature: string;
  drawSignatureHint: string;
  confirmAllPinsLabel: string;
  submitSignoffBtn: string;
  submittingSignoffBtn: string;
  // Certificate View
  certTitle: string;
  certNumberLabel: string;
  approvedAtLabel: string;
  clientLabel: string;
  studioLabel: string;
  stagingUrlLabel: string;
  roundsSummaryLabel: string;
  resolvedPinsSummaryLabel: string;
  outOfScopeSummaryLabel: string;
  extraFeesSummaryLabel: string;
  signerBlockLabel: string;
  digestLabel: string;
  verifiedSealText: string;
  tamperWarningText: string;
  auditTableTitle: string;
  colPinNum: string;
  colRound: string;
  colPriority: string;
  colStatus: string;
  colComment: string;
  colExtraFee: string;
  printPdfBtn: string;
  poweredBy: string;
}

const EN: CopyBundle = {
  brandName: 'PinSign',
  brandTagline: 'Visual Pins · Revision Caps · Launch Sign-Off',
  navStudio: 'Review Boards',
  navCertificates: 'Sign-Off Certificates',
  themeSlate: 'Studio Slate',
  themeMidnight: 'Midnight',
  langSwitch: 'العربية',
  heroTitle: 'Pin client feedback visually, enforce revision caps, and close with a signed Launch Certificate',
  heroSubtitle:
    'Built for Webflow, Framer, Shopify, and custom studios: zero-proxy visual boards + 1-line embed script, out-of-scope fee tracking, and immutable SHA-256 launch sign-off.',
  quickCreateBtn: 'New Review Board',
  statTotalBoards: 'Total Boards',
  statOpenReviews: 'In Review',
  statSignedLaunches: 'Signed for Launch',
  statOpenPins: 'Open Feedback Pins',
  presetsTitle: 'Start from a ready review preset',
  presetsSubtitle: 'Launch a board with starter responsive screens and agreed revision caps in one click.',
  createPresetBtn: 'Create Review Board',
  boardsTitle: 'Project Review Boards',
  filterAll: 'All',
  filterOpen: 'Open Review',
  filterApproved: 'Approved for Launch',
  noBoards: 'No matching review boards yet. Launch one from the presets above.',
  openBoardBtn: 'Open Board',
  openClientLinkBtn: 'Client View',
  viewCertBtn: 'Certificate',
  duplicateBtn: 'Clone to V2',
  deleteBtn: 'Delete',
  backToStudio: 'Back to Studio',
  loadingLabel: 'Loading...',
  notFoundTitle: 'Board or Certificate Not Found',
  notFoundBody: 'This review link does not exist or has been removed.',
  roundCounter: 'Revision Round',
  roundsRemainingLabel: 'remaining included',
  overCapWarning: 'Agreed revision cap exceeded — extra round fee applies',
  extraFeesLabel: 'Extra Scope Fees',
  advanceRoundBtn: 'Advance Round',
  embedBtn: 'Embed <script>',
  copyClientLinkBtn: 'Copy Client Link',
  copiedLabel: 'Copied',
  uploadScreenBtn: 'Upload Screen',
  approveForLaunchBtn: 'Approve for Launch',
  clickCanvasHint: 'Click anywhere on the design screen below to drop a numbered feedback pin.',
  approvedLockedBanner: 'Signed off & cryptographically locked for launch — feedback and rounds are now immutable.',
  newPinTitle: 'Drop New Feedback Pin',
  pinCommentPlaceholder: 'Describe what needs updating here...',
  authorNamePlaceholder: 'Your name',
  priorityLabel: 'Priority',
  dropPinBtn: 'Save Pin',
  cancelBtn: 'Cancel',
  pinsSidebarTitle: 'Feedback Pins',
  filterPinAll: 'All',
  filterPinOpen: 'Open',
  filterPinResolved: 'Resolved',
  filterPinOutOfScope: 'Out of Scope',
  noPinsMatch: 'No feedback pins match this filter.',
  resolvePinBtn: 'Resolve',
  reopenPinBtn: 'Reopen',
  markInProgressBtn: 'In Progress',
  markOutOfScopeBtn: 'Out of Scope',
  extraQuotePlaceholder: 'Extra fee quote',
  saveOutOfScopeBtn: 'Apply Scope Fee',
  replyPlaceholder: 'Write a reply...',
  sendReplyBtn: 'Reply',
  embedModalTitle: '1-Line Staging Widget & Client Invite',
  embedModalSub: 'Paste this snippet before </body> on Webflow, Framer, Shopify, or WordPress staging URLs — zero CORS proxy required.',
  snippetLabel: 'Staging Embed Script',
  inviteMessageLabel: 'Ready-to-Send Client Invite',
  copySnippetBtn: 'Copy Script',
  copyInviteBtn: 'Copy Message',
  closeBtn: 'Close',
  signoffTitle: 'Final Launch Sign-Off & Certificate',
  signoffBlockerWarning: 'Resolve or reclassify all open blocker pins before signing off for launch.',
  signerNameLabel: 'Authorized Signer Full Name',
  signerTitleLabel: 'Role / Title (optional)',
  signerEmailLabel: 'Email (optional)',
  signatureModeTyped: 'Typed Signature',
  signatureModeDrawn: 'Draw Signature',
  clearSignature: 'Clear',
  drawSignatureHint: 'Draw signature here with mouse or touch',
  confirmAllPinsLabel: 'I confirm all deliverables and feedback pins have been reviewed and approve final launch.',
  submitSignoffBtn: 'Sign & Issue Launch Certificate',
  submittingSignoffBtn: 'Issuing Certificate...',
  certTitle: 'Launch Sign-Off Certificate',
  certNumberLabel: 'Certificate No.',
  approvedAtLabel: 'Approved At',
  clientLabel: 'Client',
  studioLabel: 'Studio / Freelancer',
  stagingUrlLabel: 'Staging URL',
  roundsSummaryLabel: 'Rounds Used',
  resolvedPinsSummaryLabel: 'Resolved Pins',
  outOfScopeSummaryLabel: 'Out-of-Scope Items',
  extraFeesSummaryLabel: 'Approved Extra Fees',
  signerBlockLabel: 'Authorized Approval',
  digestLabel: 'SHA-256 Scope Integrity Seal',
  verifiedSealText: 'SHA-256 Integrity Verified — Zero Post-Approval Tampering',
  tamperWarningText: 'Integrity Warning — Board data changed after signing!',
  auditTableTitle: 'Locked Feedback & Revision Audit Log',
  colPinNum: '#',
  colRound: 'Round',
  colPriority: 'Priority',
  colStatus: 'Status',
  colComment: 'Feedback Item',
  colExtraFee: 'Scope Fee',
  printPdfBtn: 'Print / Save PDF',
  poweredBy: 'Verified with PinSign',
};

const AR: CopyBundle = {
  brandName: 'PinSign',
  brandTagline: 'دبابيس المراجعة · عدّاد الجولات · شهادة اعتماد الإطلاق',
  navStudio: 'لوحات المراجعة',
  navCertificates: 'سجل شهادات الإطلاق',
  themeSlate: 'اللوح النهاري',
  themeMidnight: 'الداكن',
  langSwitch: 'English',
  heroTitle: 'ثبّت ملاحظات العميل بالضبط على التصميم، اضبط جولات التعديل، وأغلق المشروع بشهادة إطلاق موثقة',
  heroSubtitle:
    'صُمم لمصممي ومطوري Webflow وFramer وShopify والمواقع المخصصة: لوحات رفع بدون بروكسي + مقتطف حقن سطر واحد، تسعير خارج النطاق، وشهادة اعتماد SHA-256 قابلة للطباعة.',
  quickCreateBtn: 'لوحة مراجعة جديدة',
  statTotalBoards: 'إجمالي اللوحات',
  statOpenReviews: 'قيد المراجعة',
  statSignedLaunches: 'معتمدة للإطلاق',
  statOpenPins: 'ملاحظات مفتوحة',
  presetsTitle: 'ابدأ من قالب مراجعة جاهز',
  presetsSubtitle: 'أنشئ لوحة مراجعة بشاشات أولية وحد جولات متفق عليه بضغطة واحدة.',
  createPresetBtn: 'إنشاء لوحة المراجعة',
  boardsTitle: 'لوحات مشاريع المراجعة',
  filterAll: 'الكل',
  filterOpen: 'قيد المراجعة',
  filterApproved: 'معتمدة للإطلاق',
  noBoards: 'لا توجد لوحات مطابقة حالياً — أنشئ لوحة جديدة من القوالب أعلاه.',
  openBoardBtn: 'فتح اللوحة',
  openClientLinkBtn: 'بوابة العميل',
  viewCertBtn: 'شهادة الإطلاق',
  duplicateBtn: 'نسخة V2',
  deleteBtn: 'حذف',
  backToStudio: 'العودة للاستوديو',
  loadingLabel: 'جارٍ التحميل...',
  notFoundTitle: 'اللوحة أو الشهادة غير موجودة',
  notFoundBody: 'تعذر العثور على رابط المراجعة المطلوب.',
  roundCounter: 'جولة المراجعة',
  roundsRemainingLabel: 'متبقية ضمن الاتفاق',
  overCapWarning: 'تم تجاوز عدد الجولات المتفق عليها — تُطبق رسوم الجولة الإضافية',
  extraFeesLabel: 'رسوم خارج النطاق',
  advanceRoundBtn: 'إنهاء وبدء جولة جديدة',
  embedBtn: 'مقتطف <script>',
  copyClientLinkBtn: 'نسخ رابط العميل',
  copiedLabel: 'تم النسخ',
  uploadScreenBtn: 'رفع شاشة جديدة',
  approveForLaunchBtn: 'اعتماد الإطلاق النهائي',
  clickCanvasHint: 'انقر في أي موضع على شاشة التصميم أدناه لإضافة دبوس ملاحظة مرقّم.',
  approvedLockedBanner: 'تم اعتماد الإطلاق النهائي وتوثيقه تشفيرياً — الملاحظات والجولات مقفلة ضد التعديل.',
  newPinTitle: 'إضافة دبوس ملاحظة جديد',
  pinCommentPlaceholder: 'اكتب التعديل المطلوب هنا بدقة...',
  authorNamePlaceholder: 'اسمك',
  priorityLabel: 'الأولوية',
  dropPinBtn: 'حفظ الدبوس',
  cancelBtn: 'إلغاء',
  pinsSidebarTitle: 'قائمة الملاحظات',
  filterPinAll: 'الكل',
  filterPinOpen: 'مفتوحة',
  filterPinResolved: 'محلولة',
  filterPinOutOfScope: 'خارج النطاق',
  noPinsMatch: 'لا توجد ملاحظات مطابقة لهذا الفلتر.',
  resolvePinBtn: 'تم الحل',
  reopenPinBtn: 'إعادة فتح',
  markInProgressBtn: 'قيد التنفيذ',
  markOutOfScopeBtn: 'خارج النطاق',
  extraQuotePlaceholder: 'تكلفة إضافية',
  saveOutOfScopeBtn: 'تثبيت التكلفة',
  replyPlaceholder: 'أضف رداً...',
  sendReplyBtn: 'إرسال',
  embedModalTitle: 'مقتطف السطر الواحد ودعوة العميل',
  embedModalSub: 'ألصق هذا الوسم قبل </body> في موقع التجربة (Webflow / Framer / WordPress / Shopify) لإرسال الدبابيس مباشرة.',
  snippetLabel: 'مقتطف موقع التجربة',
  inviteMessageLabel: 'رسالة دعوة جاهزة للعميل',
  copySnippetBtn: 'نسخ المقتطف',
  copyInviteBtn: 'نسخ الرسالة',
  closeBtn: 'إغلاق',
  signoffTitle: 'الاعتماد النهائي وإصدار شهادة الإطلاق',
  signoffBlockerWarning: 'يرجى حل أو إعادة تصنيف جميع الملاحظات الحرجة المفتوحة (Blocker) قبل الاعتماد.',
  signerNameLabel: 'الاسم الكامل للمفوّض بالاعتماد',
  signerTitleLabel: 'المسمى الوظيفي (اختياري)',
  signerEmailLabel: 'البريد الإلكتروني (اختياري)',
  signatureModeTyped: 'توقيع مكتوب',
  signatureModeDrawn: 'توقيع بالرسم',
  clearSignature: 'مسح',
  drawSignatureHint: 'ارسم توقيعك هنا بالفأرة أو اللمس',
  confirmAllPinsLabel: 'أقرّ بمراجعة جميع الملاحظات واعتماد التسليم والإطلاق النهائي للمشروع.',
  submitSignoffBtn: 'توقيع وإصدار شهادة الإطلاق',
  submittingSignoffBtn: 'جارٍ إصدار الشهادة...',
  certTitle: 'شهادة اعتماد الإطلاق النهائي',
  certNumberLabel: 'رقم الشهادة',
  approvedAtLabel: 'تاريخ الاعتماد',
  clientLabel: 'العميل',
  studioLabel: 'الاستوديو / المصمم',
  stagingUrlLabel: 'رابط بيئة التجربة',
  roundsSummaryLabel: 'الجولات المستخدمة',
  resolvedPinsSummaryLabel: 'الملاحظات المحلولة',
  outOfScopeSummaryLabel: 'بنود خارج النطاق',
  extraFeesSummaryLabel: 'الرسوم الإضافية المعتمدة',
  signerBlockLabel: 'الاعتماد المفوّض',
  digestLabel: 'بصمة السلامة والتثبيت SHA-256',
  verifiedSealText: 'تم التحقق من سلامة SHA-256 — لم يحدث أي تعديل بعد التوقيع',
  tamperWarningText: 'تحذير نزاهة — تم تعديل بيانات اللوحة بعد الاعتماد!',
  auditTableTitle: 'سجل الملاحظات والجولات المقفل',
  colPinNum: '#',
  colRound: 'الجولة',
  colPriority: 'الأولوية',
  colStatus: 'الحالة',
  colComment: 'نص الملاحظة',
  colExtraFee: 'تكلفة إضافية',
  printPdfBtn: 'طباعة / حفظ PDF',
  poweredBy: 'موثّق عبر PinSign',
};

export function getCopy(locale: Locale): CopyBundle {
  return locale === 'ar' ? AR : EN;
}

export function formatMoney(amount: number, currency: CurrencyCode, locale: Locale): string {
  const num = Number.isFinite(amount) ? amount : 0;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (locale === 'ar' && currency === 'AED') return `${formatted} د.إ`;
  if (locale === 'ar' && currency === 'SAR') return `${formatted} ر.س`;
  if (currency === 'USD') return `$${formatted}`;
  return `${formatted} ${currency}`;
}

export function formatShortDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function boardStatusLabel(status: BoardStatus, locale: Locale): string {
  const map: Record<BoardStatus, { en: string; ar: string }> = {
    review_open: { en: 'Open Review', ar: 'مفتوحة للمراجعة' },
    round_submitted: { en: 'Round Submitted', ar: 'جولة مرفوعة' },
    approved_for_launch: { en: 'Approved for Launch', ar: 'معتمدة للإطلاق' },
  };
  return map[status][locale];
}

export function pinStatusLabel(status: PinStatus, locale: Locale): string {
  const map: Record<PinStatus, { en: string; ar: string }> = {
    open: { en: 'Open', ar: 'مفتوحة' },
    in_progress: { en: 'In Progress', ar: 'قيد التنفيذ' },
    resolved: { en: 'Resolved', ar: 'تم الحل' },
    out_of_scope: { en: 'Out of Scope', ar: 'خارج النطاق' },
  };
  return map[status][locale];
}

export function priorityLabel(priority: PinPriority, locale: Locale): string {
  const map: Record<PinPriority, { en: string; ar: string }> = {
    blocker: { en: 'Blocker', ar: 'عائق إطلاق' },
    normal: { en: 'Normal', ar: 'عادية' },
    polish: { en: 'Polish', ar: 'تحسين' },
  };
  return map[priority][locale];
}
