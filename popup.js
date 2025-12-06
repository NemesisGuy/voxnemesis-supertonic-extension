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
        if (chrome.runtime.lastError) console.warn("Sync error:", chrome.runtime.lastError);
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

    // --- Voice Loading ---
    // Load available Supertonic voices and restore saved slider values.
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

        // Restore settings
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

    // --- UI Listeners ---
    rateRange.addEventListener('input', () => { rateValue.textContent = rateRange.value; saveSettings(); });
    pitchRange.addEventListener('input', () => { pitchValue.textContent = pitchRange.value; saveSettings(); });
    volumeRange.addEventListener('input', () => { volumeValue.textContent = volumeRange.value; saveSettings(); });
    seedInput.addEventListener('input', saveSettings);
    voiceSelect.addEventListener('change', saveSettings);
    qualitySelect.addEventListener('change', saveSettings);

    // ...

    // Persist current control values so they survive popup reopen.
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

    // Send a command to the background/offscreen pipeline with merged settings.
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

        chrome.runtime.sendMessage({
            command: command,
            settings: settings
        }).then(response => {
            if (response) {
                if (response.status === 'no_audio' || response === 'no_audio') { // Handle both wrapper and raw
                    updateStatus("Audio Expired. Generate Again.");
                    updateUIState('stopped');
                    hasAudio = false;
                } else if (response.status === 'no_text') {
                    updateStatus("Please select text on the page first.");
                    updateUIState('ready');
                } else if (response.status === 'resumed' || response === 'resumed') {
                    // Success
                    updateUIState('playing');
                    hasAudio = true;
                } else if (response === 'playing') {
                    updateUIState('playing');
                    hasAudio = true;
                }
            }
        }).catch(err => {
            console.warn("Message error:", err);
            updateStatus("Error: " + err.message);
            loader.classList.add('hidden');
        });
    }

    // Jump playback to a given second mark.
    function seek(time) {
        chrome.runtime.sendMessage({
            command: 'seek',
            time: parseFloat(time)
        });
    }

    // --- UI Actions ---
    // Generate fresh audio from the selected text.
    function handleGenerate() {
        hasAudio = false;
        updateUIState('generating');
        updateStatus('Generating audio...');
        sendCommand('play', { autoplay: true });
    }

    // Play or resume depending on current state.
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

    // Pause active playback.
    function handlePauseClick() {
        if (!hasAudio) return;
        sendCommand('pause');
        updateUIState('paused');
    }

    // Stop and clear current audio buffer.
    function handleStopClick() {
        if (!hasAudio) return;
        sendCommand('stop');
        updateUIState('stopped');
        hasAudio = false;
    }

    // Convert seconds to M:SS display.
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Update status label and hide loader when appropriate.
    function updateStatus(text) {
        statusMessage.textContent = text;
        if (text !== 'Generating audio...') {
            loader.classList.add('hidden');
        }
    }

    // Sync button/label states to the current playback lifecycle.
    function updateUIState(state) {
        playbackState = state;

        // Hide loader unless generating
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
            currentTimeEl.textContent = "0:00";
            playBtn.classList.remove('active');
        } else if (state === 'ready') {
            // We stay in ready state. 
            playBtn.classList.remove('active');
        } else if (state === 'generating') {
            statusMessage.textContent = 'Generating audio...';
            loader.classList.remove('hidden');
        }
    }
});
