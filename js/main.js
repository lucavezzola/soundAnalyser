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
const spectrometer_log_BUTTON = document.getElementById(
  "spectrometer_log_BUTTON",
);
const current_frequency_P = document.getElementById("current_frequency_P");

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

let spectrometerLogScale = false;
spectrometer_log_BUTTON.classList.add("inactive");

spectrometer_log_BUTTON.addEventListener("click", (event) => {
  spectrometerLogScale = !spectrometerLogScale;

  if (!spectrometerLogScale) {
    spectrometer_log_BUTTON.classList.add("inactive");
  } else {
    spectrometer_log_BUTTON.classList.remove("inactive");
  }
});

// ===== ANALYSERS SIZING =====

const amplitude_analyser_CANVAS = document.getElementById(
  "amplitude_analyser_CANVAS",
);
const frequency_analyser_CANVAS = document.getElementById(
  "frequency_analyser_CANVAS",
);
const spectrometer_CANVAS = document.getElementById("spectrometer_CANVAS");
const volume_analyzer_CANVAS = document.getElementById(
  "volume_analyzer_CANVAS",
);
const frequency_history_CANVAS = document.getElementById(
  "frequency_history_CANVAS",
);

const analyserCanvasCtx = amplitude_analyser_CANVAS.getContext("2d");
const frequencyCanvasCtx = frequency_analyser_CANVAS.getContext("2d");
const spectrometerCanvasCtx = spectrometer_CANVAS.getContext("2d");
const volumeCanvasCtx = volume_analyzer_CANVAS.getContext("2d");
const pitchChartCanvasCtx = frequency_history_CANVAS.getContext("2d");

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

  spectrometer_CANVAS.width = targetWidth;
  spectrometer_CANVAS.height = 500;

  volume_analyzer_CANVAS.width = targetWidth;
  volume_analyzer_CANVAS.height = 20;

  timeDataRatio = timeDataArray.length / amplitude_analyser_CANVAS.width;
  frequencyDataRatio =
    frequencyDataArray.length / frequency_analyser_CANVAS.width;
}

window.addEventListener("resize", resizeAnalyserCanvases);
resizeAnalyserCanvases(); // chiamata iniziale, subito all'avvio

let lastPitchValues = new Array(100).fill(null);
let currentFrequency = null;
const minFreq = 20;
// Every audio input is resampled by the browser to match the
// audio context sample rate.
const sampleRate = audioContext.sampleRate;
const maxFreq = sampleRate / 2;
const minBrightness = 0.25;
const maxBrightness = 0.45;

const spectrometerDrawShift = 1;

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
    const ratio = x / frequency_analyser_CANVAS.width;
    const xFrequency = minFreq * Math.pow(maxFreq / minFreq, ratio);
    const binIndex = Math.round(
      (xFrequency * analyserNode.frequencyBinCount) / maxFreq,
    );
    const value = frequencyDataArray[binIndex];
    const barHeight = (value / 255) * frequency_analyser_CANVAS.height;

    frequencyCanvasCtx.fillRect(
      x,
      frequency_analyser_CANVAS.height - barHeight, // punto di partenza (in alto della barra)
      1,
      barHeight, // altezza della barra
    );
  }

  // ===== SPECTROMETER =====
  let pixelHue;
  let pixelBrightness;

  if (spectrometerLogScale) {
    spectrometerCanvasCtx.drawImage(
      spectrometer_CANVAS,
      -spectrometerDrawShift,
      0,
    );

    let ratio;
    let yFrequency;
    let binIndex;

    for (let y = 0; y < spectrometer_CANVAS.height; y++) {
      ratio = y / spectrometer_CANVAS.height;
      yFrequency = minFreq * Math.pow(maxFreq / minFreq, ratio);
      binIndex = Math.round(
        (yFrequency * analyserNode.frequencyBinCount) / maxFreq,
      );

      pixelHue = 270 - (270 * frequencyDataArray[binIndex]) / 255;
      pixelBrightness =
        (frequencyDataArray[binIndex] * (maxBrightness - minBrightness)) / 255 +
        minBrightness;

      spectrometerCanvasCtx.fillStyle = `hsl(${pixelHue}, 100%, ${pixelBrightness * 100}%)`;

      spectrometerCanvasCtx.fillRect(
        spectrometer_CANVAS.width - spectrometerDrawShift,
        spectrometer_CANVAS.height - 1 - y, // Canva's y axix goes down, not up
        spectrometerDrawShift,
        1,
      );
    }
  } else {
    spectrometerCanvasCtx.drawImage(spectrometer_CANVAS, -1, 0);

    for (let y = 0; y < spectrometer_CANVAS.height; y++) {
      binIndex = Math.round(
        (frequencyDataArray.length / spectrometer_CANVAS.height) * y,
      );
      pixelHue = 270 - (270 * frequencyDataArray[binIndex]) / 255;
      pixelBrightness =
        (frequencyDataArray[binIndex] * (maxBrightness - minBrightness)) / 255 +
        minBrightness;

      spectrometerCanvasCtx.fillStyle = `hsl(${pixelHue}, 100%, ${pixelBrightness * 100}%)`;

      spectrometerCanvasCtx.fillRect(
        spectrometer_CANVAS.width - 1,
        spectrometer_CANVAS.height - 1 - y, // Canva's y axix goes down, not up
        1,
        1,
      );
    }
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

  // ===== PITCH ANALYSER =====
  const lagBottomLimit = Math.round(sampleRate / 1000);
  const lagTopLimit = Math.round(sampleRate / 80);
  let highestCorrLag = 0; // The lag with highest correlation
  let currentLagCorr = 0;
  let currentLagCorrMean;
  let currentLagCorrMeanScaled;
  let currentMaxCorr = 0; // "lag = 0"'s correlation, the highest possible
  let currentMaxCorrMean;

  {
    let i;
    for (i = 0; i < timeDataArray.length; i++) {
      currentMaxCorr += Math.pow(timeDataArray[i] - 128, 2);
    }

    currentMaxCorrMean = currentMaxCorr / (i - 1);
  }

  // Trova la prima lag (scostamento) con correlazione (scalata) maggiore
  // moltiplicando i punti dell'onda con quelli dell'onda
  // stessa shiftata di "lag" campioni.
  for (let lag = lagBottomLimit; lag <= lagTopLimit; lag++) {
    let i;
    for (i = 0; i + lag < timeDataArray.length; i++) {
      currentLagCorr +=
        (timeDataArray[i] - 128) * (timeDataArray[i + lag] - 128);
    }

    currentLagCorrMean = currentLagCorr / (i - 1);
    currentLagCorrMeanScaled = currentLagCorrMean / currentMaxCorrMean;

    if (currentLagCorrMeanScaled > 0.9) {
      highestCorrLag = lag;
      break;
    }

    currentLagCorr = 0;
  }

  // Calcola la frequenza corrispondente al lag con maggiore correlazione
  // (la frequenza della nota che sta venendo suonata nel timeDataArray)
  currentFrequency = highestCorrLag === 0 ? null : sampleRate / highestCorrLag;
  current_frequency_P.innerHTML =
    currentFrequency === null ? "-----" : currentFrequency.toFixed(2);

  requestAnimationFrame(drawAnalysersCanvas);
}

//  ===== PITCH VISUALIZER =====
const pitchData = {
  labels: [],
  datasets: [
    {
      label: "Real-time pitch",
      data: lastPitchValues,
      borderColor: "rgb(0, 0, 0)",
      spanGaps: false,
    },
  ],
};

for (let i = 0; i < lastPitchValues.length; i++) {
  if (i % 10 === 0) {
    pitchData.labels.push(-(100 - i) / 10);
  } else {
    pitchData.labels.push("");
  }
}

const pitchChart = new Chart(pitchChartCanvasCtx, {
  type: "line",
  data: pitchData,
  options: {
    scales: {
      y: {
        type: "logarithmic",
        min: 80,
        max: 1500,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
  },
});

const updatePitchAnalyser = () => {
  pitchChart.data.datasets[0].data.push(currentFrequency);
  pitchChart.data.datasets[0].data.shift();
};

const intervalId = setInterval(updatePitchAnalyser, 100);
const pitchChartUpdateVisualIntervalId = setInterval(
  () => pitchChart.update(),
  10,
);

requestAnimationFrame(drawAnalysersCanvas);
