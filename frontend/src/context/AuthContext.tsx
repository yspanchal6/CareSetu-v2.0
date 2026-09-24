import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { User, UserRole } from "../types";
import { authApi, clearAuthToken, fcmApi, getAuthToken, saveAuthToken, SignUpPayload } from "../services/api";
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
  updateUser: (updatedData: any) => void;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem("caresetu_user");
    return saved && getAuthToken() ? JSON.parse(saved) : null;
  });

  const isGuest = Boolean(user?.isGuest || user?.role === "guest");
  const isAuthenticated = Boolean(user);

  const refreshUser = async (): Promise<User | null> => {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const res = await authApi.me();
      if (res.success && res.user) {
        const roleStr = res.user.role.toLowerCase() as UserRole;
        const appUser: User = {
          id: res.user.id,
          name: res.user.name || (res.user.email ? res.user.email.split("@")[0] : "User"),
          email: res.user.email || "",
          role: roleStr,
          avatarInitials: (res.user.name || res.user.email || "US").slice(0, 2).toUpperCase(),
          isGuest: Boolean((res.user as any).isGuest || roleStr === "guest"),
          isVerified: Boolean(res.user.isVerified),
          isProfileComplete: Boolean(res.user.isProfileComplete || res.user.isVerified),
          patient: res.user.patient || user?.patient,
        };
        setUser(appUser);
        sessionStorage.setItem("caresetu_user", JSON.stringify(appUser));
        cacheOfflineProfile({ name: appUser.name, email: appUser.email });
        return appUser;
      }
    } catch (err: any) {
      console.warn("[AuthContext] refreshUser failed:", err?.message || err);
    }
    return user;
  };

  const updateUser = (updatedData: any) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updatedUser: User = {
        ...prev,
        ...updatedData,
        isVerified: updatedData?.isVerified ?? updatedData?.isProfileComplete ?? prev.isVerified,
        isProfileComplete: updatedData?.isProfileComplete ?? updatedData?.isVerified ?? prev.isProfileComplete,
        patient: updatedData?.patient ? { ...prev.patient, ...updatedData.patient } : prev.patient,
      };
      sessionStorage.setItem("caresetu_user", JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  useEffect(() => {
    const token = getAuthToken();
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
              isVerified: Boolean(res.user.isVerified),
              isProfileComplete: Boolean(res.user.isProfileComplete || res.user.isVerified),
              patient: res.user.patient,
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
        avatarInitials: (res.user.name || res.user.email).slice(0, 2).toUpperCase(),
        isVerified: Boolean(res.user.isVerified),
        isProfileComplete: Boolean(res.user.isProfileComplete || res.user.isVerified),
        patient: res.user.patient,
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
        avatarInitials: (res.user.name || res.user.email).slice(0, 2).toUpperCase(),
        isVerified: Boolean(res.user.isVerified),
        isProfileComplete: Boolean(res.user.isProfileComplete || res.user.isVerified),
        patient: res.user.patient,
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
    const roleStr = (resUser.role || "patient").toLowerCase() as UserRole;
    const appUser: User = {
      id: resUser.id,
      name: resUser.name || (resUser.email ? resUser.email.split("@")[0] : "User"),
      email: resUser.email || "",
      role: roleStr,
      avatarInitials: (resUser.name || resUser.email || "US").slice(0, 2).toUpperCase(),
      isVerified: Boolean(resUser.isVerified),
      isProfileComplete: Boolean(resUser.isProfileComplete || resUser.isVerified),
      patient: resUser.patient,
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

  return (
    <AuthContext.Provider value={{ user, isGuest, isAuthenticated, login, logout, register, setSession, startGuestSession, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
