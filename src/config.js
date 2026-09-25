require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function optionalList(name) {
  const raw = process.env[name];
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

let cached;

function loadConfig() {
  if (cached) return cached;

  cached = {
    port: Number(process.env.PORT || 5002),
    slack: {
      botToken: required('SLACK_BOT_TOKEN'),
      signingSecret: required('SLACK_SIGNING_SECRET'),
      channelId: required('SLACK_CHANNEL_ID'),
      allowedUserIds: optionalList('SLACK_ALLOWED_USER_IDS'),
      safetyTeamUsergroupId: process.env.SLACK_SAFETY_TEAM_USERGROUP_ID?.trim() || '',
    },
    mail: {
      departmentEmails: optionalList('DEPARTMENT_EMAILS'),
      smtp: {
        host: process.env.SMTP_HOST?.trim() || '',
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER?.trim() || '',
        pass: process.env.SMTP_PASS || '',
      },
      from: process.env.MAIL_FROM?.trim() || 'noreply@twobrothersfreight.com',
    },
  };

  return cached;
}

function loadConfigSafe() {
  try {
    return { ok: true, config: loadConfig() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { loadConfig, loadConfigSafe };
