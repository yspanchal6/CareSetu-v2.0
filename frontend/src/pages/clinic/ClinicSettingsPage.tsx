import { useState, FormEvent } from "react";
import { Card } from "../../components/common/Card";
import Button from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { useToast } from "../../components/common/Toast";
import { Lock, ShieldAlert, KeyRound, Bell, AlertCircle, Ban, CheckCircle } from "lucide-react";
import { settingsApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { DeleteAccountSection } from "../../components/common/DeleteAccountSection";

export default function ClinicSettingsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();

  const isGoogleAccount = Boolean((user as any)?.hasPassword === false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showToast("error", "New password and confirmation password do not match.");
      return;
    }

    if (newPassword.length < 8) {
      showToast("error", "New password must be at least 8 characters long.");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await settingsApi.updatePassword(currentPassword, newPassword, confirmPassword);
      if (res && res.success) {
        showToast("success", "Your account credentials have been changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        throw new Error(res?.message || "Failed to update password.");
      }
    } catch (err: any) {
      showToast("error", err?.message || "Invalid current password or update error.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-sky-600" />
          Clinic Security & Account Settings
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage your login authentication and review security configurations.
        </p>
      </div>

      {/* Password Change Section / Google Auth Notice */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 font-bold text-navy">
          <Lock className="w-5 h-5 text-sky-600" />
          Account Authentication & Credentials
        </div>

        {isGoogleAccount ? (
          <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-3">
            <CheckCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Authenticated via Google Identity</p>
              <p className="mt-0.5 text-slate-600">
                This account signs in securely using Google OAuth (<code>{user?.email}</code>). You do not need a local password to access or manage your clinic account.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-text-secondary">
              Ensure your account uses a strong, unique password with at least 8 characters.
            </p>

            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Current Password</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Confirm New Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button type="submit" disabled={passwordLoading} className="mt-2">
                {passwordLoading ? "Updating Password..." : "Update Password"}
              </Button>
            </form>
          </>
        )}
      </Card>

      {/* Unavailable Account Credential Control: Explicitly Badged */}
      <Card className="p-6 space-y-4 border-dashed border-border-medium bg-bg-secondary/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-navy">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            Clinic Account Email & Ownership Modification
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
            <Ban className="w-3.5 h-3.5" />
            Control Unavailable in Self-Service
          </span>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          Self-service changes to clinic login emails, tax registrations, and establishment numbers are disabled
          to safeguard provider identity and healthcare credential integrity.
        </p>

        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Need to update registered clinic credentials?</p>
            <p className="mt-0.5">
              Please submit an official administrative support request along with your state establishment certificate
              to <span className="font-semibold">support@caresetu.in</span>.
            </p>
          </div>
        </div>
      </Card>

      {/* Notification Preferences: Explicitly Badged Status */}
      <Card className="p-6 space-y-4 border-dashed border-border-medium bg-bg-secondary/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-navy">
            <Bell className="w-5 h-5 text-indigo-600" />
            Notification Channels
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
            <Ban className="w-3.5 h-3.5" />
            Managed Administratively
          </span>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          Critical platform notifications and state regulatory notices are delivered directly to your registered clinic
          email address. Custom SMS or webhook dispatch channels are configured exclusively by system administrators.
        </p>
      </Card>

      {/* Account Deletion Section */}
      <DeleteAccountSection />
    </div>
  );
}
