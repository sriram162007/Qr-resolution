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

export async function createTicket(data: Omit<Ticket, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const id = generateTicketId();
  const ref = doc(db, COLLECTION, id);
  await setDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
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
