import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getAuthToken, hospitalApi, SOCKET_URL } from "../services/api";

/**
 * Emergency events that update the patient tracking experience in real-time.
 */
export const EMERGENCY_EVENTS = [
  "emergency:created",
  "emergency:location-captured",
  "emergency:analysed",
  "emergency:searching",
  "hospital:found",
  "emergency:request-sent",
  "hospital:rejected",
  "hospital:timeout",
  "case:next-hospital",
  "case:accepted",
  "transfer:started",
  "treatment:started",
  "case:completed",
  "emergency:no-hospital",
] as const;

export type EmergencyEventName = (typeof EMERGENCY_EVENTS)[number];
export type EmergencyEventHandler = (event: EmergencyEventName, payload: any) => void;

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  popupCase: any;
  setPopupCase: React.Dispatch<React.SetStateAction<any>>;
  /** Subscribe to realtime emergency events for a caseId. Returns unsubscribe fn. */
  subscribeEmergencyEvents: (caseId: string, handler: EmergencyEventHandler) => () => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  popupCase: null,
  setPopupCase: () => { },
  subscribeEmergencyEvents: () => () => { },
});

/**
 * Extracts the case reference (public UI case ID) from a socket payload.
 */
function getCaseRef(payload: any): string {
  return payload?.caseId || payload?.publicCaseId || payload?.id || "";
}

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [popupCase, setPopupCase] = useState<any>(null);

  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Set<EmergencyEventHandler>>>(new Map());

  const subscribeEmergencyEvents = (caseId: string, handler: EmergencyEventHandler) => {
    if (!caseId) return () => { };
    let handlers = listenersRef.current.get(caseId);
    if (!handlers) {
      handlers = new Set();
      listenersRef.current.set(caseId, handlers);
    }
    handlers.add(handler);
    return () => {
      const hs = listenersRef.current.get(caseId);
      if (hs) {
        hs.delete(handler);
        if (hs.size === 0) listenersRef.current.delete(caseId);
      }
    };
  };

  useEffect(() => {
    const token = getAuthToken();

    // Do not connect socket if there is no user or no token
    if (!token || !user) {
      if (socketRef.current) {
        console.log("[Socket] Unauthenticated or logged out — disconnecting socket.");
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const roleUpper = (user.role || "").toUpperCase();

    // If socket is connected for the EXACT SAME session & user, preserve existing instance
    if (socketRef.current) {
      const socketToken = (socketRef.current as any)._sessionToken;
      const socketUserId = (socketRef.current as any)._sessionUserId;
      if (socketToken === token && socketUserId === user.id && socketRef.current.connected) {
        return;
      }
      // Session or user changed: disconnect old socket before creating a new session socket
      console.log(`[Socket] Session change detected (${socketUserId} -> ${user.id}). Disconnecting previous socket.`);
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      timeout: 10000,
    });

    (newSocket as any)._sessionToken = token;
    (newSocket as any)._sessionUserId = user.id;

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setConnected(true);
      console.log(`[Socket] ✅ Connected (${roleUpper}):`, newSocket.id);
    });

    newSocket.on("disconnect", (reason) => {
      setConnected(false);
      console.log(`[Socket] ℹ️ Disconnected: ${reason}`);
    });

    newSocket.on("connect_error", (e: any) => {
      setConnected(false);
      if (e?.message === "Invalid token" || e?.message === "No token" || e?.message?.includes("Account is restricted")) {
        console.warn("[Socket] Authentication error, stopping reconnect:", e.message);
        newSocket.disconnect();
      } else {
        console.debug("[Socket] Reconnecting automatically...", e?.message || e);
      }
    });

    // Route every emergency event to registered listeners
    EMERGENCY_EVENTS.forEach((eventName) => {
      newSocket.on(eventName, (payload: any) => {
        const caseRef = getCaseRef(payload);
        const handlers = listenersRef.current.get(caseRef);
        if (handlers) {
          handlers.forEach((h) => {
            try {
              h(eventName, payload);
            } catch (err) {
              console.error("[Socket] handler error:", err);
            }
          });
        }
      });
    });

    // Hospital: incoming emergency popup
    newSocket.on("emergency:new-case", (data: any) => {
      console.log("[Socket] 🚨 NEW CASE:", data);
      if (roleUpper === "HOSPITAL") {
        setPopupCase(data);
      }
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      try {
        const audio = new Audio("/emergency-alert.mp3");
        audio.volume = 0.7;
        audio.play().catch(() => { });
      } catch { }
    });

    newSocket.on("case:assigned-to-us", (callbackPayload: any) => {
      console.log("[Socket] 🏥 Case assigned to us:", callbackPayload);
      window.dispatchEvent(
        new CustomEvent("hospital:case:assigned-to-us", { detail: callbackPayload })
      );
    });
    newSocket.on("case:closed-elsewhere", (callbackPayload: any) => {
      console.log("[Socket] ⏹ Case closed elsewhere:", callbackPayload);
      const caseRef = callbackPayload?.caseId || callbackPayload?.publicCaseId;
      setPopupCase((prev: any) => {
        if (prev && (prev.caseId === caseRef || prev.publicCaseId === caseRef)) {
          return null;
        }
        return prev;
      });
      window.dispatchEvent(
        new CustomEvent("hospital:case:closed-elsewhere", { detail: callbackPayload })
      );
    });
    newSocket.on("case:rejected-by-us", (callbackPayload: any) => {
      console.log("[Socket] 🚫 Case rejected by us:", callbackPayload);
      window.dispatchEvent(
        new CustomEvent("hospital:case:rejected-by-us", { detail: callbackPayload })
      );
    });

    return () => {
      listenersRef.current.clear();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user?.id, user?.role]);

  const handleAccept = async (caseId: string) => {
    try {
      console.log("[Accept] Calling API for:", caseId);
      const res = await hospitalApi.acceptCase(caseId);
      console.log("[Accept] Success:", res);
      setPopupCase(null);
      window.dispatchEvent(
        new CustomEvent("hospital:case:assigned-to-us", { detail: { caseId, res } })
      );
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      console.error("[Accept] Failed:", msg);
      if (err.status === 409 || msg?.includes("no longer available")) {
        setPopupCase(null);
        window.dispatchEvent(
          new CustomEvent("hospital:case:closed-elsewhere", { detail: { caseId } })
        );
        alert("Case is no longer available — assigned to another hospital.");
      } else {
        alert(`Failed to accept: ${msg}`);
      }
    }
  };

  const handleReject = async (caseId: string) => {
    const reason = prompt("Rejection reason (optional):");
    try {
      console.log("[Reject] Attempting:", caseId);
      const res = await hospitalApi.rejectCase(caseId, reason || undefined);
      console.log("[Reject] Success:", res);
      setPopupCase(null);
    } catch (err: any) {
      console.error("[Reject] Failed:", err.response?.data || err.message);
      alert(`Failed to reject: ${err.response?.data?.error || err.message || "Unknown error"}`);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, connected, popupCase, setPopupCase, subscribeEmergencyEvents }}>
      {children}
      {popupCase && (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className={`p-4 ${popupCase.source === 'CHATBOT' ? 'bg-blue-500' : 'bg-red-500'}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                  {popupCase.source === 'CHATBOT' ? '🤖' : '🚨'}
                </div>
                <div className="flex-1">
                  <h2 className="text-white font-bold text-lg">
                    {popupCase.source === 'CHATBOT' ? 'AI-Detected Emergency' : 'EMERGENCY SOS'}
                  </h2>
                  <p className="text-white/90 text-xs">
                    {popupCase.source === 'CHATBOT'
                      ? 'Analysed from AI chatbot conversation'
                      : 'Patient triggered SOS button'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Case ID</p>
                  <p className="font-mono font-bold text-navy">{popupCase.publicCaseId || popupCase.caseId}</p>
                </div>
                <div>
                  <p className="text-slate-500">Severity</p>
                  <p className={`font-bold ${popupCase.severity === 'CRITICAL' ? 'text-red-600' :
                      popupCase.severity === 'HIGH' || popupCase.severity === 'URGENT' ? 'text-orange-600' :
                        'text-yellow-600'
                    }`}>{popupCase.severity || 'CRITICAL'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Distance</p>
                  <p className="font-semibold text-navy">
                    {popupCase.distanceKm != null ? `${popupCase.distanceKm.toFixed(1)} km away` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Source</p>
                  <p className={`px-2 py-0.5 rounded-full text-center font-semibold ${popupCase.source === 'CHATBOT'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                    {popupCase.source === 'CHATBOT' ? '🤖 Chatbot' : '🆘 Direct SOS'}
                  </p>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs text-slate-500 mb-1.5">
                  {popupCase.source === 'CHATBOT' ? '🤖 AI Extracted Symptoms' : '👤 Symptoms'}
                </p>
                {popupCase.symptoms ? (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <ul className="text-sm text-navy space-y-1">
                      {popupCase.symptoms.split(',').map((s: string, i: number) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-1 h-1 bg-blue-500 rounded-full" />
                          {s.trim()}
                        </li>
                      ))}
                    </ul>
                    {popupCase.source === 'CHATBOT' && (
                      <p className="text-[10px] text-blue-600 mt-2 italic">
                        ⚠️ AI-suggested. Doctor decides.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                    <p className="text-sm text-red-800 font-semibold">NOT PROVIDED</p>
                    <p className="text-[10px] text-red-600 mt-1">
                      Treat as CRITICAL.
                    </p>
                  </div>
                )}
              </div>

              {/* Patient Section */}
              <div className="border-t pt-3">
                <p className="text-xs text-slate-500 mb-1">👤 Patient</p>
                <div className="text-xs font-semibold text-navy">
                  <span className="font-bold text-sm">
                    {popupCase.patientInfo?.name || popupCase.patientName || popupCase.patient?.name || 'Not provided'}
                  </span>
                  {(popupCase.patientInfo?.age ?? popupCase.patientAge ?? popupCase.patient?.age) != null ? `, ${popupCase.patientInfo?.age ?? popupCase.patientAge ?? popupCase.patient?.age} yrs` : ''}
                </div>
              </div>

              {/* Medical History Section */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                  🩺 Medical History
                </p>
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500 text-[11px]">Blood Group</p>
                    <p className="font-bold text-rose-600 mt-0.5">
                      {(popupCase.bloodGroup || popupCase.blood_group || popupCase.patientInfo?.bloodGroup || popupCase.patientInfo?.blood_group)?.trim() || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[11px]">Known Conditions</p>
                    <p className="font-semibold text-navy mt-0.5 leading-snug">
                      {(popupCase.knownConditions || popupCase.medicalConditions || popupCase.medical_conditions || popupCase.patientInfo?.knownConditions || popupCase.patientInfo?.medicalConditions || popupCase.patientInfo?.medical_conditions || popupCase.patientInfo?.medicalHistory)?.trim() || 'Not provided'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <button
                  onClick={() => handleAccept(popupCase.publicCaseId || popupCase.caseId)}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg"
                >
                  ✅ ACCEPT
                </button>
                <button
                  onClick={() => handleReject(popupCase.publicCaseId || popupCase.caseId)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg"
                >
                  ❌ CANNOT HANDLE
                </button>
              </div>

              <button
                onClick={() => setPopupCase(null)}
                className="w-full text-xs text-slate-500 py-1"
              >
                Dismiss (case remains in list)
              </button>
            </div>
          </div>
        </div>
      )}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);