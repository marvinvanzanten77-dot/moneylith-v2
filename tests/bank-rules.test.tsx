import test from "node:test";
import assert from "node:assert/strict";
import { classifyBankTransactions, indexBankPatterns, patternKey } from "../src/bank/patterns";
import { emptyBankRules, fuelTerms, groceryTerms, isOperatingTransaction, validateBankRules, type BankRuleSettings } from "../src/bank/classificationRules";
import { analyzeFinancialImport } from "../src/bank/financialImport";
import type { MoneylithTransaction } from "../src/types";
const tx = (id: string, party: string, amount = -10, accountId = "personal"): MoneylithTransaction => ({ id, accountId, date: "2026-10-20", description: party, counterparty: party, amount, currency: "EUR", provider: "lunchflow" });
const settings: BankRuleSettings = { accountRoles: { personal: "personal", business: "business" }, rules: [
  { id: "snacks", label: "Tankstation: kleine aankopen", kind: "variable", terms: fuelTerms, direction: "out", belowCents: 1501 },
  { id: "fuel", label: "Tanken", kind: "variable", terms: fuelTerms, direction: "out", aboveCents: 1500 },
  { id: "topup", label: "Creditcard-top-up", kind: "transfer", terms: ["Example Card"] },
  { id: "family", label: "Geleend geld familie", kind: "financing", terms: ["A. B. Example"] },
  { id: "own-out", label: "Interne overboeking", kind: "transfer", terms: [], accountId: "personal", counterpartyIban: "NL91ABNA0417164325" },
  { id: "own-in", label: "Interne overboeking", kind: "transfer", terms: [], accountId: "business", counterpartyIban: "NL91ABNA0417164399" },
] };
test("fuel splits in integer cents, exact boundary is snacks and refunds stay unresolved", () => {
  const rows = classifyBankTransactions([tx("a", "Shell city", -14.99), tx("b", "Shell city", -15), tx("c", "Shell city", -15.01), tx("d", "Shell city", 20)], {}, settings);
  assert.equal(rows[0].bankRuleId, "snacks"); assert.equal(rows[1].bankRuleId, "snacks"); assert.equal(rows[2].bankRuleId, "fuel"); assert.equal(rows[3].bankRuleId, undefined);
  assert.equal(indexBankPatterns(rows, "2026-10-21").length, 3);
});
test("groups supermarket branches together, whole tokens avoid unrelated name matches", () => {
  const rows = classifyBankTransactions([tx("a", "Albert Heijn 123 city"), tx("b", "Jumbo city"), tx("c", "AH 456"), tx("d", "Transaction service"), tx("e", "Sahara")], {});
  assert.equal(new Set(rows.slice(0, 3).map(patternKey)).size, 1);
  assert.equal(rows[3].bankRuleId, undefined); assert.equal(rows[4].bankRuleId, undefined);
  assert.equal(indexBankPatterns(rows, "2026-10-21")[0].label, "Boodschappen");
});
test("transfers require the full counterparty account and correct source; direction remains separate", () => {
  const rows = classifyBankTransactions([tx("a", "Transfer NL91 ABNA 0417 1643 25", -50), tx("b", "Transfer NL91ABNA0417164399", 50, "business"), tx("c", "Transfer ending 25", -50), tx("d", "Transfer NL91ABNA0417164325", -50, "other")], {}, settings);
  assert.equal(rows[0].bankPatternKind, "transfer"); assert.equal(rows[1].bankPatternKind, "transfer"); assert.equal(rows[2].bankPatternKind, undefined); assert.equal(rows[3].bankPatternKind, undefined);
  assert.notEqual(patternKey(rows[0]), patternKey(rows[1]));
});
test("financing and card funding do not become earnings, spending, subscriptions or debts", () => {
  const rows = classifyBankTransactions([tx("a", "Example Card top up", -100), tx("b", "A B Example", 50), tx("c", "A.B. Example", -30), tx("d", "Jumbo", -20)], {}, settings);
  assert.equal(rows[1].bankPatternKind, "financing"); assert.equal(rows[2].bankPatternKind, "financing");
  assert.deepEqual(rows.filter(t => isOperatingTransaction(t, settings)).map(t => t.id), ["d"]);
  const analysis = analyzeFinancialImport(rows, "2026-10-21"); assert.equal(analysis.otherOutflows30Days, 20); assert.equal(analysis.candidates.length, 0);
});
test("rules are replayable, immutable and preserve manual categories, descriptions and notes", () => {
  const original = [ { ...tx("a", "Jumbo"), category: "My choice", notes: "Keep", description: "Edited", providerData: { description: "Jumbo city", counterparty: "Jumbo", amount: -10, date: "2026-10-20" } } ];
  const before = JSON.stringify(original); const first = classifyBankTransactions(original, {}, settings); const second = classifyBankTransactions(first, {}, settings);
  assert.deepEqual(first, second); assert.equal(first[0].category, "My choice"); assert.equal(first[0].notes, "Keep"); assert.equal(first[0].description, "Edited"); assert.equal(JSON.stringify(original), before);
});
test("explicit answers outrank rules and grouped corrections survive reclassification", () => {
  const original = tx("a", "Jumbo"); const manual = classifyBankTransactions([original], {[patternKey(original)]: {kind: "ignore", label: "My exception"}}, settings)[0];
  assert.equal(manual.bankPatternKind, "ignore"); assert.equal(manual.bankRuleId, undefined);
  const auto = classifyBankTransactions([original], {}, settings)[0]; const decisions = {[patternKey(auto)]: {kind: "variable" as const, label: "Household"}};
  assert.equal(classifyBankTransactions([auto], decisions, settings)[0].category, "Household");
});
test("deleting a rule clears only rule-managed annotations; manual edits survive", () => {
  const auto = classifyBankTransactions([tx("a", "Shell")], {}, settings)[0];
  const removed = classifyBankTransactions([auto], {}, emptyBankRules)[0]; assert.equal(removed.category, undefined); assert.equal(removed.bankPatternKind, undefined);
  const manual = classifyBankTransactions([{...auto, category: "My edit"}], {}, emptyBankRules)[0]; assert.equal(manual.category, "My edit");
});
test("unknown values, currencies, other providers and business context are not personal spending", () => {
  assert.equal(classifyBankTransactions([{...tx("a", "Shell"), amount: NaN}], {}, settings)[0].bankRuleId, undefined);
  assert.equal(classifyBankTransactions([{...tx("b", "Shell"), currency: "USD"}], {}, settings)[0].bankRuleId, undefined);
  assert.equal(classifyBankTransactions([{...tx("c", "Shell"), provider: undefined}], {}, settings)[0].bankRuleId, undefined);
  assert.equal(isOperatingTransaction(tx("d", "Jumbo", -30, "business"), settings), false);
});
test("validates rules and never allows unknown recurring amounts to be promoted automatically", () => {
  assert.equal(validateBankRules(settings), true);
  assert.equal(validateBankRules({...settings, rules:[{...settings.rules[0],kind:"fixed"}]}), false);
  assert.equal(validateBankRules({...settings, rules:[{...settings.rules[0],terms:[""]}]}), false);
  assert.equal(validateBankRules({...settings, rules:[{...settings.rules[0],aboveCents:2000,belowCents:1500}]}), false);
});
test("rule storage rolls back atomically on failure and remains in the private cloud scope", async () => {
  const { persistLunchflow } = await import("../src/bank/lunchflowMerge");
  const { cloudKey } = await import("../src/storage/cloudState");
  const values = new Map<string,string>([["moneylith.personal.accounts","[]"],["moneylith.business.income","[100]"],["moneylith.personal.bankRules.v1",JSON.stringify(emptyBankRules)]]);
  const before = [...values]; let failed = false;
  const storage = {getItem:(k:string)=>values.get(k)??null,removeItem:(k:string)=>{values.delete(k);},setItem:(k:string,v:string)=>{if(k==='moneylith.personal.bankRules.v1'&&!failed){failed=true;throw Error('Disk full');} values.set(k,v);}};
  assert.throws(()=>persistLunchflow(storage,{accounts:[],transactions:[],reports:[]},{income:[],fixedCosts:[],seen:[],rules:settings}));
  assert.deepEqual([...values].sort(),before.sort());
  assert.equal(cloudKey('moneylith.personal.bankRules.v1'),true);
  assert.equal(cloudKey('moneylith.demo.bankRules.v1'),false);
});

test("all configured fuel and grocery aliases flow through monthly budgets without double counting", async () => {
  const {spendingRows, spendingAboveBudgets} = await import("../src/bank/spending");
  for (const name of fuelTerms) {
    const rows = classifyBankTransactions([tx("small", name, -15), tx("fuel", name, -15.01)], {}, settings);
    assert.equal(rows[0].bankRuleId, "snacks", name);
    assert.equal(rows[1].bankRuleId, "fuel", name);
    const visible = spendingAboveBudgets(spendingRows(rows, settings), [{id:"fuel-budget",naam:"Tanken",bedrag:10,amountEntered:true,budgetCategory:"Tanken",budgetSince:"2026-10"}]);
    assert.deepEqual(visible.map(r=>[r.label,r.cents]), [["Tanken — boven maandbudget",501],["Tankstation: kleine aankopen",1500]], name);
  }
  for (const name of groceryTerms) {
    const rows = classifyBankTransactions([tx("a",name,-90),tx("b",name,-20)],{},settings);
    const visible = spendingAboveBudgets(spendingRows(rows,settings), [{id:"groceries",naam:"Boodschappen",bedrag:100,amountEntered:true,budgetCategory:"Boodschappen",budgetSince:"2026-10"}]);
    assert.deepEqual(visible.map(r=>[r.label,r.cents]), [["Boodschappen — boven maandbudget",1000]], name);
  }
});

test('merchant taxonomy groups purchases by purpose and retains separate meaningful pots', async () => {
  const {spendingRows,spendingSummary}=await import('../src/bank/spending');
  const examples: [string,string][] = [
    ['Kringloopcentrum West','Spullen en huishouden'],['Het Goed','Spullen en huishouden'],
    ['RataPlan','Spullen en huishouden'],['bol.com via iDEAL','Spullen en huishouden'],['Temu','Spullen en huishouden'],['Action 123','Spullen en huishouden'],
    ['H&M centrum','Kleding en schoenen'],['C&A','Kleding en schoenen'],['vanHaren','Kleding en schoenen'],['Zalando','Kleding en schoenen'],
    ['Sauna centrum','Gezondheid en welzijn'],['Thermen','Gezondheid en welzijn'],['Apotheek','Gezondheid en welzijn'],
    ['Kruidvat','Persoonlijke verzorging'],['Kapper','Persoonlijke verzorging'],
    ["McDonald's",'Eten en drinken buiten de deur'],['Thuisbezorgd.nl','Eten en drinken buiten de deur'],
    ['Q-Park','Vervoer en parkeren'],['OVpay','Vervoer en parkeren'],
    ['Pathé','Vrije tijd en uitjes'],['Efteling','Vrije tijd en uitjes'],
    ['Rode Kruis','Cadeaus en donaties'],['Greetz','Cadeaus en donaties'],
  ];
  const input=examples.map(([name],i)=>tx(String(i),name,-10));
  const classified=classifyBankTransactions(input,{},settings);
  examples.forEach(([,label],i)=>assert.equal(classified[i].category,label,examples[i][0]));
  assert.deepEqual(classifyBankTransactions(classified,{},settings),classified);
  assert.equal(input.every(t=>!t.category),true);
  const summary=spendingSummary(spendingRows(classified,settings),'2026-10','2026-10-24');
  assert.equal(summary.pots.length,8);
  assert.equal(summary.totalCents,examples.length*1000);
});
test('taxonomy rename reclassifies managed historical labels but preserves user edits and decisions', () => {
  const prior={...tx('action','Action'),bankRuleId:'variety-store',bankPatternKind:'variable' as const,category:'Overige aankopen',bankPatternCategory:'Overige aankopen',notes:'Keep'};
  const sauna={...tx('sauna','Sauna'),bankRuleId:'sauna',bankPatternKind:'variable' as const,category:'Sauna en wellness',bankPatternCategory:'Sauna en wellness'};
  const next=classifyBankTransactions([prior,sauna,{...prior,id:'manual',category:'Mijn cadeautjes'}],{},settings);
  assert.equal(next[0].category,'Spullen en huishouden');assert.equal(next[0].notes,'Keep');
  assert.equal(next[1].category,'Gezondheid en welzijn');assert.equal(next[2].category,'Mijn cadeautjes');
  const explicit=classifyBankTransactions([prior],{[patternKey(prior)]:{kind:'variable',label:'Werkspullen'}},settings);
  assert.equal(explicit[0].category,'Werkspullen');
});
test('unknown sellers, refunds and transfers never become invented purchase categories', () => {
  const input=[tx('a','Unknown Shop'),tx('b','Action refund',20),tx('c','Bolster'),tx('d','Transactional'),tx('e','Paypal'),tx('f','Saunaland unrelated')];
  assert.ok(classifyBankTransactions(input,{},settings).every(t=>!t.bankRuleId));
  const transfer=classifyBankTransactions([tx('x','Action NL91ABNA0417164325')],{},settings)[0];
  assert.equal(transfer.bankPatternKind,'transfer');
});
test('legacy pot names consolidate without changing stored custom categories or decisions', async () => {
  const {spendingRows,spendingSummary}=await import('../src/bank/spending');
  const input=['Overige aankopen','Spullen en huishouden','Sauna en wellness','Gezondheid en welzijn','Koffie en snacks','Tankstation — rookwaar, koffie of snacks','Koffie, snacks en rookwaar','Mijn cadeautjes'].map((label,i)=>({...tx(String(i),'merchant'),category:label,bankPatternKind:'variable' as const}));
  const before=JSON.stringify(input);
  const pots=spendingSummary(spendingRows(input,settings),'2026-10','2026-10-24').pots;
  assert.equal(pots.find(p=>p.label==='Spullen en huishouden')?.cents,2000);
  assert.equal(pots.find(p=>p.label==='Gezondheid en welzijn')?.cents,2000);
  assert.equal(pots.find(p=>p.label==='Koffie, snacks en rookwaar')?.cents,3000);
  assert.equal(pots.find(p=>p.label==='Mijn cadeautjes')?.cents,1000);
  assert.equal(JSON.stringify(input),before);
});
