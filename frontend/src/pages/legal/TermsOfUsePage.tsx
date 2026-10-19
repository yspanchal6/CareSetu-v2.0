import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, FileText, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card } from "../../components/common/Card";

export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-sm font-semibold text-sky hover:text-navy transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Home
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky/10 text-sky flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-navy">CareSetu Terms of Use</h1>
              <p className="text-xs text-slate-500 mt-1">
                Policy Version: <strong>2026.1</strong> | Last Updated: October 18, 2026 |{" "}
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">
                  Draft — Subject to Final Legal Review
                </span>
              </p>
            </div>
          </div>
        </div>

        <Card className="p-6 sm:p-10 space-y-8 bg-white border border-slate-200 shadow-sm leading-relaxed text-slate-700">
          {/* Notice Banner */}
          <div className="p-4 bg-sky/5 border border-sky/20 rounded-xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-sky shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-navy">Emergency Healthcare & Triage Notice</p>
              <p className="text-slate-600 mt-1">
                CareSetu is a digital healthcare coordination platform connecting patients, hospitals, independent doctors, and clinics. CareSetu is <strong>not an emergency replacement for national emergency lines (e.g. 108 / 112)</strong> and does not directly dispense medical advice, guaranteed emergency transport, or hospital admission.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <span className="text-xs font-black bg-navy text-white px-2 py-0.5 rounded">1</span>
              Service Scope & Emergency Limitations
            </h2>
            <p className="text-sm">
              1.1 <strong>Coordination Only:</strong> CareSetu provides real-time facility discovery, progressive hospital emergency matching (8km to 64km radius), encrypted medical record sharing (HealthPack), and administrative scheduling.
            </p>
            <p className="text-sm">
              1.2 <strong>Hospital Autonomy:</strong> Participating hospitals retain complete clinical autonomy to accept, route, or reject incoming cases based on real-time bed capacity, ICU availability, and specialist coverage. CareSetu does not guarantee hospital acceptance or immediate treatment.
            </p>
            <p className="text-sm">
              1.3 <strong>Sequential Candidate Rotation:</strong> When an emergency SOS is triggered, candidate hospitals are contacted sequentially with a 20-second response window. If a contacted hospital does not respond within the window, the platform auto-routes the emergency to the next closest verified facility.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <span className="text-xs font-black bg-navy text-white px-2 py-0.5 rounded">2</span>
              User Accounts, Verification & Roles
            </h2>
            <p className="text-sm">
              2.1 <strong>Dual Factor Verification:</strong> Public registration requires valid, verifiable Indian mobile numbers (+91) and active email addresses verified via 6-digit one-time passwords (OTP).
            </p>
            <p className="text-sm">
              2.2 <strong>Role Boundaries:</strong> CareSetu enforces strict role-based separation:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-sm text-slate-600">
              <li><strong>Patients:</strong> Can trigger Emergency SOS, view personal records, manage HealthPacks, and book outpatient consultations.</li>
              <li><strong>Hospitals:</strong> Can receive emergency triage alerts, accept transfers, assign affiliated doctors, and manage facility capacity.</li>
              <li><strong>Hospital Doctors:</strong> Affiliated with a specific hospital institution; can review assigned emergency cases, submit clinical diagnoses, and request case closure.</li>
              <li><strong>Independent Doctors:</strong> Practice outside hospital emergency wards; can offer outpatient consultations, update clinical specialty credentials, and manage independent practice profiles.</li>
              <li><strong>Clinics:</strong> Independent clinical provider organizations subject to administrative document and license verification.</li>
              <li><strong>Administrators:</strong> Supervise provider verification, government health data reconciliation, security epochs, and platform governance.</li>
            </ul>
            <p className="text-sm">
              2.3 <strong>Credential Integrity:</strong> Users are responsible for safeguarding login credentials. Creating multiple duplicate accounts with identical verified phone numbers or email addresses is blocked.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <span className="text-xs font-black bg-navy text-white px-2 py-0.5 rounded">3</span>
              Medical Data, HealthPack & Encryption
            </h2>
            <p className="text-sm">
              3.1 <strong>HealthPack Decryption:</strong> Patient medical histories, blood groups, allergies, and chronic conditions are encrypted using AES-256-CBC authenticated keys.
            </p>
            <p className="text-sm">
              3.2 <strong>Time-Bound Emergency Sharing:</strong> When a hospital formally accepts an emergency case, temporary time-limited access (24-hour expiry) is granted to the accepting institution.
            </p>
            <p className="text-sm">
              3.3 <strong>Audit Logging:</strong> Every decryption, access, view, or document download is immutably logged with user identifiers, timestamps, and action types (`HEALTH_PACK_VIEWED`, `DOCUMENT_UPLOADED`).
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <span className="text-xs font-black bg-navy text-white px-2 py-0.5 rounded">4</span>
              Prohibited Conduct & Anti-Tamper Security
            </h2>
            <p className="text-sm">
              Users must not:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-sm text-slate-600">
              <li>Transmit falsified medical emergencies or artificial SOS triggers.</li>
              <li>Capture, screen-record, or exfiltrate protected patient health packs (monitored via security violation detectors and security epochs).</li>
              <li>Attempt to bypass rate limits, token verifications, or cross-hospital authorization barriers.</li>
              <li>Impersonate licensed medical practitioners or registered healthcare establishments.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <span className="text-xs font-black bg-navy text-white px-2 py-0.5 rounded">5</span>
              Account Deletion, Termination & Grievances
            </h2>
            <p className="text-sm">
              5.1 <strong>Account Deletion:</strong> Users have the right to request account deletion under platform governance settings. Account deletion requests undergo administrative compliance review to ensure pending emergency liabilities and medical records retention requirements are satisfied before permanent termination.
            </p>
            <p className="text-sm">
              5.2 <strong>Grievance Redressal:</strong> For questions, data requests, or dispute resolutions regarding these Terms, contact our operational privacy officer at{" "}
              <a href="mailto:grievance@caresetu.local" className="text-sky font-medium hover:underline">
                grievance@caresetu.local
              </a>.
            </p>
          </section>

          <div className="pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© 2026 CareSetu. All rights reserved.</p>
            <div className="flex gap-4">
              <Link to="/privacy" className="text-sky hover:underline">Privacy Policy</Link>
              <Link to="/data-declaration" className="text-sky hover:underline">Data Declaration</Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
