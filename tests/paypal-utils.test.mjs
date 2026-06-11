import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPaypalDonationUrl,
  DEFAULT_HOSTED_DONATE_URL,
  DEFAULT_NOTIFY_URL,
} from "../netlify/paypal-utils.mjs";

const record = { id: "abc-123", amount: 25.5 };

test("falls back to the hosted donate button with amount and donation ID", () => {
  const url = new URL(buildPaypalDonationUrl(record, {}));

  assert.equal(url.origin + url.pathname, "https://www.paypal.com/donate/");
  assert.equal(url.searchParams.get("hosted_button_id"), "VSXH3DH6PUFH2");
  assert.equal(url.searchParams.get("amount"), "25.50");
  assert.equal(url.searchParams.get("custom"), "abc-123");
});

test("builds a classic donations URL when PAYPAL_BUSINESS is set", () => {
  const url = new URL(
    buildPaypalDonationUrl(record, { PAYPAL_BUSINESS: "pay@backpackkidz.com" })
  );

  assert.equal(url.host, "www.paypal.com");
  assert.equal(url.pathname, "/cgi-bin/webscr");
  assert.equal(url.searchParams.get("cmd"), "_donations");
  assert.equal(url.searchParams.get("business"), "pay@backpackkidz.com");
  assert.equal(url.searchParams.get("amount"), "25.50");
  assert.equal(url.searchParams.get("custom"), "abc-123");
  assert.equal(url.searchParams.get("currency_code"), "USD");
  assert.equal(url.searchParams.get("notify_url"), DEFAULT_NOTIFY_URL);
});

test("uses the sandbox host and notify_url override when configured", () => {
  const url = new URL(
    buildPaypalDonationUrl(record, {
      PAYPAL_BUSINESS: "pay@backpackkidz.com",
      PAYPAL_ENV: "sandbox",
      PAYPAL_NOTIFY_URL: "https://example.com/ipn",
    })
  );

  assert.equal(url.host, "www.sandbox.paypal.com");
  assert.equal(url.searchParams.get("notify_url"), "https://example.com/ipn");
});

test("default hosted URL preserves the existing hosted button ID", () => {
  assert.match(DEFAULT_HOSTED_DONATE_URL, /hosted_button_id=VSXH3DH6PUFH2/);
});
