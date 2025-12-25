import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ProfileSession } from "../services/profileStore";
import { asSession, getProfile } from "../services/profileStore";

export type CurrentUser = {
  id: string;
  schemaVersion: number;
  profile: ProfileSession | null;
  encryptionKey: CryptoKey | null;
  setCurrentUserId: (id: string) => void;
  setActiveProfile: (session: ProfileSession | null, encryptionKey?: CryptoKey | null) => void;
  refreshProfile: () => Promise<void>;
};

const DEFAULT_USER_ID = "local-default";
const CURRENT_USER_KEY = "moneylith:currentUserId";
const DEFAULT_SCHEMA_VERSION = 1;

const CurrentUserContext = createContext<CurrentUser>({
  id: DEFAULT_USER_ID,
  schemaVersion: DEFAULT_SCHEMA_VERSION,
  profile: null,
  encryptionKey: null,
  setCurrentUserId: () => {},
  setActiveProfile: () => {},
  refreshProfile: async () => {},
});

const buildSessionFromRecord = (record: any) => {
  try {
    return asSession(record);
  } catch {
    return null;
  }
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const readInitialUser = () => {
    if (typeof window === "undefined") return DEFAULT_USER_ID;
    const stored = window.localStorage.getItem(CURRENT_USER_KEY);
    return stored || DEFAULT_USER_ID;
  };

  const [userId, setUserId] = useState<string>(readInitialUser);
  const [profile, setProfile] = useState<ProfileSession | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(CURRENT_USER_KEY, userId);
    } catch {
      /* ignore */
    }
  }, [userId]);

  useEffect(() => {
    if (userId === DEFAULT_USER_ID) {
      setProfile(null);
      setEncryptionKey(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const record = await getProfile(userId);
      if (cancelled) return;
      if (record) {
        const session = buildSessionFromRecord(record);
        setProfile(session);
      } else {
        setProfile(null);
        setUserId(DEFAULT_USER_ID);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setCurrentUserId = (id: string) => {
    const next = id || DEFAULT_USER_ID;
    setUserId(next);
    if (next === DEFAULT_USER_ID) {
      setProfile(null);
      setEncryptionKey(null);
    }
  };

  const setActiveProfile = (session: ProfileSession | null, key?: CryptoKey | null) => {
    if (!session) {
      setCurrentUserId(DEFAULT_USER_ID);
      return;
    }
    setUserId(session.profileId || DEFAULT_USER_ID);
    setProfile(session);
    setEncryptionKey(key ?? null);
  };

  const refreshProfile = async () => {
    if (!userId || userId === DEFAULT_USER_ID) {
      setProfile(null);
      return;
    }
    const record = await getProfile(userId);
    if (record) {
      setProfile(buildSessionFromRecord(record));
    }
  };

  const value = useMemo<CurrentUser>(
    () => ({
      id: userId,
      schemaVersion: DEFAULT_SCHEMA_VERSION,
      profile,
      encryptionKey,
      setCurrentUserId,
      setActiveProfile,
      refreshProfile,
    }),
    [encryptionKey, profile, userId]
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
};

export const useCurrentUser = () => useContext(CurrentUserContext);
export const getDefaultUserId = () => DEFAULT_USER_ID;
export const getCurrentUserStorageKey = () => CURRENT_USER_KEY;
