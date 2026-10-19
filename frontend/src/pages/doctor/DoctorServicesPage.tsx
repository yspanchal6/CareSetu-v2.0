import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import {
  Stethoscope,
  Clock,
  ShieldCheck,
  Building2,
  CalendarDays,
  FileText,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { doctorApi } from "../../services/api";

export default function DoctorServicesPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    doctorApi
      .getProfile()
      .then((res) => {
        if (!mounted) return;
        if (res && res.success && res.profile) {
          setProfile(res.profile);
        } else {
          setError("Unable to load practitioner credentials.");
        }
      })
      .catch((err: any) => {
        if (mounted) setError(err?.message || "Failed to load doctor profile.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <LoadingState label="Loading clinical services and practitioner scope..." />;
  }

  if (error) {
    return <ErrorState title="Clinical Services Unavailable" message={error} />;
  }

  const independent = profile?.independentProfile;
  const isApproved = independent?.verificationStatus === "APPROVED";
  const specialty = independent?.specialty || "General Medicine";
  const subSpecialties: string[] = independent?.subSpecialties || [];
  const clinicAddress = independent?.clinicAddress || "Primary Outpatient Clinic";
  const locationStr = [independent?.city, independent?.state].filter(Boolean).join(", ") || "Active Region";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-fade-in">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Outpatient Practice Services</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-navy">
              Clinical Services & Consultation Scope
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Manage your outpatient clinical consultation scope, verified specialty services, and practice location.
            </p>
          </div>
          <Badge tone={isApproved ? "success" : "urgent"}>
            {isApproved ? "Verified Practice" : independent?.verificationStatus || "Pending Verification"}
          </Badge>
        </div>
      </div>

      {/* Scope Notice */}
      <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h4 className="font-bold text-sky-950 uppercase tracking-wider">Independent Outpatient Practice Scope</h4>
          <p className="text-sky-800 leading-relaxed">
            Independent practice covers scheduled outpatient consultations, telemedicine evaluations, and private clinical follow-ups. Inpatient emergency dispatches, trauma queues, and patient Health Pack decryption remain restricted to licensed hospital facilities.
          </p>
        </div>
      </div>

      {/* Registered Specialty Services Grid */}
      <div className="grid sm:grid-cols-2 gap-5">
        <Card className="border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-navy text-base flex items-center gap-2">
              <Stethoscope className="w-4.5 h-4.5 text-sky-600" />
              <span>Primary Clinical Specialty</span>
            </h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
              Licensed
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-lg font-extrabold text-navy">{specialty}</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Medical registration under State Medical Council:{" "}
              <span className="font-semibold text-slate-800">
                {independent?.medicalCouncil || "State Council"}
              </span>{" "}
              (Lic. <span className="font-semibold text-slate-800">{independent?.licenseNumber || "Recorded"}</span>).
            </p>
          </div>

          {subSpecialties.length > 0 ? (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-xs font-semibold text-slate-500 block">Sub-specialties & Areas of Focus:</span>
              <div className="flex flex-wrap gap-1.5">
                {subSpecialties.map((sub, i) => (
                  <span
                    key={i}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-100"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic pt-1">
              No additional sub-specialties recorded in clinical registration.
            </p>
          )}
        </Card>

        {/* Practice Facility & Consultation Location */}
        <Card className="border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-navy text-base flex items-center gap-2">
              <Building2 className="w-4.5 h-4.5 text-sky-600" />
              <span>Practice Location</span>
            </h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
              Active Location
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <p className="text-sm font-bold text-navy">{clinicAddress}</p>
            <p className="leading-relaxed">{locationStr} {independent?.pincode ? `— ${independent.pincode}` : ""}</p>
            <p className="text-slate-500 pt-1">
              Registered clinical consultations and in-person patient evaluations take place at this practice address.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <Link
              to="/doctor/independent/profile"
              className="text-xs font-semibold text-sky-700 hover:text-navy inline-flex items-center gap-1 transition-colors"
            >
              <span>Update Clinic Address & Credentials</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Backend Capability Notice: Consultation Fees & Hours */}
      <Card className="border border-slate-200 shadow-xs p-6 space-y-4 bg-slate-50/50">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <h3 className="font-bold text-navy text-sm">Consultation Scheduling & Fee Configurations</h3>
            <p className="text-xs text-slate-500">System Integration Status</p>
          </div>
        </div>

        <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
          <p>
            Online consultation fee collection, digital appointment booking tiers, and custom operating hour schedules are part of CareSetu's upcoming Outpatient Telehealth module. The active database schema maintains verified doctor credentials, medical licensure, and practice addresses.
          </p>
          <p className="text-slate-500">
            Direct emergency assignments remain strictly hospital-governed. Independent outpatient consultations are conducted according to your registered clinical qualifications and verified council scope.
          </p>
        </div>
      </Card>
    </div>
  );
}
