/**
 * Flatten electron-updater and its runtime dependencies into electron/vendor
 * so the packaged app can require them without shipping the Next.js node_modules tree.
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const destRoot = path.join(root, "electron", "vendor", "node_modules")

function copyPackage(name, fromDir) {
  const pkgJsonPath = require.resolve(`${name}/package.json`, { paths: [fromDir] })
  const src = path.dirname(pkgJsonPath)
  const dest = path.join(destRoot, name)
  fs.cpSync(src, dest, {
    recursive: true,
    dereference: true,
    filter(source) {
      const rel = path.relative(src, source)
      if (!rel) return true
      return !rel.split(path.sep).includes("node_modules")
    },
  })
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"))
  for (const dep of Object.keys(pkg.dependencies || {})) {
    if (!fs.existsSync(path.join(destRoot, dep, "package.json"))) {
      copyPackage(dep, src)
    }
  }
}

fs.rmSync(path.join(root, "electron", "vendor"), { recursive: true, force: true })
fs.mkdirSync(destRoot, { recursive: true })
copyPackage("electron-updater", root)

const staged = fs.readdirSync(destRoot).sort()
if (!staged.includes("electron-updater")) {
  throw new Error("Failed to stage electron-updater.")
}
console.log(`Staged updater modules: ${staged.join(", ")}`)
