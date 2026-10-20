import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/common/Card";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Stethoscope, CheckCircle2, ArrowRight, Activity, Plus } from "lucide-react";
import { clinicApi } from "../../services/api";

export default function ClinicServicesPage() {
  const [clinic, setClinic] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    clinicApi
      .getProfile()
      .then((res: any) => {
        if (!mounted) return;
        if (res && res.success && res.clinic) {
          setClinic(res.clinic);
        } else {
          setError("Failed to load services data.");
        }
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message || "Unable to retrieve clinical services.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <LoadingState label="Loading clinical services catalog..." />;
  if (error) return <ErrorState title="Services Catalog Unavailable" message={error} />;

  const services = Array.isArray(clinic?.services) ? clinic.services : [];
  const specialties = Array.isArray(clinic?.specialties) ? clinic.specialties : [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-sky-600" />
            Outpatient & Clinical Services
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Services offered by {clinic?.name || "your clinic"} to outpatients in your locality.
          </p>
        </div>

        <Link
          to="/clinic/profile"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-dark transition-colors self-start"
        >
          <Plus className="w-4 h-4" />
          Edit Services & Specialties
        </Link>
      </div>

      {/* Services List */}
      <Card className="p-6 space-y-4">
        <h2 className="text-base font-bold text-navy flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-600" />
          Configured Medical Services ({services.length})
        </h2>

        {services.length === 0 ? (
          <EmptyState
            title="No Services Listed"
            message="Add services like General OPD, Diagnostics, or Vaccinations in your clinic profile."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {services.map((service: string, idx: number) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border-light bg-bg-secondary"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-navy text-sm">{service}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Specialties List */}
      <Card className="p-6 space-y-4">
        <h2 className="text-base font-bold text-navy flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-indigo-600" />
          Specialties Supported ({specialties.length})
        </h2>

        {specialties.length === 0 ? (
          <EmptyState
            title="No Specialties Listed"
            message="Define specialties such as Family Medicine, Pediatrics, or Cardiology in your clinic profile."
          />
        ) : (
          <div className="flex flex-wrap gap-2 pt-2">
            {specialties.map((spec: string, idx: number) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold"
              >
                {spec}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Scope Details Card */}
      <Card className="p-6 bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm space-y-2">
        <p className="font-semibold text-slate-900">Patient Directory Visibility</p>
        <p className="text-slate-700 leading-relaxed">
          These services and specialties are indexed by CareSetu to help local patients discover appropriate
          walk-in care and schedule outpatient consultations. Emergency triage routing is strictly reserved
          for hospital-level emergency departments.
        </p>
      </Card>
    </div>
  );
}
