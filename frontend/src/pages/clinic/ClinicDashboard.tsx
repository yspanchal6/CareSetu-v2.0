import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/common/Card";
import { LoadingState, ErrorState } from "../../components/common/States";
import {
  Building2,
  Stethoscope,
  Users,
  ShieldCheck,
  Clock,
  Phone,
  MapPin,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { clinicApi } from "../../services/api";

export default function ClinicDashboard() {
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
          setError("Failed to load clinic profile.");
        }
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message || "Unable to connect to clinic services.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <LoadingState label="Loading clinic workspace..." />;
  if (error) return <ErrorState title="Clinic Workspace Unavailable" message={error} />;

  const services = Array.isArray(clinic?.services) ? clinic.services : [];
  const specialties = Array.isArray(clinic?.specialties) ? clinic.specialties : [];
  const status = String(clinic?.verificationStatus || "PENDING_ADMIN_REVIEW");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">{clinic?.name || "Independent Clinic"}</h1>
          <p className="text-sm text-text-secondary mt-1">
            CareSetu Outpatient Portal · Reg. No: <span className="font-mono">{clinic?.registrationNumber || "—"}</span>
          </p>
        </div>

        <Link
          to="/clinic/verification-status"
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
            status === "APPROVED"
              ? "bg-emerald-100 text-emerald-800"
              : status === "REJECTED"
              ? "bg-rose-100 text-rose-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Status: {status.replace(/_/g, " ")}
        </Link>
      </div>

      {/* Scope Notice Banner */}
      <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm">
          <p className="font-semibold text-sky-900">Outpatient Facility Scope</p>
          <p className="mt-0.5 text-sky-800">
            This workspace manages outpatient services, consultations, and operating hours. Hospital emergency dispatch,
            trauma queues, and Health Pack decryption are strictly restricted to licensed hospital trauma centers.
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-text-secondary">Clinical Services</span>
            <Stethoscope className="w-5 h-5 text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-navy mt-2">{services.length}</p>
          <p className="text-xs text-text-secondary mt-1">Active patient services</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-text-secondary">Specialties</span>
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-navy mt-2">{specialties.length}</p>
          <p className="text-xs text-text-secondary mt-1">Medical fields offered</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-text-secondary">Consultation Hours</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-sm font-semibold text-navy mt-2">
            {clinic?.operatingHours?.schedule || "Mon - Sat: 9am - 7pm"}
          </p>
          <p className="text-xs text-text-secondary mt-1">Outpatient timing</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-text-secondary">Facility Staff</span>
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-navy mt-2">Active</p>
          <p className="text-xs text-text-secondary mt-1">Provider roster</p>
        </Card>
      </div>

      {/* Clinic Details & Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-navy flex items-center gap-2">
            <Building2 className="w-5 h-5 text-sky-600" />
            Clinic Information & Contact
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-text-secondary shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-navy">Physical Address</p>
                <p className="text-text-secondary">
                  {clinic?.address || "Address not specified"},{" "}
                  {[clinic?.city, clinic?.state, clinic?.pincode].filter(Boolean).join(", ")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-text-secondary shrink-0" />
              <div>
                <span className="font-semibold text-navy">Contact Number: </span>
                <span className="text-text-secondary">{clinic?.phone || "Not configured"}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border-light flex flex-wrap gap-3">
            <Link
              to="/clinic/profile"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-dark transition-colors"
            >
              Update Clinic Profile <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/clinic/services"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border-medium text-navy text-xs font-semibold hover:bg-bg-secondary transition-colors"
            >
              Manage Services
            </Link>
          </div>
        </Card>

        {/* Quick Actions Card */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-navy">Quick Actions</h2>
          <div className="space-y-2 text-sm">
            <Link
              to="/clinic/profile"
              className="flex items-center justify-between p-3 rounded-lg border border-border-light hover:border-sky-300 hover:bg-sky-50/50 transition-colors"
            >
              <span className="font-medium text-navy">Edit Operating Hours</span>
              <ArrowRight className="w-4 h-4 text-text-secondary" />
            </Link>
            <Link
              to="/clinic/staff"
              className="flex items-center justify-between p-3 rounded-lg border border-border-light hover:border-sky-300 hover:bg-sky-50/50 transition-colors"
            >
              <span className="font-medium text-navy">View Medical Staff Roster</span>
              <ArrowRight className="w-4 h-4 text-text-secondary" />
            </Link>
            <Link
              to="/clinic/verification-status"
              className="flex items-center justify-between p-3 rounded-lg border border-border-light hover:border-sky-300 hover:bg-sky-50/50 transition-colors"
            >
              <span className="font-medium text-navy">Check Verification Status</span>
              <ArrowRight className="w-4 h-4 text-text-secondary" />
            </Link>
            <Link
              to="/clinic/settings"
              className="flex items-center justify-between p-3 rounded-lg border border-border-light hover:border-sky-300 hover:bg-sky-50/50 transition-colors"
            >
              <span className="font-medium text-navy">Security & Password</span>
              <ArrowRight className="w-4 h-4 text-text-secondary" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
