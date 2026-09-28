# Two Brothers — Slack TRUCK SWITCH Bot

Standalone Node.js app for `/truckswitch`. No database; archive is Slack threads plus email.

## Message format

Posts follow the **TRUCK SWITCH** template: driver, equipment details, temporary switch flag, trailers (`/` if none), required updates, optional location note, and team lines:

- **Fuel Card** → `@safetyteam`
- **Samsara** → `@eldteam`
- **TMS** → `@safetyteam`

## Workflow

1. **Phase 1** — `/truckswitch` form → channel post + email. **Mark work completed** button on the message.
2. **Phase 2** — Safety checks updated systems (Fuel Card, Samsara, TMS) → thread reply with `Updated.` / `NA` + email.
3. **Teams** — Reply in thread (manual, like “samsara updated”).
4. **Control** — Add a **:white_check_mark:** reaction on the phase-2 thread message (members of control allowlist if configured). Bot posts *Control verified* in the thread.

Slack + email must both succeed for phase 1 and 2 modals (rollback on email failure).

## Slack app setup

**Scopes:** `commands`, `chat:write`, `channels:history` (or `groups:history` for private channels)

**Event Subscriptions** (for control reactions):

- Enable events
- Request URL: `https://<host>/slack/events`
- Subscribe to bot event: `reaction_added`

**Interactivity:** `https://<host>/slack/interactions`  
**Slash command:** `https://<host>/slack/commands/truckswitch`

## Environment

See `.env.example`. User group IDs for `@safetyteam`, `@eldteam`, `@controlteam` mentions.

## Run

`npm install` → `npm start` (port **5002**). See `deploy/nginx.api.twobrothersfreight.com.conf` for proxy.
