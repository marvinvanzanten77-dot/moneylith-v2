import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { asSession, createProfile, deriveProfileEncryptionKey, listProfiles, touchLastLogin, verifyProfilePassword, type ProfileRecord } from "../services/profileStore";
import { useCurrentUser, getDefaultUserId } from "../state/userContext";

type ProfilePanelProps = {
  open: boolean;
  onClose: () => void;
};

export const ProfilePanel = ({ open, onClose }: ProfilePanelProps) => {
  const { id: currentUserId, profile, setActiveProfile } = useCurrentUser();
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirm, setRegisterConfirm] = useState("");
  const [registerEncrypt, setRegisterEncrypt] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [loginProfileId, setLoginProfileId] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    if (typeof indexedDB === "undefined") {
      setLoadError("Profielen niet beschikbaar: IndexedDB is geblokkeerd in deze browser.");
      setLoading(false);
      return () => undefined;
    }
    listProfiles()
      .then((items) => {
        if (cancelled) return;
        setProfiles(items);
      })
      .catch(() => {
        if (cancelled) return;
        setProfiles([]);
        setLoadError("Profielen laden niet. Ververs de pagina of schakel uit/aan als IndexedDB geblokkeerd is.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => (a.username || "").localeCompare(b.username || ""));
  }, [profiles]);

  const resetForms = () => {
    setRegisterName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterConfirm("");
    setRegisterEncrypt(false);
    setRegisterError(null);
    setLoginPassword("");
    setLoginError(null);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    if (!registerName.trim() || !registerPassword) {
      setRegisterError("Naam en wachtwoord zijn verplicht.");
      return;
    }
    if (registerPassword !== registerConfirm) {
      setRegisterError("Wachtwoorden komen niet overeen.");
      return;
    }
    try {
      const record = await createProfile({
        username: registerName.trim(),
        email: registerEmail.trim() || undefined,
        password: registerPassword,
        encrypt: registerEncrypt,
      });
      setProfiles(await listProfiles());
      const key = record.encryption?.enabled
        ? await deriveProfileEncryptionKey(record, registerPassword)
        : null;
      setActiveProfile(asSession(record), key ?? null);
      resetForms();
      onClose();
    } catch (err: any) {
      setRegisterError(err?.message || "Registreren mislukt.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const profileToUse =
      sortedProfiles.find((p) => p.profileId === loginProfileId) ??
      sortedProfiles.find((p) => p.username === loginProfileId);
    if (!profileToUse) {
      setLoginError("Kies een profiel.");
      return;
    }
    const ok = await verifyProfilePassword(profileToUse, loginPassword);
    if (!ok) {
      setLoginError("Onjuist wachtwoord.");
      return;
    }
    const key = profileToUse.encryption?.enabled
      ? await deriveProfileEncryptionKey(profileToUse, loginPassword)
      : null;
    await touchLastLogin(profileToUse.profileId);
    setActiveProfile(asSession(profileToUse), key ?? null);
    resetForms();
    onClose();
  };

  const handleLogout = () => {
    setActiveProfile(null);
    resetForms();
    onClose();
  };

  if (!open) return null;

  const isDefault = currentUserId === getDefaultUserId();

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur">
      <div className="card-shell w-full max-w-3xl p-6 text-slate-900">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Profielen</h3>
            <p className="text-sm text-slate-600">
              Lokale profielen, geen cloud. Wissel tussen data-silo&apos;s zonder je huidige data te migreren.
            </p>
            <p className="text-xs text-slate-500">
              Huidig: {isDefault ? "local-default" : profile?.username || currentUserId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
          >
            Sluiten
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <form className="space-y-2 rounded-xl border border-slate-200 bg-white/80 p-4" onSubmit={handleLogin}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">Inloggen / wisselen</h4>
              <span className="text-[11px] text-slate-500">{sortedProfiles.length} profielen</span>
            </div>
            {loading && <p className="text-[11px] text-slate-500">Profielen laden…</p>}
            {loadError && <p className="text-[11px] text-red-600">{loadError}</p>}
            <label className="text-xs text-slate-700">
              Profiel
              <select
                value={loginProfileId}
                onChange={(e) => setLoginProfileId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">-- kies een profiel --</option>
                {sortedProfiles.map((p) => (
                  <option key={p.profileId} value={p.profileId}>
                    {p.username} {p.encryption?.enabled ? " (versleuteld)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-700">
              Wachtwoord
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
            {loginError && <p className="text-[11px] text-red-600">{loginError}</p>}
            <button
              type="submit"
              className="mt-1 w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-400"
            >
              Inloggen
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Uitloggen (terug naar local-default)
            </button>
            <p className="text-[11px] text-slate-500">
              Bij uitloggen blijft je data staan; je keert terug naar het standaardprofiel zonder wachtwoord.
              Gebruik de Backup/export-tab om je data als JSON te bewaren of later te herstellen.
            </p>
          </form>

          <form className="space-y-2 rounded-xl border border-slate-200 bg-white/80 p-4" onSubmit={handleRegister}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">Nieuw profiel</h4>
              <span className="text-[11px] text-slate-500">Lokale silo</span>
            </div>
            <label className="text-xs text-slate-700">
              Naam/alias
              <input
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="bijv. Persoonlijk of Zakelijk B.V."
              />
            </label>
            <label className="text-xs text-slate-700">
              E-mail (optioneel)
              <input
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="alleen lokaal"
              />
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
              <label>
                Wachtwoord
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label>
                Herhaal
                <input
                  type="password"
                  value={registerConfirm}
                  onChange={(e) => setRegisterConfirm(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={registerEncrypt}
                onChange={(e) => setRegisterEncrypt(e.target.checked)}
              />{" "}
              Versleutel data voor dit profiel (AES-GCM, wachtwoordafgeleid)
            </label>
            {registerError && <p className="text-[11px] text-red-600">{registerError}</p>}
            <button
              type="submit"
              className="mt-1 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              Profiel aanmaken
            </button>
            <p className="text-[11px] text-slate-500">
              Data blijft lokaal. Elke user krijgt zijn eigen namespace. Legacy data blijft onder local-default zichtbaar.
            </p>
          </form>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
};
