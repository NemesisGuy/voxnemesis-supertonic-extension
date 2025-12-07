// Tests for offscreen init: WebGPU fallback and thread cap logic.

jest.mock('../lib/helper.js', () => ({
  loadTextToSpeechFromUrls: jest.fn(async () => ({
    call: async () => ({ wav: new Float32Array([0, 0]) }),
    cfgs: {},
    sampleRate: 24000
  })),
  loadVoiceStyleFromUrls: jest.fn(async () => ({ name: 'Supertonic M1' }))
}));

const listeners = [];

// chrome runtime mock
global.chrome = {
  runtime: {
    onMessage: { addListener: fn => listeners.push(fn) },
    sendMessage: jest.fn(() => Promise.resolve())
  }
};

// Cache/fetch mocks
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

describe('offscreen init fallbacks', () => {
  beforeEach(() => {
    jest.resetModules();
    listeners.length = 0;
    memoryCache.clear();
    chrome.runtime.sendMessage.mockReset();
    global.ort = undefined;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('falls back to wasm when navigator.gpu is unavailable', async () => {
    jest.spyOn(global, 'navigator', 'get').mockReturnValue({ hardwareConcurrency: 4 }); // no gpu

    require('../offscreen.js');
    const responder = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'init', useWebGPU: true }, {}, responder);
    expect(responder).toHaveBeenCalledWith(true);
  });

  test('caps threads to 1 when only one core is reported', async () => {
    const ortEnv = { wasm: { wasmPaths: '', numThreads: 0, simd: false } };
    global.ort = { env: ortEnv };
    jest.spyOn(global, 'navigator', 'get').mockReturnValue({ hardwareConcurrency: 1, gpu: undefined });

    require('../offscreen.js');
    const responder = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'init', useWebGPU: true }, {}, responder);

    expect(ortEnv.wasm.numThreads).toBe(1);
    expect(responder).toHaveBeenCalledWith(true);
  });
});
