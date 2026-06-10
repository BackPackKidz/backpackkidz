// Exports all contact / general inquiry records as a CSV download.
//
// Environment variable required:
//   CONTACTS_EXPORT_TOKEN — secret token that authorizes this export.
//     Follows the same pattern as DONATIONS_EXPORT_TOKEN. Provide it either as
//     an "Authorization: Bearer <token>" header or a ?token=<token> query
//     parameter. Returns 503 when unset and 401 when missing or incorrect.

import { getStore } from "@netlify/blobs";
import { recordsToCsv } from "../csv-utils.mjs";
import { contactFields } from "../contact-utils.mjs";

const unauthorized = () =>
  Response.json(
    { error: "A valid contacts export token is required." },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );

const getBearerToken = (request) => {
  const authorization = request.headers.get("authorization") || "";

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return "";
};

export default async (request) => {
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const expectedToken = process.env.CONTACTS_EXPORT_TOKEN;

  if (!expectedToken) {
    console.warn("Contact export unavailable: CONTACTS_EXPORT_TOKEN is not configured.");
    return Response.json(
      { error: "Contact export is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token") || "";
  const bearerToken = getBearerToken(request);
  const providedToken = bearerToken || queryToken;
  if (providedToken !== expectedToken) {
    return unauthorized();
  }

  const store = getStore("contacts");

  try {
    const { blobs } = await store.list();
    const records = (
      await Promise.all(
        blobs.map((blob) => store.get(blob.key, { type: "json" }))
      )
    )
      .filter(Boolean)
      .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));

    const csv = recordsToCsv(records, contactFields);
    const filename = `backpack-kidz-contacts-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Contact export failed:", error);
    return Response.json(
      { error: "Contact records could not be exported." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
};

export const config = {
  path: "/api/contacts/export",
};
