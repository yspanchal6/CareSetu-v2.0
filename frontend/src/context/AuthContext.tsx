import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { User, UserRole } from "../types";
import { authApi, clearAuthToken, fcmApi, saveAuthToken, SignUpPayload } from "../services/api";
import { requestNotificationPermission } from "../utils/firebase";
import { cacheOfflineProfile, clearOfflineProfile } from "../utils/offlineProfile";

interface AuthContextValue {
  user: User | null;
  isGuest: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  register: (payload: SignUpPayload) => Promise<any>;
  setSession: (user: any, token: string) => Promise<void>;
  startGuestSession: () => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem("caresetu_user");
    return saved ? JSON.parse(saved) : null;
  });

  const isGuest = Boolean(user?.isGuest || user?.role === "guest");
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    const token = localStorage.getItem('jwt');
    if (token && !user) {
      // When offline, trust the cached session instead of calling /api/auth/me
      // which would fail and incorrectly log the user out.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const cached = sessionStorage.getItem("caresetu_user");
        if (cached) {
          try { setUser(JSON.parse(cached)); } catch { /* corrupt cache, ignore */ }
        }
        return;
      }

      authApi.me()
        .then(res => {
          if (res.success && res.user) {
            const roleStr = res.user.role.toLowerCase() as UserRole;
            const appUser: User = {
              id: res.user.id,
              name: res.user.name || (res.user.email ? res.user.email.split("@")[0] : "Guest User"),
              email: res.user.email || "",
              role: roleStr,
              avatarInitials: (res.user.name || res.user.email || "GU").slice(0, 2).toUpperCase(),
              isGuest: Boolean((res.user as any).isGuest || roleStr === "guest"),
            };
            setUser(appUser);
            sessionStorage.setItem("caresetu_user", JSON.stringify(appUser));
            cacheOfflineProfile({ name: appUser.name, email: appUser.email });
          }
        })
        .catch((err: any) => {
          // Only clear auth state on actual server rejection (401/403).
          // Network errors (status 0) while offline should not log the user out.
          if (err?.status === 401 || err?.status === 403) {
            clearAuthToken();
            sessionStorage.removeItem("caresetu_user");
            clearOfflineProfile();
            setUser(null);
          } else {
            // Network error — trust cached session if available
            const cached = sessionStorage.getItem("caresetu_user");
            if (cached) {
              try { setUser(JSON.parse(cached)); } catch { /* ignore */ }
            }
          }
        });
    }
  }, [user]);

  const startGuestSession = async () => {
    const res = await authApi.guestSession();
    if (res.success && res.token) {
      const guestUser: User = {
        id: res.user.id,
        name: "Guest User",
        email: "",
        role: "guest",
        avatarInitials: "GU",
        isGuest: true,
      };
      setUser(guestUser);
      sessionStorage.setItem("caresetu_user", JSON.stringify(guestUser));
      saveAuthToken(res.token);
      return guestUser;
    }
    throw new Error("Failed to start guest session");
  };

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    if (res.success && res.user && res.token) {
      const roleStr = res.user.role.toLowerCase() as UserRole;
      const appUser: User = {
        id: res.user.id,
        name: res.user.name || res.user.email.split("@")[0],
        email: res.user.email,
        role: roleStr,
        avatarInitials: (res.user.name || res.user.email).slice(0, 2).toUpperCase()
      };
      
      setUser(appUser);
      sessionStorage.setItem("caresetu_user", JSON.stringify(appUser));
      saveAuthToken(res.token);

      // Register FCM Token
      try {
        const fcmToken = await requestNotificationPermission();
        if (fcmToken) {
          await fcmApi.registerToken(fcmToken);
          console.log("[FCM] Token registered");
        }
      } catch (e: any) {
        console.warn("[FCM] Registration failed:", e.message);
      }
      
      cacheOfflineProfile({ name: appUser.name, email: appUser.email });
      return appUser;
    }
    throw new Error("Login failed");
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("caresetu_user");
    clearOfflineProfile();
    clearAuthToken();
    authApi.logout();
  };

  const register = async (payload: SignUpPayload) => {
    const res = await authApi.signup(payload);
    if (res.success && res.user && res.token) {
      const roleStr = res.user.role.toLowerCase() as UserRole;
      const appUser: User = {
        id: res.user.id,
        name: res.user.name || res.user.email.split("@")[0],
        email: res.user.email,
        role: roleStr,
        avatarInitials: (res.user.name || res.user.email).slice(0, 2).toUpperCase()
      };
      
      setUser(appUser);
      sessionStorage.setItem("caresetu_user", JSON.stringify(appUser));
      saveAuthToken(res.token);

      // Register FCM Token
      try {
        const fcmToken = await requestNotificationPermission();
        if (fcmToken) {
          await fcmApi.registerToken(fcmToken);
          console.log("[FCM] Token registered");
        }
      } catch (e: any) {
        console.warn("[FCM] Registration failed:", e.message);
      }
      
      cacheOfflineProfile({ name: appUser.name, email: appUser.email });
      return appUser;
    }
    throw new Error("Registration failed");
  };

  const setSession = async (resUser: any, token: string) => {
    const roleStr = resUser.role.toLowerCase() as UserRole;
    const appUser: User = {
      id: resUser.id,
      name: resUser.name || resUser.email.split("@")[0],
      email: resUser.email,
      role: roleStr,
      avatarInitials: (resUser.name || resUser.email).slice(0, 2).toUpperCase()
    };
    
    setUser(appUser);
    sessionStorage.setItem("caresetu_user", JSON.stringify(appUser));
    saveAuthToken(token);

    // Register FCM Token
    try {
      const fcmToken = await requestNotificationPermission();
      if (fcmToken) {
        await fcmApi.registerToken(fcmToken);
        console.log("[FCM] Token registered");
      }
    } catch (e: any) {
      console.warn("[FCM] Registration failed:", e.message);
    }

    cacheOfflineProfile({ name: appUser.name, email: appUser.email });
  };

  return <AuthContext.Provider value={{ user, isGuest, isAuthenticated, login, logout, register, setSession, startGuestSession }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
