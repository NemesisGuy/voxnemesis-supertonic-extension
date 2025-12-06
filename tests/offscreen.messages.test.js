// Basic unit tests for offscreen overlay/status logic using manual stubs.
// These are light-touch to keep bundle size minimal while covering busy-guard and error surfacing.

jest.mock('../lib/helper.js', () => ({
  loadTextToSpeechFromUrls: jest.fn(),
  loadVoiceStyleFromUrls: jest.fn()
}));

// Minimal chrome runtime mock
const listeners = [];
global.chrome = {
  runtime: {
    onMessage: { addListener: fn => listeners.push(fn) },
    sendMessage: jest.fn(() => Promise.resolve())
  }
};

describe('offscreen message flow', () => {
  beforeEach(() => {
    jest.resetModules();
    listeners.length = 0;
    chrome.runtime.sendMessage.mockReset();
  });

  test('init reports error when model fetch fails', async () => {
    const { loadTextToSpeechFromUrls } = require('../lib/helper.js');
    loadTextToSpeechFromUrls.mockRejectedValue(new Error('boom'));

    // Re-import to apply mocks
    const module = require('../offscreen.js');
    expect(module).toBeDefined();

    // Trigger init via listener
    const responder = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'init', useWebGPU: false }, {}, responder);
    expect(responder).toHaveBeenCalledWith(false);
  });

  test('speak rejects when engine busy', async () => {
    const { loadTextToSpeechFromUrls } = require('../lib/helper.js');
    loadTextToSpeechFromUrls.mockResolvedValue({
      call: () => new Promise(() => {}), // never resolves to keep busy
      cfgs: {},
      sampleRate: 24000
    });

    require('../offscreen.js');

    const responder = jest.fn();
    const msg = { target: 'offscreen', type: 'speak', text: 'hi', settings: {} };

    // First call will hang; we don't await it (simulate long run)
    listeners[0](msg, {}, () => {});

    // Second call should reject with busy error
    await listeners[0](msg, {}, responder);
    const response = responder.mock.calls[0][0];
    expect(response.error).toContain('busy');
  });
});
