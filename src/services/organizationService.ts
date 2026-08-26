import { createDocument, getDocument, getDocuments, updateDocument, COLLECTIONS } from "@/services/firestore.service";
import type { Organization } from "@/types";

export async function createOrganization(data: Omit<Organization, "id" | "createdAt" | "updatedAt">): Promise<string> {
  return createDocument<Organization>(COLLECTIONS.organizations, data as Organization);
}

export async function getOrganization(organizationId: string): Promise<Organization | null> {
  return getDocument<Organization>(COLLECTIONS.organizations, organizationId);
}

export async function getOrganizations(): Promise<Organization[]> {
  return getDocuments<Organization>(COLLECTIONS.organizations);
}

export async function updateOrganization(organizationId: string, data: Partial<Organization>): Promise<void> {
  return updateDocument<Organization>(COLLECTIONS.organizations, organizationId, data);
}
