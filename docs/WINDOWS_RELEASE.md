# Publish the Windows launcher

## Launcher 0.3.9 — Minecraft 1.21.1 Fabric

This build keeps the 0.3.4 window, dashboard, and settings. Play installs the Fabric pack (loader 0.19.5), Java 21, and connects to `play.donnernet.de:25565`. Microsoft sign-in is required to play. Your server talks to the control API. See `docs/SANDBOX_API.md` and `README.md`.

Players install `Aetherion.Launcher.Setup.0.3.9.exe` once. That build checks GitHub Releases for `latest.yml` and installs newer versions inside the app. NSIS upgrades the same app id (`gg.aetherion.launcher`) and leaves the AppData folder in place. The taskbar id is the same app id, so the launcher is one button. The Microsoft window uses `skipTaskbar`. The installer is started with NSIS `/S` and Electron `windowsHide`, so the update does not open a command window.

v0.3.4 is still the latest GitHub Release and it has no `latest.yml` (only the Setup.exe and the blockmap). `https://github.com/robb-devo/launcheraetherion/releases/latest/download/latest.yml` returns 404, so every installed build correctly finds nothing to install. 0.3.7 and 0.3.8 were never tagged, so this workflow never published them. Tagging `v0.3.9` after merge is what makes in-app update work.

### Version

| Where | Value |
| --- | --- |
| `package.json` `version` | `0.3.9` |
| Electron `LAUNCHER_VERSION` | read from `package.json` in `electron/main.cjs` |
| `/download` and settings | `lib/launcher/version.ts` imports `package.json` |
| NSIS artifact | `Aetherion.Launcher.Setup.0.3.9.exe` |
| GitHub tag | `v0.3.9` |
| Release repo | `robb-devo/launcheraetherion` |

The tag and `package.json` version must match.

### Ship

1. Merge into `robb-devo/launcheraetherion` `main`.
2. Tag that commit:

```powershell
git checkout main
git pull
git tag v0.3.9
git push origin v0.3.9
```

3. Wait for `Build Windows Release`. It runs `pnpm build:win:ci` and uploads a published release. The tag must equal `v` plus `package.json` `version`. The workflow refuses the release when `latest.yml` does not name `Aetherion.Launcher.Setup.<version>.exe`.

- `dist/latest.yml` (required; installed clients read this from the latest release)
- `dist/Aetherion.Launcher.Setup.0.3.9.exe` (one-time installer)
- `dist/Aetherion.Launcher.Setup.0.3.9.exe.blockmap`

4. Confirm the release is not a draft, is marked latest, and that `latest.yml` is attached:

```txt
https://github.com/robb-devo/launcheraetherion/releases/latest/download/latest.yml
```

Anyone on an older installed build receives 0.3.9 in the app only after this release is the latest one and `latest.yml` is attached. The setup executable is only the first install. A release without `latest.yml` looks like "no update" to electron-updater.

Do not republish the old Forge modpack. The client pack is the Fabric manifest shipped in the app.

### Publish from a Windows machine

```powershell
$env:GITHUB_TOKEN="PASTE_YOUR_TOKEN_HERE"
pnpm release:win
```

`release:win` runs `pnpm build:win` and `scripts/publish-windows-release.ps1`. The script reads the version from `package.json` and uploads the installer to `robb-devo/launcheraetherion`. This Linux environment does not produce the Windows installer.

---

## Referencia anterior (releases 0.2.x)

Este fluxo faz o botao de download do site parar de cair em 404.

## Precisa criar GitHub App?

Nao. Para este projeto, use um destes caminhos:

- Recomendado: GitHub Actions com `GITHUB_TOKEN` automatico do proprio repositorio.
- Alternativo: Personal Access Token na sua maquina, usando `pnpm release:win`.

GitHub App so vale a pena quando voce quer criar uma integracao instalavel para muitos repositorios ou usuarios.

## Por que acontece 404?

O site aponta para este padrao:

```txt
https://github.com/washryan/launcheraetherion/releases/download/v0.2.0/Aetherion.Launcher.Setup.0.2.0.exe
```

Esse link so existe quando:

1. Existe um GitHub Release com a tag `v0.2.0`.
2. Esse release tem um asset chamado exatamente `Aetherion.Launcher.Setup.0.2.0.exe`.

Enquanto o asset nao for enviado para o release, o GitHub responde 404.

## Caminho recomendado: GitHub Actions

Esse caminho nao exige token local.

1. Garanta que as Actions podem criar releases:

- GitHub > repositorio `washryan/launcheraetherion`
- Settings > Actions > General
- Workflow permissions
- marque `Read and write permissions`
- salve

2. Crie e envie uma tag:

```powershell
git tag v0.2.0
git push origin v0.2.0
```

3. Abra:

```txt
https://github.com/washryan/launcheraetherion/actions
```

4. Aguarde o workflow `Build Windows Release` terminar.

5. Teste o link:

```txt
https://github.com/washryan/launcheraetherion/releases/download/v0.2.0/Aetherion.Launcher.Setup.0.2.0.exe
```

Se o download iniciar, o site `/download` tambem vai funcionar.

### Publicar manualmente pela aba Actions

Tambem da para abrir o workflow `Build Windows Release`, clicar em `Run workflow` e informar `v0.2.0`.

## Caminho alternativo: token local

1. Gere o instalador local:

```powershell
pnpm build:win
```

2. Confirme que o arquivo existe:

```powershell
Get-Item ".\dist\Aetherion.Launcher.Setup.0.2.0.exe"
```

3. Crie um token no GitHub:

- Acesse GitHub > Settings > Developer settings > Personal access tokens.
- Use um token com permissao `Contents: Read and write` no repo `washryan/launcheraetherion`.
- Copie o token.

4. No PowerShell, defina o token apenas para a sessao atual:

```powershell
$env:GITHUB_TOKEN="COLE_SEU_TOKEN_AQUI"
```

5. Publique o instalador:

```powershell
pnpm release:win
```

6. Teste o link:

```txt
https://github.com/washryan/launcheraetherion/releases/download/v0.2.0/Aetherion.Launcher.Setup.0.2.0.exe
```

Se o download iniciar, o site `/download` tambem vai funcionar.

## Importante para outros jogadores

O instalador baixa e abre o launcher. Para o Minecraft baixar o modpack em outro PC, o release `v0.3` tambem precisa ter os assets do modpack:

- `forge-1.19.2-43.5.0-installer.jar`
- todos os mods obrigatorios
- mods opcionais, incluindo JEI e OptiFine

O comando `pnpm manifest:publish` mostra a lista exata de arquivos que precisam estar no release `v0.3`.

## Publicar o modpack v0.3

A pasta `pack-v0.3` nao fica no reposititorio porque ela contem os `.jar` do modpack. O GitHub Actions tambem nao consegue publicar esses arquivos sozinho, porque eles so existem na sua maquina.

O launcher baixa os mods assim:

1. Ele le `public/manifest.json`.
2. Cada arquivo do manifest tem uma URL de GitHub Release, por exemplo:

```txt
https://github.com/washryan/launcheraetherion/releases/download/v0.3/aether-1.19.2-1.4.2-forge.jar
```

3. O launcher baixa o asset do release `v0.3`.
4. O launcher confere SHA-256.
5. O launcher copia para `mods/` da instancia.

Para publicar os assets do modpack:

```powershell
$env:GITHUB_TOKEN="COLE_SEU_TOKEN_AQUI"
pnpm release:modpack
```

Esse comando:

- regenera `public/manifest.json`;
- cria ou reutiliza o release `v0.3`;
- envia `forge-1.19.2-43.5.0-installer.jar`;
- envia todos os mods obrigatorios;
- envia JEI e OptiFine como opcionais.

Sem esse release `v0.3`, o launcher funciona no seu PC em modo dev porque acha os arquivos locais em `pack-v0.3`, mas outros jogadores receberao erro ao tentar baixar os mods.
