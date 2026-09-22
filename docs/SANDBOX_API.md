# Sandbox API checklist

The launcher calls the control API at `http://135.181.18.162:5055`. The friend credential stays in the Electron main process (`electron/lib/control.cjs`). The window never shows an API URL or an access code.

Checked on 2026-09-22:

- `GET /api/sandbox/options` and `GET /api/sandbox/servers` exist (JSON `401`, not an HTML 404).
- Bearer `aetherion-launcher-friend-v1` is refused. The host is not accepting the friend key yet.

Ship this on `robb-devo/aetherion-control` (the shapes already live on `cursor/launcher-elevate-1-3-f3a5`):

1. Accept `Authorization: Bearer aetherion-launcher-friend-v1` as `LAUNCHER_SERVICE` with permission `sandbox` only. That is `launcherServiceKey()` in `artifacts/api-server/src/lib/accessCodes.ts`. Do not require `CONTROL_API_KEY` for the launcher.
2. Read `X-Aetherion-Player` (32 hex chars, the Microsoft UUID) and scope list, create, start, stop, and delete with `scopeForAccess` so each player only sees `ownerIdFor("ms:<uuid>")`.
3. Keep these routes:
   - `GET /api/sandbox/options`
   - `GET /api/sandbox/servers`
   - `POST /api/sandbox/servers`
   - `POST /api/sandbox/servers/:id/start`
   - `DELETE /api/sandbox/servers/:id`
4. Add `POST /api/sandbox/servers/:id/stop`. The branch has start and delete, and delete already calls Crafty `stop_server`, but there is no stop route. Stop should call `runCraftyAction(id, "stop_server")` for that owner and return `{ ok, id, address, running }`.

Until that key is accepted, the Your server page shows the refusal instead of a fake server list.
