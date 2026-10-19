import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  Unlock,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { SecureContentService } from "../../services/secure-content.service";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import { useToast } from "../../components/common/Toast";
import SecurityEpochHeaderWidget from "../../components/admin/SecurityEpochHeaderWidget";

interface AppealItem {
  id: string;
  hospitalId: string;
  hospitalName: string;
  reason: string;
  description?: string;
  status: string;
  createdAt: string;
  securityEpoch?: number;
  attemptNumber?: number;
}

export const AdminHospitalAppealsPage: React.FC = () => {
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [securityEpoch, setSecurityEpoch] = useState(1);
  const [blockedCount, setBlockedCount] = useState(0);
  const [activeSessionsCount, setActiveSessionsCount] = useState(0);

  // Modal State
  const [selectedAppeal, setSelectedAppeal] = useState<AppealItem | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showToast } = useToast();

  const fetchAppeals = async () => {
    try {
      setLoading(true);
      const data = await SecureContentService.getAdminViolations({
        pageSize: 100,
        reviewStatus: filterStatus === "ALL" ? undefined : filterStatus,
      });

      if (data && data.appeals) {
        const normalized = data.appeals.map((a: any) => ({
          ...a,
          hospitalName: a.hospitalName || a.hospital?.name || `Hospital #${(a.hospitalId || '').slice(-6)}`,
          reason: a.reason || a.description || 'Access Restoration Appeal',
          createdAt: a.createdAt || a.submittedAt || new Date().toISOString(),
          status: a.status || 'PENDING',
        }));
        setAppeals(normalized);
      }
      if (data && data.stats) {
        setSecurityEpoch(data.stats.securityEpoch || 1);
        setBlockedCount(data.stats.blockedCount || 0);
        setActiveSessionsCount(data.stats.activeSessionsCount || 0);
      }
    } catch (err: any) {
      console.error("[AdminAppealsPage] Fetch error:", err);
      showToast("error", err.message || "Failed to load hospital appeals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals();
  }, [filterStatus]);

  const handleUnlock = async (hospitalId: string, decision: "APPROVED" | "REJECTED" = "APPROVED") => {
    try {
      setIsSubmitting(true);
      await SecureContentService.unlockHospital({
        hospitalId,
        decision,
        adminNotes: adminNotes.trim() || `Portal unlocked by CareSetu Admin via Appeals UI (${decision})`,
      });

      showToast("success", "Hospital portal access restored cleanly. Security Epoch incremented.");
      setSelectedAppeal(null);
      setAdminNotes("");
      await fetchAppeals();
    } catch (err: any) {
      showToast("error", err.message || "Failed to unlock hospital portal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (hospitalId: string, appealId: string) => {
    try {
      setIsSubmitting(true);
      await SecureContentService.keepBlockedHospital({
        hospitalId,
        appealId,
        adminNotes: adminNotes.trim() || "Appeal reviewed and rejected by CareSetu Admin.",
      });

      showToast("success", "Hospital appeal rejected. Account remains blocked.");
      setSelectedAppeal(null);
      setAdminNotes("");
      await fetchAppeals();
    } catch (err: any) {
      showToast("error", err.message || "Failed to reject appeal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAppeals = appeals.filter((a) => {
    const q = (searchQuery || "").toLowerCase();
    const hospName = (a.hospitalName || "").toLowerCase();
    const rsn = (a.reason || "").toLowerCase();
    return hospName.includes(q) || rsn.includes(q);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Security Epoch & Overview Header Widget */}
      <SecurityEpochHeaderWidget
        securityEpoch={securityEpoch}
        blockedHospitalsCount={blockedCount}
        activeSessionsCount={activeSessionsCount}
        totalViolationsCount={appeals.length}
      />

      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Hospital Appeals Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review security review appeals, inspect violation details, and restore hospital portal access.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchAppeals} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh Appeals
        </Button>
      </div>

      {/* Filters & Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {["ALL", "PENDING", "APPROVED", "REJECTED"].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  filterStatus === st
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                {st === "ALL" ? "All Appeals" : st}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search hospital or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </Card>

      {/* Appeals Data Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
            Loading security appeals...
          </div>
        ) : filteredAppeals.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No security appeals found.</p>
            <p className="text-xs text-slate-400 mt-1">All hospital portals are operating under clean security status.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Hospital Name</th>
                  <th className="p-3.5">Appeal Reason</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Submission Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredAppeals.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="p-3.5 font-medium text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-500" />
                        <span>{app.hospitalName}</span>
                      </div>
                    </td>

                    <td className="p-3.5 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                      {app.reason}
                    </td>

                    <td className="p-3.5">
                      <Badge
                        tone={
                          app.status === "APPROVED" || app.status === "UNLOCKED"
                            ? "accepted"
                            : app.status === "REJECTED"
                            ? "rejected"
                            : "pending"
                        }
                      >
                        {app.status}
                      </Badge>
                    </td>

                    <td className="p-3.5 text-slate-500">
                      {new Date(app.createdAt).toLocaleString()}
                    </td>

                    <td className="p-3.5 text-right">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setSelectedAppeal(app)}
                      >
                        <Unlock className="w-3.5 h-3.5 mr-1" />
                        Review & Unlock
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Review Modal */}
      {selectedAppeal && (
        <Modal
          isOpen={Boolean(selectedAppeal)}
          onClose={() => setSelectedAppeal(null)}
          title={`Review Security Appeal — ${selectedAppeal.hospitalName}`}
        >
          <div className="space-y-4 text-sm">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Appeal Reason Statement
              </p>
              <p className="mt-1 font-mono">{selectedAppeal.reason}</p>
              {selectedAppeal.description && (
                <p className="mt-1 text-slate-600 dark:text-slate-400">{selectedAppeal.description}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Admin Review Notes (Required for Audit Log)
              </label>
              <textarea
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Enter justification for unlocking or keeping blocked..."
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => handleReject(selectedAppeal.hospitalId, selectedAppeal.id)}
                disabled={isSubmitting}
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                Reject Appeal
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => handleUnlock(selectedAppeal.hospitalId, "APPROVED")}
                disabled={isSubmitting}
              >
                <Unlock className="w-4 h-4 mr-1.5" />
                Approve & Unlock Portal
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminHospitalAppealsPage;
