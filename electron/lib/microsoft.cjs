const fs = require("node:fs/promises")
const path = require("node:path")
const { Auth } = require("msmc")

let getMainWindow = () => null
let userDataPath = () => ""
let iconPath = () => undefined

function configure(options) {
  getMainWindow = options.getMainWindow
  userDataPath = options.userDataPath
  iconPath = options.iconPath
}

function secretsPath() {
  return path.join(userDataPath(), "account-secrets.json")
}

async function readSecrets() {
  try {
    const raw = await fs.readFile(secretsPath(), "utf8")
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("[aetherion] failed to read account secrets", error)
    }
    return {}
  }
}

async function writeSecrets(secrets) {
  const filePath = secretsPath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(secrets)}\n`, { encoding: "utf8", mode: 0o600 })
}

function seal(text) {
  const { safeStorage } = require("electron")
  if (safeStorage.isEncryptionAvailable()) {
    return {
      enc: true,
      blob: safeStorage.encryptString(text).toString("base64"),
    }
  }
  return { enc: false, blob: Buffer.from(text, "utf8").toString("base64") }
}

function openSeal(entry) {
  if (!entry?.blob) return ""
  const buffer = Buffer.from(entry.blob, "base64")
  if (!entry.enc) return buffer.toString("utf8")
  const { safeStorage } = require("electron")
  return safeStorage.decryptString(buffer)
}

function dashedUuid(value) {
  const hex = String(value || "")
    .replace(/-/g, "")
    .toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(hex)) return String(value || "")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function loginWindowOptions() {
  const parent = getMainWindow()
  const icon = iconPath()
  return {
    width: 480,
    height: 720,
    resizable: false,
    title: "Sign in with Microsoft",
    backgroundColor: "#121018",
    parent: parent || undefined,
    modal: Boolean(parent),
    skipTaskbar: true,
    autoHideMenuBar: true,
    icon,
  }
}

function readableAuthError(error) {
  const raw = error instanceof Error ? error.message : String(error || "")
  if (/gui\.closed|closed|cancel/i.test(raw)) return "Microsoft sign-in was cancelled."
  if (/does not own minecraft|profile/i.test(raw)) {
    return "This Microsoft account does not have a Minecraft profile."
  }
  return raw || "Microsoft sign-in failed."
}

async function saveRefresh(accountId, refresh) {
  const secrets = await readSecrets()
  secrets[accountId] = seal(refresh)
  await writeSecrets(secrets)
}

async function readRefresh(accountId) {
  const secrets = await readSecrets()
  try {
    return openSeal(secrets[accountId])
  } catch (error) {
    console.warn("[aetherion] failed to unlock Microsoft session", error)
    return ""
  }
}

async function deleteSecret(accountId) {
  const secrets = await readSecrets()
  if (!secrets[accountId]) return
  delete secrets[accountId]
  await writeSecrets(secrets)
}

function accountFromMinecraft(mc) {
  const profile = mc.profile
  if (!profile?.id || !profile?.name) {
    throw new Error("This Microsoft account does not have a Minecraft profile.")
  }
  const uuid = dashedUuid(profile.id)
  return {
    id: uuid,
    type: "microsoft",
    username: profile.name,
    uuid,
    avatarUrl: `https://minotar.net/helm/${profile.id.replace(/-/g, "")}/64.png`,
    addedAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
  }
}

async function loginMicrosoft() {
  const auth = new Auth("select_account")
  let xbox
  try {
    xbox = await auth.launch("electron", loginWindowOptions())
  } catch (error) {
    throw new Error(readableAuthError(error))
  }
  const mc = await xbox.getMinecraft()
  const account = accountFromMinecraft(mc)
  await saveRefresh(account.id, xbox.save())
  return account
}

async function sessionForAccount(account) {
  if (!account || account.type !== "microsoft") {
    return {
      name: account?.username || "Player",
      uuid: String(account?.uuid || "").replace(/-/g, ""),
      accessToken: "0",
      userType: "legacy",
      xuid: "",
    }
  }
  const refresh = await readRefresh(account.id)
  if (!refresh) throw new Error("Microsoft session expired. Sign in again.")
  let xbox
  try {
    xbox = await new Auth("select_account").refresh(refresh)
  } catch (error) {
    throw new Error(readableAuthError(error) || "Microsoft session expired. Sign in again.")
  }
  const mc = await xbox.getMinecraft()
  const profile = accountFromMinecraft(mc)
  await saveRefresh(account.id, xbox.save())
  const mclc = mc.mclc(true)
  return {
    name: profile.username,
    uuid: String(mclc.uuid || profile.uuid).replace(/-/g, ""),
    accessToken: mclc.access_token,
    userType: "msa",
    xuid: mclc.meta?.xuid || mc.xuid || "",
    profile,
  }
}

module.exports = {
  configure,
  loginMicrosoft,
  sessionForAccount,
  deleteSecret,
  dashedUuid,
}
