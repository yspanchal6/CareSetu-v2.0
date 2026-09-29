import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { emergencyApi } from "../../services/api";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import { EmptyState, ErrorState } from "../../components/common/States";
import StatusTracker from "../../components/emergency/StatusTracker";
import { useTranslation } from "../../i18n/I18nContext";

const severityTone = { 
  Critical: "critical", CRITICAL: "critical",
  Urgent: "urgent", HIGH: "urgent",
  Stable: "stable", LOW: "stable" 
} as const;

export function PatientCasesPage() {
  const { t } = useTranslation();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await emergencyApi.getMyCases();
        setCases(res.cases || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="p-4 text-sm text-text-secondary">{t("common.loading")}</div>;

  if (cases.length === 0) {
    return <EmptyState icon={ClipboardList} title={t("myCases.noCases")} message="" />;
  }

  return (
    <div className="flex flex-col gap-3 pb-6">
      {cases.map((c) => (
        <Link key={c.caseId || c.id} to={`/patient/cases/${c.caseId || c.id}`}>
          <Card className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-navy text-sm">{c.caseId || c.id}</p>
              <p className="text-xs text-text-secondary mt-0.5">{c.symptoms}</p>
              <p className="text-[11px] text-slate-400 mt-1">{c.createdAt ? new Date(c.createdAt).toLocaleString() : "--"}</p>
            </div>
            <Badge tone={(severityTone as any)[c.severity] || "urgent"}>{c.severity || "Urgent"}</Badge>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function PatientCaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [c, setCase] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await emergencyApi.getMyCases();
        const found = res.cases?.find((e: any) => e.caseId === id || e.id === id);
        setCase(found);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <div className="p-4 text-sm text-text-secondary">Loading case details...</div>;
  if (!c) {
    return <ErrorState title="Case not found" onRetry={() => navigate("/patient/cases")} />;
  }

  const mapStatus = (status: string) => {
    if (status === "PENDING") return "Reported";
    if (status === "ACCEPTED") return "HospitalAssigned";
    if (status === "ARRIVED") return "Transfer";
    return "Reported";
  };

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-5 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary w-fit">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <Card>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-navy text-lg">{c.caseId || c.id}</h2>
          <Badge tone={(severityTone as any)[c.severity] || "urgent"}>{c.severity || "Urgent"}</Badge>
        </div>
        <p className="text-sm text-text-secondary">{c.symptoms}</p>
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div>
            <p className="text-xs text-text-secondary">Type</p>
            <p className="font-semibold text-navy">{c.emergencyType || "General"}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Assigned hospital</p>
            <p className="font-semibold text-navy">{c.hospital?.name || "Pending"}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Distance / ETA</p>
            <p className="font-semibold text-navy">{c.distanceKm ? c.distanceKm.toFixed(1) : "--"} km · {c.etaMin || "--"} min</p>
          </div>
        </div>
      </Card>
      <Card>
        <p className="font-semibold text-navy text-sm mb-4">Case timeline</p>
        <StatusTracker current={mapStatus(c.status)} />
      </Card>
    </div>
  );
}
