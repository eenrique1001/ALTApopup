// ----------------------
// PROFILE MANAGER
// ----------------------

export async function loadProfiles() {
    const data = await browser.storage.local.get(["theme", "profiles", "currentProfile"]);

    // Initialize if empty
    if (!data.profiles || Object.keys(data.profiles).length === 0) {
        data.profiles = {
            "default": {
                provider: "groq", // default provider
                providerData: { apiKey: "", model: "llama-3.1-8b-instant" }, // corrected groq default model
                prompt: "",
                hotkey: "Shift"
            }
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

    Object.keys(profiles).forEach(profileName => {
        const opt = document.createElement("option");
        opt.value = profileName;
        opt.textContent = profileName;
        profileSelect.appendChild(opt);
    });

    if (data.currentProfile && profiles[data.currentProfile]) {
        profileSelect.value = data.currentProfile;
        setTimeout(() => {
            loadProfileFields(profiles[data.currentProfile]);
        }, 0);
    }

    profileSelect.onchange = async () => {
        const selected = profileSelect.value;
        const stored = await browser.storage.local.get(["profiles"]);

        await browser.storage.local.set({ currentProfile: selected });
        loadProfileFields(stored.profiles[selected]);
    };
}

// --------------------------
// LOAD PROFILE FIELDS
// --------------------------
export function loadProfileFields(profile) {
    document.getElementById("hotkeyInput").value = profile.hotkey || "Shift";
    document.getElementById("prompt").value = profile.prompt || "";

    const providerSelect = document.getElementById("providerSelect");
    providerSelect.value = profile.provider || "groq";

    renderProviderFields(profile.provider, profile.providerData || {});
}

// --------------------------
// SAVE PROFILE
// --------------------------
export async function saveProfile() {
    const profileName = document.getElementById("profileSelect").value;

    const data = await browser.storage.local.get(["profiles"]);
    const profiles = data.profiles || {};

    const provider = document.getElementById("providerSelect").value;

    const providerData = {};
    const providerInputs = document.querySelectorAll("#providerFields input, #providerFields select");

    providerInputs.forEach(input => {
        providerData[input.id] = input.value;
    });

    profiles[profileName] = {
        provider,
        providerData,
        prompt: document.getElementById("prompt").value,
        hotkey: document.getElementById("hotkeyInput").value || "Shift"
    };

    await browser.storage.local.set({ profiles });
}

// --------------------------
// ADD PROFILE
// --------------------------
export async function addProfile() {
    const name = prompt("Profile name:");
    if (!name) return;

    const data = await browser.storage.local.get(["profiles"]);
    const profiles = data.profiles || {};

    profiles[name] = {
        provider: "groq",
        providerData: { apiKey: "", model: "llama-3.1-8b-instant" }, // corrected groq default model
        prompt: "",
        hotkey: "Shift"
    };

    await browser.storage.local.set({ profiles, currentProfile: name });
    loadProfiles();
}

// --------------------------
// DELETE PROFILE
// --------------------------
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

// --------------------------
// RENDER PROVIDER FIELDS
// --------------------------
export function renderProviderFields(provider, storedData = {}) {
    const container = document.getElementById("providerFields");
    container.innerHTML = "";

    let html = "";

    switch (provider) {

        // OPENAI
        case "openai":
            html = `
                <label>API Key:</label>
                <input type="password" id="apiKey" placeholder="OpenAI API Key">

                <label>Model:</label>
                <select id="model">
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="o1">o1</option>
                </select>
            `;
            break;

        // GEMINI
        case "google_gemini":
            html = `
                <label>API Key:</label>
                <input type="password" id="apiKey" placeholder="Google Gemini Key">

                <label>Model:</label>
                <select id="model">
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                    <option value="gemini-3-pro">gemini-3-pro</option>
                </select>
            `;
            break;

        // GROQ (UPDATED)
        case "groq":
            html = `
                <label>API Key:</label>
                <input type="password" id="apiKey" placeholder="Groq API Key">

                <label>Model:</label>
                <select id="model">
                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                    <option value="llama-3.1-70b-versatile">llama-3.1-70b-versatile</option>
                    <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                </select>
            `;
            break;
    }

    container.innerHTML = html;

    Object.keys(storedData).forEach(key => {
        const el = document.getElementById(key);
        if (el) el.value = storedData[key];
    });

    container.querySelectorAll("input,select").forEach(el => {
        el.oninput = saveProfile;
    });
}
