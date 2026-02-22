import { loadProfiles } from "../settings/profileManager.js";

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("openSettings").addEventListener("click", async () => {
        console.log("Opening settings...");
        await browser.runtime.openOptionsPage();
    });

    loadProfiles();
});