const style = document.createElement("style");
style.textContent = `
.analyze-popup {
    position: fixed;
    top: 20px;
    left: calc(100% - 420px);
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

#ankiControls {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

#ankiCheck {
    color: #9b59b6;
    font-weight: bold;
    display: none;
}

#ankiAddBtn {
    border-radius: 4px;
    padding: 4px 8px;
}

`;

document.head.appendChild(style);

let popup = null;
let currentDragCleanup = null;
let activeHotkey = "Shift";

// Listen for hotkey
document.addEventListener("keydown", async (e) => {
    if (!matchHotkey(e, activeHotkey)) return;

    const selection = window.getSelection()?.toString()?.trim();
    if (!selection) return;

    const sentence = extractSentence();

    const { profiles, currentProfile } =
        await browser.storage.local.get(["profiles", "currentProfile"]);

    const useContext =
        profiles?.[currentProfile]?.useSentenceContext || false;

    showPopup({
        text: selection,
        contextSentence: useContext ? sentence : ""
    });
});

function enableOutsideClickClose(onClose) {
    function handler(e) {
        if (!popup) return;
        if (!popup.contains(e.target)) {
            document.removeEventListener("mousedown", handler);
            onClose();
        }
    }
    document.addEventListener("mousedown", handler);
}

function startAnkiHeartbeat(getProfile, onStatusChange, interval = 3000) {
    let lastState = null;

    async function tick() {
        try {
            const profile = await getProfile();

            if (!profile?.useAnki || !profile?.ankiIP) {
                if (lastState !== false) {
                    lastState = false;
                    onStatusChange(false);
                }
                return;
            }

            const result = await browser.runtime.sendMessage({
                type: "test_anki",
                ip: profile.ankiIP
            });

            const connected = !!result?.success;

            if (connected !== lastState) {
                lastState = connected;
                onStatusChange(connected);
            }
        } catch {
            if (lastState !== false) {
                lastState = false;
                onStatusChange(false);
            }
        }
    }

    tick();
    return setInterval(tick, interval);
}

//Check if text already exists in Anki deck
async function checkIfInAnkiDeck(text, context) {
    try {
        const result = await browser.runtime.sendMessage({
            type: "anki_check_existing",
            text,
            context
        });
        return result.status !== "none";
    } catch {
        return false;
    }
}

function createPopupShell(theme, text) {
    const popup = document.createElement("div");
    popup.classList.add("analyze-popup");
    if (theme === "dark") popup.classList.add("dark");

    popup.innerHTML = `
        <div class="popup-header">
            <span>
                <strong>Analyzing...</strong>
                <span id="ankiControls" style="display:none;">
                        <span id="ankiCheck" title="Already in deck">✔</span>
                        <button id="ankiAddBtn" title="Add to Anki">+</button>
                        </span>
                </span>
            <button id="closePopup">×</button>
        </div>

        <div class="popup-body" id="analyze_input">${text}</div>

        <div id="aiStatus">loading...</div>
        <div class="ai-result" id="aiResult"></div>
    `;

    return popup;
}

async function showPopup(input) {
    const text = typeof input === "string" ? input : input.text;
    const contextSentence = typeof input === "string" ? "" : input.contextSentence;
    console.log("Showing popup for text:", text);
    console.log("With context sentence:", contextSentence);

    const { theme, profiles, currentProfile } =
        await browser.storage.local.get(["theme", "profiles", "currentProfile"]);
    const currentTheme = theme || "light";
    const profile = profiles?.[currentProfile] || {};

    let ankiEnabled = !!profile.useAnki;
    let aiConnected = false;
    let ankiConnected = false;
    let alreadyInDeck = false;
    let aiAnswer = "";
    let selectedText = text;
    let ankiHeartbeat = startAnkiHeartbeat(
        async () => {
            const { profiles, currentProfile } =
                await browser.storage.local.get(["profiles", "currentProfile"]);

            return profiles?.[currentProfile];
        },
        (connected) => {
            ankiConnected = connected;
            updateAnkiButton();
        },
        1000
    );

    function closePopup() {
        clearInterval(ankiHeartbeat);
        popup.remove();
    }

    if (popup) popup.remove();
    popup = createPopupShell(currentTheme, text);
    popup.querySelector("#closePopup").onclick = closePopup
    document.body.appendChild(popup);
    await applyPopupUISettings(popup);

    enableOutsideClickClose(closePopup);

    const aiStatus = popup.querySelector("#aiStatus");
    const aiResult = popup.querySelector("#aiResult");
    const ankiBtn = popup.querySelector("#ankiAddBtn");
    const ankiControls = popup.querySelector("#ankiControls");
    const ankiCheck = popup.querySelector("#ankiCheck");


    function updateAnkiButton() {
        if (!ankiEnabled || !aiConnected || !ankiConnected) {
            ankiControls.style.display = "none";
            return;
        }

        ankiControls.style.display = "inline-flex";

        if (alreadyInDeck) {
            ankiCheck.style.display = "inline";
            ankiBtn.style.background = "#9b59b6"; // purple
            ankiCheck.style.color = "#2ecc71"; // green
            ankiBtn.title = "This word or phrase is already in your deck";
        } else {
            ankiCheck.style.display = "none";
            ankiBtn.style.background = "#2ecc71"; // green
            ankiBtn.title = "Add this word or phrase to Anki";
        }
    }

    ankiBtn.onclick = async () => {
        const result = await browser.runtime.sendMessage({
            type: "add_to_anki",
            selectedText,
            contextSentence,
            aiAnswer
        });

        if (result?.success) {
            alreadyInDeck = true;
            ankiBtn.dataset.locked = "true";
            updateAnkiButton();
        } else {
            alert(result?.error || "Failed to add to Anki");
        }
    };

    try {
        const response = await browser.runtime.sendMessage({
            type: "run_ai",
            text,
            contextSentence
        });

        if (response && response.success) {
            aiAnswer = formatAIResponse(response.result);
            aiConnected = true;

            aiResult.innerHTML = aiAnswer;
            aiStatus.textContent = "done";
            popup.querySelector(".popup-header strong").textContent = "Analysis Result";

            if (ankiEnabled && profile.ankiIP && ankiConnected) {
                alreadyInDeck = await checkIfInAnkiDeck(selectedText, contextSentence);
            } else {
                alreadyInDeck = false;
            }
            updateAnkiButton();


        } else {
            aiStatus.textContent = "error";
            aiResult.textContent = response?.error || "Unknown error";
        }
    } catch (err) {
        aiStatus.textContent = "error";
        aiResult.textContent = String(err);
    }
}

// Gets profile hotkey
browser.storage.local.get(["profiles", "currentProfile"]).then(data => {
    const profile = data.profiles && data.profiles[data.currentProfile];
    activeHotkey = (profile && profile.hotkey) || "Shift";
});

// React to profile switching
browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.profiles || changes.currentProfile) {
        browser.storage.local.get(["profiles", "currentProfile"]).then(data => {
            const profile = data.profiles && data.profiles[data.currentProfile];
            activeHotkey = (profile && profile.hotkey) || "Shift";
        });
    }
    if (changes.uiSettings && popup) {
        applyPopupUISettings(popup);
    }
});

// Listen to context menu show message
browser.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "show_analysis_popup") {
        showPopup(msg.text);
    }
});