# Party Quips

A configurable, host-authoritative peer-to-peer party game designed for static hosting on GitHub Pages.

**Play:** [customjack.github.io/party_quips](https://customjack.github.io/party_quips/)

## Run locally

```bash
npm install
npm run dev
```

Open the displayed URL in two browser windows. Host in one, then join with its six-character room code in the other. PeerJS uses its public cloud service for connection discovery; gameplay data travels directly between the host and players.

To run both the web app and a local PeerServer signaling backend:

```bash
npm run dev:full
```

Open the URL printed by Vite. Other devices on the same network should use its
`Network` URL; they must be able to reach both the Vite port and TCP port 9000.
The `local-peer` mode reads `.env.local-peer` and automatically points PeerJS at
the hostname used to open the page. You can also run the two processes separately
with `npm run peer:server` and `npm run dev:local`.

## Deploy

For the first deployment, open **Settings → Pages** in GitHub and select
**GitHub Actions** under **Build and deployment → Source**.

After that one-time setup, every push to `main` automatically runs
`.github/workflows/deploy-pages.yml`, builds the app, and publishes `dist` to
[customjack.github.io/party_quips](https://customjack.github.io/party_quips/).
You can also start a deployment manually from **Actions → Deploy to GitHub
Pages → Run workflow**.

## Architecture

- `src/domain`: versioned data shapes, defaults, and fairness validation
- `src/resources`: built-in packs and saved settings in the same JSON format users export
- `src/network`: host-authoritative PeerJS protocol, deadline clock, validation, and periodic time synchronization
- `src/services`: versioned browser storage, JSON imports, and downloads
- `src/components`: React screens plus a shared rules editor used both in the editor and live lobby

Pack and saved-settings files remain local unless a user exports them. Prompts use schema v2, which includes prompt-specific safety quips; older string-only packs are migrated when loaded. Only the host needs the active packs. Clients send drafts, lock/vote commands, and profile changes while the host owns every phase transition and score.

Answering, voting, result reveals, and between-round scoreboards all use host deadlines. Clients render smooth local countdowns and periodically correct against the host clock. Result and scoreboard durations are configurable in each saved-settings file.
