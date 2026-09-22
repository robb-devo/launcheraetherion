# Aetherion Launcher

Desktop launcher for the Aetherion client (Minecraft 1.21.1, Fabric 0.19.5). Version 0.3.6 keeps the 0.3.4 window, dashboard, and settings. Play installs the Fabric pack, signs in with Microsoft, and connects to play.donnernet.de.

## Windows setup

On a Windows machine with Node.js 22 and pnpm 10:

```powershell
pnpm install
pnpm build:win
```

The installer is written to:

```text
dist/Aetherion.Launcher.Setup.0.3.6.exe
```

`pnpm build:win` exports the interface and runs electron-builder (NSIS, x64). The client pack is `public/manifest.json` (Minecraft 1.21.1, Fabric). The packaged app keeps the Electron shell, the exported UI, and the Microsoft sign-in library. It does not pack the Next.js toolchain.

GitHub Actions (`Build Windows Release`) uses `pnpm build:win:ci` on tag `v0.3.6`. That produces `Aetherion.Launcher.Setup.0.3.6.exe`.

This Linux checkout cannot produce the NSIS installer. Use Windows or the release workflow.

## Sign in and servers

Microsoft sign-in uses the Xbox Live / Minecraft Services flow inside the app. Your servers are created through the control API at `http://135.181.18.162:5055` and are scoped to the signed-in Microsoft UUID. There is no access-code field.

See `docs/SANDBOX_API.md` if sandbox calls are refused.
