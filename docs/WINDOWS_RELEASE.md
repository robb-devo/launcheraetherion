# Publish the Windows launcher

## Launcher 0.3.1 — visual polish and in-app updates

This release keeps launch, modpack install, auth, and instance paths the same. The modpack stays `v0.4`. The launcher itself now updates through `electron-updater`, separate from the modpack updater in `runUpdater()`.

Player data paths are unchanged. See `docs/DATA_SAFETY.md`.

### Version

| Where | Value |
| --- | --- |
| `package.json` `version` | `0.3.1` |
| Electron `LAUNCHER_VERSION` | read from `package.json` in `electron/main.cjs` |
| `/download` and settings | `lib/launcher/version.ts` imports `package.json` |
| NSIS artifact | `Aetherion.Launcher.Setup.0.3.1.exe` |
| Update feed | `dist/latest.yml` plus the `.exe.blockmap` |
| GitHub tag | `v0.3.1` |
| Publish target | `washryan/launcheraetherion` (`build.publish`) |

The tag and `package.json` version must match. Fresh installs still use the NSIS installer (`oneClick: false`, per-user, directory can be chosen).

### What an installed 0.3.1 launcher does

On startup, and again when the window is focused (at most once every 10 minutes), the packaged app asks GitHub Releases for a newer stable version. The feed is `latest.yml` on the repository's latest release.

If a newer build exists:

1. The launcher shows an update card.
2. The progress bar uses real download bytes (`transferred / total`). It stays empty until the release reports a size.
3. After the download finishes, the launcher restarts into the new build (`quitAndInstall`, silent NSIS).
4. If Minecraft is launching or attached to the launcher, the restart waits and the card offers Restart.

Dev mode (`next dev`) does not check for updates.

### One-time bridge from 0.3.0

The published `0.3.0` binary does not contain `electron-updater`, and the `v0.3.0` release has no `latest.yml`. That install cannot discover `0.3.1` by itself.

Players on `0.3.0` install `Aetherion.Launcher.Setup.0.3.1.exe` once. NSIS upgrades the same app id (`gg.aetherion.launcher`) and leaves `%APPDATA%\Aetherion Launcher` in place. Every release after `0.3.1` is detected on the next start. No browser download is required for those later updates.

### Ship on the live channel

The workflow `.github/workflows/windows-release.yml` publishes only in the repository where the tag is pushed. The live channel is `washryan/launcheraetherion`.

1. Merge this PR into `washryan/launcheraetherion` `main`.
2. On that commit, with `package.json` at `0.3.1`:

```powershell
git checkout main
git pull
git tag v0.3.1
git push origin v0.3.1
```

3. Wait for `Build Windows Release` at `https://github.com/washryan/launcheraetherion/actions`.
4. The workflow runs `pnpm build:win:ci`, which stages `electron-updater` into `electron/vendor`, builds the static app, and runs `electron-builder --win nsis --x64 --publish never`. `--publish never` still writes `latest.yml` because `build.publish` is set. The workflow uploads, and marks the release latest:
   - `dist/Aetherion.Launcher.Setup.0.3.1.exe`
   - `dist/Aetherion.Launcher.Setup.0.3.1.exe.blockmap`
   - `dist/latest.yml`
5. Confirm the release page lists those three files and is the latest release:

```txt
https://github.com/washryan/launcheraetherion/releases/download/v0.3.1/Aetherion.Launcher.Setup.0.3.1.exe
https://github.com/washryan/launcheraetherion/releases/latest/download/latest.yml
```

Do not republish the modpack `v0.4` jars for this launcher release. Modpack publishes must stay off GitHub "Latest" (`scripts/publish-modpack-release.ps1` sets `make_latest` to false). `electron-updater` reads the latest release, then `latest.yml`. A modpack release marked latest would hide the launcher feed.

You can also open `Build Windows Release` → `Run workflow` and pass `v0.3.1`, as long as that ref is already version `0.3.1`.

### Publish from a Windows machine

```powershell
$env:GITHUB_TOKEN="PASTE_YOUR_TOKEN_HERE"
pnpm release:win
```

`release:win` runs `pnpm build:win` and `scripts/publish-windows-release.ps1`. The script reads the version from `package.json`, refuses to upload if `dist/latest.yml` is missing, uploads the exe, blockmap, and `latest.yml`, and marks that release latest. The token needs `Contents: Read and write` on `washryan/launcheraetherion`.

This Linux environment does not produce the Windows installer. The release command remains `pnpm build:win` / `pnpm release:win` on Windows, or the `v0.3.1` tag on Actions.

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
