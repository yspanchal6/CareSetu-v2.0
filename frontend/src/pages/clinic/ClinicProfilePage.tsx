import { useEffect, useState, FormEvent } from "react";
import { Card } from "../../components/common/Card";
import Button from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { useToast } from "../../components/common/Toast";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Building2, Save, Lock, AlertCircle } from "lucide-react";
import { clinicApi } from "../../services/api";

export default function ClinicProfilePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [servicesInput, setServicesInput] = useState("");
  const [specialtiesInput, setSpecialtiesInput] = useState("");
  const [operatingSchedule, setOperatingSchedule] = useState("");

  useEffect(() => {
    let mounted = true;
    clinicApi
      .getProfile()
      .then((res: any) => {
        if (!mounted) return;
        if (res && res.success && res.clinic) {
          const c = res.clinic;
          setName(c.name || "");
          setRegistrationNumber(c.registrationNumber || "");
          setPhone(c.phone || "");
          setAddress(c.address || "");
          setCity(c.city || "");
          setState(c.state || "");
          setPincode(c.pincode || "");
          setServicesInput(Array.isArray(c.services) ? c.services.join(", ") : "");
          setSpecialtiesInput(Array.isArray(c.specialties) ? c.specialties.join(", ") : "");
          setOperatingSchedule(c.operatingHours?.schedule || "Mon - Sat: 9:00 AM - 7:00 PM");
        } else {
          setError("Failed to load clinic profile.");
        }
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message || "Unable to retrieve clinic profile.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const services = servicesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const specialties = specialtiesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        phone,
        address,
        city,
        state,
        pincode,
        services,
        specialties,
        operatingHours: {
          schedule: operatingSchedule,
        },
      };

      const res = await clinicApi.updateProfile(payload);
      if (res && res.success) {
        toast({
          title: "Profile Updated",
          description: "Clinic profile details have been successfully saved.",
          type: "success",
        });
      } else {
        throw new Error(res?.message || "Failed to update profile.");
      }
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err?.message || "Could not save clinic profile. Please verify all fields.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading clinic details..." />;
  if (error) return <ErrorState title="Unable to load profile" message={error} />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
          <Building2 className="w-6 h-6 text-sky-600" />
          Clinic Profile Management
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage your facility details, outpatient operational hours, and contact information.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Protected Legal Identifiers */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-navy">
            <Lock className="w-4 h-4 text-text-secondary" />
            Verified Legal Identifiers
          </div>
          <p className="text-xs text-text-secondary">
            Legal identifiers are tied to your state clinical establishment license and require administrative review to change.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Clinic Legal Name</label>
              <Input value={name} disabled className="bg-bg-secondary cursor-not-allowed" />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">State Clinical Registration No.</label>
              <Input value={registrationNumber} disabled className="bg-bg-secondary font-mono cursor-not-allowed" />
            </div>
          </div>
        </Card>

        {/* Contact & Location */}
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-bold text-navy">Contact & Facility Location</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1">Street Address</label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Clinic street address and building number"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">City</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">State</label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Pincode</label>
              <Input
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="Pincode"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Public Contact Phone</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Clinic reception or helpline phone"
                required
              />
            </div>
          </div>
        </Card>

        {/* Operating Hours & Services */}
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-bold text-navy">Outpatient Hours & Offerings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Operating Schedule</label>
              <Input
                value={operatingSchedule}
                onChange={(e) => setOperatingSchedule(e.target.value)}
                placeholder="e.g. Mon - Sat: 9:00 AM - 7:00 PM, Sun: 10:00 AM - 2:00 PM"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Clinical Services (Comma Separated)
              </label>
              <Input
                value={servicesInput}
                onChange={(e) => setServicesInput(e.target.value)}
                placeholder="e.g. General OPD, Pediatrics, Blood Testing, ECG, Minor Suturing"
              />
              <p className="text-xs text-text-secondary mt-1">Separate multiple services with commas.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Specialties (Comma Separated)
              </label>
              <Input
                value={specialtiesInput}
                onChange={(e) => setSpecialtiesInput(e.target.value)}
                placeholder="e.g. Family Medicine, Dermatology, Orthopedics"
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving Changes..." : "Save Clinic Profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}
