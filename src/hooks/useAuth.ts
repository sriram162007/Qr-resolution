import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth, isFirebaseReady } from "@/lib/firebase/auth";
import { login as authLogin, logout as authLogout } from "@/services/auth.service";
import type { UserProfile, AuthState, LoginCredentials } from "@/types";

const FRIENDLY_ERRORS: Record<string, string> = {
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/invalid-credential": "Incorrect email or password. Please try again.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/network-request-failed": "Network error. Please check your connection.",
  "auth/operation-not-allowed": "Email/password sign-in is not enabled. Please contact support.",
};

function getFriendlyError(code: string): string {
  return FRIENDLY_ERRORS[code] || "An unexpected error occurred. Please try again.";
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!isFirebaseReady()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ user: null, loading: false, error: "Application is not configured." });
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth(),
      (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          const userProfile: UserProfile = {
            id: firebaseUser.uid,
            email: firebaseUser.email ?? "",
            displayName: firebaseUser.displayName ?? undefined,
            role: "USER",
            createdAt: new Date(firebaseUser.metadata.creationTime ?? Date.now()),
            updatedAt: new Date(firebaseUser.metadata.lastSignInTime ?? Date.now()),
          };
          setState({ user: userProfile, loading: false, error: null });
        } else {
          setState({ user: null, loading: false, error: null });
        }
      },
      (error) => {
        const code = (error as { code?: string }).code ?? "auth/unknown";
        setState((prev) => ({ ...prev, loading: false, error: getFriendlyError(code) }));
      }
    );

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await authLogin(credentials);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code ?? "auth/unknown";
      setState((prev) => ({ ...prev, loading: false, error: getFriendlyError(code) }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await authLogout();
    } catch (error: unknown) {
      const code = (error as { code?: string }).code ?? "auth/unknown";
      setState((prev) => ({ ...prev, loading: false, error: getFriendlyError(code) }));
      throw error;
    }
  }, []);

  return { ...state, login, logout };
}
