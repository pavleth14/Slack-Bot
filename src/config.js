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

function optional(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) return '';
  return String(value).trim();
}

let cached;

function resolveTrailerSwitchChannelId() {
  const primary = process.env.SLACK_TRAILERSWITCH_CHANNEL_ID?.trim();
  if (primary) return primary;
  const legacy = process.env.SLACK_TRAILER_SWITCH_CHANNEL_ID?.trim();
  if (legacy) return legacy;
  throw new Error(
    'Missing required environment variable: SLACK_TRAILERSWITCH_CHANNEL_ID'
  );
}

function resolveAccidentsChannelId() {
  const primary = process.env.SLACK_ACCIDENTS_CHANNEL_ID?.trim();
  if (primary) return primary;
  const legacy = process.env.SLACK_CHANNEL_ID?.trim();
  if (legacy) return legacy;
  throw new Error(
    'Missing required environment variable: SLACK_ACCIDENTS_CHANNEL_ID'
  );
}

function resolveClaimsChannelId() {
  const primary = process.env.SLACK_CLAIMS_CHANNEL_ID?.trim();
  if (primary) return primary;
  const testChannel = process.env.SLACK_CHANNEL_ID?.trim();
  if (testChannel) return testChannel;
  throw new Error(
    'Missing SLACK_CLAIMS_CHANNEL_ID or SLACK_CHANNEL_ID for /claims'
  );
}

function loadConfig() {
  if (cached) return cached;

  const loadsChannelId = required('SLACK_LOADS_CHANNEL_ID');
  const truckSwitchChannelId = required('SLACK_TRUCKSWITCH_CHANNEL_ID');
  const trailerSwitchChannelId = resolveTrailerSwitchChannelId();
  const accidentsChannelId = resolveAccidentsChannelId();
  const claimsChannelId = resolveClaimsChannelId();

  cached = {
    port: Number(process.env.PORT || 5002),
    slack: {
      botToken: required('SLACK_BOT_TOKEN'),
      signingSecret: required('SLACK_SIGNING_SECRET'),
      accidentsChannelId,
      loadsChannelId,
      truckSwitchChannelId,
      trailerSwitchChannelId,
      claimsChannelId,
      allowedUserIds: optionalList('SLACK_ALLOWED_USER_IDS'),
      safetyTeamUsergroupId: process.env.SLACK_SAFETY_TEAM_USERGROUP_ID?.trim() || '',
      controlTeamUsergroupId: process.env.SLACK_CONTROL_TEAM_USERGROUP_ID?.trim() || '',
      maintenanceTeamUsergroupId:
        process.env.SLACK_MAINTENANCE_TEAM_USERGROUP_ID?.trim() ||
        process.env.SLACK_ELD_TEAM_USERGROUP_ID?.trim() ||
        '',
      trackAndTraceTeamUsergroupId:
        process.env.SLACK_TRACK_AND_TRACE_TEAM_USERGROUP_ID?.trim() || '',
      trackAndTraceAllowedUserIds: optionalList(
        'SLACK_TRACK_AND_TRACE_ALLOWED_USER_IDS'
      ),
      safetyAllowedUserIds: optionalList('SLACK_SAFETY_ALLOWED_USER_IDS'),
      maintenanceAllowedUserIds: optionalList('SLACK_MAINTENANCE_ALLOWED_USER_IDS'),
      controlAllowedUserIds: optionalList('SLACK_CONTROL_ALLOWED_USER_IDS'),
      /** file_input in modal requires files:read (+ files:write for bot upload). Set false if modal will not open until scopes are added. */
      enableModalFileUpload: process.env.SLACK_ENABLE_MODAL_FILES !== 'false',
    },
    mail: {
      /** When false, forms post to Slack only (no email attempt, no rollback). Set true to require email again. */
      enabled: process.env.MAIL_ENABLED === 'true',
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
