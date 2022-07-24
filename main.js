// Modules to control application life and create native browser window
const electron = require('electron');
const { BrowserWindow, app, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: electron.screen.getPrimaryDisplay().size.width,
        height: electron.screen.getPrimaryDisplay().size.height,
        // fullscreen: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.setMenu(null);
    mainWindow.maximize();
    // mainWindow.focus();
    
    // and load the index.html of the app.
    mainWindow.loadFile('index.html');
    
    // Open the DevTools.
    mainWindow.webContents.openDevTools();

    return mainWindow
}

async function getDatabase() {
    if (fs.existsSync(path.join(__dirname, "database.json"))) {
        return await JSON.parse(fs.readFileSync(path.join(__dirname, "database.json")));
    }
    else {
        return {"activeFolder": "", "folders": {}};
    }
}

async function storeDatabase(event, database) {
    fs.writeFileSync(path.join(__dirname, "database.json"), JSON.stringify(database, null, 4));
}

function cleanTags(tagList) {
    let cleanedTags = [];
    tagList.forEach(function(tag) {
        if (cleanedTags.indexOf(tag) < 0) {
            cleanedTags.push(tag);
        }
    });
    cleanedTags.sort();
    return cleanedTags;
}

function addTag(database, image, tag) {
    database["folders"][database["activeFolder"]][image].push(tag);
    database["folders"][database["activeFolder"]][image] = cleanTags(database["folders"][database["activeFolder"]][image]);
}

function removeTag(database, image, tag) {
    database["folders"][database["activeFolder"]][image].splice(database["folders"][database["activeFolder"]][image].indexOf(tag), 1);
}

function getTags(database, image) {
    return database["folders"][database["activeFolder"]][image];
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    const mainWindow = createWindow();

    ipcMain.handle("getImages", async function(event, directory) {
        let files = fs.readdirSync(directory);
        let images = [];
        files.forEach(function(fileName) {
            if ([".apng", ".avif", ".gif", ".jjif", ".jpeg", ".jpg", ".png", ".svg", "webp"].indexOf(path.extname(fileName)) >= 0) {
                images.push(path.join(directory, fileName).replace(/\\/g, "/"));
            }
        });
        return images;
    });

    ipcMain.handle("askDirectory", async function() {
        return dialog.showOpenDialog(mainWindow, {
            properties: ["openDirectory"]
        });
    });

    ipcMain.handle("getDatabase", getDatabase);

    ipcMain.on("storeDatabase", storeDatabase);
    
    ipcMain.on("addTagToAll", async function(event, images, tag) {
        let database = await getDatabase();
        images.forEach(function(image) {
            addTag(database, image, tag);
        });
        storeDatabase(null, database);
    });
    
    ipcMain.on("removeTagFromAll", async function(event, images, tag) {
        let database = await getDatabase();
        images.forEach(function(image) {
            removeTag(database, image, tag);
        });
        storeDatabase(null, database);
    });
    
    ipcMain.on("renameTag", async function(event, images, oldTag, newTag) {
        let database = await getDatabase();
        images.forEach(function(image) {
            if (getTags(database, image).includes(oldTag)) {
                removeTag(database, image, oldTag);
                addTag(database, image, newTag);
            }
        });
        storeDatabase(null, database);
    });

    app.on('activate', function() {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    
    
    // mainWindow.webContents.send("log", "hello from app.js");
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


