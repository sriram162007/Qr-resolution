/**
 * /api/detect-duplicate
 * 
 * Checks whether an incoming complaint is a duplicate of an existing open ticket
 * at the same QR location using TF-IDF cosine similarity.
 *
 * Architecture note: This is the prototype implementation using TF-IDF + cosine
 * similarity directly in the serverless function. The modular design allows a
 * classical ML baseline (TF-IDF + SVM) to be plugged in as a separate evaluator
 * without changing the API contract.
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// ─── Firebase Admin Init ──────────────────────────────────────────────────────

function getAdminDb(): ReturnType<typeof getFirestore> | null {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return getFirestore();
}

// ─── TF-IDF Cosine Similarity ────────────────────────────────────────────────

/**
 * Tokenise text into lowercase alphanumeric tokens.
 */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Build term-frequency map for a token list.
 */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

/**
 * Compute cosine similarity between two TF vectors.
 * Returns a value in [0, 1].
 */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, freq] of a) {
    dot += freq * (b.get(term) ?? 0);
    normA += freq * freq;
  }
  for (const [, freq] of b) normB += freq * freq;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Compute TF-IDF weighted similarity given a corpus of documents.
 * IDF = log(N / df + 1) where df = number of documents containing the term.
 */
function tfidfSimilarity(query: string, candidates: string[]): number[] {
  if (candidates.length === 0) return [];

  const queryTokens = tokenise(query);
  const candidateTokens = candidates.map(tokenise);
  const allDocs = [queryTokens, ...candidateTokens];
  const N = allDocs.length;

  // Build IDF
  const df = new Map<string, number>();
  for (const doc of allDocs) {
    const seen = new Set(doc);
    for (const term of seen) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const idf = (term: string) => Math.log(N / ((df.get(term) ?? 0) + 1));

  // TF-IDF vector builder
  function tfidfVector(tokens: string[]): Map<string, number> {
    const tf = termFrequency(tokens);
    const v = new Map<string, number>();
    for (const [term, freq] of tf) v.set(term, freq * idf(term));
    return v;
  }

  const queryVec = tfidfVector(queryTokens);
  return candidateTokens.map((ct) => cosineSimilarity(queryVec, tfidfVector(ct)));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

type DuplicateRequest = {
  qrId: string;
  description: string;
  organizationId: string;
  /** Similarity threshold [0,1]. Defaults to 0.55 */
  threshold?: number;
  /** Max age of tickets to compare (hours). Defaults to 168 (7 days) */
  lookbackHours?: number;
};

type DuplicateMatch = {
  ticketId: string;
  similarity: number;
  title: string;
  status: string;
  createdAt: string;
};

type DuplicateResponse = {
  isDuplicate: boolean;
  parentTicketId?: string;
  similarity?: number;
  matches?: DuplicateMatch[];
  threshold: number;
};

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ message: "Method not allowed" }));
  }

  const body = req.body as Partial<DuplicateRequest>;

  if (!body.qrId || !body.description || !body.organizationId) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ message: "qrId, description, and organizationId are required" }));
  }

  const threshold = typeof body.threshold === "number"
    ? Math.max(0.1, Math.min(0.99, body.threshold))
    : 0.55;

  const lookbackHours = typeof body.lookbackHours === "number"
    ? Math.max(1, Math.min(720, body.lookbackHours))
    : 168;

  try {
    const db = getAdminDb();
    if (!db) {
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          isDuplicate: false,
          threshold,
          reason: "Database scan offline or admin credentials not configured",
        })
      );
    }
    const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

    // Fetch open/in-progress tickets for the same QR location
    const snap = await db
      .collection("tickets")
      .where("qrId", "==", body.qrId)
      .where("organizationId", "==", body.organizationId)
      .where("createdAt", ">=", Timestamp.fromDate(cutoff))
      .get();

    const candidates = snap.docs
      .filter((d: any) => {
        const s = d.data().status as string;
        return ["OPEN", "TRIAGED", "ASSIGNED", "IN_PROGRESS"].includes(s);
      })
      .map((d: any) => ({
        ticketId: d.id,
        description: (d.data().description as string) || "",
        title: (d.data().title as string) || "",
        status: (d.data().status as string) || "",
        createdAt: (d.data().createdAt as Timestamp)?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      }));

    if (candidates.length === 0) {
      const response: DuplicateResponse = { isDuplicate: false, threshold };
      res.statusCode = 200;
      return res.end(JSON.stringify(response));
    }

    const similarities = tfidfSimilarity(
      body.description,
      candidates.map((c: { description: string }) => c.description),
    );

    const matches: DuplicateMatch[] = candidates
      .map((c: any, i: number) => ({ ...c, similarity: similarities[i] }))
      .filter((m: DuplicateMatch) => m.similarity >= threshold)
      .sort((a: DuplicateMatch, b: DuplicateMatch) => b.similarity - a.similarity);

    const isDuplicate = matches.length > 0;
    const best = matches[0];

    const response: DuplicateResponse = {
      isDuplicate,
      parentTicketId: isDuplicate ? best.ticketId : undefined,
      similarity: isDuplicate ? best.similarity : undefined,
      matches: isDuplicate ? matches.slice(0, 3) : undefined,
      threshold,
    };

    console.log("[Duplicate API]", {
      qrId: body.qrId,
      candidates: candidates.length,
      matches: matches.length,
      isDuplicate,
      topSimilarity: best?.similarity,
    });

    res.statusCode = 200;
    return res.end(JSON.stringify(response));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Duplicate API] Error:", message);
    res.statusCode = 500;
    return res.end(JSON.stringify({ message: "Duplicate detection failed", detail: message }));
  }
}
