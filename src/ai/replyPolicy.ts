/** Narrow output guard for unsupported claims observed in production. This is not
 * a general fact checker: validated source data and the system rules remain required. */
export type BusinessReplyPolicy = {
  canAssessFinancialSituation: boolean;
  actualRevenueUnknown: boolean;
};
export function businessReplyIssue(
  content: string,
  policy?: BusinessReplyPolicy,
): string | null {
  if (!policy) return null;
  if (
    !policy.canAssessFinancialSituation &&
    /\b(?:onhoudba(?:ar|re)|kwetsba(?:ar|re)|failliet|insolvent|(?:hoog|hoge)\s+(?:financieel\s+)?risico|financieel\s+(?:gezond|ongezond)|stabiel(?:e)?\s+(?:situatie|kasstroom)|liquiditeitsproble(?:em|men)|cashflowproble(?:em|men))\b/iu.test(
      content,
    )
  ) {
    return "Onvoldoende gecontroleerde invoer voor een financieel situatieoordeel. Gebruik geen termen zoals onhoudbaar, kwetsbaar, stabiel of financieel gezond. Beschrijf uitsluitend bekende invoer, ontbrekende gegevens en een concrete invul- of controlestap. Ontbrekende invoer zegt niets over de financiële gezondheid van het bedrijf.";
  }
  if (
    policy.actualRevenueUnknown &&
    /\b(?:je hebt\s+(?:nul|geen|€\s*0(?:[,.]00)?)\s+(?:gerealiseerde\s+)?omzet|(?:je|jouw|de|gerealiseerde|huidige)\s+(?:gerealiseerde\s+)?omzet\s+(?:is|bedraagt|staat op)\s+(?:nul|€\s*0(?:[,.]00)?))\b/iu.test(
      content,
    )
  ) {
    return "Gerealiseerde omzet is onbekend. Een nul bij verwachte nieuwe omzet is uitsluitend een planbedrag. Benoem het als verwachte nieuwe omzet en zeg expliciet dat gerealiseerde omzet nog onbekend is.";
  }
  return null;
}
