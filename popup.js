import { deriveOverlayState } from './popup.logic.js';

(() => {
// Popup script scoped via IIFE to avoid global leakage.
document.addEventListener('DOMContentLoaded', () => {
    const voiceSelect = document.getElementById('voiceSelect');
    const rateRange = document.getElementById('rateRange');
    const rateValue = document.getElementById('rateValue');
    const pitchRange = document.getElementById('pitchRange');
    const pitchValue = document.getElementById('pitchValue');
    const volumeRange = document.getElementById('volumeRange');
    const volumeValue = document.getElementById('volumeValue');
    const seedInput = document.getElementById('seedInput');
    const generateBtn = document.getElementById('generateBtn');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const statusMessage = document.getElementById('statusMessage');
    const loader = document.getElementById('loader');
    const progressBar = document.getElementById('progressBar');
    const currentTimeEl = document.getElementById('currentTime');
    const durationEl = document.getElementById('duration');
    const qualitySelect = document.getElementById('qualitySelect');
    const overlay = document.getElementById('fetchOverlay');
    const overlayText = document.getElementById('overlayText');
    const overlayRetry = document.getElementById('overlayRetry');

    let isDragging = false;
    let playbackState = 'stopped'; // stopped, playing, paused, generating, ready
    let hasAudio = false;

    // Pre-warm the offscreen engine so the first generate is faster.
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'init', useWebGPU: true }).catch(() => { /* ignore */ });

    // Wire up UI event listeners
    generateBtn.addEventListener('click', handleGenerate);
    playBtn.addEventListener('click', handlePlayClick);
    pauseBtn.addEventListener('click', handlePauseClick);
    stopBtn.addEventListener('click', handleStopClick);
    overlayRetry.addEventListener('click', retryAssetDownload);
    progressBar.addEventListener('input', (e) => {
        isDragging = true;
        currentTimeEl.textContent = formatTime(parseFloat(e.target.value));
    });
    progressBar.addEventListener('change', (e) => {
        isDragging = false;
        seek(e.target.value);
    });

    // Listen for progress updates from offscreen audio
    chrome.runtime.onMessage.addListener((msg) => {
        if (!msg || msg.target === 'offscreen') return;

        if (msg.type === 'assetStatus') {
            handleAssetStatus(msg);
            return;
        }

        if (msg.type === 'progress' && !isDragging) {
            progressBar.max = msg.duration || progressBar.max;
            progressBar.value = msg.currentTime || 0;
            currentTimeEl.textContent = formatTime(msg.currentTime || 0);
            durationEl.textContent = formatTime(msg.duration || 0);
            hasAudio = true;
            if (playbackState !== 'playing') {
                updateUIState('playing');
                updateStatus('Playing...');
            }
        } else if (msg.type === 'playbackEnded') {
            updateUIState('stopped');
            updateStatus('Playback finished.');
            hasAudio = false;
        } else if (msg.type === 'generationDone') {
            hasAudio = true;
            progressBar.max = msg.duration || progressBar.max;
            durationEl.textContent = formatTime(msg.duration || 0);
            updateUIState('ready');
            updateStatus('Audio ready. Press play.');
        } else if (msg.type === 'playing') {
            hasAudio = true;
            progressBar.max = msg.duration || progressBar.max;
            durationEl.textContent = formatTime(msg.duration || 0);
            currentTimeEl.textContent = formatTime(msg.currentTime || 0);
            updateUIState('playing');
            updateStatus('Playing...');
        }
    });

    // Trigger state sync
    chrome.runtime.sendMessage({ command: 'getStatus' }, (status) => {
        if (chrome.runtime.lastError) console.warn('Sync error:', chrome.runtime.lastError);
        if (status) {
            hasAudio = status.hasAudio;
            if (status.isPlaying) {
                updateUIState('playing');
            } else if (status.isPaused) {
                updateUIState('paused');
            } else if (status.hasAudio) {
                updateUIState('ready');
            }
            if (status.duration) {
                progressBar.max = status.duration;
                durationEl.textContent = formatTime(status.duration);
            }
            if (status.currentTime) {
                progressBar.value = status.currentTime;
                currentTimeEl.textContent = formatTime(status.currentTime);
            }
        }
    });

    function populateVoiceList() {
        voiceSelect.innerHTML = '';

        const supertonicVoices = [
            { name: 'Supertonic M1', label: 'Supertonic M1 (Male)' },
            { name: 'Supertonic M2', label: 'Supertonic M2 (Male Deep)' },
            { name: 'Supertonic F1', label: 'Supertonic F1 (Female)' },
            { name: 'Supertonic F2', label: 'Supertonic F2 (Female Soft)' }
        ];

        supertonicVoices.forEach(v => {
            const option = document.createElement('option');
            option.textContent = v.label;
            option.setAttribute('data-name', v.name);
            voiceSelect.appendChild(option);
        });

        chrome.storage.local.get(['selectedVoiceName', 'rate', 'pitch', 'volume', 'seed', 'steps'], (result) => {
            if (result.selectedVoiceName) {
                const options = Array.from(voiceSelect.options);
                const matchingOption = options.find(opt => opt.getAttribute('data-name') === result.selectedVoiceName);
                if (matchingOption) {
                    voiceSelect.value = matchingOption.value;
                    matchingOption.selected = true;
                }
            }
            if (result.rate) {
                rateRange.value = result.rate;
                rateValue.textContent = result.rate;
            }
            if (result.pitch) {
                pitchRange.value = result.pitch;
                pitchValue.textContent = result.pitch;
            }
            if (result.volume) {
                volumeRange.value = result.volume;
                volumeValue.textContent = result.volume;
            }
            if (result.seed) {
                seedInput.value = result.seed;
            }
            if (result.steps) {
                qualitySelect.value = result.steps;
            }
        });
    }

    populateVoiceList();

    rateRange.addEventListener('input', () => { rateValue.textContent = rateRange.value; saveSettings(); });
    pitchRange.addEventListener('input', () => { pitchValue.textContent = pitchRange.value; saveSettings(); });
    volumeRange.addEventListener('input', () => { volumeValue.textContent = volumeRange.value; saveSettings(); });
    seedInput.addEventListener('input', saveSettings);
    voiceSelect.addEventListener('change', saveSettings);
    qualitySelect.addEventListener('change', saveSettings);

    function saveSettings() {
        const selectedOption = voiceSelect.selectedOptions[0];
        const voiceName = selectedOption ? selectedOption.getAttribute('data-name') : 'Supertonic M1';

        const settings = {
            selectedVoiceName: voiceName,
            rate: rateRange.value,
            pitch: pitchRange.value,
            volume: volumeRange.value,
            seed: seedInput.value,
            steps: qualitySelect.value
        };
        chrome.storage.local.set(settings);
    }

    function sendCommand(command, extraParams = {}) {
        const selectedOption = voiceSelect.selectedOptions[0];
        const voiceName = selectedOption ? selectedOption.getAttribute('data-name') : 'Supertonic M1';

        const settings = {
            voiceName: voiceName,
            rate: rateRange.value,
            pitch: pitchRange.value,
            volume: volumeRange.value,
            seed: seedInput.value,
            steps: qualitySelect.value,
            ...extraParams
        };

        chrome.runtime.sendMessage({ command, settings }).then(response => {
            if (response) {
                if (response.status === 'no_audio' || response === 'no_audio') {
                    updateStatus('Audio expired. Generate again.');
                    updateUIState('stopped');
                    hasAudio = false;
                } else if (response.status === 'no_text') {
                    updateStatus('Please select text on the page first.');
                    updateUIState('ready');
                } else if (response.status === 'resumed' || response === 'resumed' || response === 'playing') {
                    updateUIState('playing');
                    hasAudio = true;
                }
            }
        }).catch(err => {
            console.warn('Message error:', err);
            updateStatus('Error: ' + err.message);
            loader.classList.add('hidden');
        });
    }

    function seek(time) {
        chrome.runtime.sendMessage({ command: 'seek', time: parseFloat(time) });
    }

    function handleGenerate() {
        hasAudio = false;
        updateUIState('generating');
        updateStatus('Generating audio...');
        sendCommand('play', { autoplay: true });
    }

    function handlePlayClick() {
        if (playbackState === 'paused' && hasAudio) {
            sendCommand('resume');
            updateUIState('playing');
            updateStatus('Resumed playback.');
        } else if (hasAudio && playbackState !== 'playing') {
            sendCommand('playBuffer');
            updateUIState('playing');
            updateStatus('Playing buffered audio.');
        } else {
            updateStatus('No audio buffered. Click Generate Audio first.');
            updateUIState('ready');
        }
    }

    function handlePauseClick() {
        if (!hasAudio) return;
        sendCommand('pause');
        updateUIState('paused');
    }

    function handleStopClick() {
        if (!hasAudio) return;
        sendCommand('stop');
        updateUIState('stopped');
        hasAudio = false;
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function updateStatus(text, options = {}) {
        statusMessage.textContent = text;
        if (options.showLoader) {
            loader.classList.remove('hidden');
        } else if (text !== 'Generating audio...') {
            loader.classList.add('hidden');
        }
    }

    function updateUIState(state) {
        playbackState = state;
        if (state !== 'generating') loader.classList.add('hidden');

        if (state === 'playing') {
            statusMessage.textContent = 'Playing...';
            playBtn.classList.add('active');
        } else if (state === 'paused') {
            statusMessage.textContent = 'Paused';
            playBtn.classList.remove('active');
        } else if (state === 'stopped') {
            statusMessage.textContent = 'Ready';
            progressBar.value = 0;
            currentTimeEl.textContent = '0:00';
            playBtn.classList.remove('active');
        } else if (state === 'ready') {
            playBtn.classList.remove('active');
        } else if (state === 'generating') {
            statusMessage.textContent = 'Generating audio...';
            loader.classList.remove('hidden');
        }
    }

    function handleAssetStatus(msg) {
        const state = deriveOverlayState(msg);
        if (state.action === 'show') {
            showOverlay(state.text, state.isError);
        } else if (state.action === 'hide') {
            hideOverlay(state.text);
        }
    }

    function showOverlay(text, isError = false) {
        overlayText.textContent = text;
        overlay.classList.remove('hidden');
        overlayRetry.classList.toggle('hidden', !isError);
        overlayText.style.color = isError ? '#fca5a5' : '#f8fafc';
    }

    function hideOverlay(statusText) {
        if (statusText) updateStatus(statusText);
        overlay.classList.add('hidden');
        overlayRetry.classList.add('hidden');
    }

    function retryAssetDownload() {
        showOverlay('Retrying download...', false);
        chrome.runtime.sendMessage({ target: 'offscreen', type: 'init', useWebGPU: true }).catch(() => {
            showOverlay('Retry failed. Check connection.', true);
        });
    }
});
})();
