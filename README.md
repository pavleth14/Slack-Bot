# Two Brothers — Slack TRUCK SWITCH Bot

`/truckswitch` → modal → channel post + email. Teams mark **Fuel Card**, **Samsara**, and **TMS** via **checkboxes on the post**; the message updates with **UPDATED** and *Checked by @user*. When all three are checked: **Work Completed** :white_check_mark: and a **reply email** threads off the first message.

## Workflow

1. Submit form → post in `SLACK_CHANNEL_ID` + initial email. Optional **attachments** (PDF/images) go to **email** and a **thread reply** on the post.
2. **Fuel Card** (`@safetyteam`), **Samsara** (`@maintenance`), **TMS** (`@safetyteam`) — each row has a checkbox.
3. On check → `chat.update` → `UPDATED` + context line *Checked by @user* (visible on the row; Slack shows the user on mention).
4. All three checked → Work Completed :white_check_mark: + reply email (`In-Reply-To` first message).
5. Long **thread replies** remain manual.

No database. Message state lives in Slack **message metadata**.

## Slack app

- **Scopes:** `commands`, `chat:write`. For modal file upload also add `files:read` and `files:write`, **reinstall the app**, then keep `SLACK_ENABLE_MODAL_FILES=true` (default). If the form does not open, set `SLACK_ENABLE_MODAL_FILES=false` until scopes are added.
- **Interactivity:** `https://<host>/slack/interactions`
- **Slash command:** `https://<host>/slack/commands/truckswitch`

## Environment

- `SLACK_SAFETY_TEAM_USERGROUP_ID`, `SLACK_MAINTENANCE_TEAM_USERGROUP_ID` (optional mentions)
- `DEPARTMENT_EMAILS` + SMTP

Port **5002**. See `deploy/nginx.api.twobrothersfreight.com.conf`.
