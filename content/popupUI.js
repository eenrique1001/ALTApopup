async function applyPopupUISettings(popupElement) {
    const { uiSettings } = await browser.storage.local.get("uiSettings");

    const draggable = uiSettings?.popupDraggable || false;
    const savedPosition = uiSettings?.popupPosition;
    const scalePercent = uiSettings?.popupScale || 100;

    const scale = scalePercent / 100;

    // Apply scaling immediately
    popupElement.style.transform = `scale(${scale})`;
    popupElement.style.transformOrigin = "top left";

    // Apply saved position if exists
    if (savedPosition?.top != null && savedPosition?.left != null) {
        popupElement.style.top = savedPosition.top + "px";
        popupElement.style.left = savedPosition.left + "px";
    }

    // --- Remove existing drag behavior if any ---
    if (currentDragCleanup) {
        currentDragCleanup();
        currentDragCleanup = null;
    }

    if (!draggable) {
        popupElement.querySelector(".popup-header").style.cursor = "default";
        return;
    }

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const header = popupElement.querySelector(".popup-header");
    header.style.cursor = "move";

    function onMouseMove(e) {
        if (!isDragging) return;

        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        const rect = popupElement.getBoundingClientRect();

        const scaledWidth = rect.width;
        const scaledHeight = rect.height;

        const maxLeft = window.innerWidth - scaledWidth;
        const maxTop = window.innerHeight - scaledHeight;

        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        popupElement.style.left = newLeft + "px";
        popupElement.style.top = newTop + "px";
    }

    async function onMouseUp() {
        if (!isDragging) return;

        isDragging = false;

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        const rect = popupElement.getBoundingClientRect();

        const { uiSettings } = await browser.storage.local.get("uiSettings");

        await browser.storage.local.set({
            uiSettings: {
                ...uiSettings,
                popupPosition: {
                    top: rect.top,
                    left: rect.left
                }
            }
        });
    }

    function onMouseDown(e) {
        isDragging = true;

        const rect = popupElement.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }

    header.addEventListener("mousedown", onMouseDown);

    // Store cleanup function
    currentDragCleanup = () => {
        header.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
    };
}