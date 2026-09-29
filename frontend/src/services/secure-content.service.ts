import { getAuthToken } from './api';

export interface SecureContentOptions {
  caseId?: string;
  documentId?: string;
  healthPackId?: string;
  hospitalName?: string;
  expiresAt?: string;
  userEmail?: string;
}

export interface CaptureViolationResult {
  allowed: boolean;
  attemptNumber: number;
  remainingAttempts: number;
  action: 'WARNING' | 'FINAL_WARNING' | 'TEMPORARY_BLOCK';
  message: string;
  status: string;
  deduplicated?: boolean;
  serverError?: boolean;
}

export interface HospitalSecurityStatusResponse {
  hospitalId?: string;
  status: 'ACTIVE' | 'WARNING' | 'TEMPORARILY_BLOCKED' | 'UNDER_REVIEW';
  violationCount: number;
  currentViolationCount?: number;
  historicalViolationCount?: number;
  securityEpoch?: number;
  blockedAt?: string | null;
  blockReason?: string | null;
  appeals?: any[];
}

export class SecureContentService {
  private static isSecureActive = false;
  private static captureCallbacks: Set<(event: { eventType: string; result?: CaptureViolationResult }) => void> = new Set();

  private static getToken(): string | null {
    return (
      getAuthToken() ||
      sessionStorage.getItem('caresetu_auth_token') ||
      localStorage.getItem('caresetu_auth_token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token')
    );
  }

  /**
   * Enables platform-level secure content protection for protected medical document screens.
   */
  public static enableSecureContent(options?: SecureContentOptions): void {
    this.isSecureActive = true;

    // 1. Capacitor / Native Android FLAG_SECURE Bridge
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      const { Plugins } = (window as any).Capacitor;
      if (Plugins?.PrivacyScreen?.enable) {
        try {
          Plugins.PrivacyScreen.enable();
        } catch (e) {
          console.warn('[SecureContentService] Capacitor PrivacyScreen enable warning:', e);
        }
      }
    }

    // 2. Native Cordova / PhoneGap Android FLAG_SECURE Bridge
    if (typeof window !== 'undefined' && (window as any).cordova?.plugins?.disallowScreenshot) {
      try {
        (window as any).cordova.plugins.disallowScreenshot(true);
      } catch (e) {
        console.warn('[SecureContentService] Cordova disallowScreenshot enable warning:', e);
      }
    }
  }

  /**
   * Disables platform-level secure content protection upon document viewer close or unmount.
   */
  public static disableSecureContent(): void {
    this.isSecureActive = false;

    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      const { Plugins } = (window as any).Capacitor;
      if (Plugins?.PrivacyScreen?.disable) {
        try {
          Plugins.PrivacyScreen.disable();
        } catch (e) {
          console.warn('[SecureContentService] Capacitor PrivacyScreen disable warning:', e);
        }
      }
    }

    if (typeof window !== 'undefined' && (window as any).cordova?.plugins?.disallowScreenshot) {
      try {
        (window as any).cordova.plugins.disallowScreenshot(false);
      } catch (e) {
        console.warn('[SecureContentService] Cordova disallowScreenshot disable warning:', e);
      }
    }
  }

  /**
   * Register a capture event listener for React components.
   */
  public static onCaptureDetected(callback: (event: { eventType: string; result?: CaptureViolationResult }) => void): () => void {
    this.captureCallbacks.add(callback);
    return () => {
      this.captureCallbacks.delete(callback);
    };
  }

  /**
   * Notify registered capture listeners.
   */
  public static notifyCaptureListeners(event: { eventType: string; result?: CaptureViolationResult }): void {
    this.captureCallbacks.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('[SecureContentService] Callback error:', err);
      }
    });
  }

  /**
   * Create a server-backed Secure View Session bound to current securityEpoch.
   */
  public static async createViewSession(payload: {
    caseId: string;
    documentId?: string;
    healthPackId?: string;
  }): Promise<{ secureViewSessionId: string; securityEpoch: number }> {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch('/api/security/view-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create secure view session.');
    }

    return await response.json();
  }

  /**
   * Report a capture violation event to the backend server.
   */
  public static async reportViolation(payload: {
    eventType?: string;
    captureType?: string;
    caseId?: string;
    documentId?: string;
    protectedResourceId?: string;
    protectedResourceType?: string;
    healthPackId?: string;
    secureViewerSessionId?: string;
    securityEpoch?: number;
    captureEventId?: string;
    platform?: string;
    metadata?: Record<string, any>;
  }): Promise<CaptureViolationResult> {
    const token = this.getToken();
    if (!token) {
      return {
        allowed: true,
        attemptNumber: 0,
        remainingAttempts: 3,
        action: 'WARNING',
        message: 'Authentication session invalid.',
        status: 'NOT_AUTHORIZED',
        serverError: true
      };
    }

    const captureEventId = payload.captureEventId || payload.metadata?.clientGeneratedEventId || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const response = await fetch('/api/security/capture-violation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          eventType: payload.eventType || payload.captureType || 'SCREENSHOT_ATTEMPT',
          captureType: payload.captureType || payload.eventType || 'SCREENSHOT_ATTEMPT',
          platform: payload.platform || 'WEB',
          caseId: payload.caseId,
          documentId: payload.documentId || payload.protectedResourceId,
          protectedResourceId: payload.protectedResourceId || payload.documentId,
          protectedResourceType: payload.protectedResourceType || 'MEDICAL_DOCUMENT',
          healthPackId: payload.healthPackId,
          secureViewerSessionId: payload.secureViewerSessionId,
          securityEpoch: payload.securityEpoch,
          captureEventId,
          metadata: {
            ...(payload.metadata || {}),
            clientGeneratedEventId: captureEventId,
            captureEventId
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 409 || errorData.code === 'SESSION_STALE') {
          return {
            allowed: true,
            attemptNumber: errorData.currentViolationCount || 0,
            remainingAttempts: 3 - (errorData.currentViolationCount || 0),
            action: 'WARNING',
            message: errorData.error || 'Security session expired. Please refresh your viewing session.',
            status: 'SESSION_STALE',
            serverError: false
          };
        }
        if (response.status === 401) {
          return {
            allowed: true,
            attemptNumber: 0,
            remainingAttempts: 3,
            action: 'WARNING',
            message: 'Authentication required to confirm security event.',
            status: 'NOT_AUTHORIZED',
            serverError: false
          };
        }
        if (response.status === 403 || errorData.status === 'TEMPORARILY_BLOCKED') {
          return {
            allowed: false,
            attemptNumber: 3,
            remainingAttempts: 0,
            action: 'TEMPORARY_BLOCK',
            message: errorData.message || 'Your hospital portal has been temporarily restricted.',
            status: 'TEMPORARILY_BLOCKED',
            serverError: false
          };
        }
        if (response.status === 429) {
          return {
            allowed: true,
            attemptNumber: 0,
            remainingAttempts: 3,
            action: 'WARNING',
            message: 'Rate limit exceeded.',
            status: 'RATE_LIMITED',
            serverError: false
          };
        }

        // Handle 500 / 502 unconfirmed server errors - DO NOT count as violation or block locally
        console.warn('[SecureContentService] Server unconfirmed response:', response.status);
        return {
          allowed: true,
          attemptNumber: 0,
          remainingAttempts: 3,
          action: 'WARNING',
          message: 'Security event could not be confirmed by the server.',
          status: 'SERVER_CONFIRMATION_FAILED',
          serverError: true
        };
      }

      const result: CaptureViolationResult = await response.json();
      result.serverError = false;
      this.notifyCaptureListeners({ eventType: payload.eventType || payload.captureType || 'SCREENSHOT_ATTEMPT', result });
      return result;
    } catch (err: any) {
      console.error('[SecureContentService] Failed to report violation:', err.message);
      return {
        allowed: true,
        attemptNumber: 0,
        remainingAttempts: 3,
        action: 'WARNING',
        message: 'Security event could not be confirmed by the server.',
        status: 'SERVER_CONFIRMATION_FAILED',
        serverError: true
      };
    }
  }

  /**
   * Get current hospital security status and active block status from backend.
   */
  public static async getHospitalSecurityStatus(): Promise<HospitalSecurityStatusResponse> {
    const token = this.getToken();
    if (!token) {
      return { status: 'ACTIVE', violationCount: 0 };
    }

    try {
      const response = await fetch('/api/security/hospital-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        return { status: 'ACTIVE', violationCount: 0 };
      }
      return await response.json();
    } catch (err) {
      return { status: 'ACTIVE', violationCount: 0 };
    }
  }

  /**
   * Submit an explanation/appeal for a blocked hospital portal.
   */
  public static async submitAppeal(payload: {
    reason: string;
    description: string;
    caseId?: string;
  }): Promise<{ message: string; appeal: any }> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/security/appeal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to submit review request.');
    }

    return await response.json();
  }

  /**
   * Admin: Get violations, security statuses, appeals, and logs analysis.
   */
  public static async getAdminViolations(params?: string | Record<string, any>): Promise<any> {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');

    let url = '/api/security/admin/violations';
    if (typeof params === 'string') {
      if (params.trim()) {
        url += `?status=${encodeURIComponent(params)}`;
      }
    } else if (params && typeof params === 'object') {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          queryParams.append(key, String(val));
        }
      });
      const qStr = queryParams.toString();
      if (qStr) {
        url += `?${qStr}`;
      }
    }

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch security violations.');
    }

    return await response.json();
  }

  /**
   * Admin: Unlock a blocked hospital.
   */
  public static async unlockHospital(payload: {
    hospitalId: string;
    decision?: 'APPROVED' | 'REJECTED';
    adminNotes?: string;
  }): Promise<any> {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch('/api/security/admin/unlock-hospital', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to unlock hospital.');
    }

    return await response.json();
  }

  /**
   * Admin: Reject appeal and keep hospital blocked.
   */
  public static async keepBlockedHospital(payload: {
    hospitalId: string;
    appealId?: string;
    adminNotes?: string;
  }): Promise<any> {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch('/api/security/admin/keep-blocked', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update hospital security status.');
    }

    return await response.json();
  }

  /**
   * Returns whether secure content mode is currently active.
   */
  public static isActive(): boolean {
    return this.isSecureActive;
  }

  /**
   * Returns honest multi-platform security architecture statement for CareSetu.
   */
  public static getPlatformSecurityDisclosure(): string {
    return (
      "CareSetu uses platform-specific protected-content mechanisms where supported. " +
      "Android native protected windows use FLAG_SECURE to block OS screenshots, screen recording, and recents previews. " +
      "iOS/iPadOS applications monitor system capture state (UIScreen.main.isCaptured) and redact protected healthcare content. " +
      "The web/PWA version uses layered browser privacy protections, in-memory Blob streams, and dynamic watermarks but cannot guarantee OS-level screenshot prevention."
    );
  }
}
