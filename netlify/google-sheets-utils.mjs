import crypto from "node:crypto";

/*
  Google Sheets bookkeeping for donations.

  Flow:
    1. When a donor saves the optional donation form, a "Pending" row is
       appended (appendPendingDonationRow).
    2. When PayPal confirms payment via IPN, the matching row is flipped to
       "Completed" with the transaction details (markDonationCompletedInSheet).
    3. Confirmed payments that have no matching pending row (e.g. donors who
       used the direct PayPal button) are appended as their own row so the
       books stay complete (appendUnmatchedCompletedRow).

  Every caller treats these helpers as fail-soft: a Sheets outage or missing
  configuration must never break a donation, so callers wrap them in
  try/catch and the helpers return false when not configured.

  Required environment variables (Netlify dashboard):
    GOOGLE_SHEETS_SPREADSHEET_ID  - the ID from the sheet's URL
    GOOGLE_SERVICE_ACCOUNT_EMAIL  - e.g. bookkeeper@project.iam.gserviceaccount.com
    GOOGLE_PRIVATE_KEY            - the service account's private key; paste the
                                    whole PEM, "\n" escapes are handled
  Optional:
    GOOGLE_SHEETS_TAB             - tab name, default "Donations"

  Setup: create a Google Cloud service account with the Sheets API enabled,
  then share the spreadsheet with the service account email as an Editor.
*/

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export const DONATION_SHEET_HEADERS = [
  "Donation ID",
  "Created At",
  "Donor Name",
  "Donor Email",
  "Intended Amount",
  "Status",
  "In Honor Of",
  "PayPal Transaction ID",
  "Paid Amount",
  "Payer Email",
  "Completed At",
];

const spreadsheetId = () => process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const sheetTab = () => process.env.GOOGLE_SHEETS_TAB || "Donations";

export const isSheetsConfigured = () =>
  Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY
  );

/* Exchange a self-signed service-account JWT for a short-lived access token.
   This avoids pulling in the (very large) googleapis package. */
const getAccessToken = async () => {
  const now = Math.floor(Date.now() / 1000);
  const encode = (part) => Buffer.from(JSON.stringify(part)).toString("base64url");

  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;

  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(privateKey)
    .toString("base64url");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token request failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()).access_token;
};

const sheetsRequest = async (token, pathAndQuery, options = {}) => {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId()}/${pathAndQuery}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Google Sheets request failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
};

const range = (a1) => `values/${encodeURIComponent(`${sheetTab()}!${a1}`)}`;

/* Write the header row once, so the sheet is readable even if the owner
   starts from a completely blank spreadsheet. */
const ensureHeaderRow = async (token) => {
  const existing = await sheetsRequest(token, range("A1:A1"));

  if (!existing.values || existing.values.length === 0) {
    await sheetsRequest(token, `${range("A1:K1")}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [DONATION_SHEET_HEADERS] }),
    });
  }
};

const appendRow = async (token, row) => {
  await sheetsRequest(
    token,
    `${range("A:K")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [row] }) }
  );
};

/* Step 1: pending row, written before the donor is sent to PayPal. */
export const appendPendingDonationRow = async (record, honorSummary = "") => {
  if (!isSheetsConfigured()) {
    console.warn("Google Sheets bookkeeping skipped: spreadsheet credentials are not configured.");
    return false;
  }

  const token = await getAccessToken();
  await ensureHeaderRow(token);
  await appendRow(token, [
    record.id,
    record.submittedAt,
    record.donorName || record.organizationName || "",
    record.email || "",
    record.amount,
    "Pending",
    honorSummary,
    "", // PayPal transaction ID — blank until IPN confirms
    "", // paid amount
    "", // payer email
    "", // completed at
  ]);

  return true;
};

/* Step 2: flip the matching pending row to Completed after IPN verification.
   Returns false when the donation ID isn't found so the caller can fall back
   to appending a standalone row. */
export const markDonationCompletedInSheet = async ({
  donationId,
  txnId,
  paidAmount,
  payerEmail,
  completedAt,
}) => {
  if (!isSheetsConfigured()) {
    console.warn("Google Sheets bookkeeping skipped: spreadsheet credentials are not configured.");
    return false;
  }

  const token = await getAccessToken();
  const idColumn = await sheetsRequest(token, range("A:A"));
  const rowIndex = (idColumn.values || []).findIndex((row) => row[0] === donationId);

  if (rowIndex === -1) {
    return false;
  }

  const rowNumber = rowIndex + 1; // Sheets rows are 1-based

  // Two targeted updates so the In Honor Of column (G) is left untouched.
  await sheetsRequest(token, `${range(`F${rowNumber}`)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values: [["Completed"]] }),
  });
  await sheetsRequest(token, `${range(`H${rowNumber}:K${rowNumber}`)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values: [[txnId, paidAmount, payerEmail, completedAt]] }),
  });

  return true;
};

/* Step 3: confirmed payments with no pending row (direct PayPal button,
   or a pending row that could not be found) still get recorded. */
export const appendUnmatchedCompletedRow = async ({
  donationId = "",
  txnId,
  paidAmount,
  payerEmail,
  payerName,
  completedAt,
}) => {
  if (!isSheetsConfigured()) {
    console.warn("Google Sheets bookkeeping skipped: spreadsheet credentials are not configured.");
    return false;
  }

  const token = await getAccessToken();
  await ensureHeaderRow(token);
  await appendRow(token, [
    donationId,
    completedAt,
    payerName || "",
    payerEmail || "",
    paidAmount,
    "Completed (no pending record)",
    "",
    txnId,
    paidAmount,
    payerEmail || "",
    completedAt,
  ]);

  return true;
};
