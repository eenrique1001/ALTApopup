export function formatAIResponse(text) {
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

    // --- Bold ---
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // --- Italic ---
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // --- Headings ---
    text = text.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    // --- Bullet lists ---
    text = text.replace(/^\s*[-•] (.+)$/gm, "<li>$1</li>");
    text = text.replace(/(<li>[\s\S]+?<\/li>)/g, "<ul>$1</ul>");

    // --- Newlines → Paragraphs ---
    const paragraphs = text
        .split(/\n{2,}/)
        .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");

    return paragraphs;
}
