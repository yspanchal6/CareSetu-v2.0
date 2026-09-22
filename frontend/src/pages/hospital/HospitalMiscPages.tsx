import { useState, useEffect, useCallback } from "react";
import { hospitalApi, settingsApi } from "../../services/api";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import { SearchInput, Input } from "../../components/common/Input";
import Button from "../../components/common/Button";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Star, MapPin, Bed, HeartPulse, Wind, Siren, CheckCircle, RefreshCw } from "lucide-react";
import EmergencyCaseCard from "../../components/emergency/EmergencyCaseCard";
import { CredentialUpdateModal } from "../../components/common/CredentialUpdateModal";

export function HospitalMatchingRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = useCallback(async () => {
    try {
      const res = await hospitalApi.pendingCases();
      setRequests(res.cases || []);
    } catch (err) {
      console.error("[MatchingRequests] Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 5000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  const handleAccept = async (caseId: string) => {
    try {
      await hospitalApi.acceptCase(caseId);
      loadRequests();
    } catch (err: any) {
      alert(err.message || "Failed to accept case");
    }
  };

  const handleReject = async (caseId: string) => {
    const reason = prompt("Select reason (e.g. ICU unavailable):");
    try {
      await hospitalApi.rejectCase(caseId, reason || undefined);
      loadRequests();
    } catch (err: any) {
      alert(err.message || "Failed to reject case");
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        <div className="inline-block w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-2" />
        <p>Loading matching emergency requests queue...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-dashed p-6">
        <Siren className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="font-semibold text-navy">No matching requests in queue.</p>
        <p className="text-xs text-slate-400 mt-1">All dispatched emergency requests have been resolved.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 font-semibold">{requests.length} pending request(s) sorted by severity</p>
        <button onClick={loadRequests} className="text-xs text-sky-600 font-semibold flex items-center gap-1 hover:underline">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Queue
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {requests.map((r) => (
          <EmergencyCaseCard
            key={r.caseId || r.id}
            emergencyCase={r}
            onAccept={() => handleAccept(r.publicCaseId || r.caseId || r.id)}
            onReject={() => handleReject(r.publicCaseId || r.caseId || r.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function HospitalPatientsPage() {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPatients = useCallback(async (q: string) => {
    try {
      const res = await hospitalApi.getPatients(q);
      setPatients(res.patients || []);
    } catch (err) {
      console.error("[Patients] Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPatients(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, loadPatients]);

  return (
    <div className="flex flex-col gap-4">
      <SearchInput placeholder="Search authorized patient records by name..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <Card padded={false} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-text-secondary text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Patient Name</th>
              <th className="text-left px-4 py-3 font-semibold">Age / Gender</th>
              <th className="text-left px-4 py-3 font-semibold">Blood Group</th>
              <th className="text-left px-4 py-3 font-semibold">Contact Phone</th>
              <th className="text-left px-4 py-3 font-semibold">Last Emergency Case</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading patients...</td>
              </tr>
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No authorized patient records found.</td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-navy">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.age ? `${p.age} yrs` : "—"} · {p.gender || "—"}</td>
                  <td className="px-4 py-3 font-mono font-bold text-sky-700">{p.bloodGroup || "Not provided"}</td>
                  <td className="px-4 py-3 text-slate-600">{p.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-slate-700">{p.lastCaseId || "None"}</span>
                      <span className="ml-2 inline-block">
                        <Badge tone={p.lastCaseStatus === "ACCEPTED" || p.lastCaseStatus === "TRANSFER" ? "critical" : "stable"}>
                          {p.lastCaseStatus}
                        </Badge>
                      </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function HospitalCapacityPage() {
  const [capacity, setCapacity] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ availableBeds: 40, totalBeds: 100, availableICU: 5, totalICU: 20, availableVentilators: 3, totalVentilators: 10 });
  const [saving, setSaving] = useState(false);

  const loadCapacity = useCallback(async () => {
    try {
      const res = await hospitalApi.getCapacity();
      if (res.capacity) {
        setCapacity(res.capacity);
        setForm({
          availableBeds: res.capacity.availableBeds ?? 40,
          totalBeds: res.capacity.totalBeds ?? 100,
          availableICU: res.capacity.availableICU ?? 5,
          totalICU: res.capacity.totalICU ?? 20,
          availableVentilators: res.capacity.availableVentilators ?? 3,
          totalVentilators: res.capacity.totalVentilators ?? 10,
        });
      }
    } catch (err) {
      console.error("[Capacity] Error:", err);
    }
  }, []);

  useEffect(() => {
    loadCapacity();
  }, [loadCapacity]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await hospitalApi.updateCapacity(form);
      await loadCapacity();
      setEditing(false);
    } catch (err: any) {
      alert(err.message || "Failed to update capacity");
    } finally {
      setSaving(false);
    }
  };

  const items = [
    { label: "Beds", availKey: "availableBeds", totalKey: "totalBeds", avail: form.availableBeds, total: form.totalBeds },
    { label: "ICU", availKey: "availableICU", totalKey: "totalICU", avail: form.availableICU, total: form.totalICU },
    { label: "Ventilators", availKey: "availableVentilators", totalKey: "totalVentilators", avail: form.availableVentilators, total: form.totalVentilators },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-navy">Operational Facility Capacity</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Last updated: {capacity?.updatedAt ? new Date(capacity.updatedAt).toLocaleString() : "Just now"}
          </p>
        </div>
        <Button variant={editing ? "outline" : "primary"} size="sm" onClick={() => setEditing(!editing)}>
          {editing ? "Cancel Editing" : "Update Operational Capacity"}
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {items.map((i) => {
          const pct = i.total > 0 ? Math.round((i.avail / i.total) * 100) : 0;
          return (
            <Card key={i.label} className="text-center">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{i.label}</p>
              <p className="text-3xl font-extrabold text-navy mt-2">{pct}%</p>
              <p className="text-xs text-text-secondary mt-1">{i.avail} of {i.total} available</p>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-4">
                <div className={`h-full rounded-full ${pct < 20 ? "bg-emergency" : pct < 50 ? "bg-accent" : "bg-success"}`} style={{ width: `${pct}%` }} />
              </div>

              {editing && (
                <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-2 text-left text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Available</label>
                    <input
                      type="number"
                      min={0}
                      value={(form as any)[i.availKey]}
                      onChange={(e) => setForm({ ...form, [i.availKey]: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full border rounded px-2 py-1 text-navy font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Total</label>
                    <input
                      type="number"
                      min={1}
                      value={(form as any)[i.totalKey]}
                      onChange={(e) => setForm({ ...form, [i.totalKey]: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full border rounded px-2 py-1 text-navy font-bold"
                    />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {editing && (
        <div className="flex justify-end">
          <Button variant="success" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save and Broadcast Capacity Updates"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function HospitalReportsPage() {
  const [reports, setReports] = useState<any>(null);

  useEffect(() => {
    hospitalApi.getReports().then((res) => {
      if (res.reports) setReports(res.reports);
    }).catch(console.error);
  }, []);

  const severityPie = reports?.severityDistribution?.map((d: any) => ({
    m: d.severity,
    v: d.count,
  })) || [
    { m: "CRITICAL", v: 12 },
    { m: "URGENT", v: 24 },
    { m: "STABLE", v: 18 },
  ];

  const statusPie = reports?.requestStatusDistribution?.map((d: any) => ({
    m: d.status,
    v: d.count,
  })) || [
    { m: "ACCEPTED", v: 32 },
    { m: "REJECTED", v: 6 },
    { m: "EXPIRED", v: 4 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase">Total Emergency Requests</p>
          <p className="text-3xl font-bold text-navy mt-1">{reports?.totalRequests ?? "—"}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase">Accepted Cases</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{reports?.acceptedCount ?? "—"}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase">Acceptance Rate</p>
          <p className="text-3xl font-bold text-sky-600 mt-1">{reports?.acceptanceRate != null ? `${reports.acceptanceRate}%` : "—"}</p>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <p className="font-semibold text-navy text-sm mb-3">Emergency Cases by Severity</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={severityPie}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="m" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="v" fill="#38BDF8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <p className="font-semibold text-navy text-sm mb-3">Request Outcome Distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusPie}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="m" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="v" fill="#22C55E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

export function HospitalStaffPage() {
  const [staff, setStaff] = useState<any[]>([]);

  useEffect(() => {
    hospitalApi.getStaff().then((res) => setStaff(res.staff || [])).catch(console.error);
  }, []);

  return (
    <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
      {staff.map((s) => (
        <Card key={s.id || s.name} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-lightblue flex items-center justify-center font-bold text-navy-dark text-sm">
              {s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="font-semibold text-navy text-sm">{s.name}</p>
              <p className="text-xs text-text-secondary">{s.role}</p>
            </div>
          </div>
          <Badge tone={s.status === "On Duty" ? "available" : "pending"}>{s.status}</Badge>
        </Card>
      ))}
    </div>
  );
}

export function HospitalProfilePage() {
  const [hospital, setHospital] = useState<any>(null);

  useEffect(() => {
    hospitalApi.getProfile().then((res) => setHospital(res.hospital)).catch(console.error);
  }, []);

  if (!hospital) {
    return <div className="text-sm text-slate-500 py-8">Loading profile...</div>;
  }

  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-bold text-navy text-lg">{hospital.name}</h2>
            <p className="text-sm text-text-secondary flex items-center gap-1 mt-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {hospital.address}</p>
            {hospital.city && <p className="text-xs text-slate-400 mt-0.5">{hospital.city}, {hospital.state}</p>}
          </div>
          <Badge tone={hospital.emergencyAvailable ? "available" : "critical"}>
            {hospital.emergencyAvailable ? "🟢 Accepting Emergencies" : "🔴 Not Accepting"}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center border-t pt-4">
          <div className="bg-paleblue rounded-xl py-3"><Bed className="w-4.5 h-4.5 mx-auto mb-1 text-navy-dark" /><p className="text-sm font-bold text-navy">{hospital.totalBeds ?? 100}</p><p className="text-[11px] text-text-secondary">Beds</p></div>
          <div className="bg-paleblue rounded-xl py-3"><HeartPulse className="w-4.5 h-4.5 mx-auto mb-1 text-navy-dark" /><p className="text-sm font-bold text-navy">{hospital.totalICU ?? 20}</p><p className="text-[11px] text-text-secondary">ICU</p></div>
          <div className="bg-paleblue rounded-xl py-3"><Wind className="w-4.5 h-4.5 mx-auto mb-1 text-navy-dark" /><p className="text-sm font-bold text-navy">{hospital.totalVentilators ?? 10}</p><p className="text-[11px] text-text-secondary">Ventilators</p></div>
        </div>
      </Card>

      <Card>
        <p className="font-semibold text-navy text-sm mb-2">Capabilities & Departments</p>
        <div className="flex flex-wrap gap-1.5">
          {(hospital.capabilities || []).map((c: string) => (
            <span key={c} className="text-xs font-medium px-2.5 py-1 rounded-md bg-lightblue text-navy-dark">{c}</span>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function HospitalNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    hospitalApi.getNotifications().then((res) => setNotifications(res.notifications || [])).catch(console.error);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await hospitalApi.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: "READ" } : n)));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      {notifications.length === 0 ? (
        <Card className="text-center py-8 text-slate-400 text-sm">No new system notifications.</Card>
      ) : (
        notifications.map((n) => (
          <Card key={n.id} className={`flex items-start justify-between gap-3 ${n.status === "UNREAD" ? "border-l-4 border-l-sky-500 bg-sky-50/20" : ""}`}>
            <div>
              <p className="font-semibold text-navy text-sm">{n.title}</p>
              <p className="text-xs text-text-secondary mt-1">{n.message}</p>
              <span className="text-[10px] text-slate-400 mt-1 block">{new Date(n.createdAt).toLocaleString()}</span>
            </div>
            {n.status === "UNREAD" && (
              <Button variant="ghost" size="sm" onClick={() => handleMarkRead(n.id)}>
                <CheckCircle className="w-4 h-4 text-sky-600" />
              </Button>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

export function HospitalSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // OTP Modal State
  const [updateModalType, setUpdateModalType] = useState<"EMAIL" | "MOBILE" | null>(null);

  // Profile Form
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    emergencyAvailable: true,
  });

  // Password Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await settingsApi.getProfile();
      const p = res.data;
      setProfile(p);
      const hp = p.hospitalProfile || {};
      setForm({
        name: hp.name || "",
        address: hp.address || "",
        phone: hp.phone || "",
        email: hp.email || p.email || "",
        city: hp.city || "",
        state: hp.state || "",
        emergencyAvailable: hp.emergencyAvailable !== false,
      });
    } catch (err: any) {
      console.error("[HospitalSettings] Load error:", err);
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
      await settingsApi.updateProfile(form);
      setMessage({ type: "success", text: "Hospital profile updated successfully!" });
      loadProfile();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update hospital profile" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "New password must be at least 8 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New passwords do not match." });
      return;
    }

    setChangingPassword(true);
    try {
      await settingsApi.updatePassword(currentPassword, newPassword);
      setPasswordMsg({ type: "success", text: "Password updated successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err.message || "Failed to change password" });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <div className="max-w-xl mx-auto py-8 text-center text-slate-500 text-sm">Loading hospital settings...</div>;
  }

  return (
    <div className="max-w-xl flex flex-col gap-6 pb-8">
      {/* Hospital Account Header */}
      <Card className="flex items-center justify-between">
        <div>
          <p className="font-bold text-navy text-lg">{profile?.hospitalProfile?.name || profile?.email}</p>
          <p className="text-xs text-slate-500 mt-0.5">{profile?.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge tone="stable">HOSPITAL PORTAL</Badge>
            <Badge tone={profile?.status === "ACTIVE" ? "available" : "critical"}>{profile?.status}</Badge>
            <Badge tone={profile?.isVerified ? "available" : "pending"}>
              {profile?.isVerified ? "Verified Facility" : "Unverified"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Account Credentials (OTP Protected) Card */}
      <Card>
        <p className="font-bold text-navy text-base mb-1">Facility Credentials (OTP Protected)</p>
        <p className="text-xs text-slate-500 mb-4">
          Updating facility contact email or emergency phone number requires mandatory OTP verification before database commit.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Hospital Contact Email</p>
              <p className="text-sm font-bold text-navy">{form.email || profile?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setUpdateModalType("EMAIL")}>
              Update Email
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Emergency Desk Phone</p>
              <p className="text-sm font-bold text-navy">{form.phone || "Not set"}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setUpdateModalType("MOBILE")}>
              Update Phone
            </Button>
          </div>
        </div>
      </Card>

      {/* Profile Details Form */}
      <Card>
        <p className="font-bold text-navy text-base mb-4">Facility Details & Location</p>
        {message && (
          <div className={`mb-4 p-3 rounded-xl text-xs font-semibold ${message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
          <Input label="Hospital Facility Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>

          <label className="flex items-center justify-between py-3 px-3 bg-slate-50 rounded-xl mt-2 cursor-pointer">
            <div>
              <p className="font-semibold text-navy text-sm">Emergency Dispatch Availability</p>
              <p className="text-xs text-slate-500">Accept incoming emergency case dispatches</p>
            </div>
            <input
              type="checkbox"
              checked={form.emergencyAvailable}
              onChange={(e) => setForm({ ...form, emergencyAvailable: e.target.checked })}
              className="w-5 h-5 accent-sky cursor-pointer"
            />
          </label>

          <Button variant="primary" type="submit" disabled={savingProfile} className="mt-2">
            {savingProfile ? "Saving Facility Details..." : "Save Facility Changes"}
          </Button>
        </form>
      </Card>

      {/* Password Change */}
      <Card>
        <p className="font-bold text-navy text-base mb-4">Security & Password</p>
        {passwordMsg && (
          <div className={`mb-4 p-3 rounded-xl text-xs font-semibold ${passwordMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {passwordMsg.text}
          </div>
        )}
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
          <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Min 8 characters" />
          <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          <Button variant="outline" type="submit" disabled={changingPassword} className="mt-2">
            {changingPassword ? "Updating Password..." : "Update Password"}
          </Button>
        </form>
      </Card>

      {/* OTP Credential Update Modal */}
      {updateModalType && (
        <CredentialUpdateModal
          type={updateModalType}
          currentValue={updateModalType === "EMAIL" ? form.email : form.phone}
          onClose={() => setUpdateModalType(null)}
          onSuccess={() => {
            loadProfile();
          }}
        />
      )}
    </div>
  );
}
