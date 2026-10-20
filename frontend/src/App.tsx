import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { HospitalSecurityProvider } from "./context/HospitalSecurityContext";
import { I18nProvider } from "./i18n/I18nContext";
import { ToastProvider } from "./components/common/Toast";
import { SocketProvider } from "./context/SocketContext";

import PublicLayout from "./layouts/PublicLayout";
import AuthLayout from "./layouts/AuthLayout";
import PatientLayout from "./layouts/PatientLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import OpaqueRouteResolver from "./routes/OpaqueRouteResolver";
import { hospitalNav, doctorNav, hospitalDoctorNav, independentDoctorNav, clinicNav, adminNav, roleLabels } from "./routes/navConfig";

import LandingPage from "./pages/public/LandingPage";
import HowItWorksPage from "./pages/public/HowItWorksPage";
import { FeaturesPage, AboutPage, ContactPage, HelpPage } from "./pages/public/OtherPublicPages";

import LoginPage from "./pages/auth/LoginPage";
import { RoleSelectionPage, RegisterPage, VerifyOtpPage, ForgotPasswordPage, ResetPasswordPage, DoctorActivationPage, MandatoryPasswordChangePage } from "./pages/auth/AuthFlowPages";
import DocumentVerificationPage from "./pages/auth/DocumentVerificationPage";
import TermsOfUsePage from "./pages/legal/TermsOfUsePage";
import PrivacyPolicyPage from "./pages/legal/PrivacyPolicyPage";
import DataDeclarationPage from "./pages/legal/DataDeclarationPage";

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
import DoctorOnboardingPage from "./pages/doctor/DoctorOnboardingPage";
import { DoctorCasesPage, DoctorCaseDetailPage } from "./pages/doctor/DoctorCasePages";
import {
  DoctorProfilePage,
  DoctorPatientsPage,
  DoctorAppointmentsPage,
  DoctorHealthPackPage,
  DoctorClinicalNotesPage,
  DoctorReportsPage,
  DoctorSettingsPage,
} from "./pages/doctor/DoctorMiscPages";
import DoctorServicesPage from "./pages/doctor/DoctorServicesPage";

import ProviderVerificationStatusPage from "./pages/provider/ProviderVerificationStatusPage";
import ClinicDashboard from "./pages/clinic/ClinicDashboard";
import ClinicProfilePage from "./pages/clinic/ClinicProfilePage";
import ClinicServicesPage from "./pages/clinic/ClinicServicesPage";
import ClinicStaffPage from "./pages/clinic/ClinicStaffPage";
import ClinicSettingsPage from "./pages/clinic/ClinicSettingsPage";

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
  AdminDeletionRequestsPage,
  AdminProviderReviewsPage,
} from "./pages/admin/AdminMiscPages";
import AdminGovHealthDataPage from "./pages/admin/AdminGovHealthDataPage";
import AdminHospitalMatchingPage from "./pages/admin/AdminHospitalMatchingPage";
import { AdminSecurityViolationsPage } from "./pages/admin/AdminSecurityViolationsPage";
import { AdminHospitalAppealsPage } from "./pages/admin/AdminHospitalAppealsPage";

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <HospitalSecurityProvider>
            <ToastProvider>
              <SocketProvider>
                <BrowserRouter basename={import.meta.env.BASE_URL}>
                <Routes>
                  {/* Public site */}
                  <Route path="/app/:opaqueId" element={<OpaqueRouteResolver />} />
                  <Route element={<PublicLayout />}>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/how-it-works" element={<HowItWorksPage />} />
                    <Route path="/features" element={<FeaturesPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/help" element={<HelpPage />} />
                    <Route path="/terms" element={<TermsOfUsePage />} />
                    <Route path="/privacy" element={<PrivacyPolicyPage />} />
                    <Route path="/data-declaration" element={<DataDeclarationPage />} />
                  </Route>

                  {/* Auth */}
                  <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/role-selection" element={<RoleSelectionPage />} />
                    <Route path="/verify-otp" element={<VerifyOtpPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/activate-doctor" element={<DoctorActivationPage />} />
                    <Route path="/activate-doctor/change-password" element={<MandatoryPasswordChangePage />} />
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

                  {/* Doctor (General / Fallback) */}
                  <Route
                    path="/doctor"
                    element={
                      <ProtectedRoute role="doctor">
                        <DashboardLayout items={doctorNav} roleLabel={roleLabels.doctor} />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<DoctorDashboard />} />
                    <Route path="onboarding" element={<DoctorOnboardingPage />} />
                    <Route path="unaffiliated" element={<Navigate to="/doctor/onboarding" replace />} />
                    <Route path="document-verification" element={<DocumentVerificationPage />} />
                    <Route path="profile" element={<DoctorProfilePage />} />
                    <Route path="cases" element={<DoctorCasesPage />} />
                    <Route path="cases/:id" element={<DoctorCaseDetailPage />} />
                    <Route path="patients" element={<DoctorPatientsPage />} />
                    <Route path="health-pack" element={<DoctorHealthPackPage />} />
                    <Route path="clinical-notes" element={<DoctorClinicalNotesPage />} />
                    <Route path="reports" element={<DoctorReportsPage />} />
                    <Route path="settings" element={<DoctorSettingsPage />} />
                  </Route>

                  {/* Portal A: Hospital-Linked Doctor Portal */}
                  <Route
                    path="/doctor/hospital"
                    element={
                      <ProtectedRoute role="doctor">
                        <DashboardLayout items={hospitalDoctorNav} roleLabel="Hospital Doctor Portal" />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<DoctorDashboard />} />
                    <Route path="cases" element={<DoctorCasesPage />} />
                    <Route path="cases/:id" element={<DoctorCaseDetailPage />} />
                    <Route path="health-pack" element={<DoctorHealthPackPage />} />
                    <Route path="profile" element={<DoctorProfilePage />} />
                    <Route path="settings" element={<DoctorSettingsPage />} />
                  </Route>

                  {/* Portal B: Independent Doctor Portal */}
                  <Route
                    path="/doctor/independent"
                    element={
                      <ProtectedRoute role="doctor">
                        <DashboardLayout items={independentDoctorNav} roleLabel="Independent Doctor Portal" />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="verification-status" replace />} />
                    <Route path="dashboard" element={<DoctorDashboard />} />
                    <Route path="profile" element={<DoctorProfilePage />} />
                    <Route path="services" element={<DoctorServicesPage />} />
                    <Route path="appointments" element={<DoctorAppointmentsPage />} />
                    <Route path="patients" element={<DoctorPatientsPage />} />
                    <Route path="health-pack" element={<DoctorHealthPackPage />} />
                    <Route path="verification-status" element={<ProviderVerificationStatusPage type="doctor" />} />
                    <Route path="settings" element={<DoctorSettingsPage />} />
                  </Route>

                  {/* Portal C: Independent Clinic Portal */}
                  <Route
                    path="/clinic"
                    element={
                      <ProtectedRoute role="clinic">
                        <DashboardLayout items={clinicNav} roleLabel={roleLabels.clinic} />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="dashboard" element={<ClinicDashboard />} />
                    <Route path="profile" element={<ClinicProfilePage />} />
                    <Route path="services" element={<ClinicServicesPage />} />
                    <Route path="staff" element={<ClinicStaffPage />} />
                    <Route path="verification-status" element={<ProviderVerificationStatusPage type="clinic" />} />
                    <Route path="settings" element={<ClinicSettingsPage />} />
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
                    <Route path="provider-reviews" element={<AdminProviderReviewsPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="hospitals" element={<AdminHospitalsPage />} />
                    <Route path="emergencies" element={<AdminEmergenciesPage />} />
                    <Route path="emergency-cases" element={<AdminEmergenciesPage />} />
                    <Route path="deletions" element={<AdminDeletionRequestsPage />} />
                    <Route path="deletion-requests" element={<Navigate to="/admin/deletions" replace />} />
                    <Route path="hospital-registry" element={<AdminHospitalRegistryPage />} />
                    <Route path="government-data" element={<AdminGovHealthDataPage />} />
                    <Route path="hospital-matching" element={<AdminHospitalMatchingPage />} />
                    <Route path="analytics" element={<AdminAnalyticsPage />} />
                    <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                    <Route path="security-reviews" element={<AdminSecurityViolationsPage />} />
                    <Route path="security-violations" element={<AdminSecurityViolationsPage />} />
                    <Route path="appeals" element={<AdminHospitalAppealsPage />} />
                    <Route path="hospital-appeals" element={<AdminHospitalAppealsPage />} />
                    <Route path="roles" element={<AdminRolesPage />} />
                    <Route path="settings" element={<AdminSettingsPage />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </SocketProvider>
          </ToastProvider>
        </HospitalSecurityProvider>
      </AuthProvider>
    </I18nProvider>
  </ThemeProvider>
  );
}
