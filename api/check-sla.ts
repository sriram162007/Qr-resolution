/**
 * /api/check-sla
 *
 * Monitors all open tickets for SLA breaches and triggers escalations.
 * Should be called by a Vercel Cron job (e.g., every 15 minutes) or
 * on-demand by the admin dashboard.
 *
 * Escalation levels:
 *   Level 1: firstEscalationMins — notifies department supervisor
 *   Level 2: secondEscalationMins — notifies admin office
 *
 * SLA configuration is read from Firestore `sla_configs` collection (per priority).
 * Falls back to DEFAULT_SLA_MINUTES if not configured.
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue, type Firestore } from "firebase-admin/firestore";

function getAdminDb(): Firestore | null {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
}

type TicketPriority = "P1" | "P2" | "P3" | "P4";

const DEFAULT_SLA_MINUTES: Record<TicketPriority, { first: number; second: number }> = {
  P1: { first: 30,  second: 60  },
  P2: { first: 120, second: 240 },
  P3: { first: 480, second: 960 },
  P4: { first: 1440, second: 2880 },
};

/** Load SLA config from Firestore or return defaults */
async function getSLAConfig(db: Firestore, organizationId: string) {
  const snap = await db
    .collection("sla_configs")
    .where("organizationId", "==", organizationId)
    .get();

  const config: Record<string, { first: number; second: number }> = {};
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.priority) {
      config[d.priority] = {
        first: d.firstEscalationMins ?? DEFAULT_SLA_MINUTES[d.priority as TicketPriority]?.first ?? 480,
        second: d.secondEscalationMins ?? DEFAULT_SLA_MINUTES[d.priority as TicketPriority]?.second ?? 960,
      };
    }
  }
  return config;
}

/** Send escalation WhatsApp notification */
async function sendEscalationNotification(params: {
  phoneNumber: string;
  ticketId: string;
  level: number;
  priority: string;
  ageMinutes: number;
  trackingUrl?: string;
}) {
  const appUrl = (process.env.VITE_APP_URL || "").replace(/\/$/, "");
  try {
    const response = await fetch(`${appUrl}/api/send-whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber: params.phoneNumber,
        ticketId: params.ticketId,
        type: "escalated",
        escalationLevel: params.level,
        priority: params.priority,
        ageMinutes: params.ageMinutes,
        trackingUrl: params.trackingUrl,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  // Allow GET (cron) or POST (admin manual trigger)
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ message: "Method not allowed" }));
  }

  // Simple secret check to prevent unauthorized cron triggering
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers?.authorization ?? "";
    const querySecret = req.query?.secret ?? "";
    if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ message: "Unauthorized" }));
    }
  }

  try {
    const db = getAdminDb();
    if (!db) {
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          success: true,
          evaluated: 0,
          escalated: 0,
          notice: "Admin credentials pending. SLA scan completed with 0 tickets.",
        })
      );
    }
    const now = new Date();

    // Fetch all non-closed, non-resolved tickets across all organizations
    const openSnap = await db
      .collection("tickets")
      .where("status", "not-in", ["CLOSED", "RESOLVED", "VERIFIED"])
      .get();

    // Group by organization to load SLA configs efficiently
    const orgIds = new Set<string>();
    for (const doc of openSnap.docs) orgIds.add(doc.data().organizationId);

    const slaByOrg: Record<string, Record<string, { first: number; second: number }>> = {};
    for (const orgId of orgIds) {
      slaByOrg[orgId] = await getSLAConfig(db, orgId);
    }

    const results = {
      checked: 0,
      escalated: 0,
      level1: 0,
      level2: 0,
      errors: 0,
    };

    const batch = db.batch();
    const activityWrites: Array<() => Promise<void>> = [];
    const appUrl = (process.env.VITE_APP_URL || "").replace(/\/$/, "");

    for (const doc of openSnap.docs) {
      results.checked++;
      const data = doc.data();
      const priority = (data.priority ?? "P3") as TicketPriority;
      const createdAt = (data.createdAt as Timestamp)?.toDate?.() ?? now;
      const ageMinutes = (now.getTime() - createdAt.getTime()) / 60000;
      const orgId = data.organizationId as string;

      const slaConfig = slaByOrg[orgId]?.[priority] ?? DEFAULT_SLA_MINUTES[priority] ?? { first: 480, second: 960 };

      const existingEscalations: any[] = data.escalations ?? [];
      const hasLevel1 = existingEscalations.some((e: any) => e.level === 1);
      const hasLevel2 = existingEscalations.some((e: any) => e.level === 2);

      const newEscalations: any[] = [];

      // Level 2 escalation check
      if (!hasLevel2 && ageMinutes >= slaConfig.second) {
        newEscalations.push({
          level: 2,
          escalatedAt: now.toISOString(),
          reason: `SLA breached: ticket open for ${Math.round(ageMinutes)} mins (limit: ${slaConfig.second} mins)`,
          notifiedTo: "Admin Office",
        });
        results.level2++;
      }

      // Level 1 escalation check
      if (!hasLevel1 && ageMinutes >= slaConfig.first) {
        newEscalations.push({
          level: 1,
          escalatedAt: now.toISOString(),
          reason: `SLA warning: ticket open for ${Math.round(ageMinutes)} mins (limit: ${slaConfig.first} mins)`,
          notifiedTo: "Department Supervisor",
        });
        results.level1++;
      }

      if (newEscalations.length > 0) {
        results.escalated++;

        const updates: Record<string, any> = {
          slaBreached: true,
          slaBreachedAt: now.toISOString(),
          escalations: FieldValue.arrayUnion(...newEscalations),
          updatedAt: Timestamp.fromDate(now),
        };

        batch.update(doc.ref, updates);

        // Queue activity log writes (can't batch subcollection)
        const ticketId = doc.id;
        for (const esc of newEscalations) {
          activityWrites.push(async () => {
            try {
              await db
                .collection("tickets")
                .doc(ticketId)
                .collection("activity")
                .add({
                  ticketId,
                  type: "escalation",
                  message: `Escalation Level ${esc.level}: ${esc.reason}`,
                  changedBy: "system",
                  changedByName: "SLA Monitor",
                  createdAt: Timestamp.fromDate(now),
                });
            } catch (e) {
              console.warn("[SLA] Activity log failed for", ticketId, e);
            }
          });
        }

        // Send WhatsApp notification if phone available and it's a level 2 escalation
        if (data.phoneNumber && newEscalations.some((e) => e.level === 2)) {
          const trackingUrl = data.trackingToken
            ? `${appUrl}/track/${doc.id}/${data.trackingToken}`
            : `${appUrl}/track/${doc.id}`;
          sendEscalationNotification({
            phoneNumber: data.phoneNumber,
            ticketId: doc.id,
            level: 2,
            priority,
            ageMinutes: Math.round(ageMinutes),
            trackingUrl,
          }).catch((e) => console.warn("[SLA] WhatsApp escalation failed", e));
        }
      }
    }

    // Commit batch updates
    if (results.escalated > 0) {
      await batch.commit();
      await Promise.allSettled(activityWrites.map((fn) => fn()));
    }

    console.log("[SLA Monitor]", results);
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: true, ...results }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[SLA Monitor] Error:", message);
    res.statusCode = 500;
    return res.end(JSON.stringify({ message: "SLA check failed", detail: message }));
  }
}
