import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, query, where, collection, type DocumentData, type Timestamp } from "firebase/firestore";
import type { Location } from "@/types";

const COLLECTION = "locations";

function toDates(data: DocumentData & { createdAt?: Timestamp; updatedAt?: Timestamp }): Location {
  return {
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  } as Location;
}

export async function createLocation(data: Omit<Location, "id" | "createdAt" | "updatedAt">, overrideId?: string): Promise<string> {
  const id = overrideId || doc(collection(db, COLLECTION)).id;
  const ref = doc(db, COLLECTION, id);
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Omit<Location, "id" | "createdAt" | "updatedAt">;
  const payload = {
    ...cleanData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(ref, payload);
    return id;
  } catch (error) {
    console.error("[Location Create] failed", {
      code: (error as { code?: string })?.code,
      message: (error as { message?: string })?.message,
      name: (error as { name?: string })?.name,
    });
    throw error;
  }
}

export async function getLocation(locationId: string): Promise<Location | null> {
  const ref = doc(db, COLLECTION, locationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toDates({ id: snap.id, ...snap.data() });
}

export async function getLocations(organizationId: string): Promise<Location[]> {
  const q = query(collection(db, COLLECTION), where("organizationId", "==", organizationId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toDates({ id: d.id, ...d.data() }));
}

export async function getChildLocations(parentLocationId: string): Promise<Location[]> {
  const q = query(collection(db, COLLECTION), where("parentLocationId", "==", parentLocationId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toDates({ id: d.id, ...d.data() }));
}

export async function updateLocation(locationId: string, data: Partial<Location>): Promise<void> {
  const ref = doc(db, COLLECTION, locationId);
  try {
    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[Location Update] failed", {
      code: (error as { code?: string })?.code,
      message: (error as { message?: string })?.message,
      name: (error as { name?: string })?.name,
    });
    throw error;
  }
}

export async function setLocationActive(locationId: string, isActive: boolean): Promise<void> {
  return updateLocation(locationId, { isActive });
}

export async function deleteLocation(locationId: string): Promise<void> {
  const ref = doc(db, COLLECTION, locationId);
  try {
    await deleteDoc(ref);
  } catch (error) {
    console.error("[Location Delete] failed", {
      code: (error as { code?: string })?.code,
      message: (error as { message?: string })?.message,
      name: (error as { name?: string })?.name,
    });
    throw error;
  }
}
