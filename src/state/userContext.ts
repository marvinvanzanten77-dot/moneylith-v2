import React, { createContext, useContext, useMemo, useState } from "react";

export type CurrentUser = {
  id: string;
  schemaVersion: number;
};

const DEFAULT_USER_ID = "local-default";
const DEFAULT_SCHEMA_VERSION = 1;

const CurrentUserContext = createContext<CurrentUser>({ id: DEFAULT_USER_ID, schemaVersion: DEFAULT_SCHEMA_VERSION });

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  // Voorbereiding op echte login; nu altijd dezelfde local-first gebruiker.
  const [userId] = useState<string>(DEFAULT_USER_ID);
  const value = useMemo<CurrentUser>(() => ({ id: userId, schemaVersion: DEFAULT_SCHEMA_VERSION }), [userId]);
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
};

export const useCurrentUser = () => useContext(CurrentUserContext);
export const getDefaultUserId = () => DEFAULT_USER_ID;

