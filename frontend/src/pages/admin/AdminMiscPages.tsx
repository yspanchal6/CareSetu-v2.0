import { useState, useEffect, useCallback } from "react";
import { adminApi, settingsApi } from "../../services/api";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import { SearchInput, Input } from "../../components/common/Input";
import Button from "../../components/common/Button";
import { ShieldAlert, CheckCircle, ShieldOff, Lock, UserCheck, AlertTriangle } from "lucide-react";
import CredentialUpdateModal from "../../components/common/CredentialUpdateModal";

interface BlockModalProps {
  user: any;
  onClose: () => void;
  onSuccess: () => void;
}

function BlockModal({ user, onClose, onSuccess }: BlockModalProps) {
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Reason for blocking is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await adminApi.blockAccount(user.id, reason.trim(), expiresAt || undefined);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to block account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100 flex flex-col gap-4">
        <div className="flex items-center gap-3 text-red-600">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-navy text-lg">Restrict Account</h3>
            <p className="text-xs text-slate-500">Blocklist user fromCareSetu platform</p>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
          <p><span className="font-semibold text-navy">Account:</span> {user.name} ({user.email})</p>
          <p><span className="font-semibold text-navy">Role:</span> {user.role}</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">
              Reason for Blocklist Restriction <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a detailed administrative reason for restricting this account..."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-400 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy mb-1">
              Optional Restriction Expiry Date
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-400 outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">Leave blank for permanent restriction until manually revoked.</p>
          </div>

          <div className="flex items-center justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting} className="bg-red-600 hover:bg-red-700 text-white">
              {submitting ? "Applying Block..." : "Confirm & Restrict Account"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UnblockModal({ user, onClose, onSuccess }: BlockModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await adminApi.unblockAccount(user.id, reason.trim() || undefined);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to unblock account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100 flex flex-col gap-4">
        <div className="flex items-center gap-3 text-emerald-600">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ShieldOff className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-navy text-lg">Unblock Account</h3>
            <p className="text-xs text-slate-500">Restore full access for this user</p>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
          <p><span className="font-semibold text-navy">Account:</span> {user.name} ({user.email})</p>
          <p><span className="font-semibold text-navy">Current Reason:</span> {user.activeRestriction?.reason || "Restricted"}</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">
              Unblock Reason / Administrative Note
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Issue resolved / Verification completed"
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="success" size="sm" type="submit" disabled={submitting}>
              {submitting ? "Unblocking..." : "Confirm & Unblock Account"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [modalType, setModalType] = useState<"block" | "unblock" | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getUsers(query, roleFilter || undefined);
      setUsers(res.users || []);
    } catch (err) {
      console.error("[AdminUsers] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [query, roleFilter]);

  useEffect(() => {
    const timer = setTimeout(loadUsers, 300);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-80">
          <SearchInput placeholder="Search users by name or email..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-navy outline-none"
          >
            <option value="">All Roles</option>
            <option value="PATIENT">Patients</option>
            <option value="HOSPITAL">Hospitals</option>
            <option value="DOCTOR">Doctors</option>
            <option value="ADMIN">Admins</option>
          </select>
        </div>
      </div>

      <Card padded={false} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-text-secondary text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">User</th>
              <th className="text-left px-4 py-3 font-semibold">Role</th>
              <th className="text-left px-4 py-3 font-semibold">Account Status</th>
              <th className="text-left px-4 py-3 font-semibold">Restriction Reason</th>
              <th className="text-right px-4 py-3 font-semibold">Administrative Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading user accounts...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No user accounts found matching query.</td>
              </tr>
            ) : (
              users.map((u) => {
                const isBlocked = u.status === "BLOCKED";
                return (
                  <tr key={u.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-navy">
                      <div>
                        <p className="font-semibold text-navy">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="neutral">{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={isBlocked ? "critical" : "available"}>
                        {isBlocked ? "BLOCKED / RESTRICTED" : u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                      {isBlocked ? (u.activeRestriction?.reason || "Account suspended") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.role === "ADMIN" ? (
                        <span className="text-xs text-slate-400 italic">Protected Admin</span>
                      ) : isBlocked ? (
                        <Button
                          variant="success"
                          size="sm"
                          icon={<ShieldOff className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setSelectedUser(u);
                            setModalType("unblock");
                          }}
                        >
                          Unblock
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          icon={<ShieldAlert className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setSelectedUser(u);
                            setModalType("block");
                          }}
                        >
                          Block
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {modalType === "block" && selectedUser && (
        <BlockModal user={selectedUser} onClose={() => setModalType(null)} onSuccess={loadUsers} />
      )}
      {modalType === "unblock" && selectedUser && (
        <UnblockModal user={selectedUser} onClose={() => setModalType(null)} onSuccess={loadUsers} />
      )}
    </div>
  );
}

export function AdminHospitalsPage() {
  const [query, setQuery] = useState("");
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [modalType, setModalType] = useState<"block" | "unblock" | null>(null);

  const loadHospitals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getHospitals(query);
      setHospitals(res.hospitals || []);
    } catch (err) {
      console.error("[AdminHospitals] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(loadHospitals, 300);
    return () => clearTimeout(timer);
  }, [loadHospitals]);

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full sm:w-80">
        <SearchInput placeholder="Search hospitals by facility name..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <Card padded={false} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-text-secondary text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Hospital Facility</th>
              <th className="text-left px-4 py-3 font-semibold">Address / Contact</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Restriction</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading hospital facilities...</td>
              </tr>
            ) : hospitals.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No hospital facilities found.</td>
              </tr>
            ) : (
              hospitals.map((h) => {
                const isBlocked = h.status === "BLOCKED";
                return (
                  <tr key={h.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-navy">
                      <p className="font-bold text-navy">{h.name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p>{h.address || "No address"}</p>
                      <p className="text-slate-400">{h.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={isBlocked ? "critical" : "available"}>
                        {isBlocked ? "BLOCKED" : h.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                      {isBlocked ? (h.activeRestriction?.reason || "Restricted by admin") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isBlocked ? (
                        <Button
                          variant="success"
                          size="sm"
                          icon={<ShieldOff className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setSelectedUser({ id: h.userId, name: h.name, email: h.name, activeRestriction: h.activeRestriction });
                            setModalType("unblock");
                          }}
                        >
                          Unblock
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          icon={<ShieldAlert className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setSelectedUser({ id: h.userId, name: h.name, email: h.name, role: "HOSPITAL" });
                            setModalType("block");
                          }}
                        >
                          Block
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {modalType === "block" && selectedUser && (
        <BlockModal user={selectedUser} onClose={() => setModalType(null)} onSuccess={loadHospitals} />
      )}
      {modalType === "unblock" && selectedUser && (
        <UnblockModal user={selectedUser} onClose={() => setModalType(null)} onSuccess={loadHospitals} />
      )}
    </div>
  );
}

export function AdminEmergenciesPage() {
  const toneMap = { Critical: "critical", Urgent: "urgent", Stable: "stable" } as const;
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Existing UI Component */}
    </div>
  );
}

export function AdminAuditLogsPage() {
  const [tab, setTab] = useState<"logs" | "blocklist">("logs");
  const [logs, setLogs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === "logs") {
      adminApi.getAuditLogs().then((res) => setLogs(res.logs || [])).finally(() => setLoading(false));
    } else {
      adminApi.getBlocklistHistory().then((res) => setHistory(res.history || [])).finally(() => setLoading(false));
    }
  }, [tab]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setTab("logs")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition ${tab === "logs" ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          Security Audit Logs
        </button>
        <button
          onClick={() => setTab("blocklist")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition ${tab === "blocklist" ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          Blocklist & Restriction Audit History
        </button>
      </div>

      <Card padded={false} className="overflow-x-auto">
        {tab === "logs" ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-text-secondary text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">User</th>
                <th className="text-left px-4 py-3 font-semibold">Action</th>
                <th className="text-left px-4 py-3 font-semibold">Details</th>
                <th className="text-left px-4 py-3 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Loading audit logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No audit logs recorded yet.</td></tr>
              ) : (
                logs.map((a) => (
                  <tr key={a.id} className="border-t border-slate-50">
                    <td className="px-4 py-3 text-navy font-medium">{a.user?.email || a.userId || "System"}</td>
                    <td className="px-4 py-3"><Badge tone="neutral">{a.action}</Badge></td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600 max-w-sm truncate">{JSON.stringify(a.details || {})}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(a.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-text-secondary text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Target Account</th>
                <th className="text-left px-4 py-3 font-semibold">Target Type</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Reason</th>
                <th className="text-left px-4 py-3 font-semibold">Created By</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading restriction history...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No restriction records found.</td></tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="border-t border-slate-50">
                    <td className="px-4 py-3 font-medium text-navy">{h.targetUser?.name} ({h.targetUser?.email})</td>
                    <td className="px-4 py-3"><Badge tone="neutral">{h.targetType}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={h.status === "ACTIVE" ? "critical" : "stable"}>{h.status}</Badge></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{h.reason}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{h.createdByUser?.email || h.createdBy}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(h.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export function AdminHospitalRegistryPage() {
  return (
    <Card className="max-w-2xl">
      <p className="font-bold text-navy mb-4">Add a hospital</p>
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <Input label="Facility name" placeholder="Hospital name" />
        <Input label="Region" placeholder="State/Region" />
        <Input label="Total beds" type="number" placeholder="0" />
        <Input label="ICU beds" type="number" placeholder="0" />
      </div>
      <Button variant="primary">Submit for verification</Button>
    </Card>
  );
}

export function AdminAnalyticsPage() {
  return (
    <Card>
      <p className="font-semibold text-navy text-sm mb-2">Network analytics</p>
      <p className="text-sm text-slate-500">Detailed analytics mirror the Admin Dashboard charts — see Dashboard tab.</p>
    </Card>
  );
}

export function AdminRolesPage() {
  const roles = [
    { role: "Patient", perms: ["Create emergency", "View own cases", "Manage Health Pack"] },
    { role: "Hospital", perms: ["View incoming cases", "Accept/reject cases", "Update capacity"] },
    { role: "Doctor", perms: ["View assigned cases", "Access Health Pack", "Add clinical notes"] },
    { role: "Admin", perms: ["Manage users", "Manage hospitals", "View audit logs", "Block/Unblock Accounts"] },
  ];
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {roles.map((r) => (
        <Card key={r.role}>
          <p className="font-bold text-navy mb-3">{r.role}</p>
          <ul className="text-sm text-slate-600 space-y-1.5">
            {r.perms.map((p) => <li key={p}>• {p}</li>)}
          </ul>
        </Card>
      ))}
    </div>
  );
}

export function AdminSettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [credModal, setCredModal] = useState<{ open: boolean; type: "EMAIL" | "MOBILE"; currentValue: string }>({
    open: false,
    type: "EMAIL",
    currentValue: "",
  });

  const loadProfile = useCallback(async () => {
    try {
      const res = await settingsApi.getProfile();
      setProfile(res.data);
    } catch (err) {
      console.error("[AdminSettings] Failed to load profile:", err);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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

  return (
    <div className="max-w-lg flex flex-col gap-6">
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-bold text-navy text-lg mb-1">{profile?.email || "Loading..."}</p>
            <p className="text-xs text-slate-500">Administrator Privileged Account</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCredModal({ open: true, type: "EMAIL", currentValue: profile?.email || "" })}
          >
            Update Email
          </Button>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-3">
          <div>
            <span className="font-medium text-slate-400">Mobile Phone: </span>
            <span className="font-semibold text-navy">{profile?.phone || "Not set"}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCredModal({ open: true, type: "MOBILE", currentValue: profile?.phone || "" })}
          >
            Update Mobile
          </Button>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Badge tone="critical">SUPER ADMIN</Badge>
          <Badge tone="available">ACTIVE CONTROL AUTHORITY</Badge>
        </div>
      </Card>

      <Card>
        <p className="font-bold text-navy text-base mb-4">Change Administrator Password</p>
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

      {credModal.open && (
        <CredentialUpdateModal
          type={credModal.type}
          currentValue={credModal.currentValue}
          onClose={() => setCredModal((prev) => ({ ...prev, open: false }))}
          onSuccess={() => {
            setCredModal((prev) => ({ ...prev, open: false }));
            loadProfile();
          }}
        />
      )}
    </div>
  );
}
