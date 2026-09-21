# Player data safety for 0.3.1

This release changes the interface, English copy, and how the launcher updates itself. It does not move, rename, or wipe player data.

Compared with `main` (`0.3.0`), these storage decisions are the same functions and the same strings:

| What | Where it lives | Code |
| --- | --- | --- |
| App name (Windows userData folder) | `%APPDATA%\Aetherion Launcher` | `app.setName("Aetherion Launcher")` in `electron/main.cjs` |
| Accounts and sessions | `%APPDATA%\Aetherion Launcher\accounts.json` | `accountsPath()` → `userData/accounts.json` |
| Launcher settings, including Java | `%APPDATA%\Aetherion Launcher\launcher-settings.json` | `settingsPath()` → `userData/launcher-settings.json` |
| Java executable, min RAM, max RAM, JVM args | fields `java.executablePath`, `java.minRamMb`, `java.maxRamMb`, `java.jvmArgs` inside `launcher-settings.json` | unchanged settings schema |
| Minecraft instance, mods, saves, configs | `%APPDATA%\Aetherion Launcher\instances\<instanceId>` | `instancePath()` → `userData/instances/<sanitized id>` |
| Instance state | `instance-state.json` inside that instance folder | `instanceStatePath()` |
| Default instance id | `aetherion-main` | unchanged |
| Install identity | `gg.aetherion.launcher` | `package.json` `build.appId` |
| Modpack manifest URL | `https://raw.githubusercontent.com/washryan/launcheraetherion/main/public/manifest.json` | unchanged |
| Server | `left-fcc.gl.joinmc.link` | unchanged |

NSIS stays per-user (`perMachine: false`) with the same app id, so installing `0.3.1` over `0.3.0` replaces the program files and leaves the AppData folder in place. The window background color changed. That is chrome only.

`Clear cache` still deletes only:

- the instance `natives`, `cache`, and `tmp` folders
- leftover `*.download` files under `forge`, `mods`, `config`, `resourcepacks`, and `shaderpacks`

It does not delete saves, installed mods, accounts, or `launcher-settings.json`.

The new launcher self-update (`electron/updater.cjs`) downloads the next installer into the updater cache and restarts the app. It does not read or write `accounts.json`, `launcher-settings.json`, or the instance folder. Modpack file updates stay in `runUpdater()` and still match files by SHA-256. The only manifest edit in this release is the English changelog text. File URLs, sizes, and hashes are unchanged.
