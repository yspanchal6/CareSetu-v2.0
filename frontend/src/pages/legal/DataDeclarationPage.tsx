import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Database,
  Lock,
  Clock,
  UserCheck,
  FileCheck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Server,
  Share2,
  Trash2
} from 'lucide-react';

export const DataDeclarationPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Breadcrumb & Notice */}
        <div>
          <nav className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
            <Link to="/" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-900 dark:text-slate-100 font-medium">Data Declaration</span>
          </nav>

          <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight sm:text-4xl">
                Data Declaration & Processing Matrix
              </h1>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                Draft v2026.1 &bull; Under Legal Review
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Effective Date: October 2026 &bull; Published by CareSetu Engineering &amp; Compliance Team
            </p>
          </div>
        </div>

        {/* Regulatory & Review Notice */}
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 rounded-r-lg space-y-2">
          <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200 font-semibold text-sm">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <span>DPDP Act (India) Alignment Notice</span>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            This Data Declaration details the taxonomy of data collected, technical processing boundaries, storage architecture, retention schedules, and downstream sharing protocols implemented in the CareSetu platform. All health data is processed as Sensitive Personal Data under the Digital Personal Data Protection (DPDP) Act 2023 and the Information Technology Rules.
          </p>
        </div>

        {/* Section 1: Data Classification Matrix */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Database className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-bold">1. Data Taxonomy &amp; Classification Matrix</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th scope="col" className="px-3 py-3 text-left font-semibold text-slate-900 dark:text-slate-100">Category</th>
                  <th scope="col" className="px-3 py-3 text-left font-semibold text-slate-900 dark:text-slate-100">Fields / Identifiers</th>
                  <th scope="col" className="px-3 py-3 text-left font-semibold text-slate-900 dark:text-slate-100">Storage / Encryption</th>
                  <th scope="col" className="px-3 py-3 text-left font-semibold text-slate-900 dark:text-slate-100">Legal Basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs">Public</span>
                  </td>
                  <td className="px-3 py-3">Hospital name, address, verified coordinates, emergency department phone, bed capacities, operational status.</td>
                  <td className="px-3 py-3">PostgreSQL, public read-access cached via backend API.</td>
                  <td className="px-3 py-3">Public directory service, hospital administrative consent.</td>
                </tr>
                <tr>
                  <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs">Identity &amp; Auth</span>
                  </td>
                  <td className="px-3 py-3">Full name, mobile number, email address, salted &amp; hashed password (Argon2/bcrypt), role, registration timestamp.</td>
                  <td className="px-3 py-3">PostgreSQL User table. Passwords salted &amp; one-way hashed. TLS 1.3 in transit.</td>
                  <td className="px-3 py-3">Contract performance, User registration consent.</td>
                </tr>
                <tr>
                  <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 text-xs">Telemetry / Location</span>
                  </td>
                  <td className="px-3 py-3">GPS latitude/longitude, accuracy radius, timestamp of SOS trigger.</td>
                  <td className="px-3 py-3">Transiently stored with Emergency SOS record. Not tracked continuously in background.</td>
                  <td className="px-3 py-3">Explicit emergency consent triggered by user pressing SOS.</td>
                </tr>
                <tr>
                  <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 text-xs">Sensitive Health (SPHI)</span>
                  </td>
                  <td className="px-3 py-3">Blood group, known chronic conditions, active medications, allergies, uploaded emergency medical summaries (HealthPack).</td>
                  <td className="px-3 py-3">Encrypted at rest using AES-256-CBC with user/server key derivation. Stored in Cloudflare R2 / PostgreSQL.</td>
                  <td className="px-3 py-3">Explicit HealthPack consent grant; time-bounded emergency disclosure.</td>
                </tr>
                <tr>
                  <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 text-xs">Audit &amp; Telemetry</span>
                  </td>
                  <td className="px-3 py-3">AuditLog records: action enum, timestamp, affected resource ID, user ID, policy version. (IP and raw device fingerprints are minimized).</td>
                  <td className="px-3 py-3">Append-only audit table in PostgreSQL.</td>
                  <td className="px-3 py-3">Compliance with legal security mandates and incident investigation.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Storage & Cryptographic Standards */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Lock className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-bold">2. Cryptographic Architecture &amp; Storage Boundaries</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-600 dark:text-slate-400">
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Server className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <span>Primary Relational Database</span>
              </h3>
              <p>
                Managed PostgreSQL instance (Neon / Supabase) located in cloud regions enforcing Indian data localization norms. All disks are encrypted at rest with AES-256. Connections strictly require TLS 1.3 with certificate validation.
              </p>
            </div>

            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>HealthPack Encryption Envelope</span>
              </h3>
              <p>
                HealthPack files uploaded by patients undergo envelope encryption using AES-256-CBC prior to persistence in object storage (Cloudflare R2 / S3-compatible). Decryption keys are ephemeral and strictly bound to authorized active consultations or emergency dispatches.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Third-Party Service Providers */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Share2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-bold">3. Sub-Processors &amp; Relay Services</h2>
          </div>

          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
            <p>
              CareSetu engages specialized infrastructure providers for transactional delivery. Health data is never transmitted to marketing or analytics intermediaries:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-slate-900 dark:text-slate-200">SMS Relay (TextBee / Gateway):</strong> Used exclusively for transmitting one-time verification passcodes (OTP). Transmits only mobile number and generated numeric OTP.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-slate-200">Transactional Email (Brevo / Sendinblue):</strong> Delivers email OTPs, case assignment updates, and security alerts. Receives recipient email address, name, and templated system notifications.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-slate-200">Push Notifications (Firebase Cloud Messaging - FCM):</strong> Dispatches real-time SOS alerts and doctor assignment pings. Receives device push tokens without patient health record attachments.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-slate-200">Blob Storage (Cloudflare R2):</strong> Stores encrypted HealthPack archives, doctor registration credentials (medical degrees, NMC registrations), and hospital audit documentation.
              </li>
            </ul>
          </div>
        </div>

        {/* Section 4: Retention Schedule */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Clock className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-bold">4. Data Retention &amp; Disposal Schedule</h2>
          </div>

          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">OTP Codes</span>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">10 Minutes</p>
                <p className="text-xs text-slate-500 mt-1">Automatically invalidated and purged following expiry or verification.</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Emergency Dispatch SOS</span>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">180 Days Active</p>
                <p className="text-xs text-slate-500 mt-1">Archived for clinical audit, handoff verification, and emergency service dispute resolution.</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Clinical Case Logs</span>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">3 Years (Statutory)</p>
                <p className="text-xs text-slate-500 mt-1">Retained per National Medical Commission (NMC) guidelines for electronic medical records.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: User Rights & Revocation */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Trash2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-bold">5. Consent Revocation &amp; Right to Erasure</h2>
          </div>

          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            <p>
              Patients maintain continuous control over their health data through dedicated privacy toggles in their account portal:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-slate-900 dark:text-slate-200">HealthPack Sharing Revocation:</strong> You may toggle off HealthPack sharing at any time. Revocation takes immediate effect; doctors and hospitals lose read permissions for future sessions.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-slate-200">Account Erasure:</strong> To request full account erasure, contact the Data Protection Officer at <a href="mailto:privacy@caresetu.in" className="text-primary-600 dark:text-primary-400 underline">privacy@caresetu.in</a>. Personal identifiers will be permanently scrubbed within 30 days, subject to NMC-mandated retention for completed clinical interactions.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex space-x-4">
            <Link to="/terms" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Terms of Use</Link>
            <span>&bull;</span>
            <Link to="/privacy" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Privacy Policy</Link>
          </div>
          <Link to="/" className="text-primary-600 dark:text-primary-400 hover:underline">
            Return to Homepage &rarr;
          </Link>
        </div>

      </div>
    </div>
  );
};

export default DataDeclarationPage;
