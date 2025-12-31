var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { listInstitutions, createAgreement, createRequisition, getRequisition, getTransactions, getBalances, deleteRequisition, } from "../src/integrations/bank/gocardless/connector.js";
import { getAccessToken } from "../src/integrations/bank/gocardless/auth.js";
import { mapBankTxToMoneylithTx } from "../src/integrations/bank/normalize.js";
var isProd = process.env.VERCEL_ENV === "production";
var provider = isProd ? "real" : process.env.BANK_PROVIDER || "mock";
// Minimal in-memory store (per lambda instance)
var bankStore = {
    requisitions: new Map(),
};
var getRedirectUrl = function () { return process.env.GC_REDIRECT_URL || "http://localhost:3000/api/bank/callback"; };
function saveRequisition(rec) {
    if (!(rec === null || rec === void 0 ? void 0 : rec.id))
        return;
    bankStore.requisitions.set(rec.id, {
        id: rec.id,
        agreement_id: rec.agreement,
        institution_id: rec.institution_id,
        accounts: rec.accounts || [],
        status: rec.status,
        link: rec.link,
        reference: rec.reference,
        last_sync: null,
        last_error: null,
    });
}
function json(res, status, body) {
    res.status(status).json(body);
}
function handleInstitutions(res) {
    return __awaiter(this, void 0, void 0, function () {
        var data, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    if (provider !== "real")
                        return [2 /*return*/, json(res, 400, { error: "Mock provider: gebruik /api/mock-bank in preview" })];
                    return [4 /*yield*/, listInstitutions("NL")];
                case 1:
                    data = _a.sent();
                    json(res, 200, data || []);
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    json(res, 500, { error: err_1.message || "institutions failed" });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function handleConnect(req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var institutionId, agreement, requisition, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    institutionId = (req.body || {}).institutionId;
                    if (!institutionId)
                        return [2 /*return*/, json(res, 400, { error: "institutionId ontbreekt" })];
                    return [4 /*yield*/, createAgreement(institutionId)];
                case 1:
                    agreement = _a.sent();
                    return [4 /*yield*/, createRequisition(institutionId, agreement.id, getRedirectUrl(), "moneylith-".concat(Date.now()))];
                case 2:
                    requisition = _a.sent();
                    saveRequisition(requisition);
                    json(res, 200, { link: requisition.link, requisitionId: requisition.id, agreementId: agreement.id });
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _a.sent();
                    json(res, 500, { error: err_2.message || "connect failed" });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function handleCallback(req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, requisition_id, id, ref, reference_1, candidate, reqId, found, reqData, err_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    _a = (req.query || {}), requisition_id = _a.requisition_id, id = _a.id, ref = _a.ref, reference_1 = _a.reference;
                    candidate = requisition_id || id || ref || reference_1;
                    reqId = candidate;
                    if (!reqId && reference_1) {
                        found = Array.from(bankStore.requisitions.values()).find(function (r) { return r.reference === reference_1; });
                        reqId = found === null || found === void 0 ? void 0 : found.id;
                    }
                    if (!reqId)
                        return [2 /*return*/, res.redirect("/?bank=error")];
                    return [4 /*yield*/, getRequisition(reqId)];
                case 1:
                    reqData = _b.sent();
                    saveRequisition(reqData);
                    return [2 /*return*/, res.redirect("/?bank=connected")];
                case 2:
                    err_3 = _b.sent();
                    return [2 /*return*/, res.redirect("/?bank=error")];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function handleAccounts(res) {
    return __awaiter(this, void 0, void 0, function () {
        var list;
        return __generator(this, function (_a) {
            list = Array.from(bankStore.requisitions.values()).map(function (r) { return ({
                requisition_id: r.id,
                agreement_id: r.agreement_id,
                institution_id: r.institution_id,
                accounts: r.accounts,
                status: r.status,
                last_sync: r.last_sync,
                last_error: r.last_error,
            }); });
            json(res, 200, list);
            return [2 /*return*/];
        });
    });
}
function handleSync(req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, accountId_1, requisitionId, dateFrom, targetReq, ids, results, _loop_1, _i, ids_1, accId, err_4;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 5, , 6]);
                    _a = req.body || {}, accountId_1 = _a.accountId, requisitionId = _a.requisitionId, dateFrom = _a.dateFrom;
                    targetReq = requisitionId
                        ? bankStore.requisitions.get(requisitionId)
                        : Array.from(bankStore.requisitions.values()).find(function (r) { return (accountId_1 ? r.accounts.includes(accountId_1) : true); });
                    if (!targetReq)
                        return [2 /*return*/, json(res, 400, { error: "Geen koppeling gevonden" })];
                    ids = accountId_1 ? [accountId_1] : targetReq.accounts;
                    results = [];
                    _loop_1 = function (accId) {
                        var txRes, balances, booked, pending, mappedBooked, mappedPending, err_5;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    _e.trys.push([0, 3, , 4]);
                                    return [4 /*yield*/, getTransactions(accId, dateFrom)];
                                case 1:
                                    txRes = _e.sent();
                                    return [4 /*yield*/, getBalances(accId)];
                                case 2:
                                    balances = _e.sent();
                                    booked = ((_b = txRes === null || txRes === void 0 ? void 0 : txRes.transactions) === null || _b === void 0 ? void 0 : _b.booked) || [];
                                    pending = ((_c = txRes === null || txRes === void 0 ? void 0 : txRes.transactions) === null || _c === void 0 ? void 0 : _c.pending) || [];
                                    mappedBooked = booked.map(function (t) { return mapBankTxToMoneylithTx(accId, t, "booked"); });
                                    mappedPending = pending.map(function (t) { return mapBankTxToMoneylithTx(accId, t, "pending"); });
                                    results.push({
                                        accountId: accId,
                                        balances: balances,
                                        transactions: __spreadArray(__spreadArray([], mappedBooked, true), mappedPending, true),
                                    });
                                    targetReq.last_sync = new Date().toISOString();
                                    targetReq.last_error = null;
                                    return [3 /*break*/, 4];
                                case 3:
                                    err_5 = _e.sent();
                                    targetReq.last_error = err_5.message || "sync failed";
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, ids_1 = ids;
                    _d.label = 1;
                case 1:
                    if (!(_i < ids_1.length)) return [3 /*break*/, 4];
                    accId = ids_1[_i];
                    return [5 /*yield**/, _loop_1(accId)];
                case 2:
                    _d.sent();
                    _d.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    json(res, 200, results);
                    return [3 /*break*/, 6];
                case 5:
                    err_4 = _d.sent();
                    json(res, 500, { error: err_4.message || "sync failed" });
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function handleDisconnect(req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var requisitionId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    requisitionId = (req.body || {}).requisitionId;
                    if (!requisitionId)
                        return [2 /*return*/, json(res, 400, { error: "requisitionId ontbreekt" })];
                    bankStore.requisitions.delete(requisitionId);
                    return [4 /*yield*/, deleteRequisition(requisitionId).catch(function () { })];
                case 1:
                    _a.sent();
                    json(res, 200, { ok: true });
                    return [2 /*return*/];
            }
        });
    });
}
function handleHealth(res) {
    return __awaiter(this, void 0, void 0, function () {
        var id, key, token, err_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    id = process.env.GC_SECRET_ID || "";
                    key = process.env.GC_SECRET_KEY || "";
                    if (!id || !key) {
                        return [2 /*return*/, json(res, 200, {
                                ok: false,
                                reason: "missing_credentials",
                                idLen: id.length,
                                keyLen: key.length,
                            })];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, getAccessToken()];
                case 2:
                    token = _a.sent();
                    return [2 /*return*/, json(res, 200, { ok: !!token, reason: token ? "ok" : "no_token" })];
                case 3:
                    err_6 = _a.sent();
                    return [2 /*return*/, json(res, 500, { ok: false, reason: err_6.message || "token_failed" })];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function handleRuntimeCheck(res) {
    return __awaiter(this, void 0, void 0, function () {
        var envLengths;
        return __generator(this, function (_a) {
            envLengths = {
                GC_SECRET_ID_len: (process.env.GC_SECRET_ID || "").length,
                GC_SECRET_KEY_len: (process.env.GC_SECRET_KEY || "").length,
                GC_REDIRECT_URL_len: (process.env.GC_REDIRECT_URL || "").length,
                GC_USER_LANGUAGE_len: (process.env.GC_USER_LANGUAGE || "").length,
            };
            json(res, 200, {
                vercel: process.env.VERCEL || null,
                vercel_env: process.env.VERCEL_ENV || null,
                node_env: process.env.NODE_ENV || null,
                provider_seen_by_server: provider,
                env_lengths: envLengths,
            });
            return [2 /*return*/];
        });
    });
}
function getActionFromUrl(url) {
    if (!url)
        return "";
    var path = url.replace(/^\/api\/bank\/?/, "").split("?")[0];
    return path.split("/")[0] || "";
}
export default function handler(req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var action;
        return __generator(this, function (_a) {
            action = getActionFromUrl(req.url);
            if (provider !== "real" && action !== "runtime-check") {
                if (isProd)
                    return [2 /*return*/, json(res, 400, { error: "Bank provider staat op mock; zet BANK_PROVIDER=real" })];
            }
            if (action === "institutions" && req.method === "POST")
                return [2 /*return*/, handleInstitutions(res)];
            if (action === "connect" && req.method === "POST")
                return [2 /*return*/, handleConnect(req, res)];
            if (action === "callback" && req.method === "GET")
                return [2 /*return*/, handleCallback(req, res)];
            if (action === "accounts" && req.method === "GET")
                return [2 /*return*/, handleAccounts(res)];
            if (action === "sync" && req.method === "POST")
                return [2 /*return*/, handleSync(req, res)];
            if (action === "disconnect" && req.method === "POST")
                return [2 /*return*/, handleDisconnect(req, res)];
            if (action === "health" && req.method === "GET")
                return [2 /*return*/, handleHealth(res)];
            if (action === "runtime-check" && req.method === "GET")
                return [2 /*return*/, handleRuntimeCheck(res)];
            res.status(404).json({ error: "Not found" });
            return [2 /*return*/];
        });
    });
}
