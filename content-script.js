const style = document.createElement("style");
style.textContent = `
.analyze-popup {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 350px;
    max-height: 300px;
    overflow: auto;
    padding: 15px;
    z-index: 999999;
    border-radius: 8px;
    font-family: sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.analyze-popup .popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.analyze-popup #closePopup {
    border: none;
    background: #d33;
    color: white;
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 16px;
}
`;
document.head.appendChild(style);


let popup = null;
let activeHotkey = "Shift";


/* -------------------------------------------------------
   ALWAYS LOAD THE THEME FRESH WHEN OPENING THE POPUP
   (No need to track theme updates in real time)
-------------------------------------------------------- */

async function showPopup(text) {
    // Load latest theme *RIGHT NOW*
    const { theme } = await browser.storage.local.get("theme");
    const currentTheme = theme || "light";

    // Remove old popup
    if (popup) popup.remove();

    popup = document.createElement("div");
    popup.classList.add("analyze-popup");

    popup.innerHTML = `
        <div class="popup-header">
            <strong>Analyzed Text</strong>
            <button id="closePopup">×</button>
        </div>
        <div class="popup-body"></div>
    `;

    popup.querySelector(".popup-body").textContent = text;
    popup.querySelector("#closePopup").onclick = () => popup.remove();

    document.body.appendChild(popup);

    applyTheme(currentTheme);
    enableOutsideClickClose();
}


/* -------------------------------------------------------
   APPLY THE THEME *ONLY WHEN POPUP IS CREATED*
-------------------------------------------------------- */
function applyTheme(theme) {
    if (!popup) return;

    if (theme === "dark") {
        popup.style.background = "#222";
        popup.style.color = "#fff";
        popup.style.border = "1px solid #555";
    } else {
        popup.style.background = "white";
        popup.style.color = "black";
        popup.style.border = "1px solid #888";
    }
}


/* -------------------------------------------------------
   Close popup when clicking outside
-------------------------------------------------------- */
function enableOutsideClickClose() {
    function handler(e) {
        if (!popup) return;
        if (!popup.contains(e.target)) {
            popup.remove();
            document.removeEventListener("mousedown", handler);
        }
    }
    document.addEventListener("mousedown", handler);
}


/* -------------------------------------------------------
   HOTKEY LOADING
-------------------------------------------------------- */

browser.storage.local.get(["profiles", "currentProfile"]).then(data => {
    const profile = data.profiles[data.currentProfile];
    activeHotkey = profile.hotkey || "Shift";
});

// React to profile switching
browser.storage.onChanged.addListener(changes => {
    if (changes.profiles || changes.currentProfile) {
        browser.storage.local.get(["profiles", "currentProfile"]).then(data => {
            const profile = data.profiles[data.currentProfile];
            activeHotkey = profile.hotkey || "Shift";
        });
    }
});


/* -------------------------------------------------------
   Listen for selection + hotkey
-------------------------------------------------------- */
document.addEventListener("keydown", (e) => {
    if (matchHotkey(e, activeHotkey)) {
        const selectedText = window.getSelection().toString().trim();
        if (selectedText.length > 0) {
            showPopup(selectedText);
        }
    }
});

function matchHotkey(event, hotkey) {
    const key = hotkey.toLowerCase();

    // simple keys
    if (key === "shift") return event.key === "Shift";
    if (key === "ctrl") return event.ctrlKey;
    if (key === "alt") return event.altKey;
    if (key === "meta") return event.metaKey;
    if (key === "space") return event.key === " ";

    // regular letter/number keys
    return event.key.toLowerCase() === key;
}
