class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0 && input[0].length > 0) {
      const channelData = input[0];
      // Float32 -> Int16 변환 (서버 전송용)
      const pcmData = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        let s = Math.max(-1, Math.min(1, channelData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
