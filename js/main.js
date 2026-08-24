const audio_file_select_INPUT = document.getElementById("audio_file_select_INPUT");
const audio_file_state_P = document.getElementById("audio_file_state_P");
const audio_file_deselect_INPUT = document.getElementById("audio_file_deselect_INPUT");
const activate_mic_input_BUTTON = document.getElementById("activate_mic_input_BUTTON");

const audioContext = new AudioContext();
const analyserNode = audioContext.createAnalyser();
const possibleAudioInputs = Object.freeze({ "none": 0, "file": 1, "mic": 2 });
var currentActiveAudioInput = possibleAudioInputs["none"];
var isMicInputOn = false;

var fileSourceNode;

audio_file_select_INPUT.addEventListener('change', (event) => {
  const files = event.target.files;
  if (files.length > 0) {
    if (currentActiveAudioInput !== possibleAudioInputs["none"]) {
      if (mediaStream) {
        mediaStream.getTracks().forEach(element => {
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

          fileSourceNode.start();
        }
      };

      reader.readAsArrayBuffer(file);
    }
  }
});

audio_file_deselect_INPUT.addEventListener('click', (event) => {
  audio_file_select_INPUT.value = '';
  if (fileSourceNode) {
    fileSourceNode.stop();
  }
  currentActiveAudioInput = possibleAudioInputs["none"];
});


let mediaStream;
var micSourceNode;

activate_mic_input_BUTTON.addEventListener('click', (async event => {
  isMicInputOn = !isMicInputOn;

  if (isMicInputOn) {
    if (currentActiveAudioInput !== possibleAudioInputs["none"]) {
      if (confirm("Sei sicuro di voler attivare il microfono scollegando e rimuovendo la traccia audio caricata?")) {
        audio_file_select_INPUT.value = '';
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
      mediaStream = await navigator.mediaDevices.getUserMedia({audio: true});
      micSourceNode = audioContext.createMediaStreamSource(mediaStream);
      
      micSourceNode.connect(analyserNode);
    } catch (error) {
      isMicInputOn = false;
      currentActiveAudioInput = possibleAudioInputs["none"];
      event.target.innerHTML = "Attiva input microfono";
    }
  } else {
    mediaStream.getTracks().forEach(element => {
      element.stop();
    });
  }
}));