const express = require('express');
const { loadConfigSafe } = require('./config');
const slackRouter = require('./routes/slack');

const configResult = loadConfigSafe();
if (!configResult.ok) {
  console.warn(
    `[startup] Config incomplete (${configResult.error}). /health works; Slack routes need .env.`
  );
}

const app = express();

app.get('/health', (_req, res) => {
  const cfg = loadConfigSafe();
  res.json({
    status: 'ok',
    service: 'twobrothers-slack-bot',
    port: Number(process.env.PORT || 5002),
    slackConfigured: cfg.ok,
  });
});

app.use('/slack', slackRouter);

const port = Number(process.env.PORT || 5002);
app.listen(port, () => {
  console.log(`Slack bot listening on http://localhost:${port}`);
  console.log(`  Health:      GET  /health`);
  console.log(`  Slash cmd:   POST /slack/commands/truckswitch`);
  console.log(`  Interactive: POST /slack/interactions`);
});
