import React, { useEffect, useState } from "react";
import { Lock, ShieldCheck, EnvelopeSimple as Mail, WarningCircle as AlertCircle, CheckCircle, Trash as Trash2, QrCode, Eye, EyeSlash, Copy } from "@phosphor-icons/react";
import { supabase } from "../lib/supabaseClient";
import { api, ApiError } from "../lib/api";

interface SettingsPageProps {
  userEmail: string | null;
  onAccountDeleted: () => void;
}

/**
 * The signed-in user's own account settings - password, MFA, email
 * preferences, and account deletion. Separate from Business Identity
 * (handled elsewhere) and from the admin portal (a different surface
 * entirely, for managing the product, not one's own account).
 */
export default function SettingsPage({ userEmail, onAccountDeleted }: SettingsPageProps) {
  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  // MFA
  const [factors, setFactors] = useState<Array<{ id: string; status: string; friendly_name?: string }>>([]);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [isMfaBusy, setIsMfaBusy] = useState(false);

  // Email preferences
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  // Delete account
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadFactors = () => {
    setMfaLoading(true);
    api.auth
      .mfaFactors()
      .then((res) => setFactors(res.factors?.totp ?? []))
      .catch(() => setFactors([]))
      .finally(() => setMfaLoading(false));
  };

  useEffect(() => {
    loadFactors();
    api.profile
      .get()
      .then((data) => setMarketingEmails(data.marketingEmailsEnabled))
      .catch(() => {})
      .finally(() => setPrefsLoading(false));
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords don't match." });
      return;
    }
    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMsg({ type: "success", text: "Password updated." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMsg({ type: "error", text: err instanceof Error ? err.message : "Couldn't update your password." });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleStartEnroll = async () => {
    setMfaError(null);
    setIsMfaBusy(true);
    try {
      const res = await api.auth.mfaEnroll();
      setEnrolling({ factorId: res.factorId, qrCode: res.qrCode, secret: res.secret });
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "Couldn't start MFA enrollment.");
    } finally {
      setIsMfaBusy(false);
    }
  };

  const handleConfirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrolling) return;
    setMfaError(null);
    setIsMfaBusy(true);
    try {
      const challenge = await api.auth.mfaChallenge(enrolling.factorId);
      await api.auth.mfaVerify(enrolling.factorId, challenge.challengeId, mfaCode);
      setEnrolling(null);
      setMfaCode("");
      loadFactors();
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "That code didn't work. Check your authenticator app and try again.");
    } finally {
      setIsMfaBusy(false);
    }
  };

  const handleUnenroll = async (factorId: string) => {
    setIsMfaBusy(true);
    try {
      await api.auth.mfaUnenroll(factorId);
      loadFactors();
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "Couldn't remove that authenticator.");
    } finally {
      setIsMfaBusy(false);
    }
  };

  const handleSavePrefs = async () => {
    setIsSavingPrefs(true);
    setPrefsSaved(false);
    try {
      await api.profile.update({ marketingEmailsEnabled: marketingEmails });
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2000);
    } catch {
      // Best-effort - the checkbox just keeps its unsaved state.
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await api.auth.deleteAccount();
      onAccountDeleted();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Couldn't delete your account right now. Please try again.");
      setIsDeleting(false);
    }
  };

  const activeFactor = factors.find((f) => f.status === "verified");

  return (
    <div className="space-y-8 text-left animate-fade-in">
      <div>
        <h2 className="text-lg font-black text-slate-900">Settings</h2>
        <p className="text-xs text-slate-400 mt-1">Manage your account security and preferences.</p>
      </div>

      {/* Security */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-5">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-600" /> Security
        </h3>

        <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
          <p className="text-xs font-bold text-slate-700">Change password</p>
          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-9 outline-none text-xs focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((v) => !v)}
              aria-label={showNewPassword ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showNewPassword ? <EyeSlash className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-9 outline-none text-xs focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showConfirmPassword ? <EyeSlash className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          {passwordMsg && (
            <p className={`text-[11px] flex items-center gap-1 ${passwordMsg.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>
              {passwordMsg.type === "error" ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
              {passwordMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={isSavingPassword}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50"
          >
            {isSavingPassword ? "Updating..." : "Update password"}
          </button>
        </form>

        <div className="border-t border-slate-100 pt-5 space-y-3 max-w-sm">
          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Two-Factor Authentication
          </p>
          {mfaLoading ? (
            <p className="text-[11px] text-slate-400">Loading...</p>
          ) : activeFactor ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
              <span className="text-[11px] font-bold text-emerald-700">Enabled ({activeFactor.friendly_name || "Authenticator app"})</span>
              <button
                type="button"
                onClick={() => handleUnenroll(activeFactor.id)}
                disabled={isMfaBusy}
                className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer disabled:opacity-50"
              >
                Disable
              </button>
            </div>
          ) : enrolling ? (
            <form onSubmit={handleConfirmEnroll} className="space-y-2.5">
              <p className="text-[11px] text-slate-500">Scan this QR code with your authenticator app, then enter the 6-digit code it shows.</p>
              <img src={enrolling.qrCode} alt="MFA QR code" className="w-32 h-32 border border-slate-200 rounded-xl" />
              <div className="flex items-center gap-1.5">
                <p className="text-[9px] font-mono text-slate-400 break-all">Or enter manually: {enrolling.secret}</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(enrolling.secret).then(() => {
                      setSecretCopied(true);
                      setTimeout(() => setSecretCopied(false), 1500);
                    });
                  }}
                  aria-label="Copy secret key"
                  className="shrink-0 text-slate-400 hover:text-emerald-600 cursor-pointer"
                >
                  {secretCopied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs text-center font-mono focus:border-emerald-500"
              />
              {mfaError && <p className="text-[11px] text-rose-600">{mfaError}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isMfaBusy}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3.5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Confirm
                </button>
                <button type="button" onClick={() => setEnrolling(null)} className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={handleStartEnroll}
              disabled={isMfaBusy}
              className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:border-emerald-300 text-slate-700 text-[11px] font-bold px-3.5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
            >
              <QrCode className="w-3.5 h-3.5" /> Enable with an authenticator app
            </button>
          )}
          {mfaError && !enrolling && <p className="text-[11px] text-rose-600">{mfaError}</p>}
        </div>
      </section>

      {/* Email Preferences */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Mail className="w-4 h-4 text-emerald-600" /> Email Preferences
        </h3>
        {prefsLoading ? (
          <p className="text-[11px] text-slate-400">Loading...</p>
        ) : (
          <>
            <label className="flex items-start gap-2.5 cursor-pointer max-w-md">
              <input
                type="checkbox"
                checked={marketingEmails}
                onChange={(e) => setMarketingEmails(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600 cursor-pointer"
              />
              <span className="text-xs text-slate-700">
                <span className="font-bold block">Promotional emails</span>
                Receive product updates, tips, and occasional announcements.
              </span>
            </label>
            <p className="text-[11px] text-slate-400">Order, payment, and account notifications are always sent and can't be turned off.</p>
            <button
              type="button"
              onClick={handleSavePrefs}
              disabled={isSavingPrefs}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {isSavingPrefs ? "Saving..." : prefsSaved ? "Saved" : "Save preferences"}
            </button>
          </>
        )}
      </section>

      {/* Danger Zone */}
      <section className="bg-white border border-rose-200 rounded-3xl p-5 sm:p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Danger Zone
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-rose-150 rounded-2xl p-4">
          <div>
            <p className="text-xs font-bold text-slate-900">Delete account</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Permanently deletes your account and all associated data ({userEmail}). This can't be undone.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              placeholder='Type "DELETE"'
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none text-[11px] focus:border-rose-400 w-28"
            />
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "DELETE" || isDeleting}
              className="flex items-center gap-1 bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 text-[11px] font-bold px-3 py-2 rounded-xl cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" /> {isDeleting ? "Deleting..." : "Delete Account"}
            </button>
          </div>
        </div>
        {deleteError && <p className="text-[11px] text-rose-600">{deleteError}</p>}
      </section>
    </div>
  );
}
