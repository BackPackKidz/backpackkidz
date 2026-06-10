export const volunteerFields = [
  "id",
  "submittedAt",
  "firstName",
  "lastName",
  "email",
  "phone",
  "availability",
  "interests",
  "experience",
  "howDidYouHear",
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

const fromList = (value, maxLength = 180) =>
  Array.isArray(value)
    ? singleLine(value.join("; "), maxLength)
    : singleLine(value, maxLength);

export const normalizeVolunteerPayload = (payload = {}) => ({
  firstName: singleLine(payload.firstName, 120),
  lastName: singleLine(payload.lastName, 120),
  email: singleLine(payload.email, 180).toLowerCase(),
  phone: singleLine(payload.phone, 60),
  availability: singleLine(payload.availability, 60),
  interests: fromList(payload.interests, 220),
  experience: multiLine(payload.experience, 900),
  howDidYouHear: singleLine(payload.howDidYouHear, 180),
});

export const validateVolunteerPayload = (payload) => {
  const fields = [];

  if (!payload.firstName) {
    fields.push("firstName");
  }

  if (!payload.lastName) {
    fields.push("lastName");
  }

  if (!payload.email || !EMAIL_PATTERN.test(payload.email)) {
    fields.push("email");
  }

  return fields;
};

export const createVolunteerRecord = (input, now = new Date()) => {
  const payload = normalizeVolunteerPayload(input);
  const fields = validateVolunteerPayload(payload);

  if (fields.length > 0) {
    return {
      error: "Volunteer submission is missing required information.",
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
