export const donationFields = [
  "id",
  "submittedAt",
  "donorType",
  "amount",
  "donorName",
  "organizationName",
  "email",
  "phone",
  "mailingAddress",
  "city",
  "state",
  "zip",
  "sourceCampaign",
  "inHonorMemory",
  "honorType",
  "honoreeName",
  "honorMessage",
  // Bookkeeping fields: a record starts "Pending" and is flipped to
  // "Completed" by the PayPal IPN function once payment is verified.
  "status",
  "paypalTxnId",
  "paidAmount",
  "payerEmail",
  "completedAt",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const singleLine = (value, maxLength = 180) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const multiLine = (value, maxLength = 900) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);

export const toBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
};

export const parseDonationAmount = (value) => {
  const normalized = String(value ?? "").replace(/[$,]/g, "").trim();
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    return Number.NaN;
  }

  return Math.round(amount * 100) / 100;
};

export const normalizeDonationPayload = (payload = {}) => ({
  donorType: singleLine(payload.donorType, 40),
  amount: parseDonationAmount(payload.amount),
  donorName: singleLine(payload.donorName, 160),
  organizationName: singleLine(payload.organizationName, 180),
  email: singleLine(payload.email, 180).toLowerCase(),
  phone: singleLine(payload.phone, 60),
  mailingAddress: singleLine(payload.mailingAddress, 220),
  city: singleLine(payload.city, 90),
  state: singleLine(payload.state, 40),
  zip: singleLine(payload.zip, 24),
  sourceCampaign: singleLine(payload.sourceCampaign, 140) || "Website Donation",
  inHonorMemory: toBoolean(payload.inHonorMemory),
  honorType: singleLine(payload.honorType, 40) || "in honor of",
  honoreeName: singleLine(payload.honoreeName, 160),
  honorMessage: multiLine(payload.honorMessage, 900),
});

export const validateDonationPayload = (payload) => {
  const fields = [];

  if (!payload.donorType) {
    fields.push("donorType");
  }

  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    fields.push("amount");
  }

  if (!payload.donorName && !payload.organizationName) {
    fields.push("donorName", "organizationName");
  }

  if (payload.email && !EMAIL_PATTERN.test(payload.email)) {
    fields.push("email");
  }

  if (payload.inHonorMemory && !payload.honoreeName) {
    fields.push("honoreeName");
  }

  return fields;
};

export const createDonationRecord = (input, now = new Date()) => {
  const payload = normalizeDonationPayload(input);
  const fields = validateDonationPayload(payload);

  if (fields.length > 0) {
    return {
      error: "Donation submission is missing required information.",
      fields,
    };
  }

  return {
    record: {
      id: crypto.randomUUID(),
      submittedAt: now.toISOString(),
      ...payload,
      status: "Pending",
      paypalTxnId: "",
      paidAmount: "",
      payerEmail: "",
      completedAt: "",
    },
  };
};

/* One-line "in honor of" summary for bookkeeping rows and emails,
   e.g. "in memory of A Kind Teacher — Thank you." */
export const donationHonorSummary = (record) => {
  if (!record?.inHonorMemory || !record.honoreeName) {
    return "";
  }

  const summary = `${record.honorType || "in honor of"} ${record.honoreeName}`;

  return record.honorMessage ? `${summary} — ${record.honorMessage}` : summary;
};

const escapeCsvValue = (value) => {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

export const recordsToCsv = (records) => {
  const rows = records.map((record) =>
    donationFields.map((field) => escapeCsvValue(record?.[field])).join(",")
  );

  return [donationFields.join(","), ...rows].join("\n");
};
