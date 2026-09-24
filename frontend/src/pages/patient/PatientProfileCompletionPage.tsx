import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Phone, MapPin, Heart, AlertCircle, Save, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/common/Toast";
import { Input, Select } from "../../components/common/Input";
import Button from "../../components/common/Button";
import { UnsavedChangesModal } from "../../components/common/UnsavedChangesModal";
import { getAuthToken, patientApi } from "../../services/api";

export default function PatientProfileCompletionPage() {
  const { user, setSession, updateUser, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

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

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  // Load existing profile if available
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
    }).catch(() => {
      // Ignore background load error if fresh account
    });
  }, []);

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

        if (res.user) {
          updateUser({
            ...res.user,
            patient: res.patient || res.user.patient,
            isVerified: res.user.isVerified ?? true,
            isProfileComplete: true,
          });
        } else if (res.patient) {
          updateUser({
            patient: res.patient,
            isVerified: true,
            isProfileComplete: true,
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
      navigate("/patient/dashboard");
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
