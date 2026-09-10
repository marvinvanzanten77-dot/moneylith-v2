import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditDialog } from "../src/business/Editor";
import { businessTabs } from "../src/business/copy";
import {
  workspaceStepMap,
  readBusinessStep,
  readWorkspaceStep,
  rememberWorkspaceStep,
} from "../src/components/workspaceNavigation";
import { BusinessGuide } from "../src/business/InsightPanels";
import { emptyBusiness } from "../src/business/model";

test("every business tab maps to the same personal position, including unavailable Bank", () => {
  assert.deepEqual(
    businessTabs.map(([key]) => workspaceStepMap[key]),
    [
      "intent",
      "fundament",
      "schulden",
      "vermogen",
      "focus",
      "rekeningen",
      "bank",
      "afschriften",
      "inbox",
      "action",
      "backup",
      "settings",
    ],
  );
});
test("mode navigation preserves each corresponding step and safely handles unavailable UI storage", () => {
  const previous = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  try {
    for (const [business, personal] of Object.entries(workspaceStepMap)) {
      rememberWorkspaceStep(personal);
      assert.equal(readWorkspaceStep(), personal);
      assert.equal(readBusinessStep(), business);
    }
    rememberWorkspaceStep("invalid");
    assert.equal(readBusinessStep(), "intent");
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("Unavailable");
      },
    });
    assert.doesNotThrow(() => rememberWorkspaceStep("fundament"));
    assert.equal(readBusinessStep(), "intent");
  } finally {
    if (previous) Object.defineProperty(globalThis, "sessionStorage", previous);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
test("inline forms render editable saved values and distinguish unknown amounts from zero without a dialog", () => {
  const html = renderToStaticMarkup(
    <EditDialog
      inline
      title="Maandplan"
      button="Bewerk"
      value={{ revenue: null, costs: 0 }}
      fields={[
        { key: "revenue", label: "Omzet", type: "money", nullable: true },
        { key: "costs", label: "Kosten", type: "money", nullable: true },
      ]}
      onSave={() => {}}
    />,
  );
  assert.ok(!html.includes("<dialog"));
  assert.match(html, /value=""/);
  assert.match(html, /value="0"/);
  assert.match(html, /Opslaan/);
});
test("business guide identifies local help and offers no apparent chat or bank connection", () => {
  const html = renderToStaticMarkup(
    <BusinessGuide data={emptyBusiness("real")} tab="bank" go={() => {}} />,
  );
  assert.match(html, /AI niet aangesloten/);
  assert.ok(!html.includes("<textarea"));
  assert.ok(!html.includes("<input"));
});
