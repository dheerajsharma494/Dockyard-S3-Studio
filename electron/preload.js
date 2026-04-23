const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("dockyardDesktop", {
  isDesktop: true,
});
