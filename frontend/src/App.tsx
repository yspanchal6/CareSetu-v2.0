import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./components/common/Toast";
import { SocketProvider } from "./context/SocketContext";

import PublicLayout from "./layouts/PublicLayout";
import AuthLayout from "./layouts/AuthLayout";
import PatientLayout from "./layouts/PatientLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import { hospitalNav, doctorNav, adminNav, roleLabels } from "./routes/navConfig";

import LandingPage from "./pages/public/LandingPage";
import HowItWorksPage from "./pages/public/HowItWorksPage";
import { FeaturesPage, AboutPage, ContactPage, HelpPage } from "./pages/public/OtherPublicPages";

import LoginPage from "./pages/auth/LoginPage";
import { RoleSelectionPage, RegisterPage, VerifyOtpPage, ForgotPasswordPage, ResetPasswordPage } from "./pages/auth/AuthFlowPages";
import DocumentVerificationPage from "./pages/auth/DocumentVerificationPage";

import PatientDashboard from "./pages/patient/PatientDashboard";
import PatientProfileCompletionPage from "./pages/patient/PatientProfileCompletionPage";
import EmergencySOSPage from "./pages/patient/EmergencySOSPage";
import EmergencyStatusPage from "./pages/patient/EmergencyStatusPage";
import PatientHospitalsPage from "./pages/patient/PatientHospitalsPage";
import HospitalDetailPage from "./pages/patient/HospitalDetailPage";
import { PatientCasesPage, PatientCaseDetailPage } from "./pages/patient/PatientCasesPages";
import HealthPackPage from "./pages/patient/HealthPackPage";
import DoctorAIPage from "./pages/patient/DoctorAIPage";
import UploadDocumentsPage from "./pages/patient/UploadDocumentsPage";
import BookSessionsPage from "./pages/patient/BookSessionsPage";
import {
  PatientProfilePage,
  MedicalInformationPage,
  PatientNotificationsPage,
  PatientOfflinePage,
  PatientSettingsPage,
} from "./pages/patient/PatientMiscPages";

import HospitalDashboard from "./pages/hospital/HospitalDashboard";
import HospitalProfileVerificationPage from "./pages/hospital/HospitalProfileVerificationPage";
import { HospitalEmergenciesPage, HospitalEmergencyDetailPage, HospitalActiveCasesPage } from "./pages/hospital/HospitalEmergencyPages";
import {
  HospitalMatchingRequestsPage,
  HospitalPatientsPage,
  HospitalCapacityPage,
  HospitalReportsPage,
  HospitalStaffPage,
  HospitalProfilePage,
  HospitalNotificationsPage,
  HospitalSettingsPage,
} from "./pages/hospital/HospitalMiscPages";

import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import { DoctorCasesPage, DoctorCaseDetailPage } from "./pages/doctor/DoctorCasePages";
import {
  DoctorPatientsPage,
  DoctorHealthPackPage,
  DoctorClinicalNotesPage,
  DoctorReportsPage,
  DoctorSettingsPage,
} from "./pages/doctor/DoctorMiscPages";

import AdminDashboard from "./pages/admin/AdminDashboard";
import {
  AdminUsersPage,
  AdminHospitalsPage,
  AdminEmergenciesPage,
  AdminHospitalRegistryPage,
  AdminAnalyticsPage,
  AdminAuditLogsPage,
  AdminRolesPage,
  AdminSettingsPage,
} from "./pages/admin/AdminMiscPages";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SocketProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            {/* Public site */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/help" element={<HelpPage />} />
            </Route>

            {/* Auth */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/role-selection" element={<RoleSelectionPage />} />
              <Route path="/verify-otp" element={<VerifyOtpPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-documents" element={<DocumentVerificationPage />} />
            </Route>

            {/* Patient */}
            <Route
              path="/patient"
              element={
                <ProtectedRoute role="patient">
                  <PatientLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<PatientDashboard />} />
              <Route path="profile-completion" element={<PatientProfileCompletionPage />} />
              <Route path="profile" element={<PatientProfilePage />} />
              <Route path="medical-information" element={<MedicalInformationPage />} />
              <Route path="health-pack" element={<HealthPackPage />} />
              <Route path="doctor-ai" element={<DoctorAIPage />} />
              <Route path="upload-documents" element={<UploadDocumentsPage />} />
              <Route path="book-sessions" element={<BookSessionsPage />} />
              <Route path="emergency" element={<EmergencySOSPage />} />
              <Route path="emergency/status" element={<EmergencyStatusPage />} />
              <Route path="emergency/status/:caseId" element={<EmergencyStatusPage />} />
              <Route path="hospitals" element={<PatientHospitalsPage />} />
              <Route path="hospitals/:id" element={<HospitalDetailPage />} />
              <Route path="cases" element={<PatientCasesPage />} />
              <Route path="cases/:id" element={<PatientCaseDetailPage />} />
              <Route path="notifications" element={<PatientNotificationsPage />} />
              <Route path="offline" element={<PatientOfflinePage />} />
              <Route path="settings" element={<PatientSettingsPage />} />
            </Route>

            {/* Hospital */}
            <Route
              path="/hospital"
              element={
                <ProtectedRoute role="hospital">
                  <DashboardLayout items={hospitalNav} roleLabel={roleLabels.hospital} />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<HospitalDashboard />} />
              <Route path="profile-verification" element={<HospitalProfileVerificationPage />} />
              <Route path="emergencies" element={<HospitalEmergenciesPage />} />
              <Route path="emergencies/active" element={<HospitalActiveCasesPage />} />
              <Route path="emergencies/:id" element={<HospitalEmergencyDetailPage />} />
              <Route path="matching-requests" element={<HospitalMatchingRequestsPage />} />
              <Route path="patients" element={<HospitalPatientsPage />} />
              <Route path="capacity" element={<HospitalCapacityPage />} />
              <Route path="reports" element={<HospitalReportsPage />} />
              <Route path="staff" element={<HospitalStaffPage />} />
              <Route path="notifications" element={<HospitalNotificationsPage />} />
              <Route path="profile" element={<HospitalProfilePage />} />
              <Route path="settings" element={<HospitalSettingsPage />} />
            </Route>

            {/* Doctor */}
            <Route
              path="/doctor"
              element={
                <ProtectedRoute role="doctor">
                  <DashboardLayout items={doctorNav} roleLabel={roleLabels.doctor} />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<DoctorDashboard />} />
              <Route path="document-verification" element={<DocumentVerificationPage />} />
              <Route path="cases" element={<DoctorCasesPage />} />
              <Route path="cases/:id" element={<DoctorCaseDetailPage />} />
              <Route path="patients" element={<DoctorPatientsPage />} />
              <Route path="health-pack" element={<DoctorHealthPackPage />} />
              <Route path="clinical-notes" element={<DoctorClinicalNotesPage />} />
              <Route path="reports" element={<DoctorReportsPage />} />
              <Route path="settings" element={<DoctorSettingsPage />} />
            </Route>

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <DashboardLayout items={adminNav} roleLabel={roleLabels.admin} />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="hospitals" element={<AdminHospitalsPage />} />
              <Route path="emergencies" element={<AdminEmergenciesPage />} />
              <Route path="hospital-registry" element={<AdminHospitalRegistryPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="audit-logs" element={<AdminAuditLogsPage />} />
              <Route path="roles" element={<AdminRolesPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </SocketProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
