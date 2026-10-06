# BB Pocket

Read README.md for the architecture and operating contract. This is an installable BB plugin with a standalone launcher retained for development.

Run npm run build after frontend edits: it updates the service-worker cache version and embedded plugin-assets.json, then builds the plugin backend. Commit both public/ and plugin-assets.json. Run npm test for bridge/filter changes and npm run test:browser against a running Pocket instance for UI/reconnect changes. Mock all sends and thread creation in browser tests; never start or message actual agents.

After source changes, rebuild and run bb plugin reload pocket for a path install. BB owns the production listener; do not start a second standalone service on its port.

The HTTP listener must remain loopback-only. Remote authentication is provided by BB Connect; never expose an unauthenticated proxy. Never commit .env files, live send journals, caches or screenshots containing user data. Preserve send receipts across migrations and updates; ambiguous sends must never be automatically resent.
