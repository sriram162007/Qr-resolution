import twilio from "twilio";

type WhatsAppRequest = {
  phoneNumber: string;
  ticketId: string;
  type: "created" | "updated" | "status_changed";
  title?: string;
  priority?: string;
  status?: string;
  changes?: string[];
  resolutionNotes?: string;
  assignedToName?: string;
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

function buildBody(body: Partial<WhatsAppRequest>): string {
  const ticketId = body.ticketId || "";
  const status = (body.status || "").toUpperCase();

  if (body.type === "created") {
    return `Your ticket ${ticketId} has been created successfully.\n\nStatus: ${status || "OPEN"}\nPriority: ${body.priority || "N/A"}`;
  }

  if (status === "RESOLVED") {
    const notes = body.resolutionNotes && body.resolutionNotes.trim().length > 0
      ? `\nResolution: ${body.resolutionNotes.trim()}`
      : "";
    return `Your ticket ${ticketId} has been resolved.${notes}`;
  }
  if (status === "CLOSED") {
    return `Your ticket ${ticketId} has been closed.`;
  }
  if (status === "TRIAGED") {
    return `Your ticket ${ticketId} has been reviewed and is now being processed.`;
  }
  if (status === "ASSIGNED") {
    const assignee = body.assignedToName && body.assignedToName.trim().length > 0
      ? ` to ${body.assignedToName.trim()}`
      : "";
    return `Your ticket ${ticketId} has been assigned${assignee}.`;
  }
  if (status === "IN_PROGRESS") {
    return `Your ticket ${ticketId} is now being worked on.`;
  }

  const changes = body.changes && body.changes.length > 0 ? body.changes.join(", ") : null;
  const lines: string[] = [];
  lines.push(`Your ticket ${ticketId} has been updated.`);

  if (status || changes) {
    lines.push("");
    if (status) {
      lines.push(`Status: ${status}`);
    }
    if (changes) {
      lines.push(`Updated: ${changes}`);
    }
  }

  lines.push("");
  lines.push("Our team is currently working on your issue.");

  return lines.join("\n");
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
  const from = fromNumber.startsWith("whatsapp:")
    ? fromNumber
    : `whatsapp:${fromNumber}`;

  console.log("[WhatsApp API] Sending notification", {
    ticketId: body.ticketId,
    type: body.type,
    recipient: maskedRecipient,
    normalizedDestination: maskRecipient(toNumber),
  });

  try {
    const client = twilio(accountSid, authToken);

    const result = await client.messages.create({
      from,
      to: toNumber,
      body: messageBody,
    });

    console.log("[WhatsApp API] Message sent", {
      ticketId: body.ticketId,
      type: body.type,
      recipient: maskedRecipient,
      messageSid: result.sid,
      status: result.status,
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true, messageSid: result.sid }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const errorCode = (err as any)?.code;
    const errorStatus = (err as any)?.status;
    console.error("[WhatsApp API] Twilio error", {
      ticketId: body.ticketId,
      type: body.type,
      recipient: maskedRecipient,
      errorCode,
      errorStatus,
      message,
    });
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "WhatsApp notification failed." }));
  }
}
