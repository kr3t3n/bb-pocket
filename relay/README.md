# Optional Shortcuts upload relay

BB Connect requires a browser session. Apple Shortcuts uploads need a separate authenticated endpoint. This Worker accepts uploads only with `UPLOAD_KEY`; reading/deleting requires a distinct `READ_KEY` retained on the Pocket server. It exposes no BB data or agent actions. Each upload returns a random batch ID, not a public file URL.

Create the R2 bucket in wrangler.jsonc. Add an R2 lifecycle rule deleting all objects after one day. Set two independently generated random 32-byte keys with `wrangler secret put UPLOAD_KEY` and `wrangler secret put READ_KEY`, then deploy. Configure Pocket with the HTTPS Worker URL and both keys. Never commit keys or put READ_KEY in a Shortcut. The owner-only Pocket setup screen supplies the upload key needed by their Shortcut.

POST `/upload` accepts multipart files (all file fields), an optional `text` field, or a raw file with `X-Filename`. Limits: 20 files and 50 MB per request. GET `/batch/<id>` returns metadata, GET `/file/<id>` streams the content. These read routes reject content older than 24 hours, and DELETE `/batch/<id>` removes the batch and its files.

Shortcut: repeat over shared input, POST each item as Form → `file` (File) with `Authorization: Bearer <UPLOAD_KEY>`, collect the `id` from each response, combine IDs with commas, and open `https://YOUR-POCKET/#share-files?ids=<combined IDs>`. Convert Rich Text to HTML before uploading that item to retain formatting. Pocket asks for a target thread and uploads the originals into BB; it never automatically sends a message.
