import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, type DocumentData, type Timestamp } from "firebase/firestore";
import type { Organization } from "@/types";

const COLLECTION = "organizations";

function toDates(data: DocumentData & { createdAt?: Timestamp; updatedAt?: Timestamp }): Organization {
  return {
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  } as Organization;
}

export async function createOrganization(data: Omit<Organization, "id" | "createdAt" | "updatedAt">, organizationId = "default"): Promise<string> {
  const ref = doc(db, COLLECTION, organizationId);
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Omit<Organization, "id" | "createdAt" | "updatedAt">;
  const payload = {
    ...cleanData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(ref, payload);
    return organizationId;
  } catch (error) {
    console.error("[Organization Create] failed", {
      code: (error as { code?: string })?.code,
      message: (error as { message?: string })?.message,
      name: (error as { name?: string })?.name,
    });
    throw error;
  }
}

export async function getOrganization(organizationId: string): Promise<Organization | null> {
  const ref = doc(db, COLLECTION, organizationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toDates({ id: snap.id, ...snap.data() });
}

export async function updateOrganization(organizationId: string, data: Partial<Organization>): Promise<void> {
  const ref = doc(db, COLLECTION, organizationId);
  try {
    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[Organization Update] failed", {
      code: (error as { code?: string })?.code,
      message: (error as { message?: string })?.message,
      name: (error as { name?: string })?.name,
    });
    throw error;
  }
}

export async function setOrganizationActive(organizationId: string, isActive: boolean): Promise<void> {
  return updateOrganization(organizationId, { isActive });
}
