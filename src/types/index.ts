export interface UserProfile {
  email: string | null;
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
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type TicketStatus = "OPEN" | "TRIAGED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type TicketSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TicketPriority = "P4" | "P3" | "P2" | "P1";

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
  aiSummary?: string;
  aiConfidence?: number;
  aiSuggestedAction?: string;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
