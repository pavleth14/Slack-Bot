const { loadConfig } = require('../config');

function isUserAllowed(userId) {
  const { allowedUserIds } = loadConfig().slack;
  if (!allowedUserIds.length) return true;
  return allowedUserIds.includes(userId);
}

function isSafetyOperator(userId) {
  const { safetyAllowedUserIds } = loadConfig().slack;
  if (!safetyAllowedUserIds.length) return true;
  return safetyAllowedUserIds.includes(userId);
}

function isControlOperator(userId) {
  const { controlAllowedUserIds } = loadConfig().slack;
  if (!controlAllowedUserIds.length) return true;
  return controlAllowedUserIds.includes(userId);
}

module.exports = { isUserAllowed, isSafetyOperator, isControlOperator };
