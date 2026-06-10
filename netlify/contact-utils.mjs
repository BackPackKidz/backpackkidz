export const contactFields = [
  "id",
  "submittedAt",
  "name",
  "email",
  "phone",
  "subject",
  "message",
  "preferredContact",
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

export const normalizeContactPayload = (payload = {}) => ({
  name: singleLine(payload.name, 160),
  email: singleLine(payload.email, 180).toLowerCase(),
  phone: singleLine(payload.phone, 60),
  subject: singleLine(payload.subject, 60),
  message: multiLine(payload.message, 1500),
  preferredContact: singleLine(payload.preferredContact, 40),
});

export const validateContactPayload = (payload) => {
  const fields = [];

  if (!payload.name) {
    fields.push("name");
  }

  if (!payload.email || !EMAIL_PATTERN.test(payload.email)) {
    fields.push("email");
  }

  if (!payload.message) {
    fields.push("message");
  }

  return fields;
};

export const createContactRecord = (input, now = new Date()) => {
  const payload = normalizeContactPayload(input);
  const fields = validateContactPayload(payload);

  if (fields.length > 0) {
    return {
      error: "Contact submission is missing required information.",
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
