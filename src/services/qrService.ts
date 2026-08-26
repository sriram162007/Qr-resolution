import { createDocument, getDocument, getDocuments, updateDocument, COLLECTIONS } from "@/services/firestore.service";
import { where, type QueryConstraint } from "firebase/firestore";
import type { QRCode } from "@/types";

export async function createQRCode(data: Omit<QRCode, "id" | "createdAt" | "updatedAt">): Promise<string> {
  return createDocument<QRCode>(COLLECTIONS.qrCodes, data as QRCode);
}

export async function getQRCode(qrId: string): Promise<QRCode | null> {
  return getDocument<QRCode>(COLLECTIONS.qrCodes, qrId);
}

export async function getQRCodes(organizationId?: string): Promise<QRCode[]> {
  const constraints: QueryConstraint[] = organizationId ? [where("organizationId", "==", organizationId)] : [];
  return getDocuments<QRCode>(COLLECTIONS.qrCodes, constraints);
}

export async function updateQRCodeStatus(qrId: string, status: "ACTIVE" | "INACTIVE"): Promise<void> {
  return updateDocument<QRCode>(COLLECTIONS.qrCodes, qrId, { status, updatedAt: new Date() });
}

export async function updateQRCode(qrId: string, data: Partial<QRCode>): Promise<void> {
  return updateDocument<QRCode>(COLLECTIONS.qrCodes, qrId, data);
}
