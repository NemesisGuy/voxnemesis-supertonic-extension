// Supertonic TTS - Background Script

let creating; // Promise to track offscreen creation
let warmupPromise = null;
const CONTEXT_MENU_ID = 'supertonic-read';

async function getSelectedText(tabId) {
    // Try content script first for reliability, then fall back to executeScript.
    try {
        const response = await chrome.tabs.sendMessage(tabId, { command: 'getSelection' });
        if (response && response.text) return response.text;
    } catch (err) {
        console.warn("Background: content script selection fallback failed", err);
    }

    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => window.getSelection().toString()
        });
        if (results && results[0]) {
            return results[0].result;
        }
    } catch (err) {
        console.warn("Background: executeScript selection failed", err);
    }

    return '';
}

async function setupOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path);

    // Check if existing
    try {
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: [offscreenUrl]
        });

        if (existingContexts.length > 0) {
            return;
        }
    } catch (e) {
        console.warn("Error checking contexts, assuming none:", e);
    }

    // Create document
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: ['AUDIO_PLAYBACK', 'BLOBS'],
            justification: 'Text to speech generation via WebAssembly',
        });
        await creating;
        creating = null;
    }
}

function ensureContextMenu() {
    const create = () => {
        try {
            chrome.contextMenus.create({
                id: CONTEXT_MENU_ID,
                title: 'Read with VoxNemesis TTS (Supertonic)',
                contexts: ['selection']
            });
        } catch (e) {
            console.warn('Context menu creation failed:', e);
        }
    };

    try {
        chrome.contextMenus.removeAll(() => {
            if (chrome.runtime.lastError) {
                console.warn('Context menu removeAll error:', chrome.runtime.lastError.message);
            }
            create();
        });
    } catch (e) {
        create();
    }
}

async function warmUpEngine() {
    if (warmupPromise) return warmupPromise;
    warmupPromise = (async () => {
        await setupOffscreenDocument('offscreen.html');
        try {
            await chrome.runtime.sendMessage({ target: 'offscreen', type: 'init', useWebGPU: true });
        } catch (err) {
            console.warn('Warmup init failed (will retry on next call):', err);
        } finally {
            warmupPromise = null;
        }
    })();
    return warmupPromise;
}

// Ensure offscreen is ready on install/startup
chrome.runtime.onInstalled.addListener(() => {
    setupOffscreenDocument('offscreen.html');
    warmUpEngine();
    ensureContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
    setupOffscreenDocument('offscreen.html');
    warmUpEngine();
    ensureContextMenu();
});

// Also recreate context menu when the service worker wakes up
ensureContextMenu();
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID) {
        chrome.runtime.sendMessage({ command: 'play', text: info.selectionText, settings: {} });
    }
});

// Listener for messages from Popup/Content
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.target === 'offscreen') return; // Ignore messages intended for offscreen (from self)

    (async () => {
        try {
            await setupOffscreenDocument('offscreen.html');

            if (request.command === 'play' || request.command === 'speak') {
                // Determine text: provided or from active tab selection
                let textToRead = request.text;

                if (!textToRead) {
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tabs.length > 0 && tabs[0].id) {
                        textToRead = await getSelectedText(tabs[0].id);
                    }
                }

                if (textToRead) {
                    console.log("Background: Sending speak command to offscreen");
                    chrome.runtime.sendMessage({
                        type: 'speak',
                        target: 'offscreen',
                        text: textToRead,
                        settings: request.settings
                    }, (response) => {
                        console.log("Background: Speak response:", response);
                        if (chrome.runtime.lastError) {
                            console.error("Background: Speak error:", chrome.runtime.lastError);
                            sendResponse({ error: chrome.runtime.lastError.message });
                        } else {
                            sendResponse(response);
                        }
                    });
                    return true;
                } else {
                    sendResponse({ status: 'no_text' });
                }
            } else if (request.command === 'stop') {
                chrome.runtime.sendMessage({
                    type: 'stop',
                    target: 'offscreen'
                }, (response) => sendResponse(response));
                return true;
            } else if (request.command === 'pause') {
                chrome.runtime.sendMessage({
                    type: 'pause',
                    target: 'offscreen'
                }, (response) => sendResponse(response));
                return true;
            } else if (request.command === 'playBuffer') {
                chrome.runtime.sendMessage({
                    type: 'playBuffer',
                    target: 'offscreen'
                }, (response) => sendResponse(response));
                return true;
            } else if (request.command === 'resume') {
                chrome.runtime.sendMessage({
                    type: 'resume',
                    target: 'offscreen'
                }, (response) => sendResponse(response));
                return true;
            } else if (request.command === 'seek') {
                chrome.runtime.sendMessage({
                    type: 'seek',
                    target: 'offscreen',
                    time: request.time
                }, (response) => sendResponse(response));
                return true;
            } else if (request.command === 'getStatus') {
                chrome.runtime.sendMessage({
                    type: 'getStatus',
                    target: 'offscreen'
                }, (response) => {
                    // Response might be undefined if offscreen not ready
                    sendResponse(response || { hasAudio: false });
                });
                return true; // async for implicit SendMessage response
            }
        } catch (err) {
            console.error(err);
            sendResponse({ error: err.message });
        }
    })();
    return true; // async reception
});


// Context Menu Handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "supertonic-read") {
        await setupOffscreenDocument('offscreen.html');
        const settings = await chrome.storage.local.get(['selectedVoiceName', 'rate', 'pitch', 'volume', 'seed']);

        // Pass to offscreen
        chrome.runtime.sendMessage({
            type: 'speak',
            target: 'offscreen',
            text: info.selectionText,
            settings: {
                voiceName: settings.selectedVoiceName,
                rate: settings.rate,
                pitch: settings.pitch,
                volume: settings.volume,
                seed: settings.seed
            }
        });
    }
});
