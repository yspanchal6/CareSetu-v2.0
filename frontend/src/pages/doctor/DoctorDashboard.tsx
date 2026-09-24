import { ClipboardList, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { StatCard } from "../../components/common/Card";
import EmergencyCaseCard from "../../components/emergency/EmergencyCaseCard";
import { emergencies } from "../../data/emergencies";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { RoleStatusBanner } from "../../components/common/RoleStatusBanner";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const assigned = emergencies.filter((e) => ["HospitalAssigned", "Transfer", "Treatment"].includes(e.stage));
  const critical = assigned.filter((e) => e.severity === "Critical").length;
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      {!user?.isVerified && (
        <RoleStatusBanner role="doctor" status="Incomplete" />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Assigned Cases" value={assigned.length} icon={ClipboardList} />
        <StatCard label="Critical Cases" value={critical} icon={AlertTriangle} tone="emergency" />
        <StatCard label="Pending Cases" value={1} icon={Clock} tone="accent" />
        <StatCard label="Completed Cases" value={15} icon={CheckCircle2} tone="success" />
      </div>

      <div>
        <h3 className="font-bold text-navy mb-3">Recent patients</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {assigned.map((c) => (
            <div key={c.id} onClick={() => navigate(`/doctor/cases/${c.id}`)} className="cursor-pointer">
              <EmergencyCaseCard emergencyCase={c} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
