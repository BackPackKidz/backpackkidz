export const sponsorshipFields = [
  "id",
  "submittedAt",
  "sponsorName",
  "organizationName",
  "email",
  "phone",
  "numberOfChildren",
  "totalAmount",
  "paymentMethod",
  "message",
  "isAnonymous",
];

// One child is fed for a full school year for $160.
export const COST_PER_CHILD = 160;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const singleLine = (value, maxLength = 180) =>
  String(value ?? "")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const multiLine = (value, maxLength = 900) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
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

export const parseChildCount = (value) => {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  const count = Number(normalized);

  if (!Number.isInteger(count)) {
    return Number.NaN;
  }

  return count;
};

export const normalizeSponsorshipPayload = (payload = {}) => {
  const numberOfChildren = parseChildCount(payload.numberOfChildren);

  return {
    sponsorName: singleLine(payload.sponsorName, 160),
    organizationName: singleLine(payload.organizationName, 180),
    email: singleLine(payload.email, 180).toLowerCase(),
    phone: singleLine(payload.phone, 60),
    numberOfChildren,
    totalAmount: Number.isFinite(numberOfChildren)
      ? numberOfChildren * COST_PER_CHILD
      : Number.NaN,
    paymentMethod: singleLine(payload.paymentMethod, 40),
    message: multiLine(payload.message, 900),
    isAnonymous: toBoolean(payload.isAnonymous),
  };
};

export const validateSponsorshipPayload = (payload) => {
  const fields = [];

  if (!payload.sponsorName) {
    fields.push("sponsorName");
  }

  if (!payload.email || !EMAIL_PATTERN.test(payload.email)) {
    fields.push("email");
  }

  if (!Number.isInteger(payload.numberOfChildren) || payload.numberOfChildren < 1) {
    fields.push("numberOfChildren");
  }

  return fields;
};

export const createSponsorshipRecord = (input, now = new Date()) => {
  const payload = normalizeSponsorshipPayload(input);
  const fields = validateSponsorshipPayload(payload);

  if (fields.length > 0) {
    return {
      error: "Sponsorship submission is missing required information.",
      fields,
    };
  }

  return {
    record: {
      id: crypto.randomUUID(),
      submittedAt: now.toISOString(),
      ...payload,
    },
  };
};
