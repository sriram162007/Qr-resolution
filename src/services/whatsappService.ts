export type NotificationType = "created" | "updated" | "status_changed";

export function normalizePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    const num = digits.slice(1);
    if (/^\d{7,15}$/.test(num)) {
      return `+${num}`;
    }
    return null;
  }

  if (digits.startsWith("91") && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `+91${digits.slice(1)}`;
  }

  return null;
}

export function buildChangeList(oldTicket: Record<string, any>, newTicket: Record<string, any>): string[] {
  const fieldLabels: Record<string, string> = {
    title: "Title",
    description: "Description",
    category: "Category",
    subcategory: "Subcategory",
    locationId: "Location",
    severity: "Severity",
    priority: "Priority",
    assignedToName: "Assigned Team",
    resolutionNotes: "Resolution Notes",
    resolutionSummary: "Resolution Summary",
  };

  const changes: string[] = [];
  for (const [key, label] of Object.entries(fieldLabels)) {
    if (oldTicket[key] !== newTicket[key]) {
      changes.push(label);
    }
  }
  return changes;
}

export function shouldNotify(phoneNumber: string | undefined | null): boolean {
  if (!phoneNumber) return false;
  const normalized = normalizePhoneNumber(phoneNumber);
  return normalized !== null;
}
