export const partnerFields = [
  "id",
  "submittedAt",
  "organizationName",
  "contactName",
  "title",
  "email",
  "phone",
  "website",
  "partnershipType",
  "proposedContribution",
  "message",
];

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

export const normalizePartnerPayload = (payload = {}) => ({
  organizationName: singleLine(payload.organizationName, 180),
  contactName: singleLine(payload.contactName, 160),
  title: singleLine(payload.title, 120),
  email: singleLine(payload.email, 180).toLowerCase(),
  phone: singleLine(payload.phone, 60),
  website: singleLine(payload.website, 220),
  partnershipType: singleLine(payload.partnershipType, 60),
  proposedContribution: multiLine(payload.proposedContribution, 900),
  message: multiLine(payload.message, 900),
});

export const validatePartnerPayload = (payload) => {
  const fields = [];

  if (!payload.organizationName) {
    fields.push("organizationName");
  }

  if (!payload.contactName) {
    fields.push("contactName");
  }

  if (!payload.email || !EMAIL_PATTERN.test(payload.email)) {
    fields.push("email");
  }

  return fields;
};

export const createPartnerRecord = (input, now = new Date()) => {
  const payload = normalizePartnerPayload(input);
  const fields = validatePartnerPayload(payload);

  if (fields.length > 0) {
    return {
      error: "Partner submission is missing required information.",
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
