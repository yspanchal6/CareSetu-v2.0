import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card } from "../../components/common/Card";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import { SearchInput } from "../../components/common/Input";
import { ShieldCheck, ClipboardList, CalendarDays, FileText, UserCheck, CheckCircle2, Building2, AlertCircle } from "lucide-react";
import { DeleteAccountSection } from "../../components/common/DeleteAccountSection";
import { doctorApi, settingsApi } from "../../services/api";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { useAuth } from "../../context/AuthContext";

function useAssignedCases() {
  const location = useLocation();
  const { user } = useAuth();
  const isHospitalDoctorPortal = location.pathname.startsWith("/doctor/hospital");
  const isIndependentDoctorPortal =
    location.pathname.startsWith("/doctor/independent") ||
    user?.portalRoute?.includes("/doctor/independent") ||
    Boolean((user as any)?.independentProfile);

  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If the active portal or authenticated doctor profile is independent,
    // they are not assigned to a hospital emergency roster.
    // Skip requesting hospital emergency cases to prevent 403 authorization denials.
    if (isIndependentDoctorPortal) {
      setLoading(false);
      setCases([]);
      setError("HOSPITAL_AFFILIATION_REQUIRED");
      return;
    }

    let mounted = true;
    doctorApi.getCases()
      .then((res) => {
        if (!mounted) return;
        if (!res.success || !Array.isArray(res.cases)) {
          setError("The server returned an invalid assigned-case response.");
          return;
        }
        setCases(res.cases);
      })
      .catch((err: any) => {
        if (!mounted) return;
        const code = err?.code || err?.data?.code;
        if (err?.status === 403 && (code === "HOSPITAL_AFFILIATION_REQUIRED" || err?.message?.includes("affiliation"))) {
          setError("HOSPITAL_AFFILIATION_REQUIRED");
        } else {
          setError(err?.message || "Unable to load assigned cases.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [isIndependentDoctorPortal]);

  return { cases, loading, error, isIndependentDoctorPortal, isHospitalDoctorPortal };
}

export function DoctorPatientsPage() {
  const [query, setQuery] = useState("");
  const { cases, loading, error, isIndependentDoctorPortal, isHospitalDoctorPortal } = useAssignedCases();
  const casePathBase = isHospitalDoctorPortal ? "/doctor/hospital/cases" : "/doctor/cases";
  const filtered = cases.filter((c) => String(c.patientName || "").toLowerCase().includes(query.toLowerCase()));

  if (loading) return <LoadingState label="Loading assigned patients..." />;

  if (isIndependentDoctorPortal) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Outpatient directory workspace"
        message="Emergency patient lists are exclusive to hospital emergency rosters. Independent outpatient consultations are managed under Appointments and Services."
      />
    );
  }

  if (error === "HOSPITAL_AFFILIATION_REQUIRED") {
    return (
      <EmptyState
        icon={Building2}
        title="Hospital Affiliation Required"
        message="Active hospital staff affiliation is required to access emergency patient lists."
      />
    );
  }

  if (error) return <ErrorState title="Unable to load assigned patients" message={error} />;

  if (filtered.length === 0 && !query) {
    return <EmptyState icon={ClipboardList} title="No assigned patients" message="Patient records appear here only after an emergency case is assigned to you." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchInput placeholder="Search patients..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <Link key={c.id} to={`${casePathBase}/${c.id}`}>
            <Card>
              <p className="font-semibold text-navy">{c.patientName || "Emergency Patient"}</p>
              <p className="text-xs text-text-secondary mt-1">{c.age || "—"} yrs · {c.gender || "Unspecified"} · {c.bloodGroup || "Not reported"}</p>
              <p className="text-xs text-text-secondary mt-2">{c.symptoms || "Emergency evaluation requested"}</p>
              <p className="text-xs font-semibold text-sky-700 mt-2">{c.status}</p>
            </Card>
          </Link>
        ))}
      </div>
      {filtered.length === 0 && <EmptyState title="No matching patients" message="Try a different search term." />}
    </div>
  );
}

export function DoctorHealthPackPage() {
  const location = useLocation();
  const isHospitalDoctorPortal = location.pathname.startsWith("/doctor/hospital");
  const isIndependentDoctorPortal = location.pathname.startsWith("/doctor/independent");
  const casePathBase = isHospitalDoctorPortal ? "/doctor/hospital/cases" : "/doctor/cases";
  const { cases, loading, error } = useAssignedCases();

  if (loading) return <LoadingState label="Loading assigned cases..." />;

  if (isIndependentDoctorPortal) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Hospital Health Pack Access"
        message="Case-scoped Health Pack access is linked to emergency hospital cases. Outpatient clinical records are accessed during booked patient sessions."
      />
    );
  }

  if (error === "HOSPITAL_AFFILIATION_REQUIRED") {
    return (
      <EmptyState
        icon={Building2}
        title="Hospital Affiliation Required"
        message="Active hospital staff affiliation is required to decrypt emergency case Health Packs."
      />
    );
  }

  if (error) return <ErrorState title="Unable to load assigned cases" message={error} />;

  if (cases.length === 0) {
    return <EmptyState icon={ShieldCheck} title="No authorized Health Packs" message="A Health Pack becomes available from an assigned case when the patient's emergency access is active." />;
  }

  return (
    <div className={isHospitalDoctorPortal ? "hospital-doctor-page space-y-5" : "space-y-4"}>
      {isHospitalDoctorPortal && (
        <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Protected clinical records</p>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 mt-1">Health Pack access</h1>
          <p className="text-sm text-slate-600 mt-1">Open an assigned case to request its authorized patient Health Pack.</p>
        </header>
      )}
      <Card className={isHospitalDoctorPortal ? "border-sky-100 bg-gradient-to-r from-sky-50/80 to-white shadow-sm" : ""}>
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-navy-dark" />
          <div>
            <p className="font-bold text-navy">Case-scoped Health Pack access</p>
            <p className="text-xs text-text-secondary">Authorization, consent, and expiry are checked by the server when the case Health Pack is opened.</p>
          </div>
        </div>
      </Card>
      <div className="grid sm:grid-cols-2 gap-4">
        {cases.map((c) => (
          <Link key={c.id} to={`${casePathBase}/${c.id}`}>
            <Card className={`hover:border-sky-300 ${isHospitalDoctorPortal ? "transition-all hover:-translate-y-0.5 hover:shadow-md" : ""}`}>
              <p className="font-semibold text-navy">{c.patientName || "Emergency Patient"}</p>
              <p className="text-xs text-text-secondary mt-1">{c.caseId} · {c.status}</p>
              <p className="text-xs text-sky-700 font-semibold mt-3">Open case to request Health Pack access →</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function DoctorProfilePage() {
  const location = useLocation();
  const isHospitalDoctorPortal = location.pathname.startsWith("/doctor/hospital");
  const isIndependentDoctorPortal = location.pathname.startsWith("/doctor/independent");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    specialty: "General Physician",
    qualification: "MBBS",
    experienceYears: "5",
    licenseNumber: "",
    medicalCouncil: "State Medical Council",
    clinicAddress: "",
    city: "",
    state: "",
    pincode: "",
    bio: "",
  });

  useEffect(() => {
    let mounted = true;
    doctorApi.getProfile()
      .then((res) => {
        if (!mounted) return;
        if (res.success && res.profile) {
          setProfile(res.profile);
          const docProf = res.profile.independentProfile || res.profile.doctorProfile || {};
          setForm({
            name: docProf.fullName || res.profile.name || "",
            specialty: docProf.specialty || "General Physician",
            qualification: docProf.qualification || "MBBS",
            experienceYears: docProf.experienceYears ? String(docProf.experienceYears) : "5",
            licenseNumber: docProf.licenseNumber || "",
            medicalCouncil: docProf.medicalCouncil || "State Medical Council",
            clinicAddress: docProf.clinicAddress || "",
            city: docProf.city || "",
            state: docProf.state || "",
            pincode: docProf.pincode || "",
            bio: docProf.bio || "",
          });
        } else {
          setError("Doctor profile was not found.");
        }
      })
      .catch((err: any) => {
        if (mounted) setError(err?.message || "Unable to load the doctor profile.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  if (loading) return <LoadingState label="Loading doctor profile..." />;
  if (error) return <ErrorState title="Unable to load doctor profile" message={error} />;

  const affiliation = profile?.affiliation;
  const docProf = profile?.independentProfile || profile?.doctorProfile || {};

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    try {
      if (isIndependentDoctorPortal) {
        // Use authoritative doctorApi.updateIndependentProfile (PUT /api/doctors/profile)
        const updateRes = await doctorApi.updateIndependentProfile({
          fullName: form.name.trim(),
          specialty: form.specialty.trim(),
          qualification: form.qualification.trim(),
          experienceYears: Number(form.experienceYears) || 0,
          licenseNumber: form.licenseNumber.trim() || undefined,
          medicalCouncil: form.medicalCouncil.trim(),
          clinicAddress: form.clinicAddress.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim() || undefined,
          bio: form.bio.trim(),
          isIndependent: true,
        });
        if (updateRes && updateRes.success) {
          setSuccessMsg(updateRes.message || "Independent doctor profile updated and queued for review!");
        } else {
          throw new Error("Failed to save independent doctor profile.");
        }
      } else {
        await settingsApi.updateProfile({
          name: form.name.trim(),
          specialty: form.specialty.trim(),
          qualification: form.qualification.trim(),
          experienceYears: Number(form.experienceYears) || 0,
          clinicAddress: form.clinicAddress.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          bio: form.bio.trim(),
        });
        setSuccessMsg("Doctor profile updated successfully!");
      }
      setIsEditing(false);
      const res = await doctorApi.getProfile();
      if (res && res.profile) setProfile(res.profile);
    } catch (err: any) {
      setFormError(err.message || "Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={isHospitalDoctorPortal ? "hospital-doctor-page max-w-4xl space-y-6" : "max-w-3xl space-y-6"}>
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-sky-50 via-white to-blue-50/40 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100/70 text-sky-800 border border-sky-200/60">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Verified Clinical Practitioner</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-navy">
              Clinical Profile & Credentials
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Manage your clinical credentials, roster affiliation, and emergency practice information.
            </p>
          </div>
          <Button
            variant={isEditing ? "outline" : "primary"}
            size="sm"
            onClick={() => {
              setIsEditing(!isEditing);
              setFormError(null);
            }}
            className="shrink-0"
          >
            {isEditing ? "Cancel" : "Edit Profile"}
          </Button>
        </div>
      </div>

      {formError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {isEditing ? (
        <Card className="border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-navy text-lg mb-4">Edit Clinical Profile</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Professional Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Clinical Specialty</label>
                <input
                  type="text"
                  required
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Degrees & Qualifications</label>
                <input
                  type="text"
                  value={form.qualification}
                  onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Years of Experience</label>
                <input
                  type="number"
                  min="0"
                  max="70"
                  value={form.experienceYears}
                  onChange={(e) => setForm({ ...form, experienceYears: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Medical Registration No.</label>
                <input
                  type="text"
                  value={form.licenseNumber}
                  onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                  placeholder="e.g. G-12345/MCI"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Medical Council</label>
                <input
                  type="text"
                  value={form.medicalCouncil}
                  onChange={(e) => setForm({ ...form, medicalCouncil: e.target.value })}
                  placeholder="e.g. Gujarat Medical Council"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Practice City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">State / Region</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Postal PIN Code</label>
                <input
                  type="text"
                  value={form.pincode}
                  onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                  placeholder="e.g. 380001"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Clinic / Department Address</label>
              <input
                type="text"
                value={form.clinicAddress}
                onChange={(e) => setForm({ ...form, clinicAddress: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Professional Bio / Clinical Focus</label>
              <textarea
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setFormError(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? "Saving Changes..." : "Save Profile Details"}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="border border-slate-200/80 shadow-xs p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-navy text-lg">{profile.name}</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{docProf.specialty || "Emergency Physician"} · {docProf.qualification || "MBBS"}</p>
            </div>
            <Badge tone={docProf.verificationStatus === "APPROVED" || profile.isVerified ? "available" : "limited"}>
              {docProf.verificationStatus === "APPROVED" || profile.isVerified ? "Verified Practitioner" : "Pending Verification"}
            </Badge>
          </div>
          <dl className="grid sm:grid-cols-2 gap-5 mt-5 text-sm">
            <div><dt className="text-xs font-medium text-slate-500">Registered Email</dt><dd className="font-semibold text-navy mt-0.5">{profile.email}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Account Status</dt><dd className="font-semibold text-navy mt-0.5">{profile.status}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Medical Registration No.</dt><dd className="font-semibold text-navy mt-0.5">{docProf.licenseNumber || "Not provided"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Medical Council</dt><dd className="font-semibold text-navy mt-0.5">{docProf.medicalCouncil || "Not provided"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Experience</dt><dd className="font-semibold text-navy mt-0.5">{docProf.experienceYears ? `${docProf.experienceYears} Years` : "5 Years"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Practice City & State</dt><dd className="font-semibold text-navy mt-0.5">{[docProf.city, docProf.state].filter(Boolean).join(", ") || "Gujarat, India"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Clinic / Office Address</dt><dd className="font-semibold text-navy mt-0.5">{docProf.clinicAddress || "Not provided"}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Postal PIN Code</dt><dd className="font-semibold text-navy mt-0.5">{docProf.pincode || "Not provided"}</dd></div>
          </dl>
          {docProf.bio && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500">Clinical Focus &amp; Bio</p>
              <p className="text-sm text-slate-700 mt-1 leading-relaxed">{docProf.bio}</p>
            </div>
          )}
        </Card>
      )}

      {/* Hospital Affiliation Card */}
      <Card className="border border-slate-200/80 shadow-xs p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-sky-700" />
            <h3 className="font-bold text-navy text-base">Facility Affiliation &amp; Active Duty</h3>
          </div>
          {affiliation && (
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {affiliation.dutyStatus || "ON_DUTY"}
            </span>
          )}
        </div>
        {affiliation ? (
          <dl className="grid sm:grid-cols-2 gap-5 mt-4 text-sm">
            <div><dt className="text-xs font-medium text-slate-500">Hospital Facility</dt><dd className="font-semibold text-navy mt-0.5">{affiliation.hospitalName}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Staff Role / Department</dt><dd className="font-semibold text-navy mt-0.5">{affiliation.staffRole}{affiliation.specialty ? ` · ${affiliation.specialty}` : ""}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">Facility Location</dt><dd className="font-semibold text-navy mt-0.5">{[affiliation.city, affiliation.state].filter(Boolean).join(", ") || affiliation.address || "Active facility"}</dd></div>
          </dl>
        ) : (
          <div className="mt-4 p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs sm:text-sm">
            <p className="font-semibold text-amber-950">Independent Practice Mode</p>
            <p className="text-amber-800 mt-0.5">No hospital staff roster is currently associated with this doctor profile. You may provide independent clinical consultations or request facility placement.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

export function DoctorClinicalNotesPage() {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const casePathBase = pathname.startsWith("/doctor/hospital") ? "/doctor/hospital/cases" : "/doctor/cases";

  // General free-standing note saving has no persistence API; only case-scoped diagnosis and treatment notes are supported.
  if (pathname.startsWith("/doctor/independent")) {
    return (
      <EmptyState
        icon={FileText}
        title="Outpatient clinical notes are unavailable"
        message="Standalone outpatient note keeping is not connected to a supported record-keeping service yet, so notes cannot be saved from this page."
      />
    );
  }

  return (
    <EmptyState
      icon={FileText}
      title="General clinical notes are unavailable"
      message="Free-standing diagnosis and treatment notes are not connected to a supported record-keeping service yet. Authorized diagnosis and treatment notes are recorded per case inside the assigned case workspace."
      action={{ label: "Open Assigned Cases", onClick: () => navigate(casePathBase) }}
    />
  );
}

export function DoctorReportsPage() {
  return (
    <div className="space-y-4">
      <EmptyState
        icon={FileText}
        title="General reports are unavailable"
        message="A general doctor reporting data source is not available yet. Genuine diagnosis reports remain available within their authorized case details."
      />
    </div>
  );
}

export function DoctorAppointmentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isIndependentDoctorPortal =
    location.pathname.startsWith("/doctor/independent");

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-fade-in">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Outpatient Consultations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-navy">
              Appointments & Consultations
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Outpatient consultation calendar, tele-consultation requests, and clinic follow-up schedules.
            </p>
          </div>
          <Badge tone="accent">Outpatient Practice</Badge>
        </div>
      </div>

      {/* Scope Notice */}
      <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h4 className="font-bold text-sky-950 uppercase tracking-wider">Clinical Scope Distinction</h4>
          <p className="text-sky-800 leading-relaxed">
            Outpatient appointments and private consultations are scheduled directly at your registered practice facility. Hospital emergency trauma dispatches and triage cases are strictly separated and managed by licensed hospital emergency departments.
          </p>
        </div>
      </div>

      {/* Appointment Filter Pills & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 max-w-full overflow-x-auto scrollbar-none">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-white text-navy shadow-2xs font-bold whitespace-nowrap cursor-default"
          >
            All Consultations (0)
          </button>
          <button
            type="button"
            disabled
            className="px-3 py-1.5 rounded-lg text-slate-400 cursor-not-allowed opacity-70 whitespace-nowrap"
          >
            Pending
          </button>
          <button
            type="button"
            disabled
            className="px-3 py-1.5 rounded-lg text-slate-400 cursor-not-allowed opacity-70 whitespace-nowrap"
          >
            Confirmed
          </button>
          <button
            type="button"
            disabled
            className="px-3 py-1.5 rounded-lg text-slate-400 cursor-not-allowed opacity-70 whitespace-nowrap"
          >
            Completed
          </button>
        </div>

        <Link
          to="/doctor/independent/services"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-navy px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors w-fit"
        >
          <span>View Outpatient Services & Scope</span>
        </Link>
      </div>

      {/* Empty State */}
      <Card className="border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center mx-auto border border-sky-100">
          <CalendarDays className="w-7 h-7" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="font-bold text-navy text-lg">No Scheduled Appointments</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            You do not currently have any active outpatient consultation bookings or pending patient appointments.
          </p>
        </div>

        {/* Backend Capability Notice */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 max-w-lg mx-auto text-left space-y-2">
          <div className="flex items-center gap-2 font-bold text-navy">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Digital Booking Engine Integration</span>
          </div>
          <p className="leading-relaxed">
            Direct patient self-service booking and automated calendar sync are in development for CareSetu Outpatient Services. At present, practice metrics and consultation hours follow your verified clinic address and clinical specialty.
          </p>
          <p className="text-slate-500 text-[11px]">
            To ensure data integrity, appointment slots and patient bookings are not simulated without real patient records.
          </p>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/doctor/independent/dashboard")}
          >
            Back to Practice Dashboard
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate("/doctor/independent/services")}
          >
            Check Outpatient Services
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function DoctorSettingsPage() {
  const isHospitalDoctorPortal = useLocation().pathname.startsWith("/doctor/hospital");
  return (
    <div className={isHospitalDoctorPortal ? "hospital-doctor-page max-w-3xl space-y-5" : "max-w-lg space-y-4"}>
      {isHospitalDoctorPortal && (
        <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Portal preferences</p>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 mt-1">Settings</h1>
          <p className="text-sm text-slate-600 mt-1">Manage the preferences and account controls available to your doctor portal.</p>
        </header>
      )}
      <Card className={isHospitalDoctorPortal ? "border-slate-200 shadow-md" : ""}>
        <p className="font-semibold text-navy text-sm mb-3">Availability & Preferences</p>
        <p id="doctor-preferences-unavailable" className="text-xs text-text-secondary mb-2">
          These preferences are not connected to saved doctor settings yet. Controls are disabled so changes cannot be mistaken as saved.
        </p>
        {["On duty for new critical cases", "Notify me for AI-flagged cases", "Share notes with hospital admin"].map((s) => (
          <label key={s} className="flex items-center justify-between py-2 text-sm text-navy border-b border-slate-50 last:border-0">
            <span>{s}</span>
            <input
              type="checkbox"
              disabled
              aria-describedby="doctor-preferences-unavailable"
              className="w-4 h-4 accent-sky cursor-not-allowed opacity-60"
            />
          </label>
        ))}
      </Card>

      <DeleteAccountSection />
    </div>
  );
}
