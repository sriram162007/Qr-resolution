import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, getDocs, updateDoc, serverTimestamp, query, where, collection, orderBy, type DocumentData, type Timestamp } from "firebase/firestore";
import type { Ticket, TicketActivity } from "@/types";

const TICKETS_COLLECTION = "tickets";
const ACTIVITY_COLLECTION = "activity";

export const ALLOWED_TRANSITIONS: Record<Ticket["status"], Ticket["status"][]> = {
  OPEN: ["TRIAGED"],
  TRIAGED: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
};

export function canTransition(from: Ticket["status"], to: Ticket["status"]): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function generateTicketId(): string {
  return `TKT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function toDates(data: DocumentData & { createdAt?: Timestamp; updatedAt?: Timestamp }): Ticket {
  return {
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
    resolvedAt: data.resolvedAt?.toDate?.(),
    closedAt: data.closedAt?.toDate?.(),
  } as Ticket;
}

export async function createTicket(data: Omit<Ticket, "id" | "ticketId" | "createdAt" | "updatedAt">, ticketId?: string): Promise<string> {
  const id = ticketId || generateTicketId();
  const ref = doc(db, TICKETS_COLLECTION, id);
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Omit<Ticket, "id" | "ticketId" | "createdAt" | "updatedAt">;
  const payload = {
    ...cleanData,
    ticketId: id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(ref, payload);
    await addActivity(id, "created", "Ticket created", cleanData.lastUpdatedBy, cleanData.lastUpdatedByName);
    return id;
  } catch (error) {
    console.error("[Ticket Create] failed", {
      ticketId: id,
      code: (error as { code?: string })?.code,
      message: (error as { message?: string })?.message,
    });
    throw error;
  }
}

export async function getTicket(ticketId: string): Promise<Ticket | null> {
  const ref = doc(db, TICKETS_COLLECTION, ticketId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toDates({ id: snap.id, ...snap.data() });
}

export async function getTickets(organizationId: string): Promise<Ticket[]> {
  const q = query(collection(db, TICKETS_COLLECTION), where("organizationId", "==", organizationId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toDates({ id: d.id, ...d.data() }));
}

export async function updateTicket(ticketId: string, data: Partial<Ticket>, actor?: { id?: string; name?: string }): Promise<void> {
  const ref = doc(db, TICKETS_COLLECTION, ticketId);
  const payload: Record<string, unknown> = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  if (actor?.id) payload.lastUpdatedBy = actor.id;
  if (actor?.name) payload.lastUpdatedByName = actor.name;
  await updateDoc(ref, payload);
}

export async function updateTicketStatus(ticketId: string, status: Ticket["status"], actor?: { id?: string; name?: string }): Promise<void> {
  const current = await getTicket(ticketId);
  if (!current) throw new Error("Ticket not found");
  if (!canTransition(current.status, status)) {
    throw new Error(`Invalid status transition: ${current.status} → ${status}`);
  }
  const updates: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (status === "RESOLVED") {
    updates.resolvedAt = serverTimestamp();
  }
  if (status === "CLOSED") {
    updates.closedAt = serverTimestamp();
  }
  if (actor?.id) updates.lastUpdatedBy = actor.id;
  if (actor?.name) updates.lastUpdatedByName = actor.name;
  const ref = doc(db, TICKETS_COLLECTION, ticketId);
  await updateDoc(ref, updates);
  await addActivity(ticketId, "status", `Status changed to ${status}`, actor?.id, actor?.name);
}

export async function updateTicketDetail(ticketId: string, data: {
  status?: Ticket["status"];
  priority?: Ticket["priority"];
  severity?: Ticket["severity"];
  assignedTo?: string;
  assignedToName?: string;
  resolutionNotes?: string;
  resolutionSummary?: string;
}, actor?: { id?: string; name?: string }): Promise<void> {
  const current = await getTicket(ticketId);
  if (!current) throw new Error("Ticket not found");
  if (data.status && data.status !== current.status) {
    if (!canTransition(current.status, data.status)) {
      throw new Error(`Invalid status transition: ${current.status} → ${data.status}`);
    }
  }
  const updates: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.status === "RESOLVED") {
    updates.resolvedAt = serverTimestamp();
  }
  if (data.status === "CLOSED") {
    updates.closedAt = serverTimestamp();
  }
  if (actor?.id) updates.lastUpdatedBy = actor.id;
  if (actor?.name) updates.lastUpdatedByName = actor?.name;
  const ref = doc(db, TICKETS_COLLECTION, ticketId);
  await updateDoc(ref, updates);
  if (data.status && data.status !== current.status) {
    await addActivity(ticketId, "status", `Status changed to ${data.status}`, actor?.id, actor?.name);
  }
  if (data.assignedTo !== undefined && data.assignedTo !== current.assignedTo) {
    await addActivity(ticketId, "assignment", `Assigned to ${data.assignedToName || data.assignedTo}`, actor?.id, actor?.name);
  }
  if (data.resolutionNotes !== undefined && data.resolutionNotes !== current.resolutionNotes) {
    await addActivity(ticketId, "resolution", "Resolution notes updated", actor?.id, actor?.name);
  }
}

export async function addActivity(ticketId: string, type: string, message: string, changedBy?: string, changedByName?: string): Promise<void> {
  const activityRef = doc(collection(db, TICKETS_COLLECTION, ticketId, ACTIVITY_COLLECTION));
  await setDoc(activityRef, {
    ticketId,
    type,
    message,
    changedBy,
    changedByName,
    createdAt: serverTimestamp(),
  });
}

export async function getTicketActivities(ticketId: string): Promise<TicketActivity[]> {
  const q = query(collection(db, TICKETS_COLLECTION, ticketId, ACTIVITY_COLLECTION));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as DocumentData & { createdAt?: Timestamp };
    return {
      id: d.id,
      ticketId,
      type: data.type,
      message: data.message,
      changedBy: data.changedBy,
      changedByName: data.changedByName,
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
    } as TicketActivity;
  });
}

export async function getUsers(): Promise<Array<{ id: string; email: string | null }>> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, email: d.data().email ?? null }));
}

export async function setTicketStatus(ticketId: string, status: Ticket["status"]): Promise<void> {
  return updateTicketStatus(ticketId, status);
}

export async function setTicketAssignment(ticketId: string, assignedTo: string | undefined): Promise<void> {
  return updateTicket(ticketId, { assignedTo });
}
