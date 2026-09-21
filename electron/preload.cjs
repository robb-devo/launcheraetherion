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
  mods: {
    listDropins: () => ipcRenderer.invoke("mods:listDropins"),
    addDropins: () => ipcRenderer.invoke("mods:addDropins"),
    setOptional: (path, enabled) => ipcRenderer.invoke("mods:setOptional", { path, enabled }),
    setDropinEnabled: (filename, enabled) =>
      ipcRenderer.invoke("mods:setDropinEnabled", { filename, enabled }),
    removeDropin: (filename) => ipcRenderer.invoke("mods:removeDropin", filename),
    openDropinFolder: () => ipcRenderer.invoke("mods:openDropinFolder"),
  },
})
