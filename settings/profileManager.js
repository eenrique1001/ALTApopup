export async function loadProfiles() {
    const data = await browser.storage.local.get(["theme", "profiles", "currentProfile"]);

    if (!data.profiles || Object.keys(data.profiles).length === 0) {
        data.profiles = {
            "default": { credentials: "", prompt: "", hotkey: "Shift" }
        };
        data.currentProfile = "default";

        await browser.storage.local.set({
            profiles: data.profiles,
            currentProfile: "default"
        });
    }

    const profiles = data.profiles;
    const profileSelect = document.getElementById("profileSelect");
    profileSelect.innerHTML = "";

    for (const name of Object.keys(profiles)) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        profileSelect.appendChild(opt);
    }

    if (data.currentProfile && profiles[data.currentProfile]) {
        profileSelect.value = data.currentProfile;
        loadProfileFields(profiles[data.currentProfile]);
    }

    profileSelect.onchange = async () => {
        const selected = profileSelect.value;
        const data = await browser.storage.local.get(["profiles"]);

        await browser.storage.local.set({ currentProfile: selected });
        loadProfileFields(data.profiles[selected]);
    };
}

export function loadProfileFields(profile) {
    document.getElementById("aiCredentials").value = profile.credentials || "";
    document.getElementById("prompt").value = profile.prompt || "";
    document.getElementById("hotkeyInput").value = profile.hotkey || "Shift";
}

export async function saveProfile() {
    const profileName = document.getElementById("profileSelect").value;
    const data = await browser.storage.local.get(["profiles"]);
    const profiles = data.profiles || {};

    profiles[profileName] = {
        credentials: document.getElementById("aiCredentials").value,
        prompt: document.getElementById("prompt").value,
        hotkey: document.getElementById("hotkeyInput").value || "Shift"
    };

    await browser.storage.local.set({ profiles });
}

export async function addProfile() {
    const name = prompt("Profile name:");
    if (!name) return;

    const data = await browser.storage.local.get(["profiles"]);
    const profiles = data.profiles || {};

    profiles[name] = { credentials: "", prompt: "", hotkey: "Shift" };

    await browser.storage.local.set({ profiles, currentProfile: name });
    loadProfiles();
}

export async function deleteProfile() {
    const data = await browser.storage.local.get(["profiles", "currentProfile"]);
    const profiles = data.profiles || {};
    const current = data.currentProfile;

    if (Object.keys(profiles).length <= 1) return;

    delete profiles[current];

    const newProfile = Object.keys(profiles)[0];

    await browser.storage.local.set({
        profiles,
        currentProfile: newProfile
    });

    loadProfiles();
}
