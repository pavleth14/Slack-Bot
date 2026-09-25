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

async function sendTruckSwitchEmail(submission, meta) {
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

  await transport.sendMail({
    from: mail.from,
    to: mail.departmentEmails.join(','),
    subject: formatEmailSubject(submission),
    html: formatEmailHtml(submission, meta),
  });

  return { sent: true };
}

module.exports = { sendTruckSwitchEmail };
