'use strict';

// ── Element references ──────────────────────────────────────────────────────
const startBtn          = document.getElementById('start-btn');
const webcamBox         = document.getElementById('webcam-box');
const webcamFeed        = document.getElementById('webcam-feed');
const webcamPlaceholder = document.getElementById('webcam-placeholder');
const countdownOverlay  = document.getElementById('countdown-overlay');
const snapshotCanvas    = document.getElementById('snapshot-canvas');
const resultsArea       = document.getElementById('results-area');
const scoreNumber       = document.getElementById('score-number');
const resultsComment    = document.getElementById('results-comment');
const resultsBadges     = document.getElementById('results-badges');

// ── State ───────────────────────────────────────────────────────────────────
let auditionActive  = false;
let stream          = null;
let snapshotTimeout = null;
let stopTimeout     = null;

// ── Start audition ──────────────────────────────────────────────────────────
async function startAudition() {
  if (auditionActive) return;
  auditionActive = true;

  startBtn.classList.add('pressed');
  startBtn.disabled = true;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    webcamFeed.srcObject = stream;
    webcamPlaceholder.classList.add('hidden');
  } catch (err) {
    console.warn('Webcam/microphone not available:', err);
    auditionActive = false;
    startBtn.disabled = false;
    startBtn.classList.remove('pressed');
    return;
  }

  startBtn.textContent = 'WHISTLE NOW!';
  startBtn.classList.remove('pressed');

  hideResults();
  startCountdown();
}

// ── 3-second visual countdown ────────────────────────────────────────────────
function startCountdown() {
  let count = 3;
  countdownOverlay.textContent = count;
  countdownOverlay.classList.remove('hidden');

  const interval = setInterval(function () {
    count -= 1;
    if (count > 0) {
      countdownOverlay.textContent = count;
    } else {
      clearInterval(interval);
      countdownOverlay.classList.add('hidden');
      startCapture();
    }
  }, 1000);
}

// ── Record 4 s of audio; snapshot at 2 s; hide feed when done ───────────────
function startCapture() {
  if (!stream || stream.getAudioTracks().length === 0) {
    console.warn('No active audio track available for recording.');
    stopStream();
    startBtn.disabled    = false;
    startBtn.textContent = 'START AUDITION';
    auditionActive       = false;
    return;
  }

  const audioStream = new MediaStream(stream.getAudioTracks());
  const recorder    = new MediaRecorder(audioStream);
  const chunks      = [];

  recorder.ondataavailable = function (e) {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = function () {
    const blob   = new Blob(chunks, { type: recorder.mimeType });
    const reader = new FileReader();
    reader.onload = function () {
      window.AuditionApp.audioBase64 = reader.result;
    };
    reader.onerror = function () {
      console.warn('Failed to encode audio recording:', reader.error);
    };
    reader.readAsDataURL(blob);

    stopStream();
    startBtn.disabled    = false;
    startBtn.textContent = 'START AUDITION';
    auditionActive       = false;
  };

  recorder.start();

  // Halfway (2 s): snapshot
  snapshotTimeout = setTimeout(function () {
    snapshotTimeout = null;
    if (!webcamFeed.srcObject) return;
    snapshotCanvas.width  = webcamFeed.videoWidth  || 640;
    snapshotCanvas.height = webcamFeed.videoHeight || 360;
    const ctx = snapshotCanvas.getContext('2d');
    ctx.drawImage(webcamFeed, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
    window.AuditionApp.snapshotBase64 = snapshotCanvas.toDataURL('image/jpeg');
  }, 2000);

  // End (4 s): stop recording
  stopTimeout = setTimeout(function () {
    stopTimeout = null;
    if (recorder.state !== 'inactive') recorder.stop();
  }, 4000);
}

// ── Display results ─────────────────────────────────────────────────────────
function showResults(score, comment, badges) {
  scoreNumber.textContent = score;
  resultsComment.textContent = comment;

  resultsBadges.innerHTML = '';
  badges.forEach(function (label) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = label;
    resultsBadges.appendChild(badge);
  });

  resultsArea.hidden = false;
  resultsArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Hide results ────────────────────────────────────────────────────────────
function hideResults() {
  resultsArea.hidden = true;
  scoreNumber.textContent = '0';
  resultsComment.textContent = '';
  resultsBadges.innerHTML = '';
}

// ── Stop the webcam stream ──────────────────────────────────────────────────
function stopStream() {
  if (snapshotTimeout !== null) {
    clearTimeout(snapshotTimeout);
    snapshotTimeout = null;
  }
  if (stopTimeout !== null) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }
  if (stream) {
    stream.getTracks().forEach(function (track) { track.stop(); });
    stream = null;
  }
  webcamFeed.srcObject = null;
  webcamPlaceholder.classList.remove('hidden');
}

// ── Event listeners ─────────────────────────────────────────────────────────
startBtn.addEventListener('click', startAudition);

// ── Exports (for future integration / testing) ──────────────────────────────
window.AuditionApp = {
  startAudition:  startAudition,
  showResults:    showResults,
  hideResults:    hideResults,
  stopStream:     stopStream,
  snapshotBase64: null,
  audioBase64:    null,
};
