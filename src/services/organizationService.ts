import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, type DocumentData, type Timestamp } from "firebase/firestore";
import type { Organization } from "@/types";
import { auth } from "@/lib/firebase";

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
  console.log("[Firestore Debug] before write", {
    uid: auth.currentUser?.uid ?? null,
    email: auth.currentUser?.email ?? null,
    authenticated: !!auth.currentUser,
    path: `organizations/${organizationId}`,
    dataKeys: Object.keys(payload),
    hasUndefined: Object.values(payload).some(v => v === undefined)
  });
  console.log("[Organization Create] before setDoc");
  try {
    await setDoc(ref, payload);
    console.log("[Organization Create] after setDoc");
    console.log("[Organization Create] service returning", { organizationId });
    return organizationId;
  } catch (err) {
    console.error("[Organization Create] WRITE FAILED", {
      code: (err as { code?: string })?.code,
      message: (err as { message?: string })?.message,
      name: (err as { name?: string })?.name,
    });
    throw err;
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
  console.log("[Firestore Debug] before write", {
    uid: auth.currentUser?.uid ?? null,
    email: auth.currentUser?.email ?? null,
    authenticated: !!auth.currentUser,
    path: `organizations/${organizationId}`
  });
  try {
    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    console.log("[Organization Update] WRITE SUCCESS");
  } catch (err) {
    console.error("[Organization Update] WRITE FAILED", {
      code: (err as { code?: string })?.code,
      message: (err as { message?: string })?.message,
      name: (err as { name?: string })?.name,
    });
    throw err;
  }
}

export async function setOrganizationActive(organizationId: string, isActive: boolean): Promise<void> {
  return updateOrganization(organizationId, { isActive });
}
