import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Lock, Eye, ArrowLeft, Database, KeyRound, UserCheck } from "lucide-react";
import { Card } from "../../components/common/Card";

export default function PrivacyPolicyPage() {
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
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-navy">CareSetu Privacy Policy</h1>
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
          {/* Executive Commitment */}
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-start gap-3">
            <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-navy">Privacy & Sensitive Health Information Commitment</p>
              <p className="text-slate-600 mt-1">
                CareSetu handles sensitive personal health information (SPHI), geolocation data, and identity credentials. We process data strictly on purpose-specific necessity and never monetize, broker, or sell personal health data to advertising networks.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <span className="text-xs font-black bg-navy text-white px-2 py-0.5 rounded">1</span>
              Information We Collect
            </h2>
            <p className="text-sm">
              1.1 <strong>Account & Identification Data:</strong> Full name, verified mobile number (+91), email address, cryptographic password hash (bcrypt 12 rounds), and account role (Patient, Hospital, Doctor, Clinic, Admin).
            </p>
            <p className="text-sm">
              1.2 <strong>Protected Health Information (HealthPack):</strong> Age, gender, blood group, verified medical conditions, medication regimens, allergies, uploaded clinical prescriptions, diagnostic reports, and emergency contacts.
            </p>
            <p className="text-sm">
              1.3 <strong>Real-Time Geolocation Data:</strong> High-accuracy GPS coordinates (latitude, longitude, accuracy, timestamp) collected exclusively during Emergency SOS initiation or hospital facility mapping for routing optimization.
            </p>
            <p className="text-sm">
              1.4 <strong>Healthcare Provider Credentials:</strong> Medical registration numbers, state medical councils, qualification degrees, clinic addresses, and facility verification documentation.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <span className="text-xs font-black bg-navy text-white px-2 py-0.5 rounded">2</span>
              How We Use Your Information & Purpose of Processing
            </h2>
            <ul className="list-disc pl-6 space-y-1.5 text-sm text-slate-600">
              <li><strong>Emergency Hospital Triage:</strong> To calculate progressive proximity (8km to 64km radius) and match acute medical conditions with capable hospital departments (Cardiology, Trauma, ICU).</li>
              <li><strong>Secure HealthPack Sharing:</strong> To dynamically decrypt and present vital medical records to treating clinical staff once an emergency case is accepted.</li>
              <li><strong>Authentication & Security:</strong> To issue single-use 6-digit OTPs via SMS (TextBee) and Email (Brevo), maintain revocable JWT sessions, and enforce session timeout limits.</li>
              <li><strong>Security Audit & Anti-Exfiltration:</strong> To track access attempts, prevent unauthorized screenshot captures of health packs, and maintain tamper-evident audit trails.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <span className="text-xs font-black bg-navy text-white px-2 py-0.5 rounded">3</span>
              Third-Party Service Providers & Boundary Controls
            </h2>
            <p className="text-sm">
              CareSetu interfaces with vetted external infrastructure partners under confidentiality and data-processing agreements:
            </p>
            <div className="grid sm:grid-cols-2 gap-3 text-xs mt-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="font-bold text-navy">TextBee SMS Gateway</p>
                <p className="text-slate-500 mt-1">Dispatches transactional 6-digit phone verification OTPs and urgent siren alerts. Payload contains only the code; no clinical data is transmitted.</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="font-bold text-navy">Brevo SMTP Relay</p>
                <p className="text-slate-500 mt-1">Dispatches email verification codes, password resets, and administrative notifications. Subject to strict SPF/DKIM verification.</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="font-bold text-navy">Firebase Cloud Messaging</p>
                <p className="text-slate-500 mt-1">Powers real-time browser push notifications. Devices receive anonymized notification payloads alerting users to active emergencies.</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="font-bold text-navy">Supabase & Cloudflare R2</p>
                <p className="text-slate-500 mt-1">Encrypted relational database (PostgreSQL/PostGIS) and zero-egress encrypted disaster recovery backups.</p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <span className="text-xs font-black bg-navy text-white px-2 py-0.5 rounded">4</span>
              Data Retention, Deletion & User Rights
            </h2>
            <p className="text-sm">
              4.1 <strong>Right to Rectify & Withdraw:</strong> Patients can update personal profiles, edit medical details, and revoke optional consent settings at any time from their patient portal dashboard.
            </p>
            <p className="text-sm">
              4.2 <strong>HealthPack Revocation:</strong> Emergency HealthPack access automatically expires 24 hours after case acceptance or immediately upon case closure.
            </p>
            <p className="text-sm">
              4.3 <strong>Account Deletion:</strong> Users can initiate account deletion under settings. Data is wiped or pseudonymized according to legal retention requirements.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <span className="text-xs font-black bg-navy text-white px-2 py-0.5 rounded">5</span>
              Grievance Officer & Contact Information
            </h2>
            <p className="text-sm">
              In compliance with applicable digital data protection rules, grievances may be directed to our data protection officer:
            </p>
            <p className="text-sm text-slate-600">
              <strong>Email:</strong> <a href="mailto:privacy@caresetu.local" className="text-sky font-medium hover:underline">privacy@caresetu.local</a><br />
              <strong>Operational Scope:</strong> CareSetu Healthcare Systems | Gujarat, India
            </p>
          </section>

          <div className="pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© 2026 CareSetu. All rights reserved.</p>
            <div className="flex gap-4">
              <Link to="/terms" className="text-sky hover:underline">Terms of Use</Link>
              <Link to="/data-declaration" className="text-sky hover:underline">Data Declaration</Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
