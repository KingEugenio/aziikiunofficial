const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aziikiDesktop", {
  getConfig: () => ipcRenderer.invoke("aziiki:get-config"),
  setConfig: (config) => ipcRenderer.invoke("aziiki:set-config", config),
});
