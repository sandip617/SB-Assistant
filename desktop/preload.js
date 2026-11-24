// The only bridge between SB's page and the app: reading and setting "open at login". Nothing else is exposed.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sbApp', {
  getLogin: () => ipcRenderer.invoke('sb:login:get'),
  setLogin: on => ipcRenderer.invoke('sb:login:set', !!on),
});
