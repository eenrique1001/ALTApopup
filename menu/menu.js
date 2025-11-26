document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("openSettings").addEventListener("click", async () => {
        console.log("Opening settings...");
        await browser.runtime.openOptionsPage();  // THIS WILL WORK NOW
    });

    loadProfiles();
});

async function loadProfiles() {
    const data = await browser.storage.local.get(["profiles", "currentProfile"]);
    const profiles = data.profiles || {};
    const current = data.currentProfile || "";

    const select = document.getElementById("profileSelect");
    select.innerHTML = "";

    for (const name of Object.keys(profiles)) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        if (name === current) opt.selected = true;
        select.appendChild(opt);
    }

    select.addEventListener("change", async () => {
        await browser.storage.local.set({ currentProfile: select.value });
    });
}
