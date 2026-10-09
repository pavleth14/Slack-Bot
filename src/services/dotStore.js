const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../../data/dot');

function dotFile(dotId) {
  if (!/^[A-Za-z0-9]+$/.test(dotId || '')) {
    throw new Error('Invalid DOT report id');
  }
  return path.join(DIR, `${dotId}.json`);
}

function saveDot(dotId, record) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(dotFile(dotId), JSON.stringify(record));
}

function loadDot(dotId) {
  const file = dotFile(dotId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = { saveDot, loadDot };
