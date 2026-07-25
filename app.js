/* VibeTrisimo — host-relay lobby (max 8) */
(() => {
  const COLS = 10, ROWS = 20;
  // Hidden sky above the visible well — pieces spawn here so a high stack is
  // recoverable instead of an instant top-out on the next piece.
  const BUFFER_ROWS = 3;
  const MAX_PLAYERS = 8;
  const TYPES = ['I','O','T','S','Z','J','L'];
  const GARBAGE_TYPE = 'G';
  const GARBAGE_COLOR = '#4a453f';
  const SHAPES = {
    I:{color:'#2f98a6',m:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]]},
    O:{color:'#d4a03c',m:[[1,1],[1,1]]},
    T:{color:'#8a42aa',m:[[0,1,0],[1,1,1],[0,0,0]]},
    S:{color:'#6d9d3c',m:[[0,1,1],[1,1,0],[0,0,0]]},
    Z:{color:'#c23a42',m:[[1,1,0],[0,1,1],[0,0,0]]},
    J:{color:'#3a6cb0',m:[[1,0,0],[1,1,1],[0,0,0]]},
    L:{color:'#c87a2a',m:[[0,0,1],[1,1,1],[0,0,0]]},
  };
  const COLOR_TO_TYPE = Object.fromEntries([
    ...TYPES.map(t => [SHAPES[t].color, t]),
    [GARBAGE_COLOR, GARBAGE_TYPE],
    // Legacy muted palette (pre-revamp sync / saved state)
    ['#5a9e9a', 'I'], ['#c9a227', 'O'], ['#7a5a8a', 'T'],
    ['#4a7a4a', 'S'], ['#8b2e2e', 'Z'], ['#3a5a7a', 'J'], ['#b87333', 'L'],
  ]);
  const BLOCK_IMGS = Object.create(null);
  let blocksReady = false;
  function preloadBlockSprites() {
    let left = TYPES.length;
    TYPES.forEach(t => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = () => {
        left -= 1;
        if (left <= 0) blocksReady = true;
      };
      img.src = `./textures/blocks/${t}.png`;
      BLOCK_IMGS[t] = img;
    });
  }
  preloadBlockSprites();

  function cellType(cell) {
    if (!cell) return null;
    if (typeof cell === 'string') {
      if (SHAPES[cell] || cell === GARBAGE_TYPE) return cell;
      return COLOR_TO_TYPE[cell] || null;
    }
    if (typeof cell === 'object' && cell.type) return cell.type;
    return null;
  }
  const GARBAGE = {1:0,2:1,3:2,4:4};
  const TIME_LEVEL_MS = 30000; // level up every 30s of play, in addition to line-based leveling
  const MIN_DROP_MS = 40; // fastest possible drop interval (ninja base)
  const LEVEL_DROP_STEP_MS = 15; // how much each level shortens the drop interval
  const DROP_SPEED = { slow: 1400, normal: 1000, fast: 400, turbo: 160, insane: 80, ninja: 40 };
  // Lock slide scales with gravity: ~50% of current dropMs, with a floor so
  // fast/turbo/insane/ninja still allow a readable slide before lock.
  const LOCK_DELAY_RATIO = 0.5;
  const MIN_LOCK_MS = 200;
  const MAX_LOCK_MS = 450;
  const LOCK_RESET_LIMIT = 15; // move/rotate resets while grounded (Infinity-style)
  const NEXT_COUNT = 3;
  const DAS_KEY = 'vibetrisimo-das';
  const ARR_KEY = 'vibetrisimo-arr';
  const SOFT_KEY = 'vibetrisimo-soft';
  const DEFAULT_DAS_MS = 160;
  const DEFAULT_ARR_MS = 50;
  const DEFAULT_SOFT_MS = 40;
  const GARBAGE_TARGET = { clockwise: 1, random: 1, neighbors: 1 };
  const POWER_GRACE_MS = 10000;
  const POWER_CHANCE = { 2: 0.12, 3: 0.25, 4: 0.40 };
  const POWER_COMBO_BONUS = 0.10;
  const POWER_KINDS = ['quake', 'torch', 'shield', 'curse'];
  const POWER_KIND = { quake: 1, torch: 1, shield: 1, curse: 1 };
  const TORCH_MS = 8000;
  const SHIELD_GAIN = 2;
  const SHIELD_CAP = 3;
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const NAME_KEY = 'vibetrisimo-name';
  const LANG_KEY = 'vibetrisimo-lang';
  const FLASHY_KEY = 'vibetrisimo-flashy';
  const SHAKE_KEY = 'vibetrisimo-shake';
  const COLORBLIND_KEY = 'vibetrisimo-colorblind';
  const GRID_KEY = 'vibetrisimo-grid';
  const BINDS_KEY = 'vibetrisimo-binds';
  const MODE_KEY = 'vibetrisimo-mode';
  const DEFAULT_GRID_OPACITY = 16;
  const SPRINT_LINES = 40;
  const ULTRA_MS = 120000;
  const SOLO_MODES = ['marathon', 'sprint', 'ultra', 'zen'];
  const CLEAR_FLASH_MS = 220;
  const CLEAR_COLLAPSE_MS = 280;
  const PIECE_LERP_MS = 85; // higher = smoother / more visible glide
  const LOCK_PULSE_MS = 180;
  // Level bands deepen the dungeon palette (torch → ember → molten).
  const LEVEL_THEMES = [
    { tint: 'rgba(18,14,28,.08)', ember: 'rgba(120,70,30,.00)', warm: 'rgba(212,160,60,.18)', cool: 'rgba(70,40,90,.14)', glow: 'rgba(212,175,55,.14)' },
    { tint: 'rgba(40,22,12,.12)', ember: 'rgba(160,70,20,.06)', warm: 'rgba(220,150,50,.24)', cool: 'rgba(80,35,70,.12)', glow: 'rgba(220,170,60,.18)' },
    { tint: 'rgba(60,18,12,.16)', ember: 'rgba(200,60,25,.10)', warm: 'rgba(230,120,40,.28)', cool: 'rgba(90,30,50,.10)', glow: 'rgba(230,140,50,.22)' },
    { tint: 'rgba(70,12,10,.20)', ember: 'rgba(220,50,20,.14)', warm: 'rgba(240,100,35,.32)', cool: 'rgba(100,25,40,.08)', glow: 'rgba(240,130,45,.28)' },
  ];

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function audio() {
    return window.VibeAudio || null;
  }

  function sfx(name, arg) {
    const a = audio();
    if (a) a.sfx(name, arg);
  }

  function syncMuteBtn() {
    const btn = document.getElementById('btnMute');
    const a = audio();
    if (!btn || !a) return;
    const muted = a.isMuted();
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    const label = btn.querySelector('.mute-label');
    if (label) label.textContent = muted ? t('unmute') : t('mute');
    btn.title = muted ? t('unmute') : t('mute');
    btn.setAttribute('aria-label', t('muteToggle'));
  }

  function updateMusicIntensity(board) {
    const a = audio();
    if (!a || !board) return;
    let top = ROWS;
    for (let r = 0; r < ROWS; r++) {
      if (board.grid[r].some(Boolean)) { top = r; break; }
    }
    const height = (ROWS - top) / ROWS;
    const levelPart = Math.min(1, Math.max(0, (board.level - 1) / 14));
    a.setIntensity(clamp01(levelPart * 0.55 + height * 0.55));
  }

  function clamp01(n) {
    return Math.max(0, Math.min(1, n));
  }

  const FX_COLORS = ['#d4af37', '#c9a227', '#e8d9b5', '#8b1a1a', '#a84848', '#2f98a6', '#6d9d3c', '#8a42aa', '#c87a2a', '#f0e0a0', '#3a6cb0', '#c23a42'];

  const STR = {
    en: {
      subtitle: 'Tetris battle',
      yourName: 'Your name',
      namePh: 'Name',
      hostGame: 'Host game',
      joinGame: 'Join game',
      menuHint: 'Up to 8 players in versus. Solo needs no connection.',
      modesTitle: 'Solo modes',
      versusTitle: 'Versus',
      playSolo: 'Play',
      modeMarathon: 'Marathon',
      modeMarathonDesc: 'Endless · rising speed',
      modeSprint: 'Sprint',
      modeSprintDesc: 'Clear 40 lines',
      modeUltra: 'Ultra',
      modeUltraDesc: '2 min · max score',
      modeZen: 'Zen',
      modeZenDesc: 'Practice · no top-out',
      versusLobby: 'Versus battle',
      sprintGoal: '{n}/40 lines',
      ultraLeft: '{t} left',
      sprintClear: '40 LINES!',
      ultraDone: 'TIME!',
      zenReset: 'Board cleared',
      peerLeft: '{name} left the match',
      connectingHost: 'Opening room…',
      waitingPeers: 'Share the code — waiting for players',
      peerJoined: '{name} joined',
      copyCode: 'Copy code',
      codePh: 'Code',
      join: 'Join',
      back: 'Back',
      roomCode: 'Room code',
      ready: 'Ready',
      unready: 'Unready',
      speedRamp: 'Speed increases over time',
      powerUps: 'Relics (power-ups)',
      optOn: 'On',
      optOff: 'Off',
      dropSpeed: 'Drop speed',
      dropSlow: 'Slow',
      dropNormal: 'Normal',
      dropFast: 'Fast',
      dropTurbo: 'Turbo',
      dropInsane: 'Insane',
      dropNinja: 'Ninja',
      garbageTarget: 'Who gets garbage',
      targetClockwise: 'Always the next player',
      targetRandom: 'Anyone still alive',
      targetNeighbors: 'Only left or right',
      clearSingle: 'Single',
      clearDouble: 'Double',
      clearTriple: 'Triple',
      clearTetris: 'Tetris!',
      tspin: 'T-Spin',
      tspinMini: 'T-Spin Mini',
      tspinMiniClear: 'T-Spin Mini',
      tspinSingle: 'T-Spin Single',
      tspinDouble: 'T-Spin Double',
      tspinTriple: 'T-Spin Triple',
      b2b: 'B2B',
      comboN: 'Combo x{n}',
      hitFx: 'HIT +{n}',
      flashyFx: 'FX',
      leave: 'Leave',
      playAgain: 'Play again',
      menu: 'Menu',
      you: 'You',
      youTag: ' (you)',
      waiting: 'Waiting',
      next: 'Next',
      hold: 'Keep',
      relic: 'Relic',
      useRelic: 'Use',
      powerEmpty: '—',
      relicQuake: 'Quake',
      relicTorch: 'Torch',
      relicShield: 'Shield',
      relicCurse: 'Curse',
      powerGranted: '{name}!',
      powerQuakeFx: 'QUAKE!',
      powerTorchFx: 'TORCH!',
      powerShieldFx: 'SHIELD!',
      powerCurseFx: 'CURSE!',
      shieldAbsorb: 'SHIELD!',
      meta: 'LV {lv} · {lines} lines',
      defaultName: 'Player',
      topOut: 'TOP OUT',
      eliminated: 'ELIMINATED',
      victory: 'VICTORY',
      draw: 'DRAW',
      wins: '{name} WINS',
      rosterStatus: '{n}/{max} · {ready} ready',
      needTwo: ' · need at least 1',
      waitReady: ' · waiting for ready',
      startingSoon: ' · starting…',
      go: 'FIGHT!',
      ctrlHint: 'WASD / arrows · Z/X rotate · space hard · C keep · V relic · Esc pause · swipe board',
      settings: 'Settings',
      settingsTitle: 'Settings',
      controlsTitle: 'Controls',
      dasLabel: 'DAS (ms)',
      arrLabel: 'ARR (ms)',
      softLabel: 'Soft drop (ms)',
      settingsHint: 'Lower DAS/ARR = snappier movement. Soft drop is auto-repeat while held.',
      settingsSaved: 'Saved',
      shakeLabel: 'Screen shake',
      colorblindLabel: 'Colorblind piece patterns',
      gridOpacityLabel: 'Board grid',
      bindsTitle: 'Key bindings',
      resetBinds: 'Reset keys',
      bindLeft: 'Left',
      bindRight: 'Right',
      bindSoft: 'Soft drop',
      bindHard: 'Hard drop',
      bindRotCw: 'Rotate CW',
      bindRotCcw: 'Rotate CCW',
      bindHold: 'Hold',
      bindPower: 'Relic',
      bindPause: 'Pause',
      bindListening: 'Press a key…',
      paused: 'Paused',
      pausedBy: 'Paused by {name}',
      resume: 'Resume',
      gameOver: 'Game over',
      results: 'Results',
      statScore: 'Score',
      statLines: 'Lines',
      statLevel: 'Level',
      statTime: 'Time',
      statPps: 'PPS',
      statApm: 'APM',
      statMaxCombo: 'Max combo',
      statTspins: 'T-Spins',
      statTetrises: 'Tetrises',
      audioTitle: 'Audio',
      volMaster: 'Master',
      volMusic: 'Background music',
      volSfx: 'SFX',
      audioHint: 'Drag Background music down if the track is too loud.',
      mute: 'Mute',
      unmute: 'Sound',
      muteToggle: 'Mute audio',
      rotCcw: '↺',
      rotCw: '↻',
      rematchStart: 'Starting…',
      rematchWait: 'Waiting for others ({ready}/{n})…',
      rematchPartial: '{ready}/{n} ready',
      rematchAll: 'Everyone must click Play again',
      matchStarted: 'Match already started',
      roomFull: 'Room full',
      rejected: 'Rejected',
      joinedLobby: 'Joined lobby…',
      disconnected: 'Disconnected from host.',
      reconnecting: 'Host left — reconnecting…',
      takingHost: 'Host left — taking over…',
      connError: 'Connection error.',
      enterCode: 'Enter the 5-character room code.',
      createFail: 'Could not create room ({err}).',
      hostFail: 'Could not host.',
      needCode: 'Need a 5-character code.',
      connecting: 'Connecting…',
      joinFail: 'Join failed ({err}).',
      codeCopied: 'Code copied.',
      copyFail: 'Copy failed — share the code manually.',
      err: 'error',
    },
    da: {
      subtitle: 'Tetris-kamp',
      yourName: 'Dit navn',
      namePh: 'Navn',
      hostGame: 'Opret spil',
      joinGame: 'Tilslut spil',
      menuHint: 'Op til 8 spillere i versus. Solo kræver ingen forbindelse.',
      modesTitle: 'Solo-tilstande',
      versusTitle: 'Versus',
      playSolo: 'Spil',
      modeMarathon: 'Maraton',
      modeMarathonDesc: 'Uendeligt · stigende fart',
      modeSprint: 'Sprint',
      modeSprintDesc: 'Ryd 40 linjer',
      modeUltra: 'Ultra',
      modeUltraDesc: '2 min · max point',
      modeZen: 'Zen',
      modeZenDesc: 'Øv · intet top-out',
      versusLobby: 'Versus-kamp',
      sprintGoal: '{n}/40 linjer',
      ultraLeft: '{t} tilbage',
      sprintClear: '40 LINJER!',
      ultraDone: 'TIDEN ER GÅET!',
      zenReset: 'Bræt nulstillet',
      peerLeft: '{name} forlod kampen',
      connectingHost: 'Åbner rum…',
      waitingPeers: 'Del koden — venter på spillere',
      peerJoined: '{name} tilsluttede',
      copyCode: 'Kopiér kode',
      codePh: 'Kode',
      join: 'Tilslut',
      back: 'Tilbage',
      roomCode: 'Rumkode',
      ready: 'Klar',
      unready: 'Ikke klar',
      speedRamp: 'Hastighed øges over tid',
      powerUps: 'Relikvier (power-ups)',
      optOn: 'Til',
      optOff: 'Fra',
      dropSpeed: 'Faldhastighed',
      dropSlow: 'Langsom',
      dropNormal: 'Normal',
      dropFast: 'Hurtig',
      dropTurbo: 'Turbo',
      dropInsane: 'Vanvittig',
      dropNinja: 'Ninja',
      garbageTarget: 'Hvem får skrald',
      targetClockwise: 'Altid næste spiller',
      targetRandom: 'Enhver der er i live',
      targetNeighbors: 'Kun venstre eller højre',
      clearSingle: 'Single',
      clearDouble: 'Double',
      clearTriple: 'Triple',
      clearTetris: 'Tetris!',
      tspin: 'T-Spin',
      tspinMini: 'T-Spin Mini',
      tspinMiniClear: 'T-Spin Mini',
      tspinSingle: 'T-Spin Single',
      tspinDouble: 'T-Spin Double',
      tspinTriple: 'T-Spin Triple',
      b2b: 'B2B',
      comboN: 'Kombo x{n}',
      hitFx: 'RAMT +{n}',
      flashyFx: 'FX',
      leave: 'Forlad',
      playAgain: 'Spil igen',
      menu: 'Menu',
      you: 'Dig',
      youTag: ' (dig)',
      waiting: 'Venter',
      next: 'Næste',
      hold: 'Gem',
      relic: 'Relikvie',
      useRelic: 'Brug',
      powerEmpty: '—',
      relicQuake: 'Jordskælv',
      relicTorch: 'Fakkel',
      relicShield: 'Skjold',
      relicCurse: 'Forbandelse',
      powerGranted: '{name}!',
      powerQuakeFx: 'JORDSKÆLV!',
      powerTorchFx: 'FAKKEL!',
      powerShieldFx: 'SKJOLD!',
      powerCurseFx: 'FORBANDELSE!',
      shieldAbsorb: 'SKJOLD!',
      meta: 'NIV {lv} · {lines} linjer',
      defaultName: 'Spiller',
      topOut: 'TOPPET UD',
      eliminated: 'ELIMINERET',
      victory: 'SEJR',
      draw: 'UAFGJORT',
      wins: '{name} VINDER',
      rosterStatus: '{n}/{max} · {ready} klar',
      needTwo: ' · mindst 1 spiller',
      waitReady: ' · venter på klar',
      startingSoon: ' · starter…',
      go: 'KÆMP!',
      ctrlHint: 'WASD / piletaster · Z/X drej · mellemrum hårdt · C gem · V relikvie · Esc pause · swipe',
      settings: 'Indstillinger',
      settingsTitle: 'Indstillinger',
      controlsTitle: 'Styring',
      dasLabel: 'DAS (ms)',
      arrLabel: 'ARR (ms)',
      softLabel: 'Blødt fald (ms)',
      settingsHint: 'Lavere DAS/ARR = hurtigere bevægelse. Blødt fald gentages mens tasten holdes.',
      settingsSaved: 'Gemt',
      shakeLabel: 'Skærmryst',
      colorblindLabel: 'Farveblinde mønstre',
      gridOpacityLabel: 'Bræt-gitter',
      bindsTitle: 'Tastatur',
      resetBinds: 'Nulstil taster',
      bindLeft: 'Venstre',
      bindRight: 'Højre',
      bindSoft: 'Blødt fald',
      bindHard: 'Hårdt fald',
      bindRotCw: 'Drej med uret',
      bindRotCcw: 'Drej mod uret',
      bindHold: 'Gem',
      bindPower: 'Relikvie',
      bindPause: 'Pause',
      bindListening: 'Tryk på en tast…',
      paused: 'Pauset',
      pausedBy: 'Pauset af {name}',
      resume: 'Fortsæt',
      gameOver: 'Spillet er slut',
      results: 'Resultat',
      statScore: 'Point',
      statLines: 'Linjer',
      statLevel: 'Niveau',
      statTime: 'Tid',
      statPps: 'PPS',
      statApm: 'APM',
      statMaxCombo: 'Max kombo',
      statTspins: 'T-Spins',
      statTetrises: 'Tetris',
      audioTitle: 'Lyd',
      volMaster: 'Master',
      volMusic: 'Baggrundsmusik',
      volSfx: 'Effekter',
      audioHint: 'Træk Baggrundsmusik ned, hvis nummeret er for højt.',
      mute: 'Lyd fra',
      unmute: 'Lyd',
      muteToggle: 'Slå lyd fra',
      rotCcw: '↺',
      rotCw: '↻',
      rematchStart: 'Starter…',
      rematchWait: 'Venter på de andre ({ready}/{n})…',
      rematchPartial: '{ready}/{n} klar',
      rematchAll: 'Alle skal trykke på Spil igen',
      matchStarted: 'Kampen er allerede startet',
      roomFull: 'Rummet er fuldt',
      rejected: 'Afvist',
      joinedLobby: 'Tilsluttet lobby…',
      disconnected: 'Forbindelsen til værten blev afbrudt.',
      reconnecting: 'Værten forlod — genopretter…',
      takingHost: 'Værten forlod — overtager…',
      connError: 'Forbindelsesfejl.',
      enterCode: 'Indtast rumkoden på 5 tegn.',
      createFail: 'Kunne ikke oprette rum ({err}).',
      hostFail: 'Kunne ikke oprette som vært.',
      needCode: 'Brug en kode på 5 tegn.',
      connecting: 'Forbinder…',
      joinFail: 'Tilslutning mislykkedes ({err}).',
      codeCopied: 'Kode kopieret.',
      copyFail: 'Kopiering mislykkedes — del koden manuelt.',
      err: 'fejl',
    },
  };

  const REASON_KEYS = { match_started: 'matchStarted', room_full: 'roomFull' };

  function detectLang() {
    try {
      const saved = storageGet(LANG_KEY);
      if (saved === 'en' || saved === 'da') return saved;
    } catch (_) {}
    const nav = (navigator.language || '').toLowerCase();
    return nav.startsWith('da') ? 'da' : 'en';
  }

  let lang = detectLang();

  function detectFlashy() {
    try {
      const saved = storageGet(FLASHY_KEY);
      if (saved === '0') return false;
      if (saved === '1') return true;
    } catch (_) {}
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch (_) {}
    return true;
  }

  let flashyEnabled = detectFlashy();

  function detectShake() {
    try {
      const saved = storageGet(SHAKE_KEY);
      if (saved === '0') return false;
      if (saved === '1') return true;
    } catch (_) {}
    return true;
  }

  let shakeEnabled = detectShake();

  function detectColorblind() {
    return storageGet(COLORBLIND_KEY) === '1';
  }

  let colorblindEnabled = detectColorblind();

  function setColorblind(on) {
    colorblindEnabled = !!on;
    storageSet(COLORBLIND_KEY, colorblindEnabled ? '1' : '0');
    const chk = document.getElementById('chkColorblind');
    if (chk) chk.checked = colorblindEnabled;
  }

  function detectGridOpacity() {
    const n = parseInt(storageGet(GRID_KEY), 10);
    if (Number.isFinite(n)) return Math.max(0, Math.min(40, n));
    return DEFAULT_GRID_OPACITY;
  }

  let gridOpacity = detectGridOpacity();

  function setGridOpacity(v) {
    gridOpacity = Math.max(0, Math.min(40, v | 0));
    storageSet(GRID_KEY, String(gridOpacity));
    const rng = document.getElementById('rngGrid');
    const out = document.getElementById('outGrid');
    if (rng) rng.value = String(gridOpacity);
    if (out) out.textContent = String(gridOpacity);
  }

  const BIND_DEFS = [
    { action: 'left', label: 'bindLeft', code: 'ArrowLeft' },
    { action: 'right', label: 'bindRight', code: 'ArrowRight' },
    { action: 'soft', label: 'bindSoft', code: 'ArrowDown' },
    { action: 'hard', label: 'bindHard', code: 'Space' },
    { action: 'rotCw', label: 'bindRotCw', code: 'KeyX' },
    { action: 'rotCcw', label: 'bindRotCcw', code: 'KeyZ' },
    { action: 'hold', label: 'bindHold', code: 'KeyC' },
    { action: 'power', label: 'bindPower', code: 'KeyV' },
    { action: 'pause', label: 'bindPause', code: 'Escape' },
  ];
  const DEFAULT_BINDS = Object.fromEntries(BIND_DEFS.map(d => [d.action, d.code]));
  // Always-on aliases so classic WASD keeps working alongside rebinds.
  const FIXED_ALIASES = {
    KeyA: 'left', KeyD: 'right', KeyS: 'soft', KeyW: 'rotCw', ArrowUp: 'rotCw',
  };

  function loadBinds() {
    const out = { ...DEFAULT_BINDS };
    try {
      const raw = storageGet(BINDS_KEY);
      if (!raw) return out;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return out;
      for (const d of BIND_DEFS) {
        if (typeof parsed[d.action] === 'string' && parsed[d.action]) {
          out[d.action] = parsed[d.action];
        }
      }
    } catch (_) {}
    return out;
  }

  let keyBinds = loadBinds();
  let bindListenAction = null;

  function saveBinds() {
    storageSet(BINDS_KEY, JSON.stringify(keyBinds));
  }

  function setBinds(next) {
    keyBinds = { ...DEFAULT_BINDS, ...next };
    saveBinds();
    renderBindList();
  }

  function codeLabel(code) {
    if (!code) return '—';
    if (code === 'Space') return 'Space';
    if (code === 'Escape') return 'Esc';
    if (code.startsWith('Arrow')) return code.slice(5);
    if (code.startsWith('Key') && code.length === 4) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  }

  function actionForCode(code) {
    if (!code) return null;
    for (const d of BIND_DEFS) {
      if (keyBinds[d.action] === code) return d.action;
    }
    return FIXED_ALIASES[code] || null;
  }

  function renderBindList() {
    const list = document.getElementById('bindList');
    if (!list) return;
    list.innerHTML = '';
    for (const d of BIND_DEFS) {
      const row = document.createElement('div');
      row.className = 'bind-row';
      const label = document.createElement('span');
      label.textContent = t(d.label);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.bind = d.action;
      const listening = bindListenAction === d.action;
      btn.classList.toggle('listening', listening);
      btn.textContent = listening ? t('bindListening') : codeLabel(keyBinds[d.action]);
      btn.addEventListener('click', () => startBindListen(d.action));
      row.append(label, btn);
      list.appendChild(row);
    }
  }

  function startBindListen(action) {
    bindListenAction = action;
    renderBindList();
  }

  function cancelBindListen() {
    if (!bindListenAction) return;
    bindListenAction = null;
    renderBindList();
  }

  function applyBindCapture(code) {
    if (!bindListenAction || !code) return false;
    if (code === 'Escape' && bindListenAction !== 'pause') {
      cancelBindListen();
      return true;
    }
    const action = bindListenAction;
    for (const d of BIND_DEFS) {
      if (d.action !== action && keyBinds[d.action] === code) {
        keyBinds[d.action] = keyBinds[action];
      }
    }
    keyBinds[action] = code;
    bindListenAction = null;
    saveBinds();
    renderBindList();
    sfx('menu');
    return true;
  }

  function setFlashy(on) {
    flashyEnabled = !!on;
    storageSet(FLASHY_KEY, flashyEnabled ? '1' : '0');
    const chk = document.getElementById('chkFlashy');
    if (chk) chk.checked = flashyEnabled;
    if (!flashyEnabled) clearFxParticles();
  }

  function setShake(on) {
    shakeEnabled = !!on;
    storageSet(SHAKE_KEY, shakeEnabled ? '1' : '0');
    const chk = document.getElementById('chkShake');
    if (chk) chk.checked = shakeEnabled;
  }

  // FX checkbox is the source of truth. prefers-reduced-motion only affects the
  // default via detectFlashy() — an explicit FX-on must not be silently ignored.
  function fxMotionOk() {
    return !!flashyEnabled;
  }

  /* ---------- stage FX: shake / hit-stop / level theme ---------- */
  let hitStopLeft = 0;
  let shakeState = { mag: 0, until: 0, dur: 160, phase: 0 };

  function triggerHitStop(ms) {
    if (!fxMotionOk()) return;
    hitStopLeft = Math.max(hitStopLeft, ms);
  }

  function triggerShake(intensity) {
    if (!shakeEnabled || !fxMotionOk()) return;
    // Peak px on the board (not the wallpaper). Readable without feeling laggy.
    const mag = Math.min(9, Math.max(0, intensity) * 1.15);
    if (mag < 1.5) return;
    if (mag >= shakeState.mag * 0.65 || performance.now() > shakeState.until) {
      shakeState.mag = mag;
      shakeState.dur = 150 + mag * 10;
      shakeState.until = performance.now() + shakeState.dur;
      shakeState.phase = Math.random() * Math.PI * 2;
    }
  }

  function themeForLevel(level) {
    const idx = Math.min(LEVEL_THEMES.length - 1, Math.max(0, ((level - 1) / 5) | 0));
    return LEVEL_THEMES[idx];
  }

  function applyStagePresentation(now) {
    const stage = document.querySelector('.game-stage');
    if (!stage) return;
    const local = boards.find(b => b.live);
    const level = (local && local.level) || 1;
    const theme = themeForLevel(level);
    const root = document.documentElement;
    root.style.setProperty('--stage-tint', theme.tint);
    root.style.setProperty('--stage-ember', theme.ember);
    root.style.setProperty('--torch-warm', theme.warm);
    root.style.setProperty('--torch-cool', theme.cool);
    root.style.setProperty('--well-glow', theme.glow);

    // Keep the chamber art locked — idle parallax felt like constant drift/shake.
    stage.style.backgroundPosition = 'center, center, center center';
    stage.style.transform = '';

    let tx = 0, ty = 0;
    if (shakeEnabled && shakeState.until > now) {
      const p = Math.max(0, (shakeState.until - now) / shakeState.dur);
      // Ease-out: strong at impact, settles quickly
      const m = shakeState.mag * p;
      const t = (1 - p) * 22 + shakeState.phase;
      tx = Math.sin(t * 2.0) * m;
      ty = Math.cos(t * 2.6) * m * 0.45;
    }
    const host = stage.querySelector('.player.board-host');
    if (host) {
      host.style.transform = (tx || ty)
        ? 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0)'
        : '';
    }
  }

  function t(key, vars) {
    let s = (STR[lang] && STR[lang][key]) || STR.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach(k => {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
      });
    }
    return s;
  }

  function reasonText(reason) {
    const key = REASON_KEYS[reason];
    return key ? t(key) : (reason || t('rejected'));
  }

  function setLang(next) {
    if (next !== 'en' && next !== 'da') return;
    lang = next;
    storageSet(LANG_KEY, lang);
    applyI18n();
  }

  function applyI18n() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });
    const da = $('btnLangDa'), en = $('btnLangEn');
    if (da) da.classList.toggle('active', lang === 'da');
    if (en) en.classList.toggle('active', lang === 'en');
    syncMuteBtn();
    // Refresh dynamic UI if present
    if (typeof renderRoster === 'function' && matchPhase === 'lobby') renderRoster();
    if (typeof updateRematchHint === 'function' && matchPhase === 'post') updateRematchHint();
    if (btnAgain && !btnAgain.hidden) {
      if (btnAgain.disabled && matchPhase === 'post') btnAgain.textContent = t('ready');
      else if (matchPhase === 'post' || matchPhase === 'playing') btnAgain.textContent = t('playAgain');
    }
    if ($('ctrlHint') && matchPhase === 'playing') $('ctrlHint').textContent = t('ctrlHint');
    if (typeof renderBindList === 'function') renderBindList();
    if (typeof updatePauseLabels === 'function' && paused) updatePauseLabels();
    if ($('netLabel') && !$('netPanel').hidden && mode === 'guest') {
      $('netLabel').textContent = t('enterCode');
    }
    boards.forEach(b => {
      if (b.els && b.els.miniLabel) b.els.miniLabel.textContent = t('next');
      if (b.els && b.els.holdLabel) b.els.holdLabel.textContent = t('hold');
      if (b.els && b.els.powerLabel) b.els.powerLabel.textContent = t('relic');
      if (b.els && b.els.meta) {
        const lv = b.els.level ? b.els.level.textContent : '1';
        const ln = b.els.lines ? b.els.lines.textContent : '0';
        b.els.meta.innerHTML = t('meta', {lv: '<span class="lv">' + lv + '</span>', lines: '<span class="ln">' + ln + '</span>'});
        b.els.level = b.els.meta.querySelector('.lv');
        b.els.lines = b.els.meta.querySelector('.ln');
      }
      if (b.over && b.els && b.els.over) {
        b.els.over.textContent = b.live && eliminated ? t('eliminated') : t('topOut');
      }
      if (typeof b.paintHud === 'function') b.paintHud();
    });
  }

  const $ = id => document.getElementById(id);
  const menu = $('menu'), netPanel = $('netPanel'), lobbyEl = $('lobby'), gameEl = $('game');
  const banner = $('banner'), btnAgain = $('btnAgain'), boardsEl = $('boards');
  const countdownEl = $('countdown');
  const rosterList = $('rosterList'), btnReady = $('btnReady');
  const speedRampRow = $('speedRampRow'), selSpeedRamp = $('selSpeedRamp');
  const powerUpsRow = $('powerUpsRow'), selPowerUps = $('selPowerUps');
  const dropSpeedRow = $('dropSpeedRow'), selDropSpeed = $('selDropSpeed');
  const garbageTargetRow = $('garbageTargetRow'), selGarbageTarget = $('selGarbageTarget');
  const menuName = $('menuName'), lobbyName = $('lobbyName');

  function sanitizeName(raw) {
    const s = String(raw || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 12);
    return s || t('defaultName');
  }

  function getPlayerName() {
    const fromInput = (lobbyName.value || menuName.value || '').trim();
    if (fromInput) return sanitizeName(fromInput);
    const stored = storageGet(NAME_KEY);
    if (stored) return sanitizeName(stored);
    return t('defaultName');
  }

  function setPlayerName(raw) {
    const name = sanitizeName(raw);
    storageSet(NAME_KEY, name);
    menuName.value = name;
    lobbyName.value = name;
    return name;
  }

  try {
    const stored = storageGet(NAME_KEY);
    if (stored) {
      menuName.value = sanitizeName(stored);
      lobbyName.value = menuName.value;
    }
  } catch (_) {}

  let mode = null; // 'host' | 'guest' | 'solo'
  let playMode = 'marathon'; // marathon | sprint | ultra | zen | versus
  let boards = [];
  let boardById = new Map();
  let running = false, ended = false, eliminated = false;
  let paused = false;
  let pausedById = null;
  let settingsFrom = 'menu'; // 'menu' | 'pause'
  let matchPhase = 'idle'; // idle | lobby | countdown | playing | post
  let resultsAnimToken = 0;
  let last = 0, raf = 0, logicTimer = 0, countdownTimer = 0;
  // Synced match start: host waits for guest acks, then fires `go` and delays
  // its own countdown by ~RTT/2 so gravity does not begin a hop ahead of guests.
  const START_ACK_TIMEOUT_MS = 2000;
  const START_LEAD_MIN_MS = 40;
  const START_LEAD_MAX_MS = 400;
  let pendingStart = null; // host: {players, expect, acks, sentAt, maxRtt, timer} | guest: {players}
  let startLeadMs = START_LEAD_MIN_MS; // last measured host delay for go/begin
  let queuedCdBeat = null; // guest: latest countdown beat if UI not mounted yet
  let cdReadyWait = null; // host: {expect: Set, ready: Set, timer} while waiting for boards to mount
  let earlyCdReady = new Set(); // guest acks that arrived before host armed the wait
  const CD_READY_TIMEOUT_MS = 1500;
  const PEER_CONFIG = {
    config: {
      iceServers: [
        { urls: 'stun:92.5.51.80:3478' },
        {
          urls: 'turn:92.5.51.80:3478',
          username: 'tetris',
          credential: "3IwrF5?%'t3"
        },
        {
          urls: 'turn:92.5.51.80:3478?transport=tcp',
          username: 'tetris',
          credential: "3IwrF5?%'t3"
        },
        {
          urls: 'turns:turn.toeffe.uk:443?transport=tcp',
          username: 'tetris',
          credential: "3IwrF5?%'t3"
        }
      ]
    }
  };
  let peer = null, guestConn = null, roomCode = '';
  let timeRampEnabled = true; // host-controlled match setting
  let dropSpeed = 'normal'; // host-controlled base drop speed preset
  let garbageTarget = 'clockwise'; // host-controlled garbage targeting
  let powerUpsEnabled = false; // host-controlled relics / power-ups
  let myId = null;
  let hostPlayerId = null; // player id of current relay host (may differ from roomCode after migration)
  let roster = []; // {id, name, ready, alive}
  let connections = new Map(); // host: peerId -> DataConnection
  let syncAcc = 0;
  let suppressNetClose = false;
  let migratePhase = null; // null | 'taking' | 'reconnecting'
  let migrateTimer = null;
  let migrateAttempt = 0;
  // Post-match only: detect departed peers without waiting on slow WebRTC close.
  // Not used during play so idle/eliminated players are not kicked mid-match.
  const POST_HB_MS = 1000;
  const POST_HB_TIMEOUT_MS = 4000;
  let postHbTimer = 0;
  let postLastSeen = new Map(); // peerId -> performance.now()

  function rotateCW(m) {
    const n = m.length, out = Array.from({length:n}, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out[c][n - 1 - r] = m[r][c];
    return out;
  }

  function rotateCCW(m) {
    const n = m.length, out = Array.from({length:n}, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out[n - 1 - c][r] = m[r][c];
    return out;
  }

  // SRS wall kicks — offsets are (dx, dy) with +Y downward (screen space).
  // Converted from Guideline tables where +Y is up.
  const KICKS_JLSTZ = {
    '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  };
  const KICKS_I = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  };
  const KICKS_O = {
    '0>1': [[0, 0]], '1>0': [[0, 0]], '1>2': [[0, 0]], '2>1': [[0, 0]],
    '2>3': [[0, 0]], '3>2': [[0, 0]], '3>0': [[0, 0]], '0>3': [[0, 0]],
  };

  function srsKicks(type, from, to) {
    const key = from + '>' + to;
    if (type === 'I') return KICKS_I[key] || [[0, 0]];
    if (type === 'O') return KICKS_O[key] || [[0, 0]];
    return KICKS_JLSTZ[key] || [[0, 0]];
  }

  function bagPiece(bag) {
    if (!bag.length) {
      bag.push(...TYPES);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function clampInt(v, lo, hi, fallback) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(lo, Math.min(hi, n));
  }

  function loadTimingPrefs() {
    return {
      das: clampInt(storageGet(DAS_KEY), 50, 400, DEFAULT_DAS_MS),
      arr: clampInt(storageGet(ARR_KEY), 0, 200, DEFAULT_ARR_MS),
      soft: clampInt(storageGet(SOFT_KEY), 10, 200, DEFAULT_SOFT_MS),
    };
  }

  let timingPrefs = loadTimingPrefs();
  let DAS_MS = timingPrefs.das;
  let ARR_MS = timingPrefs.arr;
  let SOFT_MS = timingPrefs.soft;

  function applyTimingPrefs(das, arr, soft) {
    DAS_MS = clampInt(das, 50, 400, DEFAULT_DAS_MS);
    ARR_MS = clampInt(arr, 0, 200, DEFAULT_ARR_MS);
    SOFT_MS = clampInt(soft, 10, 200, DEFAULT_SOFT_MS);
    storageSet(DAS_KEY, String(DAS_MS));
    storageSet(ARR_KEY, String(ARR_MS));
    storageSet(SOFT_KEY, String(SOFT_MS));
  }

  // Guideline line-clear base scores (before level / B2B / combo).
  function clearScore(cleared, tSpin) {
    // tSpin: 0 none, 1 mini, 2 full
    if (tSpin === 2) {
      return [400, 800, 1200, 1600][cleared] || 0;
    }
    if (tSpin === 1) {
      return [100, 200, 400, 800][cleared] || 0;
    }
    return [0, 100, 300, 500, 800][cleared] || 0;
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return {r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255};
  }

  function shadeRgb(rgb, f) {
    return `rgb(${Math.max(0, Math.min(255, (rgb.r * f) | 0))},${Math.max(0, Math.min(255, (rgb.g * f) | 0))},${Math.max(0, Math.min(255, (rgb.b * f) | 0))})`;
  }

  function grit(x, y) {
    return ((x * 17 + y * 31) & 7) / 40;
  }

  function drawBlock(ctx, x, y, cell, size, opts) {
    const ghost = opts && opts.ghost;
    const pulse = (opts && opts.pulse) || 0;
    const type = cellType(cell) || (typeof cell === 'string' && cell.charAt(0) === '#' ? null : cell);
    const iron = type === GARBAGE_TYPE || cell === GARBAGE_COLOR;
    const gap = Math.max(1, (size * .06) | 0);
    let px = x * size + gap, py = y * size + gap;
    let w = size - gap * 2, h = size - gap * 2;
    if (w < 2 || h < 2) return;

    if (pulse > 0) {
      const sx = 1 + pulse * 0.1;
      const sy = 1 - pulse * 0.14;
      const cx = px + w / 2, cy = py + h / 2;
      px = cx - (w * sx) / 2;
      py = cy - (h * sy) / 2;
      w *= sx;
      h *= sy;
    }

    const color = iron ? GARBAGE_COLOR : (SHAPES[type] && SHAPES[type].color) || (typeof cell === 'string' ? cell : '#888');

    // Soft inner glow plate under the block (skip ghosts / tiny cells)
    if (!ghost && !iron && size >= 12) {
      const rgb = hexToRgb(color);
      ctx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (0.16 + pulse * 0.2) + ')';
      ctx.beginPath();
      ctx.arc(px + w / 2, py + h / 2, Math.max(w, h) * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }

    const img = !iron && type && BLOCK_IMGS[type];
    if (img && img.complete && img.naturalWidth > 0) {
      const prev = ctx.globalAlpha;
      if (ghost) ctx.globalAlpha = prev * 0.38;
      ctx.drawImage(img, px, py, w, h);
      if (!ghost) {
        // Specular edge polish over the sprite
        const bevel = Math.max(1, (size * .14) | 0);
        ctx.fillStyle = 'rgba(255,240,200,' + (0.14 + pulse * 0.2) + ')';
        ctx.fillRect(px + 1, py + 1, Math.max(1, w - 2), bevel);
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.fillRect(px + 1, py + h - bevel, Math.max(1, w - 2), bevel);
        drawColorblindMark(ctx, px, py, w, h, type);
      }
      ctx.globalAlpha = prev;
      return;
    }

    // Fallback: procedural bevel (also used for garbage / unloaded sprites)
    const rgb = hexToRgb(color);
    const g = grit(x | 0, y | 0);
    const face = ghost ? shadeRgb(rgb, .55 + g) : shadeRgb(rgb, .92 + g);
    const hi = ghost ? 'rgba(220,200,160,.12)' : iron ? 'rgba(180,170,150,.18)' : 'rgba(255,235,180,.35)';
    const lo = iron ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.4)';

    ctx.fillStyle = shadeRgb(rgb, .35);
    ctx.fillRect(px, py, w, h);
    ctx.fillStyle = face;
    ctx.fillRect(px + 1, py + 1, Math.max(1, w - 2), Math.max(1, h - 2));

    const bevel = Math.max(1, (size * .18) | 0);
    ctx.fillStyle = hi;
    ctx.fillRect(px + 1, py + 1, Math.max(1, w - 2), bevel);
    ctx.fillRect(px + 1, py + 1, bevel, Math.max(1, h - 2));
    ctx.fillStyle = lo;
    ctx.fillRect(px + 1, py + h - bevel - 1, Math.max(1, w - 2), bevel);
    ctx.fillRect(px + w - bevel - 1, py + 1, bevel, Math.max(1, h - 2));

    if (!ghost && !iron && size >= 12) {
      const chip = Math.max(2, (size * .2) | 0);
      ctx.fillStyle = 'rgba(255,245,210,.45)';
      ctx.fillRect(px + 2, py + 2, chip, Math.max(1, chip / 2 | 0));
    }
    if (iron) {
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.fillRect(px + 2, py + (h / 2 | 0), Math.max(1, w - 4), 1);
    }
    if (!ghost) drawColorblindMark(ctx, px, py, w, h, type);
  }

  function drawColorblindMark(ctx, px, py, w, h, type) {
    if (!colorblindEnabled || !type || type === GARBAGE_TYPE || w < 6) return;
    const cx = px + w / 2;
    const cy = py + h / 2;
    const m = Math.max(1, (Math.min(w, h) * 0.12) | 0);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,248,220,.75)';
    ctx.fillStyle = 'rgba(255,248,220,.75)';
    ctx.lineWidth = Math.max(1, m * 0.7);
    ctx.lineCap = 'round';
    if (type === 'I') {
      ctx.beginPath();
      ctx.moveTo(px + m, cy);
      ctx.lineTo(px + w - m, cy);
      ctx.stroke();
    } else if (type === 'O') {
      ctx.strokeRect(px + m * 1.5, py + m * 1.5, w - m * 3, h - m * 3);
    } else if (type === 'T') {
      ctx.beginPath();
      ctx.moveTo(cx, py + m);
      ctx.lineTo(px + w - m, py + h - m);
      ctx.lineTo(px + m, py + h - m);
      ctx.closePath();
      ctx.stroke();
    } else if (type === 'S') {
      ctx.beginPath();
      ctx.moveTo(px + m, py + h - m);
      ctx.lineTo(px + w - m, py + m);
      ctx.stroke();
    } else if (type === 'Z') {
      ctx.beginPath();
      ctx.moveTo(px + m, py + m);
      ctx.lineTo(px + w - m, py + h - m);
      ctx.stroke();
    } else if (type === 'J') {
      ctx.fillRect(px + m, py + m, m, h - m * 2);
      ctx.fillRect(px + m, py + h - m * 2, w * 0.45, m);
    } else if (type === 'L') {
      ctx.fillRect(px + w - m * 2, py + m, m, h - m * 2);
      ctx.fillRect(px + w * 0.35, py + h - m * 2, w * 0.45, m);
    }
    ctx.restore();
  }

  function drawMiniAt(ctx, type, size, ox0, oy0) {
    if (!type) return;
    const m = SHAPES[type].m, n = m.length, bs = Math.max(8, (size / n) | 0) - 2;
    const ox = ox0 + (size - n * (bs + 2)) / 2, oy = oy0 + (size - n * (bs + 2)) / 2;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!m[r][c]) continue;
      const px = ox + c * (bs + 2), py = oy + r * (bs + 2);
      const img = BLOCK_IMGS[type];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, px, py, bs, bs);
        continue;
      }
      const color = SHAPES[type].color;
      const rgb = hexToRgb(color);
      ctx.fillStyle = shadeRgb(rgb, .4);
      ctx.fillRect(px, py, bs, bs);
      ctx.fillStyle = shadeRgb(rgb, .95);
      ctx.fillRect(px + 1, py + 1, Math.max(1, bs - 2), Math.max(1, bs - 2));
      ctx.fillStyle = 'rgba(255,235,180,.3)';
      ctx.fillRect(px + 1, py + 1, Math.max(1, bs - 2), Math.max(1, 2));
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(px + 1, py + bs - 3, Math.max(1, bs - 2), 2);
    }
  }

  function drawMini(ctx, type, size) {
    ctx.clearRect(0, 0, size, size);
    drawMiniAt(ctx, type, size, 0, 0);
  }

  function drawNextQueue(ctx, queue, size) {
    const h = size * Math.max(1, NEXT_COUNT);
    ctx.clearRect(0, 0, size, h);
    if (!queue || !queue.length) return;
    for (let i = 0; i < queue.length && i < NEXT_COUNT; i++) {
      const slot = size;
      // Slight fade for deeper queue slots
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * (i === 0 ? 1 : Math.max(0.45, 1 - i * 0.22));
      drawMiniAt(ctx, queue[i], slot, 0, i * slot);
      ctx.globalAlpha = prev;
    }
  }

  class Board {
    constructor({canvas, nextCanvas, holdCanvas, els, live, block, playerId, nextSize}) {
      this.ctx = canvas.getContext('2d');
      this.nextCtx = nextCanvas.getContext('2d');
      this.holdCtx = holdCanvas.getContext('2d');
      this.els = els;
      this.live = live;
      this.block = block;
      this.playerId = playerId;
      this.nextSize = nextSize;
      this.reset();
    }

    reset() {
      this.grid = Array.from({length: ROWS}, () => Array(COLS).fill(null));
      this.bag = [];
      this.queue = [];
      this.fillQueue();
      this.holdType = null;
      this.canHold = true;
      this.powerUp = null;
      this.shieldLeft = 0;
      this.torchUntil = 0;
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.dropMs = DROP_SPEED[dropSpeed] || DROP_SPEED.normal;
      this.elapsed = 0;
      this.acc = 0;
      this.lockAcc = 0;
      this.lockResets = 0;
      this.over = false;
      this.gQueue = 0;
      this.combo = 0;
      this.b2b = false;
      this.piecesPlaced = 0;
      this.inputs = 0;
      this.maxCombo = 0;
      this.tspinCount = 0;
      this.tetrisCount = 0;
      this.lastAction = null; // 'move' | 'rotate' | 'drop'
      this.lastKick = 0;
      this.flashUntil = 0;
      this.flashKind = null;
      this.visX = 0;
      this.visY = -BUFFER_ROWS;
      this.visSnap = true;
      this.lockPulse = 0;
      this.settleCells = null;
      this.clearAnim = null;
      this.rowDrawY = null; // per-row visual Y offset during collapse
      this.spawn();
      this.paintHud();
      if (this.els.over) this.els.over.textContent = '';
    }

    fillQueue() {
      while (this.queue.length < NEXT_COUNT) this.queue.push(bagPiece(this.bag));
    }

    makePiece(type) {
      const shape = SHAPES[type];
      const m = shape.m.map(r => r.slice());
      return {
        type,
        m,
        color: shape.color,
        x: ((COLS - m.length) / 2) | 0,
        y: -BUFFER_ROWS,
        r: 0,
      };
    }

    spawn() {
      this.fillQueue();
      const type = this.queue.shift();
      this.fillQueue();
      this.piece = this.makePiece(type);
      this.visX = this.piece.x;
      this.visY = this.piece.y;
      this.visSnap = true;
      this.lockPulse = 0;
      this.canHold = true;
      this.acc = 0;
      this.lockAcc = 0;
      this.lockResets = 0;
      this.lastAction = null;
      this.lastKick = 0;
      if (this.hits(this.piece.m, this.piece.x, this.piece.y)) {
        this.over = true;
        if (this.els.over) this.els.over.textContent = t('topOut');
        onTopOut(this);
      }
    }

    syncVis(snap) {
      if (!this.piece) return;
      const now = performance.now();
      const dt = Math.min(48, now - (this._visLast || now));
      this._visLast = now;
      if (snap || this.visSnap) {
        this.visX = this.piece.x;
        this.visY = this.piece.y;
        this.visSnap = false;
        return;
      }
      // Frame-rate independent easing — readable on 60Hz and 144Hz
      const k = 1 - Math.exp(-dt / PIECE_LERP_MS);
      this.visX += (this.piece.x - this.visX) * k;
      this.visY += (this.piece.y - this.visY) * k;
      if (Math.abs(this.visX - this.piece.x) < 0.015) this.visX = this.piece.x;
      if (Math.abs(this.visY - this.piece.y) < 0.015) this.visY = this.piece.y;
    }

    grounded() {
      return !!(this.piece && this.hits(this.piece.m, this.piece.x, this.piece.y + 1));
    }

    lockDelayMs() {
      return Math.max(MIN_LOCK_MS, Math.min(MAX_LOCK_MS, Math.round(this.dropMs * LOCK_DELAY_RATIO)));
    }

    /** Reset lock timer on successful fidget (Infinity-style, capped). */
    tryLockReset() {
      if (!this.grounded()) {
        this.lockAcc = 0;
        return;
      }
      if (this.lockResets < LOCK_RESET_LIMIT) {
        this.lockAcc = 0;
        this.lockResets++;
      }
    }

    hits(m, px, py) {
      for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) {
        if (!m[r][c]) continue;
        const x = px + c, y = py + r;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && this.grid[y][x]) return true;
      }
      return false;
    }

    cellFilled(x, y) {
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y < 0) return false;
      return !!this.grid[y][x];
    }

    /** 0 none, 1 mini, 2 full — Guideline 3-corner + kick-based mini. */
    detectTSpin() {
      if (!this.piece || this.piece.type !== 'T' || this.lastAction !== 'rotate') return 0;
      const {x, y} = this.piece;
      const corners = [
        this.cellFilled(x, y),
        this.cellFilled(x + 2, y),
        this.cellFilled(x, y + 2),
        this.cellFilled(x + 2, y + 2),
      ];
      const filled = corners.filter(Boolean).length;
      if (filled >= 3) return 2;
      if (filled === 2 && this.lastKick > 0) return 1;
      return 0;
    }

    canPlay() {
      return this.live && !this.over && !ended && !paused && matchPhase === 'playing' && !this.clearAnim;
    }

    noteInput() {
      this.inputs++;
    }

    getMatchStats() {
      const sec = Math.max(0.001, this.elapsed / 1000);
      return {
        score: this.score | 0,
        lines: this.lines | 0,
        level: this.level | 0,
        elapsed: this.elapsed,
        pps: this.piecesPlaced / sec,
        apm: (this.inputs / sec) * 60,
        maxCombo: this.maxCombo | 0,
        tspins: this.tspinCount | 0,
        tetrises: this.tetrisCount | 0,
      };
    }

    hold() {
      if (!this.canPlay() || !this.canHold || !this.piece) return;
      const curType = this.piece.type;
      if (this.holdType === null) {
        this.holdType = curType;
        this.spawn();
      } else {
        const swap = this.holdType;
        this.holdType = curType;
        this.piece = this.makePiece(swap);
        this.visX = this.piece.x;
        this.visY = this.piece.y;
        this.visSnap = true;
        this.acc = 0;
        this.lockAcc = 0;
        this.lockResets = 0;
        this.lastAction = null;
        this.lastKick = 0;
        if (this.hits(this.piece.m, this.piece.x, this.piece.y)) {
          this.over = true;
          if (this.els.over) this.els.over.textContent = t('topOut');
          onTopOut(this);
        }
      }
      this.canHold = false;
      this.noteInput();
      sfx('hold');
      this.paintHud();
      syncState(this, true);
    }

    usePower() {
      if (!this.canPlay() || !powerUpsEnabled || !this.powerUp) return;
      const kind = this.powerUp;
      if (!POWER_KIND[kind]) return;
      this.powerUp = null;
      this.paintHud();
      if (kind === 'quake') {
        this.applyQuake();
        netSend({t: 'power', kind, from: this.playerId, self: true});
        syncState(this, true);
      } else if (kind === 'shield') {
        this.applyShield();
        netSend({t: 'power', kind, from: this.playerId, self: true});
        syncState(this, true);
      } else {
        netSend({t: 'power', kind, from: this.playerId});
      }
    }

    applyQuake() {
      this.grid.pop();
      this.grid.unshift(Array(COLS).fill(null));
      this.flashUntil = performance.now() + 200;
      this.flashKind = 'clear';
      this.paintHud();
    }

    applyShield() {
      this.shieldLeft = Math.min(SHIELD_CAP, this.shieldLeft + SHIELD_GAIN);
      this.paintHud();
    }

    applyTorch() {
      this.torchUntil = performance.now() + TORCH_MS;
      this.updateSpeed();
      this.paintHud();
    }

    applyCurse() {
      this.holdType = null;
      this.canHold = true;
      this.paintHud();
      if (this.live) syncState(this, true);
    }

    move(dx) {
      if (!this.canPlay()) return;
      if (!this.hits(this.piece.m, this.piece.x + dx, this.piece.y)) {
        this.piece.x += dx;
        this.lastAction = 'move';
        this.noteInput();
        this.tryLockReset();
        sfx('move');
        syncState(this);
      }
    }

    rot(dir) {
      if (!this.canPlay() || !this.piece) return;
      const cw = dir !== -1;
      const from = this.piece.r & 3;
      const to = (from + (cw ? 1 : 3)) & 3;
      const rm = cw ? rotateCW(this.piece.m) : rotateCCW(this.piece.m);
      const kicks = srsKicks(this.piece.type, from, to);
      for (let i = 0; i < kicks.length; i++) {
        const [kx, ky] = kicks[i];
        const nx = this.piece.x + kx;
        const ny = this.piece.y + ky;
        if (!this.hits(rm, nx, ny)) {
          this.piece.m = rm;
          this.piece.x = nx;
          this.piece.y = ny;
          this.piece.r = to;
          this.lastAction = 'rotate';
          this.lastKick = i;
          this.noteInput();
          this.tryLockReset();
          sfx('rotate');
          syncState(this);
          return;
        }
      }
    }

    soft() {
      if (!this.canPlay()) return;
      if (!this.hits(this.piece.m, this.piece.x, this.piece.y + 1)) {
        this.piece.y++;
        this.score += 1;
        this.acc = 0;
        this.lockAcc = 0;
        this.lastAction = 'drop';
        this.noteInput();
        sfx('soft');
        this.paintHud();
        syncState(this);
      }
      // Already grounded: keep sliding — lock delay handles placement (hard drop still snaps).
    }

    hard() {
      if (!this.canPlay()) return;
      let d = 0;
      while (!this.hits(this.piece.m, this.piece.x, this.piece.y + 1)) {
        this.piece.y++;
        d++;
      }
      this.score += d * 2;
      this.lockAcc = 0;
      this.lastAction = 'drop';
      this.noteInput();
      this.visSnap = true;
      this.syncVis(true);
      if (d > 0) fxForHardDrop(this, d);
      sfx('hard');
      this.lock(true);
    }

    findFullRows() {
      const rows = [];
      for (let r = 0; r < ROWS; r++) {
        if (this.grid[r].every(Boolean)) rows.push(r);
      }
      return rows;
    }

    collapseRows(rows) {
      if (!rows || !rows.length) return 0;
      const skip = new Set(rows);
      const next = [];
      for (let r = 0; r < ROWS; r++) {
        if (!skip.has(r)) next.push(this.grid[r]);
      }
      while (next.length < ROWS) next.unshift(Array(COLS).fill(null));
      this.grid = next;
      return rows.length;
    }

    finishClearAnim() {
      const anim = this.clearAnim;
      if (!anim) return;
      this.collapseRows(anim.rows);
      this.rowDrawY = null;
      this.clearAnim = null;
      if (anim.pendingGarbage) {
        this.applyGarbage(anim.pendingGarbage);
      }
      if (!this.over) this.spawn();
      this.paintHud();
      syncState(this, true);
    }

    beginClearAnim(rows, pendingGarbage) {
      if (!fxMotionOk()) {
        this.collapseRows(rows);
        if (pendingGarbage) this.applyGarbage(pendingGarbage);
        if (!this.over) this.spawn();
        return;
      }
      this.piece = null;
      this.clearAnim = {
        rows: rows.slice(),
        t: 0,
        flashMs: CLEAR_FLASH_MS,
        collapseMs: CLEAR_COLLAPSE_MS,
        pendingGarbage: pendingGarbage || 0,
      };
      this.rowDrawY = Array(ROWS).fill(0);
    }

    tickClearAnim(dt) {
      const anim = this.clearAnim;
      if (!anim) return;
      anim.t += dt;
      const flashEnd = anim.flashMs;
      const total = anim.flashMs + anim.collapseMs;
      if (anim.t < flashEnd) {
        // hold rows in place while flashing
        if (this.rowDrawY) for (let i = 0; i < ROWS; i++) this.rowDrawY[i] = 0;
      } else if (anim.t < total) {
        const p = (anim.t - flashEnd) / anim.collapseMs;
        const ease = p * p;
        const dying = new Set(anim.rows);
        let fall = 0;
        // From bottom: each cleared row adds one cell of fall for rows above
        for (let r = ROWS - 1; r >= 0; r--) {
          if (dying.has(r)) {
            fall += 1;
            this.rowDrawY[r] = ease * 0.35; // slight sink while fading
          } else {
            this.rowDrawY[r] = ease * fall;
          }
        }
      } else {
        this.finishClearAnim();
      }
    }

    lock(fromHard) {
      const {m, x, y, type} = this.piece;
      const tSpin = this.detectTSpin();
      let placed = 0;
      const placedCells = [];
      for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) {
        if (!m[r][c]) continue;
        const gx = x + c, gy = y + r;
        if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
          this.grid[gy][gx] = type;
          placed++;
          placedCells.push({x: gx, y: gy});
        }
      }
      // Lock-out: piece settled entirely in the sky buffer — no recovery.
      if (!placed) {
        this.over = true;
        if (this.els.over) this.els.over.textContent = t('topOut');
        this.paintHud();
        syncState(this, true);
        onTopOut(this);
        return;
      }
      if (!fromHard) sfx('lock');
      this.piecesPlaced++;
      this.lockPulse = 1;
      this.settleCells = placedCells;
      this.flashUntil = performance.now() + 120;
      this.flashKind = 'lock';
      fxForLock(this, placedCells);
      const fullRows = this.findFullRows();
      const cleared = fullRows.length;
      let pendingGarbage = 0;
      const prevLevel = this.level;
      if (tSpin) this.tspinCount++;
      if (cleared > 0) {
        let base = clearScore(cleared, tSpin);
        const difficult = cleared === 4 || tSpin > 0;
        const b2bAwarded = difficult && this.b2b;
        if (b2bAwarded) base = (base * 1.5) | 0;
        if (this.combo > 0) this.score += 50 * this.combo * this.level;
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        if (cleared === 4) this.tetrisCount++;
        this.score += base * this.level;
        this.lines += cleared;
        this.b2b = difficult;
        this.updateSpeed();
        if (this.level > prevLevel) sfx('levelup');
        if (tSpin) sfx('tspin', tSpin >= 2);
        else sfx('clear', cleared);
        if (this.combo >= 2) sfx('combo', this.combo);
        if (navigator.vibrate) navigator.vibrate(cleared >= 4 || tSpin ? 45 : 30);
        const g = GARBAGE[cleared] || 0;
        if (g) sendGarbage(this, g);
        if (powerUpsEnabled) maybeGrantPowerUp(this, cleared);
        this.flashUntil = performance.now() + 200;
        this.flashKind = 'clear';
        showClearFx(this, cleared, tSpin, b2bAwarded);
        // Board kick: singles light, Tetris / T-spin solid (wallpaper stays still)
        const impact = tSpin >= 2 ? 5.5 + cleared * 0.8
          : (cleared >= 4 ? 6.5 : cleared >= 3 ? 4.2 : cleared >= 2 ? 3 : 2);
        triggerShake(impact);
        if (cleared >= 4 || tSpin >= 2) triggerHitStop(40);
        else if (cleared >= 3) triggerHitStop(24);
        pendingGarbage = this.gQueue;
        this.gQueue = 0;
        this.beginClearAnim(fullRows, pendingGarbage);
      } else {
        if (tSpin) {
          this.score += clearScore(0, tSpin) * this.level;
          showClearFx(this, 0, tSpin, false);
          triggerShake(2.5);
          sfx('tspin', tSpin >= 2);
        }
        this.combo = 0;
        if (this.gQueue) {
          this.applyGarbage(this.gQueue);
          this.gQueue = 0;
        }
        if (!this.over) this.spawn();
      }
      updateMusicIntensity(this);
      this.paintHud();
      syncState(this, true);
    }

    addGarbage(n) {
      let left = n | 0;
      if (left <= 0) return;
      if (this.shieldLeft > 0) {
        const absorb = Math.min(this.shieldLeft, left);
        this.shieldLeft -= absorb;
        left -= absorb;
        if (absorb) {
          showBoardToast(this, t('shieldAbsorb'), 'shield');
          this.paintHud();
        }
      }
      if (left > 0) this.gQueue += left;
    }

    applyGarbage(n) {
      for (let i = 0; i < n; i++) {
        this.grid.shift();
        const gap = (Math.random() * COLS) | 0;
        const row = Array(COLS).fill(GARBAGE_TYPE);
        row[gap] = null;
        this.grid.push(row);
      }
      this.flashUntil = performance.now() + 180;
      this.flashKind = 'garbage';
    }

    tick(dt) {
      if (!this.live || this.over || ended || matchPhase !== 'playing') return;
      if (this.lockPulse > 0) {
        this.lockPulse = Math.max(0, this.lockPulse - dt / LOCK_PULSE_MS);
        if (this.lockPulse <= 0) this.settleCells = null;
      }
      if (this.clearAnim) {
        this.tickClearAnim(dt);
        return;
      }
      if (!this.canPlay()) return;
      this.elapsed += dt;
      if (this.updateSpeed()) this.paintHud();
      else if (playMode === 'ultra') this.paintHud();
      this.acc += dt;
      if (this.acc >= this.dropMs) {
        this.acc = 0;
        if (!this.grounded()) {
          this.piece.y++;
          this.lockAcc = 0;
          this.lastAction = 'drop';
          syncState(this);
        }
      }
      if (this.grounded()) {
        this.lockAcc += dt;
        if (this.lockAcc >= this.lockDelayMs()) this.lock();
      } else {
        this.lockAcc = 0;
      }
      if (this.live) checkSoloObjectives(this);
    }

    updateSpeed() {
      const lineLevel = 1 + ((this.lines / 10) | 0);
      const rampOn = timeRampEnabled && playMode !== 'zen';
      const timeLevel = rampOn ? 1 + ((this.elapsed / TIME_LEVEL_MS) | 0) : 1;
      const level = Math.max(lineLevel, timeLevel);
      const changed = level !== this.level;
      this.level = level;
      const baseDropMs = DROP_SPEED[dropSpeed] || DROP_SPEED.normal;
      let dropMs = Math.max(MIN_DROP_MS, baseDropMs - (level - 1) * LEVEL_DROP_STEP_MS);
      if (this.torchUntil && performance.now() < this.torchUntil) {
        dropMs = Math.max(MIN_DROP_MS, dropMs / 2);
      } else {
        this.torchUntil = 0;
      }
      const speedChanged = dropMs !== this.dropMs;
      this.dropMs = dropMs;
      return changed || speedChanged;
    }

    ghostY() {
      let gy = this.piece.y;
      while (!this.hits(this.piece.m, this.piece.x, gy + 1)) gy++;
      return gy;
    }

    paintHud() {
      if (this.els.score) this.els.score.textContent = this.score;
      if (this.els.level) this.els.level.textContent = this.level;
      if (this.els.lines) {
        if (playMode === 'sprint') this.els.lines.textContent = Math.min(this.lines, SPRINT_LINES) + '/' + SPRINT_LINES;
        else this.els.lines.textContent = this.lines;
      }
      if (this.els.objective) {
        if (playMode === 'sprint') {
          this.els.objective.hidden = false;
          this.els.objective.textContent = t('sprintGoal', {n: Math.min(this.lines, SPRINT_LINES)});
        } else if (playMode === 'ultra') {
          this.els.objective.hidden = false;
          const left = Math.max(0, ULTRA_MS - this.elapsed);
          this.els.objective.textContent = t('ultraLeft', {t: formatMatchTime(left)});
        } else if (playMode === 'zen') {
          this.els.objective.hidden = false;
          this.els.objective.textContent = t('modeZen');
        } else if (playMode === 'marathon') {
          this.els.objective.hidden = false;
          this.els.objective.textContent = t('modeMarathon');
        } else {
          this.els.objective.hidden = true;
          this.els.objective.textContent = '';
        }
      }
      if (this.nextCtx) drawNextQueue(this.nextCtx, this.queue, this.nextSize);
      if (this.holdCtx) drawMini(this.holdCtx, this.holdType, this.nextSize);
      if (this.els.powerWrap) this.els.powerWrap.hidden = !powerUpsEnabled;
      if (this.els.powerSlot) {
        const name = this.powerUp ? relicName(this.powerUp) : t('powerEmpty');
        this.els.powerSlot.textContent = name;
        this.els.powerSlot.classList.toggle('has-relic', !!this.powerUp);
        if (this.shieldLeft > 0) {
          this.els.powerSlot.title = t('relicShield') + ' ×' + this.shieldLeft;
        } else {
          this.els.powerSlot.title = '';
        }
      }
    }

    // Keep canvas bitmaps matched to the current room/viewport (zoom + resize).
    resyncPixels(block, nextSize) {
      if (block === this.block && nextSize === this.nextSize) return;
      this.block = block;
      this.nextSize = nextSize;
      const main = this.ctx.canvas;
      main.width = COLS * block;
      main.height = ROWS * block;
      const next = this.nextCtx.canvas;
      next.width = nextSize;
      next.height = nextSize * NEXT_COUNT;
      if (this.holdCtx) {
        const hold = this.holdCtx.canvas;
        hold.width = nextSize;
        hold.height = nextSize;
      }
      this.draw();
      this.paintHud();
    }

    draw() {
      const ctx = this.ctx, s = this.block;
      const bw = COLS * s, bh = ROWS * s;
      this.syncVis(false);
      ctx.clearRect(0, 0, bw, bh);
      // Void floor matching the chamber well (not a flat UI screen)
      const floor = ctx.createLinearGradient(0, 0, 0, bh);
      floor.addColorStop(0, '#0c0a10');
      floor.addColorStop(.55, '#08060c');
      floor.addColorStop(1, '#050408');
      ctx.fillStyle = floor;
      ctx.fillRect(0, 0, bw, bh);
      const theme = themeForLevel(this.level || 1);
      // Soft side wash from room torches — shifts with level theme
      const sideWash = ctx.createLinearGradient(0, 0, bw, 0);
      sideWash.addColorStop(0, theme.cool);
      sideWash.addColorStop(.18, 'rgba(0,0,0,0)');
      sideWash.addColorStop(.82, 'rgba(0,0,0,0)');
      sideWash.addColorStop(1, theme.warm);
      ctx.fillStyle = sideWash;
      ctx.fillRect(0, 0, bw, bh);
      if (gridOpacity > 0) {
        ctx.strokeStyle = 'rgba(180,150,70,' + (gridOpacity / 100) + ')';
        ctx.lineWidth = 1;
        for (let x = 0; x <= COLS; x++) {
          ctx.beginPath(); ctx.moveTo(x * s + .5, 0); ctx.lineTo(x * s + .5, bh); ctx.stroke();
        }
        for (let y = 0; y <= ROWS; y++) {
          ctx.beginPath(); ctx.moveTo(0, y * s + .5); ctx.lineTo(bw, y * s + .5); ctx.stroke();
        }
      }

      const anim = this.clearAnim;
      const dying = anim ? new Set(anim.rows) : null;
      const flashP = anim && anim.t < anim.flashMs ? 1 - (anim.t / anim.flashMs) : 0;
      const settling = (this.lockPulse > 0 && this.settleCells)
        ? new Set(this.settleCells.map(c => c.x + ',' + c.y))
        : null;

      for (let r = 0; r < ROWS; r++) {
        const yOff = (this.rowDrawY && this.rowDrawY[r]) || 0;
        for (let c = 0; c < COLS; c++) {
          if (!this.grid[r][c]) continue;
          const isDying = dying && dying.has(r);
          const settlePulse = settling && settling.has(c + ',' + r) ? this.lockPulse : 0;
          if (isDying && flashP > 0) {
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * (0.45 + flashP * 0.55);
            drawBlock(ctx, c, r + yOff, this.grid[r][c], s, {pulse: flashP});
            ctx.globalAlpha = prev;
            // Bright brass flash on clearing rows (hard to miss)
            ctx.fillStyle = 'rgba(255,236,170,' + (0.35 + flashP * 0.55) + ')';
            ctx.fillRect(c * s, (r + yOff) * s, s, s);
          } else if (isDying) {
            const collapseP = Math.min(1, Math.max(0, (anim.t - anim.flashMs) / anim.collapseMs));
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * (1 - collapseP);
            drawBlock(ctx, c, r + yOff, this.grid[r][c], s);
            ctx.globalAlpha = prev;
          } else {
            drawBlock(ctx, c, r + yOff, this.grid[r][c], s, {pulse: settlePulse});
          }
        }
      }

      if (this.piece && !this.over && !anim) {
        const gy = this.ghostY();
        const pType = this.piece.type;
        const vx = this.visX;
        const vy = this.visY;
        for (let r = 0; r < this.piece.m.length; r++) for (let c = 0; c < this.piece.m.length; c++) {
          if (!this.piece.m[r][c]) continue;
          const gRow = gy + r;
          if (gRow >= 0) drawBlock(ctx, this.piece.x + c, gRow, pType, s, {ghost: true});
        }
        for (let r = 0; r < this.piece.m.length; r++) for (let c = 0; c < this.piece.m.length; c++) {
          if (!this.piece.m[r][c]) continue;
          const row = vy + r;
          if (row > -1) drawBlock(ctx, vx + c, row, pType, s, {pulse: this.lockPulse});
        }
      }

      // Deep stone recess — edges fall into the chamber shadow
      const vg = ctx.createRadialGradient(bw / 2, bh * .42, Math.min(bw, bh) * .18, bw / 2, bh * .5, Math.max(bw, bh) * .78);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(.55, 'rgba(0,0,0,.18)');
      vg.addColorStop(1, 'rgba(0,0,0,.62)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, bw, bh);
      if (this.flashUntil && performance.now() < this.flashUntil) {
        const fade = (this.flashUntil - performance.now()) / 200;
        const a = Math.max(0, Math.min(.35, fade * .35));
        if (this.flashKind === 'garbage') ctx.fillStyle = `rgba(120,40,30,${a})`;
        else if (this.flashKind === 'clear') ctx.fillStyle = `rgba(212,175,55,${a})`;
        else ctx.fillStyle = `rgba(240,220,160,${a * .7})`;
        ctx.fillRect(0, 0, bw, bh);
      } else {
        this.flashUntil = 0;
        this.flashKind = null;
      }
    }

    snapshot() {
      return {
        t: 'state',
        from: this.playerId,
        grid: this.grid,
        piece: this.piece && {
          m: this.piece.m, x: this.piece.x, y: this.piece.y,
          color: this.piece.color, type: this.piece.type, r: this.piece.r,
        },
        next: this.queue[0] || null,
        queue: this.queue.slice(),
        hold: this.holdType,
        powerUp: this.powerUp,
        shieldLeft: this.shieldLeft,
        torchUntil: this.torchUntil,
        score: this.score,
        level: this.level,
        lines: this.lines,
        combo: this.combo,
        b2b: this.b2b,
        over: this.over,
      };
    }

    applyRemote(data) {
      const prevLines = this.lines;
      this.grid = data.grid;
      this.piece = data.piece;
      if (Array.isArray(data.queue) && data.queue.length) this.queue = data.queue.slice();
      else if (data.next) this.queue = [data.next];
      if ('hold' in data) this.holdType = data.hold;
      if ('powerUp' in data) this.powerUp = data.powerUp;
      if ('shieldLeft' in data) this.shieldLeft = data.shieldLeft | 0;
      if ('torchUntil' in data) this.torchUntil = data.torchUntil || 0;
      this.score = data.score;
      this.level = data.level;
      this.lines = data.lines;
      if ('combo' in data) this.combo = data.combo;
      if ('b2b' in data) this.b2b = !!data.b2b;
      this.over = !!data.over;
      this.paintHud();
      if (this.els.over) this.els.over.textContent = this.over ? t('topOut') : '';
      const gained = this.lines - prevLines;
      if (gained > 0) showClearFx(this, Math.min(4, gained), 0);
    }
  }

  /* ---------- UI helpers ---------- */
  function show(el) {
    if (!el) return;
    el.classList.remove('panel-exit');
    el.hidden = false;
  }
  function hide(el) {
    if (!el) return;
    el.classList.remove('panel-exit');
    el.hidden = true;
  }

  function formatMatchTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = (total / 60) | 0;
    const s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function animateCountUp(el, target, opts) {
    const decimals = (opts && opts.decimals) || 0;
    const duration = (opts && opts.duration) || 700;
    const token = opts && opts.token;
    const start = performance.now();
    const from = 0;
    function frame(now) {
      if (token != null && token !== resultsAnimToken) return;
      const p = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      const v = from + (target - from) * e;
      if (decimals > 0) el.textContent = v.toFixed(decimals);
      else el.textContent = String(Math.round(v));
      if (p < 1) requestAnimationFrame(frame);
    }
    if (reduceMotion()) {
      el.textContent = decimals > 0 ? target.toFixed(decimals) : String(Math.round(target));
      return;
    }
    requestAnimationFrame(frame);
  }

  function hideOverlayPanels() {
    cancelBindListen();
    const pauseEl = $('pause');
    const resultsEl = $('results');
    if (pauseEl) hide(pauseEl);
    if (resultsEl) hide(resultsEl);
    paused = false;
    pausedById = null;
  }

  function isSoloMatch() {
    return roster.length <= 1;
  }

  function pauseDisplayName(id) {
    const p = roster.find(x => x.id === id);
    return (p && p.name) || t('defaultName');
  }

  function updatePauseLabels() {
    const title = $('pauseTitle');
    const hint = $('pauseHint');
    if (!title) return;
    if (paused && pausedById && !isSoloMatch()) {
      title.textContent = t('paused');
      if (hint) {
        hint.hidden = false;
        hint.textContent = t('pausedBy', {name: pauseDisplayName(pausedById)});
      }
    } else {
      title.textContent = t('paused');
      if (hint) {
        hint.hidden = true;
        hint.textContent = '';
      }
    }
  }

  /** Apply pause/resume locally. Network sync is separate via requestMatchPause. */
  function applyMatchPause(on, fromId) {
    if (matchPhase !== 'playing' || ended) return;
    if (on) {
      if (paused) {
        pausedById = fromId || pausedById || myId;
        updatePauseLabels();
        return;
      }
      paused = true;
      pausedById = fromId || myId;
      resetHeldKeys();
      hide($('results'));
      updatePauseLabels();
      const settingsEl = $('settings');
      const settingsOpen = settingsEl && !settingsEl.hidden && settingsFrom === 'pause';
      if (!settingsOpen) show($('pause'));
      sfx('menu');
      return;
    }
    if (!paused) return;
    paused = false;
    pausedById = null;
    hide($('pause'));
    const settingsEl = $('settings');
    if (settingsEl && settingsFrom === 'pause') hide(settingsEl);
    settingsFrom = 'menu';
    updatePauseLabels();
    last = performance.now();
    sfx('menu');
  }

  function requestMatchPause(on) {
    const msg = {t: 'pause', on: !!on, from: myId};
    if (mode === 'host') {
      applyMatchPause(!!on, myId);
      broadcast(msg);
      return;
    }
    if (guestConn) {
      // Optimistic local apply; host echo keeps peers in sync
      applyMatchPause(!!on, myId);
      sendTo(guestConn, msg);
    } else {
      applyMatchPause(!!on, myId);
    }
  }

  function pauseGame() {
    if (matchPhase !== 'playing' || ended) return;
    if (paused) return;
    requestMatchPause(true);
  }

  function resumeGame() {
    if (!paused) return;
    requestMatchPause(false);
  }

  function togglePause() {
    if (paused) resumeGame();
    else pauseGame();
  }

  function quitFromPause() {
    if (paused && matchPhase === 'playing') requestMatchPause(false);
    showMenu();
  }

  function showResults(titleText) {
    const panel = $('results');
    const title = $('resultsTitle');
    const list = $('resultsStats');
    if (!panel || !list) return;
    hide($('pause'));
    if (title) title.textContent = titleText || t('results');
    const board = boards.find(b => b.live) || boardById.get(myId);
    const stats = board && board.getMatchStats ? board.getMatchStats() : null;
    list.innerHTML = '';
    resultsAnimToken++;
    const token = resultsAnimToken;
    const rows = stats ? [
      { key: 'statScore', value: stats.score, kind: 'int' },
      { key: 'statLines', value: stats.lines, kind: 'int' },
      { key: 'statLevel', value: stats.level, kind: 'int' },
      { key: 'statTime', value: formatMatchTime(stats.elapsed), kind: 'text' },
      { key: 'statPps', value: stats.pps, kind: 'float' },
      { key: 'statApm', value: stats.apm, kind: 'float' },
      { key: 'statMaxCombo', value: stats.maxCombo, kind: 'int' },
      { key: 'statTspins', value: stats.tspins, kind: 'int' },
      { key: 'statTetrises', value: stats.tetrises, kind: 'int' },
    ] : [];
    rows.forEach((row, i) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = t(row.key);
      const out = document.createElement('output');
      out.textContent = row.kind === 'text' ? row.value : '0';
      li.append(label, out);
      list.appendChild(li);
      if (row.kind === 'int') {
        animateCountUp(out, row.value, { duration: 550 + i * 40, token });
      } else if (row.kind === 'float') {
        animateCountUp(out, row.value, { duration: 550 + i * 40, decimals: 2, token });
      }
    });
    show(panel);
    updateRematchHint();
  }

  function clearBoards() {
    boards = [];
    boardById.clear();
    boardsEl.innerHTML = '';
    boardsEl.classList.remove('multi');
  }

  function getPlayViewport() {
    const vv = window.visualViewport;
    const vw = (vv && vv.width) || window.innerWidth;
    const vh = (vv && vv.height) || window.innerHeight;
    const narrow = vw < 700;
    // Leave room for fixed title (top) and hint/menu (bottom) so they don't sit on the frame.
    const chromeTop = 52;
    const chromeBot = narrow ? 150 : 120;
    const playH = Math.max(220, vh - chromeTop - chromeBot);
    return {vw, vh, playW: vw, playH, narrow};
  }

  function computePlayfieldSizes(playerCount) {
    const {vw, vh, playW, playH, narrow} = getPlayViewport();
    const availH = playH;
    const availW = playW;
    const n = Math.max(1, playerCount | 0);
    const oppCount = Math.max(0, n - 1);

    // Local well sized for comfortable play on the full-bleed room.
    // Intentionally NOT locked to the tiny painted placeholder grid in the art.
    function sizeLocal() {
      const sideW = narrow ? 58 : 168;
      const COMFORT = 0.9;
      const FRAME = 48; // well-frame + name plaque breathing room
      const byH = (((playH - FRAME) * COMFORT) / ROWS) | 0;
      const byW = (((playW - sideW - 32) * COMFORT) / COLS) | 0;
      return {
        local: Math.max(narrow ? 13 : 18, Math.min(narrow ? 26 : 36, byH, byW)),
        sideW,
      };
    }

    const {local: baseLocal, sideW: youSide} = sizeLocal();

    if (oppCount === 0) {
      return {local: baseLocal, opp: 10, oppRows: 0, oppCols: 0, availH, availW, vh, vw, youSide};
    }

    if (narrow) {
      // Phones: same local size, then clamp only if opps cannot fit underneath.
      const gap = 10;
      const youChrome = 56;
      const oppChrome = 28;
      const oppSide = 36;
      let local = baseLocal;
      const minOppH = oppChrome + ROWS * 7;
      const youH = local * ROWS + youChrome;
      if (availH - youH - gap < minOppH) {
        local = Math.max(13, ((availH - gap - minOppH - youChrome) / ROWS) | 0);
      }
      const remH = Math.max(60, availH - (local * ROWS + youChrome) - gap);
      let opp = Math.max(7, Math.min(11, ((remH - oppChrome) / ROWS) | 0));
      opp = Math.min(opp, Math.max(7, ((availW - oppSide) / COLS) | 0));
      const oppTileW = oppSide + opp * COLS;
      const oppCols = Math.max(1, Math.min(oppCount, ((availW + gap) / (oppTileW + gap)) | 0));
      const oppRows = Math.ceil(oppCount / oppCols);
      return {local, opp, oppRows, oppCols, availH, availW, vh, vw, youSide, oppSide};
    }

    // Desktop multi: local identical to solo; only size opponent tablets.
    const leftCount = Math.floor(oppCount / 2);
    const rightCount = oppCount - leftCount;
    const sideCount = Math.max(1, Math.max(leftCount, rightCount));
    const oppRows = sideCount <= 2 ? 1 : 2;
    const oppCols = Math.ceil(sideCount / oppRows);
    const oppSide = n >= 4 ? 44 : 52;
    const gap = 10;
    const local = baseLocal;

    const localW = youSide + local * COLS;
    const sideBudget = Math.max(72, ((availW - localW) / 2) - 8);
    let opp = Math.max(7, Math.min(12, ((sideBudget - oppSide) / COLS) | 0));
    opp = Math.min(opp, Math.max(7, (local * .42) | 0));

    const oppTileH = opp * ROWS + 34;
    if (oppRows * oppTileH + (oppRows - 1) * gap > availH) {
      opp = Math.max(7, ((availH / oppRows - 34 - gap) / ROWS) | 0);
    }

    return {local, opp, oppRows, oppCols, availH, availW, vh, vw, youSide, oppSide};
  }

  function computeBlockSize(large, playerCount) {
    const sizes = computePlayfieldSizes(playerCount);
    return large ? sizes.local : sizes.opp;
  }

  function setPlayLayout(on) {
    document.body.classList.toggle('in-game', !!on);
  }

  function sizeGameStage(stage, slot) {
    // Full-bleed via CSS (100vw/100dvh) so browser zoom/resize cannot leave a postage stamp.
    slot.style.width = '';
    slot.style.height = '';
    stage.style.width = '';
    stage.style.height = '';
    stage.style.removeProperty('--stage-scale');
  }

  function mountOnGameStage(boardHost, block, parentEl) {
    const slot = document.createElement('div');
    slot.className = 'game-stage-slot';
    const stage = document.createElement('div');
    stage.className = 'game-stage';
    sizeGameStage(stage, slot);
    stage.appendChild(boardHost);
    slot.appendChild(stage);
    (parentEl || boardsEl).appendChild(slot);
    return slot;
  }

  function nextCanvasSize(block, large) {
    const narrow = getPlayViewport().narrow;
    if (large) {
      return Math.max(narrow ? 44 : 64, Math.round(block * (narrow ? 2.2 : 2.8)));
    }
    return Math.max(narrow ? 28 : 36, Math.round(block * (narrow ? 2.6 : 3.2)));
  }

  let playLayoutTimer = 0;
  function layoutPlayfields() {
    if (!document.body.classList.contains('in-game') || !boards.length) return;
    const n = Math.max(1, roster.length || boards.length);
    for (const b of boards) {
      const large = !!b.live;
      const block = computeBlockSize(large, n);
      b.resyncPixels(block, nextCanvasSize(block, large));
    }
  }

  function schedulePlayLayout() {
    if (playLayoutTimer) clearTimeout(playLayoutTimer);
    playLayoutTimer = window.setTimeout(() => {
      playLayoutTimer = 0;
      layoutPlayfields();
      resizeFxLayer();
    }, 80);
  }

  function createBoardSlot(playerId, label, live, large, playerCount, parentEl) {
    const n = Math.max(1, playerCount || roster.length || 1);
    const block = computeBlockSize(!!large, n);
    const cw = COLS * block, ch = ROWS * block;
    const narrow = ((window.visualViewport && window.visualViewport.width) || window.innerWidth) < 700;
    const nw = large
      ? Math.max(narrow ? 44 : 64, Math.round(block * (narrow ? 2.2 : 2.8)))
      : Math.max(narrow ? 28 : 36, Math.round(block * (narrow ? 2.6 : 3.2)));
    const asTable = !!(live && large);
    const box = document.createElement('div');
    box.className = 'player ' + (live ? 'you' : 'opp') + (asTable ? ' board-host' : ' tablet');
    box.dataset.id = playerId;

    const title = document.createElement('h2');
    title.className = asTable ? 'name-plaque' : '';
    title.textContent = label;
    if (!asTable) box.appendChild(title);

    const holdLabel = document.createElement('div');
    holdLabel.className = 'mini-label';
    holdLabel.textContent = t('hold');
    const hold = document.createElement('canvas');
    hold.className = 'hold';
    hold.width = nw;
    hold.height = nw;
    const powerWrap = document.createElement('div');
    powerWrap.className = 'power-wrap';
    powerWrap.hidden = !powerUpsEnabled;
    const powerLabel = document.createElement('div');
    powerLabel.className = 'mini-label';
    powerLabel.textContent = t('relic');
    const powerSlot = document.createElement('div');
    powerSlot.className = 'power-slot';
    powerSlot.textContent = t('powerEmpty');
    powerWrap.append(powerLabel, powerSlot);

    const canvas = document.createElement('canvas');
    canvas.className = 'main';
    canvas.width = cw;
    canvas.height = ch;

    const miniLabel = document.createElement('div');
    miniLabel.className = 'mini-label';
    miniLabel.textContent = t('next');
    const next = document.createElement('canvas');
    next.className = 'next';
    next.width = nw;
    next.height = nw * NEXT_COUNT;
    const score = document.createElement('div');
    score.className = 'score';
    score.textContent = '0';
    const objective = document.createElement('div');
    objective.className = 'mode-objective';
    objective.hidden = true;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = t('meta', {lv: '<span class="lv">1</span>', lines: '<span class="ln">0</span>'});
    const over = document.createElement('div');
    over.className = 'over';

    if (asTable) {
      const table = document.createElement('div');
      table.className = 'board-table';
      table.appendChild(title);

      const shelf = document.createElement('div');
      shelf.className = 'table-shelf';

      const holdAlcove = document.createElement('div');
      holdAlcove.className = 'alcove alcove-hold';
      holdAlcove.append(holdLabel, hold, powerWrap);

      const wellFrame = document.createElement('div');
      wellFrame.className = 'well-frame';
      wellFrame.appendChild(canvas);

      const nextAlcove = document.createElement('div');
      nextAlcove.className = 'alcove alcove-next';
      const plaque = document.createElement('div');
      plaque.className = 'stat-plaque';
      plaque.append(score, objective, meta, over);
      nextAlcove.append(miniLabel, next, plaque);

      shelf.append(holdAlcove, wellFrame, nextAlcove);
      table.appendChild(shelf);
      box.appendChild(table);
    } else {
      const row = document.createElement('div');
      row.className = 'row';
      const holdSide = document.createElement('div');
      holdSide.className = 'side hold-side';
      holdSide.append(holdLabel, hold, powerWrap);
      row.appendChild(canvas);
      const side = document.createElement('div');
      side.className = 'side';
      side.append(miniLabel, next, score, objective, meta, over);
      const hud = document.createElement('div');
      hud.className = 'hud';
      hud.append(holdSide, side);
      row.appendChild(hud);
      box.appendChild(row);
    }

    if (asTable) {
      mountOnGameStage(box, block, parentEl || boardsEl);
    } else {
      (parentEl || boardsEl).appendChild(box);
    }

    const board = new Board({
      canvas, nextCanvas: next, holdCanvas: hold,
      els: {
        root: box,
        score,
        objective,
        level: meta.querySelector('.lv'),
        lines: meta.querySelector('.ln'),
        over,
        title,
        miniLabel,
        holdLabel,
        powerLabel,
        powerSlot,
        powerWrap,
        meta,
      },
      live, block, playerId, nextSize: nw,
    });
    boards.push(board);
    boardById.set(playerId, board);
    if (live) wireBoardSwipe(canvas);
    return board;
  }

  function wireBoardSwipe(canvas) {
    if (!canvas || canvas.dataset.swipeBound) return;
    canvas.dataset.swipeBound = '1';
    let tracking = false;
    let sx = 0, sy = 0, t0 = 0;
    canvas.addEventListener('pointerdown', e => {
      if (!e.isPrimary || matchPhase !== 'playing' || ended || eliminated || paused) return;
      tracking = true;
      sx = e.clientX;
      sy = e.clientY;
      t0 = performance.now();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    });
    const end = e => {
      if (!tracking) return;
      tracking = false;
      if (matchPhase !== 'playing' || ended || eliminated || paused) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const thr = 28;
      if (adx < thr && ady < thr) {
        if (performance.now() - t0 < 280) act('rotCw');
        return;
      }
      if (adx > ady) act(dx < 0 ? 'left' : 'right');
      else if (dy > 0) act(ady > 90 ? 'hard' : 'soft');
      else act('rotCcw');
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', () => { tracking = false; });
  }

  function renderRoster() {
    rosterList.innerHTML = '';
    roster.forEach(p => {
      const li = document.createElement('li');
      if (p.id === myId) li.classList.add('me');
      if (p.ready) li.classList.add('ready');
      const name = document.createElement('span');
      name.textContent = p.name + (p.id === myId ? t('youTag') : '');
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = p.ready ? t('ready') : t('waiting');
      li.append(name, tag);
      rosterList.appendChild(li);
    });
    const n = roster.length;
    const readyN = roster.filter(p => p.ready).length;
    let status;
    if (mode === 'host' && n === 1) {
      status = t('waitingPeers');
    } else {
      status = t('rosterStatus', {n, max: MAX_PLAYERS, ready: readyN});
      if (n < 1) status += t('needTwo');
      else if (readyN < n) status += t('waitReady');
      else status += t('startingSoon');
    }
    $('lobbyStatus').textContent = status;

    const me = roster.find(p => p.id === myId);
    btnReady.textContent = me?.ready ? t('unready') : t('ready');
    btnReady.classList.toggle('ready-on', !!me?.ready);
  }

  function showLobby() {
    clearCountdown();
    hide(menu);
    hide(netPanel);
    if ($('settings')) hide($('settings'));
    hide(gameEl);
    hide(banner);
    setPlayLayout(false);
    gameEl.classList.remove('game-entering');
    show(lobbyEl);
    matchPhase = 'lobby';
    playMode = 'versus';
    $('lobbyCode').textContent = roomCode || '·····';
    lobbyName.value = getPlayerName();
    const lobbyMode = $('lobbyMode');
    if (lobbyMode) {
      lobbyMode.hidden = false;
      lobbyMode.textContent = t('versusLobby');
    }
    if (mode === 'host') {
      show(speedRampRow);
      selSpeedRamp.value = timeRampEnabled ? 'on' : 'off';
      selSpeedRamp.disabled = false;
      show(powerUpsRow);
      selPowerUps.value = powerUpsEnabled ? 'on' : 'off';
      selPowerUps.disabled = false;
      show(dropSpeedRow);
      selDropSpeed.value = DROP_SPEED[dropSpeed] ? dropSpeed : 'normal';
      selDropSpeed.disabled = false;
      show(garbageTargetRow);
      selGarbageTarget.value = GARBAGE_TARGET[garbageTarget] ? garbageTarget : 'clockwise';
      selGarbageTarget.disabled = false;
    } else {
      hide(speedRampRow);
      hide(powerUpsRow);
      hide(dropSpeedRow);
      hide(garbageTargetRow);
      selSpeedRamp.disabled = true;
      selPowerUps.disabled = true;
      selDropSpeed.disabled = true;
      selGarbageTarget.disabled = true;
    }
    renderRoster();
  }

  function showMenu() {
    stopLoop();
    clearCountdown();
    clearPendingStart();
    closeNet();
    running = false;
    ended = false;
    eliminated = false;
    matchPhase = 'idle';
    roster = [];
    clearBoards();
    setPlayLayout(false);
    gameEl.classList.remove('game-entering');
    hide(gameEl);
    hide(netPanel);
    hide(lobbyEl);
    hide(banner);
    hide(btnAgain);
    hideOverlayPanels();
    const settingsEl = $('settings');
    if (settingsEl) hide(settingsEl);
    btnAgain.disabled = false;
    btnAgain.textContent = t('playAgain');
    if (playMode === 'versus' || !SOLO_MODES.includes(playMode)) setPlayMode(loadPlayMode());
    else setPlayMode(playMode);
    show(menu);
    const a = audio();
    if (a) a.stopMusic(350);
  }

  function syncSettingsUI() {
    const rngDas = $('rngDas'), rngArr = $('rngArr'), rngSoft = $('rngSoft');
    const outDas = $('outDas'), outArr = $('outArr'), outSoft = $('outSoft');
    if (rngDas) { rngDas.value = String(DAS_MS); if (outDas) outDas.textContent = String(DAS_MS); }
    if (rngArr) { rngArr.value = String(ARR_MS); if (outArr) outArr.textContent = String(ARR_MS); }
    if (rngSoft) { rngSoft.value = String(SOFT_MS); if (outSoft) outSoft.textContent = String(SOFT_MS); }
    const chkShake = $('chkShake');
    if (chkShake) chkShake.checked = shakeEnabled;
    const chkCb = $('chkColorblind');
    if (chkCb) chkCb.checked = colorblindEnabled;
    setGridOpacity(gridOpacity);
    renderBindList();
    const a = audio();
    if (a) {
      const st = a.getState();
      const pct = (v) => String(Math.round(v * 100));
      if ($('rngMaster')) { $('rngMaster').value = pct(st.master); if ($('outMaster')) $('outMaster').textContent = pct(st.master); }
      if ($('rngMusic')) { $('rngMusic').value = pct(st.music); if ($('outMusic')) $('outMusic').textContent = pct(st.music); }
      if ($('rngSfx')) { $('rngSfx').value = pct(st.sfx); if ($('outSfx')) $('outSfx').textContent = pct(st.sfx); }
    }
    syncMuteBtn();
  }

  function showSettings() {
    settingsFrom = (paused && matchPhase === 'playing') ? 'pause' : 'menu';
    hide(menu);
    hide(netPanel);
    hide(lobbyEl);
    if (settingsFrom === 'pause') hide($('pause'));
    // Stay paused while settings is open mid-match
    if (settingsFrom === 'pause') paused = true;
    syncSettingsUI();
    show($('settings'));
  }

  function leaveSettings() {
    cancelBindListen();
    hide($('settings'));
    if (settingsFrom === 'pause' && matchPhase === 'playing' && !ended) {
      show($('pause'));
      paused = true;
      return;
    }
    showMenu();
  }

  /* ---------- match lifecycle ---------- */
  function clearPendingStart() {
    if (pendingStart && pendingStart.timer) clearTimeout(pendingStart.timer);
    if (pendingStart && pendingStart.leadTimer) clearTimeout(pendingStart.leadTimer);
    pendingStart = null;
    queuedCdBeat = null;
    clearCdReadyWait();
    earlyCdReady.clear();
  }

  function clearCdReadyWait() {
    if (cdReadyWait && cdReadyWait.timer) clearTimeout(cdReadyWait.timer);
    cdReadyWait = null;
  }

  function clearCountdown() {
    if (countdownTimer) {
      clearTimeout(countdownTimer);
      countdownTimer = 0;
    }
    if (countdownEl) {
      countdownEl.hidden = true;
      countdownEl.innerHTML = '';
    }
  }

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function showCountdownBeat(text, go) {
    if (!countdownEl) return;
    countdownEl.hidden = false;
    const num = document.createElement('div');
    num.className = 'countdown-num' + (go ? ' countdown-go' : '');
    num.textContent = text;
    countdownEl.replaceChildren(num);
  }

  function applyCountdownBeat(v) {
    if (v === 'go') {
      showCountdownBeat(t('go'), true);
      sfx('countdown', 'go');
    } else {
      showCountdownBeat(String(v), false);
      sfx('countdown', v);
    }
  }

  function finishCountdownToPlay() {
    clearCountdown();
    beginMatch();
    const mine = boardById.get(myId);
    if (mine) syncState(mine, true);
  }

  function armHostCountdown() {
    if ((mode !== 'host' && mode !== 'solo') || matchPhase !== 'countdown') return;
    const guestIds = mode === 'solo' ? [] : [...connections.keys()];
    if (!guestIds.length) {
      earlyCdReady.clear();
      runHostCountdown();
      return;
    }
    clearCdReadyWait();
    cdReadyWait = {
      expect: new Set(guestIds),
      ready: new Set(),
      timer: setTimeout(() => {
        cdReadyWait = null;
        if (matchPhase === 'countdown') runHostCountdown();
      }, CD_READY_TIMEOUT_MS),
    };
    for (const id of earlyCdReady) {
      if (cdReadyWait.expect.has(id)) cdReadyWait.ready.add(id);
    }
    earlyCdReady.clear();
    if (cdReadyWait.ready.size >= cdReadyWait.expect.size) {
      clearCdReadyWait();
      runHostCountdown();
    }
  }

  function onCdReady(fromId) {
    if (mode !== 'host') return;
    if (!cdReadyWait) {
      earlyCdReady.add(fromId);
      return;
    }
    if (!cdReadyWait.expect.has(fromId)) return;
    cdReadyWait.ready.add(fromId);
    if (cdReadyWait.ready.size >= cdReadyWait.expect.size) {
      clearCdReadyWait();
      if (matchPhase === 'countdown') runHostCountdown();
    }
  }

  // Host owns the beat clock and relays each number so every client advances together.
  // Guests only display `cd` / start on `begin` — they never run their own countdown timers.
  function runHostCountdown() {
    clearCountdown();
    clearCdReadyWait();
    if (!countdownEl) {
      broadcast({t: 'begin'});
      scheduleHostBegin();
      return;
    }
    // Fixed beats in multiplayer so host OS "reduce motion" cannot desync the room.
    const networked = mode === 'host' && connections.size > 0;
    const beat = (!networked && reduceMotion()) ? 420 : 900;
    const goBeat = (!networked && reduceMotion()) ? 380 : 720;
    const beats = ['3', '2', '1', 'go'];
    let i = 0;
    const tick = () => {
      if (matchPhase !== 'countdown') return;
      if (i < beats.length) {
        const v = beats[i++];
        if (networked) broadcast({t: 'cd', v});
        applyCountdownBeat(v);
        countdownTimer = setTimeout(() => {
          countdownTimer = 0;
          tick();
        }, v === 'go' ? goBeat : beat);
        return;
      }
      if (networked) broadcast({t: 'begin'});
      scheduleHostBegin();
    };
    tick();
  }

  function scheduleHostBegin() {
    const delay = (mode === 'host' && connections.size > 0) ? startLeadMs : 0;
    countdownTimer = setTimeout(() => {
      countdownTimer = 0;
      if (matchPhase !== 'countdown') return;
      finishCountdownToPlay();
    }, delay);
  }

  function onCountdownBeat(v) {
    if (v == null) return;
    if (matchPhase !== 'countdown') {
      queuedCdBeat = v;
      return;
    }
    applyCountdownBeat(v);
  }

  function onCountdownBegin() {
    if (matchPhase !== 'countdown' && matchPhase !== 'lobby' && matchPhase !== 'post') return;
    // Late begin: if boards never mounted, ignore (should not happen after `go`)
    if (matchPhase !== 'countdown') return;
    finishCountdownToPlay();
  }

  function beginMatch() {
    ended = false;
    eliminated = false;
    paused = false;
    matchPhase = 'playing';
    running = true;
    resetHeldKeys();
    hide(banner);
    hide(btnAgain);
    hideOverlayPanels();
    gameEl.classList.remove('game-entering');
    btnAgain.disabled = false;
    btnAgain.textContent = t('playAgain');
    roster.forEach(p => { p.ready = false; });
    last = performance.now();
    stopLoop();
    startLoop();
    const a = audio();
    if (a) {
      a.resume().then(() => {
        if (!a.isMuted()) a.startMusic();
        const mine = boardById.get(myId);
        if (mine) updateMusicIntensity(mine);
      });
    }
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (logicTimer) clearInterval(logicTimer);
    logicTimer = 0;
  }

  function startLoop() {
    stopLoop();
    last = performance.now();
    // Logic uses setInterval so gravity continues when the tab/window is unfocused
    // (requestAnimationFrame is paused or heavily throttled in the background).
    logicTimer = setInterval(logicTick, 1000 / 60);
    raf = requestAnimationFrame(drawLoop);
  }

  function logicTick() {
    const now = performance.now();
    let dt = now - last;
    last = now;
    if (!running || matchPhase !== 'playing' || ended) return;
    // Pause freezes gravity/input for everyone (synced over the net in multiplayer).
    if (paused) return;
    // Focused: clamp spikes. Hidden: allow larger dt so throttled timers still catch up.
    const maxDt = document.hidden ? 2000 : 100;
    dt = Math.min(Math.max(0, dt), maxDt);
    if (hitStopLeft > 0) {
      hitStopLeft -= dt;
      return;
    }
    if (!document.hidden && !paused) tickHeldKeys(dt);
    for (const b of boards) if (b.live) b.tick(dt);
    const mine = boards.find(b => b.live);
    if (mine) updateMusicIntensity(mine);
  }

  function drawLoop() {
    const now = performance.now();
    for (const b of boards) b.draw();
    if (document.body.classList.contains('in-game')) applyStagePresentation(now);
    raf = requestAnimationFrame(drawLoop);
  }

  function sendGarbage(from, n) {
    netSend({t: 'garbage', n, from: from.playerId});
  }

  function relicName(kind) {
    if (kind === 'quake') return t('relicQuake');
    if (kind === 'torch') return t('relicTorch');
    if (kind === 'shield') return t('relicShield');
    if (kind === 'curse') return t('relicCurse');
    return kind || t('powerEmpty');
  }

  function powerFxText(kind) {
    if (kind === 'quake') return t('powerQuakeFx');
    if (kind === 'torch') return t('powerTorchFx');
    if (kind === 'shield') return t('powerShieldFx');
    if (kind === 'curse') return t('powerCurseFx');
    return relicName(kind);
  }

  function maybeGrantPowerUp(board, cleared) {
    if (!board || !powerUpsEnabled || board.powerUp) return;
    if (cleared < 2 || board.elapsed < POWER_GRACE_MS) return;
    let chance = POWER_CHANCE[cleared] || POWER_CHANCE[4] || 0;
    if (board.combo >= 3) chance += POWER_COMBO_BONUS;
    if (Math.random() >= chance) return;
    const kind = POWER_KINDS[(Math.random() * POWER_KINDS.length) | 0];
    board.powerUp = kind;
    showBoardToast(board, t('powerGranted', {name: relicName(kind)}), 'power');
  }

  function applyPowerToBoard(board, kind) {
    if (!board || board.over || matchPhase !== 'playing') return;
    if (kind === 'torch') board.applyTorch();
    else if (kind === 'curse') board.applyCurse();
    else if (kind === 'quake') board.applyQuake();
    else if (kind === 'shield') board.applyShield();
  }

  function deliverPower(targetId, fromId, kind) {
    if (targetId === myId) {
      const local = boardById.get(myId);
      applyPowerToBoard(local, kind);
      return;
    }
    const c = connections.get(targetId);
    if (c) sendTo(c, {t: 'powerApply', kind, from: fromId});
  }

  function showPowerFx(targetId, kind) {
    const board = boardById.get(targetId);
    if (!board) return;
    const root = board.els && board.els.root;
    if (root) {
      root.classList.remove('hit-pulse');
      void root.offsetWidth;
      root.classList.add('hit-pulse');
      window.setTimeout(() => root.classList.remove('hit-pulse'), 550);
    }
    const toastKind = kind === 'shield' ? 'shield' : 'power';
    showBoardToast(board, powerFxText(kind), toastKind);
  }

  function fanoutPower(fromId, kind) {
    if (!POWER_KIND[kind]) return;
    if (kind === 'quake' || kind === 'shield') {
      const fx = {t: 'powerFx', kind, from: fromId, to: fromId};
      broadcast(fx);
      showPowerFx(fromId, kind);
      return;
    }
    const targetId = pickGarbageTarget(fromId);
    if (!targetId) return;
    deliverPower(targetId, fromId, kind);
    const fx = {t: 'powerFx', kind, from: fromId, to: targetId};
    broadcast(fx);
    showPowerFx(targetId, kind);
  }

  function syncState(board, force) {
    if (!board.live || matchPhase !== 'playing') return;
    if (!force) {
      syncAcc++;
      if (syncAcc < 3) return;
    }
    syncAcc = 0;
    netSend(board.snapshot());
  }

  function onTopOut(board) {
    if (!board.live || ended) return;
    if (playMode === 'zen') {
      board.over = false;
      board.grid = Array.from({length: ROWS}, () => Array(COLS).fill(null));
      board.gQueue = 0;
      board.clearAnim = null;
      board.rowDrawY = null;
      board.piece = null;
      board.spawn();
      showBoardToast(board, t('zenReset'), 'clear');
      sfx('clear', 1);
      board.paintHud();
      return;
    }
    if (eliminated) return;
    eliminated = true;
    if (board.els.over) board.els.over.textContent = mode === 'solo' ? t('topOut') : t('eliminated');
    markDead(board.playerId);
    if (mode === 'solo') {
      finishSoloRun(false);
      return;
    }
    netSend({t: 'over', from: board.playerId});
    showBanner(t('eliminated'), 'lose');
    sfx('gameover');
    const a = audio();
    if (a) a.stopMusic(600);
  }

  function checkSoloObjectives(board) {
    if (mode !== 'solo' || !board || !board.live || ended || matchPhase !== 'playing') return;
    if (playMode === 'sprint' && board.lines >= SPRINT_LINES) {
      finishSoloRun(true, t('sprintClear'));
      return;
    }
    if (playMode === 'ultra' && board.elapsed >= ULTRA_MS) {
      board.elapsed = ULTRA_MS;
      finishSoloRun(true, t('ultraDone'));
    }
  }

  function finishSoloRun(won, titleOverride) {
    if (ended) return;
    ended = true;
    clearCountdown();
    matchPhase = 'post';
    paused = false;
    pausedById = null;
    hide($('pause'));
    const title = titleOverride || (won ? t('victory') : t('gameOver'));
    showBanner(title, won ? 'win' : 'lose');
    if (won) {
      burstFireworks();
      sfx('win');
    } else {
      sfx('gameover');
    }
    const a = audio();
    if (a) a.stopMusic(700);
    showResults(title);
    showRematchBtn();
  }

  function markDead(id) {
    const p = roster.find(x => x.id === id);
    if (p) p.alive = false;
    const b = boardById.get(id);
    // Keep local "ELIMINATED" label if onTopOut already set it
    if (b && b.els.over && !(b.live && eliminated)) {
      b.els.over.textContent = t('topOut');
    }
  }

  function checkWinner() {
    if (ended) return;
    const alive = roster.filter(p => p.alive);
    if (alive.length > 1) return;
    ended = true;
    clearCountdown();
    matchPhase = 'post';
    paused = false;
    pausedById = null;
    hide($('pause'));
    const winner = alive[0];
    if (winner) {
      broadcastOrLocal({t: 'win', id: winner.id});
      applyWin(winner.id);
    } else {
      const title = roster.length <= 1 ? t('gameOver') : t('draw');
      showBanner(title, 'lose');
      showResults(title);
      showRematchBtn();
      startPostHeartbeat();
    }
  }

  function checkSelfWin() {
    // Safety net: if the authoritative 'win' packet from host is lost or
    // arrives out of order, a client can still notice it's the last one
    // standing from the 'over' broadcasts it already received, and declare
    // its own win rather than sitting stuck in a 'playing' match forever.
    if (ended || matchPhase !== 'playing') return;
    const alive = roster.filter(p => p.alive);
    if (alive.length === 1 && alive[0].id === myId) {
      applyWin(myId);
    }
  }

  function applyWin(winnerId) {
    ended = true;
    clearCountdown();
    matchPhase = 'post';
    paused = false;
    pausedById = null;
    hide($('pause'));
    roster.forEach(p => { p.ready = false; });
    let title;
    if (winnerId === myId) {
      title = t('victory');
      showBanner(title, 'win');
      burstFireworks();
      sfx('win');
    } else {
      const w = roster.find(p => p.id === winnerId);
      title = t('wins', {name: w?.name || t('defaultName')});
      showBanner(title, 'lose');
      sfx('gameover');
    }
    const a = audio();
    if (a) a.stopMusic(700);
    showResults(title);
    showRematchBtn();
    updateRematchHint();
    startPostHeartbeat();
  }

  function showRematchBtn() {
    btnAgain.textContent = t('playAgain');
    btnAgain.disabled = false;
    show(btnAgain);
    const btnResultsAgain = $('btnResultsAgain');
    if (btnResultsAgain) {
      btnResultsAgain.textContent = t('playAgain');
      btnResultsAgain.disabled = false;
    }
  }

  function showBanner(text, cls) {
    banner.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = text;
    banner.appendChild(title);
    const hint = document.createElement('div');
    hint.id = 'rematchHint';
    hint.className = 'rematch-hint';
    banner.appendChild(hint);
    banner.className = cls;
    banner.hidden = true;
    void banner.offsetWidth;
    show(banner);
  }

  function updateRematchHint() {
    const readyN = roster.filter(p => p.ready).length;
    const n = roster.length;
    let text;
    if (n && readyN >= n) text = t('rematchStart');
    else if (roster.find(p => p.id === myId)?.ready) text = t('rematchWait', {ready: readyN, n});
    else if (readyN) text = t('rematchPartial', {ready: readyN, n});
    else text = t('rematchAll');
    const hint = $('rematchHint');
    if (hint) hint.textContent = text;
    const resultsHint = $('resultsHint');
    if (resultsHint) resultsHint.textContent = text;
  }

  function rematch() {
    if (mode === 'solo') {
      if (matchPhase !== 'post' && !ended) return;
      hide(banner);
      hide(btnAgain);
      hideOverlayPanels();
      startSoloMatch(playMode);
      return;
    }
    if (matchPhase !== 'post' && !ended) return;
    const me = roster.find(p => p.id === myId);
    if (!me || me.ready) return;
    me.ready = true;
    btnAgain.disabled = true;
    btnAgain.textContent = t('ready');
    const btnResultsAgain = $('btnResultsAgain');
    if (btnResultsAgain) {
      btnResultsAgain.disabled = true;
      btnResultsAgain.textContent = t('ready');
    }
    netSend({t: 'rematch', from: myId});
    updateRematchHint();
    if (mode === 'host') {
      broadcastRoster();
      tryHostStart();
    }
  }

  /* ---------- networking ---------- */
  function makeCode() {
    let s = '';
    for (let i = 0; i < 5; i++) s += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
    return s;
  }

  function clearMigrateTimer() {
    if (migrateTimer) {
      clearTimeout(migrateTimer);
      migrateTimer = null;
    }
  }

  function touchPostSeen(id) {
    if (matchPhase !== 'post' || !id) return;
    postLastSeen.set(id, performance.now());
  }

  function stopPostHeartbeat() {
    if (postHbTimer) {
      clearInterval(postHbTimer);
      postHbTimer = 0;
    }
    postLastSeen.clear();
  }

  function startPostHeartbeat() {
    stopPostHeartbeat();
    if (matchPhase !== 'post' || !mode) return;
    const now = performance.now();
    roster.forEach(p => postLastSeen.set(p.id, now));
    if (hostPlayerId) postLastSeen.set(hostPlayerId, now);
    if (myId) postLastSeen.set(myId, now);
    postHbTimer = setInterval(tickPostHeartbeat, POST_HB_MS);
  }

  function removePostPeer(peerId) {
    if (matchPhase !== 'post' || mode !== 'host' || !peerId || peerId === myId) return false;
    if (!roster.some(p => p.id === peerId)) return false;
    connections.delete(peerId);
    postLastSeen.delete(peerId);
    roster = roster.filter(p => p.id !== peerId);
    broadcastRoster();
    tryHostStart();
    return true;
  }

  function tickPostHeartbeat() {
    if (matchPhase !== 'post') {
      stopPostHeartbeat();
      return;
    }
    const now = performance.now();
    if (mode === 'host') {
      broadcast({t: 'ping'});
      const stale = [];
      for (const p of roster) {
        if (p.id === myId) continue;
        const seen = postLastSeen.get(p.id);
        if (seen == null || now - seen > POST_HB_TIMEOUT_MS) stale.push(p.id);
      }
      for (const id of stale) {
        try { connections.get(id)?.close(); } catch (_) {}
        removePostPeer(id);
      }
    } else if (mode === 'guest') {
      if (guestConn) sendTo(guestConn, {t: 'ping', from: myId});
      const hostId = hostPlayerId;
      if (!hostId || migratePhase) return;
      const seen = postLastSeen.get(hostId);
      if (seen == null || now - seen > POST_HB_TIMEOUT_MS) handleHostLost();
    }
  }

  function closeNet() {
    clearMigrateTimer();
    stopPostHeartbeat();
    suppressNetClose = true;
    connections.forEach(c => { try { c.close(); } catch (_) {} });
    connections.clear();
    try { guestConn?.close(); } catch (_) {}
    try { peer?.destroy(); } catch (_) {}
    guestConn = null;
    peer = null;
    roomCode = '';
    myId = null;
    hostPlayerId = null;
    migratePhase = null;
    migrateAttempt = 0;
    suppressNetClose = false;
  }

  function migrationFailed() {
    clearMigrateTimer();
    migratePhase = null;
    migrateAttempt = 0;
    if (matchPhase === 'lobby') {
      $('lobbyStatus').textContent = t('disconnected');
      hide(lobbyEl);
      showMenu();
    } else if (matchPhase === 'post') {
      $('ctrlHint').textContent = t('disconnected');
      showMenu();
    }
  }

  function canMigratePhase() {
    return matchPhase === 'lobby' || matchPhase === 'post';
  }

  function handleHostLost() {
    if (suppressNetClose || mode !== 'guest') return;
    if (!canMigratePhase()) {
      $('ctrlHint').textContent = t('disconnected');
      return;
    }
    if (migratePhase === 'taking' || migratePhase === 'reconnecting') return;

    // Detach so late close/error on the old host link cannot re-enter migration
    guestConn = null;

    const departed = hostPlayerId;
    roster = roster.filter(p => p.id !== departed);
    roster.forEach(p => { p.ready = false; });
    if (!roster.length || !roster.some(p => p.id === myId)) {
      migrationFailed();
      return;
    }
    const successorId = roster[0].id;
    hostPlayerId = successorId;
    if (matchPhase === 'lobby') renderRoster();
    else updateRematchHint();
    if (myId === successorId) {
      migratePhase = 'taking';
      if (matchPhase === 'lobby') $('lobbyStatus').textContent = t('takingHost');
      becomeRelayHost(0);
    } else {
      migratePhase = 'reconnecting';
      migrateAttempt = 0;
      if (matchPhase === 'lobby') $('lobbyStatus').textContent = t('reconnecting');
      scheduleGuestReconnect(0);
    }
  }

  function acceptHostConnection(c) {
    if (matchPhase === 'lobby' || matchPhase === 'post') {
      wireHostConn(c);
      return;
    }
    c.on('open', () => {
      sendTo(c, {t: 'reject', reason: 'match_started'});
      c.close();
    });
  }

  function becomeRelayHost(attempt) {
    clearMigrateTimer();
    suppressNetClose = true;
    try { guestConn?.close(); } catch (_) {}
    guestConn = null;
    suppressNetClose = false;

    if (!peer || peer.destroyed) {
      migrationFailed();
      return;
    }

    mode = 'host';
    hostPlayerId = myId;
    connections.clear();
    migratePhase = null;
    migrateAttempt = 0;

    // Keep this peer (player id). Guests reconnect to myId — no room-code reclaim race.
    if (!peer._trisimoHostListen) {
      peer._trisimoHostListen = true;
      peer.on('connection', acceptHostConnection);
    }

    if (matchPhase === 'lobby') {
      showLobby();
      $('lobbyStatus').textContent = '';
      renderRoster();
    } else if (matchPhase === 'post') {
      updateRematchHint();
      startPostHeartbeat();
    }
  }

  function scheduleGuestReconnect(attempt) {
    clearMigrateTimer();
    migrateAttempt = attempt;
    if (attempt > 16) {
      migrationFailed();
      return;
    }
    const targetId = hostPlayerId;
    if (!targetId || targetId === myId) {
      migrationFailed();
      return;
    }
    if (matchPhase === 'lobby') $('lobbyStatus').textContent = t('reconnecting');
    migrateTimer = setTimeout(() => {
      migrateTimer = null;
      if (mode !== 'guest' || !canMigratePhase()) return;
      if (!peer || peer.destroyed) {
        migrationFailed();
        return;
      }
      suppressNetClose = true;
      try { guestConn?.close(); } catch (_) {}
      guestConn = null;
      suppressNetClose = false;
      wireGuestConn(peer.connect(targetId, {reliable: true}));
    }, 300 + attempt * 200);
  }

  function sendTo(conn, msg) {
    if (conn && conn.open) {
      try { conn.send(msg); } catch (_) {}
    }
  }

  function broadcast(msg, exceptId) {
    connections.forEach((c, id) => {
      if (id !== exceptId) sendTo(c, msg);
    });
  }

  function broadcastOrLocal(msg) {
    if (mode === 'host') broadcast(msg);
  }

  function netSend(msg) {
    if (mode === 'host') {
      if (msg.t === 'state') {
        broadcast(msg);
        return;
      }
      if (msg.t === 'garbage') {
        fanoutGarbage(msg.from, msg.n);
        return;
      }
      if (msg.t === 'power') {
        fanoutPower(msg.from, msg.kind);
        return;
      }
      if (msg.t === 'over') {
        handleOver(msg.from);
        return;
      }
      if (msg.t === 'pause') {
        broadcast(msg);
        return;
      }
      if (msg.t === 'rematch') {
        // host already set local ready in rematch()
        return;
      }
    } else if (guestConn) {
      sendTo(guestConn, msg);
    }
  }

  function nextAliveTargetId(fromId) {
    const ids = roster.map(p => p.id);
    const n = ids.length;
    if (!n) return null;
    const idx = ids.indexOf(fromId);
    if (idx === -1) return null;
    for (let i = 1; i <= n; i++) {
      const cand = ids[(idx + i) % n];
      if (cand === fromId) continue;
      const p = roster.find(x => x.id === cand);
      if (p && p.alive !== false) return cand;
    }
    return null;
  }

  function aliveOpponentIds(fromId) {
    return roster.filter(p => p.id !== fromId && p.alive !== false).map(p => p.id);
  }

  function neighborTargetIds(fromId) {
    const ids = roster.map(p => p.id);
    const n = ids.length;
    const idx = ids.indexOf(fromId);
    if (idx === -1 || !n) return [];
    const found = [];
    for (let i = 1; i < n; i++) {
      const cand = ids[(idx + i) % n];
      if (cand === fromId) continue;
      const p = roster.find(x => x.id === cand);
      if (p && p.alive !== false) {
        found.push(cand);
        break;
      }
    }
    for (let i = 1; i < n; i++) {
      const cand = ids[(idx - i + n) % n];
      if (cand === fromId) continue;
      const p = roster.find(x => x.id === cand);
      if (p && p.alive !== false) {
        if (!found.includes(cand)) found.push(cand);
        break;
      }
    }
    return found;
  }

  function pickGarbageTarget(fromId) {
    if (garbageTarget === 'random') {
      const opps = aliveOpponentIds(fromId);
      if (!opps.length) return null;
      return opps[(Math.random() * opps.length) | 0];
    }
    if (garbageTarget === 'neighbors') {
      let pool = neighborTargetIds(fromId);
      if (!pool.length) pool = aliveOpponentIds(fromId);
      if (!pool.length) return null;
      return pool[(Math.random() * pool.length) | 0];
    }
    return nextAliveTargetId(fromId);
  }

  function showBoardToast(board, text, kind) {
    if (!flashyEnabled) return;
    const root = board && board.els && board.els.root;
    if (!root || !text) return;
    const el = document.createElement('div');
    el.className = 'fx-toast' + (kind ? ' ' + kind : '');
    el.textContent = text;
    root.appendChild(el);
    window.setTimeout(() => el.remove(), 1000);
  }

  /* ---------- particle FX (confetti / glitter / fireworks) ---------- */
  const fxCanvas = document.getElementById('fxLayer');
  const fxCtx = fxCanvas ? fxCanvas.getContext('2d', { alpha: true }) : null;
  let fxParticles = [];
  let fxRaf = 0;
  let fxLast = 0;

  function resizeFxLayer() {
    if (!fxCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    fxCanvas.width = Math.max(1, (w * dpr) | 0);
    fxCanvas.height = Math.max(1, (h * dpr) | 0);
    fxCanvas.style.width = w + 'px';
    fxCanvas.style.height = h + 'px';
    if (fxCtx) {
      fxCtx.setTransform(1, 0, 0, 1, 0, 0);
      fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
      fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function setFxLayerVisible(on) {
    if (fxCanvas) fxCanvas.style.visibility = on ? 'visible' : 'hidden';
  }

  function clearFxParticles() {
    fxParticles = [];
    if (fxRaf) {
      cancelAnimationFrame(fxRaf);
      fxRaf = 0;
    }
    if (fxCtx && fxCanvas) {
      fxCtx.setTransform(1, 0, 0, 1, 0, 0);
      fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
      resizeFxLayer();
    }
    setFxLayerVisible(false);
  }

  function boardOrigin(board) {
    const root = board && board.els && board.els.root;
    if (root) {
      const r = root.getBoundingClientRect();
      return {x: r.left + r.width / 2, y: r.top + r.height * 0.42};
    }
    return {x: window.innerWidth / 2, y: window.innerHeight * 0.4};
  }

  function boardCellScreen(board, col, row) {
    const canvas = board && board.ctx && board.ctx.canvas;
    if (!canvas) return boardOrigin(board);
    const r = canvas.getBoundingClientRect();
    const s = r.width / COLS;
    return {x: r.left + (col + 0.5) * s, y: r.top + (row + 0.5) * s};
  }

  function burstDust(x, y, count, color) {
    spawnBurst(x, y, count, () => {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const spd = 0.7 + Math.random() * 2.8;
      return {
        kind: 'dust',
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.45 - Math.random(),
        g: 0.1,
        life: 0.3 + Math.random() * 0.35,
        max: 0,
        size: 1.4 + Math.random() * 2.2,
        color: color || '#c8b890',
      };
    });
  }

  function fxForHardDrop(board, dist) {
    if (!fxMotionOk() || !fxCtx || !board.piece) return;
    const cells = [];
    const {m, x, y, type} = board.piece;
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) {
      if (!m[r][c]) continue;
      const gy = y + r;
      if (gy >= 0) cells.push({x: x + c, y: gy});
    }
    const color = (SHAPES[type] && SHAPES[type].color) || '#c9a227';
    // Light ash puff only — no shake/embers on every drop (that felt laggy)
    cells.forEach(cell => {
      const p = boardCellScreen(board, cell.x, cell.y);
      burstDust(p.x, p.y, Math.min(5, 2 + (dist / 6) | 0), color);
    });
    if (dist >= 14) triggerShake(2);
  }

  function fxForLock(board, cells) {
    if (!fxMotionOk() || !fxCtx || !cells || !cells.length) return;
    // One soft puff at the piece centroid
    let sx = 0, sy = 0;
    cells.forEach(c => { sx += c.x; sy += c.y; });
    const p = boardCellScreen(board, sx / cells.length, sy / cells.length);
    burstDust(p.x, p.y, 3, '#d8c8a0');
  }

  function pushParticle(p) {
    fxParticles.push(p);
    setFxLayerVisible(true);
    if (!fxRaf) {
      fxLast = performance.now();
      fxRaf = requestAnimationFrame(tickFx);
    }
  }

  function spawnBurst(x, y, count, make) {
    for (let i = 0; i < count; i++) pushParticle(make(i));
  }

  // Brass / ember shard burst — replaces cheap multicolor confetti
  const SHARD_COLORS = ['#f0e0a0', '#d4af37', '#c9a227', '#e8c76a', '#a8841a', '#e8a060', '#f5d080'];
  function burstShards(x, y, count) {
    spawnBurst(x, y, count, () => {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.35;
      const spd = 2.4 + Math.random() * 5.5;
      const len = 5 + Math.random() * 9;
      return {
        kind: 'shard',
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - (1.5 + Math.random() * 2.5),
        g: 0.14 + Math.random() * 0.08,
        life: 0.55 + Math.random() * 0.55,
        max: 0,
        rot: ang + Math.PI / 2,
        spin: (Math.random() - 0.5) * 0.22,
        w: len,
        h: 1.1 + Math.random() * 1.6,
        color: SHARD_COLORS[(Math.random() * SHARD_COLORS.length) | 0],
        glow: true,
      };
    });
  }

  // Legacy name kept for fireworks call sites
  function burstConfetti(x, y, count) {
    burstShards(x, y, count);
  }

  function burstGlitter(x, y, count) {
    spawnBurst(x, y, count, () => {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const spd = 1.5 + Math.random() * 5;
      return {
        kind: 'spark',
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 16,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        g: 0.04,
        life: 0.45 + Math.random() * 0.55,
        max: 0,
        size: 1.2 + Math.random() * 2.4,
        color: Math.random() > 0.35 ? '#f0e0a0' : '#d4af37',
      };
    });
  }

  function burstEmbers(x, y, count) {
    spawnBurst(x, y, count, () => {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const spd = 1 + Math.random() * 4.5;
      return {
        kind: 'ember',
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1,
        g: 0.12,
        life: 0.35 + Math.random() * 0.45,
        max: 0,
        size: 1.5 + Math.random() * 2.5,
        color: Math.random() > 0.5 ? '#e06060' : '#c9a227',
      };
    });
  }

  function burstFirework(x, y) {
    const ring = 28 + ((Math.random() * 12) | 0);
    spawnBurst(x, y, ring, (i) => {
      const ang = (i / ring) * Math.PI * 2 + Math.random() * 0.06;
      const spd = 2.8 + Math.random() * 3.8;
      return {
        kind: 'ember',
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        g: 0.05,
        life: 0.55 + Math.random() * 0.45,
        max: 0,
        size: 1.4 + Math.random() * 1.8,
        color: SHARD_COLORS[(Math.random() * SHARD_COLORS.length) | 0],
        trail: true,
      };
    });
    burstGlitter(x, y, 14);
    burstShards(x, y, 16);
  }

  function burstFireworks() {
    if (!flashyEnabled || !fxCtx) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.38;
    burstFirework(cx, cy);
    window.setTimeout(() => burstFirework(cx - 90, cy + 30), 160);
    window.setTimeout(() => burstFirework(cx + 95, cy + 20), 280);
    window.setTimeout(() => burstShards(cx, cy, 28), 200);
  }

  function fxForClear(board, cleared, tSpin) {
    if (!flashyEnabled || !fxCtx) return;
    const o = boardOrigin(board);
    // Tight ash + brass — no rainbow confetti spam
    const dustN = cleared >= 4 ? 28 : cleared >= 3 ? 18 : cleared >= 2 ? 12 : 8;
    burstDust(o.x, o.y, dustN, '#d4af37');
    if (cleared >= 4 || tSpin >= 2) {
      burstShards(o.x, o.y, tSpin ? 42 : 34);
      burstGlitter(o.x, o.y, 28);
      burstEmbers(o.x, o.y, tSpin ? 18 : 12);
    } else if (cleared >= 3 || tSpin === 1) {
      burstShards(o.x, o.y, 22);
      burstGlitter(o.x, o.y, 18);
      burstEmbers(o.x, o.y, 8);
    } else if (cleared >= 2) {
      burstShards(o.x, o.y, 12);
      burstGlitter(o.x, o.y, 14);
    } else if (cleared >= 1) {
      burstGlitter(o.x, o.y, 10);
    }
    if (board.combo >= 5) {
      burstGlitter(o.x, o.y - 10, 22);
      burstShards(o.x, o.y, 10);
    } else if (board.combo >= 3) {
      burstGlitter(o.x, o.y - 8, 14);
    }
  }

  function fxForHit(board) {
    if (!flashyEnabled || !fxCtx) return;
    const o = boardOrigin(board);
    burstEmbers(o.x, o.y, 22);
  }

  function tickFx(now) {
    fxRaf = 0;
    if (!fxCtx || !fxCanvas) return;
    const dt = Math.min(0.033, (now - fxLast) / 1000);
    fxLast = now;
    fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const next = [];
    for (let i = 0; i < fxParticles.length; i++) {
      const p = fxParticles[i];
      if (!p.max) p.max = p.life;
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      if (p.spin) p.rot += p.spin;
      p.vx *= 0.992;
      const a = Math.max(0, Math.min(1, p.life / (p.max * 0.55)));
      fxCtx.globalAlpha = a;
      fxCtx.fillStyle = p.color;
      if (p.kind === 'shard' || p.kind === 'rect') {
        fxCtx.save();
        fxCtx.translate(p.x, p.y);
        fxCtx.rotate(p.rot || 0);
        if (p.glow) {
          fxCtx.globalAlpha = a * 0.22;
          fxCtx.fillStyle = p.color;
          fxCtx.beginPath();
          fxCtx.ellipse(0, 0, p.w * 0.7, p.h * 2.2, 0, 0, Math.PI * 2);
          fxCtx.fill();
          fxCtx.globalAlpha = a;
        }
        // Thin diamond shard (brass flake)
        fxCtx.beginPath();
        fxCtx.moveTo(0, -p.w / 2);
        fxCtx.lineTo(p.h / 2, 0);
        fxCtx.lineTo(0, p.w / 2);
        fxCtx.lineTo(-p.h / 2, 0);
        fxCtx.closePath();
        fxCtx.fill();
        fxCtx.globalAlpha = a * 0.55;
        fxCtx.fillStyle = '#fff6d0';
        fxCtx.beginPath();
        fxCtx.moveTo(0, -p.w / 2);
        fxCtx.lineTo(p.h * 0.2, -p.w * 0.15);
        fxCtx.lineTo(0, p.w * 0.1);
        fxCtx.closePath();
        fxCtx.fill();
        fxCtx.restore();
      } else if (p.kind === 'spark' || p.kind === 'dust') {
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        fxCtx.fill();
        if (p.kind === 'spark') {
          fxCtx.globalAlpha = a * 0.3;
          fxCtx.beginPath();
          fxCtx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
          fxCtx.fill();
        }
      } else {
        if (p.trail) {
          fxCtx.globalAlpha = a * 0.3;
          fxCtx.beginPath();
          fxCtx.arc(p.x - p.vx * 1.4, p.y - p.vy * 1.4, p.size * 0.7, 0, Math.PI * 2);
          fxCtx.fill();
          fxCtx.globalAlpha = a;
        }
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        fxCtx.fill();
      }
      next.push(p);
    }
    fxCtx.globalAlpha = 1;
    fxParticles = next;
    if (fxParticles.length) fxRaf = requestAnimationFrame(tickFx);
    else setFxLayerVisible(false);
  }

  resizeFxLayer();
  setFxLayerVisible(false);
  window.addEventListener('resize', () => {
    resizeFxLayer();
    schedulePlayLayout();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', schedulePlayLayout);
  }

  function showClearFx(board, cleared, tSpin, b2bAwarded) {
    if (!flashyEnabled) return;
    let label = '';
    let kind = '';
    if (tSpin === 2) {
      label = cleared >= 3 ? t('tspinTriple') : cleared === 2 ? t('tspinDouble') : cleared === 1 ? t('tspinSingle') : t('tspin');
      kind = 'tetris';
    } else if (tSpin === 1) {
      label = cleared ? t('tspinMiniClear') : t('tspinMini');
      kind = 'triple';
    } else {
      const keys = ['', 'clearSingle', 'clearDouble', 'clearTriple', 'clearTetris'];
      label = keys[cleared] ? t(keys[cleared]) : '';
      kind = cleared >= 4 ? 'tetris' : (cleared >= 3 ? 'triple' : '');
    }
    if (label) {
      if (b2bAwarded) showBoardToast(board, t('b2b') + ' ' + label, kind || 'tetris');
      else showBoardToast(board, label, kind);
    }
    if (board.combo >= 2) {
      window.setTimeout(() => {
        if (flashyEnabled) showBoardToast(board, t('comboN', {n: board.combo}), 'combo');
      }, 120);
    }
    fxForClear(board, cleared, tSpin || 0);
  }

  function showHitFx(toId, n) {
    const board = boardById.get(toId);
    if (!board || !board.els || !board.els.root) return;
    const root = board.els.root;
    root.classList.remove('hit-pulse');
    void root.offsetWidth;
    root.classList.add('hit-pulse');
    window.setTimeout(() => root.classList.remove('hit-pulse'), 550);
    if (!flashyEnabled) return;
    showBoardToast(board, t('hitFx', {n}), 'hit');
    fxForHit(board);
  }

  function deliverGarbage(targetId, fromId, n) {
    if (targetId === myId) {
      const local = boardById.get(myId);
      if (local && !local.over && matchPhase === 'playing') local.addGarbage(n);
      return;
    }
    const c = connections.get(targetId);
    if (c) sendTo(c, {t: 'garbage', n, from: fromId});
  }

  function fanoutGarbage(fromId, n) {
    const targetId = pickGarbageTarget(fromId);
    if (!targetId) return;
    deliverGarbage(targetId, fromId, n);
    const hit = {t: 'hit', from: fromId, to: targetId, n};
    broadcast(hit);
    showHitFx(targetId, n);
  }

  function handleOver(fromId) {
    markDead(fromId);
    broadcast({t: 'over', from: fromId}, fromId);
    checkWinner();
  }

  function broadcastRoster() {
    const payload = {t: 'roster', players: roster.map(p => ({id: p.id, name: p.name, ready: !!p.ready, alive: p.alive !== false}))};
    broadcast(payload);
    renderRoster();
    if (matchPhase === 'post') updateRematchHint();
  }

  function tryHostStart() {
    if (mode !== 'host') return;
    if (matchPhase !== 'lobby' && matchPhase !== 'post') return;
    if (pendingStart) return;
    if (roster.length < 1) return;
    if (!roster.every(p => p.ready)) return;
    const ids = roster.map(p => p.id);
    const players = ids.map(id => {
      const p = roster.find(x => x.id === id);
      return {id, name: p.name};
    });
    const guestIds = ids.filter(id => id !== myId);
    broadcast({t: 'start', speedRamp: timeRampEnabled, dropSpeed, garbageTarget, powerUps: powerUpsEnabled, players});
    // Solo host: no peers to sync with.
    if (!guestIds.length) {
      startRemoteMatch(players);
      return;
    }
    pendingStart = {
      players,
      expect: new Set(guestIds),
      acks: new Set(),
      sentAt: performance.now(),
      maxRtt: 0,
      timer: setTimeout(() => finishHostStart(), START_ACK_TIMEOUT_MS),
      leadTimer: 0,
    };
  }

  function onStartAck(fromId) {
    if (mode !== 'host' || !pendingStart || !pendingStart.expect) return;
    if (!pendingStart.expect.has(fromId) || pendingStart.acks.has(fromId)) return;
    pendingStart.acks.add(fromId);
    const rtt = performance.now() - pendingStart.sentAt;
    if (rtt > pendingStart.maxRtt) pendingStart.maxRtt = rtt;
    if (pendingStart.acks.size >= pendingStart.expect.size) finishHostStart();
  }

  function finishHostStart() {
    if (mode !== 'host' || !pendingStart || !pendingStart.expect || pendingStart.goSent) return;
    pendingStart.goSent = true;
    const { players, maxRtt, timer } = pendingStart;
    if (timer) clearTimeout(timer);
    pendingStart.timer = 0;
    // Compensate one-way latency of the `go` packet using measured start→ack RTT.
    const lead = Math.min(START_LEAD_MAX_MS, Math.max(START_LEAD_MIN_MS, maxRtt / 2 || START_LEAD_MIN_MS));
    startLeadMs = lead;
    broadcast({t: 'go'});
    pendingStart.leadTimer = setTimeout(() => {
      pendingStart = null;
      startRemoteMatch(players);
    }, lead);
  }

  function dropPendingStartPeer(peerId) {
    if (!pendingStart || !pendingStart.expect) return;
    pendingStart.expect.delete(peerId);
    pendingStart.acks.delete(peerId);
    pendingStart.players = pendingStart.players.filter(p => p.id !== peerId);
    if (!pendingStart.expect.size || pendingStart.acks.size >= pendingStart.expect.size) {
      finishHostStart();
    }
  }

  function dropCdReadyPeer(peerId) {
    if (!cdReadyWait) return;
    cdReadyWait.expect.delete(peerId);
    cdReadyWait.ready.delete(peerId);
    if (!cdReadyWait.expect.size || cdReadyWait.ready.size >= cdReadyWait.expect.size) {
      clearCdReadyWait();
      if (matchPhase === 'countdown') runHostCountdown();
    }
  }

  function startRemoteMatch(players) {
    const mount = () => {
      hide(lobbyEl);
      hide(netPanel);
      lobbyEl.classList.remove('panel-exit');
      show(gameEl);
      setPlayLayout(true);
      gameEl.classList.add('game-entering');
      $('padTag0').textContent = getPlayerName();
      $('ctrlHint').textContent = t('ctrlHint');
      clearBoards();
      const n = players.length;
      const me = players.find(p => p.id === myId);
      const others = players.filter(p => p.id !== myId);

      // Local board always sits in the center column; opponents fill side rails
      // so extra players never shift your well off the room's middle.
      if (others.length) {
        boardsEl.classList.add('multi');
        const left = document.createElement('div');
        left.className = 'opps opps-left';
        const right = document.createElement('div');
        right.className = 'opps opps-right';
        const mid = Math.floor(others.length / 2);
        const leftPlayers = others.slice(0, mid);
        const rightPlayers = others.slice(mid);
        boardsEl.appendChild(left);
        if (me) createBoardSlot(me.id, me.name, true, true, n, boardsEl);
        boardsEl.appendChild(right);
        leftPlayers.forEach(p => createBoardSlot(p.id, p.name, false, false, n, left));
        rightPlayers.forEach(p => createBoardSlot(p.id, p.name, false, false, n, right));
      } else if (me) {
        createBoardSlot(me.id, me.name, true, true, n, boardsEl);
      }

      roster = players.map(p => ({id: p.id, name: p.name, ready: false, alive: true}));
      matchPhase = 'countdown';
      stopPostHeartbeat();
      hide(banner);
      hide(btnAgain);
      for (const b of boards) b.draw();
      if (mode === 'host' || mode === 'solo') {
        armHostCountdown();
      } else {
        netSend({t: 'cdReady'});
        if (queuedCdBeat != null) {
          applyCountdownBeat(queuedCdBeat);
          queuedCdBeat = null;
        }
      }
    };

    const syncMount = mode === 'guest' || (mode === 'host' && connections.size > 0);
    if (!lobbyEl.hidden && (syncMount || !reduceMotion())) {
      if (!reduceMotion()) lobbyEl.classList.add('panel-exit');
      // Same mount delay for every peer so the host does not start counting during guest lobby exit.
      window.setTimeout(mount, 380);
    } else {
      mount();
    }
  }

  function onHostData(fromId, data) {
    if (!data || typeof data !== 'object') return;
    if (data.t === 'ping') {
      touchPostSeen(fromId);
      return;
    }
    if (matchPhase === 'post') touchPostSeen(fromId);
    if (data.t === 'hello') {
      if (pendingStart || matchPhase === 'playing' || matchPhase === 'countdown' || (matchPhase !== 'lobby' && matchPhase !== 'post')) {
        sendTo(connections.get(fromId), {t: 'reject', reason: 'match_started'});
        connections.get(fromId)?.close();
        connections.delete(fromId);
        return;
      }
      const existing = roster.find(p => p.id === fromId);
      if (!existing) {
        if (matchPhase !== 'lobby' || pendingStart) {
          sendTo(connections.get(fromId), {t: 'reject', reason: 'match_started'});
          connections.get(fromId)?.close();
          connections.delete(fromId);
          return;
        }
        if (roster.length >= MAX_PLAYERS) {
          sendTo(connections.get(fromId), {t: 'reject', reason: 'room_full'});
          connections.get(fromId)?.close();
          connections.delete(fromId);
          return;
        }
        roster.push({
          id: fromId,
          name: sanitizeName(data.name),
          ready: false,
          alive: true,
        });
        roster.forEach(p => { p.ready = false; });
        if ($('lobbyStatus')) {
          $('lobbyStatus').textContent = t('peerJoined', {name: sanitizeName(data.name)});
        }
      }
      sendTo(connections.get(fromId), {t: 'welcome', id: fromId, code: roomCode, hostId: myId});
      broadcastRoster();
      return;
    }
    if (data.t === 'name') {
      const p = roster.find(x => x.id === fromId);
      if (!p || matchPhase !== 'lobby') return;
      p.name = sanitizeName(data.name);
      p.ready = false;
      broadcastRoster();
      return;
    }
    if (data.t === 'startAck') {
      onStartAck(fromId);
      return;
    }
    if (data.t === 'cdReady') {
      onCdReady(fromId);
      return;
    }
    if (data.t === 'ready') {
      const p = roster.find(x => x.id === fromId);
      if (!p) return;
      p.ready = !!data.ready;
      broadcastRoster();
      tryHostStart();
      return;
    }
    if (data.t === 'state') {
      const b = boardById.get(fromId);
      if (b && !b.live) b.applyRemote(data);
      broadcast({...data, from: fromId}, fromId);
      return;
    }
    if (data.t === 'garbage') {
      fanoutGarbage(fromId, data.n);
      return;
    }
    if (data.t === 'power') {
      fanoutPower(fromId, data.kind);
      return;
    }
    if (data.t === 'over') {
      handleOver(fromId);
      return;
    }
    if (data.t === 'pause') {
      applyMatchPause(!!data.on, data.from || fromId);
      broadcast({t: 'pause', on: !!data.on, from: data.from || fromId}, fromId);
      return;
    }
    if (data.t === 'rematch') {
      const p = roster.find(x => x.id === fromId);
      if (p) p.ready = true;
      broadcastRoster();
      tryHostStart();
    }
  }

  function onGuestData(data) {
    if (!data || typeof data !== 'object') return;
    if (data.t === 'ping') {
      touchPostSeen(hostPlayerId);
      return;
    }
    if (matchPhase === 'post') touchPostSeen(hostPlayerId);
    if (data.t === 'reject') {
      if (migratePhase === 'reconnecting') {
        scheduleGuestReconnect(migrateAttempt + 1);
        return;
      }
      $('netStatus').textContent = reasonText(data.reason);
      $('lobbyStatus').textContent = reasonText(data.reason);
      closeNet();
      hide(lobbyEl);
      show(netPanel);
      showJoinUI();
      $('btnNetGo').disabled = false;
      return;
    }
    if (data.t === 'welcome') {
      myId = data.id;
      roomCode = data.code || roomCode;
      hostPlayerId = data.hostId || hostPlayerId || roomCode;
      migratePhase = null;
      migrateAttempt = 0;
      clearMigrateTimer();
      if (matchPhase === 'lobby' || matchPhase === 'idle') {
        $('lobbyStatus').textContent = '';
        showLobby();
      } else if (matchPhase === 'post') {
        updateRematchHint();
        startPostHeartbeat();
      }
      return;
    }
    if (data.t === 'roster') {
      roster = data.players || [];
      if (matchPhase === 'lobby' || matchPhase === 'idle') {
        matchPhase = 'lobby';
        showLobby();
      }
      renderRoster();
      if (matchPhase === 'post') updateRematchHint();
      return;
    }
    if (data.t === 'start') {
      timeRampEnabled = data.speedRamp !== false;
      dropSpeed = DROP_SPEED[data.dropSpeed] ? data.dropSpeed : 'normal';
      garbageTarget = GARBAGE_TARGET[data.garbageTarget] ? data.garbageTarget : 'clockwise';
      powerUpsEnabled = !!data.powerUps;
      // Ack first so the host can schedule a shared `go`; do not start countdown yet.
      clearPendingStart();
      pendingStart = { players: data.players || [] };
      netSend({t: 'startAck'});
      return;
    }
    if (data.t === 'go') {
      const players = (pendingStart && pendingStart.players) || [];
      clearPendingStart();
      if (!players.length) return;
      startRemoteMatch(players);
      return;
    }
    if (data.t === 'cd') {
      onCountdownBeat(data.v);
      return;
    }
    if (data.t === 'begin') {
      onCountdownBegin();
      return;
    }
    if (data.t === 'state') {
      if (data.from === myId) return;
      const b = boardById.get(data.from);
      if (b) b.applyRemote(data);
      return;
    }
    if (data.t === 'garbage') {
      const local = boardById.get(myId);
      if (local && !local.over && data.from !== myId) local.addGarbage(data.n);
      return;
    }
    if (data.t === 'powerApply') {
      const local = boardById.get(myId);
      if (local && POWER_KIND[data.kind]) applyPowerToBoard(local, data.kind);
      return;
    }
    if (data.t === 'powerFx') {
      if (data.to) showPowerFx(data.to, data.kind);
      return;
    }
    if (data.t === 'hit') {
      if (data.to) showHitFx(data.to, data.n || 0);
      return;
    }
    if (data.t === 'over') {
      markDead(data.from);
      checkSelfWin();
      return;
    }
    if (data.t === 'pause') {
      applyMatchPause(!!data.on, data.from);
      return;
    }
    if (data.t === 'win') {
      applyWin(data.id);
    }
  }

  function wireHostConn(c) {
    const peerId = c.peer;
    connections.set(peerId, c);
    c.on('data', data => onHostData(peerId, data));
    c.on('close', () => {
      if (suppressNetClose) return;
      connections.delete(peerId);
      if (pendingStart) {
        dropPendingStartPeer(peerId);
        if (matchPhase === 'lobby') {
          roster = roster.filter(p => p.id !== peerId);
          // Keep remaining ready state; start handshake already in flight.
          broadcastRoster();
        } else if (matchPhase === 'post') {
          removePostPeer(peerId);
        }
        return;
      }
      if (cdReadyWait) dropCdReadyPeer(peerId);
      if (matchPhase === 'lobby') {
        roster = roster.filter(p => p.id !== peerId);
        roster.forEach(p => { p.ready = false; });
        broadcastRoster();
      } else if (matchPhase === 'playing' || matchPhase === 'countdown') {
        const left = roster.find(p => p.id === peerId);
        notifyPeerLeft(left && left.name);
        if (paused && pausedById === peerId) {
          applyMatchPause(false);
          broadcast({t: 'pause', on: false, from: peerId});
        }
        markDead(peerId);
        checkWinner();
      } else if (matchPhase === 'post') {
        removePostPeer(peerId);
      }
    });
    c.on('error', () => {});
  }

  function wireGuestConn(c) {
    guestConn = c;
    const onOpen = () => {
      if (matchPhase === 'lobby') $('netStatus').textContent = t('joinedLobby');
      sendTo(c, {t: 'hello', name: getPlayerName()});
    };
    if (c.open) onOpen();
    else c.on('open', onOpen);
    c.on('data', onGuestData);
    c.on('close', () => {
      if (suppressNetClose || mode !== 'guest') return;
      if (guestConn !== c) return; // ignore stale close from a replaced connection
      clearPendingStart();
      if (migratePhase === 'reconnecting') {
        scheduleGuestReconnect(migrateAttempt + 1);
        return;
      }
      if (migratePhase === 'taking') return;
      if (canMigratePhase()) {
        handleHostLost();
        return;
      }
      if (matchPhase !== 'idle') {
        $('ctrlHint').textContent = t('disconnected');
      }
    });
    c.on('error', () => {
      if (guestConn !== c) return;
      if (migratePhase === 'reconnecting') {
        scheduleGuestReconnect(migrateAttempt + 1);
        return;
      }
      $('netStatus').textContent = t('connError');
      $('btnNetGo').disabled = false;
    });
  }

  function applyLocalRename() {
    if (matchPhase !== 'lobby') return;
    const name = setPlayerName(lobbyName.value || menuName.value);
    const me = roster.find(p => p.id === myId);
    if (!me || me.name === name) return;
    me.name = name;
    me.ready = false;
    if (mode === 'host') {
      broadcastRoster();
    } else {
      netSend({t: 'name', name, from: myId});
      renderRoster();
    }
  }

  function toggleReady() {
    const me = roster.find(p => p.id === myId);
    if (!me || matchPhase !== 'lobby') return;
    me.ready = !me.ready;
    if (mode === 'host') {
      broadcastRoster();
      tryHostStart();
    } else {
      netSend({t: 'ready', ready: me.ready, from: myId});
      renderRoster();
    }
  }

  function showHostUI(code) {
    roomCode = code;
    myId = code;
    hostPlayerId = code;
    playMode = 'versus';
    const name = setPlayerName(getPlayerName());
    roster = [{id: myId, name, ready: false, alive: true}];
    showLobby();
    if ($('lobbyStatus')) $('lobbyStatus').textContent = t('waitingPeers');
  }

  function showJoinUI() {
    $('netLabel').textContent = t('enterCode');
    hide($('roomCode'));
    hide($('btnCopy'));
    show($('netIn'));
    show($('btnNetGo'));
    $('netIn').value = '';
    $('netStatus').textContent = '';
    setTimeout(() => $('netIn').focus(), 50);
  }

  function hostRoom(attempt) {
    closeNet();
    mode = 'host';
    matchPhase = 'lobby';
    const code = makeCode();
    roomCode = code;
    peer = new Peer(code, PEER_CONFIG);
    peer.on('open', id => showHostUI(id));
    peer.on('connection', acceptHostConnection);
    peer.on('error', err => {
      if (err.type === 'unavailable-id' && attempt < 8) {
        hostRoom(attempt + 1);
        return;
      }
      hide(lobbyEl);
      show(netPanel);
      $('netStatus').textContent = t('createFail', {err: err.type || t('err')});
      show($('btnCopy'));
      hide($('netIn'));
      hide($('btnNetGo'));
      hide($('roomCode'));
      hide($('btnCopy'));
      $('netLabel').textContent = t('hostFail');
    });
  }

  function joinRoom() {
    setPlayerName(menuName.value || lobbyName.value || getPlayerName());
    const code = ($('netIn').value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) {
      $('netStatus').textContent = t('needCode');
      return;
    }
    closeNet();
    mode = 'guest';
    matchPhase = 'lobby';
    roomCode = code;
    $('btnNetGo').disabled = true;
    $('netStatus').textContent = t('connecting');
    peer = new Peer(undefined, PEER_CONFIG);
    peer.on('open', () => {
      myId = peer.id;
      wireGuestConn(peer.connect(code, {reliable: true}));
    });
    peer.on('error', err => {
      $('btnNetGo').disabled = false;
      $('netStatus').textContent = t('joinFail', {err: err.type || t('err')});
    });
  }

  function loadPlayMode() {
    const saved = storageGet(MODE_KEY);
    if (SOLO_MODES.includes(saved)) return saved;
    return 'marathon';
  }

  function setPlayMode(next) {
    if (!SOLO_MODES.includes(next) && next !== 'versus') return;
    playMode = next;
    if (SOLO_MODES.includes(next)) storageSet(MODE_KEY, next);
    document.querySelectorAll('#modePicker .mode-btn').forEach(btn => {
      const on = btn.dataset.mode === playMode;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function applySoloModeDefaults() {
    powerUpsEnabled = false;
    garbageTarget = 'clockwise';
    dropSpeed = 'normal';
    if (playMode === 'zen') timeRampEnabled = false;
    else timeRampEnabled = true;
  }

  function startSoloMatch(modeKey) {
    const next = SOLO_MODES.includes(modeKey) ? modeKey : playMode;
    setPlayMode(next);
    closeNet();
    mode = 'solo';
    playMode = next;
    myId = 'local';
    hostPlayerId = myId;
    roomCode = null;
    applySoloModeDefaults();
    ended = false;
    eliminated = false;
    paused = false;
    pausedById = null;
    const name = getPlayerName();
    roster = [{id: myId, name, ready: true, alive: true}];
    hide(menu);
    hide(netPanel);
    hide(lobbyEl);
    hideOverlayPanels();
    startRemoteMatch([{id: myId, name}]);
  }

  function notifyPeerLeft(name) {
    const label = name || t('defaultName');
    const mine = boardById.get(myId);
    if (mine) showBoardToast(mine, t('peerLeft', {name: label}), 'hit');
    else if ($('lobbyStatus') && !$('lobby').hidden) {
      $('lobbyStatus').textContent = t('peerLeft', {name: label});
    }
  }

  function openNetUI(kind) {
    playMode = 'versus';
    setPlayerName(menuName.value || getPlayerName());
    hide(menu);
    hide(lobbyEl);
    if ($('settings')) hide($('settings'));
    if (kind === 'host') {
      hide(netPanel);
      $('netStatus') && ($('netStatus').textContent = t('connectingHost'));
      hostRoom(0);
    } else {
      show(netPanel);
      mode = 'guest';
      $('btnNetGo').disabled = false;
      showJoinUI();
    }
  }

  /* ---------- input (DAS/ARR — no OS key-repeat lag) ---------- */
  const held = { left: false, right: false, soft: false };
  let shiftDir = 0; // -1 left, 1 right, 0 none
  let shiftDas = true;
  let shiftAcc = 0;
  let softAcc = 0;

  function resetHeldKeys() {
    held.left = held.right = held.soft = false;
    shiftDir = 0;
    shiftDas = true;
    shiftAcc = 0;
    softAcc = 0;
  }

  function pressHorz(dir) {
    if (dir < 0) held.left = true;
    else held.right = true;
    shiftDir = dir;
    shiftDas = true;
    shiftAcc = 0;
    act(dir < 0 ? 'left' : 'right');
  }

  function releaseHorz(dir) {
    if (dir < 0) held.left = false;
    else held.right = false;
    if (shiftDir !== dir) return;
    if (held.left) {
      shiftDir = -1;
      shiftDas = true;
      shiftAcc = 0;
      act('left');
    } else if (held.right) {
      shiftDir = 1;
      shiftDas = true;
      shiftAcc = 0;
      act('right');
    } else {
      shiftDir = 0;
      shiftDas = true;
      shiftAcc = 0;
    }
  }

  function tickHeldKeys(dt) {
    if (shiftDir) {
      shiftAcc += dt;
      if (shiftDas) {
        if (shiftAcc >= DAS_MS) {
          shiftDas = false;
          shiftAcc = 0;
          act(shiftDir < 0 ? 'left' : 'right');
        }
      } else if (ARR_MS <= 0) {
        shiftAcc = 0;
        act(shiftDir < 0 ? 'left' : 'right');
      } else {
        while (shiftAcc >= ARR_MS) {
          shiftAcc -= ARR_MS;
          act(shiftDir < 0 ? 'left' : 'right');
        }
      }
    }
    if (held.soft) {
      softAcc += dt;
      while (softAcc >= SOFT_MS) {
        softAcc -= SOFT_MS;
        act('soft');
      }
    }
  }

  function act(action) {
    if (matchPhase !== 'playing' || ended || eliminated || paused) return;
    const b = boards.find(x => x.live);
    if (!b) return;
    if (action === 'left') b.move(-1);
    else if (action === 'right') b.move(1);
    else if (action === 'rot' || action === 'rotCw') b.rot(1);
    else if (action === 'rotCcw') b.rot(-1);
    else if (action === 'soft') b.soft();
    else if (action === 'hard') b.hard();
    else if (action === 'hold') b.hold();
    else if (action === 'power') b.usePower();
  }

  function dispatchBindAction(action, e) {
    if (action === 'pause') {
      if (e.repeat) return;
      if (matchPhase === 'playing' && !ended) {
        togglePause();
        e.preventDefault();
      }
      return;
    }
    if (matchPhase !== 'playing' || ended || eliminated || paused) return;
    if (e.repeat && (action === 'left' || action === 'right' || action === 'soft' || action === 'hard' || action === 'rotCw' || action === 'rotCcw' || action === 'hold' || action === 'power')) {
      e.preventDefault();
      return;
    }
    if (action === 'left') pressHorz(-1);
    else if (action === 'right') pressHorz(1);
    else if (action === 'soft') {
      held.soft = true;
      softAcc = SOFT_MS;
    } else act(action);
    e.preventDefault();
  }

  document.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (bindListenAction) {
      e.preventDefault();
      if (e.repeat) return;
      applyBindCapture(e.code);
      return;
    }

    const action = actionForCode(e.code);
    if (!action) return;
    dispatchBindAction(action, e);
  });

  document.addEventListener('keyup', e => {
    const action = actionForCode(e.code);
    if (action === 'left') releaseHorz(-1);
    else if (action === 'right') releaseHorz(1);
    else if (action === 'soft') {
      held.soft = false;
      softAcc = 0;
    }
  });

  window.addEventListener('blur', resetHeldKeys);

  document.querySelectorAll('.pad button[data-act]').forEach(btn => {
    const action = btn.dataset.act;
    const onDown = ev => {
      ev.preventDefault();
      if (action === 'left') pressHorz(-1);
      else if (action === 'right') pressHorz(1);
      else if (action === 'soft') {
        held.soft = true;
        softAcc = SOFT_MS;
      } else act(action);
    };
    const onUp = () => {
      if (action === 'left') releaseHorz(-1);
      else if (action === 'right') releaseHorz(1);
      else if (action === 'soft') {
        held.soft = false;
        softAcc = 0;
      }
    };
    btn.addEventListener('pointerdown', onDown);
    btn.addEventListener('pointerup', onUp);
    btn.addEventListener('pointerleave', onUp);
    btn.addEventListener('pointercancel', onUp);
    btn.addEventListener('click', ev => ev.preventDefault());
  });

  /* ---------- wiring ---------- */
  function menuClick(fn) {
    return (ev) => {
      sfx('menu');
      const a = audio();
      if (a) a.resume();
      return fn(ev);
    };
  }

  $('btnHost').onclick = menuClick(() => openNetUI('host'));
  $('btnJoin').onclick = menuClick(() => openNetUI('guest'));
  if ($('btnSolo')) $('btnSolo').onclick = menuClick(() => startSoloMatch(playMode));
  document.querySelectorAll('#modePicker .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sfx('menu');
      setPlayMode(btn.dataset.mode);
    });
  });
  setPlayMode(loadPlayMode());
  if ($('btnSettings')) $('btnSettings').onclick = menuClick(showSettings);
  if ($('btnSettingsBack')) $('btnSettingsBack').onclick = menuClick(leaveSettings);
  if ($('btnResume')) $('btnResume').onclick = menuClick(resumeGame);
  if ($('btnPauseSettings')) $('btnPauseSettings').onclick = menuClick(showSettings);
  if ($('btnPauseMenu')) $('btnPauseMenu').onclick = menuClick(quitFromPause);
  if ($('btnResultsAgain')) $('btnResultsAgain').onclick = menuClick(rematch);
  if ($('btnResultsMenu')) $('btnResultsMenu').onclick = menuClick(showMenu);
  if ($('btnResetBinds')) {
    $('btnResetBinds').onclick = menuClick(() => {
      setBinds({ ...DEFAULT_BINDS });
    });
  }
  const chkColorblind = $('chkColorblind');
  if (chkColorblind) {
    chkColorblind.checked = colorblindEnabled;
    chkColorblind.addEventListener('change', () => setColorblind(chkColorblind.checked));
  }
  const rngGrid = $('rngGrid');
  if (rngGrid) {
    rngGrid.addEventListener('input', () => {
      if ($('outGrid')) $('outGrid').textContent = rngGrid.value;
    });
    rngGrid.addEventListener('change', () => setGridOpacity(parseInt(rngGrid.value, 10) || 0));
  }
  [['rngDas', 'outDas'], ['rngArr', 'outArr'], ['rngSoft', 'outSoft']].forEach(([rngId, outId]) => {
    const rng = $(rngId), out = $(outId);
    if (!rng) return;
    const commit = () => {
      applyTimingPrefs(
        ($('rngDas') && $('rngDas').value) || DAS_MS,
        ($('rngArr') && $('rngArr').value) || ARR_MS,
        ($('rngSoft') && $('rngSoft').value) || SOFT_MS
      );
      syncSettingsUI();
    };
    rng.addEventListener('input', () => {
      if (out) out.textContent = rng.value;
    });
    rng.addEventListener('change', commit);
  });
  function bindVolSlider(rngId, outId, setter) {
    const rng = $(rngId), out = $(outId);
    if (!rng) return;
    const apply = () => {
      const a = audio();
      const v = clamp01((parseInt(rng.value, 10) || 0) / 100);
      if (a) setter(a, v);
      if (out) out.textContent = String(Math.round(v * 100));
      sfx('menu');
    };
    rng.addEventListener('input', () => {
      const a = audio();
      const v = clamp01((parseInt(rng.value, 10) || 0) / 100);
      if (a) setter(a, v);
      if (out) out.textContent = String(Math.round(v * 100));
    });
    rng.addEventListener('change', apply);
  }
  bindVolSlider('rngMaster', 'outMaster', (a, v) => a.setMaster(v));
  bindVolSlider('rngMusic', 'outMusic', (a, v) => a.setMusic(v));
  bindVolSlider('rngSfx', 'outSfx', (a, v) => a.setSfx(v));
  if ($('btnMute')) {
    $('btnMute').onclick = () => {
      const a = audio();
      if (!a) return;
      a.resume().then(() => {
        a.toggleMute();
        syncMuteBtn();
        if (!a.isMuted()) {
          sfx('menu');
          if (matchPhase === 'playing' && !ended) a.startMusic();
        }
      });
    };
  }
  syncSettingsUI();
  syncMuteBtn();
  $('btnNetBack').onclick = menuClick(showMenu);
  $('btnLobbyLeave').onclick = menuClick(showMenu);
  $('btnNetGo').onclick = menuClick(joinRoom);
  $('btnReady').onclick = menuClick(toggleReady);
  selSpeedRamp.addEventListener('change', () => {
    if (mode === 'host') timeRampEnabled = selSpeedRamp.value === 'on';
  });
  selPowerUps.addEventListener('change', () => {
    if (mode === 'host') powerUpsEnabled = selPowerUps.value === 'on';
  });
  selDropSpeed.addEventListener('change', () => {
    if (mode === 'host' && DROP_SPEED[selDropSpeed.value]) dropSpeed = selDropSpeed.value;
  });
  selGarbageTarget.addEventListener('change', () => {
    if (mode === 'host' && GARBAGE_TARGET[selGarbageTarget.value]) garbageTarget = selGarbageTarget.value;
  });
  menuName.addEventListener('change', () => setPlayerName(menuName.value));
  menuName.addEventListener('blur', () => setPlayerName(menuName.value));
  lobbyName.addEventListener('change', applyLocalRename);
  lobbyName.addEventListener('blur', applyLocalRename);
  lobbyName.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyLocalRename();
      lobbyName.blur();
    }
  });
  $('netIn').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
  $('netIn').addEventListener('input', () => {
    const el = $('netIn');
    const cur = el.selectionStart;
    el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    el.setSelectionRange(cur, cur);
  });
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode || $('lobbyCode').textContent);
      $('lobbyStatus').textContent = t('codeCopied');
      if (!$('netPanel').hidden) $('netStatus').textContent = t('codeCopied');
    } catch (_) {
      $('lobbyStatus').textContent = t('copyFail');
    }
  }
  $('btnCopy').onclick = copyCode;
  $('btnCopyLobby').onclick = copyCode;
  $('btnMenu').onclick = menuClick(showMenu);
  $('btnAgain').onclick = menuClick(rematch);
  $('btnLangDa').onclick = () => setLang('da');
  $('btnLangEn').onclick = () => setLang('en');
  const chkFlashy = $('chkFlashy');
  if (chkFlashy) {
    chkFlashy.checked = flashyEnabled;
    chkFlashy.addEventListener('change', () => setFlashy(chkFlashy.checked));
  }
  const chkShake = $('chkShake');
  if (chkShake) {
    chkShake.checked = shakeEnabled;
    chkShake.addEventListener('change', () => setShake(chkShake.checked));
  }
  applyI18n();
})();