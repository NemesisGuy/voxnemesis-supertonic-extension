// Covers status reporting for modelsReady and audio flags after init completes.

jest.mock('../lib/helper.js', () => ({
  loadTextToSpeechFromUrls: jest.fn(async () => ({
    call: async () => ({ wav: new Float32Array([0, 0]) }),
    cfgs: {},
    sampleRate: 24000
  })),
  loadVoiceStyleFromUrls: jest.fn(async () => ({ name: 'Supertonic M1' }))
}));

const listeners = [];

// Minimal chrome runtime + message harness
global.chrome = {
  runtime: {
    onMessage: { addListener: fn => listeners.push(fn) },
    sendMessage: jest.fn(() => Promise.resolve())
  }
};

// Cache and fetch mocks to avoid network
const memoryCache = new Map();
global.caches = {
  open: async () => ({
    match: async (key) => memoryCache.get(key),
    put: async (key, value) => memoryCache.set(key, value)
  })
};

global.URL.createObjectURL = jest.fn(() => 'blob:ok');
global.fetch = jest.fn(async () => ({
  ok: true,
  async blob() { return new Blob(['ok']); },
  clone() { return this; }
}));

describe('offscreen status reporting', () => {
  beforeEach(() => {
    jest.resetModules();
    listeners.length = 0;
    memoryCache.clear();
    chrome.runtime.sendMessage.mockReset();
  });

  test('getStatus reports modelsReady after init', async () => {
    require('../offscreen.js');

    const responderInit = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'init', useWebGPU: false }, {}, responderInit);
    expect(responderInit).toHaveBeenCalledWith(true);

    const responderStatus = jest.fn();
    listeners[0]({ target: 'offscreen', type: 'getStatus' }, {}, responderStatus);
    expect(responderStatus).toHaveBeenCalledWith(
      expect.objectContaining({ modelsReady: true, hasAudio: false })
    );
  });
});
