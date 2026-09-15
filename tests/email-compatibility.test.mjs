import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import { createRequire } from 'node:module';
import nodemailer from 'nodemailer';
import { sendEmail, sendNotificationEmail } from '../netlify/email-utils.mjs';

const recipients = [
  ['contact', 'CONTACTS', 'contact@backpackkidz.com'],
  ['donation', 'DONATIONS', 'donate@backpackkidz.com'],
  ['sponsorship', 'SPONSORSHIPS', 'donate@backpackkidz.com'],
  ['volunteer', 'VOLUNTEERS', 'contact@backpackkidz.com'],
  ['partner', 'PARTNERS', 'partners@backpackkidz.com'],
];
const environmentKeys = ['SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT', 'NOTIFY_FROM', ...recipients.map(([, key]) => key + '_NOTIFY_EMAIL')];
const realCreateTransport = nodemailer.createTransport;

function isolate(t) {
  const saved = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));
  for (const key of environmentKeys) delete process.env[key];
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const denied = () => { throw new Error('Network is forbidden in email compatibility tests'); };
  t.mock.method(net, 'connect', denied);
  t.mock.method(net, 'createConnection', denied);
  t.mock.method(net.Socket.prototype, 'connect', denied);
  t.mock.method(tls, 'connect', denied);
  t.mock.method(globalThis, 'fetch', denied);
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  process.env.SMTP_USER = 'fixture@example.invalid';
  process.env.SMTP_PASS = 'fixture-only-not-a-secret';
}

test('ESM default and CommonJS imports expose compatible SMTP transport constructors', t => {
  isolate(t);
  const commonjs = createRequire(import.meta.url)('nodemailer');
  for (const api of [nodemailer, commonjs]) {
    const transport = api.createTransport({ host: 'smtp.example.invalid', port: 465, secure: true });
    assert.equal(typeof transport.sendMail, 'function');
    assert.equal(transport.transporter.options.secure, true);
    transport.close();
  }
});

for (const [recordType, key, defaultRecipient] of recipients) {
  for (const configured of [false, true]) {
    test(`${recordType}: ${configured ? 'configured' : 'fixed'} recipient and text-only MIME`, async t => {
      isolate(t);
      const to = configured ? `${recordType}-team@example.invalid` : defaultRecipient;
      if (configured) process.env[key + '_NOTIFY_EMAIL'] = to;
      const stream = realCreateTransport({ streamTransport: true, buffer: true, newline: 'unix' });
      let compiled, options;
      t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async mail => {
        options = mail;
        compiled = await stream.sendMail(mail);
        return compiled;
      } }));
      const result = await sendNotificationEmail({
        recordType, subject: 'Synthetic compatibility fixture',
        to: 'untrusted@example.invalid', raw: 'must not become a message',
        attachments: [{ href: 'https://example.invalid/never-fetch' }],
        record: {
          name: 'Synthetic Partner', email: 'visitor@example.invalid',
          message: '<b>Literal text, not HTML</b>',
          to: 'untrusted@example.invalid',
          raw: 'Literal raw field', path: '/never/read',
          href: 'https://example.invalid/never-fetch',
          attachments: [{ path: '/never/read' }],
        },
      });
      assert.deepEqual(result, { sent: true });
      assert.deepEqual(Object.keys(options).sort(), ['from', 'replyTo', 'subject', 'text', 'to']);
      assert.equal(typeof options.text, 'string');
      assert.deepEqual(compiled.envelope, { from: 'fixture@example.invalid', to: [to] });
      const mime = compiled.message.toString('utf8');
      assert.match(mime, /Content-Type: text\/plain; charset=utf-8/i);
      assert.doesNotMatch(mime, /Content-Type: (?:text\/html|multipart\/)|Content-Disposition: attachment/i);
      assert.match(mime, /Reply-To: visitor@example\.invalid/i);
      assert.match(options.text, /<b>Literal text, not HTML<\/b>/);
      assert.match(options.text, /Raw: Literal raw field/);
      assert.equal(options.to, to);
    });
  }
}

for (const port of [undefined, '587']) {
  test(`SMTP ${port || 'default 465'} settings and direct sender field boundary remain unchanged`, async t => {
    isolate(t);
    if (port) { process.env.SMTP_PORT = port; process.env.SMTP_HOST = 'relay.example.invalid'; process.env.NOTIFY_FROM = 'notifier@example.invalid'; }
    let transport, message;
    t.mock.method(nodemailer, 'createTransport', options => {
      transport = options;
      return { sendMail: async value => { message = value; } };
    });
    assert.deepEqual(await sendEmail({ to: 'team@example.invalid', subject: 'Fixture', text: 'Text',
      raw: 'ignored', html: '<p>ignored</p>', attachments: [{ path: '/never/read' }],
      path: '/never/read', href: 'https://example.invalid/never-fetch', envelope: { to: 'ignored@example.invalid' },
    }), { sent: true });
    assert.deepEqual(transport, { host: port ? 'relay.example.invalid' : 'smtp.gmail.com', port: port ? 587 : 465,
      secure: !port, auth: { user: 'fixture@example.invalid', pass: 'fixture-only-not-a-secret' } });
    assert.deepEqual(message, { from: port ? 'notifier@example.invalid' : 'fixture@example.invalid',
      to: 'team@example.invalid', replyTo: undefined, subject: 'Fixture', text: 'Text' });
  });
}

for (const missing of ['SMTP_USER', 'SMTP_PASS']) {
  test(`missing ${missing} skips without constructing a transport`, async t => {
    isolate(t); delete process.env[missing];
    const constructor = t.mock.method(nodemailer, 'createTransport', () => { throw new Error('Unexpected transport'); });
    assert.deepEqual(await sendEmail({ to: 'team@example.invalid', subject: 'Fixture', text: 'Text' }), { sent: false });
    assert.equal(constructor.mock.callCount(), 0);
  });
}

for (const stage of ['constructor', 'send']) {
  test(`${stage} failure remains fail-soft`, async t => {
    isolate(t);
    t.mock.method(nodemailer, 'createTransport', () => {
      if (stage === 'constructor') throw new Error('Synthetic constructor failure');
      return { sendMail: async () => { throw new Error('Synthetic send failure'); } };
    });
    assert.deepEqual(await sendEmail({ to: 'team@example.invalid', subject: 'Fixture', text: 'Text' }), { sent: false });
  });
}
