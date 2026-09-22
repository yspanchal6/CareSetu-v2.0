import { Building2, Siren, ClipboardList, Clock, BedDouble, HeartPulse, Users } from "lucide-react";
import { StatCard, Card } from "../../components/common/Card";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

const trend = [
  { m: "Jan", v: 120 }, { m: "Feb", v: 145 }, { m: "Mar", v: 132 }, { m: "Apr", v: 168 }, { m: "May", v: 190 }, { m: "Jun", v: 210 },
];
const acceptance = [
  { m: "Jan", v: 82 }, { m: "Feb", v: 85 }, { m: "Mar", v: 80 }, { m: "Apr", v: 88 }, { m: "May", v: 91 }, { m: "Jun", v: 94 },
];
const severityPie = [
  { name: "Critical", value: 24, color: "#EF4444" },
  { name: "Urgent", value: 41, color: "#EAB308" },
  { name: "Stable", value: 35, color: "#22C55E" },
];

export default function AdminDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Hospitals" value={486} icon={Building2} />
        <StatCard label="Active Emergencies" value={27} icon={Siren} tone="emergency" />
        <StatCard label="Cases Today" value={184} icon={ClipboardList} />
        <StatCard label="Avg Response Time" value="2.3 min" icon={Clock} tone="accent" />
        <StatCard label="Available Beds" value={2340} icon={BedDouble} tone="success" />
        <StatCard label="ICU Availability" value="18%" icon={HeartPulse} tone="emergency" />
        <StatCard label="Active Users" value="9,142" icon={Users} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <p className="font-semibold text-navy text-sm mb-3">Emergency volume over time</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="m" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="v" stroke="#38BDF8" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <p className="font-semibold text-navy text-sm mb-3">Cases by severity</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={severityPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {severityPie.map((s) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <p className="font-semibold text-navy text-sm mb-3">Hospital acceptance rate (%)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={acceptance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="m" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="v" fill="#0F4C81" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <p className="font-semibold text-navy text-sm mb-3">Recent cases</p>
          <div className="flex flex-col divide-y divide-slate-50">
            {["Amit Patel", "Divya Nair", "Karan Shah", "Arjun Reddy"].map((n) => (
              <div key={n} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-navy font-medium">{n}</span>
                <span className="text-text-secondary text-xs">Sector 14</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
