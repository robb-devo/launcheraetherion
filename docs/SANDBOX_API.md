# Sandbox API

Your server calls the control API at `http://135.181.18.162:5055` and only creates spare-capacity sandboxes. Those servers are not the live realm at `play.donnernet.de:25565`. The launcher will not join that realm from Your server. The window has no access-code field and no API-URL form. The credential stays in `electron/lib/control.cjs`.

The contract is [aetherion-control #5](https://github.com/robb-devo/aetherion-control/pull/5). It is not live on `135.181.18.162` until that host restarts onto the merged API. Until then a sandbox call returns 401 and the page says “Sandbox API is temporarily unavailable.”

## Request

Every sandbox call sends:

| Header | Value |
| --- | --- |
| `Authorization` | `Bearer aetherion-launcher-friend-v1` |
| `X-Aetherion-Player` | Microsoft UUID, 32 hex characters, no dashes |

`AETHERION_CONTROL_KEY` or `LAUNCHER_SERVICE_KEY` replaces the bearer on that machine. `AETHERION_API_BASE` replaces the host. Neither is shown in the window.

## Routes

| Method | Path |
| --- | --- |
| `GET` | `/api/sandbox/options` |
| `GET` | `/api/sandbox/servers` |
| `POST` | `/api/sandbox/servers` |
| `POST` | `/api/sandbox/servers/:id/start` |
| `POST` | `/api/sandbox/servers/:id/stop` |
| `DELETE` | `/api/sandbox/servers/:id` |

Create sends `name`, `serverType` (`vanilla`, `paper`, `fabric`, or `purpur`), `version`, `ramGb`, `cpuCores`, `preset`, `onlineMode`, and `startAfterCreate`. The API owns the row for that Microsoft UUID.

## Host restart

After #5 is merged, restart the API on the host (`sudo systemctl restart aetherion-control`). Leave `LAUNCHER_SERVICE_KEY` unset so the baked bearer is accepted. A signed-in Microsoft account should then list and create only that player’s servers.
