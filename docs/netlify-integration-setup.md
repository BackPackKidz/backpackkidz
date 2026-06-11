# Netlify Integration Setup

This guide covers the private owner setup needed for Back Pack Kidz form email notifications, Google Sheets donation bookkeeping, PayPal IPN matching, and remaining credibility content. Do not paste real passwords, private keys, app passwords, tokens, or donor-sensitive data into source code, documentation, chat, or client-side JavaScript.

After changing any Netlify environment variable, redeploy the site so Netlify Functions receive the new configuration.

## 1. Netlify Environment Variables

Add variables in Netlify Dashboard -> Site configuration / Site settings -> Environment variables.

Required owner-provided variables:

```text
SMTP_USER
SMTP_PASS
GOOGLE_SHEETS_SPREADSHEET_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
PAYPAL_BUSINESS
```

The functions are designed to skip optional integrations gracefully when the related variables are missing. Form submissions still save to Netlify storage before email is attempted. Donation intent records still save before Google Sheets bookkeeping is attempted.

## 2. Email Notifications With Google App Password

`SMTP_USER` is the sender email account, likely `contact@backpackkidz.com`.

`SMTP_PASS` is a Google App Password for that account. The Google account must have 2-Step Verification enabled before App Passwords are available.

Owner steps:

1. Sign in to the sender Google account.
2. Open Google Account -> Security.
3. Enable 2-Step Verification if it is not already enabled.
4. Open App passwords and create an app password for Mail.
5. Add the app password only as `SMTP_PASS` in Netlify environment variables.
6. Add the sender email as `SMTP_USER` in Netlify environment variables.
7. Redeploy the site.
8. Submit a test form and check Netlify Function logs.

Never commit the app password. If `SMTP_USER` or `SMTP_PASS` is missing, the site logs that email is not configured and continues saving submissions.

## 3. Google Sheets Donation Bookkeeping

The donation form can write pending donation rows to Google Sheets, and PayPal IPN can mark matched donations as completed. The private Google setup must be completed by the owner.

Owner steps:

1. Create or use a Google Cloud project.
2. Enable the Google Sheets API.
3. Create a service account.
4. Create and download a JSON key for the service account.
5. Copy the service account email from `client_email`.
6. Create or open the bookkeeping spreadsheet.
7. Share the spreadsheet with the service account email as Editor.
8. Copy the spreadsheet ID from the Google Sheets URL.
9. Add `GOOGLE_SHEETS_SPREADSHEET_ID` in Netlify.
10. Add `GOOGLE_SERVICE_ACCOUNT_EMAIL` in Netlify.
11. Add `GOOGLE_PRIVATE_KEY` in Netlify.
12. Redeploy the site.
13. Submit the donation info form and check for a new pending row.

Private key formatting:

```text
-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n
```

Netlify can store the key with escaped newlines (`\n`). The server-side code converts escaped newlines before using the key. Do not paste the key into source code. Do not commit the downloaded JSON key file.

If Google Sheets variables are missing or Sheets is unavailable, donation records still save to Netlify storage and the function logs that Sheets bookkeeping is not configured or failed.

## 4. PayPal IPN Matching

`PAYPAL_BUSINESS` should be the receiving PayPal account email or merchant identifier used for donations. This lets the donation form build a PayPal URL that carries the donation ID and IPN listener URL.

PayPal IPN must be enabled in PayPal:

```text
Account Settings -> Notifications -> Instant payment notifications
```

Use this listener URL:

```text
https://www.backpackkidz.com/.netlify/functions/paypal-ipn
```

Owner steps:

1. Add `PAYPAL_BUSINESS` in Netlify environment variables.
2. Enable IPN in PayPal using the listener URL above.
3. Redeploy the site.
4. Test with PayPal sandbox, or a small real transaction if sandbox is not configured.
5. Check Netlify Function logs for IPN receipt.

If `PAYPAL_BUSINESS` is missing, unrelated site functionality continues. The IPN function logs a configuration warning and still handles verified IPN messages, but receiver matching depends on `PAYPAL_RECEIVER_EMAIL` if that optional backward-compatible variable is set.

## 5. Owner Content Checklist

Replace remaining TODOs only with verified owner-provided information:

- EIN
- Official 501(c)(3) wording
- Phone number
- Mailing address
- Real social URLs
- Gallery photos
- Testimonials
- Leadership names
- Current impact stats
- Partner confirmation/details
- Annual report/accountability info

Do not invent nonprofit facts, sponsor details, impact numbers, official wording, photos, testimonials, or leadership information.
