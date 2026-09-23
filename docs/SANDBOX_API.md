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

## Spare pool

Every sandbox shares one spare pool. The live realm keeps the rest of the host. The launcher offers only small sizes, sent as `preset: "custom"` so the API does not replace them with the named `balanced` (16 GB) or `large` (24 GB) presets:

| Tier | RAM | CPU |
| --- | --- | --- |
| Tiny | 1 GB | 1 core |
| Easy | 2 GB | 1 core |
| Medium | 4 GB | 2 cores |
| Large | 8 GB | 2 cores |

`GET /api/sandbox/options` already returns `usedRamGb`, `remainingRamGb`, `poolGb`, `maxRamGb`, `usedCores`, `remainingCores`, `poolCores`, and `maxCores`. The launcher shows used versus the spare ceiling: 24 GB and 6 cores, or the API pool when that pool is smaller. A tier that does not fit the remaining spare RAM or CPU is disabled. The overview counts only this account’s servers. It does not list anyone else’s.

Live check on 2026-09-23: the host answers `poolGb: 64`, `maxRamGb: 24` (`SANDBOX_MAX_GB`), `poolCores: 8`, `maxCores: 4`, with 2 GB and 1 core already used. `SANDBOX_MAX_GB` is the per-server ceiling in the API, not the shared pool (`SANDBOX_POOL_GB`, default 64). To make the API enforce the same spare cap the window uses, set these on the control host and restart `aetherion-control.service` only:

```
SANDBOX_POOL_GB=24
SANDBOX_POOL_CORES=6
SANDBOX_MAX_GB=8
SANDBOX_MAX_CORES=2
```

That does not restart Crafty or the live Minecraft network. Until those are set, the API would still accept a custom server up to 24 GB, and the window will not offer that size.

## Host restart

After #5 is merged, restart the API on the host (`sudo systemctl restart aetherion-control`). Leave `LAUNCHER_SERVICE_KEY` unset so the baked bearer is accepted. A signed-in Microsoft account should then list and create only that player’s servers.

## Playtime

The launcher reads realm playtime for the signed-in Microsoft account:

`GET /api/player/playtime`

```json
{ "totalSeconds": 12345 }
```

`totalSeconds` is an integer number of seconds. The same field may be nested as `playtime.totalSeconds` or `player.totalSeconds`. If the route is missing, or the field is absent, the home screen shows an em dash. It does not show zero unless Control sends `0`.

## Linked modpack

A sandbox may include an optional client pack. When `versionId` is present and `source` is omitted or `modrinth`, Play installs that Modrinth version into its own instance and joins the sandbox with the pack's Minecraft version.

```json
{
  "modpack": {
    "source": "modrinth",
    "projectId": "aabbccdd",
    "versionId": "11223344",
    "slug": "example-pack",
    "name": "Example Pack"
  }
}
```

Without `modpack`, Play keeps the current behavior: match `version`, and use the Aetherion Fabric pack only when that version is 1.21.1.

## Plugins

There is no plugin install route. `plugins` on a server object is rendered read-only when Control already sends it:

```json
{ "plugins": [{ "id": "essentials", "name": "Essentials" }] }
```

Install and removal stay unwired until Control adds `GET` / `POST` / `DELETE /api/sandbox/servers/:id/plugins`. The launcher does not call Crafty.
