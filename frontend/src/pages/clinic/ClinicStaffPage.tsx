import { useEffect, useState } from "react";
import { Card } from "../../components/common/Card";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Users, ShieldAlert, UserCheck, Info } from "lucide-react";
import { clinicApi } from "../../services/api";

export default function ClinicStaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    clinicApi
      .getStaff()
      .then((res: any) => {
        if (!mounted) return;
        if (res && res.success) {
          setStaff(Array.isArray(res.staff) ? res.staff : []);
        } else {
          setError("Failed to load staff roster.");
        }
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message || "Unable to retrieve medical staff roster.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <LoadingState label="Loading clinic staff roster..." />;
  if (error) return <ErrorState title="Staff Roster Unavailable" message={error} />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
          <Users className="w-6 h-6 text-sky-600" />
          Clinic Medical Staff Roster
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Registered outpatient physicians, nursing staff, and medical personnel associated with this facility.
        </p>
      </div>

      {/* Transparent Capability Notice */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm">
          <p className="font-semibold text-amber-900">Administrative Staff Management</p>
          <p className="mt-0.5 text-amber-800">
            Outpatient physician credential linking and staff registration are verified administratively to ensure
            all practicing clinicians hold active state medical council licenses. Direct self-service staff invitation
            is unavailable in this release.
          </p>
        </div>
      </div>

      <Card className="p-6">
        {staff.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Associated Staff Records"
            message="Physicians linked to your clinic establishment license will appear here once verified by state administrators."
          />
        ) : (
          <div className="space-y-3">
            {staff.map((member: any) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 rounded-xl border border-border-light bg-bg-secondary"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                    {member.name?.[0] || "D"}
                  </div>
                  <div>
                    <p className="font-semibold text-navy">{member.name}</p>
                    <p className="text-xs text-text-secondary">
                      {member.role || "Practitioner"} {member.specialty ? `· ${member.specialty}` : ""}
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  <UserCheck className="w-3.5 h-3.5" />
                  Verified
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
