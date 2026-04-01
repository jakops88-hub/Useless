'use strict';

// ── Element references ──────────────────────────────────────────────────────
const startBtn        = document.getElementById('start-btn');
const webcamBox       = document.getElementById('webcam-box');
const webcamFeed      = document.getElementById('webcam-feed');
const webcamPlaceholder = document.getElementById('webcam-placeholder');
const resultsArea     = document.getElementById('results-area');
const scoreNumber     = document.getElementById('score-number');
const resultsComment  = document.getElementById('results-comment');
const resultsBadges   = document.getElementById('results-badges');

// ── State ───────────────────────────────────────────────────────────────────
let auditionActive = false;
let stream         = null;

// ── Start audition ──────────────────────────────────────────────────────────
async function startAudition() {
  if (auditionActive) return;
  auditionActive = true;

  startBtn.classList.add('pressed');
  startBtn.disabled = true;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    webcamFeed.srcObject = stream;
    webcamPlaceholder.classList.add('hidden');
  } catch (err) {
    console.warn('Webcam not available:', err);
    // Continue without webcam — the show must go on
  }

  startBtn.textContent = 'AUDITION IN PROGRESS…';
  startBtn.classList.remove('pressed');

  hideResults();
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
  startAudition: startAudition,
  showResults:   showResults,
  hideResults:   hideResults,
  stopStream:    stopStream,
};
