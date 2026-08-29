import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, query, where, collection, type DocumentData, type Timestamp } from "firebase/firestore";
import type { QRCode } from "@/types";

const COLLECTION = "qr_codes";

function toDates(data: DocumentData & { createdAt?: Timestamp; updatedAt?: Timestamp }): QRCode {
  return {
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  } as QRCode;
}

export async function createQRCode(data: Omit<QRCode, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const id = data.qrId;
  const ref = doc(db, COLLECTION, id);
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Omit<QRCode, "id" | "createdAt" | "updatedAt">;
  const payload = {
    ...cleanData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(ref, payload);
    return id;
  } catch (error) {
    console.error("[QR Create] failed", {
      code: (error as { code?: string })?.code,
      message: (error as { message?: string })?.message,
      name: (error as { name?: string })?.name,
    });
    throw error;
  }
}

export async function getQRCode(qrId: string): Promise<QRCode | null> {
  const ref = doc(db, COLLECTION, qrId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const raw = { id: snap.id, ...snap.data() };
  return toDates(raw);
}

export async function getQRCodes(organizationId: string): Promise<QRCode[]> {
  const q = query(collection(db, COLLECTION), where("organizationId", "==", organizationId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toDates({ id: d.id, ...d.data() }));
}

export async function updateQRCode(qrId: string, data: Partial<QRCode>): Promise<void> {
  const ref = doc(db, COLLECTION, qrId);
  try {
    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[QR Update] failed", {
      code: (error as { code?: string })?.code,
      message: (error as { message?: string })?.message,
      name: (error as { name?: string })?.name,
    });
    throw error;
  }
}

export async function setQRCodeActive(qrId: string, isActive: boolean): Promise<void> {
  return updateQRCode(qrId, { isActive });
}

export async function deleteQRCode(qrId: string): Promise<void> {
  const ref = doc(db, COLLECTION, qrId);
  try {
    await deleteDoc(ref);
  } catch (error) {
    console.error("[QR Delete] failed", {
      code: (error as { code?: string })?.code,
      message: (error as { message?: string })?.message,
      name: (error as { name?: string })?.name,
    });
    throw error;
  }
}
