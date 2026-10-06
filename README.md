# Two Brothers — Slack Bot

## `/truckswitch`

Modal → channel post + email. Teams mark **Fuel Card**, **Samsara**, and **TMS** via **checkboxes on the post**; the message updates with **UPDATED** and *Checked by @user*. When all three are checked: **Work Completed** :white_check_mark: and a **reply email** threads off the first message.

## `/accident`

**Accident reporting** modal → **`SLACK_ACCIDENTS_CHANNEL_ID` only** + email. Fields: date, time, location, our driver/truck/trailer, description, police (report #), towed away (towing info), citation, ambulance, fuel spill/clean-up; checklist for **other party** info collected (CDL, insurance, USDOT signs, cab card, damage/impact photos, liability statement/video). File upload + `@safetyteam` drug-test line + `<!here>`.

## `/loads`

Modal: date, confirmation number, truck, driver name, optional notes → **`SLACK_LOADS_CHANNEL_ID` only** + email. Invite the bot to that channel. Post format:

`MM-DD-YYYY RC {confirmation} {driver} {truck}`

Notes on the line(s) below under **Notes:**.

## `/claims`

Three-step modal for ongoing claim management (no email). Posts to `SLACK_CLAIMS_CHANNEL_ID` when that is set; otherwise to `SLACK_CHANNEL_ID` (bot-test). Set `SLACK_CLAIMS_CHANNEL_ID` when the real claims channel exists. Invite the bot. Slash command URL: `https://<host>/slack/commands/claims`.

The post shows 🟢 paid and closed, 🟡 ongoing, or 🔴 rejected. Checkbox groups on the post stay editable. Inside each status-style group only one box can stay checked. Document checklist and the closure requirement list allow more than one.

## `/trailerswitch`

Modal: **Pick up** / **Drop off**, truck, driver, trailer # (shown with `#` in the post), **Empty** / **Loaded** (select), load # when loaded, location, optional attachments → **`SLACK_TRAILERSWITCH_CHANNEL_ID` only** + email (same `MAIL_ENABLED` behavior as `/loads`). Invite the bot to that channel.

Post body is one sentence, e.g.:

`Truck 223 Samih picked up loaded trailer #S532404 from Justice Yard IL Load# 25372`

## Workflow

1. Submit form → post in `SLACK_TRUCKSWITCH_CHANNEL_ID` (+ email when `MAIL_ENABLED=true`). Optional **attachments** go to **email** and a **thread reply** on the post.
2. **Fuel Card** (`@safetyteam`), **Samsara** (`@maintenance`), **TMS** (`@safetyteam`) — each pending row has **Mark updated** (only that team). Updated rows show **Revert**.
3. **Mark updated** or **Revert** → modal *Are you sure?* → **Yes** updates the post (`UPDATED` + *Checked by @user*). **No** closes the modal (post unchanged).
4. All three checked → Work Completed :white_check_mark: + reply email (`In-Reply-To` first message).
5. Long **thread replies** remain manual.

No database. Message state lives in Slack **message metadata**.

## Slack app

- **Scopes:** `commands`, `chat:write`, `usergroups:read` (team check for Fuel/TMS/Samsara), `channels:history` (read post state on confirm). For modal file upload also add `files:read` and `files:write`, **reinstall the app**, then keep `SLACK_ENABLE_MODAL_FILES=true` (default). If the form does not open, set `SLACK_ENABLE_MODAL_FILES=false` until scopes are added.
- **Interactivity:** `https://<host>/slack/interactions`
- **Slash commands:** `https://<host>/slack/commands/truckswitch`, `https://<host>/slack/commands/accident`, `https://<host>/slack/commands/loads`, `https://<host>/slack/commands/trailerswitch`, `https://<host>/slack/commands/claims`

## Environment

- `SLACK_TRUCKSWITCH_CHANNEL_ID` (`/truckswitch`); `SLACK_ACCIDENTS_CHANNEL_ID` (`/accident`); `SLACK_LOADS_CHANNEL_ID` (`/loads`); `SLACK_TRAILERSWITCH_CHANNEL_ID` (`/trailerswitch`); `SLACK_CLAIMS_CHANNEL_ID` (`/claims`)
- `SLACK_SAFETY_TEAM_USERGROUP_ID`, `SLACK_MAINTENANCE_TEAM_USERGROUP_ID` (optional mentions)
- **`MAIL_ENABLED`** — `false` (default): Slack only. `true`: Slack + email (`DEPARTMENT_EMAILS` + SMTP required).
- `DEPARTMENT_EMAILS` + SMTP (when `MAIL_ENABLED=true`)

Port **5002**. See `deploy/nginx.api.twobrothersfreight.com.conf`.
