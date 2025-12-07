// Provider selection and fallback tests for offscreen init.

jest.mock('../lib/helper.js', () => ({
  loadTextToSpeechFromUrls: jest.fn(),
  loadVoiceStyleFromUrls: jest.fn(async () => ({ name: 'Supertonic M1' }))
}));

let loadTextToSpeechFromUrls;
let loadVoiceStyleFromUrls;

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

describe('offscreen provider selection', () => {
  const fakeEngine = {
    call: async () => ({ wav: new Float32Array([0, 0]) }),
    cfgs: {},
    sampleRate: 24000
  };

  beforeEach(() => {
    jest.resetModules();
    ({ loadTextToSpeechFromUrls, loadVoiceStyleFromUrls } = require('../lib/helper.js'));
    listeners.length = 0;
    memoryCache.clear();
    chrome.runtime.sendMessage.mockReset();
    loadTextToSpeechFromUrls.mockReset();
    loadVoiceStyleFromUrls.mockReset();
    loadVoiceStyleFromUrls.mockResolvedValue({ name: 'Supertonic M1' });
    global.ort = undefined;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('requests webgpu+wasm when GPU is available and requested', async () => {
    let capturedOptions = null;
    loadTextToSpeechFromUrls.mockImplementation(async (_urls, options) => {
      capturedOptions = options;
      return fakeEngine;
    });
    jest.spyOn(global, 'navigator', 'get').mockReturnValue({ gpu: {}, hardwareConcurrency: 8 });

    require('../offscreen.js');
    const responder = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'init', useWebGPU: true }, {}, responder);

    expect(responder).toHaveBeenCalledWith(true);
    expect(capturedOptions).toEqual({ executionProviders: ['webgpu', 'wasm'] });
  });

  test('forces wasm when GPU exists but useWebGPU is false', async () => {
    let capturedOptions = null;
    loadTextToSpeechFromUrls.mockImplementation(async (_urls, options) => {
      capturedOptions = options;
      return fakeEngine;
    });
    jest.spyOn(global, 'navigator', 'get').mockReturnValue({ gpu: {}, hardwareConcurrency: 8 });

    require('../offscreen.js');
    const responder = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'init', useWebGPU: false }, {}, responder);

    expect(responder).toHaveBeenCalledWith(true);
    expect(capturedOptions).toEqual({ executionProviders: ['wasm'] });
  });

  test('uses wasm when GPU is absent even if requested', async () => {
    let capturedOptions = null;
    loadTextToSpeechFromUrls.mockImplementation(async (_urls, options) => {
      capturedOptions = options;
      return fakeEngine;
    });
    jest.spyOn(global, 'navigator', 'get').mockReturnValue({ hardwareConcurrency: 4 });

    require('../offscreen.js');
    const responder = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'init', useWebGPU: true }, {}, responder);

    expect(responder).toHaveBeenCalledWith(true);
    expect(capturedOptions).toEqual({ executionProviders: ['wasm'] });
  });

  test('falls back to wasm when webgpu init throws', async () => {
    let capturedOptions = null;
    loadTextToSpeechFromUrls
      .mockImplementationOnce(async () => { throw new Error('webgpu failed'); })
      .mockImplementationOnce(async (_urls, options) => {
        capturedOptions = options;
        return fakeEngine;
      });

    jest.spyOn(global, 'navigator', 'get').mockReturnValue({ gpu: {}, hardwareConcurrency: 4 });

    require('../offscreen.js');
    const responder = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'init', useWebGPU: true }, {}, responder);

    expect(responder).toHaveBeenCalledWith(true);
    expect(capturedOptions).toEqual({ executionProviders: ['wasm'] });
    expect(loadTextToSpeechFromUrls).toHaveBeenCalledTimes(2);
  });
});
