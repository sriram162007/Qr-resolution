import twilio from "twilio";

type WhatsAppRequest = {
  phoneNumber: string;
  ticketId: string;
  type: "created" | "updated" | "status_changed";
  title?: string;
  category?: string;
  priority?: string;
  status?: string;
  changes?: string[];
  resolutionNotes?: string;
  assignedToName?: string;
  estimatedResolution?: string;
  trackingUrl?: string;
  resolvedInMins?: number;
  currentActivity?: string;
};

function maskRecipient(phoneNumber: string): string {
  const trimmed = phoneNumber.trim();
  if (trimmed.startsWith("whatsapp:")) {
    const digits = trimmed.slice(9);
    if (digits.length <= 4) return "whatsapp:****";
    return "whatsapp:****" + digits.slice(-4);
  }
  if (trimmed.length <= 4) return "****";
  return "****" + trimmed.slice(-4);
}

function normalizePhoneNumber(value: string): string | null {
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

function formatResolvedIn(mins: number): string {
  if (mins < 1) return "under 1 min";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Build a contextual, emoji-rich WhatsApp message body for each ticket lifecycle event.
 * All messages include a tracking link when available.
 * Kept within WhatsApp's 1600-character body limit.
 */
function buildBody(body: Partial<WhatsAppRequest>): string {
  const ticketId = body.ticketId || "";
  const status = (body.status || "").toUpperCase();
  const estimate = body.estimatedResolution
    ? `⏱️ *Estimated:* ${body.estimatedResolution}`
    : "";
  const trackLink = body.trackingUrl
    ? `🔗 *Track:* ${body.trackingUrl}`
    : "";

  // ── TICKET CREATED ──────────────────────────────────────────────────────
  if (body.type === "created") {
    const lines: string[] = [
      `🎫 *Complaint Registered*`,
      ``,
      `Ticket: *${ticketId}*`,
      body.category ? `📂 ${body.category}` : "",
      body.priority ? `🔴 Priority: ${body.priority}` : "",
      ``,
      `🤖 AI analysis is in progress.`,
    ];
    if (estimate) lines.push(``, estimate);
    if (trackLink) lines.push(``, trackLink);
    return lines.filter((l) => l !== undefined).join("\n");
  }

  // ── RESOLVED ────────────────────────────────────────────────────────────
  if (status === "RESOLVED") {
    const resolvedStr =
      body.resolvedInMins != null
        ? `⏱️ *Resolved in:* ${formatResolvedIn(body.resolvedInMins)}`
        : "";
    const notes =
      body.resolutionNotes && body.resolutionNotes.trim()
        ? `\n✏️ ${body.resolutionNotes.trim()}`
        : "";
    const lines: string[] = [
      `🎉 *Complaint Resolved*`,
      ``,
      `Ticket *${ticketId}* has been successfully resolved.🟢`,
      notes,
    ];
    if (resolvedStr) lines.push(``, resolvedStr);
    if (trackLink) lines.push(``, trackLink);
    lines.push(``, `Please verify the resolution. Reply if you need further help.`);
    return lines.join("\n");
  }

  // ── CLOSED ──────────────────────────────────────────────────────────────
  if (status === "CLOSED") {
    const lines: string[] = [
      `🔒 *Complaint Closed*`,
      ``,
      `Ticket *${ticketId}* is now closed.`,
      ``,
      `Thank you for using our support service.`,
      `⭐ We hope your issue was resolved to your satisfaction.`,
    ];
    if (trackLink) lines.push(``, trackLink);
    return lines.join("\n");
  }

  // ── TRIAGED ─────────────────────────────────────────────────────────────
  if (status === "TRIAGED") {
    const lines: string[] = [
      `🤖 *Complaint Analyzed*`,
      ``,
      `Ticket *${ticketId}* has been reviewed and categorized.`,
      ...(body.category ? ["", `📂 ${body.category}`] : []),
      body.priority ? `🔴 Priority: ${body.priority}` : "",
    ];
    if (estimate) lines.push(``, estimate);
    if (trackLink) lines.push(``, trackLink);
    return lines.filter((l) => l !== undefined).join("\n");
  }

  // ── ASSIGNED ────────────────────────────────────────────────────────────
  if (status === "ASSIGNED") {
    const agent =
      body.assignedToName && body.assignedToName.trim()
        ? `👨‍💻 *Agent:* ${body.assignedToName.trim()}`
        : "";
    const lines: string[] = [
      `👨‍💻 *Support Agent Assigned*`,
      ``,
      `Your complaint *${ticketId}* has been assigned to our support team.`,
      ...(agent ? ["", agent] : []),
    ];
    if (estimate) lines.push(``, estimate);
    if (trackLink) lines.push(``, trackLink);
    return lines.filter((l) => l !== undefined).join("\n");
  }

  // ── IN_PROGRESS ─────────────────────────────────────────────────────────
  if (status === "IN_PROGRESS") {
    const act = body.currentActivity
      ? body.currentActivity.trim()
      : "Our support team is currently investigating the issue.";
    const lines: string[] = [
      `🔍 *Investigation In Progress*`,
      ``,
      `We are actively working on *${ticketId}*.`,
      ``,
      `📝 *Current activity:*`,
      act,
    ];
    if (estimate) lines.push(``, estimate);
    if (trackLink) lines.push(``, trackLink);
    return lines.join("\n");
  }

  // ── GENERIC STATUS_CHANGED / UPDATED ────────────────────────────────────
  const act = body.currentActivity
    ? `\n📝 *Update:* ${body.currentActivity.trim()}`
    : "";
  const changes =
    body.changes && body.changes.length > 0
      ? `\nUpdated: ${body.changes.join(", ")}`
      : "";

  const lines: string[] = [
    `📋 *Complaint Update*`,
    ``,
    `Your ticket *${ticketId}* has been updated.`,
    status ? `\n🔄 Status: ${status}` : "",
    changes,
    act,
  ];
  if (estimate) lines.push(``, estimate);
  if (trackLink) lines.push(``, trackLink);
  return lines.filter((l) => l !== undefined).join("\n");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Method not allowed" }));
    return;
  }

  const body = req.body as Partial<WhatsAppRequest>;

  if (!body.phoneNumber || typeof body.phoneNumber !== "string" || body.phoneNumber.trim().length === 0) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Phone number is required" }));
    return;
  }

  if (!body.ticketId || typeof body.ticketId !== "string" || body.ticketId.trim().length === 0) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Ticket ID is required" }));
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    console.error("[WhatsApp API] Twilio credentials not configured");
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "WhatsApp notification is temporarily unavailable." }));
    return;
  }

  const normalizedPhone = normalizePhoneNumber(body.phoneNumber);
  if (!normalizedPhone) {
    console.error("[WhatsApp API] Invalid phone number", {
      recipient: maskRecipient(body.phoneNumber),
    });
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Invalid phone number." }));
    return;
  }

  const maskedRecipient = maskRecipient(normalizedPhone);
  const messageBody = buildBody(body);

  const toNumber = `whatsapp:${normalizedPhone}`;
  const from = fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`;

  console.log("[WhatsApp API] Sending notification", {
    ticketId: body.ticketId,
    type: body.type,
    status: body.status,
    recipient: maskedRecipient,
    hasTrackingUrl: !!body.trackingUrl,
  });

  try {
    const client = twilio(accountSid, authToken);

    const result = await client.messages.create({
      from,
      to: toNumber,
      body: messageBody,
    });

    // Twilio may return success=true but still include an error on the message
    // object (e.g. sandbox recipient not opted-in → errorCode 63032).
    if (result.errorCode) {
      console.warn("[WhatsApp API] Message accepted but has error code", {
        ticketId: body.ticketId,
        type: body.type,
        recipient: maskedRecipient,
        messageSid: result.sid,
        status: result.status,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });
    } else {
      console.log("[WhatsApp API] Message sent", {
        ticketId: body.ticketId,
        type: body.type,
        recipient: maskedRecipient,
        messageSid: result.sid,
        status: result.status,
      });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        success: true,
        messageSid: result.sid,
        ...(result.errorCode
          ? { warning: `Twilio errorCode ${result.errorCode}: ${result.errorMessage}` }
          : {}),
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const errorCode = (err as any)?.code;
    const errorStatus = (err as any)?.status;
    const twilioMoreInfo = (err as any)?.moreInfo;
    console.error("[WhatsApp API] Twilio error", {
      ticketId: body.ticketId,
      type: body.type,
      recipient: maskedRecipient,
      errorCode,
      errorStatus,
      message,
      twilioMoreInfo,
    });
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "WhatsApp notification failed.", errorCode }));
  }
}
