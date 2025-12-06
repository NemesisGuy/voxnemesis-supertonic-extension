// Supertonic TTS - Content Script

let currentUtterance = null;

// --- Message Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'play') {
        handlePlay(request.settings);
    } else if (request.command === 'pause') {
        handlePause();
    } else if (request.command === 'stop') {
        handleStop();
    } else if (request.command === 'getSelection') {
        sendResponse({ text: window.getSelection().toString() });
        return;
    } else if (request.command === 'contextPlay') {
        // Triggered from Context Menu (background script)
        // We need to fetch settings from storage first since background might not pass them
        chrome.storage.local.get(['selectedVoiceName', 'rate', 'pitch', 'volume'], (savedSettings) => {
            // contextMenu sends the text selection, but we can also grab it here
            const textToRead = request.text || window.getSelection().toString();
            if (textToRead) {
                speakText(textToRead, {
                    voiceName: savedSettings.selectedVoiceName,
                    rate: savedSettings.rate || 1.0,
                    pitch: savedSettings.pitch || 1.0,
                    volume: savedSettings.volume || 1.0
                });
            }
        });
    }
});


// --- Playback Logic ---
function handlePlay(settings) {
    const selectedText = window.getSelection().toString();

    if (window.speechSynthesis.paused && window.speechSynthesis.speaking) {
        window.speechSynthesis.resume();
    } else if (selectedText) {
        speakText(selectedText, settings);
    } else {
        // Optional: Read logic for whole page or alert
        console.log("No text selected");
    }
}

function handlePause() {
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
    }
}

function handleStop() {
    window.speechSynthesis.cancel();
}

function speakText(text, settings) {
    window.speechSynthesis.cancel(); // Stop any previous

    const utterance = new SpeechSynthesisUtterance(text);

    // Apply Settings
    if (settings) {
        utterance.rate = parseFloat(settings.rate) || 1.0;
        utterance.pitch = parseFloat(settings.pitch) || 1.0;
        utterance.volume = parseFloat(settings.volume) || 1.0;

        if (settings.voiceName) {
            const voices = window.speechSynthesis.getVoices();
            const matchingVoice = voices.find(v => v.name === settings.voiceName);
            if (matchingVoice) {
                utterance.voice = matchingVoice;
            }
        }
    }

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

// Force load voices
window.speechSynthesis.getVoices();
