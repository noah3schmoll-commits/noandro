# Browsergame Role Bot

Discord bot that posts an admin-panel embed on startup. Admins can click a button, search roles and users in Discord's native pickers, and assign or remove browsergame roles.

## Setup

1. Install Node.js 22 LTS or newer.
2. Create a Discord bot in the Discord Developer Portal.
3. Enable the `SERVER MEMBERS INTENT` for the bot.
4. Invite the bot with these permissions:
   - `Manage Roles`
   - `Send Messages`
   - `Read Message History`
   - `Use External Emojis` is not required.
5. Copy `.env.example` to `.env`.
6. Fill in:
   - `DISCORD_TOKEN` or `BOT_TOKEN`
   - `ADMIN_CHANNEL_ID`
7. Install and run:

```bash
npm install
npm start
```

## Important Discord Rules

- The bot role must be above every role it should assign or remove.
- The bot cannot manage administrator roles unless its own top role is higher.
- The panel can select server roles through Discord's role picker.
- A single action can select up to 25 users because Discord component selections are capped.

## Free Hosting

Free options for this bot:

- Discloud: made for Discord bots, supports bot/background services, and can run bots on the Free plan with limits.
- Wispbyte: supports Node.js Discord bots and dashboard environment variables.

This project already includes `discloud.config`:

```txt
NAME=BrowsergameRoleBot
TYPE=bot
MAIN=index.js
RAM=100
VERSION=latest
START=npm start
```

For Discloud:

1. Push this folder to GitHub or upload it as a ZIP.
2. Do not upload `.env`.
3. Add `DISCORD_TOKEN` and `ADMIN_CHANNEL_ID` as environment variables in the Discloud panel.
4. Start/redeploy the bot.

Do not put your real token into GitHub. Store it only as a host environment variable.

Other free-ish options:

- Oracle Cloud Always Free: stronger and truly server-like, but setup is more technical and usually needs card verification.
- Koyeb Free Instance: easy web-service hosting, but the free instance can scale to zero after idle time, so it is not ideal for a Discord bot unless you keep it warm.
