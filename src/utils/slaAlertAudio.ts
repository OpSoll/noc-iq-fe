
type AudioAlertOptions = {
  volume?: number;
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  return audioContext;
}

export async function playSlaAlert({
  volume = 0.5,
}: AudioAlertOptions = {}): Promise<void> {
  const ctx = getAudioContext();

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const masterGain = ctx.createGain();
  masterGain.gain.value = Math.max(0, Math.min(1, volume));

  masterGain.connect(ctx.destination);

  const frequencies = [880, 1174.66];
  const start = ctx.currentTime;

  frequencies.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    const onset = start + index * 0.12;
    const duration = 0.18;

    gain.gain.setValueAtTime(0, onset);
    gain.gain.linearRampToValueAtTime(0.22, onset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, onset + duration);

    oscillator.connect(gain);
    gain.connect(masterGain);

    oscillator.start(onset);
    oscillator.stop(onset + duration);
  });

  masterGain.gain.setValueAtTime(volume, start);
  masterGain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
  masterGain.disconnect();
}
