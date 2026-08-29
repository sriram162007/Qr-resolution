import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, getDocs, updateDoc, serverTimestamp, query, where, collection, orderBy, type DocumentData, type Timestamp } from "firebase/firestore";
import type { Ticket } from "@/types";

const COLLECTION = "tickets";

function toDates(data: DocumentData & { createdAt?: Timestamp; updatedAt?: Timestamp }): Ticket {
  return {
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  } as Ticket;
}

function generateTicketId(): string {
  return `TKT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export async function createTicket(data: Omit<Ticket, "id" | "ticketId" | "createdAt" | "updatedAt">): Promise<string> {
  const id = generateTicketId();
  const ref = doc(db, COLLECTION, id);
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Omit<Ticket, "id" | "ticketId" | "createdAt" | "updatedAt">;
  const payload = {
    ...cleanData,
    ticketId: id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  console.log("[Ticket Create] diagnostics", {
    ticketId: id,
    projectId: (db as any)?.app?.options?.projectId ?? null,
    path: `tickets/${id}`,
    dataKeys: Object.keys(payload),
    hasUndefined: Object.values(payload).some(v => v === undefined),
  });
  try {
    await setDoc(ref, payload);
    console.log("[Ticket Create] WRITE SUCCESS", { ticketId: id });
    return id;
  } catch (error) {
    console.error("[Ticket Create] WRITE FAILED", {
      ticketId: id,
      code: (error as { code?: string })?.code,
      message: (error as { message?: string })?.message,
      name: (error as { name?: string })?.name,
    });
    throw error;
  }
}

export async function getTicket(ticketId: string): Promise<Ticket | null> {
  const ref = doc(db, COLLECTION, ticketId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toDates({ id: snap.id, ...snap.data() });
}

export async function getTickets(organizationId: string): Promise<Ticket[]> {
  const q = query(collection(db, COLLECTION), where("organizationId", "==", organizationId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toDates({ id: d.id, ...d.data() }));
}


export async function updateTicket(ticketId: string, data: Partial<Ticket>): Promise<void> {
  const ref = doc(db, COLLECTION, ticketId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function setTicketStatus(ticketId: string, status: Ticket["status"]): Promise<void> {
  return updateTicket(ticketId, { status });
}

export async function setTicketAssignment(ticketId: string, assignedTo: string | undefined): Promise<void> {
  return updateTicket(ticketId, { assignedTo });
}

export async function getUsers(): Promise<Array<{ id: string; email: string | null }>> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, email: d.data().email ?? null }));
}
