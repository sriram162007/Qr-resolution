import type { TicketStatus } from "@/types";

/**
 * The ordered lifecycle steps shown to customers on the tracking page.
 * Maps internal Firestore statuses to customer-friendly labels.
 * VERIFIED and REOPENED are mapped to the nearest appropriate step visually.
 */
export const TRACKING_STEPS: ReadonlyArray<{
  status: TicketStatus;
  label: string;
  emoji: string;
  shortLabel: string;
}> = [
  { status: "OPEN",        label: "Complaint Received",         emoji: "📥", shortLabel: "Received"    },
  { status: "TRIAGED",     label: "AI Analysis Completed",      emoji: "🤖", shortLabel: "Analyzed"    },
  { status: "ASSIGNED",    label: "Support Agent Assigned",     emoji: "👨‍💻", shortLabel: "Assigned"    },
  { status: "IN_PROGRESS", label: "Investigation in Progress",  emoji: "🔍", shortLabel: "In Progress" },
  { status: "RESOLVED",    label: "Resolution Completed",       emoji: "✅", shortLabel: "Resolved"    },
  { status: "VERIFIED",    label: "Verified & Closed",          emoji: "🔒", shortLabel: "Closed"      },
] as const;

const STATUS_ORDER: Record<TicketStatus, number> = {
  OPEN: 0,
  TRIAGED: 1,
  ASSIGNED: 2,
  IN_PROGRESS: 3,
  RESOLVED: 4,
  VERIFIED: 5,
  CLOSED: 5,
  REOPENED: 3, // visual position same as IN_PROGRESS
};

export function getStatusIndex(status: TicketStatus): number {
  return STATUS_ORDER[status] ?? 0;
}

export function getCustomerLabel(status: TicketStatus): string {
  const labels: Record<TicketStatus, string> = {
    OPEN:        "Complaint Received",
    TRIAGED:     "AI Analysis Completed",
    ASSIGNED:    "Support Agent Assigned",
    IN_PROGRESS: "Investigation in Progress",
    RESOLVED:    "Resolution Completed",
    VERIFIED:    "Verified & Closed",
    CLOSED:      "Closed",
    REOPENED:    "Complaint Reopened",
  };
  return labels[status] ?? status;
}

export function getStatusEmoji(status: TicketStatus): string {
  const emojis: Record<TicketStatus, string> = {
    OPEN:        "📥",
    TRIAGED:     "🤖",
    ASSIGNED:    "👨‍💻",
    IN_PROGRESS: "🔍",
    RESOLVED:    "✅",
    VERIFIED:    "🔒",
    CLOSED:      "🔒",
    REOPENED:    "🔄",
  };
  return emojis[status] ?? "📋";
}

/**
 * Returns the activity description shown prominently on the tracking page.
 * `custom` allows admins to set a manual message; falls back to sensible defaults.
 */
export function getStatusActivity(status: TicketStatus, custom?: string | null): string {
  if (custom && custom.trim()) return custom.trim();
  const defaults: Record<TicketStatus, string> = {
    OPEN:        "Your complaint has been received and is queued for review.",
    TRIAGED:     "Your complaint has been analyzed and categorized by our AI system.",
    ASSIGNED:    "A support agent has been assigned and will begin working on your complaint shortly.",
    IN_PROGRESS: "Our support team is currently investigating the reported issue.",
    RESOLVED:    "The issue has been resolved. Please verify below — let us know if the problem is actually fixed.",
    VERIFIED:    "Your complaint has been verified as resolved and closed. Thank you for your feedback!",
    CLOSED:      "Your complaint has been closed. Thank you for using our support service.",
    REOPENED:    "Your complaint was reopened as the issue was not fully resolved. Our team is working on it urgently.",
  };
  return defaults[status] ?? "Your complaint is being processed.";
}

/**
 * Returns the "What happens next?" message for a given status.
 */
export function getNextStep(status: TicketStatus): string {
  const next: Partial<Record<TicketStatus, string>> = {
    OPEN:        "Your complaint will be reviewed and categorized by our AI system shortly.",
    TRIAGED:     "A support agent will be assigned to your complaint.",
    ASSIGNED:    "The assigned agent will begin investigating your issue.",
    IN_PROGRESS: "Resolution will begin once the issue is fully identified.",
    RESOLVED:    "Please verify the resolution using the buttons above. If resolved, it will be closed.",
    REOPENED:    "Our team will prioritize this complaint and work to resolve it urgently.",
    VERIFIED:    "",
    CLOSED:      "",
  };
  return next[status] ?? "";
}

/**
 * Percentage progress through the lifecycle — used for the progress bar.
 */
export function getProgressPercent(status: TicketStatus): number {
  const map: Record<TicketStatus, number> = {
    OPEN:        10,
    TRIAGED:     30,
    ASSIGNED:    45,
    IN_PROGRESS: 65,
    REOPENED:    65,
    RESOLVED:    90,
    VERIFIED:    100,
    CLOSED:      100,
  };
  return map[status] ?? 0;
}

/**
 * Hex color for the current status — used for accents / badges.
 */
export function getStatusHexColor(status: TicketStatus): string {
  const colors: Record<TicketStatus, string> = {
    OPEN:        "#3b82f6",
    TRIAGED:     "#8b5cf6",
    ASSIGNED:    "#f59e0b",
    IN_PROGRESS: "#f97316",
    REOPENED:    "#f97316",
    RESOLVED:    "#22c55e",
    VERIFIED:    "#6b7280",
    CLOSED:      "#6b7280",
  };
  return colors[status] ?? "#3b82f6";
}

/**
 * Tailwind bg/text class pair for status badges — avoids dynamic class generation.
 */
export function getStatusBadgeClasses(status: TicketStatus): string {
  const map: Record<TicketStatus, string> = {
    OPEN:        "bg-blue-100 text-blue-800",
    TRIAGED:     "bg-purple-100 text-purple-800",
    ASSIGNED:    "bg-amber-100 text-amber-800",
    IN_PROGRESS: "bg-orange-100 text-orange-800",
    REOPENED:    "bg-orange-100 text-orange-800",
    RESOLVED:    "bg-green-100 text-green-800",
    VERIFIED:    "bg-gray-100 text-gray-700",
    CLOSED:      "bg-gray-100 text-gray-700",
  };
  return map[status] ?? "bg-blue-100 text-blue-800";
}
