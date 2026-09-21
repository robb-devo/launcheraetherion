# Publicacao do modpack Aetherion

Fluxo sem custo inicial:

- Site e `manifest.json`: Vercel ou GitHub Pages.
- Arquivos pesados: GitHub Releases do repositorio `washryan/launcheraetherion`.
- Launcher: baixa somente o que mudou, valida SHA-256 e preserva drop-ins.

## 1. Estrutura local do pack

Monte uma pasta assim:

```text
pack-v0.3/
  forge-1.19.2-43.5.0-installer.jar
  mods/
    required/
      AdvancementPlaques-1.19.2-1.4.7.jar
      aeroblender-1.19.2-1.0.1.jar
      ...
      TerraBlender-forge-1.19.2-2.0.1.166.jar
    optional/
      jei-1.19.2-forge-11.8.1.1034.jar
  config/
    seus-arquivos.toml
```

Obrigatorios ficam em `mods/required`. Opcionais ficam em `mods/optional`.
O launcher instala tudo no destino final `mods/`, mas usa essas pastas para
classificar cada entrada do manifest.

## 2. Gerar manifest com SHA real

```powershell
pnpm manifest:build
```

Esse comando roda:

```powershell
node scripts/build-manifest.mjs --version 0.3 --mc 1.19.2 --forge 43.5.0 --in ./pack-v0.3 --out ./manifest.json --owner washryan --repo launcheraetherion
```

O script calcula:

- `sha256` real de cada arquivo.
- `size` real.
- URL de download para cada asset do GitHub Release `v0.3`.
- `defaultEnabled: true` para JEI.
- OptiFine fica como opcional desligado por padrao.

Se algum dos 45 obrigatorios estiver faltando, ele avisa. Para transformar aviso
em erro, rode com `--strict`:

```powershell
node scripts/build-manifest.mjs --strict
```

## 3. Subir assets no GitHub Release

Crie a tag/release `v0.3` e envie Forge + mods + configs:

```powershell
gh release create v0.3 `
  --repo washryan/launcheraetherion `
  --title "Aetherion Modpack v0.3" `
  --notes "Primeiro pacote Aetherion com Forge 1.19.2-43.5.0" `
  pack-v0.3/forge-1.19.2-43.5.0-installer.jar `
  pack-v0.3/mods/required/*.jar `
  pack-v0.3/mods/optional/*.jar `
  pack-v0.3/config/*
```

Tambem pode fazer pela interface web em GitHub > Releases > Draft a new release.

## 4. Build para jogadores

Antes de gerar o instalador, suba os assets no GitHub Release `v0.3`. O
instalador nao carrega os `.jar` dentro dele; ele baixa os arquivos pelas URLs
do manifest embutido.

Depois rode:

```powershell
pnpm build:win
```

Esse comando:

1. gera `public/manifest.json` com hashes reais;
2. gera o site estatico em `out/`;
3. empacota o Electron em `dist/`.

O arquivo para distribuir fica em `dist/`, normalmente como instalador `.exe`.

## 5. Publicar o manifest remoto

Quando `manifest.json` estiver pronto, copie para `public/manifest.json` neste
projeto e faca deploy pela Vercel:

```powershell
Copy-Item .\manifest.json .\public\manifest.json
git add public/manifest.json
git commit -m "Publish modpack manifest v0.3"
git push
```

Depois do deploy, a URL final sera:

```text
https://SEU-PROJETO.vercel.app/manifest.json
```

No build empacotado, o launcher busca por padrao:

```text
https://raw.githubusercontent.com/washryan/launcheraetherion/main/public/manifest.json
```

In the launcher, open Settings > Launcher and set another manifest URL only if
you want to force a different remote manifest. In development this also works
through an environment variable:

```powershell
$env:AETHERION_MANIFEST_URL="https://SEU-PROJETO.vercel.app/manifest.json"
pnpm dev:electron
```

Antes de distribuir, valide se todas as URLs do manifest respondem:

```powershell
pnpm manifest:check-urls
```

## 6. Como o updater aplica a atualizacao

1. Baixa o manifest com cache-busting.
2. Escaneia `forge/`, `mods/`, `config/`, `resourcepacks/` e `shaderpacks/`.
3. Calcula SHA-256 streaming dos arquivos locais.
4. Baixa arquivos ausentes ou com hash diferente.
5. Valida o SHA-256 antes de renomear o arquivo final.
6. Remove arquivos orfaos que sairam do manifest.
7. Preserva `mods/dropin/`, `shaderpacks/` e `config/custom-*.toml`.
8. Atualiza `instance-state.json`.

## 7. Manifest exemplo

`public/manifest.example.json` e apenas um exemplo gerado sem os arquivos reais.
Ele tem hashes placeholders e tamanho `0`, entao nao deve ser usado como
manifest final do launcher.

Para regenerar o exemplo:

```powershell
pnpm manifest:example
```
