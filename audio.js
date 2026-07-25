/* VibeTrisimo — Web Audio engine (procedural SFX + looped BGM bed) */
(() => {
  const MASTER_KEY = 'vibetrisimo-vol-master';
  const MUSIC_KEY = 'vibetrisimo-vol-music';
  const SFX_KEY = 'vibetrisimo-vol-sfx';
  const MUTE_KEY = 'vibetrisimo-mute';
  const BGM_URL = './audio/bgm.mp3';

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
  let musicStarting = false;
  let musicSource = null;
  let musicFilter = null;
  let musicBedGain = null;
  let bgmBuffer = null;
  let bgmLoad = null;
  let intensity = 0; // 0..1
  let targetIntensity = 0;
  let intensityTimer = null;
  let duckUntil = 0;
  let unlocked = false;

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

  /* ---------- Looped BGM bed (./audio/bgm.mp3) ---------- */
  function loadBgm() {
    if (bgmBuffer) return Promise.resolve(bgmBuffer);
    if (bgmLoad) return bgmLoad;
    if (!ensureCtx()) return Promise.reject(new Error('no audio'));
    bgmLoad = fetch(BGM_URL)
      .then((r) => {
        if (!r.ok) throw new Error('bgm fetch failed');
        return r.arrayBuffer();
      })
      .then((buf) => ctx.decodeAudioData(buf.slice(0)))
      .then((decoded) => {
        bgmBuffer = decoded;
        return bgmBuffer;
      })
      .catch((err) => {
        bgmLoad = null;
        throw err;
      });
    return bgmLoad;
  }

  function stopMusicSource(fadeMs) {
    if (intensityTimer) {
      clearInterval(intensityTimer);
      intensityTimer = null;
    }
    const src = musicSource;
    const bed = musicBedGain;
    musicSource = null;
    musicFilter = null;
    musicBedGain = null;
    if (!src || !ctx) return;
    const t0 = now();
    const fade = Math.max(0.05, (fadeMs || 400) / 1000);
    try {
      if (bed) {
        bed.gain.cancelScheduledValues(t0);
        bed.gain.setValueAtTime(Math.max(0.0001, bed.gain.value), t0);
        bed.gain.exponentialRampToValueAtTime(0.0001, t0 + fade);
      }
      src.stop(t0 + fade + 0.02);
    } catch (_) {
      try { src.stop(); } catch (_) {}
    }
  }

  function applyIntensityToBed() {
    if (!musicOn || !musicFilter || !musicBedGain || !ctx) return;
    intensity += (targetIntensity - intensity) * 0.1;
    const t = now();
    // Open the bed slightly as the stack rises — still the same track
    musicFilter.frequency.setTargetAtTime(2200 + intensity * 4800, t, 0.25);
    musicBedGain.gain.setTargetAtTime(0.78 + intensity * 0.22, t, 0.2);
  }

  function startMusicSource(buffer) {
    if (!ensureCtx() || ctx.state !== 'running' || musicOn) return;
    stopMusicSource(0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    // Seamless-ish loop; if the file has silence at ends, trim externally later
    src.loopStart = 0;
    src.loopEnd = buffer.duration;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200 + targetIntensity * 4800;
    filter.Q.value = 0.5;

    const bed = ctx.createGain();
    bed.gain.value = 0.0001;

    src.connect(filter);
    filter.connect(bed);
    bed.connect(musicBus);

    const t0 = now();
    bed.gain.setValueAtTime(0.0001, t0);
    bed.gain.exponentialRampToValueAtTime(0.78 + targetIntensity * 0.22, t0 + 0.55);

    src.start(t0);
    musicSource = src;
    musicFilter = filter;
    musicBedGain = bed;
    musicOn = true;
    intensity = targetIntensity;
    if (intensityTimer) clearInterval(intensityTimer);
    intensityTimer = setInterval(applyIntensityToBed, 80);
    src.onended = () => {
      if (musicSource === src) {
        musicOn = false;
        musicSource = null;
      }
    };
  }

  function startMusic() {
    if (!ensureCtx() || musicOn || musicStarting || muted) return;
    if (ctx.state !== 'running') return;
    musicStarting = true;
    loadBgm()
      .then((buf) => {
        if (!musicOn && ctx && ctx.state === 'running' && !muted) startMusicSource(buf);
      })
      .catch(() => {
        // Keep game playable if the file fails to load
      })
      .then(() => { musicStarting = false; });
  }

  function stopMusic(fadeMs) {
    if (!musicOn && !musicSource) return;
    musicOn = false;
    stopMusicSource(fadeMs);
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
