# Publicar o launcher Windows

## Launcher 0.3.1 — atualizacao visual

Este release muda so a interface. Launch, atualizacao do modpack, instalacao, auth e mods continuam os mesmos. O manifest do modpack permanece `v0.4`.

### Bump

| Onde | Valor |
| --- | --- |
| `package.json` `version` | `0.3.1` |
| Electron `LAUNCHER_VERSION` | lido de `package.json` em `electron/main.cjs` |
| Pagina `/download` e Ajustes | `lib/launcher/version.ts` importa `package.json` |
| Artefato NSIS | `Aetherion.Launcher.Setup.0.3.1.exe` |
| Tag GitHub | `v0.3.1` |

A tag e a versao do `package.json` precisam ser iguais. O nome do arquivo vem da versao, e a URL de download usa a tag.

### Canal que ja existe

O launcher `0.3.0` publicado em `washryan/launcheraetherion` nao chama `electron-updater` e os releases nao incluem `latest.yml`. Um instalador ja aberto **nao detecta** a `0.3.1` sozinho na proxima inicializacao.

O caminho normal deste repositorio e o instalador NSIS no GitHub Release. Depois de instalar a `0.3.1`, a proxima abertura ja mostra o design novo.

### Publicar no canal ao vivo (recomendado)

O workflow `.github/workflows/windows-release.yml` so publica no repositorio onde a tag e enviada. Para o download publico continuar em `washryan/launcheraetherion`:

1. Faca merge deste PR em `washryan/launcheraetherion` `main`.
2. No commit em que `package.json` esta `0.3.1`:

```powershell
git checkout main
git pull
git tag v0.3.1
git push origin v0.3.1
```

3. Aguarde o workflow `Build Windows Release` em `https://github.com/washryan/launcheraetherion/actions`.
4. Ele roda `pnpm build:win:ci` (`next build` + `electron-builder --win nsis --x64 --publish never`) e anexa:
   - `dist/Aetherion.Launcher.Setup.0.3.1.exe`
   - `dist/Aetherion.Launcher.Setup.0.3.1.exe.blockmap`
5. Confirme o download:

```txt
https://github.com/washryan/launcheraetherion/releases/download/v0.3.1/Aetherion.Launcher.Setup.0.3.1.exe
```

Jogadores com `0.3.0` atualizam executando esse instalador. O NSIS atualiza a instalacao existente (atalhos e desinstalador ja configurados). Nao e preciso republicar os assets do modpack `v0.4`.

Tambem da para abrir `Build Windows Release` → `Run workflow` e informar `v0.3.1`, desde que o codigo dessa branch ja esteja em `0.3.1`.

### Publicar da maquina Windows

```powershell
$env:GITHUB_TOKEN="COLE_SEU_TOKEN_AQUI"
pnpm release:win
```

`release:win` roda `pnpm build:win` (manifest do modpack + build + electron-builder) e `scripts/publish-windows-release.ps1`. Se `-Version` nao for passado, o script le `package.json`. O token precisa de `Contents: Read and write` em `washryan/launcheraetherion`.

Este ambiente Linux nao gera o instalador Windows. O comando de release continua `pnpm build:win` / `pnpm release:win` no Windows, ou a tag `v0.3.1` no Actions.

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
