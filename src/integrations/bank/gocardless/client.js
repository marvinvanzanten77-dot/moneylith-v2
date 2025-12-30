import fetch from "node-fetch";

const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";

export async function request(path, { method = "GET", headers = {}, body } = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    /* ignore */
  }
  if (!res.ok) {
    const err = new Error(`GoCardless API error ${res.status}: ${data?.summary || text || "unknown"}`);
    err.status = res.status;
    err.body = data || text;
    throw err;
  }
  return data;
}
