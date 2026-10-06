const express = require('express');
const slackRouter = require('./routes/slack');

const { loadConfigSafe, loadConfig } = require('./config');

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
  console.log(`  Slash cmd:   POST /slack/commands/accident`);
  console.log(`  Slash cmd:   POST /slack/commands/loads`);
  console.log(`  Slash cmd:   POST /slack/commands/trailerswitch`);
  console.log(`  Interactive: POST /slack/interactions`);
  try {
    const { slack } = loadConfig();
    console.log(`  Post channels: /truckswitch → ${slack.truckSwitchChannelId}`);
    console.log(`  Post channels: /accident → ${slack.accidentsChannelId}`);
    console.log(`  Post channels: /loads → ${slack.loadsChannelId}`);
    console.log(
      `  Post channels: /trailerswitch → ${slack.trailerSwitchChannelId}`
    );
    console.log(
      `  Email: ${loadConfig().mail.enabled ? 'enabled (Slack + mail)' : 'disabled (Slack only)'}`
    );
  } catch (err) {
    console.warn(`  Post channels: (config error: ${err.message})`);
  }
});
