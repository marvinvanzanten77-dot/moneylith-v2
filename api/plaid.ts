/**
 * Consolidated Plaid API Endpoint
 * Handles all Plaid banking integrations:
 * - Link token creation for Plaid Link UI
 * - Token exchange (public → access token)
 * - Account retrieval
 * - Transaction retrieval for AI analysis
 * 
 * Query-based routing: plaid=create-link-token|exchange-token|accounts|transactions
 */

import { VercelRequest, VercelResponse } from "@vercel/node";
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

/**
 * Create Link Token
 * Generates a one-time link token for Plaid Link UI
 * Frontend uses this to initialize the bank login flow
 */
async function handleCreateLinkToken(req: VercelRequest, res: VercelResponse) {
  try {
    const { userId } = req.body || {};

    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId || `user-${Date.now()}`,
      },
      client_name: "Moneylith",
      products: [Products.Auth, Products.Transactions],
      country_codes: [CountryCode.Nl, CountryCode.Be],
      language: "nl",
      redirect_uri: process.env.PLAID_REDIRECT_URI || "https://moneylith-v2.vercel.app",
    });

    return res.status(200).json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error: any) {
    console.error("Link token creation error:", error.response?.data || error.message);
    return res.status(400).json({
      error: "link_token_failed",
      message: error.response?.data?.error_message || error.message,
    });
  }
}

/**
 * Exchange Token
 * Exchanges Plaid Link public token for long-lived access token
 * Called after user completes bank authentication in Plaid Link
 */
async function handleExchangeToken(req: VercelRequest, res: VercelResponse) {
  try {
    const { public_token } = req.body;

    if (!public_token) {
      return res.status(400).json({
        error: "invalid_request",
        message: "public_token required",
      });
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    return res.status(200).json({
      access_token: response.data.access_token,
      item_id: response.data.item_id,
    });
  } catch (error: any) {
    console.error("Token exchange error:", error.response?.data || error.message);
    return res.status(400).json({
      error: "token_exchange_failed",
      message: error.response?.data?.error_message || error.message,
    });
  }
}

/**
 * Fetch Accounts
 * Retrieves all linked bank accounts and their details
 * Used to populate account list and get account IDs for transactions
 */
async function handleAccounts(req: VercelRequest, res: VercelResponse) {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({
        error: "invalid_request",
        message: "access_token required",
      });
    }

    const response = await plaidClient.accountsGet({
      access_token,
    });

    // Transform Plaid accounts to simple format
    const accounts = response.data.accounts.map((account: any) => ({
      id: account.account_id,
      name: account.name,
      subtype: account.subtype,
      type: account.type,
      mask: account.mask,
      balances: {
        current: account.balances.current,
        available: account.balances.available,
        limit: account.balances.limit,
      },
    }));

    return res.status(200).json({
      accounts,
      item_id: response.data.item.item_id,
    });
  } catch (error: any) {
    console.error("Accounts fetch error:", error.response?.data || error.message);
    return res.status(400).json({
      error: "accounts_failed",
      message: error.response?.data?.error_message || error.message,
    });
  }
}

/**
 * Fetch Transactions
 * Retrieves transaction history for selected accounts
 * Used for AI-powered financial analysis
 */
async function handleTransactions(req: VercelRequest, res: VercelResponse) {
  try {
    const { access_token, start_date, end_date } = req.body;

    if (!access_token) {
      return res.status(400).json({
        error: "invalid_request",
        message: "access_token required",
      });
    }

    // Default to last 90 days if not specified
    const endDate = end_date || new Date().toISOString().split("T")[0];
    const startDate = start_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const response = await plaidClient.transactionsGet({
      access_token,
      start_date: startDate,
      end_date: endDate,
      options: {
        include_personal_finance_category: true,
      },
    });

    // Transform Plaid transactions to simple format
    const transactions = response.data.transactions.map((tx: any) => ({
      id: tx.transaction_id,
      date: tx.date,
      name: tx.merchant_name || tx.name,
      amount: Math.abs(tx.amount),
      currency: tx.iso_currency_code || "EUR",
      category: tx.personal_finance_category?.primary || tx.category?.[0] || "Other",
      type: tx.amount > 0 ? "income" : "expense",
      account_id: tx.account_id,
      merchant_id: tx.merchant_name ? tx.merchant_name.toLowerCase().replace(/\s+/g, "_") : null,
    }));

    return res.status(200).json({
      transactions,
      total_transactions: response.data.total_transactions,
      has_more: response.data.transactions.length < response.data.total_transactions,
    });
  } catch (error: any) {
    console.error("Transactions fetch error:", error.response?.data || error.message);
    return res.status(400).json({
      error: "transactions_failed",
      message: error.response?.data?.error_message || error.message,
    });
  }
}

/**
 * Main handler with query-based routing
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Check environment variables
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    return res.status(500).json({
      error: "configuration_error",
      message: "Plaid credentials not configured",
    });
  }

  // Route based on query parameter
  const { plaid } = req.query;

  switch (plaid) {
    case "create-link-token":
      return await handleCreateLinkToken(req, res);
    case "exchange-token":
      return await handleExchangeToken(req, res);
    case "accounts":
      return await handleAccounts(req, res);
    case "transactions":
      return await handleTransactions(req, res);
    default:
      return res.status(404).json({
        error: "not_found",
        message: `Unknown Plaid action: ${plaid}. Valid options: create-link-token, exchange-token, accounts, transactions`,
      });
  }
}
