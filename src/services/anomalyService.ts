/**
 * Anomaly detection service (advisory only).
 * 
 * IMPORTANT: Anomaly flags are purely advisory. They MUST NEVER automatically
 * reject a genuine complaint. They exist to alert admins to suspicious patterns
 * for manual review only.
 */

import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import type { AnomalyFlag } from "@/types";

const TICKETS_COLLECTION = "tickets";

interface AnomalyCheckParams {
  qrId: string;
  organizationId: string;
  description: string;
  phoneNumber?: string;
}

interface AnomalyResult {
  flags: AnomalyFlag[];
  hasFlags: boolean;
}

/**
 * Check for suspicious submission patterns.
 * Returns advisory flags — does NOT reject the submission.
 */
export async function detectAnomalies(params: AnomalyCheckParams): Promise<AnomalyResult> {
  const flags: AnomalyFlag[] = [];
  const now = new Date();

  try {
    // Check 1: Excessive submissions from the same QR location in the last hour
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentSnap = await getDocs(
      query(
        collection(db, TICKETS_COLLECTION),
        where("qrId", "==", params.qrId),
        where("organizationId", "==", params.organizationId),
        where("createdAt", ">=", oneHourAgo),
      ),
    );

    if (recentSnap.size >= 5) {
      flags.push({
        type: "EXCESSIVE_LOCATION",
        detectedAt: now.toISOString(),
        detail: `${recentSnap.size} tickets submitted from QR location ${params.qrId} in the last hour`,
        reviewed: false,
      });
    }

    // Check 2: Repeated submission from the same phone number in the last 30 minutes
    if (params.phoneNumber) {
      const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const phoneSnap = await getDocs(
        query(
          collection(db, TICKETS_COLLECTION),
          where("phoneNumber", "==", params.phoneNumber),
          where("createdAt", ">=", thirtyMinsAgo),
        ),
      );
      if (phoneSnap.size >= 3) {
        flags.push({
          type: "REPEATED_SUBMISSION",
          detectedAt: now.toISOString(),
          detail: `${phoneSnap.size} tickets submitted from the same phone number in the last 30 minutes`,
          reviewed: false,
        });
      }
    }

    // Check 3: Very short description (possible spam)
    const descLength = params.description.trim().length;
    if (descLength < 10) {
      flags.push({
        type: "SPAM_PATTERN",
        detectedAt: now.toISOString(),
        detail: `Extremely short description (${descLength} chars) — may be a test or spam submission`,
        reviewed: false,
      });
    }

  } catch (err) {
    // Anomaly detection failure must never block submission
    console.warn("[Anomaly Detection] Non-critical error:", err instanceof Error ? err.message : err);
  }

  return {
    flags,
    hasFlags: flags.length > 0,
  };
}
