#!/usr/bin/env node
/**
 * Aetherion - Build Manifest
 *
 * Gera manifest.json a partir de uma pasta local com Forge, mods e configs.
 * O manifest gerado e o contrato que o Electron usa na Fase 3:
 * baixar, validar SHA-256, aplicar opcionais e preservar drop-ins.
 *
 * Uso real:
 *   node scripts/build-manifest.mjs --in ./pack-v0.4 --out ./manifest.json
 *
 * Uso sem arquivos, para atualizar public/manifest.example.json:
 *   node scripts/build-manifest.mjs --template --out ./public/manifest.example.json
 */

import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { readdir, stat, writeFile } from "node:fs/promises"
import { basename, join, posix, relative } from "node:path"

const IGNORED_FILENAMES = new Set([
  // Mantemos a 2.0.1.166; esta antiga ficou sobrando no diretório do pack.
  "TerraBlender-forge-1.19.2-2.0.1.136.jar",
])

const DEFAULT_FORGE_SHA256 =
  "4869e60456321e99eb5120ae39171c382c27a05858cdfd4b90ff123e3750e681"
const DEFAULT_FORGE_SIZE = 7_180_192

const args = parseArgs(process.argv.slice(2))
const version = args.version ?? "0.4"
const mcVersion = args.mc ?? "1.19.2"
const forgeVersion = args.forge ?? "43.5.0"
const inDir = args.in ?? `./pack-v${version}`
const outFile = args.out ?? "./manifest.json"
const ghOwner = args.owner ?? "washryan"
const ghRepo = args.repo ?? "launcheraetherion"
const serverHost = args.server ?? "left-fcc.gl.joinmc.link"
const siteUrl = args.site ?? `https://${ghOwner}.github.io/${ghRepo}/`
const templateMode = Boolean(args.template)
const strict = Boolean(args.strict)
const baseUrl = `https://github.com/${ghOwner}/${ghRepo}/releases/download/v${version}`

function parseArgs(values) {
  const parsed = {}
  for (let index = 0; index < values.length; index++) {
    const current = values[index]
    if (!current.startsWith("--")) continue
    const key = current.slice(2)
    const next = values[index + 1]
    if (!next || next.startsWith("--")) parsed[key] = true
    else {
      parsed[key] = next
      index++
    }
  }
  return parsed
}

async function sha256File(filePath) {
  const hash = createHash("sha256")
  const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 })
  for await (const chunk of stream) hash.update(chunk)
  return hash.digest("hex")
}

async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, acc)
    else if (entry.isFile()) acc.push(full)
  }
  return acc
}

async function safeWalk(dir) {
  return walk(dir).catch(() => [])
}

async function modEntry(absPath, filename, type, index) {
  const fileStat = absPath ? await stat(absPath) : null
  return {
    path: `mods/${filename}`,
    url: releaseAssetUrl(filename),
    sha256: absPath ? await sha256File(absPath) : placeholderSha(index),
    size: fileStat?.size ?? 0,
    type,
    id: slugFor(filename),
    name: filename.replace(/\.jar$/i, ""),
    tag: type === "optional" ? "Opcional" : "Obrigatorio",
    defaultEnabled: type === "optional" ? optionalDefault(filename) : undefined,
  }
}

async function configEntry(absPath, rootDir, index) {
  const filename = posix.basename(absPath.split("\\").join("/"))
  const rel = relative(rootDir, absPath).split("\\").join("/")
  const fileStat = await stat(absPath)
  return {
    path: rel,
    url: releaseAssetUrl(filename),
    sha256: await sha256File(absPath),
    size: fileStat.size,
    type: "config",
  }
}

function releaseAssetUrl(filename) {
  return `${baseUrl}/${encodeURIComponent(filename)}`
}

function placeholderSha(index) {
  return (index + 1).toString(16).padStart(2, "0").repeat(32)
}

function slugFor(filename) {
  return filename
    .replace(/\.jar$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function optionalDefault(filename) {
  return filename.toLowerCase().startsWith("jei-")
}

async function modEntriesFromFolder(type, folder, startIndex) {
  const files = (await safeWalk(folder))
    .filter((file) => !IGNORED_FILENAMES.has(basename(file)))
    .sort((a, b) => basename(a).localeCompare(basename(b), "en", { sensitivity: "base" }))

  if (!files.length && strict) {
    throw new Error(`nenhum mod ${type} encontrado em ${folder}`)
  }

  return Promise.all(
    files.map((absPath, index) => modEntry(absPath, basename(absPath), type, startIndex + index)),
  )
}

async function buildFiles() {
  const required = await modEntriesFromFolder("required", join(inDir, "mods", "required"), 0)
  const optional = await modEntriesFromFolder(
    "optional",
    join(inDir, "mods", "optional"),
    required.length,
  )
  const configRoot = join(inDir, "config")
  const configs = templateMode
    ? []
    : await Promise.all(
        (await safeWalk(configRoot)).map((file, index) =>
          configEntry(file, inDir, required.length + optional.length + index),
        ),
      )

  const files = [...required, ...optional, ...configs]
  assertUniqueAssetNames(files.map((file) => posix.basename(file.path)))
  return files
}

async function buildForgeEntry() {
  const forgeFilename = `forge-${mcVersion}-${forgeVersion}-installer.jar`
  const forgePath = join(inDir, forgeFilename)
  const forgeStat = templateMode ? null : await stat(forgePath).catch(() => null)
  if (!templateMode && !forgeStat) {
    throw new Error(`Forge installer nao encontrado: ${forgePath}`)
  }

  return {
    version: forgeVersion,
    url: releaseAssetUrl(forgeFilename),
    sha256: templateMode ? DEFAULT_FORGE_SHA256 : await sha256File(forgePath),
    size: forgeStat?.size ?? DEFAULT_FORGE_SIZE,
    installedProfile: `${mcVersion}-forge-${forgeVersion}`,
  }
}

async function main() {
  console.log(
    `[aetherion] building manifest v${version} (${mcVersion} / forge ${forgeVersion})`,
  )
  if (templateMode) console.log("[aetherion] template mode: usando hashes placeholders")
  else console.log(`[aetherion] scanning: ${inDir}`)

  const files = await buildFiles()
  const manifest = {
    $schema: `https://${ghOwner}.github.io/${ghRepo}/manifest.schema.json`,
    version,
    minecraft: mcVersion,
    name: "Aetherion Main",
    instanceId: "aetherion-main",
    publishedAt:
      args.publishedAt ?? (templateMode ? "2026-04-21T00:00:00.000Z" : new Date().toISOString()),
    changelog:
      "- Modpack v0.4 adds exploration, magic, technology, and map mods\n- Xaero's Minimap and Xaero's World Map are optional\n- Forge, libraries, assets, and mods are prepared automatically\n- Java, Minecraft, storage, logs, cache, and integrity settings stay on this PC",
    requiredLauncherVersion: "0.2.0",
    forge: await buildForgeEntry(),
    files,
    java: { recommendedMajor: 17, minMajor: 17 },
    endpoints: {
      serverHost,
      serverPort: 25565,
      site: siteUrl,
      discord: "https://discord.gg/aetherion",
      youtube: "https://youtube.com/@aetherion",
    },
    protectedPatterns: ["mods/dropin/*", "shaderpacks/*", "config/custom-*.toml"],
  }

  await writeFile(outFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  console.log(`[aetherion] wrote ${outFile}`)
  console.log(
    `[aetherion] files: ${files.filter((file) => file.type === "required").length} required, ${
      files.filter((file) => file.type === "optional").length
    } optional, ${files.filter((file) => file.type === "config").length} config`,
  )

  if (!templateMode) {
    console.log("[aetherion] upload como assets do release:")
    console.log(`  - forge-${mcVersion}-${forgeVersion}-installer.jar`)
    for (const file of files) console.log(`  - ${posix.basename(file.path)}`)
  }
}

function assertUniqueAssetNames(filenames) {
  const seen = new Set()
  for (const filename of filenames) {
    if (seen.has(filename)) {
      throw new Error(`asset duplicado no manifest: ${filename}`)
    }
    seen.add(filename)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
