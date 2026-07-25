/* VibeTrisimo — Web Audio engine (procedural SFX + layered music)
 * No external samples: dungeon-toned synthesis, licensing-safe. */
(() => {
  const MASTER_KEY = 'vibetrisimo-vol-master';
  const MUSIC_KEY = 'vibetrisimo-vol-music';
  const SFX_KEY = 'vibetrisimo-vol-sfx';
  const MUTE_KEY = 'vibetrisimo-mute';

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function loadVol(key, fallback) {
    const v = parseFloat(storageGet(key));
    return Number.isFinite(v) ? clamp(v, 0, 1) : fallback;
  }

  let ctx = null;
  let masterGain = null;
  let musicBus = null;
  let musicDuck = null;
  let sfxBus = null;
  let compressor = null;

  let vols = {
    master: loadVol(MASTER_KEY, 0.72),
    music: loadVol(MUSIC_KEY, 0.42),
    sfx: loadVol(SFX_KEY, 0.78),
  };
  let muted = storageGet(MUTE_KEY) === '1';

  let musicOn = false;
  let musicLayers = null;
  let musicScheduler = null;
  let musicStep = 0;
  let nextNoteTime = 0;
  let intensity = 0; // 0..1
  let targetIntensity = 0;
  let duckUntil = 0;
  let unlocked = false;

  const LOOKAHEAD = 0.12;
  const STEP_SEC_BASE = 60 / 98 / 2; // 8th notes @ ~98bpm

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    masterGain = ctx.createGain();
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.12;

    musicDuck = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();

    musicBus.connect(musicDuck);
    musicDuck.connect(masterGain);
    sfxBus.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

    applyGains();
    return ctx;
  }

  function applyGains() {
    if (!masterGain) return;
    const m = muted ? 0 : 1;
    masterGain.gain.setTargetAtTime(vols.master * m, ctx.currentTime, 0.03);
    musicBus.gain.setTargetAtTime(vols.music, ctx.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(vols.sfx, ctx.currentTime, 0.03);
  }

  async function resume() {
    const c = ensureCtx();
    if (!c) return false;
    if (c.state === 'suspended') {
      try { await c.resume(); } catch (_) {}
    }
    unlocked = c.state === 'running';
    return unlocked;
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function envGain(dest, t0, peak, a, d, s, r, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t0 + a + d);
    const releaseAt = t0 + Math.max(a + d, dur);
    g.gain.exponentialRampToValueAtTime(0.0001, releaseAt + r);
    g.connect(dest);
    return g;
  }

  function osc(type, freq, dest, t0, dur, peak, opts) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (opts && opts.slide) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t0 + dur);
    }
    const g = envGain(dest, t0, peak, opts?.a ?? 0.01, opts?.d ?? 0.06, opts?.s ?? 0.3, opts?.r ?? 0.08, dur);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + dur + (opts?.r ?? 0.08) + 0.02);
    return o;
  }

  function noiseBuffer(sec) {
    const len = Math.max(1, (ctx.sampleRate * sec) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  let sharedNoise = null;
  function noiseBurst(dest, t0, dur, peak, filterFreq, q) {
    if (!sharedNoise) sharedNoise = noiseBuffer(1.5);
    const src = ctx.createBufferSource();
    src.buffer = sharedNoise;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = filterFreq || 1200;
    filt.Q.value = q || 0.7;
    const g = envGain(dest, t0, peak, 0.005, 0.04, 0.2, 0.1, dur);
    src.connect(filt);
    filt.connect(g);
    src.start(t0);
    src.stop(t0 + dur + 0.12);
  }

  function duck(amount, ms) {
    if (!musicDuck || !ctx) return;
    const t0 = now();
    const depth = clamp(1 - amount, 0.15, 1);
    duckUntil = Math.max(duckUntil, t0 + ms / 1000);
    musicDuck.gain.cancelScheduledValues(t0);
    musicDuck.gain.setValueAtTime(musicDuck.gain.value, t0);
    musicDuck.gain.linearRampToValueAtTime(depth, t0 + 0.02);
    musicDuck.gain.linearRampToValueAtTime(1, t0 + ms / 1000);
  }

  /* ---------- SFX catalog ---------- */
  const SFX = {
    move() {
      const t0 = now();
      osc('square', 420, sfxBus, t0, 0.04, 0.045, { a: 0.002, d: 0.03, s: 0.1, r: 0.03 });
    },
    rotate() {
      const t0 = now();
      osc('triangle', 520, sfxBus, t0, 0.05, 0.07, { a: 0.005, d: 0.04, s: 0.2, r: 0.04 });
      osc('triangle', 780, sfxBus, t0 + 0.03, 0.05, 0.05, { a: 0.005, d: 0.04, s: 0.15, r: 0.04 });
    },
    soft() {
      const t0 = now();
      osc('sine', 180, sfxBus, t0, 0.03, 0.03, { a: 0.002, d: 0.02, s: 0.1, r: 0.02 });
    },
    hard() {
      const t0 = now();
      osc('sine', 90, sfxBus, t0, 0.14, 0.28, { a: 0.004, d: 0.08, s: 0.35, r: 0.12, slide: 45 });
      osc('triangle', 140, sfxBus, t0, 0.1, 0.12, { a: 0.003, d: 0.06, s: 0.2, r: 0.08, slide: 70 });
      noiseBurst(sfxBus, t0, 0.08, 0.1, 280, 0.5);
      duck(0.35, 160);
    },
    lock() {
      const t0 = now();
      osc('sine', 160, sfxBus, t0, 0.07, 0.1, { a: 0.003, d: 0.05, s: 0.25, r: 0.06, slide: 100 });
      noiseBurst(sfxBus, t0, 0.04, 0.04, 800, 0.8);
    },
    hold() {
      const t0 = now();
      osc('triangle', 300, sfxBus, t0, 0.08, 0.08, { a: 0.01, d: 0.05, s: 0.2, r: 0.08, slide: 480 });
      osc('sine', 220, sfxBus, t0 + 0.02, 0.1, 0.05, { a: 0.01, d: 0.06, s: 0.15, r: 0.08 });
    },
    clear(n) {
      const t0 = now();
      const base = 320 + (n - 1) * 40;
      const notes = n >= 4 ? [0, 4, 7, 12] : n === 3 ? [0, 4, 7] : n === 2 ? [0, 5] : [0];
      notes.forEach((semi, i) => {
        const f = base * Math.pow(2, semi / 12);
        osc('triangle', f, sfxBus, t0 + i * 0.045, 0.16, 0.09 + n * 0.015, {
          a: 0.01, d: 0.08, s: 0.35, r: 0.14,
        });
      });
      if (n >= 3) noiseBurst(sfxBus, t0, 0.1, 0.06 + n * 0.01, 1800, 0.6);
      duck(0.25 + n * 0.08, 180 + n * 40);
    },
    tspin(full) {
      const t0 = now();
      const seq = full ? [440, 554, 659, 880] : [392, 494, 587];
      seq.forEach((f, i) => {
        osc('sawtooth', f, sfxBus, t0 + i * 0.05, 0.1, 0.055, { a: 0.008, d: 0.05, s: 0.2, r: 0.08 });
      });
      duck(0.4, 220);
    },
    combo(n) {
      const t0 = now();
      const f = 500 + Math.min(12, n) * 36;
      osc('square', f, sfxBus, t0, 0.07, 0.06, { a: 0.005, d: 0.04, s: 0.2, r: 0.05 });
      osc('sine', f * 1.5, sfxBus, t0 + 0.04, 0.08, 0.04, { a: 0.005, d: 0.05, s: 0.15, r: 0.06 });
    },
    levelup() {
      const t0 = now();
      [523, 659, 784, 1046].forEach((f, i) => {
        osc('triangle', f, sfxBus, t0 + i * 0.06, 0.14, 0.08, { a: 0.01, d: 0.07, s: 0.3, r: 0.12 });
      });
      duck(0.35, 280);
    },
    gameover() {
      const t0 = now();
      [392, 349, 311, 262, 196].forEach((f, i) => {
        osc('sawtooth', f, sfxBus, t0 + i * 0.11, 0.2, 0.07, { a: 0.02, d: 0.1, s: 0.25, r: 0.15 });
      });
      duck(0.55, 500);
    },
    menu() {
      const t0 = now();
      osc('triangle', 640, sfxBus, t0, 0.05, 0.05, { a: 0.004, d: 0.03, s: 0.15, r: 0.04 });
    },
    countdown(n) {
      const t0 = now();
      const f = n === 'go' ? 880 : 520 + (3 - (parseInt(n, 10) || 1)) * 60;
      osc('square', f, sfxBus, t0, n === 'go' ? 0.18 : 0.1, n === 'go' ? 0.12 : 0.08, {
        a: 0.005, d: 0.05, s: 0.25, r: 0.08,
      });
      if (n === 'go') {
        osc('triangle', 1174, sfxBus, t0 + 0.05, 0.16, 0.07, { a: 0.01, d: 0.08, s: 0.2, r: 0.1 });
        duck(0.3, 200);
      }
    },
    win() {
      const t0 = now();
      [523, 659, 784, 1046, 1318].forEach((f, i) => {
        osc('triangle', f, sfxBus, t0 + i * 0.07, 0.2, 0.09, { a: 0.01, d: 0.08, s: 0.35, r: 0.16 });
      });
      duck(0.45, 400);
    },
  };

  function sfx(name, arg) {
    if (!ensureCtx() || muted || vols.sfx <= 0.001) return;
    if (ctx.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    try { fn(arg); } catch (_) {}
  }

  /* ---------- Layered music (drone + pulse + percussion + tension) ---------- */
  function createMusicLayers() {
    const t0 = now();

    // Layer A — low dungeon drone
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 73.42; // D2
    const drone2 = ctx.createOscillator();
    drone2.type = 'triangle';
    drone2.frequency.value = 110; // A2
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.12;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 420;
    drone.connect(droneFilter);
    drone2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(musicBus);
    drone.start(t0);
    drone2.start(t0);

    // Layer B — soft pulse (heartbeat pad)
    const pulse = ctx.createOscillator();
    pulse.type = 'sine';
    pulse.frequency.value = 146.83; // D3
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.0001;
    pulse.connect(pulseGain);
    pulseGain.connect(musicBus);
    pulse.start(t0);

    // Layer C/D gains — fed by scheduled hits
    const percGain = ctx.createGain();
    percGain.gain.value = 0.0001;
    percGain.connect(musicBus);
    const tenseGain = ctx.createGain();
    tenseGain.gain.value = 0.0001;
    tenseGain.connect(musicBus);

    return { drone, drone2, droneGain, droneFilter, pulse, pulseGain, percGain, tenseGain };
  }

  function stopMusicLayers() {
    if (!musicLayers) return;
    const t0 = now();
    try {
      musicLayers.drone.stop(t0 + 0.05);
      musicLayers.drone2.stop(t0 + 0.05);
      musicLayers.pulse.stop(t0 + 0.05);
    } catch (_) {}
    musicLayers = null;
  }

  function schedulePerc(time, strong) {
    if (!musicLayers) return;
    const peak = (0.04 + intensity * 0.07) * (strong ? 1.35 : 0.75);
    noiseBurst(musicLayers.percGain, time, strong ? 0.08 : 0.05, peak, strong ? 180 : 420, 0.6);
    if (intensity > 0.35) {
      osc('sine', strong ? 55 : 70, musicLayers.percGain, time, 0.1, peak * 0.8, {
        a: 0.002, d: 0.05, s: 0.2, r: 0.08, slide: 35,
      });
    }
  }

  function scheduleTension(time, step) {
    if (!musicLayers || intensity < 0.25) return;
    const scale = [146.83, 174.61, 196, 220, 261.63]; // D minor-ish
    const idx = [0, 2, 3, 2, 4, 3, 1, 0][step % 8];
    const f = scale[idx] * (intensity > 0.7 && step % 4 === 0 ? 2 : 1);
    const peak = 0.015 + intensity * 0.035;
    osc('triangle', f, musicLayers.tenseGain, time, 0.12, peak, {
      a: 0.01, d: 0.06, s: 0.25, r: 0.1,
    });
  }

  function musicSchedulerTick() {
    if (!musicOn || !ctx || !musicLayers) return;
    const cur = now();
    // Smooth intensity
    intensity += (targetIntensity - intensity) * 0.08;

    // Layer gains track intensity
    const pulseDepth = 0.02 + intensity * 0.05;
    const pulseRate = 1.6 + intensity * 1.4;
    const g = musicLayers.pulseGain.gain;
    // gentle tremolo via scheduled values
    const t = cur;
    g.setTargetAtTime(0.0001 + pulseDepth * (0.5 + 0.5 * Math.sin(t * pulseRate * Math.PI * 2)), t, 0.05);
    musicLayers.percGain.gain.setTargetAtTime(0.5 + intensity * 0.9, t, 0.1);
    musicLayers.tenseGain.gain.setTargetAtTime(intensity > 0.2 ? 0.7 + intensity * 0.6 : 0.0001, t, 0.12);
    musicLayers.droneFilter.frequency.setTargetAtTime(380 + intensity * 520, t, 0.2);
    musicLayers.droneGain.gain.setTargetAtTime(0.1 + intensity * 0.06, t, 0.15);

    const stepDur = STEP_SEC_BASE * (1 - intensity * 0.18);
    while (nextNoteTime < cur + LOOKAHEAD) {
      const strong = musicStep % 4 === 0;
      if (intensity > 0.12 || strong) schedulePerc(nextNoteTime, strong);
      scheduleTension(nextNoteTime, musicStep);
      nextNoteTime += stepDur;
      musicStep++;
    }
  }

  function startMusic() {
    if (!ensureCtx() || musicOn) return;
    if (ctx.state !== 'running') return;
    stopMusicLayers();
    musicLayers = createMusicLayers();
    musicOn = true;
    musicStep = 0;
    nextNoteTime = now() + 0.05;
    intensity = targetIntensity;
    if (musicScheduler) clearInterval(musicScheduler);
    musicScheduler = setInterval(musicSchedulerTick, 25);
    musicSchedulerTick();
  }

  function stopMusic(fadeMs) {
    if (!musicOn && !musicLayers) return;
    musicOn = false;
    if (musicScheduler) {
      clearInterval(musicScheduler);
      musicScheduler = null;
    }
    if (musicLayers && ctx) {
      const t0 = now();
      const fade = (fadeMs || 400) / 1000;
      try {
        musicLayers.droneGain.gain.setTargetAtTime(0.0001, t0, fade / 3);
        musicLayers.pulseGain.gain.setTargetAtTime(0.0001, t0, fade / 3);
        musicLayers.percGain.gain.setTargetAtTime(0.0001, t0, fade / 3);
        musicLayers.tenseGain.gain.setTargetAtTime(0.0001, t0, fade / 3);
      } catch (_) {}
      const layers = musicLayers;
      setTimeout(() => {
        if (musicLayers === layers) stopMusicLayers();
      }, (fadeMs || 400) + 50);
    } else {
      stopMusicLayers();
    }
  }

  function setIntensity(v) {
    targetIntensity = clamp(v, 0, 1);
  }

  function setMaster(v) {
    vols.master = clamp(v, 0, 1);
    storageSet(MASTER_KEY, String(vols.master));
    applyGains();
  }

  function setMusic(v) {
    vols.music = clamp(v, 0, 1);
    storageSet(MUSIC_KEY, String(vols.music));
    applyGains();
  }

  function setSfx(v) {
    vols.sfx = clamp(v, 0, 1);
    storageSet(SFX_KEY, String(vols.sfx));
    applyGains();
  }

  function setMuted(on) {
    muted = !!on;
    storageSet(MUTE_KEY, muted ? '1' : '0');
    applyGains();
    if (muted) stopMusic(200);
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  function getState() {
    return {
      master: vols.master,
      music: vols.music,
      sfx: vols.sfx,
      muted,
      unlocked,
      musicOn,
    };
  }

  // Unlock on first gesture
  function armUnlock() {
    const unlock = () => {
      resume().then((ok) => {
        if (ok) {
          document.removeEventListener('pointerdown', unlock, true);
          document.removeEventListener('keydown', unlock, true);
        }
      });
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }

  armUnlock();

  window.VibeAudio = {
    resume,
    sfx,
    duck,
    startMusic,
    stopMusic,
    setIntensity,
    setMaster,
    setMusic,
    setSfx,
    setMuted,
    toggleMute,
    getState,
    isMuted: () => muted,
  };
})();
