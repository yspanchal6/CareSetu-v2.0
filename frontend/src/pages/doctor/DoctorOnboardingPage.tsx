import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Building2,
  Stethoscope,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  FileText,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { doctorApi } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import Button from "../../components/common/Button";

export default function DoctorOnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [checking, setChecking] = useState(false);
  const [affiliationMessage, setAffiliationMessage] = useState<string | null>(null);

  const handleCheckAffiliation = async () => {
    setChecking(true);
    setAffiliationMessage(null);
    try {
      const res = await doctorApi.getProfile();
      if (res && res.success && res.profile) {
        const hasHospitalAffiliation = Boolean(
          res.profile.affiliation || (res.profile.affiliations && res.profile.affiliations.length > 0)
        );
        const hasIndependentProfile = Boolean(res.profile.independentProfile);

        if (hasHospitalAffiliation) {
          showToast("success", "Active hospital affiliation verified! Directing to Hospital Doctor Portal...");
          navigate("/doctor/hospital/dashboard", { replace: true });
          return;
        }

        if (hasIndependentProfile) {
          const status = res.profile.independentProfile?.verificationStatus;
          if (status === "APPROVED") {
            showToast("success", "Approved independent doctor profile found. Loading dashboard...");
            navigate("/doctor/independent/dashboard", { replace: true });
          } else {
            showToast("info", "Independent profile is awaiting review. Viewing verification status...");
            navigate("/doctor/independent/verification-status", { replace: true });
          }
          return;
        }

        setAffiliationMessage(
          "No active hospital affiliation record was found for your account yet. Please ensure your hospital administration has added your registered email."
        );
      }
    } catch (err: any) {
      setAffiliationMessage(err?.message || "Unable to check affiliation at this time. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Doctor Account Setup & Placement</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">
              Welcome to CareSetu Clinical Workspace
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Your account is registered as a <span className="font-semibold text-navy">Medical Doctor</span>. CareSetu maintains strict clinical scope separation between emergency hospital facilities and independent practice. Select your practice model below to activate your portal.
            </p>
          </div>
          <div className="sm:text-right shrink-0">
            <span className="text-xs text-slate-500 font-medium block">Registered Account Email</span>
            <span className="text-sm font-bold text-navy bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 inline-block mt-0.5">
              {user?.email || "No email"}
            </span>
          </div>
        </div>
      </div>

      {affiliationMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-950">Affiliation Status Check</p>
            <p className="text-amber-800 leading-relaxed">{affiliationMessage}</p>
          </div>
        </div>
      )}

      {/* Two Pathway Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pathway 1: Hospital Doctor */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-3xl p-6 flex flex-col justify-between transition-all duration-200 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-navy/10 text-navy flex items-center justify-center font-bold">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Hospital Jurisdiction
              </span>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-navy">Hospital Emergency Doctor</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                For physicians, surgeons, and duty medical officers serving in licensed hospital emergency departments, triage units, and trauma wards.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5 text-xs text-slate-700">
              <div className="font-semibold text-navy flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>How to activate Hospital Access:</span>
              </div>
              <ul className="space-y-1.5 list-disc pl-4 text-slate-600">
                <li>
                  Provide your registered email (<span className="font-medium text-navy">{user?.email}</span>) to your hospital administration.
                </li>
                <li>
                  Hospital admins must add you to their <span className="font-medium text-navy">Medical Staff</span> roster and set status to <span className="font-medium text-emerald-700">Active</span>.
                </li>
                <li>
                  Once added, emergency queues, trauma dispatch, and Health Pack decryption unlock automatically.
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 space-y-2.5">
            <Button
              variant="outline"
              onClick={handleCheckAffiliation}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 cursor-pointer py-2.5"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin text-sky" : ""}`} />
              <span>{checking ? "Checking Roster..." : "Check Hospital Affiliation"}</span>
            </Button>
            <div className="text-center">
              <Link
                to="/doctor/hospital/dashboard"
                className="text-xs font-semibold text-slate-500 hover:text-navy inline-flex items-center gap-1 transition-colors"
              >
                <span>Go to Hospital Doctor Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Pathway 2: Independent Practice Doctor */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-3xl p-6 flex flex-col justify-between transition-all duration-200 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-sky/10 text-sky-700 flex items-center justify-center font-bold">
                <Stethoscope className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                Outpatient Practice
              </span>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-navy">Independent Practitioner</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                For private practitioners, consultants, and clinic doctors managing outpatient appointments, telemedicine, and digital clinical notes.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5 text-xs text-slate-700">
              <div className="font-semibold text-navy flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-sky-600" />
                <span>How to activate Independent Practice:</span>
              </div>
              <ul className="space-y-1.5 list-disc pl-4 text-slate-600">
                <li>
                  Submit your <span className="font-medium text-navy">Medical Registration Number</span>, State Council, and qualification credentials.
                </li>
                <li>
                  Upload your medical registration certificate or license photo for identity verification.
                </li>
                <li>
                  Admin review typically completes within 24–48 hours for public directory listing.
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 space-y-2.5">
            <button
              type="button"
              onClick={() => navigate("/doctor/document-verification")}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-navy hover:bg-navy/90 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Submit Licensure & Verification</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <div className="text-center">
              <Link
                to="/doctor/independent/verification-status"
                className="text-xs font-semibold text-slate-500 hover:text-navy inline-flex items-center gap-1 transition-colors"
              >
                <span>Check Verification Status</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Helpful Clarification Footer */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-start gap-3.5">
        <HelpCircle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 leading-relaxed space-y-1">
          <p className="font-semibold text-navy">Why am I seeing this screen?</p>
          <p>
            Your account does not currently have an active hospital affiliation roster link or an approved independent doctor profile. Rather than directing you into unauthorized hospital queues or unapproved practice dashboards, CareSetu allows you to link with your hospital or submit your independent licensure credentials above.
          </p>
        </div>
      </div>
    </div>
  );
}
