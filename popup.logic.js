// Overlay/status helpers for popup asset fetch messaging.
// Exported as ESM and CommonJS for reuse in popup and tests.
export function deriveOverlayState(msg) {
    if (!msg || msg.target === 'offscreen') return { action: 'noop' };
    if (msg.phase === 'start') {
        return { action: 'show', text: msg.message || 'Fetching resources from Hugging Face...', isError: false };
    }
    if (msg.phase === 'download') {
        const detail = msg.status === 'cached' ? 'cached' : 'downloading';
        return { action: 'show', text: `${msg.file || 'Model'}: ${detail}...`, isError: false };
    }
    if (msg.phase === 'ready') {
        return { action: 'hide', text: msg.message || 'Models cached. Ready to read.', isError: false };
    }
    if (msg.phase === 'error') {
        return { action: 'show', text: msg.message || 'Model download failed. Check your connection.', isError: true };
    }
    return { action: 'noop' };
}

// CommonJS export for Jest
if (typeof module !== 'undefined') {
    module.exports = { deriveOverlayState };
}
