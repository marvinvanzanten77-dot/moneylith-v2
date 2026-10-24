import test from "node:test";
import assert from "node:assert/strict";
import { spendingRows, spendingSummary } from "../src/bank/spending";
import { emptyBankRules } from "../src/bank/classificationRules";
import { buildChatRequest } from "../src/ai/context";
import type { MoneylithTransaction } from "../src/types";
const tx = (id: string, amount: number, label: string | null, kind?: MoneylithTransaction["bankPatternKind"]): MoneylithTransaction => ({ id, date:"2026-10-05", accountId:"private", description:"PRIVATE BANK DESCRIPTION", amount, category:label, bankPatternKind:kind, provider:"lunchflow", currency:"EUR" });
const date = "2026-10-21";
test("pots contain purchases, not fixed costs, transfers, loans, top-ups, income or business expenses", () => {
  const rows = spendingRows([tx("food",-23.45,"Boodschappen","variable"),tx("fixed",-500,"Huur","fixed"),tx("topup",-100,"Card","transfer"),tx("loan",-50,"Family","financing"),tx("income",1000,"Salary","income"),{...tx("business",-20,"Action","variable"),accountId:"business"},tx("unknown",-10,null)],{rules:[],accountRoles:{business:"business"}});
  assert.deepEqual(rows.map(r=>r.id),["food","unknown"]);
  const summary=spendingSummary(rows,"2026-10",date);assert.equal(summary.totalCents,3345);assert.equal(summary.unknownCents,1000);assert.equal(summary.pots[0].cents,2345);assert.equal(summary.pots[0].count,1);
});
test("manual categories win; duplicate IDs and fixed-cost evidence do not inflate pots", () => {
  const rows=spendingRows([tx("a",-3,"My pot","variable"),tx("a",-3,"My pot","variable"),tx("fixed",-30,null)],emptyBankRules,[{id:"f",naam:"Phone",bedrag:30,dagVanMaand:1,bankEvidence:{key:"fixed",through:date,transactionIds:["fixed"]}}]);
  assert.equal(rows.length,1);assert.equal(rows[0].label,"My pot");
});
test("month comparison uses equal elapsed days and missing history stays unknown", () => {
  const rows=[{id:"a",date:"2026-10-01",cents:1000,label:"Food"},{id:"b",date:"2026-09-01",cents:800,label:"Food"},{id:"c",date:"2026-09-30",cents:9000,label:"Food"},{id:"d",date:"2026-10-04",cents:200,label:"Coffee"}];
  const summary=spendingSummary(rows,"2026-10",date);assert.equal(summary.pots[0].previousCents,800);assert.equal(summary.pots[1].previousCents,null);assert.equal(summary.totalCents,1200);
  assert.equal(spendingSummary([],"2026-10",date).totalCents,null);
});
test("invalid dates, amounts, future rows and unsupported currency cannot create insight", () => {
  const rows=spendingRows([{...tx("bad",-5,"Food"),date:"2026-13-01"},{...tx("nan",NaN,"Food")},{...tx("usd",-5,"Food"),currency:"USD"}],emptyBankRules);assert.equal(rows.length,0);
  assert.equal(spendingSummary([{id:"future",date:"2026-10-22",cents:100,label:"Food"}],"2026-10",date).totalCents,null);
});
test("AI receives recomputed observed pots and no raw transaction descriptions, identities or client totals", () => {
  const request=buildChatRequest({scope:"personal",purpose:"spending-coach",context:{month:"2026-10",totalCents:999999,description:"PRIVATE",rows:[{id:"secret-id",date:"2026-10-01",cents:1234,label:"Food",iban:"PRIVATE"}]}});
  const context=request.messages[1].content;assert.ok(context.includes('"cents":1234'));assert.ok(!context.includes("999999"));assert.ok(!context.includes("PRIVATE"));assert.ok(!context.includes("secret-id"));assert.equal(request.qualitativeOnly,true);
  assert.match(request.messages[0].content,/bemoedigend/);assert.match(request.messages[0].content,/geen bewezen|voorspelde besparing/);assert.match(request.messages[0].content,/zonder.*oordeel/);
});
test("AI purpose rejects business contexts, unknown-only data, invalid values and oversized input", () => {
  const body={scope:"personal",purpose:"spending-coach",context:{month:"2026-10",rows:[{id:"a",date:"2026-10-01",cents:100,label:"Food"}]}};
  assert.throws(()=>buildChatRequest({...body,scope:"business-real"}));
  assert.throws(()=>buildChatRequest({...body,context:{...body.context,rows:[{...body.context.rows[0],label:null}]}}));
  assert.throws(()=>buildChatRequest({...body,context:{...body.context,rows:[{...body.context.rows[0],cents:NaN}]}}));
  assert.throws(()=>buildChatRequest({...body,irrelevant:"x".repeat(500001)}));
});
test("the initial screen presents pots and a single classification entry, not bank descriptions or the management list", async () => {
  const React = await import("react"); const { renderToStaticMarkup } = await import("react-dom/server"); const { BankSpendingOverview } = await import("../src/components/BankSpendingOverview");
  const html=renderToStaticMarkup(React.createElement(BankSpendingOverview,{asOf:date,accounts:[],transactions:[tx("food",-20,"Boodschappen","variable"),tx("u",-5,null)],income:[],fixedCosts:[],decisions:{},rules:emptyBankRules,onDecide:()=>{},onBank:()=>{}}));
  assert.ok(html.includes('data-spending-overview'));assert.ok(html.includes('Je uitgavenpotjes'));assert.ok(html.includes('Help met indelen'));
  assert.ok(!html.includes('PRIVATE BANK DESCRIPTION'));assert.ok(!html.includes('data-bank-patterns'));assert.ok(!html.includes('Eigen regels beheren'));
});
test("the spending coach module graph loads as production Node ESM without the tsx resolver", async () => {
  const fs = await import("node:fs/promises"), path = await import("node:path"), os = await import("node:os"), url = await import("node:url"), ts = await import("typescript");
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "moneylith-coach-esm-"));
  try {
    await fs.writeFile(path.join(folder,"package.json"),'{"type":"module"}');
    for (const file of ["ai/spendingCoach", "bank/spending", "bank/classificationRules", "bank/choiceGuidance"]) {
      const source = await fs.readFile(new URL(`../src/${file}.ts`, import.meta.url), "utf8");
      const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
      const destination = path.join(folder,file+'.js'); await fs.mkdir(path.dirname(destination),{recursive:true}); await fs.writeFile(destination,compiled);
    }
    // A child Node process deliberately omits --import tsx, matching Vercel's ESM resolution.
    const { execFileSync } = await import("node:child_process");
    const output = execFileSync(process.execPath,["--input-type=module","-e",`const module = await import(${JSON.stringify(url.pathToFileURL(path.join(folder,'ai/spendingCoach.js')).href)}); console.log(typeof module.buildSpendingCoach);`],{encoding:"utf8"});
    assert.equal(output.trim(),"function");
  } finally { await fs.rm(folder,{recursive:true,force:true}); }
});
