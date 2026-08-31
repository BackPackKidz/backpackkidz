export const requiredGoogleSheetsEnvVars = [
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
];

export const missingEnvVars = (names, env = process.env) =>
  names.filter((name) => !env[name]);

export const getGooglePrivateKey = (env = process.env) =>
  env.GOOGLE_PRIVATE_KEY ? env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n") : "";

export const googleSheetsConfigStatus = (env = process.env) => {
  const missing = missingEnvVars(requiredGoogleSheetsEnvVars, env);

  return {
    configured: missing.length === 0,
    missing,
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID || "",
    serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
    privateKey: getGooglePrivateKey(env),
    tab: env.GOOGLE_SHEETS_TAB || "Donations",
  };
};

export const paypalBusiness = (env = process.env) => env.PAYPAL_BUSINESS || "";

export const paypalExpectedReceiver = (env = process.env) =>
  env.PAYPAL_RECEIVER_EMAIL || paypalBusiness(env);
