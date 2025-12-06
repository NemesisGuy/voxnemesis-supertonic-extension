import { loadTextToSpeech, loadVoiceStyle } from './lib/helper.js';

let ttsEngine = null;
let currentStyle = null;
let audioContext = null;
let sourceNode = null;
let audioBufferGlobal = null;
let playbackStartTime = 0;
let playbackStartOffset = 0;
let progressInterval = null;
let isPaused = false;
let pausedOffset = 0;

// Listen for messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.target !== 'offscreen') return;

    switch (msg.type) {
        case 'init':
            initEngine(msg.useWebGPU).then(success => sendResponse(success));
            return true;
        case 'speak':
            isPaused = false;
            pausedOffset = 0;
            speak(msg.text, msg.settings)
                .then(() => sendResponse('done'))
                .catch(err => {
                    console.error("Speak error:", err);
                    sendResponse({ error: err.message });
                });
            return true;
        case 'playBuffer':
            if (audioBufferGlobal) {
                playBuffer(pausedOffset);
                sendResponse('playing');
            } else {
                sendResponse('no_buffer');
            }
            return false;
        case 'pause':
            pauseAudio();
            sendResponse('paused');
            return false;
        case 'resume':
            resumeAudio().then((success) => sendResponse(success ? 'resumed' : 'no_audio'));
            return true;
        case 'stop':
            stopAudio();
            sendResponse('stopped');
            return false;
        case 'seek':
            seek(msg.time).then(() => sendResponse('seeking'));
            return true;
        case 'getStatus':
            sendResponse({
                hasAudio: !!audioBufferGlobal,
                isPlaying: !!sourceNode && !isPaused,
                isPaused: isPaused,
                currentTime: getCurrentTime(),
                duration: audioBufferGlobal ? audioBufferGlobal.duration : 0
            });
            return false;
    }
});

function getCurrentTime() {
    if (!audioBufferGlobal || !audioContext) return 0;
    if (isPaused) return pausedOffset;
    const elapsed = audioContext.currentTime - playbackStartTime;
    let time = playbackStartOffset + elapsed;
    if (time > audioBufferGlobal.duration) time = audioBufferGlobal.duration;
    return time;
}

async function initEngine(useWebGPU) {
    if (ttsEngine) return true;
    try {
        const libPath = chrome.runtime.getURL('lib/');
        if (typeof ort !== 'undefined') {
            ort.env.wasm.wasmPaths = libPath;
            ort.env.wasm.numThreads = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1));
            ort.env.wasm.simd = true;
        } else if (self.ort) {
            self.ort.env.wasm.wasmPaths = libPath;
            self.ort.env.wasm.numThreads = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1));
            self.ort.env.wasm.simd = true;
        }

        const assetsPath = 'assets/onnx';
        const webgpuAvailable = (useWebGPU !== false) && typeof navigator !== 'undefined' && !!navigator.gpu;
        const options = { executionProviders: webgpuAvailable ? ['webgpu', 'wasm'] : ['wasm'] };

        console.log('Initializing Supertonic Engine (Threads:', ort.env.wasm.numThreads, 'WebGPU:', webgpuAvailable, ')', options);
        ttsEngine = await loadTextToSpeech(assetsPath, options);

        // Load default style
        currentStyle = await loadVoiceStyle(['assets/voice_styles/M1.json']);
        currentStyle.name = 'Supertonic M1';

        return true;
    } catch (e) {
        console.error('Engine Init Failed:', e);
        if (useWebGPU) return initEngine(false);
        return false;
    }
}

async function speak(text, settings) {
    console.log("Speak called", settings);
    if (!ttsEngine) await initEngine();

    const voiceName = settings.voiceName || 'Supertonic M1';
    const styleMap = {
        'Supertonic M1': 'M1.json', 'Supertonic M2': 'M2.json',
        'Supertonic F1': 'F1.json', 'Supertonic F2': 'F2.json'
    };
    const styleFile = styleMap[voiceName] || 'M1.json';
    const stylePath = `assets/voice_styles/${styleFile}`;

    if (!currentStyle || currentStyle.name !== voiceName) {
        try {
            currentStyle = await loadVoiceStyle([stylePath]);
            currentStyle.name = voiceName;
        } catch (e) { }
    }

    if (settings.seed) ttsEngine.cfgs.seed = parseInt(settings.seed);
    else delete ttsEngine.cfgs.seed;

    if (!audioContext) audioContext = new AudioContext();
    if (audioContext.state === 'suspended') await audioContext.resume();

    stopAudio();

    const steps = parseInt(settings.steps) || 6;
    const speed = parseFloat(settings.rate) || 1.0;
    const volume = parseFloat(settings.volume) || 1.0;

    console.log("Generating audio...", { steps, speed, volume });
    const { wav } = await ttsEngine.call(text, currentStyle, steps, speed, volume);

    // Create new buffer
    audioBufferGlobal = audioContext.createBuffer(1, wav.length, ttsEngine.sampleRate);
    const channelData = audioBufferGlobal.getChannelData(0);
    for (let i = 0; i < wav.length; i++) channelData[i] = wav[i];

    // Check autoplay
    if (settings.autoplay !== false) {
        playBuffer(0);
    } else {
        // Just notify that generation is done
        chrome.runtime.sendMessage({
            type: 'generationDone',
            duration: audioBufferGlobal.duration
        });
    }
}

function playBuffer(offset = 0) {
    if (!audioBufferGlobal || !audioContext) return;

    if (sourceNode) {
        try { sourceNode.stop(); sourceNode.onended = null; } catch (e) { }
        sourceNode = null;
    }

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBufferGlobal;
    sourceNode.connect(audioContext.destination);

    sourceNode.onended = () => {
        // Verify if we really finished
        if (!isPaused && sourceNode) {
            stopProgressTimer();
            chrome.runtime.sendMessage({ type: 'playbackEnded' });
            sourceNode = null;
        }
    };

    sourceNode.start(0, offset);

    chrome.runtime.sendMessage({ type: 'playing', currentTime: offset, duration: audioBufferGlobal.duration }).catch(() => { });

    playbackStartTime = audioContext.currentTime;
    playbackStartOffset = offset;
    pausedOffset = offset;
    isPaused = false;

    startProgressTimer();
}

function pauseAudio() {
    if (!audioContext || !sourceNode) return;
    stopProgressTimer();
    const elapsed = audioContext.currentTime - playbackStartTime;
    pausedOffset = playbackStartOffset + elapsed;
    if (pausedOffset > audioBufferGlobal.duration) pausedOffset = audioBufferGlobal.duration;

    isPaused = true;
    try { sourceNode.stop(); sourceNode.onended = null; } catch (e) { }
    sourceNode = null;
}

async function resumeAudio() {
    if (!audioContext) return false;
    if (audioContext.state === 'suspended') await audioContext.resume();

    if (isPaused && audioBufferGlobal) {
        playBuffer(pausedOffset);
        return true;
    } else if (audioBufferGlobal) {
        playBuffer(0);
        return true;
    }
    return false;
}

async function seek(time) {
    if (!audioBufferGlobal || !audioContext) return;
    if (audioContext.state === 'suspended') await audioContext.resume();

    const duration = audioBufferGlobal.duration;
    if (time < 0) time = 0;
    if (time > duration) time = duration;
    playBuffer(time);
}

function stopAudio() {
    if (sourceNode) {
        try { sourceNode.stop(); sourceNode.onended = null; } catch (e) { }
        sourceNode = null;
    }
    stopProgressTimer();
    audioBufferGlobal = null;
    isPaused = false;
    pausedOffset = 0;
}

function startProgressTimer() {
    stopProgressTimer();
    progressInterval = setInterval(() => {
        if (!audioBufferGlobal || !audioContext || isPaused) return;

        const currentTime = getCurrentTime();
        const duration = audioBufferGlobal.duration;

        if (currentTime >= duration) {
            stopProgressTimer();
            // onended handle message
        } else {
            chrome.runtime.sendMessage({
                type: 'progress',
                currentTime: currentTime,
                duration: duration
            }).catch(() => { });
        }
    }, 100);
}

function stopProgressTimer() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}
