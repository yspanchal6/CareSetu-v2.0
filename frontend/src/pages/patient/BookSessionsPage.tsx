import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock, Star, CheckCircle2 } from "lucide-react";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import { useToast } from "../../components/common/Toast";

const doctors = [
  { id: "D1", name: "Dr. Rina Naik", specialty: "Cardiologist", rating: 4.8, nextSlot: "Today, 4:30 PM" },
  { id: "D2", name: "Dr. Sameer Joshi", specialty: "General Physician", rating: 4.6, nextSlot: "Today, 6:00 PM" },
  { id: "D3", name: "Dr. Kavita Rao", specialty: "Neurologist", rating: 4.7, nextSlot: "Tomorrow, 10:00 AM" },
  { id: "D4", name: "Dr. Arvind Mehta", specialty: "Pediatrician", rating: 4.5, nextSlot: "Tomorrow, 11:30 AM" },
];

const slots = ["10:00 AM", "11:30 AM", "2:00 PM", "4:30 PM", "6:00 PM"];

export default function BookSessionsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [selectedDoctor, setSelectedDoctor] = useState<(typeof doctors)[number] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState(slots[0]);
  const [booked, setBooked] = useState<string[]>([]);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary w-fit">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div>
        <h2 className="font-bold text-navy text-lg">Book a doctor session</h2>
        <p className="text-sm text-text-secondary mt-1">Schedule a non-emergency consultation with a CareSetu network doctor.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {doctors.map((d) => {
          const isBooked = booked.includes(d.id);
          return (
            <Card key={d.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-lightblue flex items-center justify-center font-bold text-navy-dark">
                  {d.name.split(" ").map((n) => n[0]).join("").replace("D", "").slice(0, 2) || "DR"}
                </div>
                <div>
                  <p className="font-semibold text-navy text-sm">{d.name}</p>
                  <p className="text-xs text-text-secondary">{d.specialty}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 font-semibold text-amber-500"><Star className="w-3.5 h-3.5 fill-amber-500" /> {d.rating}</span>
                <span className="flex items-center gap-1 text-text-secondary"><Clock className="w-3.5 h-3.5" /> {d.nextSlot}</span>
              </div>
              {isBooked ? (
                <Badge tone="stable">Session booked</Badge>
              ) : (
                <Button variant="primary" size="sm" fullWidth onClick={() => setSelectedDoctor(d)}>
                  Book session
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <Modal open={!!selectedDoctor} onClose={() => setSelectedDoctor(null)} title="Choose a time slot" size="sm">
        {selectedDoctor && (
          <>
            <p className="text-sm text-text-secondary mb-4">
              Booking with <span className="font-semibold text-navy">{selectedDoctor.name}</span> ({selectedDoctor.specialty})
            </p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {slots.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSlot(s)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium ${
                    selectedSlot === s ? "border-sky bg-paleblue text-navy" : "border-slate-200 text-text-secondary"
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> {s}
                </button>
              ))}
            </div>
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                setBooked((prev) => [...prev, selectedDoctor.id]);
                showToast("success", `Session booked with ${selectedDoctor.name} at ${selectedSlot}.`);
                setSelectedDoctor(null);
              }}
            >
              Confirm booking
            </Button>
          </>
        )}
      </Modal>
    </div>
  );
}
