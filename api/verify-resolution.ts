/**
 * /api/verify-resolution
 *
 * Called by the student on the public tracking page when they see a RESOLVED ticket.
 * 
 * verified=true  → transitions ticket to VERIFIED/CLOSED and stores feedback
 * verified=false → reopens the ticket (IN_PROGRESS) and logs a reopen activity
 *
 * Security: Requires the tracking token so only the link holder can verify.
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function getAdminDb() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (projectId && clientEmail && privateKey) {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } else {
      initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID || "qr-resolution" });
    }
  }
  return getFirestore();
}

type VerifyRequest = {
  ticketId: string;
  trackingToken: string;
  verified: boolean;
  /** Optional feedback rating (1-5) when verified=true */
  rating?: number;
  /** Optional feedback comment */
  comment?: string;
};

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ message: "Method not allowed" }));
  }

  const body = req.body as Partial<VerifyRequest>;

  if (!body.ticketId || !body.trackingToken || typeof body.verified !== "boolean") {
    res.statusCode = 400;
    return res.end(JSON.stringify({ message: "ticketId, trackingToken, and verified are required" }));
  }

  // Validate rating
  const rating = typeof body.rating === "number" ? Math.max(1, Math.min(5, Math.round(body.rating))) : undefined;
  const comment = typeof body.comment === "string" ? body.comment.slice(0, 500).trim() : undefined;

  try {
    const db = getAdminDb();
    const ticketRef = db.collection("tickets").doc(body.ticketId);
    const snap = await ticketRef.get();

    if (!snap.exists) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ message: "Ticket not found" }));
    }

    const data = snap.data()!;

    // Validate tracking token
    if (data.trackingToken !== body.trackingToken) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ message: "Invalid tracking token" }));
    }

    // Ticket must be in RESOLVED status to verify
    if (data.status !== "RESOLVED") {
      res.statusCode = 409;
      return res.end(JSON.stringify({
        message: `Ticket is ${data.status}, not RESOLVED. Cannot verify.`,
      }));
    }

    const now = new Date();

    if (body.verified) {
      // ── Student confirmed resolution → VERIFIED then CLOSED ──────────────────
      const updates: Record<string, any> = {
        status: "VERIFIED",
        studentVerified: true,
        studentVerifiedAt: Timestamp.fromDate(now),
        closedAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        lastUpdatedBy: "student",
        lastUpdatedByName: "Student (Self-Verified)",
      };
      if (rating !== undefined) updates.studentFeedbackRating = rating;
      if (comment) updates.studentFeedbackComment = comment;

      await ticketRef.update(updates);

      // Log activity
      await db.collection("tickets").doc(body.ticketId).collection("activity").add({
        ticketId: body.ticketId,
        type: "verification",
        message: "Student confirmed the issue is resolved. Ticket verified.",
        changedBy: "student",
        changedByName: "Student",
        createdAt: Timestamp.fromDate(now),
      });

      // Store feedback in subcollection
      if (rating !== undefined) {
        await db.collection("tickets").doc(body.ticketId).collection("feedback").add({
          ticketId: body.ticketId,
          rating,
          comment: comment || null,
          submittedAt: Timestamp.fromDate(now),
        });
      }

      // Send WhatsApp closure notification if phone available
      if (data.phoneNumber) {
        const appUrl = (process.env.VITE_APP_URL || "").replace(/\/$/, "");
        const trackingUrl = data.trackingToken
          ? `${appUrl}/track/${body.ticketId}/${data.trackingToken}`
          : `${appUrl}/track/${body.ticketId}`;

        fetch(`${appUrl}/api/send-whatsapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: data.phoneNumber,
            ticketId: body.ticketId,
            type: "status_changed",
            status: "VERIFIED",
            trackingUrl,
          }),
        }).catch((e) => console.warn("[Verify] WhatsApp notification failed", e));
      }

      res.statusCode = 200;
      return res.end(JSON.stringify({
        success: true,
        action: "verified",
        newStatus: "VERIFIED",
        message: "Thank you! Your complaint has been marked as resolved.",
      }));
    } else {
      // ── Student says issue is NOT resolved → Reopen ───────────────────────
      await ticketRef.update({
        status: "IN_PROGRESS",
        studentVerified: false,
        updatedAt: Timestamp.fromDate(now),
        lastUpdatedBy: "student",
        lastUpdatedByName: "Student",
        currentActivity: "Student reported the issue is not resolved. Reopening for investigation.",
      });

      // Log activity
      await db.collection("tickets").doc(body.ticketId).collection("activity").add({
        ticketId: body.ticketId,
        type: "reopened",
        message: "Student reported the issue is NOT resolved. Ticket reopened for further investigation.",
        changedBy: "student",
        changedByName: "Student",
        createdAt: Timestamp.fromDate(now),
      });

      // Send WhatsApp reopen notification if phone available
      if (data.phoneNumber) {
        const appUrl = (process.env.VITE_APP_URL || "").replace(/\/$/, "");
        const trackingUrl = data.trackingToken
          ? `${appUrl}/track/${body.ticketId}/${data.trackingToken}`
          : `${appUrl}/track/${body.ticketId}`;

        fetch(`${appUrl}/api/send-whatsapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: data.phoneNumber,
            ticketId: body.ticketId,
            type: "status_changed",
            status: "IN_PROGRESS",
            currentActivity: "Your complaint has been reopened for further investigation.",
            trackingUrl,
          }),
        }).catch((e) => console.warn("[Verify] WhatsApp notification failed", e));
      }

      res.statusCode = 200;
      return res.end(JSON.stringify({
        success: true,
        action: "reopened",
        newStatus: "IN_PROGRESS",
        message: "We're sorry the issue wasn't resolved. Your ticket has been reopened.",
      }));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Verify Resolution] Error:", message);
    res.statusCode = 500;
    return res.end(JSON.stringify({ message: "Verification failed", detail: message }));
  }
}
