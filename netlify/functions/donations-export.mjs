import { getStore } from "@netlify/blobs";
import { recordsToCsv } from "../donation-utils.mjs";

const unauthorized = () =>
  Response.json(
    { error: "A valid donations export token is required." },
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

  const expectedToken = process.env.DONATIONS_EXPORT_TOKEN;

  if (!expectedToken) {
    console.warn("Donation export unavailable: DONATIONS_EXPORT_TOKEN is not configured.");
    return Response.json(
      { error: "Donation export is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (getBearerToken(request) !== expectedToken) {
    return unauthorized();
  }

  const store = getStore("donations");

  try {
    const { blobs } = await store.list();
    const records = (
      await Promise.all(
        blobs.map((blob) => store.get(blob.key, { type: "json" }))
      )
    )
      .filter(Boolean)
      .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));

    const csv = recordsToCsv(records);
    const filename = `backpack-kidz-donations-${new Date()
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
    console.error("Donation export failed:", error);
    return Response.json(
      { error: "Donation records could not be exported." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
};

export const config = {
  path: "/api/donations/export",
};
