import { getStore } from "@netlify/blobs";
import { createContactRecord } from "../contact-utils.mjs";
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

  const result = createContactRecord(body);

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
  const store = getStore("contacts");

  try {
    await store.set(record.id, JSON.stringify(record));
  } catch (error) {
    console.error("Contact record save failed:", error);
    return jsonResponse({ error: "Failed to save contact message." }, 500);
  }

  // Fail-soft: the record is already saved; a failed email only logs.
  await sendNotificationEmail({
    recordType: "contact",
    subject: `New contact message from ${record.name}`,
    record,
  });

  return jsonResponse({ success: true });
};

export const config = {
  path: "/api/contacts",
};
