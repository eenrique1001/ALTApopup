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

    // --- Headings (process longest first to avoid ## matching # of ###) ---
    text = text.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    // --- Bold and Italic (combined to avoid conflicts) ---
    // Bold: **text**
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic: *text* (but not **text** which is already bold, and avoid math like 2*3)
    text = text.replace(/([^\*]|\A)\*([^\s\*][^\*]*?[^\s\*]|[^\s\*])\*([^\*]|$)/gm, "$1<em>$2</em>$3");

    // --- Bullet lists (properly grouped) ---
    // First, mark list items
    text = text.replace(/^\s*[-•] (.+)$/gm, "<li>$1</li>");
    // Then wrap consecutive <li> tags, but only groups separated by non-list content
    text = text.replace(/(<li>.*?<\/li>)(\n(?!<li>))/gs, "<ul>$1</ul>$2");
    // Handle the last group if it ends with <li>
    text = text.replace(/(<li>.*?<\/li>)$/s, "<ul>$1</ul>");

    // --- Newlines → Paragraphs ---
    const paragraphs = text
        .split(/\n{2,}/)
        .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");

    return paragraphs;
}

document.head.appendChild(style);

let popup = null;
let activeHotkey = "F";

function extractSentence() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return "";

    const selectedText = sel.toString().trim();
    if (!selectedText) return "";

    const container = sel.anchorNode;
    if (!container) return "";

    const element = container.parentElement;
    if (!element) return "";

    const text = element.textContent;
    if (!text) return selectedText;

    const index = text.indexOf(selectedText);
    if (index === -1) return selectedText;

    // Punctuation that ends a sentence
    const ENDINGS = [".", "?", "!", "。", "？", "！"];

    // --- Find left boundary ---
    let left = index - 1;
    while (left >= 0 && !ENDINGS.includes(text[left])) {
        left--;
    }

    // --- Find right boundary ---
    let right = index + selectedText.length;
    while (right < text.length && !ENDINGS.includes(text[right])) {
        right++;
    }

    // Extract, skipping punctuation on the left
    const sentence = text.substring(left + 1, right + 1).trim();

    return sentence || selectedText;
}


async function showPopup(input) {
    const text = typeof input === "string" ? input : input.text;
    const contextSentence = typeof input === "string" ? "" : input.contextSentence;
    console.log("Showing popup for text:", text);
    console.log("With context sentence:", contextSentence);

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
            text,
            contextSentence
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

document.addEventListener("keydown", async (e) => {
    if (!matchHotkey(e, activeHotkey)) return;

    const selection = window.getSelection()?.toString()?.trim();
    if (!selection) return;

    const sentence = extractSentence();
    console.log("Context sentence:", sentence);
    console.log("Entrou"); 

    const { profiles, currentProfile } =
        await browser.storage.local.get(["profiles", "currentProfile"]);

    const useContext =
        profiles?.[currentProfile]?.useSentenceContext || false;

    showPopup({
        text: selection,
        contextSentence: useContext ? sentence : ""
    });
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


