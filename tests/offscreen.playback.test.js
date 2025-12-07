// Integration-ish tests for playback control messages: resume and seek.

jest.useFakeTimers();

jest.mock('../lib/helper.js', () => ({
  loadTextToSpeechFromUrls: jest.fn(async () => ({
    call: async () => ({ wav: new Float32Array([0, 0, 0, 0]) }),
    cfgs: {},
    sampleRate: 24000
  })),
  loadVoiceStyleFromUrls: jest.fn(async () => ({ name: 'Supertonic M1' }))
}));

const listeners = [];

// chrome runtime mock (captures sendMessage for assertions if needed)
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

// Minimal AudioContext stub to support play/seek/resume
class FakeBufferSource {
  constructor(buffer, destination) {
    this.buffer = buffer;
    this.destination = destination;
    this.onended = null;
    this.started = false;
  }
  connect() { /* no-op */ }
  start() { this.started = true; }
  stop() { /* no-op */ }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
  }
  createBuffer(channels, length, sampleRate) {
    return {
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length)
    };
  }
  createBufferSource() {
    return new FakeBufferSource(null, this.destination);
  }
  resume() { return Promise.resolve(); }
}

describe('offscreen playback controls', () => {
  beforeEach(() => {
    jest.resetModules();
    listeners.length = 0;
    memoryCache.clear();
    chrome.runtime.sendMessage.mockReset();
    global.AudioContext = FakeAudioContext;
    jest.spyOn(global, 'navigator', 'get').mockReturnValue({ hardwareConcurrency: 2 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('resume returns no_audio when nothing buffered, then succeeds after speak', async () => {
    require('../offscreen.js');

    // Init engine
    const initResponder = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'init', useWebGPU: false }, {}, initResponder);
    expect(initResponder).toHaveBeenCalledWith(true);

    // Resume before any audio
    const resumeResponder = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'resume' }, {}, resumeResponder);
    expect(resumeResponder).toHaveBeenCalledWith('no_audio');

    // Speak to buffer audio
    const speakResponder = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'speak', text: 'hi', settings: {} }, {}, speakResponder);
    expect(speakResponder).toHaveBeenCalledWith('done');

    // Resume should now succeed
    const resumeResponder2 = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'resume' }, {}, resumeResponder2);
    expect(resumeResponder2).toHaveBeenCalledWith('resumed');
  });

  test('seek responds after audio buffered', async () => {
    require('../offscreen.js');
    const initResponder = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'init', useWebGPU: false }, {}, initResponder);

    const speakResponder = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'speak', text: 'hi', settings: {} }, {}, speakResponder);
    expect(speakResponder).toHaveBeenCalledWith('done');

    const seekResponder = jest.fn();
    await listeners[0]({ target: 'offscreen', type: 'seek', time: 0.5 }, {}, seekResponder);
    expect(seekResponder).toHaveBeenCalledWith('seeking');
  });
});
