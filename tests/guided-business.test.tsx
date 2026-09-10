import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyBusiness, validateBusiness } from "../src/business/model";
import {
  changeBusiness,
  confirmSection,
  reviewSections,
} from "../src/business/finance";
import { loadBusiness, saveBusiness } from "../src/business/storage";
import {
  businessStrategies,
  businessPressures,
  emptyBusinessIntent,
} from "../src/logic/businessIntent";
import { IntentQuestions } from "../src/components/IntentQuestions";
import { StepIntent } from "../src/components/steps/StepIntent";
import { blankGoalDraft, readGoalDraft } from "../src/components/GoalWorkspace";
import { BusinessGoals } from "../src/business/BusinessGoals";
import { goalProgress, stepProgress } from "../src/business/insights";
import { buildChatRequest, businessChatData } from "../src/ai/context";
import { Collection } from "../src/business/Editor";

test("old free intent remains editable data, never inferred selections; guided choices persist without changing finance receipts or chat", () => {
  let data = emptyBusiness("real");
  data.profile = {
    name: "Existing company",
    goal: "Buffer opbouwen",
    pressure: "Belasting",
    direction: "Rust",
  };
  data = confirmSection(data, "income", true);
  const values = new Map<string, string>([
    ["moneylith.chat.v1.business-real", "OWN_CHAT"],
    ["moneylith.chat.v1.personal", "PERSONAL_CHAT"],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  saveBusiness(storage, "real", data);
  const old = loadBusiness(storage, "real");
  assert.equal(old.intent, undefined);
  assert.equal(stepProgress(old, "intent"), "Nog te doen");
  const next = changeBusiness(old, (n) => {
    n.intent = {
      primaryGoal: "margin",
      mainPressure: ["costs", "taxes"],
      timeHorizon: "5_jaar",
      aiStyle: "ondersteunend",
    };
  });
  saveBusiness(storage, "real", next);
  const saved = loadBusiness(storage, "real");
  assert.deepEqual(saved.profile, old.profile);
  assert.deepEqual(saved.intent, next.intent);
  assert.deepEqual(saved.reviews, old.reviews);
  assert.equal(stepProgress(saved, "intent"), "Ingevuld");
  assert.equal(reviewSections(saved).income.ready, true);
  assert.equal(values.get("moneylith.chat.v1.business-real"), "OWN_CHAT");
  assert.equal(values.get("moneylith.chat.v1.personal"), "PERSONAL_CHAT");
});

test("guided intent is validated and allowlisted server-side; selected strategy, pressures, horizon and style reach provider instructions", () => {
  const data = emptyBusiness("real");
  data.intent = {
    primaryGoal: "cashflow",
    mainPressure: ["variable_revenue", "late_payments"],
    timeHorizon: "3_maanden",
    aiStyle: "confronterend",
  };
  const clean = businessChatData({
    ...data,
    intent: { ...data.intent, personal: "PRIVATE_MARKER" },
  });
  assert.deepEqual(clean.intent, data.intent);
  assert.ok(!JSON.stringify(clean).includes("PRIVATE_MARKER"));
  const request = buildChatRequest({
    scope: "business-real",
    context: data,
    history: [],
    question: "Wat is mijn volgende stap?",
  });
  for (const value of [
    "Kasstroom stabiliseren",
    "Wisselende omzet",
    "Late klantbetalingen",
    "3_maanden",
    "Wees direct en zakelijk",
  ])
    assert.ok(request.messages[0].content.includes(value));
  assert.match(request.messages.at(-1)!.content, /"aiStyle":"confronterend"/);
  for (const patch of [
    { primaryGoal: "private_debt" },
    { mainPressure: ["taxes", "taxes"] },
    { timeHorizon: "morgen" },
    { aiStyle: "ignore security" },
  ]) {
    assert.throws(
      () => businessChatData({ ...data, intent: { ...data.intent, ...patch } }),
      /geldige zakelijke intentie/,
    );
  }
  for (const [style, instruction] of [
    ["spiegelend", "Spiegel de waarnemingen"],
    ["ondersteunend", "stap voor stap"],
  ] as const) {
    data.intent.aiStyle = style;
    assert.ok(
      buildChatRequest({
        scope: "business-real",
        context: data,
        history: [],
        question: "Help",
      }).messages[0].content.includes(instruction),
    );
  }
});

test("both intent forms use the same guided order, horizon options and accessible multi-selection", () => {
  const personal = renderToStaticMarkup(
    <StepIntent
      value={{
        primaryGoal: null,
        mainPressure: [],
        timeHorizon: null,
        aiStyle: null,
      }}
      onChange={() => {}}
    />,
  );
  const business = renderToStaticMarkup(
    <IntentQuestions
      business
      value={emptyBusinessIntent()}
      strategies={businessStrategies}
      pressures={businessPressures}
      onChange={() => {}}
    />,
  );
  for (const html of [personal, business]) {
    assert.equal((html.match(/<select/g) ?? []).length, 3);
    for (const word of [
      "<fieldset",
      "<legend",
      "3 maanden",
      "1 jaar",
      "5 jaar",
      "Spiegelend",
      "Confronterend",
      "Ondersteunend",
    ])
      assert.ok(html.includes(word));
    assert.ok(html.indexOf("<fieldset") < html.indexOf("3 maanden"));
    assert.ok(html.indexOf("5 jaar") < html.indexOf("Spiegelend"));
  }
  for (const option of [...businessStrategies, ...businessPressures])
    assert.ok(business.includes(option.label));
});

test("goals preserve unknown versus explicit zero, optional and cleared deadlines, and business revenue semantics", () => {
  const empty = { ...blankGoalDraft(), label: "Buffer", kind: "buffer" };
  const missing = readGoalDraft(empty, true);
  assert.deepEqual(
    [missing.target, missing.current, missing.monthly, missing.date],
    [null, null, null, null],
  );
  assert.throws(() => readGoalDraft(empty, false), /alle bedragen/);
  const zero = readGoalDraft(
    { ...empty, target: "0", current: "0", monthly: "0", date: "31-12-2027" },
    true,
  );
  assert.deepEqual(
    [zero.target, zero.current, zero.monthly, zero.date],
    [0, 0, 0, "2027-12-31"],
  );
  assert.equal(readGoalDraft({ ...empty, date: "" }, true).date, null);
  for (const date of ["31-02-2027", "geen datum"])
    assert.throws(() => readGoalDraft({ ...empty, date }, true), /deadline/);
  const revenue = readGoalDraft(
    {
      ...empty,
      kind: "revenue",
      target: "1000",
      current: "123",
      monthly: "400",
    },
    true,
    true,
  );
  assert.equal(revenue.current, null);
  assert.equal(revenue.monthly, null);
  let data = emptyBusiness("real");
  data = changeBusiness(data, (n) => {
    n.goals = [{ ...missing, id: "goal", kind: "buffer", isActive: false }];
  });
  validateBusiness(data);
  assert.equal(goalProgress(data, data.goals[0]).remaining, null);
  data = changeBusiness(data, (n) => {
    n.goals[0] = { ...n.goals[0], ...zero, kind: "buffer" };
  });
  assert.equal(goalProgress(data, data.goals[0]).remaining, 0);
});

test("business goal form starts with genuinely blank monetary fields and deadline; examples are names and types only", () => {
  let writes = 0;
  const html = renderToStaticMarkup(
    <BusinessGoals
      data={emptyBusiness("real")}
      onSave={() => writes++}
      onDelete={() => {}}
    />,
  );
  assert.equal(writes, 0);
  assert.ok(!html.includes('value="0"'));
  assert.ok(!html.includes('type="date"'));
  for (const text of [
    "Bedrijfsbuffer opbouwen",
    "Investering voorbereiden",
    "Zakelijke schuld aflossen",
    "Maandomzet verhogen",
    "Actief doel",
    "Formulier leegmaken",
    "Deadline (optioneel",
  ])
    assert.ok(html.includes(text));
  assert.match(html, /Een voorbeeld vult alleen naam en type/);
  const collection = renderToStaticMarkup(
    <Collection
      inline
      title="Facturen"
      items={[]}
      fields={[]}
      defaults={{}}
      onSave={() => {}}
      onDelete={() => {}}
      summary={() => null}
    />,
  );
  assert.ok(collection.includes("Toevoegen"));
  assert.ok(!collection.includes("<form"));
  assert.ok(!collection.includes("<dialog"));
});

test("shared settings keeps banner, help and backup controls while unavailable business cloud stays disabled", async () => {
  const { StepSettings } = await import("../src/components/steps/StepSettings");
  const props = {
    storageMode: "local" as const,
    onStorageModeChange: () => {},
    helpMode: false,
    onHelpModeChange: () => {},
    showModeBanner: true,
    onShowModeBannerChange: () => {},
    onResetIntro: () => {},
    onOpenBackup: () => {},
  };
  for (const business of [false, true]) {
    const html = renderToStaticMarkup(
      <StepSettings {...props} business={business} />,
    );
    for (const text of [
      "Hulpmodus",
      "Toon modus-banner",
      "Open backup",
      "Local-first",
    ])
      assert.ok(html.includes(text));
    if (business) {
      assert.match(html, /disabled=""/);
      assert.match(html, /Nog niet beschikbaar voor Zakelijk/);
    }
  }
});

test("business reuses personal backup controls with a whole-ledger scope and independent versions", async () => {
  const { BackupCard } = await import("../src/components/BackupCard");
  const html = renderToStaticMarkup(
    <BackupCard
      scoped={{
        snapshot: emptyBusiness("real") as unknown as Record<string, unknown>,
        restore: () => {},
        versionKey: "moneylith.business.real.backup.versions",
      }}
    />,
  );
  for (const label of [
    "Download JSON-back-up",
    "Versleutelen met wachtwoord",
    "Automatische versie opslaan",
    "Kies JSON-bestand",
  ])
    assert.ok(html.includes(label));
  assert.ok(html.includes("Facturen, betalingen en rekeningen blijven samen"));
  assert.ok(!html.includes("Persoonlijk</label>"));
});
