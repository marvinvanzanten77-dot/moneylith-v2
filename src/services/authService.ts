import { getDefaultUserId } from "../state/userContext";

export type AuthUser = {
  id: string;
  displayName?: string;
};

export interface AuthService {
  getCurrentUser(): AuthUser;
  signIn(opts?: { username?: string; password?: string }): Promise<AuthUser>;
  signOut(): Promise<void>;
}

// Placeholder/local-first implementatie: geen echte auth, geen netwerk.
export const createAuthService = (): AuthService => {
  const current: AuthUser = { id: getDefaultUserId(), displayName: "Local user" };
  return {
    getCurrentUser: () => current,
    signIn: async () => current,
    signOut: async () => undefined,
  };
};

