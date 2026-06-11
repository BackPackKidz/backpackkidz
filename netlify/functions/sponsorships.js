import { getStore } from "@netlify/blobs";
import { createSponsorshipRecord } from "../sponsorship-utils.mjs";
import { sendNotificationEmail } from "../email-utils.mjs";

const jsonResponse = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

export default async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        error: "Request body must be valid JSON.",
        fields: [],
      },
      400
    );
  }

  const result = createSponsorshipRecord(body);

  if (result.error) {
    return jsonResponse(
      {
        error: result.error,
        fields: result.fields,
      },
      400
    );
  }

  const { record } = result;
  const store = getStore("sponsorships");

  try {
    await store.set(record.id, JSON.stringify(record));
  } catch (error) {
    console.error("Sponsorship record save failed:", error);
    return jsonResponse({ error: "Failed to save sponsorship." }, 500);
  }

  // Fail-soft: the record is already saved; a failed email only logs.
  await sendNotificationEmail({
    recordType: "sponsorship",
    subject: `New sponsorship request from ${
      record.sponsorName || record.organizationName
    }`,
    record,
  });

  return jsonResponse({ success: true });
};

export const config = {
  path: "/api/sponsorships",
};
