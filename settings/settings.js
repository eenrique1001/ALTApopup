import { loadProfileFields, loadProfiles, addProfile, deleteProfile, saveProfile } from "./profileManager.js";
import { initHotkeyCapture } from "./hotkeyManager.js";
import { loadTheme } from "./themeManager.js";

// --- MAIN INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
    await loadTheme();
    await loadProfiles();
    initHotkeyCapture();
});

// Save + reload all tabs
document.getElementById("saveAndReload").onclick = async () => {
    const theme = document.getElementById("themeSelect").value;

    // Apply theme immediately
    document.body.classList.toggle("dark", theme === "dark");

    // Save theme
    await browser.storage.local.set({ theme });
};


// Profile management buttons
document.getElementById("addProfile").onclick = addProfile;
document.getElementById("deleteProfile").onclick = deleteProfile;

// Save on field input
document.getElementById("aiCredentials").oninput = saveProfile;
document.getElementById("prompt").oninput = saveProfile;
document.getElementById("hotkeyInput").oninput = saveProfile;
