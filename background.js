/* background.js */

// ======================================================
// GROQ
// ======================================================
async function runGroq(providerData, prompt, text) {
    const apiKey = providerData.apiKey;
    const model = providerData.model || "mixtral-8x7b-32768";

    if (!apiKey) throw new Error("Groq API key missing");

    const endpoint = "https://api.groq.com/openai/v1/chat/completions";

    const body = {
        model,
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: text }
        ],
        max_tokens: 512
    };

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        throw new Error(`Groq error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();

    if (data.choices?.[0]?.message?.content)
        return data.choices[0].message.content;

    return JSON.stringify(data);
}



// ======================================================
// GEMINI
// ======================================================
async function runGemini(providerData, prompt, text) {
    const apiKey = providerData.apiKey;
    const model = providerData.model || "models/gemini-1.5-flash";

    if (!apiKey) throw new Error("Google Gemini API key missing");

    const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = {
        contents: [{
            role: "user",
            parts: [{
                text: `${prompt}\n\n=== Selected text ===\n${text}`
            }]
        }]
    };

    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();

    if (data.candidates?.[0]?.content?.parts?.[0]?.text)
        return data.candidates[0].content.parts[0].text;

    return JSON.stringify(data);
}



// ======================================================
// OPENAI
// ======================================================
async function runOpenAI(providerData, prompt, text) {
    const apiKey = providerData.apiKey;
    const model = providerData.model || "gpt-4o-mini";

    if (!apiKey) throw new Error("OpenAI API key missing");

    const endpoint = "https://api.openai.com/v1/responses";

    const body = {
        model,
        input: `${prompt}\n\n=== Selected text ===\n${text}`
    };

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();

    if (data.output_text) return data.output_text;

    return JSON.stringify(data);
}



// ======================================================
// MAIN DISPATCHER
// ======================================================
async function runAI(provider, providerData, prompt, text) {
    switch (provider) {
        case "openai":
            return await runOpenAI(providerData, prompt, text);

        case "google_gemini":
            return await runGemini(providerData, prompt, text);

        case "groq":
            return await runGroq(providerData, prompt, text);

        default:
            throw new Error("Unknown provider: " + provider);
    }
}



// ======================================================
// CONTEXT MENU
// ======================================================
browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
        id: "analyze-text",
        title: "Analyze selected text",
        contexts: ["selection"]
    });
});



// ======================================================
// MENU CLICK → POPUP
// ======================================================
browser.contextMenus.onClicked.addListener(async (info, tab) => {
    browser.tabs.sendMessage(tab.id, {
        type: "show_analysis_popup",
        text: info.selectionText || ""
    });
});



// ======================================================
// HANDLE AI REQUESTS FROM FRONTEND
// ======================================================
browser.runtime.onMessage.addListener((msg) => {
    if (msg.type !== "run_ai") return;

    return (async () => {
        try {
            const { profiles, currentProfile } =
                await browser.storage.local.get(["profiles", "currentProfile"]);

            const profile = profiles[currentProfile];

            const output = await runAI(
                profile.provider,
                profile.providerData,
                profile.prompt,
                msg.text
            );

            return { success: true, result: output };
        } catch (err) {
            return { success: false, error: String(err) };
        }
    })();
});
