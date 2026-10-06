const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../../data/claims');

function claimFile(claimId) {
  if (!/^[A-Za-z0-9]+$/.test(claimId || '')) {
    throw new Error('Invalid claim id');
  }
  return path.join(DIR, `${claimId}.json`);
}

function saveClaim(claimId, record) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(claimFile(claimId), JSON.stringify(record));
}

function loadClaim(claimId) {
  const file = claimFile(claimId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = { saveClaim, loadClaim };
