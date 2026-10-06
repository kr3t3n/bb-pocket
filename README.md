# BB Pocket

An installable BB plugin that runs a lightweight mobile PWA. Browse threads, tasks and projects from your phone, with persistent filters, saved drafts and offline reading.

## Install

Requires **BB 0.44.0 or later**, Node 22.19+, and npm. Enable the **Tasks** and **Labels Pro** plugins first; Pocket reads their existing data. Enable and pair **BB Connect** for remote phone access.

```sh
bb plugin install https://github.com/kr3t3n/bb-pocket
bb pocket status
```

Pocket starts automatically with BB. `bb pocket status` prints its URL once ready. On your iPhone, open that URL in Safari, sign in to BB Connect, then choose **Share → Add to Home Screen**.

The plugin listens on loopback port **8890**. If that port is already used:

```sh
bb plugin config pocket set port 8892
bb pocket status
```

Changes to plugin settings restart Pocket automatically. No separate service or terminal session is needed.

## Features

- Threads: title/ID/label search; project, label include/exclude, status, unread and sort filters.
- **Exclude: automation** by default. Remove it, combine more filters, reset, or save named views. Choices survive reopening.
- Tasks: search titles/descriptions across tracker projects, filter by project/status, read descriptions and comments, and open linked threads.
- Projects: both tracker projects and BB projects, full task-project acronyms, and links into tasks/threads.
- Conversations: paged history, grouped tool activity, messaging, mark as read, and stop agent.
- Saved drafts, scroll positions and recently visited content. Reconnect on foreground/network return; background polling pauses when hidden.
- Persistent send receipts prevent automatic duplicate forwarding after interrupted requests or restarts. An ambiguous upstream result stays **unconfirmed**; check the conversation before deliberately sending again.

## Configuration

| Setting | Default | Purpose |
| --- | --- | --- |
| `port` | `8890` | Loopback web port, 1024–65535 |
| `share` | `true` | Expose through owner-authenticated BB Connect |
| `bbUrl` | Auto-detected | Optional full BB URL for login and unsupported features |

```sh
bb plugin config pocket set bbUrl https://your-bb.getbb.app
bb plugin config pocket set share false
bb pocket status --json
```

Connect sharing uses BB's host-port API where available, with the `bb connect` CLI as a server-host fallback. The `bb` command must be on the BB server's PATH for that fallback. If sharing is unavailable, Pocket stays accessible on loopback and reports the reason in `bb pocket status`.

Disabling/reloading the plugin closes its listener and releases shares it owns. Pre-existing manually created shares are preserved. Send receipts are stored in Pocket's own plugin SQLite database and retained across reloads and updates. BB remains the source of truth for threads, labels, projects and tasks.

**Authentication:** remote access relies on the owner-authenticated BB Connect gateway. The listener binds only to loopback and validates the Host and Origin headers. Do not put an unauthenticated public proxy in front of it. This is a single-owner app, not a multi-user web service. Previously visited content and drafts remain cached on the device.

## Update

```sh
bb plugin update pocket
```

Git installs track this repository's default branch. Versioned releases are also available, e.g. `git:https://github.com/kr3t3n/bb-pocket.git@^0.2.0`.

Pocket's service worker downloads updated app assets in the background; a subsequent full reload uses them. Resuming an already-open Home Screen app can keep its previous frontend until reloaded. The in-app refresh button refreshes data, not the app bundle.

## Current limitations

- New-thread creation, model controls, approval forms and attachment upload/full attachment display remain in the full BB app. Push notifications are not implemented.
- Thread search covers title/ID/labels, not conversation full-text. Only visible, unarchived threads are indexed.
- Tasks are read-only. Project navigation uses the linked BB project and matching task-project label when present.
- Summaries are cached for 15 seconds, labels/projects for 60 seconds, and tasks for 30 seconds. Stale responses trigger a refresh. Visible conversations poll every 3 seconds.
- Offline reading covers previously visited pages on that device. iOS may evict device storage. Offline messages are not automatically queued for sending.
- Tool output is bounded to 4,000 characters per activity. Full transcripts remain in BB.
- The adapter is tested against BB 0.44.0 and Plugin SDK 0.5.29. Future BB API changes may require an update.
- Touch-viewport Chromium tests pass. Real iPhone Safari installation, keyboard behaviour and long suspension still require device testing.

## Develop

```sh
npm ci
npm run build
bb plugin install .
npm test
```

`npm run build` builds the PWA, embeds its assets, updates the service-worker cache version, and runs `bb plugin build`. Commit `plugin-assets.json` and `public/` after UI changes: Git installs build the plugin backend with production dependencies only, using those prebuilt web assets.

The plugin backend is `plugin.ts`; the reusable HTTP bridge is `bridge.mjs`. `server.mjs` remains an optional standalone launcher:

```sh
cp .env.example .env
# Edit the Connect hostname and full BB URL; use a different port if the plugin is running.
node --env-file=.env server.mjs
```

A standalone Linux service example is in `deploy/`. To migrate an old standalone installation, stop it first, import its send journal, then set the plugin to its old port:

```sh
bb pocket import-journal /absolute/path/to/old/data/sends.json
bb plugin config pocket set port 8890
```

The import merges receipts, rejects conflicting IDs, and restarts Pocket. Keep the old journal until migration is verified.

### Tests

`npm test` runs isolated filter and bridge tests, including simultaneous duplicate requests, lost upstream responses, restart persistence, conflicting IDs and CSRF rejection. Sends in these tests go only to a fake BB server.

For browser tests, run Pocket with Tasks and Labels Pro data, and install Chromium (`npx playwright install chromium`) or set `CHROMIUM_PATH`:

```sh
POCKET_TEST_URL=http://127.0.0.1:8890 npm run test:browser
```

The browser suite exercises live read APIs at a 390×844 touch viewport: filters/search, draft persistence, offline reload/reconnect, tasks and project navigation. Sends are intercepted with mock responses, never sent to live agents. Screenshots and live state are excluded from Git.
