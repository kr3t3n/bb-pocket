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

- Usage limits: compact header counters (tap to expand) with percentage used and local reset times; refresh every minute while visible, with saved/offline status. Slow requests show a retry state after 12 seconds; failed reads retry on the next visible poll (15 seconds on the home screen).

- Threads: title/ID/label search; project, label include/exclude, status, unread and sort filters.
- **Exclude: automation** by default. Remove it, combine more filters, reset, or save named views. Choices survive reopening.
- Tasks: search titles/descriptions across tracker projects, filter by project/status, read descriptions and comments, and open linked threads.
- Projects: both tracker projects and BB projects, full task-project acronyms, and links into tasks/threads.
- Thread context menu: tap the vertical ⋮ at the right of a row, long-press for 550ms, or right-click. Mirrors Sidebar Pro: copy thread ID/local/cloud links, mark read/unread, pin/unpin, rename, archive/unarchive, and confirmed delete. Long press cancels on scrolling or pointer movement. Menus fetch fresh thread state. **Open in split** requests a split in connected full BB windows, not inside Pocket; a message reports when none receives it. Thread menu actions require the installed plugin.
- Attachments: use ＋ in the composer for images, media, PDFs and other files. Upload progress, removal, persisted drafts and attachment-only messages are supported. Pasting rich text preserves an HTML file alongside its plain text. Limit: 50 MB per file, 20 files / 100 MB per message. What an agent can interpret depends on its provider.
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

- New-thread creation, model controls, approval forms and full attachment display remain in the full BB app. Push notifications are not implemented.
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

The browser suite exercises live read APIs at a 390×844 touch viewport: filters/search, draft persistence, offline reload/reconnect, tasks and project navigation. Sends are intercepted with mock responses, never sent to live agents. The additional menu browser suite mocks every API request and tests menu parity, long press, scroll cancellation, pin state, rename and deletion confirmation. The bridge suite checks action validation and cross-origin rejection; it never changes live threads. Screenshots and live state are excluded from Git.

## iPhone Share Sheet

iOS does not support a PWA's `share_target` manifest registration. Pocket provides a text/link receiving flow for an Apple Shortcut instead. Open **Share to Pocket · setup** in Pocket for instructions and your receiving address.

Create **Send to BB Pocket** in Apple Shortcuts, enable **Show in Share Sheet**, and accept **Text** and **URLs**. Add these actions:

1. **Get Text from Input**, using **Shortcut Input**.
2. **URL Encode**, using that text.
3. **Text** containing `https://YOUR-POCKET-HOST/#share?text=` followed immediately by the **URL Encoded Text** variable.
4. **Open URLs**, using the Text action's output.

Choose the shortcut when sharing, then select an existing thread in Pocket. Shared text appends to any existing draft; nothing is automatically sent. Shared text survives reload until used or discarded. The receiving flow accepts up to 20,000 characters; URL length limits can vary, so paste long content directly. Content travels in the URL fragment, not the HTTP request URL, and is removed from the current address after being saved locally.

This opens the Pocket website in your browser and is not guaranteed to open the installed Home Screen app. Browser and installed-app sessions/storage may differ. Sign in to BB Connect if requested; if login loses the share, share again after signing in. This text-only Shortcut does not transfer attachments; use the file-sharing flow below for those. Creating new threads is not supported. The browser receiving flow is tested; the actual Shortcut handoff still needs a real iPhone check.

## File sharing from Apple Shortcuts

The text-only Shortcut above remains supported. Sending binary files requires an authenticated upload relay because BB Connect's browser session is not available to Shortcuts' HTTP action. The optional Cloudflare Worker and deployment instructions are in [relay/README.md](relay/README.md); this relay is not automatically deployed by installing Pocket.

Configure `relayUrl`, `relayReadKey` (secret), and `relayUploadKey` (secret) in Pocket settings. The read key stays on the server. **Share to Pocket · setup → Set up files, images and media** provides the upload URL, copyable upload authorization header, and receiving URL to configure one Shortcut. Do not share a configured Shortcut containing your upload key. Rotate that key in both the Worker and Pocket if exposed.

Shared files are imported into BB's attachment storage only after you choose a thread. Retrying an import reuses the existing attachment IDs. Review the draft and send explicitly. The relay retains staged files for at most 24 hours when its required R2 lifecycle rule is configured. The server also refuses reads after 24 hours. Text and URLs may be uploaded as text files; preserve rich formatting by exporting rich text to HTML before upload. Original PDFs, media and files should be uploaded unchanged.

Attachment send receipts include attachment IDs and retain the previous text-only hash format for backwards compatibility. Requests never accept arbitrary server file paths. A failed attachment lookup occurs before a send receipt is created; uncertain upstream sends remain unconfirmed and are never automatically resent.
