/**
 * Original generative garden score — pentatonic chimes + a soft pad.
 * No external audio file required.
 */

type GardenAudio = {
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => Promise<boolean>;
  isPlaying: () => boolean;
};

export function createGardenAudio(externalAudioUrl?: string): GardenAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let mediaElement: HTMLAudioElement | null = null;
  let nodes: AudioNode[] = [];
  let timers: number[] = [];
  let playing = false;

  const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];

  function clear() {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
    nodes.forEach((n) => {
      try {
        (n as OscillatorNode).stop?.();
      } catch {
        /* already stopped */
      }
    });
    nodes = [];
  }

  function chime(freq: number, when: number, dur = 2.4) {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.value = freq;
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.045, when + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + dur + 0.05);
    nodes.push(osc, gain, filter);
  }

  function pad(freq: number) {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.value = 0.018;
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    nodes.push(osc, gain);
  }

  function schedule() {
    if (!ctx || !playing) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 6; i += 1) {
      const n = notes[Math.floor(Math.random() * notes.length)] ?? 392;
      const octave = Math.random() > 0.7 ? 2 : 1;
      chime(n * octave, now + i * (0.7 + Math.random() * 0.9), 2.2 + Math.random());
    }
    const id = window.setTimeout(schedule, 4200);
    timers.push(id);
  }

  async function start() {
    if (playing) return;
    const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") await ctx.resume();

    // Try external audio first (public/invitation/garden-music.mp3 by default)
    const url = externalAudioUrl ?? "/invitation/garden-music.mp3";
    // Create the media element synchronously so `play()` runs inside the
    // user gesture call stack (avoids autoplay being blocked by awaiting network).
    try {
      mediaElement = new Audio(url);
      mediaElement.loop = true;
      mediaElement.preload = "auto";
      mediaElement.crossOrigin = "anonymous";

      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);

      const src = ctx.createMediaElementSource(mediaElement);
      src.connect(master);
      nodes.push(src);

      // Play (resume context first if needed). Keep this call synchronous
      // before any await so browsers treat it as a user-initiated play.
      if (ctx.state === "suspended") {
        // resume can be async; attempt resume but do not await before play
        void ctx.resume();
      }
      try {
        // play() may still fail on some platforms; ignore failures and fall
        // back to the generative score below.
        const p = mediaElement.play();
        // If a promise is returned, swallow errors asynchronously.
        if (p && typeof p.then === "function") p.catch(() => {});
      } catch {
        // ignore
      }

      playing = true;
      return;
    } catch (e) {
      // fall back to generative audio below
    }

    // Fallback: generative WebAudio score
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    pad(196);
    pad(246.94);
    playing = true;
    schedule();
  }

  function stop() {
    playing = false;
    clear();
    if (mediaElement) {
      try {
        mediaElement.pause();
        mediaElement.currentTime = 0;
      } catch {}
      mediaElement = null;
    }

    if (master && ctx) {
      try {
        master.disconnect();
      } catch {
        /* noop */
      }
    }
    master = null;
  }

  return {
    start,
    stop,
    async toggle() {
      if (playing) {
        stop();
        return false;
      }
      await start();
      return true;
    },
    isPlaying: () => playing,
  };
}
