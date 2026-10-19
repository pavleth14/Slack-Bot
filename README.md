# Two Brothers — Slack Bot

## `/truckswitch`

Modal → channel post (Slack). Teams mark **Fuel Card**, **Samsara**, and **TMS** via **checkboxes on the post**; the message updates with **UPDATED** and *Checked by @user*. When all three are checked: **Work Completed** :white_check_mark: and **one email** to departments (`MAIL_ENABLED=true`).

## `/accident`

**Accident reporting** modal → **`SLACK_ACCIDENTS_CHANNEL_ID` only** + email. Fields: date, time, location, our driver/truck/trailer, description, police (report #), towed away (towing info), citation, ambulance, fuel spill/clean-up; checklist for **other party** info collected (CDL, insurance, USDOT signs, cab card, damage/impact photos, liability statement/video). File upload + `@safetyteam` drug-test line + `<!here>`.

## `/loads`

Modal: date, confirmation number, truck, driver name, optional notes → **`SLACK_LOADS_CHANNEL_ID` only** (Slack only; no email). Invite the bot to that channel. Post format:

`MM-DD-YYYY RC {confirmation} {driver} {truck}`

Notes on the line(s) below under **Notes:**.

## `/claims`

Three-step modal for ongoing claim management (no email). Posts to `SLACK_CLAIMS_CHANNEL_ID` when that is set; otherwise to `SLACK_CHANNEL_ID` (bot-test). Set `SLACK_CLAIMS_CHANNEL_ID` when the real claims channel exists. Invite the bot. Slash command URL: `https://<host>/slack/commands/claims`.

The post shows 🟢 paid and closed, 🟡 ongoing, or 🔴 rejected. Checkbox changes are written back onto the message so the whole channel sees the same boxes. Several boxes in a group can stay checked. Set `POST_SELECTION_MODE` to `exclusive` in `src/services/claimsSelection.js` when a group should keep only one box.

## `/dot`

**DOT Roadside Inspection Report** modal → **`SLACK_DOT_CHANNEL_ID`** when set; otherwise **`SLACK_CHANNEL_ID`** (bot-test). Invite the bot. Slash URL: `https://<host>/slack/commands/dot`.

Sections: driver/truck/trailer, date & time, location; inspection level (I–III/Other) and result; violation description and subject (driver/truck/trailer); inspection report upload (thread); citation yes/no; current status; additional notes. Checkbox groups appear on the channel post (shared with the channel). **Edit submission** (submitter only) updates text fields; post checkboxes can still be toggled on the message.

## `/trailerswitch`

Modal: **Pick up** / **Drop off**, truck, driver, trailer # (shown with `#` in the post), **Empty** / **Loaded** (select), load # when loaded, location, optional attachments → **`SLACK_TRAILERSWITCH_CHANNEL_ID` only**. Email on submit when `MAIL_ENABLED=true` to **`SLACK_TRAILERSWITCH_EMAILS`** (if set), else `DEPARTMENT_EMAILS`; **Edit submission** sends a **reply** on the same email thread. Invite the bot to that channel.

Slack always gets the **original** attachments in the thread. Large videos are **compressed with ffmpeg** for email (default cap ~20MB for Gmail). The Slack post is **not deleted** if email fails. Requires `ffmpeg` / `ffprobe` on the server (`FFMPEG_PATH` / `FFPROBE_PATH` optional).

Post body is one sentence, e.g.:

`Truck 223 Samih picked up loaded trailer #S532404 from Justice Yard IL Load# 25372`

## Workflow

1. Submit form → post in `SLACK_TRUCKSWITCH_CHANNEL_ID` (Slack only on submit). Optional **attachments** go to a **thread** on the post.
2. **Fuel Card** (`@safetyteam`), **Samsara** (`@maintenance`), **TMS** (`@safetyteam`) — each pending row has **Mark updated** (only that team). Updated rows show **Revert**.
3. **Mark updated** or **Revert** → modal *Are you sure?* → **Yes** updates the post (`UPDATED` + *Checked by @user*). **No** closes the modal (post unchanged).
4. All three checked → Work Completed :white_check_mark: + **one email** to `DEPARTMENT_EMAILS` when `MAIL_ENABLED=true` (not sent on initial submit).
5. Long **thread replies** remain manual.

**Email summary (`MAIL_ENABLED=true`):** `/truckswitch` — when all systems updated; `/trailerswitch` — on post (videos compressed for Gmail; Slack keeps original; no Slack rollback on mail failure), edit as email reply; `/accident` — on post; `/loads`, `/dot`, `/claims` — Slack only (for now).

No database. Message state lives in Slack **message metadata**.

## Slack app

- **Scopes:** `commands`, `chat:write`, `usergroups:read` (team check for Fuel/TMS/Samsara), `channels:history` (public channels), **`groups:history`** (private channels — form posts and truck-switch confirm), optional **`metadata.message:read`** (reading message metadata from history). For modal file upload also add `files:read` and `files:write`, **reinstall the app**, then keep `SLACK_ENABLE_MODAL_FILES=true` (default). If the form does not open, set `SLACK_ENABLE_MODAL_FILES=false` until scopes are added.
- **Interactivity:** `https://<host>/slack/interactions`
- **Slash commands:** `https://<host>/slack/commands/truckswitch`, `https://<host>/slack/commands/accident`, `https://<host>/slack/commands/loads`, `https://<host>/slack/commands/trailerswitch`, `https://<host>/slack/commands/claims`, `https://<host>/slack/commands/dot`

## Environment

- `SLACK_TRUCKSWITCH_CHANNEL_ID` (`/truckswitch`); `SLACK_ACCIDENTS_CHANNEL_ID` (`/accident`); `SLACK_LOADS_CHANNEL_ID` (`/loads`); `SLACK_TRAILERSWITCH_CHANNEL_ID` (`/trailerswitch`); `SLACK_CLAIMS_CHANNEL_ID` (`/claims`); `SLACK_DOT_CHANNEL_ID` (`/dot`, else `SLACK_CHANNEL_ID`)
- `SLACK_SAFETY_TEAM_USERGROUP_ID`, `SLACK_MAINTENANCE_TEAM_USERGROUP_ID` (optional mentions)
- **`MAIL_ENABLED`** — `false` (default): Slack only. `true`: Slack + email (`DEPARTMENT_EMAILS` + SMTP required).
- `DEPARTMENT_EMAILS` + SMTP (when `MAIL_ENABLED=true`); optional **`SLACK_TRAILERSWITCH_EMAILS`** for `/trailerswitch` only

Port **5002**. See `deploy/nginx.api.twobrothersfreight.com.conf`.
