browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
        id: "analyze-text",
        title: "Analyze selected text",
        contexts: ["selection"]
    });
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "analyze-text") {

        const selectedText = info.selectionText || "";

        // send message to content script running in the page
        browser.tabs.sendMessage(tab.id, {
            type: "show_analysis_popup",
            text: selectedText
        });
    }
});

