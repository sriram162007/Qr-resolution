import twilio from "twilio";

type WhatsAppRequest = {
  phoneNumber: string;
  ticketId: string;
  title: string;
};

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

  try {
    const client = twilio(accountSid, authToken);

    const toNumber = body.phoneNumber.startsWith("whatsapp:")
      ? body.phoneNumber
      : `whatsapp:${body.phoneNumber}`;

    const from = fromNumber.startsWith("whatsapp:")
      ? fromNumber
      : `whatsapp:${fromNumber}`;

    await client.messages.create({
      from,
      to: toNumber,
      body: `Your issue has been reported successfully.\n\nTicket ID: ${body.ticketId}\nIssue: ${body.title || "N/A"}\nStatus: OPEN\n\nYou can use your Ticket ID to track your issue.`,
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[WhatsApp API] Twilio error:", {
      message,
      name: err instanceof Error ? err.name : undefined,
    });
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "WhatsApp notification failed." }));
  }
}
