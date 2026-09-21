/**
 * Aetherion Launcher — Accounts (Fase 2)
 *
 * Biblioteca pura de domínio. Não depende de fs/electron.
 * O processo main do Electron chama estas funções e passa os dados
 * para um storage persistente (electron-store, keytar, etc.).
 *
 * Formato esperado do arquivo persistente (JSON):
 *   %APPDATA%/.aetherion/accounts.json
 *   {
 *     "activeId": "uuid-ativo",
 *     "accounts": [ ...Account ]
 *   }
 *
 * Tokens Microsoft devem ir para o keytar (cofre do SO), NUNCA em JSON.
 */

import type { Account, AccountsState, MicrosoftTokens } from "./types"

/* -------------------------------------------------------------------------- */
/*  UUID offline — idêntico ao método do Mojang para nicks crackeados         */
/*  UUID v3 de "OfflinePlayer:<nick>" em MD5                                  */
/* -------------------------------------------------------------------------- */

/**
 * Calcula o UUID offline determinístico para um nickname.
 * Implementação do algoritmo oficial do Minecraft (UUID v3 / namespace fixo).
 * Em ambiente Node real, usar `crypto.createHash('md5')`. Aqui usamos a
 * Web Crypto API para funcionar tanto no renderer (preview) quanto no main.
 */
export async function offlineUuidFor(username: string): Promise<string> {
  const input = new TextEncoder().encode(`OfflinePlayer:${username}`)
  // Web Crypto não tem MD5 — na Fase 5 (Node) trocamos para createHash('md5').
  // Como fallback de dev/preview, usamos SHA-1 truncado: serve para UI.
  // ATENÇÃO: em produção, o main process DEVE usar MD5 real.
  const digest = await crypto.subtle.digest("SHA-1", input)
  const bytes = new Uint8Array(digest).slice(0, 16)

  // Força os bits de versão (3) e variant (RFC 4122), como o Mojang faz.
  bytes[6] = (bytes[6] & 0x0f) | 0x30
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/* -------------------------------------------------------------------------- */
/*  Operações de estado                                                       */
/* -------------------------------------------------------------------------- */

export const USERNAME_REGEX = /^[A-Za-z0-9_]{3,16}$/

export function validateOfflineUsername(username: string): string | null {
  const trimmed = username.trim()
  if (!trimmed) return "Enter a username."
  if (!USERNAME_REGEX.test(trimmed))
    return "Use 3 to 16 characters: letters, numbers, or underscore."
  return null
}

export async function addOfflineAccount(
  state: AccountsState,
  username: string,
): Promise<AccountsState> {
  const err = validateOfflineUsername(username)
  if (err) throw new Error(err)

  const clean = username.trim()
  const existing = state.accounts.find(
    (a) => a.type === "offline" && a.username.toLowerCase() === clean.toLowerCase(),
  )
  if (existing) throw new Error("That name is already added.")

  const uuid = await offlineUuidFor(clean)
  const account: Account = {
    id: uuid,
    type: "offline",
    username: clean,
    uuid,
    avatarUrl: minecraftHeadUrl(clean),
    addedAt: new Date().toISOString(),
  }

  return {
    activeId: state.activeId ?? account.id,
    accounts: [...state.accounts, account],
  }
}

/**
 * Adiciona uma conta Microsoft já autenticada.
 * O fluxo OAuth (device code) roda no main process — esta função só registra.
 *
 * Fluxo completo do OAuth Microsoft para Minecraft está em:
 * https://wiki.vg/Microsoft_Authentication_Scheme
 *
 * Resumo:
 *   1) Device code flow → Microsoft access_token
 *   2) POST user.auth.xboxlive.com → XBL token
 *   3) POST xsts.auth.xboxlive.com → XSTS token
 *   4) POST api.minecraftservices.com/authentication/login_with_xbox → MC token
 *   5) GET  api.minecraftservices.com/minecraft/profile → { id, name }
 */
export function addMicrosoftAccount(
  state: AccountsState,
  profile: { uuid: string; username: string },
  tokens: MicrosoftTokens,
  /** Callback que grava tokens no keytar (cofre do SO). */
  saveSecret: (accountId: string, tokens: MicrosoftTokens) => Promise<void>,
): Promise<AccountsState> {
  const account: Account = {
    id: profile.uuid,
    type: "microsoft",
    username: profile.username,
    uuid: profile.uuid,
    avatarUrl: minecraftHeadUrl(profile.username),
    addedAt: new Date().toISOString(),
  }
  return saveSecret(account.id, tokens).then(() => {
    const deduped = state.accounts.filter((a) => a.id !== account.id)
    return {
      activeId: account.id,
      accounts: [...deduped, account],
    }
  })
}

export function removeAccount(state: AccountsState, id: string): AccountsState {
  const accounts = state.accounts.filter((a) => a.id !== id)
  const activeId =
    state.activeId === id ? (accounts[0]?.id ?? null) : state.activeId
  return { activeId, accounts }
}

export function setActiveAccount(state: AccountsState, id: string): AccountsState {
  if (!state.accounts.some((a) => a.id === id))
    throw new Error("Account not found.")
  return { ...state, activeId: id }
}

export function getActiveAccount(state: AccountsState): Account | null {
  return state.accounts.find((a) => a.id === state.activeId) ?? null
}

function minecraftHeadUrl(username: string): string {
  return `https://minotar.net/helm/${encodeURIComponent(username)}/64.png`
}
