const nodemailer = require('nodemailer');
const { loadConfig } = require('../config');
const {
  formatEmailHtml,
  formatEmailSubject,
} = require('../format/truckSwitchMessage');

function createTransport() {
  const { mail } = loadConfig();
  if (!mail.smtp.host) {
    return null;
  }

  return nodemailer.createTransport({
    host: mail.smtp.host,
    port: mail.smtp.port,
    secure: mail.smtp.secure,
    auth: mail.smtp.user
      ? { user: mail.smtp.user, pass: mail.smtp.pass }
      : undefined,
  });
}

async function sendTruckSwitchEmail(submission, meta, options = {}) {
  const { mail } = loadConfig();
  if (!mail.departmentEmails.length) {
    console.warn('[mail] DEPARTMENT_EMAILS is empty; skipping email.');
    return { sent: false, reason: 'no_recipients' };
  }

  const transport = createTransport();
  if (!transport) {
    console.warn('[mail] SMTP_HOST not configured; skipping email.');
    return { sent: false, reason: 'no_smtp' };
  }

  const subject = formatEmailSubject(submission, options);
  const info = await transport.sendMail({
    from: mail.from,
    to: mail.departmentEmails.join(','),
    subject,
    html: formatEmailHtml(submission, meta, options),
  });

  return {
    sent: true,
    messageId: info.messageId,
    subject,
  };
}

async function sendTruckSwitchReplyEmail(
  submission,
  meta,
  { inReplyTo, references, subject, checks }
) {
  const { mail } = loadConfig();
  if (!mail.departmentEmails.length) {
    return { sent: false, reason: 'no_recipients' };
  }

  const transport = createTransport();
  if (!transport) {
    return { sent: false, reason: 'no_smtp' };
  }

  const info = await transport.sendMail({
    from: mail.from,
    to: mail.departmentEmails.join(','),
    subject,
    html: formatEmailHtml(submission, meta, { phase: 2, checks }),
    inReplyTo,
    references,
  });

  return { sent: true, messageId: info.messageId };
}

module.exports = { sendTruckSwitchEmail, sendTruckSwitchReplyEmail };
