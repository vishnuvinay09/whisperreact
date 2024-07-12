const loadWhisperModule = async () => {
    try {
      window.whisperModule = Module; // Attach the instance to the window object
    } catch (error) {
      console.error('Failed to load WASM module', error);
    }
  };
  
  loadWhisperModule();