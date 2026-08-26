import { createDocument, getDocument, getDocuments, updateDocument, COLLECTIONS } from "@/services/firestore.service";
import { where, type QueryConstraint } from "firebase/firestore";
import type { Ticket, TicketUpdate, TicketStatus, TicketPriority } from "@/types";

function generateTicketId(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `QR-${datePart}-${randomPart}`;
}

export async function createTicket(data: Omit<Ticket, "id" | "ticketId" | "createdAt" | "updatedAt"> & { status?: TicketStatus; priority?: TicketPriority }): Promise<string> {
  const ticketId = generateTicketId();
  await createDocument<Ticket>(COLLECTIONS.tickets, {
    ...data,
    ticketId,
    status: data.status ?? "NEW",
    priority: data.priority ?? "NORMAL",
  } as Ticket);
  return ticketId;
}

export async function getTicket(ticketId: string): Promise<Ticket | null> {
  return getDocument<Ticket>(COLLECTIONS.tickets, ticketId);
}

export async function getTicketByTicketId(ticketId: string): Promise<Ticket | null> {
  const tickets = await getDocuments<Ticket>(COLLECTIONS.tickets, [where("ticketId", "==", ticketId)]);
  return tickets.length > 0 ? tickets[0] : null;
}

export async function getTickets(organizationId?: string, status?: TicketStatus): Promise<Ticket[]> {
  const constraints: QueryConstraint[] = [];
  if (organizationId) {
    constraints.push(where("organizationId", "==", organizationId));
  }
  if (status) {
    constraints.push(where("status", "==", status));
  }
  return getDocuments<Ticket>(COLLECTIONS.tickets, constraints);
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  return updateDocument<Ticket>(COLLECTIONS.tickets, ticketId, { status, updatedAt: new Date() });
}

export async function updateTicket(ticketId: string, data: Partial<Ticket>): Promise<void> {
  return updateDocument<Ticket>(COLLECTIONS.tickets, ticketId, { ...data, updatedAt: new Date() });
}

export async function createTicketUpdate(data: Omit<TicketUpdate, "id" | "createdAt">): Promise<string> {
  return createDocument<TicketUpdate>(COLLECTIONS.ticketUpdates, { ...data, createdAt: new Date() } as TicketUpdate);
}

export async function getTicketUpdates(ticketId: string): Promise<TicketUpdate[]> {
  return getDocuments<TicketUpdate>(COLLECTIONS.ticketUpdates, [where("ticketId", "==", ticketId)]);
}
