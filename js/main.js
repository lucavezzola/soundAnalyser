const audio_file_select_INPUT = document.getElementById(
  "audio_file_select_INPUT",
);
const audio_file_state_P = document.getElementById("audio_file_state_P");
const audio_file_deselect_INPUT = document.getElementById(
  "audio_file_deselect_INPUT",
);
const activate_mic_input_BUTTON = document.getElementById(
  "activate_mic_input_BUTTON",
);

const audioContext = new AudioContext();
const analyserNode = audioContext.createAnalyser();
const possibleAudioInputs = Object.freeze({ none: 0, file: 1, mic: 2 });
var currentActiveAudioInput = possibleAudioInputs["none"];
var isMicInputOn = false;

var fileSourceNode;

audio_file_select_INPUT.addEventListener("change", (event) => {
  const files = event.target.files;
  if (files.length > 0) {
    if (currentActiveAudioInput !== possibleAudioInputs["none"]) {
      if (mediaStream) {
        mediaStream.getTracks().forEach((element) => {
          element.stop();
        });
      }
      if (fileSourceNode) {
        fileSourceNode.stop();
      }
    }

    currentActiveAudioInput = possibleAudioInputs["file"];

    const file = audio_file_select_INPUT.files[0];
    if (file) {
      const reader = new FileReader();

      reader.onload = async (event) => {
        const audioBuffer = await audioContext.decodeAudioData(reader.result);
        if (audioBuffer) {
          fileSourceNode = audioContext.createBufferSource();

          fileSourceNode.buffer = audioBuffer;
          fileSourceNode.connect(analyserNode);
          fileSourceNode.connect(audioContext.destination);

          fileSourceNode.start();
        }
      };

      reader.readAsArrayBuffer(file);
    }
  }
});

audio_file_deselect_INPUT.addEventListener("click", (event) => {
  audio_file_select_INPUT.value = "";
  if (fileSourceNode) {
    fileSourceNode.stop();
  }
  currentActiveAudioInput = possibleAudioInputs["none"];
});

let mediaStream;
var micSourceNode;

activate_mic_input_BUTTON.addEventListener("click", async (event) => {
  isMicInputOn = !isMicInputOn;

  if (isMicInputOn) {
    if (currentActiveAudioInput !== possibleAudioInputs["none"]) {
      if (
        confirm(
          "Sei sicuro di voler attivare il microfono scollegando e rimuovendo la traccia audio caricata?",
        )
      ) {
        audio_file_select_INPUT.value = "";
        if (fileSourceNode) {
          fileSourceNode.stop();
        }
      } else {
        isMicInputOn = false;
        return;
      }
    }

    currentActiveAudioInput = possibleAudioInputs["mic"];
    event.target.innerHTML = "Disattiva input microfono";
  } else {
    currentActiveAudioInput = possibleAudioInputs["none"];
    event.target.innerHTML = "Attiva input microfono";
  }

  if (isMicInputOn) {
    // Chiede all'utente il permesso di accedere al microfono
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micSourceNode = audioContext.createMediaStreamSource(mediaStream);

      micSourceNode.connect(analyserNode);
    } catch (error) {
      isMicInputOn = false;
      currentActiveAudioInput = possibleAudioInputs["none"];
      event.target.innerHTML = "Attiva input microfono";
    }
  } else {
    mediaStream.getTracks().forEach((element) => {
      element.stop();
    });
  }
});

// ===== ANALYSER SIZING (condiviso tra waveform e spettro) =====

const amplitude_analyser_CANVAS = document.getElementById(
  "amplitude_analyser_CANVAS",
);
const frequency_analyser_CANVAS = document.getElementById(
  "frequency_analyser_CANVAS",
);
const volume_analyzer_CANVAS = document.getElementById(
  "volume_analyzer_CANVAS",
);

const analyserCanvasCtx = amplitude_analyser_CANVAS.getContext("2d");
const frequencyCanvasCtx = frequency_analyser_CANVAS.getContext("2d");
const volumeCanvasCtx = volume_analyzer_CANVAS.getContext("2d");

let timeDataArray = new Uint8Array(analyserNode.fftSize);
let frequencyDataArray = new Uint8Array(analyserNode.frequencyBinCount);

let timeDataRatio;
let frequencyDataRatio;

function resizeAnalyserCanvases() {
  const targetWidth = Math.round(document.documentElement.clientWidth * 0.95);

  amplitude_analyser_CANVAS.width = targetWidth;
  amplitude_analyser_CANVAS.height = 256;

  frequency_analyser_CANVAS.width = targetWidth;
  frequency_analyser_CANVAS.height = 256;

  volume_analyzer_CANVAS.width = targetWidth;
  volume_analyzer_CANVAS.height = 20;

  timeDataRatio = timeDataArray.length / amplitude_analyser_CANVAS.width;
  frequencyDataRatio =
    frequencyDataArray.length / frequency_analyser_CANVAS.width;
}

window.addEventListener("resize", resizeAnalyserCanvases);
resizeAnalyserCanvases(); // chiamata iniziale, subito all'avvio

function drawAnalysersCanvas() {
  // ===== AMPLITUDE ANALYSER =====
  analyserCanvasCtx.clearRect(
    0,
    0,
    amplitude_analyser_CANVAS.width,
    amplitude_analyser_CANVAS.height,
  );

  analyserNode.getByteTimeDomainData(timeDataArray);

  analyserCanvasCtx.beginPath();
  analyserCanvasCtx.moveTo(
    0,
    amplitude_analyser_CANVAS.height - timeDataArray[0],
  );

  for (let x = 0; x < amplitude_analyser_CANVAS.width; x++) {
    analyserCanvasCtx.lineTo(
      x,
      amplitude_analyser_CANVAS.height -
        timeDataArray[Math.floor(x * timeDataRatio)],
    );
  }

  analyserCanvasCtx.strokeStyle = "red";
  analyserCanvasCtx.lineWidth = 1;
  analyserCanvasCtx.stroke();

  // ===== FREQUENCY ANALYSER =====
  frequencyCanvasCtx.clearRect(
    0,
    0,
    frequency_analyser_CANVAS.width,
    frequency_analyser_CANVAS.height,
  );

  analyserNode.getByteFrequencyData(frequencyDataArray);

  frequencyCanvasCtx.fillStyle = "steelblue";

  for (let x = 0; x < frequency_analyser_CANVAS.width; x++) {
    const value = frequencyDataArray[Math.floor(x * frequencyDataRatio)];
    const barHeight = (value / 255) * frequency_analyser_CANVAS.height;

    frequencyCanvasCtx.fillRect(
      x,
      frequency_analyser_CANVAS.height - barHeight, // punto di partenza (in alto della barra)
      1,
      barHeight, // altezza della barra
    );
  }

  // ===== VOLUME ANALYSER =====
  volumeCanvasCtx.clearRect(
    0,
    0,
    volume_analyzer_CANVAS.width,
    volume_analyzer_CANVAS.height,
  );

  volumeCanvasCtx.fillStyle = "green";

  let rms; // root mean squared
  let squaresSum = 0;
  let squaresMean;

  timeDataArray.forEach((el) => {
    squaresSum += Math.pow(128 - el, 2);
  });

  squaresMean = squaresSum / timeDataArray.length;
  rms = Math.sqrt(squaresMean);

  volumeCanvasCtx.fillRect(
    0,
    0,
    (volume_analyzer_CANVAS.width * rms) / 128,
    volume_analyzer_CANVAS.height,
  );

  requestAnimationFrame(drawAnalysersCanvas);
}

requestAnimationFrame(drawAnalysersCanvas);
