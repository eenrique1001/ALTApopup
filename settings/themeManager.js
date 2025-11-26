export async function loadTheme() {
    const { theme } = await browser.storage.local.get("theme");

    if (theme === "dark") {
        document.body.classList.add("dark");
    } else {
        document.body.classList.remove("dark");
    }

    document.getElementById("themeSelect").value = theme || "light";
}
