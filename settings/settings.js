async function loadSettings() {
    const data = await browser.storage.local.get([
        "theme", "profiles", "currentProfile"
    ]);

    document.getElementById("themeSelect").value = data.theme || "light";

    if (!data.profiles || Object.keys(data.profiles).length === 0) {
        data.profiles = {
            "default": {
                credentials: "",
                prompt: ""
            }
        };
        data.currentProfile = "default";
        await browser.storage.local.set({
            profiles: data.profiles,
            currentProfile: "default"
        });
    }

    const profiles = data.profiles || {};
    const profileSelect = document.getElementById("profileSelect");

    profileSelect.innerHTML = "";
    for (const name of Object.keys(profiles)) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        profileSelect.appendChild(option);
    }

    if (data.currentProfile && profiles[data.currentProfile]) {
        profileSelect.value = data.currentProfile;
        loadProfileFields(profiles[data.currentProfile]);
    }

    profileSelect.onchange = async () => {
        const selected = profileSelect.value;
        let data = await browser.storage.local.get(["profiles"]);

        await browser.storage.local.set({ currentProfile: selected });

        loadProfileFields(data.profiles[selected]);
    };


    if (data.theme === "dark") {
        document.body.classList.add("dark");
    } else {
        document.body.classList.remove("dark");
    }

    document.getElementById("themeSelect").value = data.theme || "light";

}

function loadProfileFields(profile) {
    document.getElementById("aiCredentials").value = profile.credentials || "";
    document.getElementById("prompt").value = profile.prompt || "";
}


document.getElementById("saveAndReload").onclick = async () => {
    const theme = document.getElementById("themeSelect").value;

    await browser.storage.local.set({ theme });

    // Reload ALL tabs so theme applies everywhere
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
        if (tab.id) browser.tabs.reload(tab.id);
    }
};



document.getElementById("addProfile").onclick = async () => {
    const name = prompt("Profile name:");
    if (!name) return;

    const data = await browser.storage.local.get(["profiles"]);
    const profiles = data.profiles || {};

    profiles[name] = { credentials: "", prompt: "" };

    await browser.storage.local.set({ profiles, currentProfile: name });
    loadSettings();
};

document.getElementById("deleteProfile").onclick = async () => {
    let data = await browser.storage.local.get(["profiles", "currentProfile"]);
    let profiles = data.profiles || {};
    const current = data.currentProfile;

    // Prevent removing last profile
    if (Object.keys(profiles).length <= 1) {
        return;
    }
    

    delete profiles[current];

    // Pick a new profile
    const newProfile = Object.keys(profiles)[0];

    await browser.storage.local.set({
        profiles,
        currentProfile: newProfile
    });

    loadSettings();
};


document.getElementById("aiCredentials").oninput = saveProfile;
document.getElementById("prompt").oninput = saveProfile;

async function saveProfile() {
    const profileName = document.getElementById("profileSelect").value;

    let data = await browser.storage.local.get(["profiles"]);
    let profiles = data.profiles || {};

    profiles[profileName] = {
        credentials: document.getElementById("aiCredentials").value,
        prompt: document.getElementById("prompt").value
    };

    await browser.storage.local.set({ profiles });
}


loadSettings();
