import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Environment variables validation for production
 * Ensures all required config is present before app runs
 */

interface EnvCheckResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

const REQUIRED_ENV_VARS = [
  "TRUELAYER_CLIENT_ID",
  "TRUELAYER_CLIENT_SECRET",
  "TRUELAYER_REDIRECT_URI",
  "TRUELAYER_ENV",
];

const OPTIONAL_ENV_VARS = [
  "OPENAI_API_KEY", // Optional for some deployments
];

/**
 * Check if all required environment variables are set
 * @returns EnvCheckResult with status and any missing/invalid values
 */
export function validateEnvironment(): EnvCheckResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    
    if (!value || value.trim() === "") {
      missing.push(varName);
    }
    
    // Specific validations
    if (varName === "TRUELAYER_ENV" && value && !["sandbox", "production"].includes(value)) {
      missing.push(`${varName}: must be 'sandbox' or 'production', got '${value}'`);
    }
    
    if (varName === "TRUELAYER_REDIRECT_URI" && value && !value.startsWith("https://")) {
      warnings.push(`${varName}: should use HTTPS, got '${value}'`);
    }
  }

  // Check optional variables
  for (const varName of OPTIONAL_ENV_VARS) {
    if (!process.env[varName]) {
      warnings.push(`${varName}: optional but not set (some features may be limited)`);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Middleware to validate environment on API startup
 * Use this in your API endpoints that depend on TrueLayer/OpenAI
 */
export function requireValidEnvironment(req: VercelRequest, res: VercelResponse): boolean {
  const check = validateEnvironment();

  if (!check.ok) {
    console.error("❌ Environment validation failed:", check.missing);
    res.status(500).json({
      error: "Server configuration error",
      details: process.env.NODE_ENV === "development" ? check.missing : "Contact support",
      code: "ENV_VALIDATION_FAILED",
    });
    return false;
  }

  if (check.warnings.length > 0) {
    console.warn("⚠️ Environment warnings:", check.warnings);
  }

  return true;
}

/**
 * Log environment status (safe - only logs variable existence, not values)
 */
export function logEnvironmentStatus(): void {
  console.log("📋 Environment Status:");
  console.log(`  TRUELAYER_ENV: ${process.env.TRUELAYER_ENV || "❌ NOT SET"}`);
  console.log(`  TRUELAYER_CLIENT_ID: ${process.env.TRUELAYER_CLIENT_ID ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`  TRUELAYER_CLIENT_SECRET: ${process.env.TRUELAYER_CLIENT_SECRET ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`  TRUELAYER_REDIRECT_URI: ${process.env.TRUELAYER_REDIRECT_URI ? "✅ SET" : "❌ NOT SET"}`);
  console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "✅ SET" : "⚠️ NOT SET"}`);
}
