import { createDocument, getDocument, getDocuments, updateDocument, deleteDocument, COLLECTIONS } from "@/services/firestore.service";
import { where, type QueryConstraint } from "firebase/firestore";
import type { Location } from "@/types";

export async function createLocation(data: Omit<Location, "id" | "createdAt" | "updatedAt">): Promise<string> {
  return createDocument<Location>(COLLECTIONS.locations, data as Location);
}

export async function getLocation(locationId: string): Promise<Location | null> {
  return getDocument<Location>(COLLECTIONS.locations, locationId);
}

export async function getLocations(organizationId?: string): Promise<Location[]> {
  const constraints: QueryConstraint[] = [];
  if (organizationId) {
    constraints.push(where("organizationId", "==", organizationId));
  }
  return getDocuments<Location>(COLLECTIONS.locations, constraints);
}

export async function getChildLocations(parentLocationId: string): Promise<Location[]> {
  return getDocuments<Location>(COLLECTIONS.locations, [where("parentLocationId", "==", parentLocationId)]);
}

export async function updateLocation(locationId: string, data: Partial<Location>): Promise<void> {
  return updateDocument<Location>(COLLECTIONS.locations, locationId, data);
}

export async function deleteLocation(locationId: string): Promise<void> {
  return deleteDocument(COLLECTIONS.locations, locationId);
}
