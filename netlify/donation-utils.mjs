export const DEFAULT_PAYPAL_DONATION_URL =
  "https://www.paypal.com/donate/?hosted_button_id=VSXH3DH6PUFH2";

export const ALLOWED_DONOR_TYPES = new Set([
  "Individual",
  "Business",
  "Church",
  "Organization",
  "Other",
]);

export const ALLOWED_HONOR_TYPES = new Set(["in honor of", "in memory of"]);

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

const hasAddress = (payload) =>
  Boolean(payload.address || payload.city || payload.state || payload.zip);

export const normalizeDonationPayload = (payload = {}) => {
  const donorType = singleLine(payload.donor_type, 40);
  const donorName = singleLine(payload.donor_name, 160);
  const businessName = singleLine(payload.business_or_organization_name, 180);
  const email = singleLine(payload.email, 180).toLowerCase();
  const amount = parseDonationAmount(payload.amount);
  const inHonorEnabled = toBoolean(payload.in_honor_enabled);
  const honorType = singleLine(payload.honor_type, 40) || "in honor of";
  const wantsThankYouGiftOrCard = toBoolean(payload.wants_thank_you_gift_or_card);

  const normalized = {
    donor_type: donorType,
    donor_name: donorName,
    business_or_organization_name: businessName,
    email,
    phone: singleLine(payload.phone, 60),
    address: singleLine(payload.address, 220),
    city: singleLine(payload.city, 90),
    state: singleLine(payload.state, 40),
    zip: singleLine(payload.zip, 24),
    public_recognition_allowed: toBoolean(payload.public_recognition_allowed),
    wants_thank_you_gift_or_card: wantsThankYouGiftOrCard,
    amount,
    source_campaign: singleLine(payload.source_campaign, 140) || "Website Donation",
    notes: multiLine(payload.notes, 900),
    in_honor_enabled: inHonorEnabled,
    honor_type: honorType,
    honoree_name: singleLine(payload.honoree_name, 160),
    honor_message: multiLine(payload.honor_message, 900),
  };

  return normalized;
};

export const validateDonationPayload = (payload) => {
  const errors = [];

  if (!ALLOWED_DONOR_TYPES.has(payload.donor_type)) {
    errors.push({
      field: "donor_type",
      message: "Choose a donor type.",
    });
  }

  if (!payload.donor_name && !payload.business_or_organization_name) {
    errors.push({
      field: "donor_name",
      message: "Enter a name or business/organization name.",
    });
  }

  if (!EMAIL_PATTERN.test(payload.email)) {
    errors.push({
      field: "email",
      message: "Enter a valid email address.",
    });
  }

  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    errors.push({
      field: "amount",
      message: "Enter a donation amount greater than 0.",
    });
  }

  if (payload.in_honor_enabled) {
    if (!ALLOWED_HONOR_TYPES.has(payload.honor_type)) {
      errors.push({
        field: "honor_type",
        message: "Choose whether this is in honor of or in memory of someone.",
      });
    }

    if (!payload.honoree_name) {
      errors.push({
        field: "honoree_name",
        message: "Enter the honoree name.",
      });
    }
  }

  return errors;
};

export const createDonationRecord = (input, now = new Date()) => {
  const payload = normalizeDonationPayload(input);
  const errors = validateDonationPayload(payload);

  if (errors.length > 0) {
    return { errors };
  }

  const createdAt = now.toISOString();
  const donorId = crypto.randomUUID();
  const donationId = crypto.randomUUID();
  const recordId = crypto.randomUUID();
  const needsMailedThanks = payload.wants_thank_you_gift_or_card && hasAddress(payload);

  return {
    record: {
      id: recordId,
      donor: {
        id: donorId,
        donor_type: payload.donor_type,
        donor_name: payload.donor_name,
        business_or_organization_name: payload.business_or_organization_name,
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        zip: payload.zip,
        public_recognition_allowed: payload.public_recognition_allowed,
        wants_thank_you_gift_or_card: payload.wants_thank_you_gift_or_card,
        created_at: createdAt,
      },
      donation: {
        id: donationId,
        donor_id: donorId,
        amount: payload.amount,
        donation_type: "Website Donation",
        source_campaign: payload.source_campaign,
        payment_provider: "PayPal",
        payment_status: "pending_payment",
        transaction_id: null,
        donation_date: createdAt,
        created_at: createdAt,
        notes: payload.notes,
      },
      honor_message: {
        in_honor_enabled: payload.in_honor_enabled,
        honor_type: payload.in_honor_enabled ? payload.honor_type : "",
        honoree_name: payload.in_honor_enabled ? payload.honoree_name : "",
        honor_message: payload.in_honor_enabled ? payload.honor_message : "",
      },
      thank_you_tracking: {
        thank_you_email_sent: false,
        thank_you_card_needed: needsMailedThanks,
        thank_you_card_sent: false,
        thank_you_gift_needed: payload.wants_thank_you_gift_or_card,
        thank_you_gift_sent: false,
        follow_up_status: "new",
        internal_notes: "",
      },
      created_at: createdAt,
    },
  };
};

export const donationStorageKey = (record) => {
  const date = record.created_at.slice(0, 10);
  return `donations/${date}/${record.donation.id}.json`;
};

export const getDonorDisplayName = (record) => {
  const donorName = record?.donor?.donor_name || "";
  const businessName = record?.donor?.business_or_organization_name || "";

  if (donorName && businessName) {
    return `${donorName} (${businessName})`;
  }

  return donorName || businessName || "Backpack Kidz donor";
};

export const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));

export const csvHeaders = [
  "donation_id",
  "donor_id",
  "donor_type",
  "donor_name",
  "business_or_organization_name",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "zip",
  "amount",
  "donation_date",
  "source_campaign",
  "payment_provider",
  "payment_status",
  "transaction_id",
  "in_honor_enabled",
  "honor_type",
  "honoree_name",
  "honor_message",
  "public_recognition_allowed",
  "wants_thank_you_gift_or_card",
  "thank_you_email_sent",
  "thank_you_card_needed",
  "thank_you_card_sent",
  "thank_you_gift_needed",
  "thank_you_gift_sent",
  "follow_up_status",
  "internal_notes",
  "created_at",
];

export const flattenDonationRecord = (record) => ({
  donation_id: record?.donation?.id || "",
  donor_id: record?.donor?.id || "",
  donor_type: record?.donor?.donor_type || "",
  donor_name: record?.donor?.donor_name || "",
  business_or_organization_name: record?.donor?.business_or_organization_name || "",
  email: record?.donor?.email || "",
  phone: record?.donor?.phone || "",
  address: record?.donor?.address || "",
  city: record?.donor?.city || "",
  state: record?.donor?.state || "",
  zip: record?.donor?.zip || "",
  amount: record?.donation?.amount || "",
  donation_date: record?.donation?.donation_date || "",
  source_campaign: record?.donation?.source_campaign || "",
  payment_provider: record?.donation?.payment_provider || "",
  payment_status: record?.donation?.payment_status || "",
  transaction_id: record?.donation?.transaction_id || "",
  in_honor_enabled: record?.honor_message?.in_honor_enabled || false,
  honor_type: record?.honor_message?.honor_type || "",
  honoree_name: record?.honor_message?.honoree_name || "",
  honor_message: record?.honor_message?.honor_message || "",
  public_recognition_allowed: record?.donor?.public_recognition_allowed || false,
  wants_thank_you_gift_or_card: record?.donor?.wants_thank_you_gift_or_card || false,
  thank_you_email_sent: record?.thank_you_tracking?.thank_you_email_sent || false,
  thank_you_card_needed: record?.thank_you_tracking?.thank_you_card_needed || false,
  thank_you_card_sent: record?.thank_you_tracking?.thank_you_card_sent || false,
  thank_you_gift_needed: record?.thank_you_tracking?.thank_you_gift_needed || false,
  thank_you_gift_sent: record?.thank_you_tracking?.thank_you_gift_sent || false,
  follow_up_status: record?.thank_you_tracking?.follow_up_status || "",
  internal_notes: record?.thank_you_tracking?.internal_notes || "",
  created_at: record?.created_at || "",
});

const escapeCsvValue = (value) => {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

export const recordsToCsv = (records) => {
  const rows = records.map((record) => {
    const flat = flattenDonationRecord(record);
    return csvHeaders.map((header) => escapeCsvValue(flat[header])).join(",");
  });

  return [csvHeaders.join(","), ...rows].join("\n");
};
