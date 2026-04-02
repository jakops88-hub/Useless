'use strict';

// ── API Configuration ───────────────────────────────────────────────────────
// PASTE YOUR REAL GEMINI API KEY HERE
const GEMINI_API_KEY = "AIzaSyD_2tAeFN6zmMLVAqq1xZ87NigeQUQJTIo";

// ── Element references ──────────────────────────────────────────────────────
const startBtn          = document.getElementById('start-btn');
const webcamBox         = document.getElementById('webcam-box');
const webcamFeed        = document.getElementById('webcam-feed');
const webcamPlaceholder = document.getElementById('webcam-placeholder');
const countdownOverlay  = document.getElementById('countdown-overlay');
const snapshotCanvas    = document.getElementById('snapshot-canvas');
const resultsArea       = document.getElementById('results-area');
const verdict418Title   = document.getElementById('verdict-418-title');
const teapotIcon        = document.getElementById('teapot-icon');
const scoreDisplay      = document.getElementById('score-display');
const scoreNumber       = document.getElementById('score-number');
const resultsComment    = document.getElementById('results-comment');
const resultsBadges     = document.getElementById('results-badges');
const downloadBtn       = document.getElementById('download-btn');

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
      callGeminiAndShow();
    };
    reader.onerror = function () {
      console.warn('Failed to encode audio recording:', reader.error);
      startBtn.disabled    = false;
      startBtn.textContent = 'START AUDITION';
      auditionActive       = false;
    };
    reader.readAsDataURL(blob);

    stopStream();
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

  verdict418Title.hidden = true;
  teapotIcon.hidden      = false;
  scoreDisplay.hidden    = false;
  resultsArea.classList.remove('is-418');
  document.body.classList.remove('is-418');

  downloadBtn.hidden = !window.AuditionApp.snapshotBase64;

  resultsArea.hidden = false;
  resultsArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Hide results ────────────────────────────────────────────────────────────
function hideResults() {
  resultsArea.hidden = true;
  resultsArea.classList.remove('is-418');
  document.body.classList.remove('is-418');
  verdict418Title.hidden = true;
  teapotIcon.hidden      = true;
  scoreDisplay.hidden    = false;
  scoreNumber.textContent = '0';
  resultsComment.textContent = '';
  resultsBadges.innerHTML = '';
  downloadBtn.hidden = true;
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
downloadBtn.addEventListener('click', downloadSnapshot);

// ── Glass-break sound (Web Audio API) ───────────────────────────────────────
function playGlassBreak() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx      = new AudioCtx();
    const rate     = ctx.sampleRate;
    const duration = 1.2;
    const buf      = ctx.createBuffer(1, Math.floor(rate * duration), rate);
    const data     = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t  = i / rate;
      data[i]  = (Math.random() * 2 - 1) * Math.exp(-t * 8);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp   = ctx.createBiquadFilter();
    hp.type    = 'highpass';
    hp.frequency.value = 3000;
    src.connect(hp);
    hp.connect(ctx.destination);
    src.start(0);
    src.onended = function () { ctx.close(); };
  } catch (e) {
    console.warn('Glass-break sound unavailable:', e);
  }
}

// ── Parse JSON response from Gemini and display the verdict ─────────────────
function parseAndShowVerdict(geminiJson) {
  const is418   = !!geminiJson.is_418;
  const comment = String(geminiJson.comment || '');
  const score   = Number(geminiJson.score)  || 0;
  const badges  = Array.isArray(geminiJson.badges) ? geminiJson.badges : [];

  if (is418) {
    document.body.classList.add('is-418');
    resultsArea.classList.add('is-418');
    playGlassBreak();
    verdict418Title.hidden = false;
    teapotIcon.hidden      = true;
    scoreDisplay.hidden    = true;
  } else {
    document.body.classList.remove('is-418');
    resultsArea.classList.remove('is-418');
    verdict418Title.hidden = true;
    teapotIcon.hidden      = false;
    scoreDisplay.hidden    = false;
    scoreNumber.textContent = score;
  }

  resultsComment.textContent = comment;
  resultsBadges.innerHTML    = '';
  badges.forEach(function (label) {
    const badge       = document.createElement('span');
    badge.className   = 'badge';
    badge.textContent = label;
    resultsBadges.appendChild(badge);
  });

  downloadBtn.hidden = !window.AuditionApp.snapshotBase64;

  resultsArea.hidden = false;
  resultsArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Send snapshot + audio to Gemini and return the verdict object ────────────
async function sendToGemini(imageBase64, audioBase64) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_API_KEY_HERE") {
    alert("Hold up! You forgot to add your API key at the top of app.js");
    throw new Error("Missing API Key");
  }

  // Strip out the metadata headers from the base64 strings
  const cleanImage = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const cleanAudio = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY;

  const payload = {
    contents: [{
      parts: [
        { text: "You are an extremely snobbish and judgmental 19th-century British teapot acting as an audition judge. The human in the image and audio clip is trying to prove they are worthy of becoming an HTCPCP-certified teapot by whistling. Look closely at how ridiculous their facial expression is in the image, and listen to the quality of their whistle. Give them a score between 1 and 10. If the score is below 8, you must throw an HTTP 418 I am a teapot error, refuse to approve them, and write an insulting comment about why they are a disgrace to tea culture. If they score 8 or higher, give them a passive-aggressive compliment. Respond only in strict JSON format with exactly four keys: 'score' (number), 'is_418' (boolean), 'comment' (string), and 'badges' (an array of 1 to 3 short strings representing funny awards based on their performance, like 'Leaky Spout', 'Pitchy', or 'Boiling Hot')." },
        { inline_data: { mime_type: "image/jpeg", data: cleanImage } },
        { inline_data: { mime_type: "audio/webm", data: cleanAudio } }
      ]
    }],
    generationConfig: {
      response_mime_type: "application/json",
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Gemini API blew up with status: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates[0].content.parts[0].text;
  return JSON.parse(rawText);
}

// ── Orchestrate: call Gemini, then display the verdict ──────────────────────
async function callGeminiAndShow() {
  startBtn.textContent = 'Consulting the Judges…';
  startBtn.disabled    = true;
  try {
    const response = await sendToGemini(
      window.AuditionApp.snapshotBase64,
      window.AuditionApp.audioBase64
    );
    parseAndShowVerdict(response);
  } catch (err) {
    console.warn('Gemini API error:', err);
    startBtn.textContent = 'API ERROR. TRY AGAIN.';
  } finally {
    if(startBtn.textContent !== 'API ERROR. TRY AGAIN.') {
        startBtn.disabled    = false;
        startBtn.textContent = 'START AUDITION';
    }
    auditionActive       = false;
  }
}

// ── Download the audition snapshot ──────────────────────────────────────────
function downloadSnapshot() {
  const base64 = window.AuditionApp.snapshotBase64;
  if (!base64) return;
  const a      = document.createElement('a');
  a.href       = base64;
  a.download   = 'audition-evidence.jpg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── Exports (for future integration / testing) ──────────────────────────────
window.AuditionApp = {
  startAudition:       startAudition,
  showResults:         showResults,
  hideResults:         hideResults,
  parseAndShowVerdict: parseAndShowVerdict,
  sendToGemini:        sendToGemini,
  downloadSnapshot:    downloadSnapshot,
  stopStream:          stopStream,
  snapshotBase64:      null,
  audioBase64:         null,
};
