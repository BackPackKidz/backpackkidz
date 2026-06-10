import { getStore } from "@netlify/blobs";
import { createDonationRecord } from "../donation-utils.mjs";

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

  const result = createDonationRecord(body);

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
  const store = getStore("donations");

  try {
    await store.set(record.id, JSON.stringify(record));
  } catch (error) {
    console.error("Donation record save failed:", error);
    return jsonResponse({ error: "Failed to save donation." }, 500);
  }

  return jsonResponse({ success: true });
};

export const config = {
  path: "/api/donations",
};
