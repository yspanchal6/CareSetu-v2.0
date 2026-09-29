import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { adminApi, settingsApi, accountDeletionApi } from "../../services/api";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import { SearchInput, Input } from "../../components/common/Input";
import Button from "../../components/common/Button";
import { useToast } from "../../components/common/Toast";
import { 
  ShieldAlert, CheckCircle, ShieldOff, Lock, UserCheck, AlertTriangle, UserX, Trash2, 
  CheckCircle2, XCircle, Clock, X, Siren, RefreshCw, Activity, Building2, AlertCircle, 
  Plus, FileCheck, Download, Calendar, TrendingUp, TrendingDown, Minus, Info, 
  ShieldCheck, FileSpreadsheet, ChevronRight, Filter, Layers, PieChart as PieIcon, 
  BarChart2, BedDouble, HeartPulse, History, Search, Database 
} from "lucide-react";
import { 
  LineChart as ReLineChart, Line, BarChart as ReBarChart, Bar, PieChart as RePieChart, 
  Pie, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend 
} from "recharts";
import CredentialUpdateModal from "../../components/common/CredentialUpdateModal";
import { useTranslation } from "../../i18n";

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
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [inspectHospital, setInspectHospital] = useState<any>(null);
  const [rejectHospitalItem, setRejectHospitalItem] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [blockModalType, setBlockModalType] = useState<"block" | "unblock" | null>(null);

  const loadVerificationRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getHospitalVerificationRequests(statusFilter, query);
      setRequests(res.requests || []);
    } catch (err) {
      console.error("[AdminHospitals] Verification load error:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, query]);

  useEffect(() => {
    const timer = setTimeout(loadVerificationRequests, 300);
    return () => clearTimeout(timer);
  }, [loadVerificationRequests]);

  const handleApprove = async (hospitalId: string) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await adminApi.approveHospital(hospitalId);
      setInspectHospital(null);
      await loadVerificationRequests();
    } catch (err: any) {
      setActionError(err.message || "Failed to approve hospital verification request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setActionError("Rejection feedback reason is required.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await adminApi.rejectHospital(rejectHospitalItem.id || rejectHospitalItem.hospitalId, rejectReason.trim());
      setRejectHospitalItem(null);
      setRejectReason("");
      setInspectHospital(null);
      await loadVerificationRequests();
    } catch (err: any) {
      setActionError(err.message || "Failed to submit rejection feedback.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header & Status Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "ALL", label: "All Hospitals" },
            { id: "PENDING_REVIEW", label: "Pending Review" },
            { id: "APPROVED", label: "Approved" },
            { id: "REJECTED", label: "Rejected" },
            { id: "BLOCKED", label: "Blocked" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === tab.id
                  ? "bg-navy text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <SearchInput
            placeholder="Search name, city, email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table */}
      <Card padded={false} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-text-secondary text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Hospital Facility</th>
              <th className="text-left px-4 py-3 font-semibold">Address & Coordinates</th>
              <th className="text-left px-4 py-3 font-semibold">Uploaded Documents</th>
              <th className="text-left px-4 py-3 font-semibold">Verification Status</th>
              <th className="text-right px-4 py-3 font-semibold">Admin Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Loading hospital verification requests...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No hospital verification requests found for this filter.
                </td>
              </tr>
            ) : (
              requests.map((item) => {
                const isApproved = item.verificationStatus === "APPROVED";
                const isPending = item.verificationStatus === "PENDING_REVIEW";
                const isRejected = item.verificationStatus === "REJECTED";
                const isBlocked = item.verificationStatus === "BLOCKED";

                return (
                  <tr key={item.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-navy">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.email}</p>
                      <p className="text-xs text-slate-400">{item.phone}</p>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p className="font-medium text-navy">{item.address || "No street address"}</p>
                      <p className="text-slate-500">{item.city}{item.state ? `, ${item.state}` : ""}</p>
                      {item.location?.latitude && item.location?.longitude ? (
                        <p className="font-mono text-[11px] text-slate-400">
                          GPS: ({Number(item.location.latitude).toFixed(3)}, {Number(item.location.longitude).toFixed(3)})
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-3 text-xs">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-700 text-[11px]">
                        📄 {item.documents?.length || 0} File{(item.documents?.length || 0) !== 1 ? "s" : ""}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          isApproved ? "available" : isPending ? "busy" : isRejected ? "critical" : "critical"
                        }
                      >
                        {item.verificationStatus}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInspectHospital(item)}
                      >
                        Review / Inspect
                      </Button>

                      {isPending && (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleApprove(item.id || item.hospitalId)}
                          >
                            Approve
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setRejectHospitalItem(item)}
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      {!isBlocked && !isPending && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => {
                            setSelectedUser({ id: item.userId, name: item.name, role: "HOSPITAL" });
                            setBlockModalType("block");
                          }}
                        >
                          Block
                        </Button>
                      )}

                      {isBlocked && (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => {
                            setSelectedUser({ id: item.userId, name: item.name, role: "HOSPITAL" });
                            setBlockModalType("unblock");
                          }}
                        >
                          Unblock
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

      {/* Detailed Inspection Modal */}
      {inspectHospital && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-navy text-lg">{inspectHospital.name}</h3>
                <p className="text-xs text-slate-500">Hospital Application Details & Document Audit</p>
              </div>
              <button
                onClick={() => setInspectHospital(null)}
                className="text-slate-400 hover:text-navy text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="font-semibold text-slate-500">Contact Details</p>
                <p className="font-bold text-navy mt-1">{inspectHospital.email}</p>
                <p className="text-slate-700">{inspectHospital.phone}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="font-semibold text-slate-500">Location Coordinates</p>
                <p className="font-bold text-navy mt-1">{inspectHospital.address}</p>
                <p className="text-slate-700">
                  {inspectHospital.city}, {inspectHospital.state}
                </p>
              </div>
            </div>

            {/* Uploaded Documents List */}
            <div className="space-y-2">
              <p className="font-bold text-navy text-xs uppercase tracking-wider">Uploaded Documents ({inspectHospital.documents?.length || 0})</p>
              {(!inspectHospital.documents || inspectHospital.documents.length === 0) ? (
                <p className="text-xs text-slate-400 italic">No documents uploaded during initial onboarding.</p>
              ) : (
                <div className="space-y-1.5">
                  {inspectHospital.documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs">
                      <div>
                        <p className="font-bold text-navy">{doc.title || doc.documentType}</p>
                        <p className="text-[11px] text-slate-400">Uploaded {new Date(doc.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Badge tone="available">
                        {doc.documentType}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Admin Action Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              {inspectHospital.verificationStatus === "PENDING_REVIEW" && (
                <>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200"
                    onClick={() => setRejectHospitalItem(inspectHospital)}
                  >
                    Reject Application
                  </Button>
                  <Button
                    variant="success"
                    disabled={actionLoading}
                    onClick={() => handleApprove(inspectHospital.id || inspectHospital.hospitalId)}
                  >
                    Approve Application
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={() => setInspectHospital(null)}>
                Close Inspection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Feedback Modal */}
      {rejectHospitalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleRejectSubmit} className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100 flex flex-col gap-4">
            <h3 className="font-bold text-navy text-lg">Reject Hospital Application</h3>
            <p className="text-xs text-slate-600">
              Please provide clear feedback explaining why <strong>{rejectHospitalItem.name}</strong> requires correction.
            </p>

            {actionError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                {actionError}
              </div>
            )}

            <textarea
              className="w-full border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-primary outline-none"
              rows={4}
              placeholder="Enter feedback for hospital user (e.g. Invalid registration license uploaded. Upload clear PDF)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setRejectHospitalItem(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="bg-red-600 hover:bg-red-700" disabled={actionLoading}>
                {actionLoading ? "Submitting..." : "Submit Rejection Feedback"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Block & Unblock Modals */}
      {blockModalType === "block" && selectedUser && (
        <BlockModal user={selectedUser} onClose={() => setBlockModalType(null)} onSuccess={loadVerificationRequests} />
      )}
      {blockModalType === "unblock" && selectedUser && (
        <UnblockModal user={selectedUser} onClose={() => setBlockModalType(null)} onSuccess={loadVerificationRequests} />
      )}
    </div>
  );
}

export function AdminEmergenciesPage() {
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [selectedCase, setSelectedCase] = useState<any | null>(null);

  const loadEmergencies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getEmergencies();
      if (res && res.success && Array.isArray(res.emergencies)) {
        setEmergencies(res.emergencies);
      } else {
        setEmergencies([]);
      }
    } catch (err: any) {
      console.error("[AdminEmergenciesPage] Error fetching emergency cases:", err);
      setError(err.message || "Failed to retrieve emergency case information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmergencies();
  }, [loadEmergencies]);

  // Derived filtered emergencies
  const filteredCases = emergencies.filter((c) => {
    const matchesSearch =
      !search ||
      (c.id && c.id.toLowerCase().includes(search.toLowerCase())) ||
      (c.patientName && c.patientName.toLowerCase().includes(search.toLowerCase())) ||
      (c.requiredCapability && c.requiredCapability.toLowerCase().includes(search.toLowerCase())) ||
      (c.assignedHospital && c.assignedHospital.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" ||
      (c.status && c.status.toUpperCase() === statusFilter.toUpperCase());

    const matchesSeverity =
      severityFilter === "ALL" ||
      (c.severity && c.severity.toLowerCase() === severityFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  // Calculate summary counts
  const totalCount = emergencies.length;
  const activeCount = emergencies.filter((c) =>
    ["PENDING", "MATCHING", "HOSPITAL_REQUESTED", "ACCEPTED", "IN_PROGRESS"].includes(
      (c.status || "").toUpperCase()
    )
  ).length;
  const criticalCount = emergencies.filter(
    (c) => (c.severity || "").toLowerCase() === "critical"
  ).length;
  const urgentCount = emergencies.filter(
    (c) => (c.severity || "").toLowerCase() === "urgent"
  ).length;

  const toneMap: Record<string, "critical" | "urgent" | "stable"> = {
    Critical: "critical",
    Urgent: "urgent",
    Stable: "stable",
  };

  const getStatusBadgeTone = (status: string): "accepted" | "rejected" | "pending" | "neutral" => {
    const st = (status || "").toUpperCase();
    if (st === "ACCEPTED" || st === "COMPLETED") return "accepted";
    if (st === "PENDING" || st === "MATCHING" || st === "HOSPITAL_REQUESTED") return "pending";
    if (st === "CANCELLED" || st === "REJECTED") return "rejected";
    return "neutral";
  };

  return (
    <div className="flex flex-col gap-6 p-1">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shadow-xs">
              <Siren className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Emergency Cases</h1>
              <p className="text-sm text-slate-500">
                Monitor and oversee real-time emergency dispatches, hospital assignments, and active patient cases.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadEmergencies}
            disabled={loading}
            className="flex items-center gap-2 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Emergencies</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{totalCount}</span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600"><Activity className="w-4 h-4" /></span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Active Dispatches</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-900">{activeCount}</span>
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700"><Clock className="w-4 h-4" /></span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-red-200/80 bg-red-50/20 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Critical Priority</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-red-900">{criticalCount}</span>
            <span className="p-1.5 rounded-lg bg-red-100 text-red-700"><AlertTriangle className="w-4 h-4" /></span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200/80 bg-blue-50/20 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Urgent Cases</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-900">{urgentCount}</span>
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700"><ShieldAlert className="w-4 h-4" /></span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <SearchInput
            placeholder="Search by Case ID, Patient, Symptoms, Hospital..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="MATCHING">MATCHING</option>
              <option value="ACCEPTED">ACCEPTED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20"
            >
              <option value="ALL">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="Urgent">Urgent</option>
              <option value="Stable">Stable</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4 animate-pulse">
            <Siren className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Loading Emergency Cases...</p>
          <p className="text-xs text-slate-400 mt-1">Retrieving latest emergency dispatches from CareSetu system.</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-red-900 text-sm">Unable to Load Emergency Cases</h3>
              <p className="text-xs text-red-700 mt-0.5">We couldn't retrieve the latest emergency case information. Please try again.</p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={loadEmergencies} className="shrink-0">
            Retry
          </Button>
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
            <Siren className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Emergency Cases Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            There are currently no emergency cases matching your criteria or requiring immediate attention in the database.
          </p>
          <Button variant="secondary" size="sm" onClick={loadEmergencies} className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Data
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Case ID</th>
                  <th className="px-5 py-3.5">Severity</th>
                  <th className="px-5 py-3.5">Patient Name</th>
                  <th className="px-5 py-3.5">Required / Symptoms</th>
                  <th className="px-5 py-3.5">Assigned Hospital</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCases.map((c) => {
                  const tone = toneMap[c.severity] || "stable";
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-slate-900">{c.id}</td>
                      <td className="px-5 py-4">
                        <Badge tone={tone}>{c.severity}</Badge>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-800">{c.patientName}</td>
                      <td className="px-5 py-4 text-slate-600 max-w-xs truncate">{c.requiredCapability}</td>
                      <td className="px-5 py-4">
                        {c.assignedHospital ? (
                          <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {c.assignedHospital}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={getStatusBadgeTone(c.status)}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCase(c)}
                          className="text-xs font-semibold text-navy hover:text-navy/80"
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Case Details Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <Siren className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Case Details</h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedCase.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                <div>
                  <span className="text-slate-400 font-medium block">Patient Name</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedCase.patientName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Severity Level</span>
                  <span className="mt-1 inline-block">
                    <Badge tone={toneMap[selectedCase.severity] || "stable"}>
                      {selectedCase.severity}
                    </Badge>
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-medium block mb-1">Symptoms / Required Capability</span>
                <div className="p-3 bg-slate-50 rounded-xl text-slate-700 font-medium border border-slate-200/60">
                  {selectedCase.requiredCapability || "General Emergency"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 font-medium block mb-1">Assigned Hospital</span>
                  <div className="p-2.5 bg-slate-50 rounded-xl text-slate-800 font-semibold border border-slate-200/60 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    {selectedCase.assignedHospital || "None (Unassigned)"}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-medium block mb-1">Dispatch Status</span>
                  <div className="p-2.5 bg-slate-50 rounded-xl font-semibold border border-slate-200/60">
                    <Badge tone={getStatusBadgeTone(selectedCase.status)}>
                      {selectedCase.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setSelectedCase(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
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
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Search, Filter & Sort State
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [ownershipFilter, setOwnershipFilter] = useState<string>("ALL");
  const [securityFilter, setSecurityFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("NEWEST");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Add Hospital Form Toggle & State
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    hospitalType: "Government",
    ownership: "Government",
    registrationId: "",
    state: "",
    district: "",
    city: "",
    address: "",
    latitude: "",
    longitude: "",
    totalBeds: "",
    icuBeds: "",
    emergencyAvailable: "Available",
  });

  // Modal Inspection & Action states
  const [selectedHospital, setSelectedHospital] = useState<any | null>(null);
  const [approveModalHospital, setApproveModalHospital] = useState<any | null>(null);
  const [rejectModalHospital, setRejectModalHospital] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Keyboard ESC Listener to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedHospital(null);
        setApproveModalHospital(null);
        setRejectModalHospital(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadRegistry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getHospitalVerificationRequests("ALL");
      if (res && res.success && Array.isArray(res.requests)) {
        setHospitals(res.requests);
      } else {
        setHospitals([]);
      }
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error("[AdminHospitalRegistryPage] Error loading registry:", err);
      setError(err.message || "Unable to load hospital registry data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  // Field validation handler
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Facility name is required.";
    if (!formData.email.trim()) {
      errors.email = "Official email address is required.";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Please enter a valid email address.";
    }
    if (!formData.phone.trim()) errors.phone = "Contact phone number is required.";
    if (!formData.registrationId.trim()) errors.registrationId = "Registration / License ID is required.";

    const totalBedsNum = parseInt(formData.totalBeds) || 0;
    const icuBedsNum = parseInt(formData.icuBeds) || 0;

    if (totalBedsNum < 0) errors.totalBeds = "Total beds cannot be negative.";
    if (icuBedsNum < 0) errors.icuBeds = "ICU beds cannot be negative.";
    if (icuBedsNum > totalBedsNum) errors.icuBeds = "ICU beds count cannot exceed total beds.";

    // Duplicate check
    const isDup = hospitals.some(
      h => (h.registrationId || "").toLowerCase() === formData.registrationId.trim().toLowerCase()
    );
    if (isDup) errors.registrationId = `Hospital with Registration ID '${formData.registrationId}' already exists.`;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form Submission
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm()) return;

    const totalBedsNum = parseInt(formData.totalBeds) || 0;
    const icuBedsNum = parseInt(formData.icuBeds) || 0;

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        hospitalType: formData.hospitalType,
        ownership: formData.ownership,
        registrationId: formData.registrationId.trim(),
        state: formData.state.trim(),
        district: formData.district.trim(),
        city: formData.city.trim(),
        address: formData.address.trim(),
        latitude: formData.latitude,
        longitude: formData.longitude,
        totalBeds: totalBedsNum,
        icuBeds: icuBedsNum,
        emergencyAvailable: formData.emergencyAvailable === "Available",
      };

      const res = await adminApi.registerHospital(payload);
      if (res && res.success) {
        showToast("success", "Hospital facility registered and submitted for verification.");
        setFormData({
          name: "",
          email: "",
          phone: "",
          hospitalType: "Government",
          ownership: "Government",
          registrationId: "",
          state: "",
          district: "",
          city: "",
          address: "",
          latitude: "",
          longitude: "",
          totalBeds: "",
          icuBeds: "",
          emergencyAvailable: "Available",
        });
        setFieldErrors({});
        setShowAddForm(false);
        loadRegistry();
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to register hospital facility.");
    } finally {
      setSubmitting(false);
    }
  };

  // Approval Workflow
  const handleApproveConfirm = async () => {
    if (!approveModalHospital) return;
    setActionLoading(true);
    try {
      const res = await adminApi.approveHospital(approveModalHospital.id || approveModalHospital.hospitalId);
      if (res && res.success) {
        showToast("success", `${approveModalHospital.name} has been approved and activated.`);
        if (selectedHospital && (selectedHospital.id === approveModalHospital.id || selectedHospital.hospitalId === approveModalHospital.hospitalId)) {
          setSelectedHospital(null);
        }
        setApproveModalHospital(null);
        loadRegistry();
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to approve hospital.");
    } finally {
      setActionLoading(false);
    }
  };

  // Rejection Workflow
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      showToast("error", "Rejection reason is required before submitting.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await adminApi.rejectHospital(rejectModalHospital.id || rejectModalHospital.hospitalId, rejectionReason.trim());
      if (res && res.success) {
        showToast("success", `${rejectModalHospital.name} registration application rejected.`);
        setRejectModalHospital(null);
        setRejectionReason("");
        if (selectedHospital && (selectedHospital.id === rejectModalHospital.id || selectedHospital.hospitalId === rejectModalHospital.hospitalId)) {
          setSelectedHospital(null);
        }
        loadRegistry();
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to reject hospital application.");
    } finally {
      setActionLoading(false);
    }
  };

  // Clear Filters Action
  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setOwnershipFilter("ALL");
    setSecurityFilter("ALL");
    setSortBy("NEWEST");
    setCurrentPage(1);
  };

  // Filter & Search & Sort Data Pipeline
  const filteredHospitals = hospitals.filter((h) => {
    const q = debouncedSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (h.name && h.name.toLowerCase().includes(q)) ||
      (h.email && h.email.toLowerCase().includes(q)) ||
      (h.registrationId && h.registrationId.toLowerCase().includes(q)) ||
      (h.city && h.city.toLowerCase().includes(q)) ||
      (h.district && h.district.toLowerCase().includes(q)) ||
      (h.state && h.state.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "PENDING" && (h.verificationStatus === "PENDING_REVIEW" || h.verificationStatus === "PENDING")) ||
      (statusFilter === "APPROVED" && (h.verificationStatus === "APPROVED" || h.isVerified)) ||
      (statusFilter === "REJECTED" && h.verificationStatus === "REJECTED") ||
      (statusFilter === "BLOCKED" && (h.verificationStatus === "BLOCKED" || h.securityStatus === "TEMPORARILY_BLOCKED" || h.userStatus === "BLOCKED"));

    const matchesType =
      typeFilter === "ALL" ||
      (h.hospitalType && h.hospitalType.toLowerCase() === typeFilter.toLowerCase());

    const matchesOwnership =
      ownershipFilter === "ALL" ||
      (h.ownership && h.ownership.toLowerCase() === ownershipFilter.toLowerCase());

    const matchesSecurity =
      securityFilter === "ALL" ||
      (securityFilter === "ACTIVE" && (h.securityStatus === "ACTIVE" || !h.securityStatus)) ||
      (securityFilter === "UNDER_REVIEW" && h.securityStatus === "UNDER_REVIEW") ||
      (securityFilter === "TEMPORARILY_BLOCKED" && (h.securityStatus === "TEMPORARILY_BLOCKED" || h.userStatus === "BLOCKED"));

    return matchesSearch && matchesStatus && matchesType && matchesOwnership && matchesSecurity;
  });

  // Sorting
  const sortedHospitals = [...filteredHospitals].sort((a, b) => {
    if (sortBy === "NEWEST") return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    if (sortBy === "OLDEST") return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    if (sortBy === "NAME_ASC") return (a.name || "").localeCompare(b.name || "");
    if (sortBy === "NAME_DESC") return (b.name || "").localeCompare(a.name || "");
    if (sortBy === "BEDS_DESC") return (b.totalBeds || 0) - (a.totalBeds || 0);
    if (sortBy === "BEDS_ASC") return (a.totalBeds || 0) - (b.totalBeds || 0);
    return 0;
  });

  // Summary Counts
  const totalHospitals = hospitals.length;
  const pendingCount = hospitals.filter(h => h.verificationStatus === "PENDING_REVIEW" || (!h.isVerified && h.verificationStatus !== "REJECTED" && h.verificationStatus !== "BLOCKED")).length;
  const approvedCount = hospitals.filter(h => h.isVerified || h.verificationStatus === "APPROVED").length;
  const blockedCount = hospitals.filter(h => h.verificationStatus === "BLOCKED" || h.securityStatus === "TEMPORARILY_BLOCKED" || h.userStatus === "BLOCKED").length;

  // Pagination
  const totalPages = Math.ceil(sortedHospitals.length / pageSize) || 1;
  const paginatedHospitals = sortedHospitals.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const hasActiveFilters = Boolean(
    search || statusFilter !== "ALL" || typeFilter !== "ALL" || ownershipFilter !== "ALL" || securityFilter !== "ALL" || sortBy !== "NEWEST"
  );

  const getVerificationTone = (status: string, isVerified: boolean): "accepted" | "pending" | "rejected" | "critical" | "neutral" => {
    if (isVerified || status === "APPROVED") return "accepted";
    if (status === "REJECTED") return "rejected";
    if (status === "BLOCKED") return "critical";
    return "pending";
  };

  const getSecurityTone = (secStatus: string): "accepted" | "urgent" | "critical" | "neutral" => {
    if (secStatus === "TEMPORARILY_BLOCKED" || secStatus === "BLOCKED") return "critical";
    if (secStatus === "UNDER_REVIEW") return "urgent";
    if (secStatus === "ACTIVE") return "accepted";
    return "neutral";
  };

  return (
    <div className="flex flex-col gap-6 p-1 transition-all duration-200 motion-reduce:transition-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy/10 text-navy flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t("nav.hospitalRegistry") || "Hospital Registry"}</h1>
              <p className="text-sm text-slate-500">
                Register, verify, monitor, and manage CareSetu hospital facilities.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium hidden md:inline">
            Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadRegistry}
            disabled={loading}
            className="flex items-center gap-2 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            {showAddForm ? "Close Form" : "Add Hospital"}
          </Button>
        </div>
      </div>

      {/* Summary Cards with Click-to-Filter Action */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => { setStatusFilter("ALL"); setSecurityFilter("ALL"); setCurrentPage(1); }}
          className={`text-left p-4 rounded-2xl border transition-all duration-150 flex flex-col justify-between hover:shadow-md ${
            statusFilter === "ALL" && securityFilter === "ALL"
              ? "bg-navy/5 border-navy/40 shadow-xs ring-2 ring-navy/20"
              : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
          }`}
        >
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Hospitals</span>
          <div className="mt-2 flex items-baseline justify-between w-full">
            <span className="text-2xl font-black text-slate-900">{totalHospitals}</span>
            <span className="p-1.5 rounded-lg bg-navy/10 text-navy"><Building2 className="w-4 h-4" /></span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block font-medium">Click to view all</span>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter("PENDING"); setSecurityFilter("ALL"); setCurrentPage(1); }}
          className={`text-left p-4 rounded-2xl border transition-all duration-150 flex flex-col justify-between hover:shadow-md ${
            statusFilter === "PENDING"
              ? "bg-amber-100/60 border-amber-400 shadow-xs ring-2 ring-amber-400/30"
              : "bg-white border-amber-200/80 bg-amber-50/20 shadow-xs hover:border-amber-300"
          }`}
        >
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Pending Verification</span>
          <div className="mt-2 flex items-baseline justify-between w-full">
            <span className="text-2xl font-black text-amber-900">{pendingCount}</span>
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700"><Clock className="w-4 h-4" /></span>
          </div>
          <span className="text-[11px] text-amber-600 mt-2 block font-medium">Click to view pending</span>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter("APPROVED"); setSecurityFilter("ALL"); setCurrentPage(1); }}
          className={`text-left p-4 rounded-2xl border transition-all duration-150 flex flex-col justify-between hover:shadow-md ${
            statusFilter === "APPROVED"
              ? "bg-emerald-100/60 border-emerald-400 shadow-xs ring-2 ring-emerald-400/30"
              : "bg-white border-emerald-200/80 bg-emerald-50/20 shadow-xs hover:border-emerald-300"
          }`}
        >
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Approved Facilities</span>
          <div className="mt-2 flex items-baseline justify-between w-full">
            <span className="text-2xl font-black text-emerald-900">{approvedCount}</span>
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-4 h-4" /></span>
          </div>
          <span className="text-[11px] text-emerald-600 mt-2 block font-medium">Click to view approved</span>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter("BLOCKED"); setSecurityFilter("TEMPORARILY_BLOCKED"); setCurrentPage(1); }}
          className={`text-left p-4 rounded-2xl border transition-all duration-150 flex flex-col justify-between hover:shadow-md ${
            statusFilter === "BLOCKED" || securityFilter === "TEMPORARILY_BLOCKED"
              ? "bg-rose-100/60 border-rose-400 shadow-xs ring-2 ring-rose-400/30"
              : "bg-white border-rose-200/80 bg-rose-50/20 shadow-xs hover:border-rose-300"
          }`}
        >
          <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Blocked Facilities</span>
          <div className="mt-2 flex items-baseline justify-between w-full">
            <span className="text-2xl font-black text-rose-900">{blockedCount}</span>
            <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700"><ShieldAlert className="w-4 h-4" /></span>
          </div>
          <span className="text-[11px] text-rose-600 mt-2 block font-medium">Click to view blocked</span>
        </button>
      </div>

      {/* Add Hospital Form (Collapsible Card with Inline Validation) */}
      {showAddForm && (
        <Card className="border border-navy/20 shadow-md bg-white animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-navy" />
              <h3 className="font-bold text-navy text-base">Register New Hospital Facility</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">CareSetu Verification Workflow</span>
          </div>

          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              {formError}
            </div>
          )}

          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Input
                  label="Facility Name *"
                  placeholder="e.g. City Care General Hospital"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: "" });
                  }}
                  required
                />
                {fieldErrors.name && <p className="text-[11px] font-medium text-red-600 mt-1">{fieldErrors.name}</p>}
              </div>

              <div>
                <Input
                  label="Official Email *"
                  type="email"
                  placeholder="admin@hospital.org"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: "" });
                  }}
                  required
                />
                {fieldErrors.email && <p className="text-[11px] font-medium text-red-600 mt-1">{fieldErrors.email}</p>}
              </div>

              <div>
                <Input
                  label="Contact Number *"
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: "" });
                  }}
                  required
                />
                {fieldErrors.phone && <p className="text-[11px] font-medium text-red-600 mt-1">{fieldErrors.phone}</p>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Hospital Type *</label>
                <select
                  value={formData.hospitalType}
                  onChange={(e) => setFormData({ ...formData, hospitalType: e.target.value })}
                  className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
                >
                  <option value="Government">Government</option>
                  <option value="Private">Private</option>
                  <option value="Trust / NGO">Trust / NGO</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Ownership *</label>
                <select
                  value={formData.ownership}
                  onChange={(e) => setFormData({ ...formData, ownership: e.target.value })}
                  className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
                >
                  <option value="Government">Government</option>
                  <option value="Private">Private</option>
                </select>
              </div>

              <div>
                <Input
                  label="Registration / License ID *"
                  placeholder="e.g. HOS-MH-2026-8812"
                  value={formData.registrationId}
                  onChange={(e) => {
                    setFormData({ ...formData, registrationId: e.target.value });
                    if (fieldErrors.registrationId) setFieldErrors({ ...fieldErrors, registrationId: "" });
                  }}
                  required
                />
                {fieldErrors.registrationId && <p className="text-[11px] font-medium text-red-600 mt-1">{fieldErrors.registrationId}</p>}
              </div>

              <Input
                label="State"
                placeholder="e.g. Maharashtra"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
              <Input
                label="District"
                placeholder="e.g. Pune"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              />
              <Input
                label="City"
                placeholder="e.g. Pune"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />

              <div className="sm:col-span-2 md:col-span-3">
                <Input
                  label="Full Address"
                  placeholder="Street name, landmark, PIN code"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <Input
                label="Latitude"
                type="number"
                step="any"
                placeholder="18.5204"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              />
              <Input
                label="Longitude"
                type="number"
                step="any"
                placeholder="73.8567"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              />

              <div>
                <Input
                  label="Total Beds"
                  type="number"
                  placeholder="100"
                  value={formData.totalBeds}
                  onChange={(e) => {
                    setFormData({ ...formData, totalBeds: e.target.value });
                    if (fieldErrors.totalBeds) setFieldErrors({ ...fieldErrors, totalBeds: "" });
                  }}
                />
                {fieldErrors.totalBeds && <p className="text-[11px] font-medium text-red-600 mt-1">{fieldErrors.totalBeds}</p>}
              </div>

              <div>
                <Input
                  label="ICU Beds"
                  type="number"
                  placeholder="20"
                  value={formData.icuBeds}
                  onChange={(e) => {
                    setFormData({ ...formData, icuBeds: e.target.value });
                    if (fieldErrors.icuBeds) setFieldErrors({ ...fieldErrors, icuBeds: "" });
                  }}
                />
                {fieldErrors.icuBeds && <p className="text-[11px] font-medium text-red-600 mt-1">{fieldErrors.icuBeds}</p>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Emergency Availability</label>
                <select
                  value={formData.emergencyAvailable}
                  onChange={(e) => setFormData({ ...formData, emergencyAvailable: e.target.value })}
                  className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
                >
                  <option value="Available">Available</option>
                  <option value="Limited">Limited</option>
                  <option value="Unavailable">Unavailable</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit for Verification"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Toolbar: Search, Filters, Sorting & Clear Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search input with Clear (X) icon */}
        <div className="relative flex-1 max-w-md">
          <SearchInput
            placeholder="Search hospital name, registration ID, email, city..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setDebouncedSearch(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20"
            >
              <option value="ALL">All Types</option>
              <option value="Government">Government</option>
              <option value="Private">Private</option>
              <option value="Trust / NGO">Trust / NGO</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Ownership:</span>
            <select
              value={ownershipFilter}
              onChange={(e) => { setOwnershipFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20"
            >
              <option value="ALL">All Ownership</option>
              <option value="Government">Government</option>
              <option value="Private">Private</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy/20"
            >
              <option value="NEWEST">Newest Registered</option>
              <option value="OLDEST">Oldest Registered</option>
              <option value="NAME_ASC">Name (A-Z)</option>
              <option value="NAME_DESC">Name (Z-A)</option>
              <option value="BEDS_DESC">Total Beds (High-Low)</option>
              <option value="BEDS_ASC">Total Beds (Low-High)</option>
            </select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-slate-50"
            >
              Clear All Filters
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-12 h-12 rounded-2xl bg-navy/10 text-navy flex items-center justify-center mb-4 animate-pulse">
            <Building2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Loading Hospital Registry...</p>
          <p className="text-xs text-slate-400 mt-1">Fetching latest hospital profiles, document verification statuses, and security metrics.</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-red-900 text-sm">Unable to Load Hospital Registry</h3>
              <p className="text-xs text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={loadRegistry} className="shrink-0">
            Retry
          </Button>
        </div>
      ) : sortedHospitals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
            <Building2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {hasActiveFilters ? "No Hospitals Match Your Search / Filters" : "No Hospitals Registered"}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            {hasActiveFilters
              ? "Try adjusting your search keywords, status filters, or click 'Clear All Filters' to reset."
              : "Add a new hospital facility above to begin the CareSetu verification process."}
          </p>
          {hasActiveFilters ? (
            <Button variant="secondary" size="sm" onClick={handleClearFilters} className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              Clear All Filters
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Hospital
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Hospital</th>
                  <th className="px-5 py-3.5">Location</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Ownership</th>
                  <th className="px-5 py-3.5">Beds (Total / ICU)</th>
                  <th className="px-5 py-3.5">Verification</th>
                  <th className="px-5 py-3.5">Security Status</th>
                  <th className="px-5 py-3.5">Registered</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedHospitals.map((h) => {
                  const verTone = getVerificationTone(h.verificationStatus, h.isVerified);
                  const secTone = getSecurityTone(h.securityStatus);
                  const isBlocked = h.securityStatus === "TEMPORARILY_BLOCKED" || h.userStatus === "BLOCKED";

                  return (
                    <tr key={h.id || h.hospitalId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 text-sm">{h.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {h.registrationId ? `ID: ${h.registrationId}` : h.email}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-800">{h.city || "Not specified"}</div>
                        <div className="text-[11px] text-slate-500">{h.state || ""}</div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-700">{h.hospitalType || "Private"}</td>
                      <td className="px-5 py-4 font-medium text-slate-700">{h.ownership || "Private"}</td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-800">{h.totalBeds ?? 0}</span>
                        <span className="text-slate-400 font-normal"> / </span>
                        <span className="font-semibold text-slate-600">{h.icuBeds ?? 0} ICU</span>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={verTone}>
                          {h.isVerified || h.verificationStatus === "APPROVED" ? "Approved" : h.verificationStatus === "REJECTED" ? "Rejected" : h.verificationStatus === "BLOCKED" ? "Blocked" : "Pending Review"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={secTone}>
                          {isBlocked ? "Temporarily Blocked" : h.securityStatus || "Active"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-500 font-medium">
                        {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedHospital(h)}
                            className="text-xs font-semibold text-navy hover:bg-slate-100"
                          >
                            View
                          </Button>

                          {(!h.isVerified && h.verificationStatus !== "APPROVED") && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setApproveModalHospital(h)}
                                disabled={actionLoading}
                                className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                              >
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setRejectModalHospital(h)}
                                disabled={actionLoading}
                                className="text-xs font-semibold"
                              >
                                Reject
                              </Button>
                            </>
                          )}

                          {isBlocked && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => navigate("/admin/security-reviews")}
                              className="text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 flex items-center gap-1"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Security Review
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">
                Showing {Math.min((currentPage - 1) * pageSize + 1, sortedHospitals.length)} to {Math.min(currentPage * pageSize, sortedHospitals.length)} of {sortedHospitals.length} hospitals
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="font-semibold text-slate-700 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hospital Details Modal */}
      {selectedHospital && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy/10 text-navy flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{selectedHospital.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Registration ID: {selectedHospital.registrationId || "N/A"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedHospital(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Security Blocked Alert Banner in Modal */}
            {(selectedHospital.securityStatus === "TEMPORARILY_BLOCKED" || selectedHospital.userStatus === "BLOCKED") && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-900 block">Security Violation Alert</span>
                    <span className="text-rose-700">
                      This hospital portal is TEMPORARILY BLOCKED due to protected-content violations.
                    </span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setSelectedHospital(null); navigate("/admin/security-reviews"); }}
                  className="bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200 text-xs shrink-0"
                >
                  View Security Review
                </Button>
              </div>
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-slate-400 font-medium block mb-1">Official Email</span>
                <span className="font-semibold text-slate-800">{selectedHospital.email}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-slate-400 font-medium block mb-1">Contact Number</span>
                <span className="font-semibold text-slate-800">{selectedHospital.phone}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-slate-400 font-medium block mb-1">Hospital Type & Ownership</span>
                <span className="font-semibold text-slate-800">
                  {selectedHospital.hospitalType || "Private"} • {selectedHospital.ownership || "Private"}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-slate-400 font-medium block mb-1">Capacity Metrics</span>
                <span className="font-semibold text-slate-800">
                  Total: {selectedHospital.totalBeds ?? 0} beds | ICU: {selectedHospital.icuBeds ?? 0} beds
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 sm:col-span-2">
                <span className="text-slate-400 font-medium block mb-1">Address & Location</span>
                <span className="font-semibold text-slate-800">
                  {selectedHospital.address || selectedHospital.city}, {selectedHospital.city}, {selectedHospital.state}
                </span>
              </div>
            </div>

            {/* Verification Documents Section */}
            <div className="mt-2">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Uploaded Verification Documents</h4>
              {selectedHospital.documents && selectedHospital.documents.length > 0 ? (
                <div className="space-y-2">
                  {selectedHospital.documents.map((doc: any) => (
                    <div key={doc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <FileCheck className="w-4 h-4 text-slate-500 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-800 block">{doc.title}</span>
                          <span className="text-slate-400 text-[11px] font-mono">{doc.documentType || "Verification Document"}</span>
                        </div>
                      </div>
                      <Badge tone="pending">Uploaded & Encrypted</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-slate-500 text-xs italic text-center">
                  No verification documents uploaded yet.
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                {(!selectedHospital.isVerified && selectedHospital.verificationStatus !== "APPROVED") ? (
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setApproveModalHospital(selectedHospital)} disabled={actionLoading}>
                      Approve Application
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setRejectModalHospital(selectedHospital)} disabled={actionLoading}>
                      Reject
                    </Button>
                  </div>
                ) : (
                  <Badge tone="accepted">Verified Facility</Badge>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={() => setSelectedHospital(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {approveModalHospital && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-emerald-600 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Approve Hospital Facility</h3>
                <p className="text-xs text-slate-500">{approveModalHospital.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to approve <strong>{approveModalHospital.name}</strong>? This action will mark the hospital registration as verified and activate full access to the CareSetu Hospital Portal.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" size="sm" onClick={() => setApproveModalHospital(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleApproveConfirm}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {actionLoading ? "Approving..." : "Approve Hospital"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModalHospital && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-600 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reject Hospital Application</h3>
                <p className="text-xs text-slate-500">{rejectModalHospital.name}</p>
              </div>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Reason for Rejection *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please specify feedback or missing documents required from the hospital..."
                  rows={3}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="secondary" size="sm" onClick={() => { setRejectModalHospital(null); setRejectionReason(""); }}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger" size="sm" disabled={actionLoading}>
                  {actionLoading ? "Submitting..." : "Confirm Rejection"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminAnalyticsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();

  // State Management
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showDefsModal, setShowDefsModal] = useState<boolean>(false);

  // Filters State
  const [dateRange, setDateRange] = useState<string>("30d");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");

  // Fetch Analytics Data
  const fetchAnalytics = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setApiError(null);

    try {
      const res = await adminApi.getAnalytics({
        dateRange,
        startDate: dateRange === "custom" ? startDate : undefined,
        endDate: dateRange === "custom" ? endDate : undefined,
        status: statusFilter,
        platform: platformFilter,
      });

      if (res && res.success) {
        setAnalytics(res);
        setLastUpdated(new Date());
        if (isManual) {
          showToast("success", "Analytics data refreshed.");
        }
      } else {
        setApiError(res?.message || "Unable to load analytics data.");
      }
    } catch (err: any) {
      console.error("[AdminAnalyticsPage] API Fetch Error:", err);
      setApiError(err.message || "Unable to load analytics data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, startDate, endDate, statusFilter, platformFilter, showToast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Keyboard Escape listener for definitions modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDefsModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!analytics || apiError) return;
    const { overview } = analytics;
    const csvRows = [
      ["CareSetu Admin Analytics Export"],
      ["Generated At", new Date().toISOString()],
      ["Date Range Filter", dateRange],
      [],
      ["Metric Category", "Metric Name", "Value"],
      ["Hospital Network", "Total Hospitals", overview.totalHospitals],
      ["Hospital Network", "Approved Hospitals", overview.approvedHospitals],
      ["Hospital Network", "Pending Hospitals", overview.pendingHospitals],
      ["Hospital Network", "Blocked Hospitals", overview.blockedHospitals],
      ["Hospital Network", "Total Registered Beds", overview.totalBeds],
      ["Hospital Network", "Total ICU Beds", overview.totalIcuBeds],
      ["Emergency Operations", "Total Emergencies Recorded", overview.totalEmergencies],
      ["Emergency Operations", "Completed Emergencies", overview.completedEmergencies],
      ["Hospital Matching", "Total Matching Requests", overview.totalMatchingRequests],
      ["Hospital Matching", "Accepted Matches", overview.acceptedMatchingRequests],
      ["Hospital Matching", "Success Rate (%)", `${overview.matchRate}%`],
      ["Security System", "Total Security Events Recorded", overview.totalSecurityEvents],
      ["Government Data", "Total Verified Records", overview.totalGovRecords],
      ["Government Data", "DATA_GOV_IN Records", overview.govRecordsDataGovIn],
      ["Government Data", "PM_JAY Records (Historical)", overview.govRecordsPmjay],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CareSetu_Analytics_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("success", "Analytics summary exported to CSV.");
  };

  // Helper for relative time
  const getRelativeTimeString = (date: Date) => {
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSecs < 10) return "Just now";
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  const clearAllFilters = () => {
    setDateRange("30d");
    setStartDate("");
    setEndDate("");
    setStatusFilter("ALL");
    setPlatformFilter("ALL");
  };

  const overview = analytics?.overview || {};
  const emergency = analytics?.emergency || { statuses: [], severities: [], trend: [] };
  const matching = analytics?.matching || { outcomes: [], matchRate: 0, totalRequests: 0, successfulMatches: 0 };
  const hospitals = analytics?.hospitals || { types: [], ownership: [], verification: [] };
  const government = analytics?.government || { totalRecords: 0, sources: [] };
  const security = analytics?.security || { events: [], results: [], platforms: [], trend: [] };

  const COLORS = {
    navy: "#0F4C81",
    blue: "#0284C7",
    cyan: "#06B6D4",
    green: "#10B981",
    amber: "#F59E0B",
    rose: "#EF4444",
    slate: "#64748B",
    purple: "#8B5CF6",
  };

  const SEVERITY_COLORS: Record<string, string> = {
    RED: "#EF4444",
    ORANGE: "#F59E0B",
    YELLOW: "#EAB308",
    GREEN: "#10B981",
  };

  const renderMetricValue = (val: number | undefined, suffix = "") => {
    if (loading) return "...";
    if (apiError || !analytics) return <span className="text-slate-400 font-normal text-base">—</span>;
    return `${(val ?? 0).toLocaleString()}${suffix}`;
  };

  return (
    <div className="space-y-6 pb-12 transition-all duration-200 motion-reduce:transition-none">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy/10 text-navy flex items-center justify-center shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {t("nav.analytics") || "Analytics"}
              </h1>
              <p className="text-sm text-slate-500">
                Monitor CareSetu healthcare network activity, emergency operations, hospital performance, security events, and system activity.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-400 font-medium hidden md:inline">
            Last updated: <span className="text-slate-600 font-semibold">{getRelativeTimeString(lastUpdated)}</span>
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDefsModal(true)}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium"
          >
            <Info className="w-3.5 h-3.5 mr-1 text-cyan-600" /> Calculation Rules
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={loading || !analytics || !!apiError}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-slate-600" /> Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={refreshing || loading}
            onClick={() => fetchAnalytics(true)}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 text-navy ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* API Error Section Banner */}
      {apiError && !loading && (
        <Card className="p-4 bg-rose-50/90 border-rose-200 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-rose-950">Analytics Data Temporarily Unavailable</h4>
              <p className="text-xs text-rose-800">{apiError}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAnalytics(true)}
            className="bg-white border-rose-200 text-rose-800 hover:bg-rose-100 text-xs font-semibold shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry Loading Analytics
          </Button>
        </Card>
      )}

      {/* 2. Unified Global Filter Bar */}
      <Card className="p-4 border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-navy shrink-0" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Analytics Scope Filters</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Date Range Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Range:</span>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="py-1.5 px-3 rounded-xl border border-slate-200 font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 cursor-pointer"
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Dates Inputs */}
            {dateRange === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="py-1 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-800"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="py-1 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-800"
                />
              </div>
            )}

            {/* Platform Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Platform:</span>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="py-1.5 px-3 rounded-xl border border-slate-200 font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 cursor-pointer"
              >
                <option value="ALL">All Platforms</option>
                <option value="WEB">Web Portal</option>
                <option value="ANDROID">Android App</option>
                <option value="IOS">iOS App</option>
              </select>
            </div>

            {/* Clear Filters */}
            {(dateRange !== "30d" || platformFilter !== "ALL" || statusFilter !== "ALL") && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs text-rose-600 hover:bg-rose-50">
                <X className="w-3.5 h-3.5 mr-1" /> Reset Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 3. Overview Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="p-4 border-slate-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Total Hospitals</span>
            <Building2 className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {renderMetricValue(overview.totalHospitals)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span className="text-emerald-700 font-semibold">{apiError ? "—" : overview.approvedHospitals ?? 0}</span> Approved
          </div>
        </Card>

        <Card className="p-4 border-slate-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Emergency Cases</span>
            <Siren className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {renderMetricValue(overview.totalEmergencies)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span className="text-cyan-700 font-semibold">{apiError ? "—" : overview.completedEmergencies ?? 0}</span> Resolved / Treated
          </div>
        </Card>

        <Card className="p-4 border-slate-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Match Rate</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 tracking-tight">
            {renderMetricValue(overview.matchRate, "%")}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span className="text-slate-800 font-semibold">{apiError ? "—" : overview.acceptedMatchingRequests ?? 0}</span> / {apiError ? "—" : overview.totalMatchingRequests ?? 0} Matches
          </div>
        </Card>

        <Card className="p-4 border-slate-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Security Events</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {renderMetricValue(overview.totalSecurityEvents)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span className="text-rose-700 font-semibold">{apiError ? "—" : overview.blockedHospitals ?? 0}</span> Temporarily Blocked
          </div>
        </Card>

        <Card className="p-4 border-slate-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Government Records</span>
            <Database className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {renderMetricValue(overview.totalGovRecords)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            OGD India & PM-JAY Datasets
          </div>
        </Card>

        <Card className="p-4 border-slate-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Total Beds</span>
            <BedDouble className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {renderMetricValue(overview.totalBeds)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span className="text-purple-700 font-semibold">{apiError ? "—" : overview.totalIcuBeds ?? 0}</span> ICU Beds Total
          </div>
        </Card>
      </div>

      {/* 4. Section 1: Emergency Operations Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 p-5 border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Siren className="w-4 h-4 text-rose-600" /> Emergency Cases Volume Over Time
              </h3>
              <p className="text-xs text-slate-500">Real-time time-series of emergency cases logged across the selected date range.</p>
            </div>
            <button
              onClick={() => navigate("/admin/emergency-cases")}
              className="text-xs text-navy font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Emergency Cases <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading chart data...</div>
            ) : apiError ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Emergency analytics data unavailable.</div>
            ) : emergency.trend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">No emergency case records found in selected range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={emergency.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                  <Legend />
                  <Line type="monotone" name="Total Cases" dataKey="cases" stroke={COLORS.blue} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" name="Critical (RED)" dataKey="critical" stroke={COLORS.rose} strokeWidth={2} dot={false} />
                  <Line type="monotone" name="Closed/Resolved" dataKey="closed" stroke={COLORS.green} strokeWidth={2} dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Severity Breakdown Donut */}
        <Card className="p-5 border-slate-200/80 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Emergency Severity Distribution</h3>
            <p className="text-xs text-slate-500">Categorized by clinical triage severity.</p>
          </div>

          <div className="h-64">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading distribution...</div>
            ) : apiError ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Severity data unavailable.</div>
            ) : emergency.severities.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">No severity records available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={emergency.severities}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {emergency.severities.map((entry: any, idx: number) => (
                      <Cell key={`sev-${idx}-${entry.name || 'unk'}`} fill={SEVERITY_COLORS[entry.name] || COLORS.slate} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* 5. Section 2: Hospital Matching & Allocation Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5 border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" /> Hospital Match Outcomes
              </h3>
              <p className="text-xs text-slate-500">Distribution of patient-to-hospital matching requests.</p>
            </div>
            <button
              onClick={() => navigate("/admin/hospital-matching")}
              className="text-xs text-navy font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Hospital Matching <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-56">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading matching data...</div>
            ) : apiError ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Matching outcomes data unavailable.</div>
            ) : matching.outcomes.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">No matching request logs found.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={matching.outcomes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                  <Bar dataKey="value" fill={COLORS.navy} radius={[6, 6, 0, 0]}>
                    {matching.outcomes.map((entry: any, idx: number) => (
                      <Cell key={`match-out-${idx}-${entry.name || 'unk'}`} fill={COLORS.navy} />
                    ))}
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200/80 flex items-center justify-between text-xs text-emerald-950">
            <div>
              <span className="font-bold block">Hospital Matching Efficiency Formula:</span>
              <span className="text-[11px] text-emerald-800">Match Rate = (Accepted Matches / Total Matching Requests) × 100</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-emerald-700">{apiError ? "—" : `${matching.matchRate}%`}</span>
            </div>
          </div>
        </Card>

        {/* Hospital Verification & Type Breakdown */}
        <Card className="p-5 border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-600" /> Hospital Network Composition
              </h3>
              <p className="text-xs text-slate-500">Breakdown of registered hospitals by facility type.</p>
            </div>
            <button
              onClick={() => navigate("/admin/hospital-registry")}
              className="text-xs text-navy font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Hospital Registry <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-56">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading composition...</div>
            ) : apiError ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Hospital composition data unavailable.</div>
            ) : hospitals.types.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">No hospital records available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={hospitals.types} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                  <Bar dataKey="value" fill={COLORS.cyan} radius={[0, 6, 6, 0]}>
                    {hospitals.types.map((entry: any, idx: number) => (
                      <Cell key={`type-${idx}-${entry.name || 'unk'}`} fill={COLORS.cyan} />
                    ))}
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 leading-relaxed">
            💡 <strong>Note on Bed Capacity:</strong> Registered Bed and ICU Capacity metrics represent active CareSetu facility records. PM-JAY historical dataset admissions are completely excluded from live capacity calculations.
          </div>
        </Card>
      </div>

      {/* 6. Section 3: Security & Violation Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 p-5 border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" /> Protected-Content Security Events Over Time
              </h3>
              <p className="text-xs text-slate-500">Violations (screenshot/screen recording attempts) detected during protected content views.</p>
            </div>
            <button
              onClick={() => navigate("/admin/security-reviews")}
              className="text-xs text-navy font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Security Reviews <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-60">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading security trend...</div>
            ) : apiError ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Security trend data unavailable.</div>
            ) : security.trend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">No security violation events recorded in selected range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={security.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                  <Legend />
                  <Line type="monotone" name="Total Events" dataKey="events" stroke={COLORS.amber} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" name="Warnings Issued" dataKey="warnings" stroke={COLORS.blue} strokeWidth={2} dot={false} />
                  <Line type="monotone" name="Blocks (3/3)" dataKey="blocked" stroke={COLORS.rose} strokeWidth={2} dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5 border-slate-200/80 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Security Enforcement Results</h3>
            <p className="text-xs text-slate-500">Breakdown of actions taken on violation attempts.</p>
          </div>

          <div className="h-60">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading enforcement data...</div>
            ) : apiError ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Enforcement data unavailable.</div>
            ) : security.results.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">No enforcement results available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={security.results}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                  <Bar dataKey="value" fill={COLORS.rose} radius={[6, 6, 0, 0]}>
                    {security.results.map((entry: any, idx: number) => (
                      <Cell key={`sec-res-${idx}-${entry.name || 'unk'}`} fill={COLORS.rose} />
                    ))}
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* 7. Section 4: Government Health Data Analytics */}
      <Card className="p-5 border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" /> Government Health Data Records Distribution
            </h3>
            <p className="text-xs text-slate-500">External health dataset records imported from data.gov.in and PM-JAY.</p>
          </div>
          <button
            onClick={() => navigate("/admin/government-health-data")}
            className="text-xs text-navy font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            Government Health Data <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="h-52">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading source breakdown...</div>
            ) : apiError ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Government dataset breakdown unavailable.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={government.sources}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", fontSize: "12px" }} />
                  <Bar dataKey="value" fill={COLORS.blue} radius={[6, 6, 0, 0]}>
                    {government.sources.map((entry: any, idx: number) => (
                      <Cell key={`gov-${idx}-${entry.key || entry.name}`} fill={COLORS.blue} />
                    ))}
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex flex-col justify-center space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-semibold text-slate-700">Total External Records Sourced:</span>
              <span className="font-bold text-slate-900 text-sm">{apiError ? "—" : government.totalRecords.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">District Hospitals Directory (DATA_GOV_IN):</span>
              <span className="font-bold text-cyan-800">{apiError ? "—" : (overview.govRecordsDataGovIn ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 flex items-center gap-1">
                AB PM-JAY Admissions (PM_JAY):
                <span className="px-1.5 py-0.2 text-[9px] bg-amber-100 text-amber-900 font-bold rounded">Historical</span>
              </span>
              <span className="font-bold text-amber-800">{apiError ? "—" : (overview.govRecordsPmjay ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 8. Definitions & Formulas Modal */}
      {showDefsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 border border-slate-100 flex flex-col gap-4 max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-cyan-600" />
                <h3 className="font-bold text-slate-900 text-base">Analytics Calculation Rules & Definitions</h3>
              </div>
              <button
                onClick={() => setShowDefsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 overflow-y-auto pr-1 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <h4 className="font-bold text-slate-900">Emergency Cases Metric:</h4>
                <p>Calculated directly from `prisma.emergencyCase` creation timestamps matching selected date filter.</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <h4 className="font-bold text-slate-900">Hospital Match Rate (%):</h4>
                <p>Calculated as <code>(Accepted Requests / Total Requests) × 100</code> using authoritative `HospitalRequest` entities.</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <h4 className="font-bold text-slate-900">Security Violation Events:</h4>
                <p>Counts confirmed screenshot or screen recording attempt events captured during protected HealthPack / document views.</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <h4 className="font-bold text-slate-900">Bed Capacity vs Government Data:</h4>
                <p>Bed capacity metrics exclusively reflect registered CareSetu facility records (`Hospital`). PM-JAY historical dataset admissions are explicitly kept separate.</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowDefsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
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

interface NormalizedDeletionRecord {
  id: string;
  userId?: string | null;
  name: string;
  username: string;
  email: string;
  role: string;
  reason: string;
  status: string;
  adminReason?: string | null;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  terminatedAt?: string | null;
  createdAt: string;
  user?: any;
}

function normalizeDeletionRecord(r: any): NormalizedDeletionRecord {
  const email = r.emailSnapshot || r.email || r.user?.email || "N/A";
  const emailUsername = email !== "N/A" ? email.split("@")[0] : "";
  const rawUsername = r.usernameSnapshot || r.username || r.user?.username;

  const username =
    rawUsername && rawUsername !== "N/A"
      ? rawUsername
      : emailUsername || "N/A";

  const name =
    r.nameSnapshot ||
    r.name ||
    r.user?.name ||
    (username !== "N/A" ? username : "User Account");

  const rawRole = (r.role || r.user?.role || "PATIENT").toUpperCase();

  return {
    id: r.id,
    userId: r.userId,
    name,
    username,
    email,
    role: rawRole,
    reason: r.reason || "No reason specified",
    status: (r.status || "PENDING").toUpperCase(),
    adminReason: r.adminReason || null,
    requestedAt: r.requestedAt || r.createdAt,
    reviewedAt: r.reviewedAt || null,
    terminatedAt: r.terminatedAt || null,
    createdAt: r.createdAt,
    user: r.user || null,
  };
}

export function AdminDeletionRequestsPage() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<"ALL" | "PATIENT" | "HOSPITAL" | "DOCTOR">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "TERMINATED" | "REJECTED">("ALL");
  const [search, setSearch] = useState("");

  // Modal states
  const [acceptModalItem, setAcceptModalItem] = useState<NormalizedDeletionRecord | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<NormalizedDeletionRecord | null>(null);
  const [adminReason, setAdminReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await accountDeletionApi.getAdminDeletionRequests();
      if (res.success) {
        setRequests(res.requests || []);
      }
    } catch (err: any) {
      showToast("error", err?.message || "Failed to load account deletion records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async () => {
    if (!acceptModalItem) return;
    setProcessing(true);
    try {
      const res = await accountDeletionApi.approveDeletionRequest(acceptModalItem.id);
      if (res.success) {
        showToast("success", `Account for ${acceptModalItem.email} permanently terminated.`);
        setAcceptModalItem(null);
        await loadRequests();
      } else {
        showToast("error", res.message || "Failed to approve deletion.");
      }
    } catch (err: any) {
      showToast("error", err?.message || "Error approving account deletion.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalItem) return;
    if (!adminReason.trim() || adminReason.trim().length < 2) {
      showToast("error", "Please provide a rejection reason.");
      return;
    }

    setProcessing(true);
    try {
      const res = await accountDeletionApi.rejectDeletionRequest(rejectModalItem.id, adminReason.trim());
      if (res.success) {
        showToast("info", "Deletion request rejected. User notified via email.");
        setRejectModalItem(null);
        setAdminReason("");
        await loadRequests();
      } else {
        showToast("error", res.message || "Failed to reject deletion request.");
      }
    } catch (err: any) {
      showToast("error", err?.message || "Error rejecting account deletion.");
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const normalizedList = requests.map(normalizeDeletionRecord);

  const filtered = normalizedList.filter((r) => {
    const roleMatch = roleFilter === "ALL" || r.role === roleFilter;

    const isTerminated = r.status === "TERMINATED" || r.status === "APPROVED";
    let statusMatch = true;
    if (statusFilter === "PENDING") statusMatch = r.status === "PENDING";
    else if (statusFilter === "TERMINATED") statusMatch = isTerminated;
    else if (statusFilter === "REJECTED") statusMatch = r.status === "REJECTED";

    if (!roleMatch || !statusMatch) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.username.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.role.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q)
    );
  });

  const pendingCount = normalizedList.filter(
    (r) => r.status === "PENDING" && (r.role === "HOSPITAL" || r.role === "DOCTOR")
  ).length;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-navy">Account Deletion Control</h1>
            <p className="text-xs text-slate-500">Manage account termination records and pending hospital/doctor deletion requests.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-xs">
            {pendingCount} Pending Review
          </span>
          <Button variant="outline" size="sm" onClick={loadRequests} className="text-xs">
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 mr-1">Role:</span>
            {(["ALL", "PATIENT", "HOSPITAL", "DOCTOR"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  roleFilter === r ? "bg-navy text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {r === "ALL" ? "All Roles" : r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}

            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

            <span className="text-xs font-bold text-slate-500 mr-1">Status:</span>
            {(["ALL", "PENDING", "TERMINATED", "REJECTED"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === s ? "bg-sky text-navy shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s === "PENDING" ? `Pending (${pendingCount})` : s === "ALL" ? "All Status" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="w-full md:w-64">
            <SearchInput placeholder="Search name, username, email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Main Table View */}
      {loading ? (
        <Card className="p-8 text-center text-slate-400 text-xs">Loading account deletion records...</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="font-bold text-navy text-sm">No account deletion records found</p>
          <p className="text-xs text-slate-500">No records match your active search and filter criteria.</p>
        </Card>
      ) : (
        <Card padded={false} className="overflow-x-auto shadow-xs border border-slate-200/80 rounded-2xl">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-navy font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80">
              <tr>
                <th className="px-4 py-3.5">Name</th>
                <th className="px-4 py-3.5">Username</th>
                <th className="px-4 py-3.5">Email</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Reason</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Time</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((r) => {
                const isTerminated = r.status === "TERMINATED" || r.status === "APPROVED";
                const timestamp = r.requestedAt || r.createdAt;

                return (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-navy whitespace-nowrap">{r.name}</td>
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {r.username !== "N/A" ? `@${r.username}` : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{r.email}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {r.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate" title={r.reason}>
                      "{r.reason}"
                      {r.adminReason && (
                        <p className="text-[11px] text-rose-600 font-semibold mt-0.5">Admin Note: "{r.adminReason}"</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 font-medium whitespace-nowrap">{formatDate(timestamp)}</td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">{formatTime(timestamp)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {r.status === "PENDING" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> PENDING
                        </span>
                      )}
                      {isTerminated && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-800 border border-slate-300 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> TERMINATED
                        </span>
                      )}
                      {r.status === "REJECTED" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> REJECTED
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {r.status === "PENDING" && (r.role === "HOSPITAL" || r.role === "DOCTOR") ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setRejectModalItem(r);
                              setAdminReason("");
                            }}
                            className="px-3 py-1 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
                          >
                            REJECT
                          </button>
                          <button
                            type="button"
                            onClick={() => setAcceptModalItem(r)}
                            className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.98] shadow-xs transition-all flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            ACCEPT
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-medium">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* ACCEPT CONFIRMATION MODAL */}
      {acceptModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setAcceptModalItem(null)}
              className="absolute top-5 right-5 p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-navy text-lg leading-tight">Permanently Delete Account?</h3>
                <p className="text-xs text-rose-600 font-semibold">Irreversible Administrative Action</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <p><span className="font-semibold text-slate-700">Name:</span> {acceptModalItem.name}</p>
              <p><span className="font-semibold text-slate-700">Username:</span> {acceptModalItem.username !== "N/A" ? `@${acceptModalItem.username}` : "—"}</p>
              <p><span className="font-semibold text-slate-700">Email:</span> {acceptModalItem.email}</p>
              <p><span className="font-semibold text-slate-700">Role:</span> {acceptModalItem.role}</p>
              <p className="pt-1 text-slate-600"><strong>Reason:</strong> "{acceptModalItem.reason}"</p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This action will <strong>PERMANENTLY DELETE</strong> this account and all account-owned records. This action cannot be undone. A termination email will be dispatched.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setAcceptModalItem(null)} disabled={processing}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={processing}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
              >
                {processing ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setRejectModalItem(null)}
              className="absolute top-5 right-5 p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-navy text-lg leading-tight">Reject Account Deletion</h3>
                <p className="text-xs text-slate-500">Provide an administrative reason for rejection</p>
              </div>
            </div>

            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">
                  Rejection Reason *
                </label>
                <textarea
                  rows={3}
                  value={adminReason}
                  onChange={(e) => setAdminReason(e.target.value)}
                  placeholder="Explain why this account deletion request was rejected..."
                  maxLength={1000}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setRejectModalItem(null)} disabled={processing}>
                  Cancel
                </Button>
                <button
                  type="submit"
                  disabled={processing || !adminReason.trim()}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
                >
                  {processing ? "Rejecting..." : "Reject Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
