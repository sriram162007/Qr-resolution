export interface UserProfile {
  email: string | null;
  role?: "admin" | "staff";
}

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export type LoginCredentials = {
  email: string;
  password: string;
};

export type OrganizationStatus = "ACTIVE" | "INACTIVE";

export interface Organization {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type LocationType = "ORGANIZATION" | "BUILDING" | "FLOOR" | "ROOM" | "AREA" | "FACILITY" | "OTHER";

export type LocationStatus = "ACTIVE" | "INACTIVE";

export interface Location {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  type: LocationType;
  parentLocationId: string | null;
  /** Department responsible for issues at this location */
  department?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QRCode {
  id: string;
  qrId: string;
  organizationId: string;
  locationId: string;
  name: string;
  description?: string;
  /** Department mapped to this QR location */
  department?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type TicketStatus =
  | "OPEN"
  | "TRIAGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "VERIFIED"
  | "CLOSED"
  | "REOPENED";

export type TicketSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TicketPriority = "P4" | "P3" | "P2" | "P1";

export type RoutingDecision = "AUTO" | "MANUAL_REVIEW" | "OVERRIDDEN";

export interface EscalationRecord {
  level: number; // 1 = supervisor, 2 = admin office
  escalatedAt: string; // ISO string
  reason: string;
  notifiedTo?: string;
}

export interface AnomalyFlag {
  type: "REPEATED_SUBMISSION" | "EXCESSIVE_LOCATION" | "SPAM_PATTERN" | "OTHER";
  detectedAt: string;
  detail: string;
  reviewed: boolean;
}

export interface Ticket {
  id: string;
  ticketId: string;
  qrId: string;
  organizationId: string;
  locationId: string;
  category: string;
  subcategory?: string;
  title: string;
  description: string;
  reportedArea?: string;
  severity: TicketSeverity;
  priority: TicketPriority;
  status: TicketStatus;

  // AI fields
  aiSummary?: string;
  aiConfidence?: number;
  aiSuggestedAction?: string;
  /** AI category before any admin override */
  aiCategory?: string;
  /** Admin override flag + reason */
  adminOverride?: boolean;
  adminOverrideReason?: string;
  needsAdminReview?: boolean;

  // Department routing
  department?: string;
  routingDecision?: RoutingDecision;
  routingReason?: string;

  // Duplicate detection
  isDuplicate?: boolean;
  parentTicketId?: string;
  linkedTicketIds?: string[];
  duplicateSimilarity?: number;

  // Photos
  photoUrl?: string;
  resolutionPhotoUrl?: string;

  // Assignment
  assignedTo?: string;
  assignedToName?: string;

  // Resolution
  resolutionNotes?: string;
  resolutionSummary?: string;
  resolvedAt?: Date;
  closedAt?: Date;

  // Student verification
  studentVerified?: boolean;
  studentVerifiedAt?: Date;
  studentFeedbackRating?: number; // 1–5
  studentFeedbackComment?: string;

  // Escalation
  escalations?: EscalationRecord[];
  slaBreached?: boolean;
  slaBreachedAt?: string;

  // Anomaly
  anomalyFlags?: AnomalyFlag[];

  // Meta
  lastUpdatedBy?: string;
  lastUpdatedByName?: string;
  phoneNumber?: string;
  createdAt: Date;
  updatedAt: Date;
  /** Secure random token stored at creation — used to validate public /track/:id/:token links. */
  trackingToken?: string;
  /** Admin-settable human message shown to the customer on the tracking page. */
  currentActivity?: string;
  /** Range string e.g. "20-30" representing estimated minutes to resolution. */
  estimatedResolutionMins?: string;
  /** Actual elapsed minutes from creation to resolution. Computed on RESOLVED transition. */
  resolvedInMins?: number;
}

export interface TicketActivity {
  id: string;
  ticketId: string;
  type: string;
  message: string;
  changedBy?: string;
  changedByName?: string;
  createdAt: Date;
}

export interface TicketFeedback {
  id: string;
  ticketId: string;
  rating: number; // 1–5
  comment?: string;
  submittedAt: Date;
}

/** SLA configuration stored in Firestore, editable by admin */
export interface SLAConfig {
  id: string;
  organizationId: string;
  /** Priority level this config applies to */
  priority: TicketPriority;
  /** Time in minutes before first escalation (to supervisor) */
  firstEscalationMins: number;
  /** Time in minutes before second escalation (to admin) */
  secondEscalationMins: number;
  /** Time in minutes to close overdue resolved tickets */
  autoCloseResolvedMins: number;
  updatedAt: Date;
  updatedBy?: string;
}

/** Default SLA values (used when admin hasn't configured) */
export const DEFAULT_SLA_MINUTES: Record<TicketPriority, { first: number; second: number; autoClose: number }> = {
  P1: { first: 30,  second: 60,  autoClose: 1440 },
  P2: { first: 120, second: 240, autoClose: 2880 },
  P3: { first: 480, second: 960, autoClose: 4320 },
  P4: { first: 1440, second: 2880, autoClose: 7200 },
};

export const CAMPUS_CATEGORIES = [
  "Electrical",
  "Plumbing",
  "Cleaning",
  "Civil",
  "Hostel",
  "Laboratory",
  "Other",
] as const;

export type CampusCategory = typeof CAMPUS_CATEGORIES[number];
