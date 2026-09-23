# Aetherion Launcher

Desktop launcher for the Aetherion client (Minecraft 1.21.1, Fabric 0.19.5). Version 0.3.9 keeps the 0.3.4 window, dashboard, and settings. Play installs the Fabric pack, signs in with Microsoft, and connects to play.donnernet.de. Other Minecraft versions launch vanilla, without that mod pack.

## Windows setup

On a Windows machine with Node.js 22 and pnpm 10:

```powershell
pnpm install
pnpm build:win
```

The installer is written to:

```text
dist/Aetherion.Launcher.Setup.0.3.9.exe
```

`pnpm build:win` exports the interface and runs electron-builder (NSIS, x64). The client pack is `public/manifest.json` (Minecraft 1.21.1, Fabric). The build also writes `dist/latest.yml`, which installed launchers use to find the next GitHub Release. The packaged app keeps the Electron shell, the exported UI, Microsoft sign-in, and `electron-updater`. It does not pack the Next.js toolchain.

GitHub Actions (`Build Windows Release`) uses `pnpm build:win:ci` on tag `v0.3.9`. The release assets are the installer, its blockmap, and `latest.yml`. The latest GitHub Release must include all three. v0.3.4 shipped the installer and blockmap only, so `releases/latest/download/latest.yml` 404s and installed copies cannot update.

Install `Aetherion.Launcher.Setup.0.3.9.exe` once. After that, a newer published release downloads and installs from inside the app. Do not keep replacing the setup file by hand.

This Linux checkout cannot produce the NSIS installer. Use Windows or the release workflow.

## Sign in and servers

Microsoft sign-in uses the Xbox Live / Minecraft Services flow inside the app. Play on the dashboard joins the live realm at play.donnernet.de. Your server creates a separate sandbox on spare capacity through the control API at `http://135.181.18.162:5055` and never sends that join to the live realm. There is no access-code field. Until that host restarts onto the friend-key API, Your server says the sandbox API is temporarily unavailable.

See `docs/SANDBOX_API.md` if sandbox calls are refused.
