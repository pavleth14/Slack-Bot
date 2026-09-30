# Two Brothers — Slack Bot

## `/truckswitch`

Modal → channel post + email. Teams mark **Fuel Card**, **Samsara**, and **TMS** via **checkboxes on the post**; the message updates with **UPDATED** and *Checked by @user*. When all three are checked: **Work Completed** :white_check_mark: and a **reply email** threads off the first message.

## `/accident`

**ROAD ACCIDENT REPORT** modal (date + time pickers, incident details, optional photos) → same `SLACK_CHANNEL_ID` + email. Post includes `@safetyteam` *Post accident drug test required? Reply in this thread*, then `<!here>`. Photos go to email and a thread reply.

## `/loads`

Modal: date, confirmation number, truck, driver name, optional notes → `SLACK_LOADS_CHANNEL_ID` (or `SLACK_CHANNEL_ID` if unset) + email. Invite the bot to that channel. Post format:

`MM-DD-YYYY RC {confirmation} {driver} {truck}`

Notes on the line(s) below under **Notes:**.

## Workflow

1. Submit form → post in `SLACK_CHANNEL_ID` + initial email. Optional **attachments** (PDF/images) go to **email** and a **thread reply** on the post.
2. **Fuel Card** (`@safetyteam`), **Samsara** (`@maintenance`), **TMS** (`@safetyteam`) — each pending row has **Mark updated** (only that team). Updated rows show **Revert**.
3. **Mark updated** or **Revert** → modal *Are you sure?* → **Yes** updates the post (`UPDATED` + *Checked by @user*). **No** closes the modal (post unchanged).
4. All three checked → Work Completed :white_check_mark: + reply email (`In-Reply-To` first message).
5. Long **thread replies** remain manual.

No database. Message state lives in Slack **message metadata**.

## Slack app

- **Scopes:** `commands`, `chat:write`, `usergroups:read` (team check for Fuel/TMS/Samsara), `channels:history` (read post state on confirm). For modal file upload also add `files:read` and `files:write`, **reinstall the app**, then keep `SLACK_ENABLE_MODAL_FILES=true` (default). If the form does not open, set `SLACK_ENABLE_MODAL_FILES=false` until scopes are added.
- **Interactivity:** `https://<host>/slack/interactions`
- **Slash commands:** `https://<host>/slack/commands/truckswitch`, `https://<host>/slack/commands/accident`, `https://<host>/slack/commands/loads`

## Environment

- `SLACK_CHANNEL_ID` (truck switch, accident); `SLACK_LOADS_CHANNEL_ID` (optional, for `/loads` only)
- `SLACK_SAFETY_TEAM_USERGROUP_ID`, `SLACK_MAINTENANCE_TEAM_USERGROUP_ID` (optional mentions)
- `DEPARTMENT_EMAILS` + SMTP

Port **5002**. See `deploy/nginx.api.twobrothersfreight.com.conf`.
