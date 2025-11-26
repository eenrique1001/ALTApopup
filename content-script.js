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
document.head.appendChild(style)

let popup = null;
let currentTheme = "light";

// Load theme on startup
browser.storage.local.get("theme").then(data => {
    currentTheme = data.theme || "light";
});

// Listen for theme update messages
browser.runtime.onMessage.addListener((msg) => {
    if (msg.type === "show_analysis_popup") {
        showPopup(msg.text);
    }
    if (msg.type === "update_theme") {
        currentTheme = msg.theme;
        applyTheme();
    }
});

function showPopup(text) {
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

    applyTheme();
    enableOutsideClickClose();
}

function applyTheme() {
    if (!popup) return;

    if (currentTheme === "dark") {
        popup.style.background = "#222";
        popup.style.color = "#fff";
        popup.style.border = "1px solid #555";
    } else {
        popup.style.background = "white";
        popup.style.color = "black";
        popup.style.border = "1px solid #888";
    }
}

// Close popup when clicking outside
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
