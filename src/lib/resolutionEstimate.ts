import type { TicketPriority, TicketSeverity, TicketStatus } from "@/types";

/**
 * Fallback resolution estimate ranges (in minutes) by priority.
 * Used when no admin override is stored on the ticket.
 */
const BASE_ESTIMATE: Record<TicketPriority, [number, number]> = {
  P1: [10, 20],
  P2: [20, 30],
  P3: [30, 45],
  P4: [45, 90],
};

/**
 * Severity adjusts the estimate: critical issues get faster SLA attention,
 * low-severity issues may wait longer in queue.
 */
const SEVERITY_MULTIPLIER: Record<TicketSeverity, number> = {
  CRITICAL: 0.6,
  HIGH: 0.8,
  MEDIUM: 1.0,
  LOW: 1.3,
};

/**
 * As the ticket progresses, the remaining estimate shrinks.
 * A ticket IN_PROGRESS should show less remaining time than one that is OPEN.
 */
const STATUS_REMAINING_FACTOR: Record<TicketStatus, number> = {
  OPEN: 1.0,
  TRIAGED: 0.9,
  ASSIGNED: 0.75,
  IN_PROGRESS: 0.5,
  RESOLVED: 0,
  CLOSED: 0,
};

/**
 * Compute the [min, max] estimate range in minutes for the given ticket state.
 */
export function getEstimateRange(
  priority: TicketPriority,
  severity: TicketSeverity,
  status: TicketStatus,
): [number, number] {
  const [baseMin, baseMax] = BASE_ESTIMATE[priority] ?? [30, 60];
  const sevMultiplier = SEVERITY_MULTIPLIER[severity] ?? 1.0;
  const factor = STATUS_REMAINING_FACTOR[status] ?? 1.0;

  const min = Math.round(baseMin * sevMultiplier * factor);
  const max = Math.round(baseMax * sevMultiplier * factor);
  // Always show at least a 5–10 min range so we never claim "0 mins"
  return [Math.max(min, 5), Math.max(max, Math.max(min, 5) + 5)];
}

/**
 * Returns a human-readable range string, e.g. "20–30 mins".
 * Returns empty string for resolved/closed tickets.
 * `override` allows admins to set a manual estimate (stored on the ticket).
 */
export function getEstimateString(
  priority: TicketPriority,
  severity: TicketSeverity,
  status: TicketStatus,
  override?: string | null,
): string {
  if (status === "RESOLVED" || status === "CLOSED") return "";
  if (override && override.trim()) return `${override.trim()} mins`;
  const [min, max] = getEstimateRange(priority, severity, status);
  return `${min}–${max} mins`;
}

/**
 * Label that precedes the estimate — changes based on how far along the ticket is.
 */
export function getEstimateLabel(status: TicketStatus): string {
  switch (status) {
    case "IN_PROGRESS":
      return "Estimated completion";
    case "RESOLVED":
    case "CLOSED":
      return "Resolved";
    default:
      return "Estimated resolution";
  }
}

/**
 * Format an actual resolution time (in minutes) as a human-readable string.
 */
export function formatResolvedIn(mins: number): string {
  if (mins < 1) return "under 1 min";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
