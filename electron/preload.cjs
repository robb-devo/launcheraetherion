const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("aetherion", {
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  },
  launch: {
    start: (args) => ipcRenderer.invoke("launch:start", args),
    cancel: () => ipcRenderer.invoke("launch:cancel"),
    onProgress: (cb) => {
      const listener = (_event, progress) => cb(progress)
      ipcRenderer.on("launch:progress", listener)
      return () => ipcRenderer.off("launch:progress", listener)
    },
  },
  status: {
    realm: () => ipcRenderer.invoke("status:realm"),
    playtime: () => ipcRenderer.invoke("status:playtime"),
  },
  sandbox: {
    options: () => ipcRenderer.invoke("sandbox:options"),
    list: () => ipcRenderer.invoke("sandbox:list"),
    create: (input) => ipcRenderer.invoke("sandbox:create", input),
    start: (id) => ipcRenderer.invoke("sandbox:start", id),
    stop: (id) => ipcRenderer.invoke("sandbox:stop", id),
    remove: (id) => ipcRenderer.invoke("sandbox:remove", id),
    restart: (id) => ipcRenderer.invoke("sandbox:restart", id),
    inspect: (id) => ipcRenderer.invoke("sandbox:inspect", id),
    plugins: () => ipcRenderer.invoke("sandbox:plugins"),
  },
  accounts: {
    list: () => ipcRenderer.invoke("accounts:list"),
    addOffline: (username) => ipcRenderer.invoke("accounts:addOffline", username),
    addMicrosoft: () => ipcRenderer.invoke("accounts:addMicrosoft"),
    remove: (id) => ipcRenderer.invoke("accounts:remove", id),
    setActive: (id) => ipcRenderer.invoke("accounts:setActive", id),
    getDataPath: () => ipcRenderer.invoke("accounts:getDataPath"),
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    update: (patch) => ipcRenderer.invoke("settings:update", patch),
    getPaths: () => ipcRenderer.invoke("settings:getPaths"),
    openInstanceFolder: () => ipcRenderer.invoke("settings:openInstanceFolder"),
  },
  java: {
    detect: () => ipcRenderer.invoke("java:detect"),
    chooseExecutable: () => ipcRenderer.invoke("java:chooseExecutable"),
  },
  launcher: {
    openDataDirectory: () => ipcRenderer.invoke("launcher:openDataDirectory"),
    openLogsDirectory: () => ipcRenderer.invoke("launcher:openLogsDirectory"),
    clearCache: () => ipcRenderer.invoke("launcher:clearCache"),
    verifyIntegrity: () => ipcRenderer.invoke("launcher:verifyIntegrity"),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  },
  updater: {
    get: () => ipcRenderer.invoke("updater:get"),
    check: () => ipcRenderer.invoke("updater:check"),
    install: () => ipcRenderer.invoke("updater:install"),
    onState: (cb) => {
      const listener = (_event, next) => cb(next)
      ipcRenderer.on("updater:state", listener)
      return () => ipcRenderer.off("updater:state", listener)
    },
  },
  minecraft: {
    versions: () => ipcRenderer.invoke("minecraft:versions"),
  },
  instances: {
    list: () => ipcRenderer.invoke("instances:list"),
    select: (id) => ipcRenderer.invoke("instances:select", id),
    remove: (id) => ipcRenderer.invoke("instances:remove", id),
    mods: (id) => ipcRenderer.invoke("instances:mods", id),
    removeMod: (id, filename) => ipcRenderer.invoke("instances:removeMod", { id, filename }),
    open: (id) => ipcRenderer.invoke("instances:open", id),
    install: (input) => ipcRenderer.invoke("instances:install", input),
    ensurePack: (input) => ipcRenderer.invoke("instances:ensurePack", input),
    onProgress: (cb) => {
      const listener = (_event, progress) => cb(progress)
      ipcRenderer.on("instances:progress", listener)
      return () => ipcRenderer.off("instances:progress", listener)
    },
  },
  modrinth: {
    search: (query) => ipcRenderer.invoke("modrinth:search", query),
    versions: (projectId) => ipcRenderer.invoke("modrinth:versions", projectId),
  },
  mods: {
    listPack: () => ipcRenderer.invoke("mods:listPack"),
    listDropins: () => ipcRenderer.invoke("mods:listDropins"),
    addDropins: () => ipcRenderer.invoke("mods:addDropins"),
    setOptional: (path, enabled) => ipcRenderer.invoke("mods:setOptional", { path, enabled }),
    setDropinEnabled: (filename, enabled) =>
      ipcRenderer.invoke("mods:setDropinEnabled", { filename, enabled }),
    removeDropin: (filename) => ipcRenderer.invoke("mods:removeDropin", filename),
    openDropinFolder: () => ipcRenderer.invoke("mods:openDropinFolder"),
  },
})
