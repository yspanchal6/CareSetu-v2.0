import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card } from "../../components/common/Card";
import { LoadingState, ErrorState } from "../../components/common/States";
import { ShieldCheck, ShieldAlert, Clock, AlertCircle, FileCheck, Building2, Stethoscope, ArrowRight, FileText } from "lucide-react";
import { clinicApi, doctorApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

interface ProviderVerificationStatusPageProps {
  type: "doctor" | "clinic";
}

interface VerificationData {
  verificationStatus: string;
  rejectionReason?: string;
  reviewedAt?: string;
  hasHospitalAffiliation?: boolean;
  hospitalAffiliation?: {
    hospitalId: string;
    hospitalName?: string;
    staffRole?: string;
  } | null;
  message?: string;
  profile?: any;
  clinic?: any;
}

export default function ProviderVerificationStatusPage({ type }: ProviderVerificationStatusPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProfileNotFound, setIsProfileNotFound] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setIsProfileNotFound(false);

    const fetchStatus = type === "doctor"
      ? doctorApi.getVerificationStatus()
      : clinicApi.getVerificationStatus();

    fetchStatus
      .then((res: any) => {
        if (!mounted) return;
        if (res && res.success) {
          setData(res);
        } else {
          setError(res?.message || "Failed to retrieve verification status.");
        }
      })
      .catch((err: any) => {
        if (!mounted) return;
        const code = err?.code || err?.data?.error || err?.data?.code;
        if (
          err?.status === 404 ||
          code === "DOCTOR_PROFILE_NOT_FOUND" ||
          code === "CLINIC_PROFILE_NOT_FOUND" ||
          err?.message?.includes("profile found") ||
          err?.message?.includes("profile not found")
        ) {
          setIsProfileNotFound(true);
        } else {
          setError(err?.message || "Unable to load verification status. Please check your network connection.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [type]);

  if (loading) {
    return <LoadingState label="Retrieving provider verification status..." />;
  }

  const isNotStarted = data?.verificationStatus === "NOT_STARTED" || isProfileNotFound;

  if (isNotStarted) {
    const isDoctor = type === "doctor";
    const hasHospitalAffiliation = Boolean(data?.hasHospitalAffiliation);
    const hospitalName = data?.hospitalAffiliation?.hospitalName;

    return (
      <div className="max-w-3xl mx-auto space-y-6 my-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center mx-auto border border-sky-100">
            {isDoctor ? (hasHospitalAffiliation ? <Building2 className="w-7 h-7 text-emerald-700" /> : <Stethoscope className="w-7 h-7" />) : <Building2 className="w-7 h-7" />}
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-navy">
              {isDoctor
                ? hasHospitalAffiliation
                  ? "Active Hospital Affiliation Found"
                  : "Independent Practitioner Profile Not Started"
                : "No Clinic Profile Found"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
              {isDoctor
                ? hasHospitalAffiliation
                  ? `Your account is actively affiliated with ${hospitalName || "a licensed hospital"}. Hospital clinical privileges are governed by facility accreditation — you do not need independent verification to access hospital emergencies.`
                  : "An independent outpatient profile has not been initiated for this account. Independent verification is required only for doctors managing private clinic consultations or outpatient telemedicine."
                : "A clinic registration has not been created for this account yet. Verification status will appear once clinic details and documentation are submitted."}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-left pt-2">
            {hasHospitalAffiliation ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2 col-span-full text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
                    Hospital Staff Access Ready
                  </span>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    You can immediately access your hospital emergency dashboard, active cases, and triage queue.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/doctor/hospital/dashboard")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  <span>Go to Hospital Doctor Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-navy uppercase tracking-wider block">
                      {isDoctor ? "Optional: Independent Outpatient Practice" : "Clinic Onboarding"}
                    </span>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {isDoctor
                        ? "If you operate a private clinic or see outpatient clients, submit your registration number and license proof for review."
                        : "Register facility licenses, staff counts, and proof of establishment."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(isDoctor ? "/doctor/onboarding" : "/clinic/profile")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-navy hover:bg-navy/90 px-3.5 py-2 rounded-xl transition-colors cursor-pointer mt-2 w-fit"
                  >
                    <span>{isDoctor ? "Begin Independent Verification" : "Complete Clinic Profile"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-navy uppercase tracking-wider block">
                      {isDoctor ? "Hospital Medical Staff" : "Assistance & Support"}
                    </span>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {isDoctor
                        ? `If you practice in a hospital facility, your hospital administration can link your account (${user?.email || "registered email"}) directly to their active roster.`
                        : "If you need assistance verifying your clinic registration, contact the CareSetu administrator desk."}
                    </p>
                  </div>
                  {isDoctor && (
                    <Link
                      to="/doctor/hospital/dashboard"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl transition-colors mt-2 w-fit"
                    >
                      <span>Check Hospital Portal</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="pt-2 text-center">
            <Link
              to={isDoctor ? "/doctor/onboarding" : "/clinic/dashboard"}
              className="text-xs font-semibold text-slate-500 hover:text-navy transition-colors inline-flex items-center gap-1"
            >
              <span>{isDoctor ? "← Back to Doctor Setup Options" : "← Back to Dashboard"}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Verification Status Unavailable"
        message={error}
      />
    );
  }

  const status = String(data?.verificationStatus || "PENDING_ADMIN_REVIEW").toUpperCase();
  const providerInfo = type === "doctor" ? data?.profile : data?.clinic;
  const isDoctor = type === "doctor";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-navy">
          {isDoctor ? "Independent Doctor Licensure & Verification" : "Clinic Registration & Verification"}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Authoritative status for public listing in the CareSetu Outpatient Provider Network.
        </p>
      </div>

      {/* Main Status Banner Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-light pb-5">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              status === "APPROVED"
                ? "bg-emerald-50 text-emerald-600"
                : status === "REJECTED"
                ? "bg-rose-50 text-rose-600"
                : "bg-amber-50 text-amber-600"
            }`}>
              {status === "APPROVED" ? (
                <ShieldCheck className="w-6 h-6" />
              ) : status === "REJECTED" ? (
                <ShieldAlert className="w-6 h-6" />
              ) : (
                <Clock className="w-6 h-6" />
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-text-secondary font-medium">Application Status</p>
              <h2 className="text-xl font-bold text-navy mt-0.5">
                {status === "APPROVED" && "Verified & Approved"}
                {(status === "PENDING_ADMIN_REVIEW" || status === "PENDING") && "Pending Administrative Review"}
                {status === "REJECTED" && "Application Requires Action / Rejected"}
                {status === "SUSPENDED" && "Credentials Temporarily Suspended"}
              </h2>
            </div>
          </div>

          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
            status === "APPROVED"
              ? "bg-emerald-100 text-emerald-800"
              : status === "REJECTED"
              ? "bg-rose-100 text-rose-800"
              : "bg-amber-100 text-amber-800"
          }`}>
            {status.replace(/_/g, " ")}
          </span>
        </div>

        {/* Rejection / Action Notes */}
        {data?.rejectionReason && (
          <div className="mt-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              Reviewer Notes & Action Items
            </div>
            <p className="text-sm mt-1 whitespace-pre-wrap">{data.rejectionReason}</p>
          </div>
        )}

        {/* Status Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm">
          <div className="p-4 rounded-xl bg-bg-secondary border border-border-light">
            <p className="text-xs text-text-secondary">Provider Legal Name</p>
            <p className="font-semibold text-navy mt-1">
              {providerInfo?.fullName || providerInfo?.name || "Registered Provider"}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg-secondary border border-border-light">
            <p className="text-xs text-text-secondary">
              {isDoctor ? "Medical Council License Number" : "State Clinical Registration No."}
            </p>
            <p className="font-semibold text-navy mt-1 font-mono">
              {providerInfo?.licenseNumber || providerInfo?.registrationNumber || "Pending Entry"}
            </p>
          </div>

          {providerInfo?.specialty && (
            <div className="p-4 rounded-xl bg-bg-secondary border border-border-light">
              <p className="text-xs text-text-secondary">Primary Medical Specialty</p>
              <p className="font-semibold text-navy mt-1">{providerInfo.specialty}</p>
            </div>
          )}

          {providerInfo?.qualification && (
            <div className="p-4 rounded-xl bg-bg-secondary border border-border-light">
              <p className="text-xs text-text-secondary">Clinical Qualifications</p>
              <p className="font-semibold text-navy mt-1">{providerInfo.qualification}</p>
            </div>
          )}

          {providerInfo?.medicalCouncil && (
            <div className="p-4 rounded-xl bg-bg-secondary border border-border-light">
              <p className="text-xs text-text-secondary">Medical Council Registry</p>
              <p className="font-semibold text-navy mt-1">{providerInfo.medicalCouncil}</p>
            </div>
          )}

          {providerInfo?.experienceYears !== undefined && providerInfo?.experienceYears !== null && (
            <div className="p-4 rounded-xl bg-bg-secondary border border-border-light">
              <p className="text-xs text-text-secondary">Clinical Experience</p>
              <p className="font-semibold text-navy mt-1">{providerInfo.experienceYears} Years</p>
            </div>
          )}

          {(providerInfo?.city || providerInfo?.state) && (
            <div className="p-4 rounded-xl bg-bg-secondary border border-border-light">
              <p className="text-xs text-text-secondary">Practice Location</p>
              <p className="font-semibold text-navy mt-1">
                {[providerInfo.clinicAddress, providerInfo.city, providerInfo.state, providerInfo.pincode].filter(Boolean).join(", ")}
              </p>
            </div>
          )}

          {data?.reviewedAt && (
            <div className="p-4 rounded-xl bg-bg-secondary border border-border-light">
              <p className="text-xs text-text-secondary">Last Administrative Review</p>
              <p className="font-semibold text-navy mt-1">
                {new Date(data.reviewedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Next Steps Guidance */}
      <Card className="p-6">
        <div className="flex items-center gap-2 font-semibold text-navy mb-3">
          <FileCheck className="w-5 h-5 text-sky-600" />
          Next Steps & Network Policies
        </div>

        {status === "APPROVED" && (
          <div className="space-y-2 text-sm text-text-secondary">
            <p>
              ✅ Your credentials have been officially validated by state medical council administrators.
            </p>
            <p>
              Your outpatient practice is currently visible to patients in your region. You can update your operating hours, outpatient consultation services, and practice address at any time.
            </p>
          </div>
        )}

        {status === "PENDING_ADMIN_REVIEW" && (
          <div className="space-y-2 text-sm text-text-secondary">
            <p>
              ⏳ Your registration is currently awaiting verification against state and national medical council registries.
            </p>
            <p>
              Standard verification turnaround is 24 to 48 business hours. Once approved, your clinic and outpatient consultation services will be activated automatically across the CareSetu platform.
            </p>
          </div>
        )}

        {status === "REJECTED" && (
          <div className="space-y-2 text-sm text-text-secondary">
            <p>
              ⚠️ Administrative review requires revisions or further documentation before activation.
            </p>
            <p>
              Please address the reviewer notes above and contact CareSetu Provider Support or update your profile details to trigger a re-audit.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
