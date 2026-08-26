import { auth } from "@/lib/firebase/auth";
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import type { LoginCredentials } from "@/types";

export async function login(credentials: LoginCredentials) {
  try {
    return await signInWithEmailAndPassword(auth(), credentials.email, credentials.password);
  } catch (error) {
    console.error("[AuthService] Firebase Auth error:", {
      code: (error as { code?: string }).code,
      message: (error as { message?: string }).message,
    });
    throw error;
  }
}

export async function register(email: string, password: string, displayName?: string) {
  const userCredential = await createUserWithEmailAndPassword(auth(), email, password);
  if (displayName) {
    await updateProfile(userCredential.user, { displayName });
  }
  return userCredential.user;
}

export async function logout() {
  return signOut(auth());
}
