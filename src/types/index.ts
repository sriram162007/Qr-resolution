export type UserRole = "ADMIN" | "STAFF" | "USER";

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
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

export type AuthError =
  | "auth/invalid-email"
  | "auth/user-disabled"
  | "auth/user-not-found"
  | "auth/wrong-password"
  | "auth/too-many-requests"
  | "auth/network-request-failed"
  | "auth/unknown";

export type OrganizationStatus = "ACTIVE" | "INACTIVE";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type LocationStatus = "ACTIVE" | "INACTIVE";

export interface Location {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description?: string;
  address?: string;
  parentLocationId?: string;
  type?: string;
  status: LocationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type QRStatus = "ACTIVE" | "INACTIVE";

export interface QRCode {
  id: string;
  organizationId: string;
  locationId: string;
  qrCode: string;
  publicUrl: string;
  status: QRStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type TicketStatus = "NEW" | "ACKNOWLEDGED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type TicketCategory = "ELECTRICAL" | "PLUMBING" | "CLEANING" | "FURNITURE" | "INTERNET" | "AIR_CONDITIONING" | "SECURITY" | "MAINTENANCE" | "SAFETY" | "OTHER";

export interface Ticket {
  id: string;
  ticketId: string;
  qrId: string;
  organizationId: string;
  qrLocationId?: string;
  issueLocationId: string;
  issueLocationName: string;
  category: TicketCategory;
  exactLocation: string;
  description: string;
  imageUrl?: string;
  reporterName?: string;
  reporterPhone?: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketUpdate {
  id: string;
  ticketId: string;
  message: string;
  createdBy: string;
  createdAt: Date;
}
