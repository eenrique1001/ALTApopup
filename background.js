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
    const model = providerData.model || "gemini-2.5-flash";

    if (!apiKey) throw new Error("Google Gemini API key missing");

    const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = {
        contents: [{
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

    const endpoint = "https://api.openai.com/v1/chat/completions";

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
        throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();

    if (data.choices?.[0]?.message?.content)
        return data.choices[0].message.content;

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

function parseAnkiTags(tagString = "") {
    return tagString
        .split(/[,\s]+/)   // split on commas OR spaces
        .map(t => t.trim())
        .filter(Boolean); // remove empty strings
}

async function ankiRequest(ip, action, params = {}) {
    const res = await fetch(ip, {
        method: "POST",
        body: JSON.stringify({
            action,
            version: 6,
            params
        })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result;
}


async function getAnkiDecks(ip) {
    return ankiRequest(ip, "deckNames");
}

async function getAnkiModels(ip) {
    return ankiRequest(ip, "modelNames");
}

async function getModelFields(ip, model) {
    return ankiRequest(ip, "modelFieldNames", { modelName: model });
}

async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(hashBuffer)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

function normalize(text = "") {
    return text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[^\w\s]/g, "");
}

const MAX_DB_SIZE = 10000;

async function getDB() {
    const { ankiFingerprintDB } =
        await browser.storage.local.get("ankiFingerprintDB");

    return ankiFingerprintDB || { order: [], map: {} };
}

async function saveDB(db) {
    await browser.storage.local.set({ ankiFingerprintDB: db });
}

async function checkFingerprint(primary, secondary) {
    const db = await getDB();

    for (const key of db.order) {
        const entry = db.map[key];
        if (!entry) continue;

        if (entry.primary === primary && entry.secondary === secondary) {
            return "exact";
        }
        if (entry.primary === primary) {
            return "partial";
        }
    }

    return "none";
}

async function storeFingerprint(primary, secondary) {
    const db = await getDB();
    const key = secondary; // unique enough

    // If exists, remove from FIFO so we can re-add at end
    if (db.map[key]) {
        db.order = db.order.filter(k => k !== key);
    }

    db.map[key] = {
        primary,
        secondary,
        time: Date.now()
    };

    db.order.push(key);

    // FIFO trim
    while (db.order.length > MAX_DB_SIZE) {
        const oldest = db.order.shift();
        delete db.map[oldest];
    }

    await saveDB(db);
}


browser.runtime.onMessage.addListener((msg) => {
    //console.log("BG RECEIVED:", msg);
    return (async () => {

        // ======================================================
        // HANDLE AI REQUESTS FROM FRONTEND
        // ======================================================
        if (msg.type == "run_ai") {
            try {
                const { profiles, currentProfile } =
                    await browser.storage.local.get(["profiles", "currentProfile"]);

                const profile = profiles[currentProfile];

                let finalPrompt = profile.prompt;

                if (profile.useSentenceContext && msg.contextSentence) {
                    finalPrompt = `Context: ${msg.contextSentence}\n\n${profile.prompt}`;
                }

                const output = await runAI(
                    profile.provider,
                    profile.providerData,
                    finalPrompt,
                    msg.text
                );

                return { success: true, result: output };
            } catch (err) {
                return { success: false, error: String(err) };
            }
        }

        // =====================
        // TEST ANKI CONNECTION
        // =====================
        if (msg.type === "test_anki") {
            try {
                const response = await fetch(msg.ip, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "version",
                        version: 6
                    })
                });

                const data = await response.json();
                return { success: !!data?.result };
            } catch {
                return { success: false };
            }
        }

        // =====================
        // GET DECKS
        // =====================
        if (msg.type === "anki_get_decks") {
            try {
                const decks = await ankiRequest(msg.ip, "deckNames");
                return decks; // must return array
            } catch (e) {
                return [];
            }
        }

        // =====================
        // GET MODELS
        // =====================
        if (msg.type === "anki_get_models") {
            try {
                const models = await ankiRequest(msg.ip, "modelNames");
                return models;
            } catch (e) {
                return [];
            }
        }

        // =====================
        // GET MODEL FIELDS
        // =====================
        if (msg.type === "anki_get_fields") {
            try {
                const fields = await ankiRequest(
                    msg.ip,
                    "modelFieldNames",
                    { modelName: msg.model }
                );
                return fields;
            } catch (e) {
                return [];
            }
        }

        // =====================
        // ADD TO ANKI
        // =====================
        if (msg.type === "add_to_anki") {
            try {
                const { profiles, currentProfile } =
                    await browser.storage.local.get(["profiles", "currentProfile"]);

                const profile = profiles[currentProfile];
                if (!profile?.useAnki || !profile?.ankiIP) {
                    return { success: false, error: "Anki not configured" };
                }

                const tags = parseAnkiTags(profile.ankiTags);
                const fields = {};

                for (const [field, source] of Object.entries(profile.ankiFieldMap || {})) {
                    if (source === "text") fields[field] = msg.selectedText;
                    if (source === "ai") fields[field] = msg.aiAnswer;
                    if (source === "context") fields[field] = msg.contextSentence || "";
                }

                const response = await fetch(profile.ankiIP, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "addNote",
                        version: 6,
                        params: {
                            note: {
                                deckName: profile.ankiDeck || "Default",
                                modelName: profile.ankiModel || "Basic",
                                fields,
                                tags,
                                options: {
                                    allowDuplicate: true
                                }

                            }
                        }
                    })
                });

                const data = await response.json();
                if (data.error) {
                    return { success: false, error: data.error };
                }

                const primary = await sha256(normalize(msg.selectedText));
                const secondary = await sha256(
                    normalize(msg.selectedText + "|" + (msg.contextSentence || "").slice(0, 200))
                );

                await storeFingerprint(primary, secondary);


                return { success: true };
            } catch (e) {
                return { success: false, error: String(e) };
            }
        }

        // =====================
        // CHECK FINGERPRINT
        // =====================
        if (msg.type === "anki_check_existing") {
            const primary = await sha256(normalize(msg.text));
            const secondary = await sha256(
                normalize(msg.text + "|" + (msg.context || "").slice(0, 200))
            );

            const result = await checkFingerprint(primary, secondary);
            return { status: result };
        }

    })();

    return true;

});

