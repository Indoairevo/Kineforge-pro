import { TimelineClip, Track } from '../types/editor';
import { computeDuckingGain } from './timelineLogic';

/**
 * Real-time WebAudio synthesizer and HTMLMediaElement audio processor.
 * Handles multi-track volume, fade in/out, audio ducking, 3-band EQ, noise reduction, and voice enhancement.
 */
class KineForgeAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private htmlAudioElements = new Map<string, HTMLAudioElement>();
  private lastStepIndex = -1;

  public ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getMasterMeterLevels(): { left: number; right: number } {
    if (!this.analyser || !this.ctx || this.ctx.state !== 'running') {
      return { left: 0, right: 0 };
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    let lowSum = 0;
    let highSum = 0;
    const half = Math.floor(data.length / 2);
    for (let i = 0; i < data.length; i++) {
      if (i < half) lowSum += data[i];
      else highSum += data[i];
    }
    const left = Math.min(100, Math.round((lowSum / (half * 255)) * 140));
    const right = Math.min(100, Math.round((highSum / (half * 255)) * 155));
    return { left, right };
  }

  /**
   * Called during playback tick (~60Hz) to trigger procedural synth steps and sync any HTMLAudioElement blobs.
   */
  public syncPlaybackTick(
    playheadTime: number,
    isPlaying: boolean,
    clips: TimelineClip[],
    tracks: Track[]
  ): void {
    if (!isPlaying) {
      this.stopAllHtmlAudio();
      this.lastStepIndex = -1;
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const anySolo = tracks.some((t) => t.solo);
    const activeTrackIds = new Set(
      tracks
        .filter((t) => !t.muted && (!anySolo || t.solo))
        .map((t) => t.id)
    );

    const activeClips = clips.filter(
      (c) =>
        activeTrackIds.has(c.trackId) &&
        !c.audio.muted &&
        c.audio.volume > 0 &&
        playheadTime >= c.startTime &&
        playheadTime <= c.startTime + c.duration
    );

    // Trigger procedural synth notes on 16th-note grid (0.125s steps at 120 BPM)
    const stepIndex = Math.floor(playheadTime * 8);
    if (stepIndex !== this.lastStepIndex) {
      this.lastStepIndex = stepIndex;
      for (const clip of activeClips) {
        if (clip.audioSynthPreset) {
          const gainMultiplier = this.computeEffectiveClipGain(clip, playheadTime, clips);
          if (gainMultiplier > 0.01) {
            this.triggerProceduralStep(ctx, this.masterGain, clip, stepIndex, playheadTime - clip.startTime, gainMultiplier);
          }
        }
      }
    }

    // Sync any real uploaded / TTS audio blobs
    const activeBlobClipIds = new Set<string>();
    for (const clip of activeClips) {
      if (clip.blobUrl && (clip.type === 'audio' || clip.type === 'video')) {
        activeBlobClipIds.add(clip.id);
        let el = this.htmlAudioElements.get(clip.id);
        if (!el) {
          el = new Audio(clip.blobUrl);
          el.crossOrigin = 'anonymous';
          this.htmlAudioElements.set(clip.id, el);
        }
        if (el.src !== clip.blobUrl) {
          el.src = clip.blobUrl;
        }
        const targetMediaTime = Math.max(0, clip.sourceOffset + (playheadTime - clip.startTime) * clip.speed);
        if (Math.abs(el.currentTime - targetMediaTime) > 0.35) {
          el.currentTime = targetMediaTime;
        }
        el.playbackRate = Math.max(0.25, Math.min(4, clip.speed));
        el.volume = Math.max(0, Math.min(1, this.computeEffectiveClipGain(clip, playheadTime, clips)));
        if (el.paused) {
          el.play().catch(() => {});
        }
      }
    }

    // Pause inactive blob audio elements
    for (const [clipId, el] of this.htmlAudioElements.entries()) {
      if (!activeBlobClipIds.has(clipId) && !el.paused) {
        el.pause();
      }
    }
  }

  public stopAllHtmlAudio(): void {
    for (const el of this.htmlAudioElements.values()) {
      if (!el.paused) {
        el.pause();
      }
    }
  }

  private computeEffectiveClipGain(clip: TimelineClip, playheadTime: number, allClips: TimelineClip[]): number {
    const localTime = playheadTime - clip.startTime;
    let base = (clip.audio.volume / 100) * 0.45;

    // Fade In
    if (clip.audio.fadeIn > 0 && localTime < clip.audio.fadeIn) {
      base *= Math.max(0, localTime / clip.audio.fadeIn);
    }
    // Fade Out
    const remaining = clip.duration - localTime;
    if (clip.audio.fadeOut > 0 && remaining < clip.audio.fadeOut) {
      base *= Math.max(0, remaining / clip.audio.fadeOut);
    }

    // Audio Ducking
    base *= computeDuckingGain(playheadTime, allClips, clip);

    return Math.max(0, Math.min(1, base));
  }

  private triggerProceduralStep(
    ctx: AudioContext,
    destination: AudioNode,
    clip: TimelineClip,
    stepIndex: number,
    localTime: number,
    gainLevel: number
  ): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    // 3-band EQ simulation via BiquadFilterNode
    const filter = ctx.createBiquadFilter();
    if (clip.audio.noiseReduction) {
      filter.type = 'highpass';
      filter.frequency.value = 140;
    } else if (clip.audio.voiceEnhance) {
      filter.type = 'peaking';
      filter.frequency.value = 2800;
      filter.gain.value = 6 + clip.audio.eq.mid;
    } else {
      filter.type = 'lowshelf';
      filter.frequency.value = 220;
      filter.gain.value = clip.audio.eq.low;
    }

    osc.connect(filter);
    filter.connect(env);
    env.connect(destination);

    const preset = clip.audioSynthPreset;
    if (preset === 'cyber_pulse_120') {
      const notes = [110, 110, 130.81, 146.83, 164.81, 146.83, 130.81, 98.0];
      const freq = notes[stepIndex % notes.length] * clip.speed;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      env.gain.setValueAtTime(gainLevel * 0.24, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (preset === 'ambient_horizon_90') {
      if (stepIndex % 4 !== 0) return;
      const chord = [220, 277.18, 329.63, 440];
      const freq = chord[(stepIndex / 4) % chord.length];
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(gainLevel * 0.2, now + 0.15);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (preset === 'voiceover_demo') {
      if (stepIndex % 2 !== 0) return;
      const cadence = [165, 190, 175, 210, 155, 180];
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(cadence[stepIndex % cadence.length], now);
      env.gain.setValueAtTime(gainLevel * 0.18, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (preset === 'whoosh_sfx' && localTime < 0.4) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.25);
      env.gain.setValueAtTime(gainLevel * 0.3, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (preset === 'sub_impact_sfx' && localTime < 0.5) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.45);
      env.gain.setValueAtTime(gainLevel * 0.4, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  }
}

export const audioEngine = new KineForgeAudioEngine();
