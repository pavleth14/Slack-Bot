const { loadConfig } = require('../config');
const { slackClient } = require('./delivery');

const SYSTEM_TO_TEAM = {
  fuel: 'safety',
  samsara: 'maintenance',
  tms: 'safety',
};

const TEAM_LABELS = {
  safety: '@safetyteam',
  maintenance: '@maintenance',
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
  return '';
}

/**
 * @param {string} userId
 * @param {'fuel'|'samsara'|'tms'} systemKey
 * @param {import('@slack/web-api').WebClient} [client]
 */
async function canUserActOnSystem(userId, systemKey, client = slackClient()) {
  const teamKey = SYSTEM_TO_TEAM[systemKey];
  if (!teamKey) {
    return false;
  }

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

function teamLabelForSystem(systemKey) {
  const teamKey = SYSTEM_TO_TEAM[systemKey];
  return TEAM_LABELS[teamKey] || 'the assigned team';
}

module.exports = {
  SYSTEM_TO_TEAM,
  canUserActOnSystem,
  teamLabelForSystem,
};
