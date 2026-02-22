function formatAIResponse(text) {
    if (!text) return "";

    // Escape HTML (so AI output cannot break your popup)
    text = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // --- Code blocks (``` ... ```) ---
    text = text.replace(/```([\s\S]*?)```/g, (m, code) => {
        return `<pre class="code-block"><code>${code.trim()}</code></pre>`;
    });

    // --- Inline code (`code`) ---
    text = text.replace(/`([^`]+)`/g, `<code>$1</code>`);

    // --- Headings (process longest first to avoid ## matching # of ###) ---
    text = text.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    // --- Bold and Italic (combined to avoid conflicts) ---
    // Bold: **text**
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic: *text* (but not **text** which is already bold, and avoid math like 2*3)
    text = text.replace(/([^\*]|\A)\*([^\s\*][^\*]*?[^\s\*]|[^\s\*])\*([^\*]|$)/gm, "$1<em>$2</em>$3");

    // --- Bullet lists (properly grouped) ---
    // First, mark list items
    text = text.replace(/^\s*[-•] (.+)$/gm, "<li>$1</li>");
    // Then wrap consecutive <li> tags, but only groups separated by non-list content
    text = text.replace(/(<li>.*?<\/li>)(\n(?!<li>))/gs, "<ul>$1</ul>$2");
    // Handle the last group if it ends with <li>
    text = text.replace(/(<li>.*?<\/li>)$/s, "<ul>$1</ul>");

    // --- Newlines → Paragraphs ---
    const paragraphs = text
        .split(/\n{2,}/)
        .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");

    return paragraphs;
}

function extractSentence() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return "";

    const selectedText = sel.toString().trim();
    if (!selectedText) return "";

    const container = sel.anchorNode;
    if (!container) return "";

    const element = container.parentElement;
    if (!element) return "";

    const text = element.textContent;
    if (!text) return selectedText;

    const index = text.indexOf(selectedText);
    if (index === -1) return selectedText;

    // Punctuation that ends a sentence
    const ENDINGS = [".", "?", "!", "。", "？", "！"];

    // --- Find left boundary ---
    let left = index - 1;
    while (left >= 0 && !ENDINGS.includes(text[left])) {
        left--;
    }

    // --- Find right boundary ---
    let right = index + selectedText.length;
    while (right < text.length && !ENDINGS.includes(text[right])) {
        right++;
    }

    // Extract, skipping punctuation on the left
    const sentence = text.substring(left + 1, right + 1).trim();

    return sentence || selectedText;
}

function matchHotkey(event, hotkey) {
    const key = hotkey.toLowerCase();

    if (key === "shift") return event.key === "Shift";
    if (key === "ctrl") return event.ctrlKey;
    if (key === "alt") return event.altKey;
    if (key === "meta") return event.metaKey;
    if (key === "space") return event.key === " ";

    return event.key.toLowerCase() === key;
}