export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");

// Derive the Socket.IO URL from the configured API URL so realtime stays consistent.
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (API_BASE_URL.startsWith("http")
    ? new URL(API_BASE_URL).origin
    : typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : "http://localhost:3000");

const TOKEN_STORAGE_KEY = "caresetu_auth_token";
const ACTIVE_CASE_STORAGE_KEY = "caresetu_active_emergency_case";

export class ApiError extends Error {
  public readonly status: number;
  public readonly retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  authenticated?: boolean;
};

// Map to deduplicate concurrent identical in-flight GET requests
const inFlightRequests = new Map<string, Promise<any>>();

export function getAuthToken(): string | null {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

function getTokenMetadata(token: string | null) {
  if (!token) return { userId: null, role: null };
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return {
      userId: payload.userId || payload.id || payload.sub || null,
      role: payload.role || (payload.isGuest ? "GUEST" : null),
    };
  } catch {
    return { userId: null, role: null };
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const dedupeKey = isGet ? `${options.authenticated ?? true}:${path}` : null;

  if (dedupeKey && inFlightRequests.has(dedupeKey)) {
    return inFlightRequests.get(dedupeKey) as Promise<T>;
  }

  const executeRequest = async (): Promise<T> => {
    const { body, authenticated = true, headers: providedHeaders, ...requestOptions } = options;
    const headers = new Headers(providedHeaders);

    if (body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const token = getAuthToken();

    if (authenticated && token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (path === "/emergency/sos") {
      const metadata = getTokenMetadata(token);
      console.info("[API Auth Diagnostic]", {
        userId: metadata.userId,
        role: metadata.role,
        requestPath: path,
        hasAuthorizationHeader: headers.has("Authorization"),
        apiBaseUrl: API_BASE_URL,
      });
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...requestOptions,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError("Cannot reach the CareSetu API. Check that the backend is running.", 0);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const retryHeader = response.headers.get("Retry-After");
      const retryAfterSeconds = retryHeader ? parseInt(retryHeader, 10) : payload?.retryAfterSeconds;
      const message = payload?.error ?? payload?.message ?? `Request failed (${response.status})`;
      const err = new ApiError(message, response.status, retryAfterSeconds);
      (err as any).code = payload?.code;
      (err as any).data = payload;
      throw err;
    }

    return payload as T;
  };

  if (dedupeKey) {
    const promise = executeRequest().finally(() => {
      inFlightRequests.delete(dedupeKey);
    });
    inFlightRequests.set(dedupeKey, promise);
    return promise;
  }

  return executeRequest();
}

export type BackendRole = "PATIENT" | "HOSPITAL" | "DOCTOR" | "ADMIN";

export interface AuthResponse {
  success: true;
  token?: string;
  resetToken?: string;
  user?: {
    id: string;
    email: string;
    role: BackendRole | "GUEST" | string;
    name?: string;
    locationSource?: string;
    isVerified?: boolean;
    isProfileComplete?: boolean;
    isGuest?: boolean;
    patient?: any;
    hospital?: any;
  };
  message?: string;
  mock?: boolean;
  isNewUser?: boolean;
  onboardingRoute?: string;
  expiresAt?: string;
  channels?: Array<{ channel: string; status: string; mock?: boolean; error?: string }>;
  devOtp?: string;
}

export interface SignUpPayload {
  name: string;
  email: string;
  password: string;
  role: "PATIENT" | "HOSPITAL" | "DOCTOR";
  phone: string;
  age?: number;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

export interface EmergencyLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source: "GPS";
}

export interface NearbyHospital {
  id: string;
  name: string;
  address: string;
  city?: string;
  phone: string;
  capabilities: string[];
  emergencyAvailable: boolean;
  isVerified?: boolean;
  verificationStatus?: string;
  distanceKm?: number;
  distance?: string;
  location?: { latitude: number; longitude: number };
  lastUpdated?: string;
}

export interface EmergencyCaseStatus {
  id: string;
  caseId: string;
  status: "PENDING" | "MATCHING" | "HOSPITAL_REQUESTED" | "ACCEPTED" | "TRANSFER" | "TREATMENT" | "IN_PROGRESS" | "CLOSED" | "CANCELLED";
  stage?: string;
  symptoms: string;
  severity?: string;
  emergencyType?: string;
  location?: { latitude: number; longitude: number } | null;
  createdAt?: string;
  acceptedAt?: string | null;
  closedAt?: string | null;
  hospital?: { id: string; name: string; address: string; phone: string } | null;
  attempts?: any[];
}

export type EmergencyAttemptStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";

export interface EmergencyAttempt {
  hospital: {
    id: string;
    name: string;
    address: string;
    phone: string;
    distanceKm?: number | null;
    capabilities?: string[];
  };
  status: EmergencyAttemptStatus;
  distanceKm?: number | null;
  requestedAt: string;
  respondedAt?: string | null;
  rejectionReason?: string | null;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      authenticated: false,
      body: { email: email.trim().toLowerCase(), password },
    }),
  googleAuth: (credential: string, role?: string, isRegistration?: boolean, profileData?: Record<string, any>) =>
    request<AuthResponse & { isNewUser?: boolean; code?: string }>("/auth/google", {
      method: "POST",
      authenticated: false,
      body: { credential, role, isRegistration, profileData },
    }),
  guestSession: () =>
    request<{ success: true; token: string; expiresAt: string; user: { id: string; name: string; role: BackendRole | "GUEST"; isGuest: true }; message: string }>("/auth/guest-session", {
      method: "POST",
      authenticated: false,
    }),
  signup: (payload: SignUpPayload) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      authenticated: false,
      body: { ...payload, email: payload.email.trim().toLowerCase() },
    }),
  requestOtp: (target: string | { identifier: string; phone?: string; email?: string; type?: string; purpose?: string }, type: string = "email") =>
    request<{ success: true; message: string; expiresAt: string; channels: Array<{ channel: string; status: string }>; devOtp?: string; mock?: boolean }>("/auth/request-otp", {
      method: "POST",
      authenticated: false,
      body: typeof target === "string" ? { identifier: target, type } : target,
    }),
  verifyOtp: (target: string | { identifier: string; otpCode: string; type?: string; purpose?: string }, otpCode?: string, type: string = "email") =>
    request<AuthResponse>("/auth/verify-otp", {
      method: "POST",
      authenticated: false,
      body: typeof target === "string" ? { identifier: target, otpCode, type } : target,
    }),
  cancelRegistration: (identifier: string) =>
    request<{ success: boolean; message?: string }>("/auth/cancel-registration", {
      method: "POST",
      authenticated: false,
      body: { identifier },
    }),
  forgotPassword: (target: string | { email?: string; phone?: string }) => {
    let body: { email?: string; phone?: string } = {};
    if (typeof target === "string") {
      if (target.includes("@")) {
        body = { email: target.trim().toLowerCase() };
      } else {
        body = { phone: target.trim() };
      }
    } else {
      if (target.email) body.email = target.email.trim().toLowerCase();
      if (target.phone) body.phone = target.phone.trim();
    }
    return request<{ success: true; message: string; devEmailOtp?: string; devPhoneOtp?: string; devOtp?: string }>("/auth/forgot-password", {
      method: "POST",
      authenticated: false,
      body,
    });
  },
  verifyResetPhoneOtp: (email: string, phone: string, otpCode: string) =>
    request<{ success: true; resetToken: string; message: string }>("/auth/verify-reset-phone-otp", {
      method: "POST",
      authenticated: false,
      body: { email: email.trim().toLowerCase(), phone, otpCode },
    }),
  cancelForgotPassword: (email?: string, phone?: string) =>
    request<{ success: boolean; message?: string }>("/auth/cancel-forgot-password", {
      method: "POST",
      authenticated: false,
      body: { email: email ? email.trim().toLowerCase() : undefined, phone },
    }),
  resetPassword: (
    target: string | { email: string; resetToken?: string; otp?: string; newPassword: string; confirmPassword?: string },
    otpOrPassword?: string,
    newPasswordParam?: string,
    confirmPasswordParam?: string
  ) => {
    let body: any;
    if (typeof target === "string") {
      body = { email: target.trim().toLowerCase(), otp: otpOrPassword, newPassword: newPasswordParam, confirmPassword: confirmPasswordParam };
    } else {
      body = {
        email: target.email.trim().toLowerCase(),
        resetToken: target.resetToken,
        otp: target.otp,
        newPassword: target.newPassword,
        confirmPassword: target.confirmPassword,
      };
    }
    return request<{ success: true; message: string }>("/auth/reset-password", {
      method: "POST",
      authenticated: false,
      body,
    });
  },
  me: () =>
    request<{ success: true; user: AuthResponse["user"] }>("/auth/me", {
      method: "GET",
    }),
  logout: () => {
    clearAuthToken();
    return Promise.resolve();
  },
};

export const emergencyApi = {
  create: (payload: { symptoms: string; location: EmergencyLocation; idempotencyKey?: string; emergencyType?: string; source?: string }) => {
    const { latitude, longitude } = payload.location;
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      return Promise.reject(new ApiError("Unable to get your live location. Please allow location access and try again.", 400));
    }

    const requestPayload = {
      symptoms: payload.symptoms,
      latitude,
      longitude,
      idempotencyKey: payload.idempotencyKey,
      emergencyType: payload.emergencyType,
      source: payload.source,
    };

    console.log("SOS payload:", requestPayload);

    return request<{ success: true; caseId: string; publicCaseId: string; message: string; nearestHospitals?: NearbyHospital[] }>("/emergency/sos", {
      method: "POST",
      body: requestPayload,
    });
  },
  status: (caseId: string) =>
    request<{ success: true; case: EmergencyCaseStatus }>(`/emergency/status/${caseId}`),
  attempts: (caseId: string) =>
    request<{ success: true; attempts: EmergencyAttempt[] }>(`/emergency/attempts/${caseId}`),
  cancel: (caseId: string) =>
    request<{ success: true; message: string }>(`/emergency/cancel/${caseId}`, {
      method: "POST",
    }),
  updateStatus: (caseId: string, status: string) =>
    request<{ success: true; message: string; emergencyCase: any }>(`/emergency/update-status/${caseId}`, {
      method: "PUT",
      body: { status },
    }),
  getMyCases: () =>
    request<{ success: true; cases: any[] }>("/emergency/my-history", { method: "GET" }),


};

/**
 * Shared client used by the Offline Sync Engine (offlineSync.ts) to replay a
 * queued SOS. It wraps emergencyApi.create so the exact same idempotency key
 * (the queue operationId) is reused on every retry: the backend either creates
 * the case or returns the already-created one.
 */
export function emergencySyncClient(_endpoint: string, requestPayload: any) {
  return emergencyApi.create({
    symptoms: requestPayload.symptoms,
    emergencyType: requestPayload.emergencyType,
    location: {
      latitude: requestPayload.latitude,
      longitude: requestPayload.longitude,
      source: "GPS" as const,
    },
    idempotencyKey: requestPayload.idempotencyKey,
  });
}

export const hospitalApi = {
  nearby: (latitude: number, longitude: number, radius?: number) => {
    const radiusParam = radius ? `&radius=${radius}` : '';
    return request<{ success: true; hospitals: NearbyHospital[]; count?: number; searchRadiusKm?: number }>(`/hospitals/nearby?lat=${latitude}&lng=${longitude}${radiusParam}`);
  },
  getEmergencyCases: () =>
    request<{ success: true; cases: any[] }>(`/hospitals/cases`),
  acceptCase: (caseId: string) =>
    request<{ success: true }>(`/emergency/accept/${caseId}`, { method: "POST" }),
  rejectCase: (caseId: string, reason?: string) =>
    request<{ success: true }>(`/emergency/reject/${caseId}`, { method: "POST", body: { reason } }),
  pendingCases: (latitude?: number, longitude?: number) => {
    const url = (latitude && longitude)
      ? `/emergency/pending?latitude=${latitude}&longitude=${longitude}`
      : `/emergency/pending`;
    return request<{ success: true; cases: any[] }>(url);
  },
  getStats: () =>
    request<{ success: true; stats: any }>("/hospitals/stats"),
  getCapacity: () =>
    request<{ success: true; capacity: any }>("/hospitals/capacity"),
  updateCapacity: (payload: any) =>
    request<{ success: true; message: string; capacity: any }>("/hospitals/capacity", { method: "PUT", body: payload }),
  getPatients: (search?: string, page: number = 1) =>
    request<{ success: true; patients: any[] }>(`/hospitals/patients?search=${encodeURIComponent(search || "")}&page=${page}`),
  getNotifications: () =>
    request<{ success: true; notifications: any[] }>("/hospitals/notifications"),
  markNotificationRead: (id: string) =>
    request<{ success: true }>(`/hospitals/notifications/${id}/read`, { method: "PUT" }),
  getReports: () =>
    request<{ success: true; reports: any }>("/hospitals/reports"),
  getProfile: () =>
    request<{ success: true; hospital: any }>("/hospitals/profile"),
  updateProfile: (payload: any) =>
    request<{ success: boolean; message?: string; hospital?: any; user?: any; error?: string }>("/hospitals/profile", { method: "PUT", body: payload }),
  submitOnboarding: (payload: any) =>
    request<{ success: boolean; message: string; hospital?: any; user?: any; error?: string }>("/hospitals/submit-onboarding", { method: "POST", body: payload }),
  getDiagnostics: () =>
    request<{ success: true; diagnostics: any }>("/hospitals/diagnostics"),
  getApprovalEvent: () =>
    request<{ success: true; hasUnseenApproval: boolean; eventId?: string; message?: string }>("/hospitals/approval-event"),
  consumeApprovalEvent: (eventId: string) =>
    request<{ success: true; message: string }>("/hospitals/approval-event/consume", { method: "POST", body: { eventId } }),
  getStaff: () =>
    request<{ success: true; staff: any[] }>("/hospitals/staff"),
  getSettings: () =>
    request<{ success: true; settings: any }>("/hospitals/settings"),
  updateSettings: (payload: any) =>
    request<{ success: true }>("/hospitals/settings", { method: "PUT", body: payload }),
  getHealthPack: (caseId: string) =>
    request<{ success: true; data: any }>(`/health-pack/case/${caseId}`),
  getSharedPack: (packId: string) =>
    request<{ success: true; data: any }>(`/health-pack/shared/${packId}`),
};

export const patientApi = {
  getProfile: () =>
    request<{ success: boolean; patient: any }>("/patient/profile").catch(() => request<{ success: boolean; patient: any }>("/auth/me")),
  updateProfile: (payload: any) =>
    request<{ success: boolean; patient?: any; user?: any; error?: string }>("/patient/profile", { method: "PUT", body: payload }).catch(() => request<{ success: boolean; patient?: any; user?: any; error?: string }>("/auth/me", { method: "PUT", body: payload })),
};

export const systemApi = {
  health: () => request<{ status: "ok"; timestamp: string }>("/health", { authenticated: false }),
};

export interface ChatSendResult {
  success: true;
  conversationId: string;
  isEmergency: boolean;
  reply?: string | null;
  source?: string;
  severity?: string;
  riskLevel?: string;
  safetyDecision?: string;
  detectedWords?: string[];
  emergencySignals?: string[];
  redirectSos?: boolean;
  message?: string;
}

export const chatApi = {
  send: (message: string, conversationId?: string) =>
    request<ChatSendResult>("/chat/send", {
      method: "POST",
      body: { message, conversationId },
    }),
  conversations: () =>
    request<{ success: true; conversations: any[] }>("/chat/conversations", { method: "GET" }),
  conversation: (id: string) =>
    request<{ success: true; conversation: any }>(`/chat/conversations/${id}`, { method: "GET" }),
};

export const fcmApi = {
  registerToken: (token: string, platform: string = "WEB") =>
    request<{ success: true }>("/fcm/token", {
      method: "POST",
      body: { token, platform },
    }),
};

export const medicalDocumentApi = {
  upload: (file: File, documentType: string = "OTHER") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);
    const token = getAuthToken();
    return fetch(`${API_BASE_URL}/patient/documents`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }).then(res => res.json());
  },
  getMyDocuments: () =>
    request<{ success: true; data: any[] }>("/patient/documents/my-documents"),
  delete: (documentId: string) =>
    request<{ success: true; message: string }>(`/patient/documents/${documentId}`, { method: "DELETE" }),
};

export const healthPackApi = {
  create: (healthData: any) =>
    request<{ success: true; message: string; data: any }>("/health-pack", {
      method: "POST",
      body: { healthData },
    }),
  getMyPack: () =>
    request<{ success: true; data: any }>("/health-pack/my-pack"),
  getCasePack: (caseId: string) =>
    request<{ success: true; data: any }>(`/health-pack/case/${caseId}`),
  share: (caseId: string, hospitalId: string) =>
    request<{ success: true; message: string }>("/health-pack/share", {
      method: "POST",
      body: { caseId, hospitalId },
    }),
};

export const settingsApi = {
  getProfile: () =>
    request<{ success: true; data: any; profile: any }>("/settings/profile"),
  updateProfile: (payload: any) =>
    request<{ success: true; message: string; data: any }>("/settings/profile", {
      method: "PATCH",
      body: payload,
    }),
  updatePassword: async (currentPassword: string, newPassword: string, confirmPassword?: string) => {
    const res = await request<{ success: true; message: string; token?: string }>("/settings/password", {
      method: "PATCH",
      body: { currentPassword, newPassword, confirmPassword },
    });
    if (res.token) {
      saveAuthToken(res.token);
    }
    return res;
  },
  updateNotifications: (preferences: any) =>
    request<{ success: true; message: string; preferences: any }>("/settings/notifications", {
      method: "PATCH",
      body: preferences,
    }),
  requestCredentialChange: (type: "EMAIL" | "MOBILE", newValue: string, currentPassword?: string) =>
    request<{ success: true; message: string; requestId: string; expiresAt: string; maskedDestination: string; devOtp?: string }>("/settings/credentials/request-change", {
      method: "POST",
      body: { type, newValue, currentPassword },
    }),
  verifyCredentialOtp: (requestId: string, otp: string, type?: "EMAIL" | "MOBILE") =>
    request<{ success: true; message: string; type: string; newValue: string }>("/settings/credentials/verify-otp", {
      method: "POST",
      body: { requestId, otp, type },
    }),
  cancelCredentialChange: (requestId?: string, type?: "EMAIL" | "MOBILE") =>
    request<{ success: true; message: string }>("/settings/credentials/cancel-change", {
      method: "POST",
      body: { requestId, type },
    }),
};

export const adminApi = {
  getStats: () =>
    request<{ success: true; stats: any }>("/admin/dashboard/stats"),
  getUsers: (search?: string, role?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (role) params.append("role", role);
    if (status) params.append("status", status);
    return request<{ success: true; users: any[] }>(`/admin/users?${params.toString()}`);
  },
  getHospitals: (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    return request<{ success: true; hospitals: any[] }>(`/admin/hospitals?${params.toString()}`);
  },
  getPatients: (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    return request<{ success: true; patients: any[] }>(`/admin/patients?${params.toString()}`);
  },
  blockAccount: (targetUserId: string, reason: string, expiresAt?: string) =>
    request<{ success: true; message: string; restriction: any }>("/admin/blocklist", {
      method: "POST",
      body: { targetUserId, reason, expiresAt },
    }),
  unblockAccount: (targetUserId: string, reason?: string) =>
    request<{ success: true; message: string }>("/admin/blocklist/unblock", {
      method: "POST",
      body: { targetUserId, reason },
    }),
  getBlocklistHistory: (targetUserId?: string) => {
    const query = targetUserId ? `?targetUserId=${targetUserId}` : "";
    return request<{ success: true; history: any[] }>(`/admin/blocklist/history${query}`);
  },
  getAuditLogs: () =>
    request<{ success: true; logs: any[] }>("/admin/audit-logs"),
  getHospitalVerificationRequests: (status?: string, search?: string) => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (search) params.append("search", search);
    return request<{ success: true; count: number; requests: any[] }>(`/admin/hospitals/verification-requests?${params.toString()}`);
  },
  approveHospital: (id: string) =>
    request<{ success: true; message: string; hospital: any; verificationStatus: string }>(`/admin/hospitals/${id}/approve`, {
      method: "POST",
    }),
  rejectHospital: (id: string, reason: string) =>
    request<{ success: true; message: string; hospital: any; verificationStatus: string }>(`/admin/hospitals/${id}/reject`, {
      method: "POST",
      body: { reason },
    }),
};

export interface DocumentVerificationStatus {
  success: boolean;
  user: any;
  role: "PATIENT" | "DOCTOR" | "HOSPITAL" | "ADMIN";
  isVerified: boolean;
  verificationStatus?: string;
  hospitalStatus?: string;
  requiredDocuments: { type: string; label: string }[];
  uploadedDocuments: {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    documentType: string;
    createdAt: string;
  }[];
  hasAllRequiredDocs: boolean;
  missingDocTypes: string[];
  maskedEmail: string;
  maskedPhone: string;
  hasPhone: boolean;
}

export const documentVerificationApi = {
  getStatus: () =>
    request<DocumentVerificationStatus>("/auth/document-verification/status"),
  uploadDocument: async (file: File, documentType: string) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/auth/document-verification/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || "Failed to upload document.");
    }
    return data as { success: boolean; message: string; document: any };
  },
  deleteDocument: (documentId: string) =>
    request<{ success: boolean; message: string }>(`/auth/document-verification/document/${documentId}`, {
      method: "DELETE",
    }),
  requestOtp: (method: "EMAIL" | "SMS", confirmChecklist: boolean) =>
    request<{
      success: boolean;
      message: string;
      maskedDestination: string;
      method: "EMAIL" | "SMS";
      expiresAt: number;
      cooldownSeconds: number;
      devOtp?: string;
    }>("/auth/document-verification/request-otp", {
      method: "POST",
      body: { method, confirmChecklist },
    }),
  verifyOtp: (otp: string, method: "EMAIL" | "SMS") =>
    request<{
      success: boolean;
      message: string;
      isVerified: boolean;
      user: any;
      redirectUrl: string;
    }>("/auth/document-verification/verify-otp", {
      method: "POST",
      body: { otp, method },
    }),
  cancelOtp: () =>
    request<{ success: boolean; message: string }>("/auth/document-verification/cancel", {
      method: "POST",
    }),
  skipVerification: () =>
    request<{
      success: boolean;
      message: string;
      isVerified: boolean;
      verificationStatus: string;
      user: any;
      redirectUrl: string;
    }>("/auth/document-verification/skip", {
      method: "POST",
    }),
};

export const geocodingApi = {
  geocode: (address: string, city: string, state: string, pincode: string) => {
    const params = new URLSearchParams();
    if (address) params.append("address", address);
    if (city) params.append("city", city);
    if (state) params.append("state", state);
    if (pincode) params.append("pincode", pincode);
    return request<{ success: boolean; latitude: number; longitude: number; source: string; verified?: boolean }>(`/geocoding/geocode?${params.toString()}`);
  },
  reverseGeocode: (lat: number, lng: number) => {
    return request<{ success: boolean; address: string; city: string; state: string; pincode: string; latitude: number; longitude: number }>(`/geocoding/reverse?lat=${lat}&lng=${lng}`);
  },
};


export function saveAuthToken(token: string) {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.removeItem("jwt");
}


export function clearAuthToken() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(ACTIVE_CASE_STORAGE_KEY);
  localStorage.removeItem("jwt");
}

export function saveActiveEmergencyCase(caseId: string) {
  sessionStorage.setItem(ACTIVE_CASE_STORAGE_KEY, caseId);
}

export function getActiveEmergencyCase() {
  return sessionStorage.getItem(ACTIVE_CASE_STORAGE_KEY);
}
