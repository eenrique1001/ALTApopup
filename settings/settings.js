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

    // Prompt, hotkey auto-save
    document.getElementById("prompt").oninput = saveProfile;
    document.getElementById("hotkeyInput").oninput = saveProfile;
    document.getElementById("useSentenceContext").onchange = saveProfile;
});

// Theme Apply button
document.getElementById("applyChanges").onclick = async () => {
    const theme = document.getElementById("themeSelect").value;
    document.body.classList.toggle("dark", theme === "dark");
    await browser.storage.local.set({ theme });
};

// Profile Buttons
document.getElementById("addProfile").onclick = addProfile;
document.getElementById("deleteProfile").onclick = deleteProfile;
