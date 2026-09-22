import { useState, useEffect, useCallback } from "react";
import { ChevronRight, User, FileText, AlertTriangle, Pill, Phone, FileStack, Bell, Settings as SettingsIcon, LogOut } from "lucide-react";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import { Input, Select } from "../../components/common/Input";
import { PasswordInput } from "../../components/common/PasswordInput";
import Button from "../../components/common/Button";
import { patients } from "../../data/patients";
import { notifications } from "../../data/notifications";
import { OfflineState } from "../../components/common/States";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { settingsApi, emergencySyncClient } from "../../services/api";
import { CredentialUpdateModal } from "../../components/common/CredentialUpdateModal";
import {
  subscribeOfflineQueue,
  flushQueuedSOS,
  type OfflineQueueStatus,
} from "../../utils/offlineSync";

export function PatientProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = [
    { icon: FileText, label: "Medical Information", to: "/patient/medical-information" },
    { icon: FileStack, label: "Documents", to: "/patient/health-pack" },
    { icon: Bell, label: "Notifications", to: "/patient/notifications" },
    { icon: SettingsIcon, label: "Settings", to: "/patient/settings" },
  ];
  return (
    <div className="max-w-lg mx-auto flex flex-col gap-5 pb-6">
      <Card className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-sky text-white flex items-center justify-center font-bold text-lg">{user?.avatarInitials}</div>
        <div>
          <p className="font-bold text-navy">{user?.name}</p>
          <p className="text-xs text-text-secondary">{user?.email}</p>
        </div>
      </Card>
      <div className="flex flex-col gap-2.5">
        {links.map((l) => (
          <button key={l.label} onClick={() => navigate(l.to)} className="text-left">
            <Card className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-lightblue flex items-center justify-center">
                  <l.icon className="w-4.5 h-4.5 text-navy-dark" />
                </div>
                <p className="font-semibold text-navy text-sm">{l.label}</p>
              </div>
              <ChevronRight className="w-4.5 h-4.5 text-slate-300" />
            </Card>
          </button>
        ))}
      </div>
      <Button
        variant="outline"
        icon={<LogOut className="w-4 h-4" />}
        className="text-emergency border-red-100"
        onClick={() => {
          logout();
          navigate("/login");
        }}
      >
        Log out
      </Button>
    </div>
  );
}

export function MedicalInformationPage() {
  const patient = patients[2];
  return (
    <div className="max-w-lg mx-auto flex flex-col gap-4 pb-6">
      <Card>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Personal information</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Age" defaultValue={patient.age} readOnly />
          <Input label="Blood group" defaultValue={patient.bloodGroup} readOnly />
        </div>
      </Card>
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4.5 h-4.5 text-emergency" />
          <p className="font-semibold text-navy text-sm">Allergies</p>
        </div>
        {patient.allergies.length ? (
          <div className="flex flex-wrap gap-2">
            {patient.allergies.map((a) => (
              <Badge key={a} tone="critical">{a}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No known allergies.</p>
        )}
      </Card>
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Pill className="w-4.5 h-4.5 text-navy-dark" />
          <p className="font-semibold text-navy text-sm">Medications</p>
        </div>
        {patient.medications.length ? (
          <ul className="text-sm text-navy space-y-1.5">
            {patient.medications.map((m) => <li key={m}>• {m}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">No current medications.</p>
        )}
      </Card>
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Phone className="w-4.5 h-4.5 text-navy-dark" />
          <p className="font-semibold text-navy text-sm">Emergency contacts</p>
        </div>
        <div className="flex flex-col gap-2">
          {patient.emergencyContacts.map((c) => (
            <div key={c.phone} className="flex items-center justify-between text-sm">
              <span className="text-navy font-medium">{c.name} ({c.relation})</span>
              <span className="text-text-secondary">{c.phone}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function PatientNotificationsPage() {
  const toneMap = { emergency: "critical", warning: "urgent", success: "stable", info: "neutral" } as const;
  return (
    <div className="max-w-lg mx-auto flex flex-col gap-2.5 pb-6">
      {notifications.map((n) => (
        <Card key={n.id} className={`flex items-start justify-between gap-3 ${!n.read ? "border-l-4 border-l-sky" : ""}`}>
          <div>
            <p className="font-semibold text-navy text-sm">{n.title}</p>
            <p className="text-xs text-text-secondary mt-1">{n.message}</p>
            <p className="text-[11px] text-slate-400 mt-1.5">{n.time}</p>
          </div>
          <Badge tone={toneMap[n.type]}>{n.type}</Badge>
        </Card>
      ))}
    </div>
  );
}

export function PatientOfflinePage() {
  const [queueStatus, setQueueStatus] = useState<OfflineQueueStatus>({
    queued: 0,
    syncing: false,
    lastSyncError: null,
    authRequired: false,
  });
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() =>
    typeof localStorage !== "undefined"
      ? localStorage.getItem("caresetu_last_sync_time")
      : null
  );

  useEffect(() => {
    return subscribeOfflineQueue((s) => {
      setQueueStatus(s);
      // Track last successful sync time (when queue empties and not syncing)
      if (s.queued === 0 && !s.syncing && !s.lastSyncError) {
        const now = new Date().toISOString();
        setLastSyncTime(now);
        try { localStorage.setItem("caresetu_last_sync_time", now); } catch {}
      }
    });
  }, []);


  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const handleSync = useCallback(() => {
    void flushQueuedSOS(emergencySyncClient);
  }, []);

  const formatLastSync = (iso: string | null) => {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
    return new Date(iso).toLocaleDateString();
  };

  const statusLabel = queueStatus.authRequired
    ? "Sign in again to sync"
    : queueStatus.syncing
      ? "Syncing..."
      : queueStatus.lastSyncError
        ? queueStatus.lastSyncError
        : queueStatus.queued > 0
          ? `${queueStatus.queued} item(s) pending`
          : "All synced";

  return (
    <Card className="max-w-lg mx-auto">
      <OfflineState
        lastSynced={formatLastSync(lastSyncTime)}
        pending={queueStatus.queued}
        onSync={handleSync}
      />
      <div className="text-center -mt-2 space-y-1">
        <p className={`text-xs font-medium ${
          queueStatus.syncing ? "text-sky" :
          queueStatus.authRequired ? "text-emergency" :
          queueStatus.queued > 0 ? "text-amber-600" :
          "text-emerald-600"
        }`}>
          {statusLabel}
        </p>
        <p className={`text-xs font-medium ${
          isOnline ? "text-emerald-600" : "text-red-500"
        }`}>
          {isOnline ? "● Online" : "● Offline"}
        </p>
      </div>
    </Card>
  );
}

export function PatientSettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // OTP Modal State
  const [updateModalType, setUpdateModalType] = useState<"EMAIL" | "MOBILE" | null>(null);

  // Profile Form State
  const [form, setForm] = useState({
    name: "",
    phone: "",
    age: "",
    gender: "",
    bloodGroup: "",
    allergies: "",
    medicalConditions: "",
    medications: "",
  });

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [isShake, setIsShake] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Notification State
  const [notifications, setNotifications] = useState({
    emergencyAlerts: true,
    pushNotifications: true,
    smsNotifications: true,
    emailNotifications: true,
  });

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await settingsApi.getProfile();
      const p = res.data;
      setProfile(p);
      const pt = p.patientProfile || {};
      setForm({
        name: pt.name || p.name || "",
        phone: pt.phone || "",
        age: pt.age ? String(pt.age) : "",
        gender: pt.gender || "",
        bloodGroup: pt.bloodGroup || "",
        allergies: pt.allergies || "",
        medicalConditions: pt.medicalConditions || pt.conditions || "",
        medications: pt.medications || "",
      });
      if (p.notificationPreferences) {
        setNotifications((prev) => ({ ...prev, ...p.notificationPreferences }));
      }
    } catch (err: any) {
      console.error("[PatientSettings] Load error:", err);
      setMessage({ type: "error", text: err.message || "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setMessage(null);
    try {
      const payload: any = { ...form };
      if (form.age) payload.age = parseInt(form.age, 10);
      await settingsApi.updateProfile(payload);
      setMessage({ type: "success", text: "Profile settings updated successfully!" });
      loadProfile();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update profile" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    setIsShake(false);

    if (newPassword.length < 8) {
      setIsShake(true);
      setTimeout(() => setIsShake(false), 600);
      setPasswordMsg({ type: "error", text: "New password must be at least 8 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setIsShake(true);
      setTimeout(() => setIsShake(false), 600);
      setPasswordMsg({ type: "error", text: "New passwords do not match." });
      return;
    }

    setChangingPassword(true);
    try {
      await settingsApi.updatePassword(currentPassword, newPassword, confirmPassword);
      setPasswordMsg({ type: "success", text: "Password updated successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setIsShake(true);
      setTimeout(() => setIsShake(false), 600);
      setPasswordMsg({ type: "error", text: err.message || "Failed to change password" });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleToggleNotification = async (key: string, val: boolean) => {
    const updated = { ...notifications, [key]: val };
    setNotifications(updated);
    try {
      await settingsApi.updateNotifications(updated);
    } catch (err) {
      console.error("[Notifications] Save error:", err);
    }
  };

  if (loading) {
    return <div className="max-w-lg mx-auto py-8 text-center text-slate-500 text-sm">Loading settings...</div>;
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6 pb-8">
      {/* Account Info Card */}
      <Card className="flex items-center justify-between">
        <div>
          <p className="font-bold text-navy text-lg">{profile?.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge tone="stable">{profile?.role}</Badge>
            <Badge tone={profile?.status === "ACTIVE" ? "available" : "critical"}>{profile?.status}</Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<LogOut className="w-4 h-4" />}
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Logout
        </Button>
      </Card>

      {/* Account Credentials (OTP Protected) Card */}
      <Card>
        <p className="font-bold text-navy text-base mb-1">Account Credentials (OTP Protected)</p>
        <p className="text-xs text-slate-500 mb-4">
          Updating your email or mobile number requires mandatory OTP verification. Changes are saved only after successful verification.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Email Address</p>
              <p className="text-sm font-bold text-navy">{profile?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setUpdateModalType("EMAIL")}>
              Update Email
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Mobile Number</p>
              <p className="text-sm font-bold text-navy">{form.phone || "Not set"}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setUpdateModalType("MOBILE")}>
              Update Mobile
            </Button>
          </div>
        </div>
      </Card>

      {/* Profile Details Card */}
      <Card>
        <p className="font-bold text-navy text-base mb-4">Personal & Medical Profile</p>
        {message && (
          <div className={`mb-4 p-3 rounded-xl text-xs font-semibold ${message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
          <Input label="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Age" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            <Input label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Blood Group" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} />
          </div>
          <Input label="Known Allergies" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="e.g. Penicillin, Dust" />
          <Input label="Medical Conditions" value={form.medicalConditions} onChange={(e) => setForm({ ...form, medicalConditions: e.target.value })} placeholder="e.g. Diabetes, Hypertension" />
          <Input label="Current Medications" value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })} placeholder="e.g. Metformin, Amlodipine" />
          <Button variant="primary" type="submit" disabled={savingProfile} className="mt-2">
            {savingProfile ? "Saving Profile..." : "Save Profile Changes"}
          </Button>
        </form>
      </Card>

      {/* Security & Password Card */}
      <Card>
        <p className="font-bold text-navy text-base mb-4">Account Security & Password</p>
        {passwordMsg && (
          <div className={`mb-4 p-3 rounded-xl text-xs font-semibold ${passwordMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {passwordMsg.text}
          </div>
        )}
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          <PasswordInput
            label="Current Password"
            value={currentPassword}
            onChange={(val) => setCurrentPassword(val)}
            required
            showStrengthIndicator={false}
            showChecklist={false}
            isShake={isShake}
            autoComplete="current-password"
          />
          <PasswordInput
            label="New Password"
            value={newPassword}
            onChange={(val) => setNewPassword(val)}
            placeholder="Min 8 chars (Uppercase, lowercase, digit, special char)"
            required
            showStrengthIndicator={true}
            showChecklist={true}
            isShake={isShake}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(val) => setConfirmPassword(val)}
            placeholder="Confirm new password"
            required
            showStrengthIndicator={false}
            showChecklist={false}
            confirmValue={newPassword}
            showConfirmMatching={true}
            isShake={isShake}
            autoComplete="new-password"
          />
          <Button variant="outline" type="submit" loading={changingPassword} className="mt-2">
            Update Password
          </Button>
        </form>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <p className="font-bold text-navy text-base mb-3">Notification Preferences</p>
        {[
          { key: "emergencyAlerts", label: "Emergency SOS Alerts" },
          { key: "pushNotifications", label: "Real-time Push Notifications" },
          { key: "smsNotifications", label: "Critical Case SMS Alerts" },
          { key: "emailNotifications", label: "Email Notifications" },
        ].map((item) => (
          <label key={item.key} className="flex items-center justify-between py-2 text-sm text-navy border-b border-slate-50">
            <span>{item.label}</span>
            <input
              type="checkbox"
              checked={!!(notifications as any)[item.key]}
              onChange={(e) => handleToggleNotification(item.key, e.target.checked)}
              className="w-4 h-4 accent-sky cursor-pointer"
            />
          </label>
        ))}
      </Card>

      {/* OTP Credential Update Modal */}
      {updateModalType && (
        <CredentialUpdateModal
          type={updateModalType}
          currentValue={updateModalType === "EMAIL" ? profile?.email : form.phone}
          onClose={() => setUpdateModalType(null)}
          onSuccess={() => {
            loadProfile();
          }}
        />
      )}
    </div>
  );
}
