import { db } from "@/lib/firebase/firestore";
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, type QueryConstraint } from "firebase/firestore";

const COLLECTIONS = {
  users: "users",
  organizations: "organizations",
  locations: "locations",
  qrCodes: "qr_codes",
  tickets: "tickets",
  ticketUpdates: "ticket_updates",
  assignments: "assignments",
  notifications: "notifications",
  feedback: "feedback",
} as const;

type CollectionKey = keyof typeof COLLECTIONS;
type CollectionPath = (typeof COLLECTIONS)[CollectionKey];

export { COLLECTIONS };

export async function getDocument<T>(collectionName: CollectionPath, documentId: string): Promise<T | null> {
  const docRef = doc(db(), collectionName, documentId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as T;
}

export async function getDocuments<T>(collectionName: CollectionPath, constraints: QueryConstraint[] = []): Promise<T[]> {
  const q = query(collection(db(), collectionName), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
}

export async function createDocument<T>(collectionName: CollectionPath, data: T, documentId?: string): Promise<string> {
  const id = documentId ?? crypto.randomUUID();
  const docRef = doc(db(), collectionName, id);
  await setDoc(docRef, { ...data, id } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  return id;
}

export async function updateDocument<T>(collectionName: CollectionPath, documentId: string, data: Partial<T>): Promise<void> {
  const docRef = doc(db(), collectionName, documentId);
  await updateDoc(docRef, data as any); // eslint-disable-line @typescript-eslint/no-explicit-any
}

export async function deleteDocument(collectionName: CollectionPath, documentId: string): Promise<void> {
  const docRef = doc(db(), collectionName, documentId);
  await deleteDoc(docRef);
}
