const { loadConfig } = require('../config');
const { slackClient } = require('./delivery');

const SYSTEM_TEAM_KEYS = {
  fuel: ['safety', 'trackandtrace'],
  samsara: ['maintenance'],
  tms: ['safety', 'trackandtrace'],
};

const TEAM_LABELS = {
  safety: '@safetyteam',
  maintenance: '@eldteam',
  trackandtrace: '@trackandtraceteam',
};

/** @type {Map<string, { users: Set<string>, expires: number }>} */
const usergroupCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchUsergroupMemberIds(client, usergroupId) {
  const cached = usergroupCache.get(usergroupId);
  if (cached && cached.expires > Date.now()) {
    return cached.users;
  }

  const res = await client.usergroups.users.list({ usergroup: usergroupId });
  const users = new Set(res.users || []);
  usergroupCache.set(usergroupId, {
    users,
    expires: Date.now() + CACHE_TTL_MS,
  });
  return users;
}

function teamAllowlist(teamKey) {
  const { slack } = loadConfig();
  if (teamKey === 'safety') {
    return slack.safetyAllowedUserIds;
  }
  if (teamKey === 'maintenance') {
    return slack.maintenanceAllowedUserIds;
  }
  if (teamKey === 'trackandtrace') {
    return slack.trackAndTraceAllowedUserIds;
  }
  return [];
}

function teamUsergroupId(teamKey) {
  const { slack } = loadConfig();
  if (teamKey === 'safety') {
    return slack.safetyTeamUsergroupId;
  }
  if (teamKey === 'maintenance') {
    return slack.maintenanceTeamUsergroupId;
  }
  if (teamKey === 'trackandtrace') {
    return slack.trackAndTraceTeamUsergroupId;
  }
  return '';
}

async function isUserInTeam(userId, teamKey, client) {
  const allowlist = teamAllowlist(teamKey);
  if (allowlist.length) {
    return allowlist.includes(userId);
  }

  const usergroupId = teamUsergroupId(teamKey);
  if (usergroupId) {
    try {
      const members = await fetchUsergroupMemberIds(client, usergroupId);
      return members.has(userId);
    } catch (err) {
      console.error('[systemTeamAccess] usergroups.users.list failed:', err.message);
      return false;
    }
  }

  return true;
}

/**
 * @param {string} userId
 * @param {'fuel'|'samsara'|'tms'} systemKey
 * @param {import('@slack/web-api').WebClient} [client]
 */
async function canUserActOnSystem(userId, systemKey, client = slackClient()) {
  const teamKeys = SYSTEM_TEAM_KEYS[systemKey];
  if (!teamKeys?.length) {
    return false;
  }

  for (const teamKey of teamKeys) {
    if (await isUserInTeam(userId, teamKey, client)) {
      return true;
    }
  }
  return false;
}

function teamLabelForSystem(systemKey) {
  const teamKeys = SYSTEM_TEAM_KEYS[systemKey] || [];
  const labels = teamKeys.map((k) => TEAM_LABELS[k]).filter(Boolean);
  return labels.length ? labels.join(' or ') : 'the assigned team';
}

module.exports = {
  SYSTEM_TEAM_KEYS,
  canUserActOnSystem,
  teamLabelForSystem,
};
