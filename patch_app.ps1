import re
path = 'src/App.tsx'
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()
pattern = r"// TAB INTENTIE DATA-BINDING:[\s\S]*?// TAB RITME DATA-BINDING:"
if not re.search(pattern, text):
    raise SystemExit('pattern not found')
replacement = """// TAB INTENTIE DATA-BINDING:
  // Ontvangt: userIntent (useLocalStorage)
  // Schrijft: setUserIntent (persist), geen lokale state
  // Gebruikt totals: geen
  const renderIntent = (variant: \"personal\" | \"business\" = \"personal\") => (
    <div className=\"space-y-4\">
      <StepIntent value={userIntent} onChange={setUserIntent} variant={variant} />
    </div>
  );

  // TAB FUNDAMENT DATA-BINDING:
  // Ontvangt: netIncome, manualFixedCosts (useLocalStorage), fixedCosts (afgeleid in App), IncomeList/FixedCostsList sommen
  // Schrijft: setNetIncome, setManualFixedCosts (persist)
  // Gebruikt totals: netFree (quickSummary.free), fixedCosts
  const renderFundament = (variant: \"personal\" | \"business\" = \"personal\") => {
    const isBusinessVariant = variant === \"business\";
    const pageTitle = isBusinessVariant ? \"Verdienmodel\" : \"Fundament\";
    const pageIntro = isBusinessVariant
      ? \"Hoe stroomt geld je bedrijf binnen en welke vaste kosten horen bij dit model?\"
      : \"Hier leg je je basis vast: wat komt er elke maand binnen en wat gaat er zeker uit.\";
    const incomeHeading = isBusinessVariant ? \"Inkomstenstromen\" : \"Inkomensstromen\";
    const incomeSubheading = isBusinessVariant ? \"Overzicht van je inkomstenstromen\" : \"Overzicht van je inkomen\";
    const incomeHelp = isBusinessVariant ? \"Bijvoorbeeld: uren, projecten, licenties, abonnementen, productverkopen.\" : undefined;
    const fixedHeading = isBusinessVariant ? \"Vaste bedrijfskosten\" : \"Vaste lasten\";
    const fixedSubheading = isBusinessVariant ? \"Overzicht van je vaste bedrijfskosten\" : \"Overzicht van je vaste lasten\";
    const fixedHelp = isBusinessVariant
      ? \"Kosten die bij je verdienmodel horen, ongeacht hoeveel je verkoopt (huur, tools, verzekeringen, platformkosten, etc.).\"
      : undefined;
    const freeLabel = isBusinessVariant ? \"Netto bedrijfsruimte per maand\" : \"Vrij te besteden per maand\";

    const incomeSourceLabel =
      snapshot?.totalIncome?.source === \"transactions\"
        ? \"Bron: Afschriften\"
        : snapshot?.totalIncome?.source === \"buckets\"
        ? \"Bron: Buckets\"
        : \"Bron: Handmatig\";
    const fixedSourceLabel =
      snapshot?.fixedCostsTotal?.source === \"transactions\"
        ? \"Bron: Afschriften\"
        : snapshot?.fixedCostsTotal?.source === \"buckets\"
        ? \"Bron: Buckets\"
        : \"Bron: Handmatig\";

    const incomeValue = snapshot?.totalIncome?.value ?? netIncome ?? 0;
    const fixedValue = snapshot?.fixedCostsTotal?.value ?? fixedCosts ?? 0;
    const freeAmount = incomeValue - fixedValue;

    const activeGoals = goals.filter((g) => g.isActive);
    const totalGoalPressure = activeGoals.reduce((sum, g) => sum + (g.monthlyContribution ?? 0), 0);

    let marginStatus = \"Geen doelen ingesteld\";
    if (freeAmount <= 0) {
      marginStatus = \"Onhoudbaar tempo\";
    } else if (activeGoals.length > 0) {
      const margin = freeAmount - totalGoalPressure;
      const threshold = 0.2 * freeAmount;
      if (margin < 0) marginStatus = \"Onhoudbaar tempo\";
      else if (margin < threshold) marginStatus = \"Krap tempo\";
      else marginStatus = \"Stabiel tempo\";
    }

    return (
      <div className=\"space-y-4\">
        <div className=\"flex flex-col gap-1\">
          <h2 className=\"text-2xl font-semibold text-slate-50\">{pageTitle}</h2>
          <p className=\"text-sm text-slate-200\">{pageIntro}</p>
        </div>
        <IncomeList
          items={incomeItems}
          onItemsChange={setIncomeItems}
          onSumChange={(sum) => setNetIncome((prev) => (prev === sum ? prev : sum))}
          heading={incomeHeading}
          subheading={incomeSubheading}
          emptyLabel={isBusinessVariant ? \"Nog geen inkomstenstroom toegevoegd voor je bedrijf.\" : undefined}
        />
        {incomeHelp && <p className=\"text-xs text-slate-200\">{incomeHelp}</p>}
        <FixedCostsList
          items={fixedCostManualItems}
          onItemsChange={setFixedCostManualItems}
          onSumChange={(sum) => setManualFixedCosts((prev) => (prev === sum ? prev : sum))}
          heading={fixedHeading}
          subheading={fixedSubheading}
          emptyLabel={isBusinessVariant ? \"Nog geen vaste bedrijfskosten toegevoegd.\" : undefined}
        />
        {fixedHelp && <p className=\"text-xs text-slate-200\">{fixedHelp}</p>}
        <div className=\"rounded-xl border border-white/20 bg-white/10 p-4 text-slate-100 shadow-sm space-y-2\">
          <div className=\"flex flex-wrap items-center justify-between gap-2\">
            <p className=\"text-sm font-semibold text-slate-50\">{freeLabel}</p>
            <span className=\"rounded-full border border-white/20 px-3 py-0.5 text-[11px] text-slate-100\">
              {incomeSourceLabel} / {fixedSourceLabel}
            </span>
          </div>
          <p className=\"text-xl font-bold text-white\">€{freeAmount.toFixed(0)}</p>
          <p className=\"text-xs text-slate-200\">{marginStatus}</p>
          <p className=\"text-xs text-slate-300\">
            Inkomsten en vaste lasten komen uit de tabellen hierboven. De som van vaste lasten gebruikt de wizard zodra je
            daar items bevestigt, anders de handmatige lijst.
          </p>
        </div>
      </div>
    );
  };

// TAB RITME DATA-BINDING:
"""
new_text = re.sub(pattern, replacement, text)
with open(path, 'w', encoding='utf-8') as f:
    f.write(new_text)
