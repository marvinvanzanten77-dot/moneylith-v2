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
          Deze backup bevat de administratie die nu in je browser is geladen. Bewaar het JSON-bestand veilig. Bij ingeschakelde cloudopslag wordt dezelfde administratie ook met je ingelogde account gesynchroniseerd; controleer de laatste opslagstatus bij Instellingen.
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
