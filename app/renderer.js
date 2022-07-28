function $(element) {
    return document.getElementById(element);
}

var imagesPerRow = 4;
var database;
var viewingImage = false;
var activeFolder;
var images;
var searchScrollY;
var notificationTimeout;
var highlightedSuggestionIndex;

async function main() {
    database = await getDatabase();
    if (await getActiveFolder()) {
        images = await getImages();
        verifyFolderInDatabase(activeFolder, images);
        displayImages(images)
    }
}

async function displayImages(images) {
    while ($("image-window").childNodes.length !== 0) {
        $("image-window").childNodes[0].remove();
    }
    let currentRow;
    images.forEach(function(path, index) {
        if (index % imagesPerRow === 0) {
            currentRow = document.createElement("div");
            currentRow.classList.add("flex", "row", "image-row");
            $("image-window").appendChild(currentRow);
        }
        let imageContainer = document.createElement("div");
        imageContainer.classList.add("image-container")
        let image = document.createElement("img");
        image.classList.add("image")
        image.setAttribute("src", path);
        imageContainer.appendChild(image);
        currentRow.appendChild(imageContainer);
        image.addEventListener("click", handleImageClick);
    });

    // if the last row was not full, fill it with blank spaces and put it in with the rest
    if (images.length % imagesPerRow !== 0) {
        for (let i = images.length; i % imagesPerRow !== 0; i++) {
            let imageContainer = document.createElement("div");
            imageContainer.classList.add("image-container")
            currentRow.appendChild(imageContainer);
        }
        $("image-window").appendChild(currentRow);
    }
}

async function getDatabase() {
    return await window.taggingAPI.getDatabase()
}

async function storeDatabase() {
    window.taggingAPI.storeDatabase(database);
}

async function getActiveFolder() {
    if (database["activeFolder"] !== "") {
        activeFolder = database["activeFolder"];
        return true;
    }
    else {
        if (await setActiveFolder()) {
            activeFolder = database["activeFolder"];
            return true;
        }
        else {
            return false;
        }        
    }
}

async function setActiveFolder() {
    let askResult = await window.taggingAPI.askDirectory();
    if (!askResult.canceled) {
        database["activeFolder"] = askResult.filePaths[0].replace(/\\/g, "/");
        activeFolder = askResult.filePaths[0].replace(/\\/g, "/");
        images = await getImages();
        verifyFolderInDatabase(activeFolder, images);
        storeDatabase();
        return true;
    }
    else {
        return false;
    }
}

async function getImages() {
    return await window.taggingAPI.getImages(activeFolder);
}

function verifyFolderInDatabase(directory, images) {
    if (!Object.hasOwn(database["folders"], directory)) {
        database["folders"][directory] = {};
        images.forEach(function(path) {
            if (!Object.hasOwn(database["folders"][directory], path)) {
                database["folders"][directory][path] = [];
            }
        });
    }
}

function handleImageClick(event) {
    searchScrollY = window.scrollY;
    $("search-screen").classList.add("hide");
    $("image-screen").classList.remove("hide");
    $("image-screen-image").setAttribute("src", event.target.getAttribute("src"));
    let imageSize = $("image-screen-image").getBoundingClientRect();
    if (imageSize.height < 936) {
        $("image-screen-image-container").setAttribute("style", "height: " + imageSize.height + "px !important;");
    }
    window.scrollTo(0, 0);
    displayTags();
    closeSidebar();
    viewingImage = true;
}

$("image-screen-image").addEventListener("click", function(event) {
    fetch(event.target.getAttribute("src")).then(function(response) {
        response.blob().then(function(blob) {
            let imageSource = URL.createObjectURL(blob);
            let imageElement = document.createElement("img");
            imageElement.crossOrigin = "anonymous";
            imageElement.src = imageSource;
            imageElement.onload = function(event) {
                let imageElement = event.target;
                let canvas = document.createElement("canvas");
                let context = canvas.getContext("2d");
                if (context) {
                    let { width, height } = imageElement;
                    canvas.width = width;
                    canvas.height = height;
                    context.drawImage(imageElement, 0, 0, width, height);
                    canvas.toBlob(function(blob) {
                        navigator.clipboard.write([
                            new ClipboardItem({
                                'image/png': blob   
                            })
                        ]);
                        showNotification("Copied image to clipboard!");
                    }, "image/png", 1)
                }
            }
        }).catch(function() {
            showNotification("Error: cannot copy animated image");
        });;
    })
});


function addTag(image, tag) {
    database["folders"][activeFolder][image].push(tag);
    database["folders"][activeFolder][image] = cleanTags(database["folders"][activeFolder][image]);
    storeDatabase();
    updateSearch();
}

function removeTag(image, tag) {
    database["folders"][activeFolder][image].splice(database["folders"][activeFolder][image].indexOf(tag), 1);
    storeDatabase();
    updateSearch();
}

function getTags(image) {
    return database["folders"][activeFolder][image];
}

function getAllTags(images) {
    let tags = [];
    images.forEach(function(image) {
        getTags(image).forEach(function(imageTag) {
            let exists = false;
            tags.forEach(function(tag) {
                if (tag.tag == imageTag) {
                    exists = true;
                }
            });
            if (exists) {
                tags.forEach(function(tag) {
                    if (tag.tag ===  imageTag) {
                        tag.count++;
                    }
                });
            }
            else {
                tags.push({
                    tag: imageTag,
                    count: 1
                });
            }
        });
    });
    tags.sort(function(a, b) { // sort primarily by occurance rate, secondarily alphanumerically
        if (a.count > b.count) {
            return -1;
        }
        else if (a.count < b.count) {
            return 1;
        }
        else {
            alphaSort = [a.tag, b.tag].sort();
            if (alphaSort[0] === a.tag) {
                return -1;
            }
            else {
                return 1;
            }
        }
    });
    return tags;
}

function cleanTags(tagList) {
    let cleanedTags = [];
    tagList.forEach(function(tag) {
        if (!cleanedTags.includes(tag)) {
            cleanedTags.push(tag);
        }
    });
    cleanedTags.sort();
    return cleanedTags;
}

function handleAddTag(event) {
    if (event.type === "click" || (event.type === "keydown" && event.code === "Enter" && $("tag-add-suggestor").classList.contains("hide"))) {
        let tag = $("tag-input").value;
        if (viewingImage && tag !== "") {
            tag = tag.trim(" ").split(" ");
            tag.forEach(function(tag) {
                addTag($("image-screen-image").getAttribute("src"), tag);
            });
            displayTags();
            $("tag-input").value = "";
        }
        else {
            showNotification("Error: cannot add empty tag");
        }
    }
}

$("tag-add").addEventListener("click", handleAddTag);

$("tag-input").addEventListener("keydown", handleAddTag);

function displayTags() {
    while ($("tags").childNodes.length !== 0) {
        $("tags").childNodes[0].remove();
    }
    getTags($("image-screen-image").getAttribute("src")).forEach(function(tag) {
        let tagNode = document.createElement("span");
        tagNode.innerHTML = tag;
        tagNode.addEventListener("click", handleTagClicked);
        $("tags").appendChild(tagNode);
    });
}

function handleTagClicked(event) {
    removeTag($("image-screen-image").getAttribute("src"), event.target.innerHTML);
    displayTags();
}

document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
        let performedAction = false;
        if (viewingImage) {
            closeImageViewer();
            $("tag-input").value = "";
            performedAction = true;
        }
        if (!performedAction) {
            Array.from(document.getElementsByClassName("tag-suggestor")).forEach(function(suggestions) {
                let suggestee = $(suggestions.getAttribute("suggestee"));
                if (document.activeElement === suggestee) {
                    if (!suggestions.classList.contains("hide")) {
                        closeSuggestor(suggestions);
                    }
                    else {
                        suggestee.blur();
                    }
                }
            });
            performedAction = true;
        }
        if (!performedAction && $("add-remove-popup").classList.contains("hide") && $("rename-popup").classList.contains("hide")) {
            toggleSidebar();
            performedAction = true;
        }
        if (!performedAction && !$("add-remove-popup").classList.contains("hide")) {
            document.dispatchEvent(new CustomEvent("addRemovePopupFinish", {
                detail: {
                    cancelled: true
                }
            }));
            performedAction = true;
        }
        if (!performedAction && !$("rename-popup").classList.contains("hide")) {
            document.dispatchEvent(new CustomEvent("renamePopupFinish", {
                detail: {
                    cancelled: true
                }
            }));
            performedAction = true;
        }
    }
});

document.addEventListener("click", function(event) {
    closeNotificationPopup();
    Array.from(document.getElementsByClassName("tag-suggestor")).forEach(function(suggestions) {
        let outsideSearch = true;
        event.composedPath().forEach(function(element) {
            if ([suggestions.getAttribute("suggestee"), suggestions].includes(element)) {
                outsideSearch = false;
            }
        })
        if (outsideSearch) {
            closeSuggestor(suggestions);
        }
    });
});

function closeImageViewer() {
    $("image-screen").classList.add("hide");
    $("search-screen").classList.remove("hide");
    window.scrollTo(window.scrollX, searchScrollY);
    $("image-screen-image-container").setAttribute("style", "");
    viewingImage = false;
}

Array.from(document.getElementsByClassName("tag-suggestor")).forEach(function(suggestor) {
    $(suggestor.getAttribute("suggestee")).addEventListener("keydown", function(event) {
        let suggestor = $(event.target.getAttribute("suggestor"));
        if (event.key === "Tab" && document.activeElement === event.target) {
            event.preventDefault();
        }
        if (event.key === "Enter" || event.key === "Tab") {
            if (suggestor.childNodes.length - 1 >= highlightedSuggestionIndex) {
                handleClickSuggestion(undefined, suggestor.childNodes[highlightedSuggestionIndex * 2].suggestion, event.target);
            }
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            highlightSuggestion(suggestor, highlightedSuggestionIndex - 1);
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            highlightSuggestion(suggestor, highlightedSuggestionIndex + 1);
        }
        if (event.code === "Space" && event.ctrlKey) {
            event.preventDefault();
            handleSuggesteeChange(undefined, event.target.value, $(event.target.getAttribute("suggestor")), true)
        }
    });
});

function handleSuggesteeChange(event, manualQuery, manualSuggestor, forceOpen) {
    let suggestor;
    let query;
    if (event) {
        query = event.target.value;
        suggestor = $(event.target.getAttribute("suggestor"));
    }
    else {
        query = manualQuery
        suggestor = manualSuggestor;
    }
    let allTags = getAllTags(images);
    let sortedTags = [];
    allTags.forEach(function(tag) {
        sortedTags.push(tag.tag);
    });
    let lastQuery;
    let completables;
    if (query.endsWith(" ")) {
        lastQuery = "";
        completables = [];
        sortedTags.forEach((tag) => {
            completables.push({
                completable: tag,
                location: 0
            });
        });
    }
    else {
        lastQuery = query.trim(" ").split(" ").at(-1);
        completables = getListOfCompletables(lastQuery, sortedTags);
    }
    let suggestions = [];
    completables.forEach(function(completable, index) {
        // if (index < 5) {
            let text;
            if (suggestor.getAttribute("show-count") === "true") {
                text = completable.completable + " (" + allTags.find(function(tag) {return tag.tag == completable.completable;}).count + ")";
            }
            else {
                text = completable.completable;
            }
            suggestions.push({
                searchText: completable.completable,
                text: text,
                highlight: {
                    start: completable.location,
                    end: completable.location + lastQuery.length
                }
            });
        // }
    });
    // let suggestionsContainsQuery = false;
    // suggestions.forEach(function(suggestion) { // determine whether the tag being typed is equal to any existing tag, then hide it (in the next if statement)
    //     if (suggestion.searchText === lastQuery) {
    //         suggestionsContainsQuery = true;
    //     }
    // });
    // if ((forceOpen || query !== "" && !query.endsWith(" ")) && !suggestionsContainsQuery && suggestions.length !== 0) {
    if ((forceOpen || query !== "" && !query.endsWith(" ")) && suggestions.length !== 0) {
        openSuggestor(suggestor);
        showSuggestions(suggestor, suggestions)
        highlightSuggestion(suggestor, 0);
    }
    else {
        showSuggestions(suggestor, []);
        closeSuggestor(suggestor);
    }
    if ($(suggestor.getAttribute("suggestee")) === $("search")) {
        search(query);
    }
}

Array.from(document.getElementsByClassName("tag-suggestor")).forEach(function(suggestor) {
    $(suggestor.getAttribute("suggestee")).addEventListener("input", handleSuggesteeChange);
});

function search(query) {
    if (query === "") {
        displayImages(images);
    }
    else {
        let queryTags = query.trim(" ").split(" ");
        let filteredImages = [];
        images.forEach(function(image) {
            let matchesQuery = true;
            let imageTags = getTags(image);
            queryTags.forEach(function(tag) {
                if (!imageTags.includes(tag)) {
                    matchesQuery = false;
                }
            });
            if (matchesQuery) {
                filteredImages.push(image);
            }
        });
        displayImages(filteredImages);
    }
}

function updateSearch() {
    search($("search").value);
}

function openSidebar() {
    $("sidebar-open").classList.add("hide");
    $("sidebar").classList.remove("hide");
}

function closeSidebar() {
    $("sidebar").classList.add("hide");
    $("sidebar-open").classList.remove("hide");
}

function toggleSidebar() {
    if ($("sidebar").classList.contains("hide")) {
        openSidebar();
    }
    else {
        closeSidebar();
    }
}

$("sidebar-open").addEventListener("click", toggleSidebar);

$("sidebar-close").addEventListener("click", toggleSidebar);

$("open-folder").addEventListener("click", async function(event) {
    closeSidebar();
    await setActiveFolder();
    displayImages(images);
});

async function openNotificationPopup() {
    $("notification-popup").classList.remove("hide");
}

async function closeNotificationPopup() {
    $("notification-popup").classList.add("hide");
    clearTimeout(notificationTimeout);
}

async function editNotificationPopup(text) {
    $("notification-popup").innerHTML = text;
}

async function showNotification(text) {
    clearTimeout(notificationTimeout);
    editNotificationPopup(text);
    openNotificationPopup();
    notificationTimeout = setTimeout(closeNotificationPopup, 2000);
}

async function addTagToAll(images, tag) {
    await window.taggingAPI.addTagToAll(images, tag);
    database = await getDatabase();
    updateSearch();
}

async function removeTagFromAll(images, tag) {
    await window.taggingAPI.removeTagFromAll(images, tag);
    database = await getDatabase();
    updateSearch();
}

async function renameTag(images, oldTag, newTag) {
    await window.taggingAPI.renameTag(images, oldTag, newTag);
    database = await getDatabase();
    updateSearch();
}

function openAddRemovePopup() {
    $("add-remove-popup").classList.remove("hide");
    $("add-remove-popup-input").focus();
}

function closeAddRemovePopup() {
    $("add-remove-popup").classList.add("hide");
}

async function popupAddRemove() {
    return new Promise(function(resolve, reject) {
        document.addEventListener("addRemovePopupFinish", function(event) {
            if (!event.detail.cancelled) {
                resolve($("add-remove-popup-input").value);
            }
            else {
                reject(new Error("User cancelled"));
            }
            $("add-remove-popup-input").value = "";
        }, {
            once: true
        });
    });
}

$("add-remove-popup-ok").addEventListener("click", function(event) {
    document.dispatchEvent(new CustomEvent("addRemovePopupFinish", {
        detail: {
            cancelled: false
        }
    }));
});

$("add-remove-popup-cancel").addEventListener("click", function(event) {
    document.dispatchEvent(new CustomEvent("addRemovePopupFinish", {
        detail: {
            cancelled: true
        }
    }));
});

$("add-remove-popup-input").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        document.dispatchEvent(new CustomEvent("addRemovePopupFinish", {
            detail: {
                cancelled: false
            }
        }));
    }
});

$("batch-add-tag").addEventListener("click", async function(event) {
    document.dispatchEvent(new CustomEvent("renamePopupFinish", {
        detail: {
            cancelled: true
        }
    }));
    let handleInputCancelledAdd;
    $("add-remove-popup-label").innerHTML = "Enter tag to add:";
    openAddRemovePopup();
    closeSidebar();
    popupAddRemove().then(function handleInputRecievedAdd(tag) {
        if (tag !== "") {
            closeAddRemovePopup();
            tag = tag.trim(" ").split(" ");
            tag.forEach(function(tag) {
                addTagToAll(images, tag);
            });
        }
        else {
            showNotification("Error: cannot add empty tag");
            popupAddRemove().then(handleInputRecievedAdd).catch(handleInputCancelledAdd);
        }
    }).catch(handleInputCancelledAdd = function(error) {
        closeAddRemovePopup();
    });
});

$("batch-remove-tag").addEventListener("click", async function(event) {
    document.dispatchEvent(new CustomEvent("renamePopupFinish", {
        detail: {
            cancelled: true
        }
    }));
    let handleInputCancelledRemove;
    $("add-remove-popup-label").innerHTML = "Enter tag to remove:";
    openAddRemovePopup();
    closeSidebar();
    popupAddRemove().then(function handleInputRecievedRemove(tag) {
        if (tag !== "") {
            closeAddRemovePopup();
            tag = tag.trim(" ").split(" ");
            tag.forEach(function(tag) {
                removeTagFromAll(images, tag);
            });
        }
        else {
            showNotification("Error: cannot remove empty tag");
            popupAddRemove().then(handleInputRecievedRemove).catch(handleInputCancelledRemove);
        }
    }).catch(handleInputCancelledRemove = function(error) {
        closeAddRemovePopup();
    });
})

function openRenamePopup() {
    $("rename-popup").classList.remove("hide");
    $("rename-popup-old-tag").focus();
}

function closeRenamePopup() {
    $("rename-popup").classList.add("hide");
}

async function popupRename() {
    return new Promise(function(resolve, reject) {
        document.addEventListener("renamePopupFinish", function(event) {
            if (!event.detail.cancelled) {
                resolve({
                    old: $("rename-popup-old-tag").value,
                    new: $("rename-popup-new-tag").value
                });
            }
            else {
                reject(new Error("User cancelled"));
            }
            $("rename-popup-old-tag").value = "";
            $("rename-popup-new-tag").value = "";
        }, {
            once: true
        });
    });
}

function handleRenameInputKeydown(event) {
    if (event.key === "Enter") {
        document.dispatchEvent(new CustomEvent("renamePopupFinish", {
            detail: {
                cancelled: false
            }
        }));
    }
}

$("rename-popup-old-tag").addEventListener("keydown", handleRenameInputKeydown);

$("rename-popup-new-tag").addEventListener("keydown", handleRenameInputKeydown);

$("rename-popup-ok").addEventListener("click", function(event) {
    document.dispatchEvent(new CustomEvent("renamePopupFinish", {
        detail: {
            cancelled: false
        }
    }));
});

$("rename-popup-cancel").addEventListener("click", function(event) {
    document.dispatchEvent(new CustomEvent("renamePopupFinish", {
        detail: {
            cancelled: true
        }
    }));
});

$("rename-tag").addEventListener("click", async function(event) {
    document.dispatchEvent(new CustomEvent("addRemovePopupFinish", {
        detail: {
            cancelled: true
        }
    }));
    let handleInputCancelledRemove;
    openRenamePopup();
    closeSidebar();
    popupRename().then(function handleInputRecievedRemove(tags) {
        if (!tags.old.includes(" ") && !tags.new.includes(" ")) {
            if (tags.old !== "" && tags.new !== "") {
                closeRenamePopup();
                renameTag(images, tags.old, tags.new);
            }
            else if (tags.old === "") {
                showNotification("Error: cannot rename empty tag");
                popupRename().then(handleInputRecievedRemove).catch(handleInputCancelledRemove);
            }
            else if (tags.new === "") {
                showNotification("Error: cannot rename tag to empty");
                popupRename().then(handleInputRecievedRemove).catch(handleInputCancelledRemove);
            }
        }
        else {
            showNotification("Error: inputs may only consist of one tag");
            popupRename().then(handleInputRecievedRemove).catch(handleInputCancelledRemove);
        }
    }).catch(handleInputCancelledRemove = function(error) {
        closeRenamePopup();
    });
})

function openSuggestor(suggestor) {
    suggestor.classList.remove("hide");
    suggestor.scrollTo(0, 0);
}

function closeSuggestor(suggestor ) {
    suggestor.classList.add("hide");
}

function showSuggestions(suggestor, suggestions) {
    while (suggestor.childNodes.length !== 0) {
        suggestor.childNodes[0].remove();
    }
    suggestions.forEach(function(suggestion, count) {
        let suggestionDiv = document.createElement("div");
        suggestionDiv.addEventListener("click", handleClickSuggestion);
        suggestionDiv.suggestion = suggestion.searchText;
        if (suggestion.highlight.start === suggestion.highlight.end) {
            suggestionDiv.innerHTML = suggestion.text;
        }
        else {
            let preHighlight = document.createTextNode(suggestion.text.slice(0, suggestion.highlight.start));
            let highlight = document.createElement("span");
            highlight.classList.add("highlight");
            highlight.innerHTML = suggestion.text.slice(suggestion.highlight.start, suggestion.highlight.end);
            let postHighlight = document.createTextNode(suggestion.text.slice(suggestion.highlight.end, suggestion.text.length));
            suggestionDiv.appendChild(preHighlight);
            suggestionDiv.appendChild(highlight);
            suggestionDiv.appendChild(postHighlight);
        }
        if (0 < count) {
            let separator = document.createElement("div");
            separator.classList.add("suggestion-separator");
            suggestor.appendChild(separator);
        }
        suggestor.appendChild(suggestionDiv);
    });
}

function getListOfCompletables(query, possibilities) {
    let completables = [];
    possibilities.forEach(function(possibility) {
        let queryIndex = possibility.indexOf(query);
        if (queryIndex === 0) {
            completables.push({
               completable: possibility,
               location: queryIndex
            });
        }
    });
    return completables;
}

async function handleClickSuggestion(event, manualSuggestion, manualSuggestee) {
    let suggestionText;
    let suggestee;
    if (event) {
        suggestionText = event.target.suggestion;
        suggestee = $(event.target.parentElement.getAttribute("suggestee"));
    }
    else {
        suggestionText = manualSuggestion;
        suggestee = manualSuggestee
    }
    if (!$(suggestee.getAttribute("suggestor")).classList.contains("hide")) {
        suggestee.focus();
        let currentSearch = suggestee.value;
        let currentSearchTags = currentSearch.trim(" ").split(" ");
        let lastQuery = currentSearch.at(-1);
        suggestee.value = "";
        currentSearchTags.forEach(function(tag, index) {
            if (index !== currentSearchTags.length - 1) {
                suggestee.value += tag + " ";
            }
        });
        suggestee.value += suggestionText;
        handleSuggesteeChange(undefined, suggestee.value, $(suggestee.getAttribute("suggestor")), false);
        closeSuggestor($(suggestee.getAttribute("suggestor")));
    }
}

function highlightSuggestion(suggestor, index) {
    if (0 <= index && index <= ((suggestor.childNodes.length - 1) / 2)) {
        highlightedSuggestionIndex = index;
        suggestor.childNodes.forEach(function(child) {
            child.classList.remove("highlight");
        })
        suggestor.childNodes[index * 2].classList.add("highlight");
    }
}

document.addEventListener("mousemove", function(event) {
    Array.from(document.getElementsByClassName("tag-suggestor")).forEach(function(suggestor) {
        let onSuggestion = false;
        let suggestionIndex;
        suggestor.childNodes.forEach(function(suggestion, index) {
            if (event.target === suggestion && !event.target.classList.contains("suggestion-separator")) {
                onSuggestion = true;
                suggestionIndex = index / 2;
            }
        });
        if (onSuggestion) {
            highlightSuggestion(suggestor, suggestionIndex);
        }
    });
});


main();