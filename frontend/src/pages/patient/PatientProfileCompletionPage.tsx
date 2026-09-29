import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { User, Phone, MapPin, Heart, AlertCircle, Save, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, X, UploadCloud, FileText, Image as ImageIcon, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/common/Toast";
import { Input, Select } from "../../components/common/Input";
import Button from "../../components/common/Button";
import { UnsavedChangesModal } from "../../components/common/UnsavedChangesModal";
import { getAuthToken, patientApi, medicalDocumentApi } from "../../services/api";

interface UploadedDocItem {
  id: string;
  name: string;
  size: string;
  type: string;
  status: "uploading" | "done";
  suggestions?: string[];
}

export default function PatientProfileCompletionPage() {
  const { user, setSession, updateUser, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || "");
  const [age, setAge] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("MALE");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medicalConditions, setMedicalConditions] = useState("");
  const [medications, setMedications] = useState("");

  // Emergency contact
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("Family");

  // Optional Documents
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocItem[]>([]);
  const [docType, setDocType] = useState("LAB_REPORT");
  const [dragOver, setDragOver] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  // Load existing profile & documents if available
  useEffect(() => {
    patientApi.getProfile().then((res) => {
      if (res.success && res.patient) {
        const p = res.patient;
        if (p.name) setName(p.name);
        if (p.age) setAge(String(p.age));
        if (p.gender) setGender(p.gender);
        if (p.phone) setPhone(p.phone);
        if (p.bloodGroup) setBloodGroup(p.bloodGroup);
        if (p.allergies) setAllergies(p.allergies);
        if (p.medicalConditions || p.conditions) setMedicalConditions(p.medicalConditions || p.conditions);
        if (p.medications) setMedications(p.medications);

        if (p.emergencyContacts && Array.isArray(p.emergencyContacts) && p.emergencyContacts.length > 0) {
          const contact = p.emergencyContacts[0];
          setEmergencyName(contact.name || "");
          setEmergencyPhone(contact.phone || "");
          setEmergencyRelation(contact.relation || "Family");
        }
      }
    }).catch(() => {});

    medicalDocumentApi.getMyDocuments().then((res) => {
      if (res.success && Array.isArray(res.data)) {
        const fetched = res.data.map((d: any) => ({
          id: d.id,
          name: d.fileName,
          size: d.fileSize ? `${(d.fileSize / 1024).toFixed(0)} KB` : "N/A",
          type: d.fileType === "IMAGE" ? "image" : "pdf",
          status: "done" as const,
          suggestions: d.extractedConditions ? d.extractedConditions.split(", ") : [],
        }));
        setUploadedDocs(fetched);
      }
    }).catch(() => {});
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
    const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    const MAX_SIZE = 10 * 1024 * 1024;

    for (const file of Array.from(files)) {
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      const isExtensionValid = ALLOWED_EXTENSIONS.includes(ext);
      const isMimeValid = !file.type || ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

      if (!isExtensionValid || !isMimeValid) {
        showToast("error", `Invalid file format for "${file.name}". Allowed: PDF, JPG, PNG.`);
        continue;
      }

      if (file.size > MAX_SIZE) {
        showToast("error", `File "${file.name}" exceeds maximum allowed limit of 10MB.`);
        continue;
      }

      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const isImage = file.type.startsWith("image/") || ext === ".jpg" || ext === ".jpeg" || ext === ".png";
      const newDoc: UploadedDocItem = {
        id: tempId,
        name: file.name,
        size: `${(file.size / 1024).toFixed(0)} KB`,
        type: isImage ? "image" : "pdf",
        status: "uploading",
      };
      setUploadedDocs((prev) => [newDoc, ...prev]);

      try {
        const res = await medicalDocumentApi.upload(file, docType);
        if (res.success) {
          const suggestions = res.suggestedConditions || [];
          setUploadedDocs((prev) =>
            prev.map((d) =>
              d.id === tempId
                ? {
                    id: res.data.id,
                    name: res.data.fileName,
                    size: `${(res.data.fileSize / 1024).toFixed(0)} KB`,
                    type: isImage ? "image" : "pdf",
                    status: "done",
                    suggestions,
                  }
                : d
            )
          );
          showToast("success", `${file.name} uploaded to your Health Pack.`);
        } else {
          setUploadedDocs((prev) => prev.filter((d) => d.id !== tempId));
          showToast("error", res.error || "Failed to upload document.");
        }
      } catch (err: any) {
        setUploadedDocs((prev) => prev.filter((d) => d.id !== tempId));
        showToast("error", err.message || "Upload error.");
      }
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      const res = await medicalDocumentApi.delete(id);
      if (res.success) {
        setUploadedDocs((prev) => prev.filter((d) => d.id !== id));
        showToast("info", "Document removed.");
      }
    } catch (err) {
      showToast("error", "Could not delete document.");
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Full name is required";
    if (!age || isNaN(Number(age)) || Number(age) < 0 || Number(age) > 120) {
      newErrors.age = "Please enter a valid age between 0 and 120";
    }
    if (phone && !/^[6-9]\d{9}$/.test(phone.trim())) {
      newErrors.phone = "Enter a valid 10-digit Indian phone number";
    }
    if (emergencyPhone && !/^[6-9]\d{9}$/.test(emergencyPhone.trim())) {
      newErrors.emergencyPhone = "Enter a valid 10-digit emergency phone number";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Calculate completion percentage
  const fields = [name, age, gender, phone, address, bloodGroup, emergencyName, emergencyPhone];
  const completedFields = fields.filter((f) => String(f).trim().length > 0).length;
  const progressPercent = Math.round((completedFields / fields.length) * 100);

  const saveProfileData = async (isFinalSubmit: boolean = false) => {
    if (saving) return false;

    if (isFinalSubmit && !validate()) {
      showToast("error", "Please fix the validation errors before submitting.");
      return false;
    }

    setSaving(true);
    try {
      const payload: any = {
        name,
        age: Number(age) || 0,
        gender,
        phone,
        bloodGroup,
        allergies,
        medicalConditions,
        conditions: medicalConditions,
        medications,
        emergencyContacts: emergencyName ? [{ name: emergencyName, phone: emergencyPhone, relation: emergencyRelation }] : [],
      };

      const res = await patientApi.updateProfile(payload);
      if (res.success) {
        showToast("success", isFinalSubmit ? "Patient profile completed successfully!" : "Profile draft saved.");
        setIsDirty(false);

        const isComplete = Boolean(res.user?.isProfileComplete) || (isFinalSubmit && Boolean(
          name.trim().length >= 2 &&
          Number(age) > 0 &&
          gender &&
          gender.toUpperCase() !== "UNSPECIFIED"
        ));

        if (res.user) {
          updateUser({
            ...res.user,
            patient: res.patient || res.user.patient,
            isProfileComplete: isComplete,
          });
        } else if (res.patient) {
          updateUser({
            patient: res.patient,
            isProfileComplete: isComplete,
          });
        }
        await refreshUser();
        return true;
      }
      showToast("error", res.error || "Failed to save profile.");
      return false;
    } catch (err: any) {
      showToast("error", err?.message || "Error saving patient profile.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndContinue = async () => {
    const success = await saveProfileData(true);
    if (success) {
      navigate("/patient/dashboard", { state: { profileJustCompleted: true } });
    }
  };

  const handleSkipOrExit = (target: string) => {
    if (isDirty) {
      setPendingTarget(target);
      setShowExitModal(true);
    } else {
      navigate(target);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 pt-6 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Top Navigation Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSkipOrExit("/patient/dashboard")}
              className="p-2 rounded-xl text-slate-500 hover:text-navy hover:bg-slate-100 transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-extrabold text-navy">Patient Profile Completion</h1>
              <p className="text-xs text-text-secondary">Setup your healthcare profile for tailored emergency matching</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleSkipOrExit("/patient/dashboard")}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Skip for Now
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveProfileData(false)}
              disabled={saving}
              className="text-xs"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              Save Draft
            </Button>
          </div>
        </div>

        {/* Progress Bar Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-navy flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky" />
              Profile Completion Progress
            </span>
            <span className="text-sky font-bold">{progressPercent}% Completed</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky to-sky-dark transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Form Body */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSaveAndContinue(); }}
          className="space-y-6"
          onChange={() => setIsDirty(true)}
        >
          {/* Section 1: Basic Information */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <User className="w-5 h-5 text-sky" />
              <h2 className="font-bold text-navy text-base">1. Basic Details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-navy mb-1">Full Name *</label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setIsDirty(true); }}
                  placeholder="e.g. Ramesh Kumar"
                  error={errors.name}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy mb-1">Age *</label>
                <Input
                  type="number"
                  value={age}
                  onChange={(e) => { setAge(e.target.value); setIsDirty(true); }}
                  placeholder="e.g. 34"
                  error={errors.age}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy mb-1">Gender *</label>
                <Select
                  value={gender}
                  onChange={(e) => { setGender(e.target.value); setIsDirty(true); }}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="UNSPECIFIED">Prefer not to say</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy mb-1">Phone Number</label>
                <Input
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setIsDirty(true); }}
                  placeholder="e.g. 9876543210"
                  error={errors.phone}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy mb-1">Current Residential Address</label>
              <Input
                value={address}
                onChange={(e) => { setAddress(e.target.value); setIsDirty(true); }}
                placeholder="Flat / Building, Street, City, State"
              />
            </div>
          </div>

          {/* Section 2: Emergency Contact */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Phone className="w-5 h-5 text-sky" />
              <h2 className="font-bold text-navy text-base">2. Primary Emergency Contact</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-navy mb-1">Contact Name</label>
                <Input
                  value={emergencyName}
                  onChange={(e) => { setEmergencyName(e.target.value); setIsDirty(true); }}
                  placeholder="e.g. Sunita Kumar"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy mb-1">Contact Phone</label>
                <Input
                  value={emergencyPhone}
                  onChange={(e) => { setEmergencyPhone(e.target.value); setIsDirty(true); }}
                  placeholder="e.g. 9876543210"
                  error={errors.emergencyPhone}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy mb-1">Relationship</label>
                <Select
                  value={emergencyRelation}
                  onChange={(e) => { setEmergencyRelation(e.target.value); setIsDirty(true); }}
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Child">Child</option>
                  <option value="Friend">Friend / Other</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 3: Basic Medical Information */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Heart className="w-5 h-5 text-rose-500" />
              <h2 className="font-bold text-navy text-base">3. Basic Medical Details (Optional)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-navy mb-1">Blood Group</label>
                <Select
                  value={bloodGroup}
                  onChange={(e) => { setBloodGroup(e.target.value); setIsDirty(true); }}
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy mb-1">Known Allergies</label>
                <Input
                  value={allergies}
                  onChange={(e) => { setAllergies(e.target.value); setIsDirty(true); }}
                  placeholder="e.g. Penicillin, Dust, Peanuts"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-navy mb-1">Existing Medical Conditions</label>
                <Input
                  value={medicalConditions}
                  onChange={(e) => { setMedicalConditions(e.target.value); setIsDirty(true); }}
                  placeholder="e.g. Asthma, Hypertension, Diabetes"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy mb-1">Current Medications</label>
                <Input
                  value={medications}
                  onChange={(e) => { setMedications(e.target.value); setIsDirty(true); }}
                  placeholder="e.g. Inhaler, Metformin 500mg"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Optional Document Upload */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-sky" />
                <h2 className="font-bold text-navy text-base">4. Upload Medical Documents (Optional)</h2>
              </div>
              <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-full">Optional</span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Attach medical reports, prescriptions, or discharge summaries to enrich your encrypted Health Pack. You can complete your profile without uploading documents and add them anytime later.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <label className="text-xs font-bold text-navy shrink-0">Document Type:</label>
              <Select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="text-xs py-1.5"
              >
                <option value="LAB_REPORT">Blood / Lab Report</option>
                <option value="PRESCRIPTION">Prescription</option>
                <option value="DISCHARGE_SUMMARY">Discharge Summary</option>
                <option value="DIAGNOSIS_REPORT">Diagnosis Report</option>
                <option value="OTHER">Other Medical Document</option>
              </Select>
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
                dragOver ? "border-sky bg-paleblue" : "border-slate-200 hover:border-sky/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files);
              }}
            >
              <UploadCloud className="w-7 h-7 text-sky mx-auto mb-2" />
              <p className="font-semibold text-navy text-xs sm:text-sm">Drag & drop files here or browse</p>
              <p className="text-[11px] text-text-secondary mt-1 mb-3">Allowed: PDF, JPG, PNG | Max size: 10 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs"
              >
                Select Files
              </Button>
            </div>

            {uploadedDocs.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold text-navy">Uploaded Documents ({uploadedDocs.length})</p>
                <div className="space-y-2">
                  {uploadedDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {doc.type === "image" ? <ImageIcon className="w-4 h-4 text-sky shrink-0" /> : <FileText className="w-4 h-4 text-sky shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-semibold text-navy truncate">{doc.name}</p>
                          <p className="text-[10px] text-slate-500">{doc.size}</p>
                        </div>
                      </div>
                      {doc.status === "uploading" ? (
                        <span className="text-sky animate-pulse font-medium">Uploading...</span>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={() => handleSkipOrExit("/patient/dashboard")}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-sm transition-colors text-center"
            >
              Exit to Dashboard
            </button>

            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? "Saving..." : "Save and Continue"}
              <ArrowRight className="w-4 h-4 ml-2 inline" />
            </Button>
          </div>
        </form>
      </div>

      {/* Unsaved changes dialog */}
      <UnsavedChangesModal
        isOpen={showExitModal}
        onConfirmExit={() => { setShowExitModal(false); navigate(pendingTarget || "/patient/dashboard"); }}
        onSaveDraftAndExit={async () => {
          setShowExitModal(false);
          const ok = await saveProfileData(false);
          if (ok) navigate(pendingTarget || "/patient/dashboard");
        }}
        onCancel={() => setShowExitModal(false)}
      />
    </div>
  );
}
