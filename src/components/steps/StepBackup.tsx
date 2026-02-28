import { BackupCard } from "../BackupCard";
import { CloudAccountCard } from "../CloudAccountCard";

type StepBackupProps = {
  onboardingMode?: "bank" | "manual" | "cloud" | null;
  storageMode?: "local" | "cloud";
};

export function StepBackup({ onboardingMode = null, storageMode = "local" }: StepBackupProps) {
  return (
    <div className="space-y-6">
      <div className="mb-2 space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">Backup</h1>
        <p className="text-sm text-slate-300">
          Je data staat lokaal in je browser. Maak hier een JSON-backup die je veilig kunt bewaren.
        </p>
      </div>
      <div className="max-w-xl">
        <BackupCard />
      </div>
      {(onboardingMode === "cloud" || storageMode === "cloud") && (
        <div className="max-w-xl">
          <CloudAccountCard />
        </div>
      )}
    </div>
  );
}
