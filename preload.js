const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld("taggingAPI", {
    getImages: (directory) => ipcRenderer.invoke("getImages", directory),
    askDirectory: () => ipcRenderer.invoke("askDirectory"),
    getDatabase: () => ipcRenderer.invoke("getDatabase"),
    storeDatabase: (database) => ipcRenderer.send("storeDatabase", database),
    addTagToAll: (images, tag) => ipcRenderer.send("addTagToAll", images, tag),
    removeTagFromAll: (images, tag) => ipcRenderer.send("removeTagFromAll", images, tag),
    renameTag: (images, oldTag, newTag) => ipcRenderer.send("renameTag", images, oldTag, newTag),
    toggleDevTools: () => ipcRenderer.send("toggleDevTools")
})