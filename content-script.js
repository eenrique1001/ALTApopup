/* content-script.js — updated (no AI button, auto-run) */

const style = document.createElement("style");
style.textContent = `
.analyze-popup {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 400px;
    max-height: 400px;
    overflow: auto;
    padding: 15px;
    z-index: 999999;
    border-radius: 8px;
    font-family: sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    background: white;
    color: black;
}

.analyze-popup.dark {
    background: #222;
    color: #fff;
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

.analyze-popup .popup-body {
    margin-top: 10px;
    white-space: pre-wrap;
}

.analyze-popup .ai-result {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px dashed rgba(0,0,0,0.1);
    white-space: pre-wrap;
}

#aiStatus {
    font-size: 12px;
    color: gray;
    margin-top: 4px;
}
`;

function formatAIResponse(text) {
    if (!text) return "";

    // Escape HTML (so AI output cannot break your popup)
    text = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // --- Code blocks (``` ... ```) ---
    text = text.replace(/```([\s\S]*?)```/g, (m, code) => {
        return `<pre class="code-block"><code>${code.trim()}</code></pre>`;
    });

    // --- Inline code (`code`) ---
    text = text.replace(/`([^`]+)`/g, `<code>$1</code>`);

    // --- Bold ---
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // --- Italic ---
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // --- Headings ---
    text = text.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    // --- Bullet lists ---
    text = text.replace(/^\s*[-•] (.+)$/gm, "<li>$1</li>");
    text = text.replace(/(<li>[\s\S]+?<\/li>)/g, "<ul>$1</ul>");

    // --- Newlines → Paragraphs ---
    const paragraphs = text
        .split(/\n{2,}/)
        .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");

    return paragraphs;
}

document.head.appendChild(style);

let popup = null;
let activeHotkey = "Shift";

/* showPopup now auto-runs AI immediately */
async function showPopup(text) {
    const { theme } = await browser.storage.local.get("theme");
    const currentTheme = theme || "light";

    if (popup) popup.remove();

    popup = document.createElement("div");
    popup.classList.add("analyze-popup");
    if (currentTheme === "dark") popup.classList.add("dark");

    popup.innerHTML = `
        <div class="popup-header">
            <strong>Analyzing...</strong>
            <button id="closePopup">×</button>
        </div>

        <div class="popup-body" id="analyze_input">${text}</div>

        <div id="aiStatus">loading...</div>
        <div class="ai-result" id="aiResult"></div>
    `;

    popup.querySelector("#closePopup").onclick = () => popup.remove();
    document.body.appendChild(popup);
    enableOutsideClickClose();

    const aiStatus = popup.querySelector("#aiStatus");
    const aiResult = popup.querySelector("#aiResult");

    // 🔥 Run AI immediately when popup shows
    try {
        const response = await browser.runtime.sendMessage({
            type: "run_ai",
            text
        });

        if (response && response.success) {
            aiResult.innerHTML = formatAIResponse(response.result);
            aiStatus.textContent = "done";
            popup.querySelector(".popup-header strong").textContent = "Analysis Result";
        } else {
            aiStatus.textContent = "error";
            aiResult.textContent = response?.error || "Unknown error";
        }
    } catch (err) {
        aiStatus.textContent = "error";
        aiResult.textContent = String(err);
    }
}

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

/* HOTKEY LOADING and listener */
browser.storage.local.get(["profiles", "currentProfile"]).then(data => {
    const profile = data.profiles && data.profiles[data.currentProfile];
    activeHotkey = (profile && profile.hotkey) || "Shift";
});

// React to profile switching
browser.storage.onChanged.addListener(changes => {
    if (changes.profiles || changes.currentProfile) {
        browser.storage.local.get(["profiles", "currentProfile"]).then(data => {
            const profile = data.profiles && data.profiles[data.currentProfile];
            activeHotkey = (profile && profile.hotkey) || "Shift";
        });
    }
});

document.addEventListener("keydown", (e) => {
    if (matchHotkey(e, activeHotkey)) {
        const selectedText = window.getSelection()?.toString()?.trim();
        if (selectedText?.length > 0) {
            showPopup(selectedText);
        }
    }
});

function matchHotkey(event, hotkey) {
    const key = hotkey.toLowerCase();

    if (key === "shift") return event.key === "Shift";
    if (key === "ctrl") return event.ctrlKey;
    if (key === "alt") return event.altKey;
    if (key === "meta") return event.metaKey;
    if (key === "space") return event.key === " ";

    return event.key.toLowerCase() === key;
}

/* listen to context menu show message */
browser.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "show_analysis_popup") {
        showPopup(msg.text);
    }
});


