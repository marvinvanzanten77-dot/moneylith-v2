export type PotCategorieOption = {
  key: string;
  label: string;
  description?: string;
};

export const POT_CATEGORIE_OPTIONS: PotCategorieOption[] = [
  { key: "food_snacks", label: "Eten & snacks", description: "Boodschappen, snacks, koffie, etc." },
  { key: "smoke_vape", label: "Roken / vapen", description: "Sigaretten, vapes, tabak." },
  { key: "games_apps", label: "Games & apps", description: "Google Play, in-app aankopen, etc." },
  { key: "digital_tools", label: "Digitale tools", description: "AI-tools, software-abonnementen." },
  { key: "impulse", label: "Impulsaankopen", description: "Action, random aankopen, prullaria." },
  { key: "transport", label: "Vervoer & tanken", description: "Brandstof, OV, taxi, etc." },
  { key: "other", label: "Overig / eigen thema", description: "Custom categorie." },
];

export const getPotCategorieLabel = (key: string | undefined) => {
  const found = POT_CATEGORIE_OPTIONS.find((option) => option.key === key);
  return found?.label ?? "Nog geen categorie";
};
