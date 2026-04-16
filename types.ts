
export enum PlayerCategory {
  Batsman = "Batsman",
  Bowler = "Bowler",
  AllRounder = "All-Rounder",
  Wicketkeeper = "Wicketkeeper",
}

export interface PlayerRole {
    id?: string;
    name: string;
    basePrice: number; // Default base price for this role
}

export interface Player {
  id: number | string;
  name: string;
  photoUrl: string;
  category: string; // Auction Category (Group: MVP, Set 1, Uncapped)
  role: string;     // Player Type (Skill: Batsman, Bowler)
  basePrice: number;
  nationality: string;
  speciality: string; // Kept for backward compat, usually same for role
  stats: {
    matches: number;
    runs: number;
    wickets: number;
  };
  status?: 'SOLD' | 'UNSOLD';
  soldPrice?: number;
  soldTo?: string;
}

export interface PromoCode {
    id?: string;
    code: string;
    discountType: 'PERCENT' | 'FLAT';
    discountValue: number;
    maxClaims: number;
    currentClaims: number;
    expiryDate: number;
    active: boolean;
}

export interface RegisteredPlayer {
    id: string;
    fullName: string;
    mobile: string;
    playerType: string;
    gender: string;
    dob: string;
    profilePic: string;
    paymentScreenshot?: string;
    razorpayPaymentId?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    submittedAt: number;
    [key: string]: any; // For custom fields
}

export interface Team {
  id: number | string;
  teamCode?: string; // Automatically generated like T001, T002
  name: string;
  shortName?: string;
  owner: string;
  logoUrl: string;
  budget: number;
  players: Player[];
  minPlayers?: number;
  maxPlayers?: number;
  password?: string; // Added password for team login
}

export interface Bid {
  teamId: number | string;
  amount: number;
}

export enum AuctionStatus {
  NotStarted = "NOT_STARTED",
  InProgress = "IN_PROGRESS",
  Paused = "PAUSED",
  Sold = "SOLD",
  Unsold = "UNSOLD",
  Finished = "FINISHED",
}

export interface AuctionLog {
  message: string;
  timestamp: number;
  type: 'SYSTEM' | 'BID' | 'SOLD' | 'UNSOLD';
}

export interface BidIncrementSlab {
    from: number;
    increment: number;
}

export interface AuctionCategory {
    id?: string;
    name: string;
    basePrice: number;
    minPerTeam: number;
    maxPerTeam: number;
    requiredPlayers?: number;
    bidIncrement: number;
    bidLimit: number;
    slabs: BidIncrementSlab[];
}

export interface Sponsor {
    id: string;
    name: string;
    imageUrl: string;
}

export interface SponsorConfig {
    showOnOBS: boolean;
    showOnProjector: boolean;
    showHighlights?: boolean; // New: Toggle for news ticker highlights
    loopInterval: number; // seconds
}

export type ProjectorLayout = 'STANDARD' | 'IPL' | 'MODERN' | 'ADVAYA' | 'NEON' | 'FUTURISTIC';
export type OBSLayout = 'STANDARD' | 'MINIMAL' | 'VERTICAL' | 'ADVAYA';

export type AdminViewType = 'SQUAD' | 'PURSES' | 'UNSOLD' | 'SOLD' | 'TOP_BUY' | 'TOP_5' | 'NONE';

export interface AdminViewOverride {
    type: AdminViewType;
    data?: any; // e.g. { teamId: '...' }
}

export type BiddingStatus = 'ON' | 'PAUSED' | 'HIDDEN';

export interface AuctionState {
  players: Player[];
  teams: Team[];
  unsoldPlayers: Player[]; // This is the pool of available players
  categories: AuctionCategory[]; // Available categories with rules
  roles: PlayerRole[]; // Added Roles to State
  status: AuctionStatus;
  currentPlayerId: string | number | null; // Source of truth for current player
  currentPlayerIndex: number | null; // Derived helper
  currentBid: number | null;
  highestBidder: Team | null;
  timer: number;
  bidIncrement: number; // Global fallback increment
  bidSlabs?: BidIncrementSlab[]; // Global fallback slabs
  auctionLog: AuctionLog[];
  biddingStatus: BiddingStatus; // Replaces biddingEnabled
  playerSelectionMode: 'MANUAL' | 'AUTO';
  auctionLogoUrl?: string;
  tournamentName?: string;
  sport?: string;
  sponsors: Sponsor[];
  sponsorConfig: SponsorConfig;
  projectorLayout: ProjectorLayout;
  obsLayout: OBSLayout;
  adminViewOverride: AdminViewOverride | null;
  maxPlayersPerTeam?: number; // Global Squad Limit
  basePrice: number; // Global fallback base price
  systemLogoUrl?: string; // Global System Branding Logo
  systemTagline?: string; // Global System Branding Tagline
  isPaid?: boolean; // Per-auction payment status
  planId?: string; // Plan ID associated with auction
  autoDeleteAt?: number; // Scheduled deletion timestamp
  isLifetime?: boolean; // No auto-delete flag
  hideScoringSection?: boolean; // Global toggle for scoring section
  unlimitedPurse?: boolean; // Toggle for purse validation
  autoReserveFunds?: boolean; // Toggle for smart purse reservation
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  TEAM_OWNER = 'TEAM_OWNER',
  VIEWER = 'VIEWER',
  SUPPORT = 'SUPPORT'
}

export interface UserPlan {
    type: 'FREE' | 'BASIC' | 'PREMIUM';
    maxTeams: number;
    maxAuctions: number;
    expiresAt?: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  role: UserRole;
  teamId?: number | string; // If role is TEAM_OWNER
  plan?: UserPlan;
}

export interface SupportTicket {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    auctionId?: string;
    subject: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    staffId?: string;
    staffName?: string;
    createdAt: number;
    updatedAt: number;
}

export interface SupportMessage {
    id: string;
    ticketId: string;
    senderId: string;
    senderName: string;
    senderRole: UserRole;
    text: string;
    timestamp: number;
}

export interface SystemPopup {
    id?: string;
    title: string;
    message: string;
    imageUrl?: string;
    showImage: boolean;
    showText: boolean;
    delaySeconds: number;
    okButtonText: string;
    closeButtonText: string;
    expiryDate: number;
    isActive: boolean;
    createdAt: number;
}

export type FieldType = 'text' | 'number' | 'email' | 'select' | 'date' | 'file' | 'textarea';

export interface FormField {
    id: string;
    label: string;
    type: FieldType;
    required: boolean;
    options?: string[]; // For select inputs
    placeholder?: string;
}

export interface TeamPlayerCode {
    code: string;
    isUsed: boolean;
    usedBy?: string;
}

export interface CaptainCode {
    id?: string;
    code: string;
    assignedTo: string;
    teamName?: string;
    usageLimit: number;
    currentUsage: number;
    isActive: boolean;
    createdAt: number;
    teamCodes?: TeamPlayerCode[];
    teamMaxPlayers?: number;
    teamUsedCount?: number;
}

export interface WelcomePopupConfig {
    isEnabled: boolean;
    message: string;
    autoCloseTimer: number; // in seconds
}

export interface OrganizerContact {
    name: string;
    phone: string;
}

export interface BasicFieldConfig {
    show: boolean;
    required: boolean;
}

export interface RegistrationConfig {
    isEnabled: boolean;
    includePayment: boolean; 
    paymentMethod?: 'MANUAL' | 'RAZORPAY';
    razorpayKey?: string;
    isPublic: boolean; 
    hideLandingPage?: boolean;
    fee: number;
    upiId: string;
    upiName: string;
    qrCodeUrl: string;
    terms: string;
    bannerUrl?: string; 
    logoUrl?: string;
    theme?: 'DEFAULT' | 'ADVAYA';
    customSuccessMessage?: string;
    welcomePopup?: WelcomePopupConfig;
    maxRegistrations?: number;
    rules?: string;
    closedMessage?: string;
    organizerContacts?: OrganizerContact[];
    enableWaitlist?: boolean;
    waitlistMessage?: string;
    customFields: FormField[];
    basicFields?: {
        name: BasicFieldConfig;
        dob: BasicFieldConfig;
        photo: BasicFieldConfig;
        mobile: BasicFieldConfig;
        gender: BasicFieldConfig;
        role: BasicFieldConfig;
    };
}

export interface AuctionSetup {
    id?: string;
    title: string;
    season?: string;
    sport: string;
    date: string;
    venue?: string;
    plan: string;
    totalTeams: number;
    purseValue: number;
    basePrice: number;
    bidIncrement: number;
    slabs?: BidIncrementSlab[]; // Global slabs for auction
    playersPerTeam: number;
    status: 'DRAFT' | 'LIVE' | 'COMPLETED';
    createdAt: number;
    createdBy?: string;
    registrationConfig?: RegistrationConfig;
    logoUrl?: string;
    bannerUrl?: string;
    playerSelectionMode?: 'MANUAL' | 'AUTO';
    sponsors?: Sponsor[];
    sponsorConfig?: SponsorConfig;
    projectorLayout?: ProjectorLayout;
    obsLayout?: OBSLayout;
    isPaid?: boolean; // Per-auction payment status
    planId?: string; // Plan ID associated with auction
    autoDeleteAt?: number; // Scheduled deletion timestamp
    isLifetime?: boolean; // No auto-delete flag
    razorpayAuthorized?: boolean; // SUPER ADMIN controlled authorization
    dateTBD?: boolean;
    matchesDate?: string;
    eventVenue?: string;
    fullTournamentName?: string;
    unlimitedPurse?: boolean;
    autoReserveFunds?: boolean;
}

export type ScoreboardTheme = 'ICC_T20_2010' | 'ICC_T20_2012' | 'ICC_T20_2014' | 'ICC_T20_2016' | 'ICC_T20_2021' | 'ICC_T20_2022' | 'ICC_T20_2024' | 'CWC_2023' | 'DEFAULT';
export type OverlayView = 'DEFAULT' | 'I1BAT' | 'I1BALL' | 'I2BAT' | 'I2BALL' | 'SUMMARY' | 'FOW' | 'B1' | 'B2' | 'BOWLER' | 'TARGET' | 'PARTNERSHIP' | 'DECISION' | 'ANIMATION' | 'POINTS_TABLE' | 'TOP_BATTERS' | 'TOP_BOWLERS' | 'TOP_STRIKERS' | 'MOM' | 'PLAYER_STATS';
export type OverlayAnimation = 'NONE' | 'FOUR' | 'SIX' | 'WICKET' | 'FREE_HIT';
export type DecisionStatus = 'NONE' | 'PENDING' | 'OUT' | 'NOT_OUT';

export interface ScoringAsset {
    id: string;
    name: string;
    url: string;
    type: 'FRAME' | 'BACKGROUND' | 'LOGO';
    createdBy: string;
    createdAt: number;
}

export interface BallRecord {
    ballNumber: number;
    overNumber: number;
    bowlerId: string;
    batsmanId: string;
    runs: number;
    isWide: boolean;
    isNoBall: boolean;
    isWicket: boolean;
    isBye: boolean;
    isLegBye: boolean;
    extras: number;
}

export interface BatsmanStats {
    playerId: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    isStriker: boolean;
    outBy?: string;
}

export interface BowlerStats {
    playerId: string;
    name: string;
    overs: number;
    ballsBowled: number;
    runsConceded: number;
    wickets: number;
    maidens: number;
}

export interface InningsState {
    battingTeamId: string;
    bowlingTeamId: string;
    totalRuns: number;
    wickets: number;
    overs: number;
    ballsInCurrentOver: number;
    currentRunRate: number;
    extras: {
        wides: number;
        noBalls: number;
        byes: number;
        legByes: number;
    };
    strikerId: string | null;
    nonStrikerId: string | null;
    currentBowlerId: string | null;
    batsmen: { [key: string]: BatsmanStats };
    bowlers: { [key: string]: BowlerStats };
    recentBalls: BallRecord[];
}

export interface Match {
    id: string;
    auctionId: string;
    sourceType: 'AUCTION' | 'TOURNAMENT';
    teamAId: string;
    teamBId: string;
    teamAName: string;
    teamBName: string;
    totalOvers: number;
    status: 'SCHEDULED' | 'LIVE' | 'COMPLETED';
    currentInnings: 1 | 2;
    createdAt: number;
    innings: {
        [key: number]: InningsState;
    };
    overlay?: {
        theme: ScoreboardTheme;
        currentView: OverlayView;
        decision?: DecisionStatus;
        animation?: OverlayAnimation;
        backgroundGraphicUrl?: string;
        momId?: string;
        statsPlayerId?: string;
        customMessage?: string;
        teamAColor?: string;
        teamBColor?: string;
    };
}

export interface Tournament {
    id?: string;
    name: string;
    createdAt: number;
    createdBy?: string;
}

export interface CategoryArrangementSlot {
    playerId: string | number;
    playerName: string;
    category: string;
}

export interface CategoryArrangementDraft {
    id?: string;
    auctionId: string;
    categoryId: string; 
    slots: { [key: string]: CategoryArrangementSlot }; 
    updatedAt: number;
}

export interface AuctionContextType {
  state: AuctionState;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  placeBid: (teamId: string | number, amount: number) => Promise<void>;
  sellPlayer: (teamId?: string | number, customPrice?: number) => Promise<void>;
  passPlayer: () => Promise<void>;
  correctPlayerSale: (playerId: string, newTeamId: string | null, newPrice: number) => Promise<void>;
  startAuction: (specificPlayerId?: string | number) => Promise<boolean>;
  undoPlayerSelection: () => Promise<void>;
  endAuction: () => Promise<void>;
  resetAuction: () => Promise<void>;
  resetCurrentPlayer: () => Promise<void>;
  resetUnsoldPlayers: () => Promise<void>;
  updateBiddingStatus: (status: BiddingStatus) => Promise<void>;
  updateSponsorConfig: (config: SponsorConfig) => Promise<void>;
  toggleSelectionMode: () => Promise<void>;
  updateTheme: (type: 'PROJECTOR' | 'OBS', layout: string) => Promise<void>;
  setAdminView: (view: AdminViewOverride | null) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  joinAuction: (id: string) => void;
  activeAuctionId: string | null;
  nextBid: number;
}
