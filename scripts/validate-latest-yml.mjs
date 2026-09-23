import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { validateLatestYml } = require("../electron/lib/update-feed.cjs")

const file = process.argv[2]
const version = process.argv[3]
if (!file || !version) {
  console.error("Usage: node scripts/validate-latest-yml.mjs <latest.yml> <version>")
  process.exit(1)
}

const result = validateLatestYml(readFileSync(file, "utf8"), version)
if (!result.ok) {
  console.error(result.errors.join("\n"))
  process.exit(1)
}

console.log(`latest.yml ok for ${version}: ${result.installer}`)
