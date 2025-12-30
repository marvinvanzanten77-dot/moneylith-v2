import { request } from "./client.js";
import { getAccessToken } from "./auth.js";

const defaultHeaders = async () => ({
  Authorization: `Bearer ${await getAccessToken()}`,
});

export async function listInstitutions(countryCode = "NL") {
  return request(`/institutions/?country=${countryCode}`, { headers: await defaultHeaders() });
}

export async function createAgreement(institutionId, daysHistory = 90, validDays = 90) {
  const payload = {
    institution_id: institutionId,
    max_historical_days: daysHistory,
    access_valid_for: validDays,
  };
  return request("/agreements/enduser/", {
    method: "POST",
    headers: await defaultHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function createRequisition(institutionId, agreementId, redirectUrl, reference) {
  const payload = {
    institution_id: institutionId,
    agreement: agreementId,
    redirect: redirectUrl,
    reference: reference || `moneylith-${Date.now()}`,
    user_language: process.env.GC_USER_LANGUAGE || "nl",
  };
  return request("/requisitions/", {
    method: "POST",
    headers: await defaultHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getRequisition(id) {
  return request(`/requisitions/${id}/`, { headers: await defaultHeaders() });
}

export async function getAccountDetails(accountId) {
  return request(`/accounts/${accountId}/`, { headers: await defaultHeaders() });
}

export async function getTransactions(accountId, dateFrom) {
  const url = dateFrom ? `/accounts/${accountId}/transactions/?date_from=${dateFrom}` : `/accounts/${accountId}/transactions/`;
  return request(url, { headers: await defaultHeaders() });
}

export async function getBalances(accountId) {
  return request(`/accounts/${accountId}/balances/`, { headers: await defaultHeaders() });
}

export async function deleteRequisition(id) {
  try {
    await request(`/requisitions/${id}/`, { method: "DELETE", headers: await defaultHeaders() });
  } catch (err) {
    // ignore delete errors
  }
}
