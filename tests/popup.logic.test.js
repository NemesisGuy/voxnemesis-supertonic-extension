const { deriveOverlayState } = require('../popup.logic.js');

describe('deriveOverlayState', () => {
    test('handles start', () => {
        const state = deriveOverlayState({ phase: 'start', message: 'Downloading' });
        expect(state).toEqual({ action: 'show', text: 'Downloading', isError: false });
    });

    test('handles download cached', () => {
        const state = deriveOverlayState({ phase: 'download', status: 'cached', file: 'duration' });
        expect(state).toEqual({ action: 'show', text: 'duration: cached...', isError: false });
    });

    test('handles ready', () => {
        const state = deriveOverlayState({ phase: 'ready', message: 'Ready' });
        expect(state).toEqual({ action: 'hide', text: 'Ready', isError: false });
    });

    test('handles error', () => {
        const state = deriveOverlayState({ phase: 'error', message: 'Fail' });
        expect(state).toEqual({ action: 'show', text: 'Fail', isError: true });
    });
});
