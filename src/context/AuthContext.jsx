import { createContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

export const AuthContext = createContext({
  user: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
  updateUser: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const payload = await api.get("/auth/me");
      setUser(payload.user);
      return payload.user;
    } catch {
      try {
        const refreshed = await api.post("/auth/refresh");
        setUser(refreshed.user);
        return refreshed.user;
      } catch {
        setUser(null);
        return null;
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshUser();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      async login(credentials) {
        const payload = await api.post("/auth/login", credentials);
        setUser(payload.user);
        return payload.user;
      },
      async register(nextUser) {
        const payload = await api.post("/auth/register", nextUser);
        setUser(payload.user);
        return payload.user;
      },
      async logout() {
        await api.post("/auth/logout");
        setUser(null);
      },
      refreshUser,
      async updateUser(nextValues) {
        const payload = await api.patch("/profile", nextValues);
        setUser(payload.user);
        return payload.user;
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
