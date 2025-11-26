import { saveProfile } from "./profileManager.js";

export function initHotkeyCapture() {
    const hotkeyInput = document.getElementById("hotkeyInput");
    let capturing = false;

    hotkeyInput.addEventListener("click", () => {
        capturing = true;
        hotkeyInput.value = "Press any key...";
        hotkeyInput.classList.add("capturing");
    });

    document.addEventListener("keydown", (e) => {
        if (!capturing) return;
        e.preventDefault();
        e.stopPropagation();

        const key = formatKey(e);
        hotkeyInput.value = key;

        saveProfile();

        capturing = false;
        hotkeyInput.classList.remove("capturing");
    });
}

function formatKey(e) {
    if (e.key === " ") return "Space";
    if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return e.key;
    return e.key.length === 1 ? e.key.toUpperCase() : e.key;
}
