import {
    loadProfileFields,
    loadProfiles,
    addProfile,
    deleteProfile,
    saveProfile,
    renderProviderFields
} from "./profileManager.js";

import { initHotkeyCapture } from "./hotkeyManager.js";
import { loadTheme } from "./themeManager.js";

let ankiHeartbeat = null;
let ankiConnectedOnce = false;



// MAIN INIT
document.addEventListener("DOMContentLoaded", async () => {
    await loadTheme();
    await loadProfiles();
    initHotkeyCapture();

    // Ensure provider fields render on first load
    const provider = document.getElementById("providerSelect").value;
    renderProviderFields(provider);

    // Handle provider switch -> update fields immediately
    document.getElementById("providerSelect").onchange = async (e) => {
        const provider = e.target.value;

        renderProviderFields(provider); // empty fields, new provider layout
        await saveProfile();            // store provider choice
    };

    // Prompt, hotkey auto-save, anki tags and deck
    document.getElementById("prompt").oninput = saveProfile;
    document.getElementById("hotkeyInput").oninput = saveProfile;
    document.getElementById("useSentenceContext").onchange = saveProfile;
    document.getElementById("ankiTags").oninput = saveProfile;
    document.getElementById("ankiDeck").onchange = saveProfile;
    document.getElementById("ankiModel").onchange = saveProfile;

    setTimeout(() => {
        testAnkiConnection();
        startAnkiHeartbeat();
    }, 500);

    // Load UI settings
    const { uiSettings } = await browser.storage.local.get("uiSettings");

    document.getElementById("popupDraggable").checked =
        uiSettings?.popupDraggable || false;

    // Save when changed
    document.getElementById("popupDraggable").onchange = async (e) => {
        const { uiSettings } = await browser.storage.local.get("uiSettings");

        await browser.storage.local.set({
            uiSettings: {
                ...uiSettings,
                popupDraggable: e.target.checked
            }
        });
    };

    // Load UI settings - Popup Scale
    const scale = uiSettings?.popupScale || 100;

    const scaleInput = document.getElementById("popupScale");
    const scaleValue = document.getElementById("popupScaleValue");

    scaleInput.value = scale;
    scaleValue.textContent = scale + "%";

    scaleInput.oninput = async (e) => {
        const value = parseInt(e.target.value);

        scaleValue.textContent = value + "%";

        const { uiSettings } = await browser.storage.local.get("uiSettings");

        await browser.storage.local.set({
            uiSettings: {
                ...uiSettings,
                popupScale: value
            }
        });
    };


});

// Theme Apply button
document.getElementById("applyChanges").onclick = async () => {
    const theme = document.getElementById("themeSelect").value;
    document.body.classList.toggle("dark", theme === "dark");
    await browser.storage.local.set({ theme });
};

document.getElementById("profileSelect").addEventListener("change", () => {
    ankiConnectedOnce = false;
});

// Profile Buttons
document.getElementById("addProfile").onclick = addProfile;
document.getElementById("deleteProfile").onclick = deleteProfile;

// Test Anki Connection
async function testAnkiConnection() {
    const { profiles, currentProfile } =
        await browser.storage.local.get(["profiles", "currentProfile"]);

    const profile = profiles?.[currentProfile];

    const enabled = document.getElementById("useAnki").checked;
    const ip = document.getElementById("ankiIP").value;

    const status = document.getElementById("ankiStatus");
    const config = document.getElementById("ankiConfig");

    if (!enabled || !ip) {
        status.style.display = "none";
        config.style.display = "none";
        return;
    }

    const result = await browser.runtime.sendMessage({
        type: "test_anki",
        ip
    });

    if (result.success) {
        status.style.display = "none";
        config.style.display = "block";
        if (!ankiConnectedOnce) {
            ankiConnectedOnce = true;
            await loadAnkiConfig();
            if (profile?.ankiModel) {
                await loadModelFields();
            }
        }
    } else {
        status.style.display = "inline";
        config.style.display = "none";
        ankiConnectedOnce = false;
    }
}

function startAnkiHeartbeat() {
    if (ankiHeartbeat) return; // already running

    ankiHeartbeat = setInterval(testAnkiConnection, 1000);
}

function stopAnkiHeartbeat() {
    clearInterval(ankiHeartbeat);
    ankiHeartbeat = null;
}

document.getElementById("useAnki").onchange = async () => {
    await saveProfile();
    if (document.getElementById("useAnki").checked) {
        testAnkiConnection();
        startAnkiHeartbeat();
    } else {
        stopAnkiHeartbeat();
        document.getElementById("ankiStatus").style.display = "none";
        document.getElementById("ankiConfig").style.display = "none";
    }
};

document.getElementById("ankiIP").oninput = async () => {
    await saveProfile();
    ankiConnectedOnce = false;
    testAnkiConnection();
};

async function loadAnkiConfig() {
    const ip = document.getElementById("ankiIP").value;

    const { profiles, currentProfile } =
        await browser.storage.local.get(["profiles", "currentProfile"]);

    const profile = profiles?.[currentProfile];

    const decks = await browser.runtime.sendMessage({
        type: "anki_get_decks",
        ip
    });

    const models = await browser.runtime.sendMessage({
        type: "anki_get_models",
        ip
    });

    populateSelect("ankiDeck", decks || []);
    populateSelect("ankiModel", models || []);

    // Restore saved selections
    const deckSel = document.getElementById("ankiDeck");
    const modelSel = document.getElementById("ankiModel");

    if (profile?.ankiDeck) {
        deckSel.value = profile.ankiDeck;
    }

    if (profile?.ankiModel) {
        modelSel.value = profile.ankiModel;
    }

    // Auto-default if empty
    if (!deckSel.value && deckSel.options.length) {
        deckSel.value = deckSel.options[0].value;
    }

    if (!modelSel.value && modelSel.options.length) {
        modelSel.value = modelSel.options[0].value;
    }

    await saveProfile();
}

function populateSelect(selectId, items) {


    const sel = document.getElementById(selectId);
    sel.innerHTML = "";

    items.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item;
        opt.textContent = item;
        sel.appendChild(opt);
    });

    if (selectId === "ankiModel") {
        sel.onchange = async () => {
            await saveProfile();
            await loadModelFields();
        };
    }
}

async function loadModelFields() {
    const model = document.getElementById("ankiModel").value;
    const ip = document.getElementById("ankiIP").value;

    if (!model || !ip) return;

    const fields = await browser.runtime.sendMessage({
        type: "anki_get_fields",
        ip,
        model
    });

    renderFieldMap(model, fields || []);

    const { profiles, currentProfile } =
        await browser.storage.local.get(["profiles", "currentProfile"]);

    const savedMap = profiles?.[currentProfile]?.ankiFieldMap || {};

    document.querySelectorAll("#ankiFields select").forEach(sel => {
        sel.value = savedMap[sel.dataset.field] || "text";
    });
}

function renderFieldMap(modelName, fields) {
    const container = document.getElementById("ankiFields");
    container.innerHTML = "";

    if (!fields.length) return;

    const title = document.createElement("h4");
    title.textContent = `${modelName} fields`;
    container.appendChild(title);

    const options = [
        { value: "text", label: "Selected Text" },
        { value: "ai", label: "AI Answer" },
        { value: "context", label: "Context Sentence" }
    ];

    fields.forEach(field => {
        const row = document.createElement("div");
        row.className = "anki-field-row";

        const label = document.createElement("label");
        label.textContent = field + ":      ";

        const select = document.createElement("select");
        select.dataset.field = field;

        options.forEach(opt => {
            const o = document.createElement("option");
            o.value = opt.value;
            o.textContent = opt.label;
            select.appendChild(o);
        });

        select.onchange = saveProfile;

        row.appendChild(label);
        row.appendChild(select);
        container.appendChild(row);
    });

    restoreFieldMap();
}

async function restoreFieldMap() {
    const { profiles, currentProfile } =
        await browser.storage.local.get(["profiles", "currentProfile"]);

    const profile = profiles?.[currentProfile];
    if (!profile?.ankiFieldMap) return;

    document.querySelectorAll("#ankiFields select").forEach(sel => {
        sel.value = profile.ankiFieldMap[sel.dataset.field] || "text";
    });
}

/*document.getElementById("ankiModel").onchange = async () => {
    await saveProfile();
    await loadModelFields();
};*/


//setTimeout(testAnkiConnection, 300);