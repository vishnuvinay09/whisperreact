import React, {useState} from 'react'
import * as helper from "./helper.js";

async function Whisper() {
    const [showButton, setShowButton] = useState(true)

    var context = null;
  
    // audio data
    var audio = null;
    var audio0 = null;
  
    // the stream instance
    var instance = null;
  
    // model name
    var model_whisper = null;

    // var Module = {
    //   print: helper.printTextarea,
    //   printErr: helper.printTextarea,
    //   setStatus: function (text) {
    //     helper.printTextarea("js: " + text);
    //   },
    //   monitorRunDependencies: function (left) {},
    //   preRun: function () {
    //     helper.printTextarea("js: Preparing ...");
    //   },
    //   postRun: function () {
    //     helper.printTextarea("js: Initialized successfully!");
    //   },
    // };

    var Module = window.whisperModule;
  
    //
    // fetch models
    //
  
  
    function storeFS(fname, buf) {
      // write to WASM file using FS_createDataFile
      // if the file exists, delete it
      try {
        Module.FS_unlink(fname);
      } catch (e) {
        // ignore
      }

      //console.log(Module);
      Module.FS_createDataFile("/", fname, buf, true, true);

  
      helper.printTextarea(
        "storeFS: stored model: " + fname + " size: " + buf.length
      );
  
      document.getElementById("model-whisper-status").innerHTML =
        'loaded "' + model_whisper + '"!';
  
      if (model_whisper != null) {
        document.getElementById("start").disabled = false;
        document.getElementById("stop").disabled = true;
      }
    }
  
    function loadWhisper(model) {
      let urls = {
        "tiny.en": "https://whisper.ggerganov.com/ggml-model-whisper-tiny.en.bin",
        "base.en": "https://whisper.ggerganov.com/ggml-model-whisper-base.en.bin",
  
        "tiny-en-q5_1":
          "https://whisper.ggerganov.com/ggml-model-whisper-tiny.en-q5_1.bin",
        "base-en-q5_1":
          "https://whisper.ggerganov.com/ggml-model-whisper-base.en-q5_1.bin",
      };
  
      let sizes = {
        "tiny.en": 75,
        "base.en": 142,
  
        "tiny-en-q5_1": 31,
        "base-en-q5_1": 57,
      };
  
      let url = urls[model];
      let dst = "whisper.bin";
      let size_mb = sizes[model];
  
      model_whisper = model;
  
      // document.getElementById("fetch-whisper-tiny-en").style.display = "none";
      // document.getElementById("fetch-whisper-base-en").style.display = "none";
  
      // document.getElementById("fetch-whisper-tiny-en-q5_1").style.display =
      //   "none";
      setShowButton(false)
  
      let d1 = document.getElementById("model-whisper-status")
      if(d1){
          d1.innerHTML ='loading "' + model + '" ... ';
      }
      let cbProgress = function (p) {
        let el = document.getElementById("fetch-whisper-progress");
        el.innerHTML = Math.round(100 * p) + "%";
      };
  
      let cbCancel = function () {
        var el;
        el = document.getElementById("fetch-whisper-tiny-en");
        if (el) el.style.display = "inline-block";
        el = document.getElementById("fetch-whisper-base-en");
        if (el) el.style.display = "inline-block";
  
        el = document.getElementById("fetch-whisper-tiny-en-q5_1");
        if (el) el.style.display = "inline-block";
        el = document.getElementById("fetch-whisper-base-en-q5_1");
        if (el) el.style.display = "inline-block";
  
        el = document.getElementById("model-whisper-status");
        if (el) el.innerHTML = "";
      };
  
      helper.loadRemote(
        url,
        dst,
        size_mb,
        cbProgress,
        storeFS,
        cbCancel,
        helper.printTextarea
      );
    }
  
    //
    // microphone
    //
  
    const kSampleRate = 16000;
    const kRestartRecording_s = 120;
    const kIntervalAudio_ms = 5000; // pass the recorded audio to the C++ instance at this rate
  
    var mediaRecorder = null;
    var doRecording = false;
    var startTime = 0;
  
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    window.OfflineAudioContext =
      window.OfflineAudioContext || window.webkitOfflineAudioContext;
  
    function stopRecording() {
      Module.set_status("paused");
      doRecording = false;
      audio0 = null;
      audio = null;
      context = null;
    }
  
    function startRecording() {
      if (!context) {
        context = new AudioContext({
          sampleRate: kSampleRate,
          channelCount: 1,
          echoCancellation: false,
          autoGainControl: true,
          noiseSuppression: true,
        });
      }
  
      Module.set_status("");
  
      document.getElementById("start").disabled = true;
      document.getElementById("stop").disabled = false;
  
      doRecording = true;
      startTime = Date.now();
  
      var chunks = [];
      var stream = null;
  
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: false })
        .then(function (s) {
          stream = s;
          mediaRecorder = new MediaRecorder(stream);
          mediaRecorder.ondataavailable = function (e) {
            chunks.push(e.data);
  
            var blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
            var reader = new FileReader();
  
            reader.onload = function (event) {
              var buf = new Uint8Array(reader.result);
  
              if (!context) {
                return;
              }
              context.decodeAudioData(
                buf.buffer,
                function (audioBuffer) {
                  var offlineContext = new OfflineAudioContext(
                    audioBuffer.numberOfChannels,
                    audioBuffer.length,
                    audioBuffer.sampleRate
                  );
                  var source = offlineContext.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(offlineContext.destination);
                  source.start(0);
  
                  offlineContext.startRendering().then(function (renderedBuffer) {
                    audio = renderedBuffer.getChannelData(0);
  
                    //helper.printTextarea('js: audio recorded, size: ' + audio.length + ', old size: ' + (audio0 == null ? 0 : audio0.length));
  
                    var audioAll = new Float32Array(
                      audio0 == null ? audio.length : audio0.length + audio.length
                    );
                    if (audio0 != null) {
                      audioAll.set(audio0, 0);
                    }
                    audioAll.set(audio, audio0 == null ? 0 : audio0.length);
  
                    if (instance) {
                      Module.set_audio(instance, audioAll);
                    }
                  });
                },
                function (e) {
                  audio = null;
                }
              );
            };
  
            reader.readAsArrayBuffer(blob);
          };
  
          mediaRecorder.onstop = function (e) {
            if (doRecording) {
              setTimeout(function () {
                startRecording();
              });
            }
          };
  
          mediaRecorder.start(kIntervalAudio_ms);
        })
        .catch(function (err) {
          helper.printTextarea("js: error getting audio stream: " + err);
        });
  
      var interval = setInterval(function () {
        if (!doRecording) {
          clearInterval(interval);
          mediaRecorder.stop();
          stream.getTracks().forEach(function (track) {
            track.stop();
          });
  
          document.getElementById("start").disabled = false;
          document.getElementById("stop").disabled = true;
  
          mediaRecorder = null;
        }
  
        // if audio length is more than kRestartRecording_s seconds, restart recording
        if (audio != null && audio.length > kSampleRate * kRestartRecording_s) {
          if (doRecording) {
            //helper.printTextarea('js: restarting recording');
  
            clearInterval(interval);
            audio0 = audio;
            audio = null;
            mediaRecorder.stop();
            stream.getTracks().forEach(function (track) {
              track.stop();
            });
          }
        }
      }, 100);
    }
  
    //
    // main
    //
  
    var nLines = 0;
    var intervalUpdate = null;
    var transcribedAll = "";
  
    function onStart() {
      if (!instance) {
        instance = Module.init("whisper.bin");
  
        if (instance) {
          helper.printTextarea("js: whisper initialized, instance: " + instance);
        }
      }
  
      if (!instance) {
        helper.printTextarea("js: failed to initialize whisper");
        return;
      }
  
      startRecording();
  
      intervalUpdate = setInterval(function () {
        var transcribed = Module.get_transcribed();
        // console.log("text got by me", transcribed);
  
        if (transcribed != null && transcribed.length > 1) {
          transcribedAll += transcribed + "<br>";
          nLines++;
  
          // if more than 10 lines, remove the first line
          if (nLines > 10) {
            var i = transcribedAll.indexOf("<br>");
            if (i > 0) {
              transcribedAll = transcribedAll.substring(i + 4);
              nLines--;
            }
          }
        }
  
        document.getElementById("state-status").innerHTML = Module.get_status();
        document.getElementById("state-transcribed").innerHTML = transcribedAll;
      }, 100);
    }
  
    function onStop() {
      stopRecording();
    }
  return (
    <div className="main-container">
    <b>stream : Real-time Whisper transcription in WebAssembly</b>
    <br></br>
    You can find more about this project on{" "}
    <a href="https://github.com/ggerganov/whisper.cpp/tree/master/examples/stream.wasm">
      GitHub
    </a>
    .<br></br>
    {/* <b>More examples:</b>
            <a href="https://whisper.ggerganov.com/">main</a> |
            <a href="https://whisper.ggerganov.com/bench">bench</a> |
            <a href="https://whisper.ggerganov.com/stream">stream</a> |
            <a href="https://whisper.ggerganov.com/command">command</a> |
            <a href="https://whisper.ggerganov.com/talk">talk</a> |

        <br></br> */}
    <hr></hr>
    Select the model you would like to use, click the "Start" button and
    start speaking

    <br></br>
    <div id="model-whisper">
      {showButton && <button
        id="fetch-whisper-base-en-q5_1"
        onClick={()=>loadWhisper('base-en-q5_1')}
      >
        base.en (Q5_1, 57 MB)
      </button>}
      <span id="fetch-whisper-progress"></span>
      {/* <!--
                <input type="file" id="file" name="file" onchange="loadFile(event, 'whisper.bin')" />
            --> */}
    </div>
    <br />
    <div id="input">
      <button id="start" onClick={onStart} disabled>
        Start
      </button>
      <button id="stop" onClick={onStop} disabled>
        Stop
      </button>
    </div>
    <br />
    <div id="state">
      Status:{" "}
      <b>
        <span id="state-status">not started</span>
      </b>
      <pre id="state-transcribed">
        [The transcribed text will be displayed here]
      </pre>
    </div>
    <hr />
    Debug output:
    <textarea id="output" rows="20"></textarea>
    <br />
    <b>Troubleshooting</b>
    <br />
    The page does some heavy computations, so make sure:
    <ul>
      <li>To use a modern web browser (e.g. Chrome, Firefox)</li>
      <li>
        To use a fast desktop or laptop computer (i.e. not a mobile phone)
      </li>
      <li>
        Your browser supports WASM{" "}
        <a href="https://webassembly.org/roadmap/">Fixed-width SIMD</a>
      </li>
    </ul>
    <div className="cell-version">
      <span>
        | Build time: <span className="nav-link">Thu Jun 27 01:50:19 2024</span>{" "}
        | Commit hash:{" "}
        <a
          className="nav-link"
          href="https://github.com/ggerganov/whisper.cpp/commit/c118733a"
        >
          c118733a
        </a>{" "}
        | Commit subject:{" "}
        <span className="nav-link">sync : ggml + fix sync script</span> |
        <a
          className="nav-link"
          href="https://github.com/ggerganov/whisper.cpp/tree/master/examples/stream.wasm"
        >
          Source Code
        </a>{" "}
        |
      </span>
    </div>
  </div>
  )
}

export default Whisper