# Aetherion Launcher — Roadmap

Visão completa das fases. A Fase 1 está 100% entregue e rodando no preview.
As libs puras TS das Fases 2, 3 e 4 estão em `lib/launcher/*` e são reaproveitadas
pelo main process do Electron (Fase 5).

---

## Fase 1 — UI e esqueleto [OK]

Arquivos: `app/*`, `components/launcher/*`, `components/settings/*`.

- Janela desktop simulada com title bar custom (`WindowFrame`).
- Dashboard com arte de fundo, status do servidor, badge da conta e botão PLAY.
- Login com Microsoft OAuth + modo offline.
- Settings com 5 abas (Conta / Minecraft / Mods / Java / Launcher).
- Design tokens: dourado aetheriano + ciano místico sobre grafite.
- Tipografia: Cinzel (títulos) + Inter (corpo).

---

## Fase 2 — Contas [LIB PRONTA]

Arquivo: `lib/launcher/accounts.ts`.

### O que já existe
- UUID offline determinístico (algoritmo do Mojang: MD5 de `"OfflinePlayer:<nick>"`).
- `addOfflineAccount`, `removeAccount`, `setActiveAccount`, `getActiveAccount`.
- Validação de username (regex + duplicatas).
- Contrato `addMicrosoftAccount(state, profile, tokens, saveSecret)`.

### O que falta no main process (Node)
1. Implementar o device code flow da Microsoft:
   - `POST https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode`
   - Poll `POST https://login.microsoftonline.com/consumers/oauth2/v2.0/token`
2. Troca Xbox Live: `POST https://user.auth.xboxlive.com/user/authenticate`
3. Troca XSTS: `POST https://xsts.auth.xboxlive.com/xsts/authorize`
4. Login Minecraft: `POST https://api.minecraftservices.com/authentication/login_with_xbox`
5. Perfil: `GET https://api.minecraftservices.com/minecraft/profile`
6. Trocar MD5 real no Node: `import { createHash } from "node:crypto"`.
7. Persistir tokens em `keytar` (keychain do SO).

Referência completa: <https://wiki.vg/Microsoft_Authentication_Scheme>

---

## Fase 3 — Updater / Manifest [LIB PRONTA]

Arquivo: `lib/launcher/manifest.ts`.

### O que já existe
- `fetchManifest(url)` com cache-busting e validação.
- `computeUpdatePlan({ manifest, local, installedHashes })` que gera um `UpdatePlan`
  com ações `download | skip | remove`.
- Proteção de drop-in mods via `protectedPatterns` (glob).
- Detecção de órfãos (arquivos que saíram do manifest).
- `isLauncherCompatible` com semver leve.

### O que falta no main process
1. Escanear `mods/` e calcular sha256 streaming:
   ```ts
   import { createReadStream } from "node:fs"
   import { createHash } from "node:crypto"
   async function hashFile(path: string) {
     const hash = createHash("sha256")
     for await (const chunk of createReadStream(path)) hash.update(chunk)
     return hash.digest("hex")
   }
   ```
2. Executor concorrente com `p-limit(4)`:
   - Baixar `action.kind === "download"` → tempfile → validar sha256 → rename.
   - Remover `action.kind === "remove"`.
   - Reportar progresso via `mainWindow.webContents.send("launch:progress", ...)`.
3. Retry exponencial em falhas de rede (3 tentativas: 1s, 3s, 9s).
4. Atualizar `instance-state.json` ao final com `installedManifestVersion`.

### Hospedagem do manifest e assets
- **Recomendado:** Cloudflare R2 (egress free até 10 GB/dia), domínio custom.
- **Alternativa:** Backblaze B2 + Bunny CDN.
- **Temporário:** GitHub Releases (limite de 2 GB por arquivo).
- **Evitar:** Google Drive (rate limit, URLs instáveis).

---

## Fase 4 — Java Runtime [LIB PRONTA]

Arquivo: `lib/launcher/java.ts`.

### O que já existe
- `pickBestJava(installations, manifest)` com ranking por:
  major recomendado → distância → arch x64 → vendor (Temurin > Oracle > outros).
- `planJavaDownload(manifest, platform)` para runtime embutida.
- `resolveJava(installations, manifest, platform)` como entrypoint.

### O que falta no main process
1. Detectar Javas instalados (`lib/main/detect-java.ts`):
   - `JAVA_HOME`, `PATH`.
   - Windows: `reg query HKLM\\SOFTWARE\\JavaSoft`, pastas padrão (`C:\Program Files\Java\*`, `C:\Program Files\Eclipse Adoptium\*`, `C:\Program Files\Zulu\*`).
   - macOS: `/usr/libexec/java_home -V`, `/Library/Java/JavaVirtualMachines/*`.
   - Linux: `/usr/lib/jvm/*`, `update-alternatives`.
2. Para cada candidato: `java -version` → parse `"openjdk version \"17.0.9\""`.
3. Se `resolveJava` retornar `download`, baixar ZIP/tar.gz em `%APPDATA%/.aetherion/runtimes/`, validar sha256 e extrair.
4. Salvar path em `settings.json` (`java.executablePath`).

---

## Fase 5 — Electron + launch real [BOILERPLATE]

Arquivos: `electron/main.ts`, `electron/preload.ts`.

### Setup local (no PC do usuário)

Instalar Node 20 LTS, Git, VS Code, pnpm. Depois:

```bash
# raiz do projeto (já clonado)
pnpm add -D electron electron-builder concurrently wait-on tsx @types/node
pnpm add electron-store keytar p-limit axios yauzl tar
```

Adicionar em `package.json`:

```json
{
  "main": "dist-electron/main.js",
  "scripts": {
    "electron:dev": "concurrently -k \"pnpm dev\" \"wait-on http://localhost:3000 && tsx electron/main.ts\"",
    "electron:build": "next build && next export && tsc -p electron/tsconfig.json && electron-builder --win --x64"
  },
  "build": {
    "appId": "gg.aetherion.launcher",
    "productName": "Aetherion Launcher",
    "directories": { "output": "release" },
    "files": ["dist-electron/**", "out/**", "package.json"],
    "win": { "target": "nsis", "icon": "build/icon.ico" }
  }
}
```

Criar `electron/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "../dist-electron",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["**/*.ts"]
}
```

Exportar o Next para estático — adicionar em `next.config.mjs`:
```js
export default { output: "export", images: { unoptimized: true } }
```

### Montagem do comando de launch

```
javaw
  -Xms<minRamMb>m -Xmx<maxRamMb>m
  <jvmArgs extras>
  -Djava.library.path=<nativesDir>
  -cp <classpath com libs do Forge + mc jar>
  <mainClass do Forge>             # net.minecraftforge.fml.common.launcher.FMLTweaker
  --username <account.username>
  --version Aetherion-1.19.2-forge-43.3.13
  --gameDir <instanceDir>
  --assetsDir <assetsDir>
  --assetIndex <version.json assetIndex>
  --uuid <account.uuid>
  --accessToken <token offline/microsoft>
  --userType <mojang|msa>
  --versionType release
  --width <width> --height <height>
  [--fullscreen]
  [--server <ip> --port <port>]
```

### Assinatura de código (Windows)
Sem certificado, o Windows SmartScreen mostra aviso de "desenvolvedor desconhecido".
Opções:
- **OV code signing** (~US$ 70/ano, Sectigo / DigiCert).
- **Azure Trusted Signing** (~US$ 10/mês, oficial Microsoft).
- Deixar sem assinar e orientar o usuário a clicar em "Mais informações → Executar mesmo assim".

---

## Fase 6 — Pós-launch

### Múltiplos servidores
Manifest vira um `modpacks.json` com array de instâncias. UI ganha um seletor
acima do botão PLAY. Cada instância tem seu próprio `instance-state.json`.

### Status ao vivo
`node-minecraft-protocol` em 1 IPC que pinga o servidor a cada 30s e envia
para o renderer via `webContents.send("server:status", ...)`.

### Integrações
- **Discord RPC:** `discord-rpc` mostra "Jogando Aetherion — Dia 3" no perfil.
- **YouTube/Twitter feed:** lido do `endpoints.news` do manifest.
- **Crash reports:** enviar logs do jogo (anonimizados) para Sentry ao detectar
  crash do child process.

### Auto-update do launcher
`electron-updater` aponta para GitHub Releases ou R2. Verifica na inicialização,
baixa em background, aplica no próximo restart.

---

## Arquitetura de dados em disco (produção)

```
%APPDATA%/.aetherion/              (Windows)
~/Library/Application Support/Aetherion/  (macOS)
~/.config/aetherion/                (Linux)

├── accounts.json              # { activeId, accounts[] } — Fase 2
├── settings.json              # LauncherSettings — Fase 5
├── runtimes/
│   └── java-17-windows-x64/   # runtime baixada — Fase 4
└── instances/
    └── aetherion-main/
        ├── instance-state.json
        ├── manifest.json      # cópia do último manifest remoto
        ├── mods/              # mods gerenciados pelo updater
        ├── config/
        ├── saves/
        ├── logs/
        └── shaderpacks/
```

Tokens Microsoft: **sempre** no keytar / Credential Manager do SO.
Nunca em JSON, nunca em localStorage.
