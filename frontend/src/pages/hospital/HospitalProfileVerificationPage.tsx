import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Save,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Navigation,
  FileText,
  Activity,
  Trash2,
  Check,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getAuthToken } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import { Input, Select } from "../../components/common/Input";
import Button from "../../components/common/Button";
import { UnsavedChangesModal } from "../../components/common/UnsavedChangesModal";
import { hospitalApi, documentVerificationApi, geocodingApi, DocumentVerificationStatus } from "../../services/api";

type StepIndex = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_TITLES = [
  "Hospital Basic Details",
  "Contact Information",
  "Location & Address",
  "Services & Facilities",
  "Document Upload",
  "Review & Submit",
];

export default function HospitalProfileVerificationPage() {
  const { user, setSession } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<StepIndex>(1);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  // Step 1: Basic Details
  const [name, setName] = useState(user?.name || "");
  const [hospitalType, setHospitalType] = useState("General");
  const [registrationNumber, setRegistrationNumber] = useState("");

  // Step 2: Contact Information
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email || "");

  // Step 3: Location and Address
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Step 4: Services and Facilities
  const [emergencyAvailable, setEmergencyAvailable] = useState(true);
  const [hasEmergencyDepartment, setHasEmergencyDepartment] = useState(true);
  const [hasICU, setHasICU] = useState(false);
  const [hasTraumaUnit, setHasTraumaUnit] = useState(false);
  const [hasCardiology, setHasCardiology] = useState(false);
  const [hasNeurology, setHasNeurology] = useState(false);
  const [hasAmbulance, setHasAmbulance] = useState(false);

  const [statusData, setStatusData] = useState<DocumentVerificationStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [confirmChecklist, setConfirmChecklist] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing hospital profile and verification status
  useEffect(() => {
    hospitalApi.getProfile().then((res) => {
      if (res.success && res.hospital) {
        const h = res.hospital;
        if (h.rejectionReason) setRejectionReason(h.rejectionReason);
        if (h.name) setName(h.name);
        if (h.phone) setPhone(h.phone);
        if (h.email) setEmail(h.email);
        if (h.address) setAddress(h.address);
        if (h.city) setCity(h.city);
        if (h.state) setState(h.state);
        if (h.emergencyAvailable !== undefined) setEmergencyAvailable(h.emergencyAvailable);
        if (h.hasICU !== undefined) setHasICU(h.hasICU);
        if (h.hasTraumaUnit !== undefined) setHasTraumaUnit(h.hasTraumaUnit);
        if (h.hasCardiology !== undefined) setHasCardiology(h.hasCardiology);
        if (h.hasNeurology !== undefined) setHasNeurology(h.hasNeurology);
        if (h.hasAmbulance !== undefined) setHasAmbulance(h.hasAmbulance);

        if (h.location) {
          if (typeof h.location === "object") {
            if (h.location.latitude) setLatitude(String(h.location.latitude));
            if (h.location.longitude) setLongitude(String(h.location.longitude));
          }
        }
      }
    }).catch(() => {});

    documentVerificationApi.getStatus().then((res) => {
      setStatusData(res);
    }).catch(() => {});
  }, []);

  // Automatic geocoding when Address, City, State, or Pincode are updated
  const handleAutoGeocode = async (overrideAddress?: string, overrideCity?: string, overrideState?: string, overridePincode?: string) => {
    const targetAddr = overrideAddress ?? address;
    const targetCity = overrideCity ?? city;
    const targetState = overrideState ?? state;
    const targetPin = overridePincode ?? pincode;

    if (!targetCity.trim() && !targetState.trim() && !targetAddr.trim()) return;

    setGeocoding(true);
    try {
      const res = await geocodingApi.geocode(targetAddr, targetCity, targetState, targetPin);
      if (res.success && res.latitude && res.longitude) {
        setLatitude(res.latitude.toFixed(6));
        setLongitude(res.longitude.toFixed(6));
        setIsDirty(true);
        showToast("success", `GPS coordinates calculated for address (${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)})`);
      }
    } catch (err: any) {
      console.warn("Geocode error:", err.message);
    } finally {
      setGeocoding(false);
    }
  };

  useEffect(() => {
    if (currentStep !== 3) return;
    if (!city.trim() && !address.trim() && !state.trim()) return;
    if (latitude && longitude && !isDirty) return; // don't override pre-existing valid coords unless edited

    const timer = setTimeout(() => {
      handleAutoGeocode();
    }, 1200);

    return () => clearTimeout(timer);
  }, [address, city, state, pincode, currentStep]);

  // Geolocation API & Reverse Geocoding
  const handleUseCurrentLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocation API is not supported by your browser. Please enter latitude and longitude manually.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        setIsDirty(true);
        setLocating(false);
        showToast("success", "Current GPS coordinates captured successfully!");

        // Reverse geocode to auto-populate address details if empty
        try {
          const revRes = await geocodingApi.reverseGeocode(lat, lng);
          if (revRes.success) {
            if (!city && revRes.city) setCity(revRes.city);
            if (!state && revRes.state) setState(revRes.state);
            if (!pincode && revRes.pincode) setPincode(revRes.pincode);
            if (!address && revRes.address) setAddress(revRes.address);
          }
        } catch {
          // Ignore reverse geocode error
        }
      },
      (error) => {
        setLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission denied. Please allow location access or enter coordinates manually.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information unavailable. Check network or GPS connection.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out. Please try again or enter manually.");
            break;
          default:
            setLocationError("Could not retrieve current location: " + error.message);
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Step Validation
  const validateStep = (step: StepIndex): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!name.trim()) newErrors.name = "Hospital name is required";
    }

    if (step === 2) {
      if (!phone.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
        newErrors.phone = "Enter a valid 10-digit Indian contact phone number";
      }
      if (!email.trim() || !email.includes("@")) {
        newErrors.email = "Enter a valid hospital email address";
      }
    }

    if (step === 3) {
      if (!address.trim()) newErrors.address = "Complete hospital address is required";
      if (!city.trim()) newErrors.city = "City / District is required";
      if (!state.trim()) newErrors.state = "State is required";

      const latNum = Number(latitude);
      const lngNum = Number(longitude);
      if (!latitude || isNaN(latNum) || latNum < -90 || latNum > 90) {
        newErrors.latitude = "Valid latitude (-90 to 90) is required";
      }
      if (!longitude || isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        newErrors.longitude = "Valid longitude (-180 to 180) is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 6) {
        setCurrentStep((prev) => (prev + 1) as StepIndex);
      }
    } else {
      showToast("error", "Please fix errors before proceeding.");
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as StepIndex);
    }
  };

  const saveHospitalData = async (isFinalSubmit: boolean = false) => {
    if (isFinalSubmit) {
      for (let s = 1; s <= 3; s++) {
        if (!validateStep(s as StepIndex)) {
          setCurrentStep(s as StepIndex);
          showToast("error", `Please complete required details in step ${s}.`);
          return false;
        }
      }
      if (!confirmChecklist) {
        showToast("error", "Please accept the consent confirmation checkbox before submitting for verification.");
        setErrors((prev) => ({ ...prev, consent: "Consent confirmation is required before submission." }));
        return false;
      }
    }

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        emergencyAvailable,
        hasEmergencyDepartment,
        hasICU,
        hasTraumaUnit,
        hasCardiology,
        hasNeurology,
        hasAmbulance,
        latitude: Number(latitude) || 0,
        longitude: Number(longitude) || 0,
        idempotencyKey: crypto.randomUUID(),
      };

      const res = isFinalSubmit
        ? await hospitalApi.submitOnboarding(payload)
        : await hospitalApi.updateProfile(payload);

      if (res.success) {
        showToast(
          "success",
          isFinalSubmit
            ? "Your hospital registration has been submitted successfully. Our verification team will review your details and documents."
            : "Hospital profile draft saved."
        );
        setIsDirty(false);
        if (res.user) {
          await setSession(res.user, getAuthToken() || "");
        }
        return true;
      }
      showToast("error", res.error || "Failed to save hospital profile.");
      return false;
    } catch (err: any) {
      showToast("error", err?.message || "Error saving hospital profile.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleFinalSubmit = async () => {
    const ok = await saveHospitalData(true);
    if (ok) {
      navigate("/hospital/dashboard");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("error", "File size exceeds maximum allowed limit of 10MB.");
      return;
    }

    setUploadingType(docType);
    try {
      await documentVerificationApi.uploadDocument(file, docType);
      showToast("success", "Hospital document uploaded successfully!");
      const updated = await documentVerificationApi.getStatus();
      setStatusData(updated);
    } catch (err: any) {
      showToast("error", err?.message || "Failed to upload hospital document.");
    } finally {
      setUploadingType(null);
      event.target.value = "";
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await documentVerificationApi.deleteDocument(docId);
      showToast("info", "Document removed.");
      const updated = await documentVerificationApi.getStatus();
      setStatusData(updated);
    } catch (err: any) {
      showToast("error", err?.message || "Failed to delete document.");
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

  const progressPercentage = Math.round(((currentStep - 1) / 5) * 100);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 pt-6 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSkipOrExit("/hospital/dashboard")}
              className="p-2 rounded-xl text-slate-500 hover:text-navy hover:bg-slate-100 transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-extrabold text-navy">Hospital Verification & Profile Setup</h1>
              <p className="text-xs text-text-secondary">Complete hospital details, GPS coordinates, and required licenses</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleSkipOrExit("/hospital/dashboard")}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Skip for Now
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveHospitalData(false)}
              disabled={saving}
              className="text-xs"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              Save Draft
            </Button>
          </div>
        </div>

        {/* Admin Rejection Feedback Banner */}
        {rejectionReason && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 text-amber-900 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Admin Rejection Feedback & Correction Request</span>
            </div>
            <p className="text-xs leading-relaxed bg-white/70 p-3 rounded-xl border border-amber-200/80 font-medium">
              "{rejectionReason}"
            </p>
            <p className="text-[11px] text-amber-700">
              Please review the feedback above, update your documents or details, and click <strong>Submit for Verification</strong> at Step 6.
            </p>
          </div>
        )}

        {/* Stepper Progress Bar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-navy flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky" />
              Step {currentStep} of 6: <span className="text-sky font-bold">{STEP_TITLES[currentStep - 1]}</span>
            </span>
            <span className="text-sky font-bold">{progressPercentage}% Onboarded</span>
          </div>

          {/* Stepper Dots / Bar */}
          <div className="grid grid-cols-6 gap-1.5">
            {STEP_TITLES.map((title, idx) => {
              const stepNum = (idx + 1) as StepIndex;
              const isCompleted = stepNum < currentStep;
              const isCurrent = stepNum === currentStep;

              return (
                <button
                  key={title}
                  type="button"
                  onClick={() => setCurrentStep(stepNum)}
                  className={`h-2 rounded-full transition-all ${
                    isCompleted
                      ? "bg-emerald-500"
                      : isCurrent
                      ? "bg-sky ring-2 ring-sky/30"
                      : "bg-slate-200"
                  }`}
                  title={`Step ${stepNum}: ${title}`}
                />
              );
            })}
          </div>
        </div>

        {/* Step Card Content */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6">

          {/* STEP 1: BASIC DETAILS */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building2 className="w-5 h-5 text-sky" />
                <h2 className="font-bold text-navy text-base">Step 1: Hospital Basic Details</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">Official Hospital Name *</label>
                  <Input
                    value={name}
                    onChange={(e) => { setName(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. City Care Superspecialty Hospital"
                    error={errors.name}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy mb-1">Hospital Category / Type</label>
                  <Select
                    value={hospitalType}
                    onChange={(e) => { setHospitalType(e.target.value); setIsDirty(true); }}
                  >
                    <option value="General">General Hospital</option>
                    <option value="Multispecialty">Multispecialty Hospital</option>
                    <option value="Superspecialty">Superspecialty Hospital</option>
                    <option value="TraumaCenter">Trauma & Emergency Center</option>
                    <option value="Clinic">Clinical Establishment</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy mb-1">Clinical Establishment Registration Number</label>
                <Input
                  value={registrationNumber}
                  onChange={(e) => { setRegistrationNumber(e.target.value); setIsDirty(true); }}
                  placeholder="e.g. REG-HOSP-2026-88921"
                />
              </div>
            </div>
          )}

          {/* STEP 2: CONTACT INFORMATION */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Phone className="w-5 h-5 text-sky" />
                <h2 className="font-bold text-navy text-base">Step 2: Emergency Contact Information</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">Hospital Helpdesk Phone *</label>
                  <Input
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. 9876543210"
                    error={errors.phone}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy mb-1">Hospital Email Address *</label>
                  <Input
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. emergency@citycarehospital.com"
                    error={errors.email}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: LOCATION AND ADDRESS */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-sky" />
                  <h2 className="font-bold text-navy text-base">Step 3: Location & Geolocation Coordinates</h2>
                </div>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-sky hover:bg-sky-100 font-semibold text-xs transition-colors border border-sky-200"
                >
                  {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                  <span>{locating ? "Locating..." : "Use My Current Location"}</span>
                </button>
              </div>

              {locationError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{locationError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-navy mb-1">Full Street Address *</label>
                <Input
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setIsDirty(true); }}
                  placeholder="Plot No, Main Road, Landmark"
                  error={errors.address}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">City / District *</label>
                  <Input
                    value={city}
                    onChange={(e) => { setCity(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. Ahmedabad"
                    error={errors.city}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy mb-1">State *</label>
                  <Input
                    value={state}
                    onChange={(e) => { setState(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. Gujarat"
                    error={errors.state}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy mb-1">Pincode</label>
                  <Input
                    value={pincode}
                    onChange={(e) => { setPincode(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. 380015"
                  />
                </div>
              </div>

              {/* Coordinates Preview */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-navy flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-sky" />
                    GPS Coordinates (Latitude & Longitude)
                  </span>
                  <div className="flex items-center gap-2">
                    {geocoding && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" /> Calculating...
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAutoGeocode()}
                      disabled={geocoding}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-sky text-sky text-xs font-semibold shadow-2xs transition-colors"
                    >
                      Geocode Address
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Latitude (°N) *</label>
                    <Input
                      value={latitude}
                      onChange={(e) => { setLatitude(e.target.value); setIsDirty(true); }}
                      placeholder="e.g. 23.0225"
                      error={errors.latitude}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Longitude (°E) *</label>
                    <Input
                      value={longitude}
                      onChange={(e) => { setLongitude(e.target.value); setIsDirty(true); }}
                      placeholder="e.g. 72.5714"
                      error={errors.longitude}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SERVICES AND FACILITIES */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Activity className="w-5 h-5 text-sky" />
                <h2 className="font-bold text-navy text-base">Step 4: Emergency Services & Department Capabilities</h2>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emergencyAvailable}
                    onChange={(e) => { setEmergencyAvailable(e.target.checked); setIsDirty(true); }}
                    className="w-4 h-4 text-sky rounded border-slate-300 focus:ring-sky"
                  />
                  <div>
                    <span className="text-sm font-bold text-navy block">24/7 Emergency Casualty Department Available</span>
                    <span className="text-xs text-slate-500">Ready to accept incoming SOS emergency cases</span>
                  </div>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasICU}
                      onChange={(e) => { setHasICU(e.target.checked); setIsDirty(true); }}
                      className="w-4 h-4 text-sky rounded"
                    />
                    <span className="text-xs font-semibold text-navy">Intensive Care Unit (ICU)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasTraumaUnit}
                      onChange={(e) => { setHasTraumaUnit(e.target.checked); setIsDirty(true); }}
                      className="w-4 h-4 text-sky rounded"
                    />
                    <span className="text-xs font-semibold text-navy">Trauma & Burn Unit</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasCardiology}
                      onChange={(e) => { setHasCardiology(e.target.checked); setIsDirty(true); }}
                      className="w-4 h-4 text-sky rounded"
                    />
                    <span className="text-xs font-semibold text-navy">Cardiology / Cath Lab</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasNeurology}
                      onChange={(e) => { setHasNeurology(e.target.checked); setIsDirty(true); }}
                      className="w-4 h-4 text-sky rounded"
                    />
                    <span className="text-xs font-semibold text-navy">Neurology & Stroke Unit</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasAmbulance}
                      onChange={(e) => { setHasAmbulance(e.target.checked); setIsDirty(true); }}
                      className="w-4 h-4 text-sky rounded"
                    />
                    <span className="text-xs font-semibold text-navy">On-Call ACLS Ambulance</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: DOCUMENT UPLOAD */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <FileText className="w-5 h-5 text-sky" />
                <h2 className="font-bold text-navy text-base">Step 5: Hospital License & Document Uploads (Optional)</h2>
              </div>

              <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-navy flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-sky shrink-0 mt-0.5" />
                <span>
                  <strong>Notice:</strong> Document upload is optional at this stage. Verification and emergency dispatch access require the required documents and approval.
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Upload official clinical establishment certificates or operating licenses (PDF, JPG, PNG &lt;= 10MB).
              </p>

              <div className="space-y-3">
                {(statusData?.requiredDocuments || [
                  { type: 'REGISTRATION_CERTIFICATE', label: 'Hospital Registration Certificate' },
                  { type: 'OPERATIONAL_LICENSE', label: 'Clinical Establishment Operational License' },
                ]).map((reqDoc) => {
                  const uploaded = (statusData?.uploadedDocuments || []).filter((d) => d.documentType === reqDoc.type);
                  const isUploaded = uploaded.length > 0;

                  return (
                    <div key={reqDoc.type} className={`p-4 rounded-xl border ${isUploaded ? "border-emerald-200 bg-emerald-50/20" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-navy">{reqDoc.label}</h4>
                          <span className={`text-[11px] font-semibold ${isUploaded ? "text-emerald-700 flex items-center gap-1" : "text-slate-400"}`}>
                            {isUploaded ? <><CheckCircle2 className="w-3 h-3 text-emerald-600 inline" /> Uploaded & Validated</> : "Optional (Pending)"}
                          </span>
                        </div>

                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, reqDoc.type)}
                            disabled={uploadingType === reqDoc.type}
                          />
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky text-white hover:bg-sky-600 transition-colors shadow-sm">
                            {uploadingType === reqDoc.type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                            <span>{isUploaded ? "Replace File" : "Upload File"}</span>
                          </span>
                        </label>
                      </div>

                      {uploaded.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                          {uploaded.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between text-xs text-slate-700 bg-white p-2 rounded border border-slate-100">
                              <span className="truncate">{doc.fileName}</span>
                              <button type="button" onClick={() => handleDeleteDocument(doc.id)} className="text-rose-500 hover:text-rose-700 p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 6: REVIEW AND SUBMIT */}
          {currentStep === 6 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-navy text-base">Step 6: Review & Final Verification Submission</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700">
                <div>
                  <span className="text-slate-400 block font-medium">Hospital Name</span>
                  <span className="font-bold text-navy">{name || "Not provided"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Contact Phone</span>
                  <span className="font-semibold">{phone || "Not provided"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Address</span>
                  <span>{address ? `${address}, ${city}, ${state}` : "Not provided"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Coordinates</span>
                  <span className="font-mono font-semibold">{latitude && longitude ? `${latitude}, ${longitude}` : "Not captured"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Uploaded Documents</span>
                  <span className="font-semibold">
                    {statusData?.uploadedDocuments?.length ? `${statusData.uploadedDocuments.length} document(s) uploaded` : "No documents uploaded (Optional)"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Emergency Casualty Service</span>
                  <span className="font-semibold text-emerald-700">{emergencyAvailable ? "24/7 Casualty Available" : "Disabled"}</span>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  After submitting, your hospital details will enter status <strong>PENDING_REVIEW</strong>. You can continue managing your hospital dashboard while our verification team verifies your facility details.
                </span>
              </div>

              <div className={`bg-slate-50 p-3.5 rounded-xl border ${errors.consent ? "border-rose-300 bg-rose-50/40" : "border-slate-200"}`}>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmChecklist}
                    onChange={(e) => {
                      setConfirmChecklist(e.target.checked);
                      if (e.target.checked) setErrors((prev) => ({ ...prev, consent: "" }));
                    }}
                    className="w-4 h-4 text-sky rounded mt-0.5"
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    I confirm that all provided hospital details, GPS location coordinates, and clinical facilities are genuine, accurate, and belong to this healthcare facility. *
                  </span>
                </label>
                {errors.consent && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1.5 ml-6">{errors.consent}</p>
                )}
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors"
              >
                ← Back
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSkipOrExit("/hospital/dashboard")}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors"
              >
                Exit to Dashboard
              </button>
            )}

            {currentStep < 6 ? (
              <Button
                type="button"
                variant="primary"
                onClick={handleNextStep}
                className="px-5 py-2.5"
              >
                Next Step →
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={handleFinalSubmit}
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? "Submitting..." : "Submit for Verification ✓"}
              </Button>
            )}
          </div>

        </div>
      </div>

      {/* Unsaved changes dialog */}
      <UnsavedChangesModal
        isOpen={showExitModal}
        onConfirmExit={() => { setShowExitModal(false); navigate(pendingTarget || "/hospital/dashboard"); }}
        onSaveDraftAndExit={async () => {
          setShowExitModal(false);
          const ok = await saveHospitalData(false);
          if (ok) navigate(pendingTarget || "/hospital/dashboard");
        }}
        onCancel={() => setShowExitModal(false)}
      />
    </div>
  );
}
