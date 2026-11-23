export type Locale = 'en' | 'ar';

export type CurrencyCode = 'USD' | 'AED' | 'SAR' | 'EUR' | 'GBP';

export type BoardStatus = 'review_open' | 'round_submitted' | 'approved_for_launch';

export type PinStatus = 'open' | 'in_progress' | 'resolved' | 'out_of_scope';

export type PinPriority = 'blocker' | 'normal' | 'polish';

export type PinDevice = 'desktop' | 'tablet' | 'mobile';

export interface DesignScreen {
  id: string;
  title: string;
  titleAr?: string;
  urlPath: string;
  width: number;
  height: number;
  imageDataUrl: string;
  createdAt: string;
}

export interface PinReply {
  id: string;
  authorName: string;
  authorRole: 'client' | 'designer';
  body: string;
  createdAt: string;
}

export interface ReviewPin {
  id: string;
  pinNumber: number;
  screenId: string;
  xPct: number;
  yPct: number;
  roundNumber: number;
  status: PinStatus;
  priority: PinPriority;
  device: PinDevice;
  authorName: string;
  authorRole: 'client' | 'designer';
  selectorHint?: string;
  comment: string;
  outOfScopeQuote?: number;
  replies: PinReply[];
  createdAt: string;
  resolvedAt?: string;
}

export interface RevisionRoundLog {
  roundNumber: number;
  status: 'open' | 'submitted';
  startedAt: string;
  submittedAt?: string;
  submittedBy?: string;
  summaryNote?: string;
  openPinsAtClose?: number;
  resolvedPinsAtClose?: number;
}

export interface LaunchSignOff {
  certificateNumber: string;
  signerName: string;
  signerTitle?: string;
  signerEmail?: string;
  signatureType: 'drawn' | 'typed';
  signatureDataUrl?: string;
  confirmedAllPinsReviewed: boolean;
  scopeDigestHex: string;
  approvedAt: string;
  totalRoundsUsed: number;
  resolvedPinsCount: number;
  outOfScopeCount: number;
}

export interface ReviewBoard {
  id: string;
  slug: string;
  presetId?: string;
  defaultLocale: Locale;
  status: BoardStatus;
  title: string;
  titleAr?: string;
  clientName: string;
  studioName: string;
  stagingUrl?: string;
  currency: CurrencyCode;
  agreedRounds: number;
  currentRound: number;
  extraRoundFee: number;
  screens: DesignScreen[];
  pins: ReviewPin[];
  roundHistory: RevisionRoundLog[];
  signOff: LaunchSignOff | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardMetrics {
  totalPins: number;
  openPins: number;
  inProgressPins: number;
  resolvedPins: number;
  outOfScopePins: number;
  unresolvedBlockerPins: number;
  roundsUsed: number;
  agreedRounds: number;
  roundsRemaining: number;
  extraRoundsUsed: number;
  isOverRoundLimit: boolean;
  estimatedExtraFees: number;
  canApproveForLaunch: boolean;
  approvalBlockers: string[];
}

export interface CreatePinInput {
  screenId: string;
  xPct: number;
  yPct: number;
  comment: string;
  authorName: string;
  authorRole?: 'client' | 'designer';
  priority?: PinPriority;
  device?: PinDevice;
  selectorHint?: string;
}

export interface SignOffInput {
  signerName: string;
  signerTitle?: string;
  signerEmail?: string;
  signatureType: 'drawn' | 'typed';
  signatureDataUrl?: string;
  confirmedAllPinsReviewed: boolean;
  allowOpenBlockers?: boolean;
}
