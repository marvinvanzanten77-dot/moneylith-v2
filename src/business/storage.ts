import {
  emptyBusiness,
  validateBusiness,
  workspaceKeys,
  type BusinessData,
  type Workspace,
} from "./model";

export type StoragePort = Pick<Storage, "getItem" | "setItem">;
export function saveBusiness(
  storage: StoragePort,
  workspace: Workspace,
  data: BusinessData,
) {
  if (workspace !== "real") throw new Error("Deze administratie is niet beschikbaar.");
  validateBusiness(data);
  if (data.workspace !== workspace)
    throw new Error("Deze gegevens horen bij een andere administratie.");
  storage.setItem(workspaceKeys[workspace], JSON.stringify(data));
}
export function loadBusiness(
  storage: StoragePort,
  workspace: Workspace,
): BusinessData {
  if (workspace !== "real") throw new Error("Deze administratie is niet beschikbaar.");
  const raw = storage.getItem(workspaceKeys.real);
  if (raw !== null) {
    const data: unknown = JSON.parse(raw);
    validateBusiness(data);
    if (data.workspace !== workspace)
      throw new Error(
        "De opgeslagen administratie heeft een onjuist type. Er is niets overschreven.",
      );
    return data;
  }
  const data = emptyBusiness("real");
  saveBusiness(storage, workspace, data);
  return data;
}
export function restoreBusiness(
  storage: StoragePort,
  workspace: Workspace,
  raw: string,
) {
  if (raw.length > 2_000_000)
    throw new Error("De backup is te groot (maximaal 2 MB).");
  const data: unknown = JSON.parse(raw);
  validateBusiness(data);
  if (data.workspace !== workspace)
    throw new Error(
      "Deze backup hoort niet bij de eigen zakelijke administratie.",
    );
  data.reviews = {};
  saveBusiness(storage, workspace, data);
  return data;
}
