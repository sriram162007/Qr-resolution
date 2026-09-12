import type { TicketStatus } from "@/types";

/**
 * The ordered lifecycle steps shown to customers on the tracking page.
 * Maps internal Firestore statuses to customer-friendly labels.
 */
export const TRACKING_STEPS: ReadonlyArray<{
  status: TicketStatus;
  label: string;
  emoji: string;
  shortLabel: string;
}> = [
  { status: "OPEN",        label: "Complaint Received",          emoji: "📥", shortLabel: "Received"    },
  { status: "TRIAGED",     label: "AI Analysis Completed",       emoji: "🤖", shortLabel: "Analyzed"    },
  { status: "ASSIGNED",    label: "Support Agent Assigned",      emoji: "👨‍💻", shortLabel: "Assigned"    },
  { status: "IN_PROGRESS", label: "Investigation in Progress",   emoji: "🔍", shortLabel: "In Progress" },
  { status: "RESOLVED",    label: "Resolved",                    emoji: "✅", shortLabel: "Resolved"    },
  { status: "CLOSED",      label: "Closed",                      emoji: "🔒", shortLabel: "Closed"      },
] as const;

const STATUS_ORDER: Record<TicketStatus, number> = {
  OPEN: 0, TRIAGED: 1, ASSIGNED: 2, IN_PROGRESS: 3, RESOLVED: 4, CLOSED: 5,
};

export function getStatusIndex(status: TicketStatus): number {
  return STATUS_ORDER[status] ?? 0;
}

export function getCustomerLabel(status: TicketStatus): string {
  return TRACKING_STEPS.find((s) => s.status === status)?.label ?? status;
}

export function getStatusEmoji(status: TicketStatus): string {
  return TRACKING_STEPS.find((s) => s.status === status)?.emoji ?? "📋";
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
    RESOLVED:    "The issue has been resolved. Please verify and let us know if you need further assistance.",
    CLOSED:      "Your complaint has been closed. Thank you for using our support service.",
  };
  return defaults[status] ?? "Your complaint is being processed.";
}

/**
 * Returns the "What happens next?" message for a given status.
 */
export function getNextStep(status: TicketStatus): string {
  const next: Partial<Record<TicketStatus, string>> = {
    OPEN:        "Your complaint will be reviewed and categorized shortly.",
    TRIAGED:     "A support agent will be assigned to your complaint.",
    ASSIGNED:    "The assigned agent will begin investigating your issue.",
    IN_PROGRESS: "Resolution will begin once the issue is fully identified.",
    RESOLVED:    "Your complaint will be closed once the resolution is confirmed.",
    CLOSED:      "",
  };
  return next[status] ?? "";
}

/**
 * Percentage progress through the lifecycle — used for the progress bar.
 */
export function getProgressPercent(status: TicketStatus): number {
  const map: Record<TicketStatus, number> = {
    OPEN: 10, TRIAGED: 30, ASSIGNED: 45, IN_PROGRESS: 65, RESOLVED: 90, CLOSED: 100,
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
    RESOLVED:    "#22c55e",
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
    RESOLVED:    "bg-green-100 text-green-800",
    CLOSED:      "bg-gray-100 text-gray-700",
  };
  return map[status] ?? "bg-blue-100 text-blue-800";
}
