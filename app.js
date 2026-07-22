/* VibeTrisimo — host-relay lobby (max 8) */
(() => {
  const COLS = 10, ROWS = 20;
  const MAX_PLAYERS = 8;
  const TYPES = ['I','O','T','S','Z','J','L'];
  const GARBAGE_COLOR = '#4a453f';
  const SHAPES = {
    I:{color:'#5a9e9a',m:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]]},
    O:{color:'#c9a227',m:[[1,1],[1,1]]},
    T:{color:'#7a5a8a',m:[[0,1,0],[1,1,1],[0,0,0]]},
    S:{color:'#4a7a4a',m:[[0,1,1],[1,1,0],[0,0,0]]},
    Z:{color:'#8b2e2e',m:[[1,1,0],[0,1,1],[0,0,0]]},
    J:{color:'#3a5a7a',m:[[1,0,0],[1,1,1],[0,0,0]]},
    L:{color:'#b87333',m:[[0,0,1],[1,1,1],[0,0,0]]},
  };
  const GARBAGE = {1:0,2:1,3:2,4:4};
  const TIME_LEVEL_MS = 30000; // level up every 30s of play, in addition to line-based leveling
  const MIN_DROP_MS = 120; // fastest possible drop interval, so it never becomes unplayable
  const DROP_SPEED = { slow: 1400, normal: 1000, fast: 400, turbo: 160 };
  const GARBAGE_TARGET = { clockwise: 1, random: 1, neighbors: 1 };
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const NAME_KEY = 'vibetrisimo-name';
  const LANG_KEY = 'vibetrisimo-lang';
  const FLASHY_KEY = 'vibetrisimo-flashy';

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }
  const FX_COLORS = ['#d4af37', '#c9a227', '#e8d9b5', '#8b1a1a', '#a84848', '#5a9e9a', '#4a7a4a', '#7a5a8a', '#b87333', '#f0e0a0'];

  const STR = {
    en: {
      subtitle: 'Tetris battle',
      yourName: 'Your name',
      namePh: 'Name',
      hostGame: 'Host game',
      joinGame: 'Join game',
      menuHint: 'Up to 8 players.',
      copyCode: 'Copy code',
      codePh: 'Code',
      join: 'Join',
      back: 'Back',
      roomCode: 'Room code',
      ready: 'Ready',
      unready: 'Unready',
      speedRamp: 'Speed increases over time',
      dropSpeed: 'Drop speed',
      dropSlow: 'Slow',
      dropNormal: 'Normal',
      dropFast: 'Fast',
      dropTurbo: 'Turbo',
      garbageTarget: 'Who gets garbage',
      targetClockwise: 'Always the next player',
      targetRandom: 'Anyone still alive',
      targetNeighbors: 'Only left or right',
      clearSingle: 'Single',
      clearDouble: 'Double',
      clearTriple: 'Triple',
      clearTetris: 'Tetris!',
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
      ctrlHint: 'WASD / arrows + space · C keep · last survivor wins',
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
      menuHint: 'Op til 8 spillere.',
      copyCode: 'Kopiér kode',
      codePh: 'Kode',
      join: 'Tilslut',
      back: 'Tilbage',
      roomCode: 'Rumkode',
      ready: 'Klar',
      unready: 'Ikke klar',
      speedRamp: 'Hastighed øges over tid',
      dropSpeed: 'Faldhastighed',
      dropSlow: 'Langsom',
      dropNormal: 'Normal',
      dropFast: 'Hurtig',
      dropTurbo: 'Turbo',
      garbageTarget: 'Hvem får skrald',
      targetClockwise: 'Altid næste spiller',
      targetRandom: 'Enhver der er i live',
      targetNeighbors: 'Kun venstre eller højre',
      clearSingle: 'Single',
      clearDouble: 'Double',
      clearTriple: 'Triple',
      clearTetris: 'Tetris!',
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
      ctrlHint: 'WASD / piletaster + mellemrum · C gem · sidste overlevende vinder',
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

  function setFlashy(on) {
    flashyEnabled = !!on;
    storageSet(FLASHY_KEY, flashyEnabled ? '1' : '0');
    const chk = document.getElementById('chkFlashy');
    if (chk) chk.checked = flashyEnabled;
    if (!flashyEnabled) clearFxParticles();
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
    // Refresh dynamic UI if present
    if (typeof renderRoster === 'function' && matchPhase === 'lobby') renderRoster();
    if (typeof updateRematchHint === 'function' && matchPhase === 'post') updateRematchHint();
    if (btnAgain && !btnAgain.hidden) {
      if (btnAgain.disabled && matchPhase === 'post') btnAgain.textContent = t('ready');
      else if (matchPhase === 'post' || matchPhase === 'playing') btnAgain.textContent = t('playAgain');
    }
    if ($('ctrlHint') && matchPhase === 'playing') $('ctrlHint').textContent = t('ctrlHint');
    if ($('netLabel') && !$('netPanel').hidden && mode === 'guest') {
      $('netLabel').textContent = t('enterCode');
    }
    boards.forEach(b => {
      if (b.els && b.els.miniLabel) b.els.miniLabel.textContent = t('next');
      if (b.els && b.els.holdLabel) b.els.holdLabel.textContent = t('hold');
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
    });
  }

  const $ = id => document.getElementById(id);
  const menu = $('menu'), netPanel = $('netPanel'), lobbyEl = $('lobby'), gameEl = $('game');
  const banner = $('banner'), btnAgain = $('btnAgain'), boardsEl = $('boards');
  const countdownEl = $('countdown');
  const rosterList = $('rosterList'), btnReady = $('btnReady');
  const speedRampRow = $('speedRampRow'), chkSpeedRamp = $('chkSpeedRamp');
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

  let mode = null; // 'host' | 'guest'
  let boards = [];
  let boardById = new Map();
  let running = false, ended = false, eliminated = false;
  let matchPhase = 'idle'; // idle | lobby | countdown | playing | post
  let last = 0, raf = 0, logicTimer = 0, countdownTimer = 0;
  const PEER_CONFIG = {
    config: {
      iceServers: [
        { urls: 'stun:92.5.51.80:3478' },
        {
          urls: 'turn:92.5.51.80:3478',
          username: 'tetris',
          credential: "'3IwrF5?%'t3'"
        },
        {
          urls: 'turn:92.5.51.80:3478?transport=tcp',
          username: 'tetris',
          credential: "'3IwrF5?%'t3'"
        }
      ]
    }
  };
  let peer = null, guestConn = null, roomCode = '';
  let timeRampEnabled = true; // host-controlled match setting
  let dropSpeed = 'normal'; // host-controlled base drop speed preset
  let garbageTarget = 'clockwise'; // host-controlled garbage targeting
  let myId = null;
  let hostPlayerId = null; // player id of current relay host (may differ from roomCode after migration)
  let roster = []; // {id, name, ready, alive}
  let connections = new Map(); // host: peerId -> DataConnection
  let syncAcc = 0;
  let suppressNetClose = false;
  let migratePhase = null; // null | 'taking' | 'reconnecting'
  let migrateTimer = null;
  let migrateAttempt = 0;

  function rotate(m) {
    const n = m.length, out = Array.from({length:n}, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out[c][n - 1 - r] = m[r][c];
    return out;
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

  function drawBlock(ctx, x, y, color, size, opts) {
    const ghost = opts && opts.ghost;
    const iron = color === GARBAGE_COLOR;
    const gap = Math.max(1, (size * .08) | 0);
    const px = x * size + gap, py = y * size + gap;
    const w = size - gap * 2, h = size - gap * 2;
    if (w < 2 || h < 2) return;
    const rgb = hexToRgb(color);
    const g = grit(x, y);
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
  }

  function drawMini(ctx, type, size) {
    ctx.clearRect(0, 0, size, size);
    if (!type) return;
    const m = SHAPES[type].m, n = m.length, bs = Math.max(8, (size / n) | 0) - 2;
    const ox = (size - n * (bs + 2)) / 2, oy = (size - n * (bs + 2)) / 2;
    const color = SHAPES[type].color;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!m[r][c]) continue;
      const px = ox + c * (bs + 2), py = oy + r * (bs + 2);
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
      this.next = bagPiece(this.bag);
      this.holdType = null;
      this.canHold = true;
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.dropMs = DROP_SPEED[dropSpeed] || DROP_SPEED.normal;
      this.elapsed = 0;
      this.acc = 0;
      this.over = false;
      this.gQueue = 0;
      this.combo = 0;
      this.flashUntil = 0;
      this.flashKind = null;
      this.spawn();
      this.paintHud();
      if (this.els.over) this.els.over.textContent = '';
    }

    spawn() {
      const type = this.next;
      this.next = bagPiece(this.bag);
      const shape = SHAPES[type];
      const m = shape.m.map(r => r.slice());
      this.piece = {type, m, color: shape.color, x: ((COLS - m.length) / 2) | 0, y: 0};
      this.canHold = true;
      if (this.hits(this.piece.m, this.piece.x, this.piece.y)) {
        this.over = true;
        if (this.els.over) this.els.over.textContent = t('topOut');
        onTopOut(this);
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

    canPlay() {
      return this.live && !this.over && !ended && matchPhase === 'playing';
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
        const shape = SHAPES[swap];
        const m = shape.m.map(r => r.slice());
        this.piece = {type: swap, m, color: shape.color, x: ((COLS - m.length) / 2) | 0, y: 0};
        if (this.hits(this.piece.m, this.piece.x, this.piece.y)) {
          this.over = true;
          if (this.els.over) this.els.over.textContent = t('topOut');
          onTopOut(this);
        }
      }
      this.canHold = false;
      this.paintHud();
      syncState(this, true);
    }

    move(dx) {
      if (!this.canPlay()) return;
      if (!this.hits(this.piece.m, this.piece.x + dx, this.piece.y)) {
        this.piece.x += dx;
        syncState(this);
      }
    }

    rot() {
      if (!this.canPlay()) return;
      const rm = rotate(this.piece.m);
      for (const k of [0, -1, 1, -2, 2]) {
        if (!this.hits(rm, this.piece.x + k, this.piece.y)) {
          this.piece.m = rm;
          this.piece.x += k;
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
        this.paintHud();
        syncState(this);
      } else this.lock();
    }

    hard() {
      if (!this.canPlay()) return;
      let d = 0;
      while (!this.hits(this.piece.m, this.piece.x, this.piece.y + 1)) {
        this.piece.y++;
        d++;
      }
      this.score += d * 2;
      this.lock();
    }

    lock() {
      const {m, x, y, color} = this.piece;
      for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) {
        if (!m[r][c]) continue;
        const gx = x + c, gy = y + r;
        if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) this.grid[gy][gx] = color;
      }
      this.flashUntil = performance.now() + 120;
      this.flashKind = 'lock';
      const cleared = this.clearLines();
      if (cleared) {
        this.combo++;
        const base = [0, 100, 300, 500, 800][cleared] || 800;
        this.score += base * this.level;
        this.lines += cleared;
        this.updateSpeed();
        if (navigator.vibrate) navigator.vibrate(30);
        const g = GARBAGE[cleared] || 0;
        if (g) sendGarbage(this, g);
        this.flashUntil = performance.now() + 200;
        this.flashKind = 'clear';
        showClearFx(this, cleared);
      } else {
        this.combo = 0;
      }
      if (this.gQueue) {
        this.applyGarbage(this.gQueue);
        this.gQueue = 0;
      }
      if (!this.over) this.spawn();
      this.paintHud();
      syncState(this, true);
    }

    clearLines() {
      let n = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (this.grid[r].every(Boolean)) {
          this.grid.splice(r, 1);
          this.grid.unshift(Array(COLS).fill(null));
          n++;
          r++;
        }
      }
      return n;
    }

    addGarbage(n) { this.gQueue += n; }

    applyGarbage(n) {
      for (let i = 0; i < n; i++) {
        this.grid.shift();
        const gap = (Math.random() * COLS) | 0;
        const row = Array(COLS).fill(GARBAGE_COLOR);
        row[gap] = null;
        this.grid.push(row);
      }
      this.flashUntil = performance.now() + 180;
      this.flashKind = 'garbage';
    }

    tick(dt) {
      if (!this.canPlay()) return;
      this.elapsed += dt;
      if (this.updateSpeed()) this.paintHud();
      this.acc += dt;
      if (this.acc < this.dropMs) return;
      this.acc = 0;
      if (!this.hits(this.piece.m, this.piece.x, this.piece.y + 1)) {
        this.piece.y++;
        syncState(this);
      } else this.lock();
    }

    updateSpeed() {
      const lineLevel = 1 + ((this.lines / 10) | 0);
      const timeLevel = timeRampEnabled ? 1 + ((this.elapsed / TIME_LEVEL_MS) | 0) : 1;
      const level = Math.max(lineLevel, timeLevel);
      const changed = level !== this.level;
      this.level = level;
      const baseDropMs = DROP_SPEED[dropSpeed] || DROP_SPEED.normal;
      this.dropMs = Math.max(MIN_DROP_MS, baseDropMs - (level - 1) * 75);
      return changed;
    }

    ghostY() {
      let gy = this.piece.y;
      while (!this.hits(this.piece.m, this.piece.x, gy + 1)) gy++;
      return gy;
    }

    paintHud() {
      if (this.els.score) this.els.score.textContent = this.score;
      if (this.els.level) this.els.level.textContent = this.level;
      if (this.els.lines) this.els.lines.textContent = this.lines;
      drawMini(this.nextCtx, this.next, this.nextSize);
      if (this.holdCtx) drawMini(this.holdCtx, this.holdType, this.nextSize);
    }

    draw() {
      const ctx = this.ctx, s = this.block;
      const bw = COLS * s, bh = ROWS * s;
      ctx.clearRect(0, 0, bw, bh);
      ctx.fillStyle = 'rgba(8,6,5,.35)';
      ctx.fillRect(0, 0, bw, bh);
      ctx.strokeStyle = 'rgba(180,150,80,.07)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath(); ctx.moveTo(x * s, 0); ctx.lineTo(x * s, bh); ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * s); ctx.lineTo(bw, y * s); ctx.stroke();
      }
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c]) drawBlock(ctx, c, r, this.grid[r][c], s);
      }
      if (this.piece && !this.over) {
        const gy = this.ghostY();
        ctx.globalAlpha = .35;
        for (let r = 0; r < this.piece.m.length; r++) for (let c = 0; c < this.piece.m.length; c++) {
          if (this.piece.m[r][c]) drawBlock(ctx, this.piece.x + c, gy + r, this.piece.color, s, {ghost: true});
        }
        ctx.globalAlpha = 1;
        for (let r = 0; r < this.piece.m.length; r++) for (let c = 0; c < this.piece.m.length; c++) {
          if (this.piece.m[r][c]) drawBlock(ctx, this.piece.x + c, this.piece.y + r, this.piece.color, s);
        }
      }
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
        piece: this.piece && {m: this.piece.m, x: this.piece.x, y: this.piece.y, color: this.piece.color, type: this.piece.type},
        next: this.next,
        hold: this.holdType,
        score: this.score,
        level: this.level,
        lines: this.lines,
        combo: this.combo,
        over: this.over,
      };
    }

    applyRemote(data) {
      const prevLines = this.lines;
      this.grid = data.grid;
      this.piece = data.piece;
      this.next = data.next;
      if ('hold' in data) this.holdType = data.hold;
      this.score = data.score;
      this.level = data.level;
      this.lines = data.lines;
      if ('combo' in data) this.combo = data.combo;
      this.over = !!data.over;
      this.paintHud();
      if (this.els.over) this.els.over.textContent = this.over ? t('topOut') : '';
      const gained = this.lines - prevLines;
      if (gained > 0) showClearFx(this, Math.min(4, gained));
    }
  }

  /* ---------- UI helpers ---------- */
  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

  function clearBoards() {
    boards = [];
    boardById.clear();
    boardsEl.innerHTML = '';
    boardsEl.classList.remove('multi');
  }

  function computePlayfieldSizes(playerCount) {
    const vv = window.visualViewport;
    const vh = (vv && vv.height) || window.innerHeight;
    const vw = (vv && vv.width) || window.innerWidth;
    const desktop = window.matchMedia('(min-width:900px)').matches;
    const narrow = vw < 700;
    const padH = desktop ? 48 : (narrow ? 172 : 140);
    const chromeH = desktop ? 148 : (narrow ? 112 : 132);
    const availH = Math.max(180, vh - padH - chromeH);
    const availW = Math.max(280, vw - (narrow ? 12 : 24));
    const n = Math.max(1, playerCount | 0);
    const oppCount = Math.max(0, n - 1);

    if (oppCount === 0) {
      const sideW = narrow ? 58 : 168;
      const byH = (availH / ROWS) | 0;
      const byW = ((availW - sideW) / COLS) | 0;
      const local = Math.max(narrow ? 13 : 18, Math.min(narrow ? 26 : 36, byH, byW));
      return {local, opp: 10, oppRows: 0, oppCols: 0, availH, availW, vh, vw};
    }

    if (narrow) {
      // Phones: stack the local board on top and wrap opponents in a row below.
      const gap = 10;
      const youChrome = 42;
      const oppChrome = 30;
      const youSide = 52;
      const oppSide = 40;

      let maxLocal = 26;
      if (n >= 5) maxLocal = 22;
      if (n >= 6) maxLocal = 20;
      if (n >= 8) maxLocal = 18;
      const minLocal = 12;
      maxLocal = Math.max(minLocal, Math.min(maxLocal, ((availW - youSide) / COLS) | 0));

      let maxOpp = 11;
      if (n >= 5) maxOpp = 10;
      if (n >= 6) maxOpp = 9;
      if (n >= 8) maxOpp = 8;
      const minOpp = 7;
      maxOpp = Math.max(minOpp, Math.min(maxOpp, ((availW - oppSide) / COLS) | 0));

      let best = {local: minLocal, opp: minOpp, oppRows: oppCount, oppCols: 1};

      for (let local = maxLocal; local >= minLocal; local--) {
        const youH = local * ROWS + youChrome;
        const remH = availH - youH - gap;
        if (remH < oppChrome + ROWS * minOpp) continue;

        for (let opp = maxOpp; opp >= minOpp; opp--) {
          const oppTileW = oppSide + opp * COLS;
          const oppCols = Math.max(1, Math.min(oppCount, ((availW + gap) / (oppTileW + gap)) | 0));
          const oppRows = Math.ceil(oppCount / oppCols);
          const oppTileH = opp * ROWS + oppChrome;
          const oppsH = oppRows * oppTileH + (oppRows - 1) * gap;
          if (oppsH > remH) continue;
          return {local, opp, oppRows, oppCols, availH, availW, vh, vw, youSide, oppSide};
        }
      }

      return {local: best.local, opp: best.opp, oppRows: best.oppRows, oppCols: best.oppCols, availH, availW, vh, vw, youSide, oppSide};
    }

    // Opponents stay in a side column; local board is maximized first.
    const oppRows = oppCount <= 2 ? 1 : 2;
    const oppCols = Math.ceil(oppCount / oppRows);
    const gap = 12;
    const youChrome = 42;
    const oppChrome = 34;
    const youSide = narrow ? 52 : 150;
    const oppSide = narrow || n >= 4 ? 48 : 100;

    let maxLocal = narrow ? 28 : 38;
    if (n >= 5) maxLocal = Math.min(maxLocal, narrow ? 24 : 32);
    if (n >= 6) maxLocal = Math.min(maxLocal, narrow ? 22 : 28);
    if (n >= 8) maxLocal = Math.min(maxLocal, narrow ? 18 : 24);

    let maxOpp = narrow ? 11 : 13;
    if (n >= 5) maxOpp = Math.min(maxOpp, 11);
    if (n >= 6) maxOpp = Math.min(maxOpp, 10);
    if (n >= 8) maxOpp = Math.min(maxOpp, 9);

    let best = {local: narrow ? 16 : 20, opp: 8};
    const minLocal = narrow ? 12 : 14;

    for (let local = maxLocal; local >= minLocal; local--) {
      const youH = local * ROWS + youChrome;
      if (youH > availH) continue;
      const youW = youSide + local * COLS;
      const remW = availW - youW - gap;
      if (remW < 90) continue;

      for (let opp = Math.min(maxOpp, (local * .62) | 0); opp >= 7; opp--) {
        const oppTileH = opp * ROWS + oppChrome;
        const oppStackH = oppRows * oppTileH + (oppRows - 1) * gap;
        if (oppStackH > availH) continue;
        const oppsW = oppCols * (oppSide + opp * COLS) + (oppCols - 1) * gap;
        if (oppsW > remW) continue;
        best = {local, opp};
        return {local: best.local, opp: best.opp, oppRows, oppCols, availH, availW, vh, vw, youSide, oppSide};
      }
    }

    return {local: best.local, opp: best.opp, oppRows, oppCols, availH, availW, vh, vw, youSide, oppSide};
  }

  function computeBlockSize(large, playerCount) {
    const sizes = computePlayfieldSizes(playerCount);
    return large ? sizes.local : sizes.opp;
  }

  function setPlayLayout(on) {
    document.body.classList.toggle('in-game', !!on);
  }

  function createBoardSlot(playerId, label, live, large, playerCount, parentEl) {
    const n = Math.max(1, playerCount || roster.length || 1);
    const block = computeBlockSize(!!large, n);
    const cw = COLS * block, ch = ROWS * block;
    const narrow = ((window.visualViewport && window.visualViewport.width) || window.innerWidth) < 700;
    const nw = large
      ? Math.max(narrow ? 44 : 64, Math.round(block * (narrow ? 2.2 : 2.8)))
      : Math.max(narrow ? 28 : 36, Math.round(block * (narrow ? 2.6 : 3.2)));
    const box = document.createElement('div');
    box.className = 'player ' + (live ? 'you' : 'opp');
    box.dataset.id = playerId;

    const title = document.createElement('h2');
    title.textContent = label;
    box.appendChild(title);

    const row = document.createElement('div');
    row.className = 'row';

    const holdSide = document.createElement('div');
    holdSide.className = 'side hold-side';
    const holdLabel = document.createElement('div');
    holdLabel.className = 'mini-label';
    holdLabel.textContent = t('hold');
    const hold = document.createElement('canvas');
    hold.className = 'hold';
    hold.width = nw;
    hold.height = nw;
    holdSide.append(holdLabel, hold);

    const canvas = document.createElement('canvas');
    canvas.className = 'main';
    canvas.width = cw;
    canvas.height = ch;
    row.appendChild(canvas);

    const side = document.createElement('div');
    side.className = 'side';
    const miniLabel = document.createElement('div');
    miniLabel.className = 'mini-label';
    miniLabel.textContent = t('next');
    const next = document.createElement('canvas');
    next.width = nw;
    next.height = nw;
    const score = document.createElement('div');
    score.className = 'score';
    score.textContent = '0';
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = t('meta', {lv: '<span class="lv">1</span>', lines: '<span class="ln">0</span>'});
    const over = document.createElement('div');
    over.className = 'over';
    side.append(miniLabel, next, score, meta, over);

    // Grouped so Keep + Next can be laid out as a single stacked unit on
    // narrow screens; `display:contents` keeps them independent flex items
    // (in original left/right positions) on wider layouts.
    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.append(holdSide, side);
    row.appendChild(hud);
    box.appendChild(row);
    (parentEl || boardsEl).appendChild(box);

    const board = new Board({
      canvas, nextCanvas: next, holdCanvas: hold,
      els: {
        root: box,
        score,
        level: meta.querySelector('.lv'),
        lines: meta.querySelector('.ln'),
        over,
        title,
        miniLabel,
        holdLabel,
        meta,
      },
      live, block, playerId, nextSize: nw,
    });
    boards.push(board);
    boardById.set(playerId, board);
    return board;
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
    let status = t('rosterStatus', {n, max: MAX_PLAYERS, ready: readyN});
    if (n < 1) status += t('needTwo');
    else if (readyN < n) status += t('waitReady');
    else status += t('startingSoon');
    $('lobbyStatus').textContent = status;

    const me = roster.find(p => p.id === myId);
    btnReady.textContent = me?.ready ? t('unready') : t('ready');
    btnReady.classList.toggle('ready-on', !!me?.ready);
  }

  function showLobby() {
    clearCountdown();
    hide(menu);
    hide(netPanel);
    hide(gameEl);
    hide(banner);
    setPlayLayout(false);
    show(lobbyEl);
    matchPhase = 'lobby';
    $('lobbyCode').textContent = roomCode || '·····';
    lobbyName.value = getPlayerName();
    if (mode === 'host') {
      show(speedRampRow);
      chkSpeedRamp.checked = timeRampEnabled;
      chkSpeedRamp.disabled = false;
      show(dropSpeedRow);
      selDropSpeed.value = DROP_SPEED[dropSpeed] ? dropSpeed : 'normal';
      selDropSpeed.disabled = false;
      show(garbageTargetRow);
      selGarbageTarget.value = GARBAGE_TARGET[garbageTarget] ? garbageTarget : 'clockwise';
      selGarbageTarget.disabled = false;
    } else {
      hide(speedRampRow);
      hide(dropSpeedRow);
      hide(garbageTargetRow);
      chkSpeedRamp.disabled = true;
      selDropSpeed.disabled = true;
      selGarbageTarget.disabled = true;
    }
    renderRoster();
  }

  function showMenu() {
    stopLoop();
    clearCountdown();
    closeNet();
    running = false;
    ended = false;
    eliminated = false;
    matchPhase = 'idle';
    roster = [];
    clearBoards();
    setPlayLayout(false);
    hide(gameEl);
    hide(netPanel);
    hide(lobbyEl);
    hide(banner);
    hide(btnAgain);
    btnAgain.disabled = false;
    btnAgain.textContent = t('playAgain');
    show(menu);
  }

  /* ---------- match lifecycle ---------- */
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

  function runCountdown(onDone) {
    clearCountdown();
    if (!countdownEl) {
      onDone();
      return;
    }
    let n = 3;
    const tick = () => {
      if (matchPhase !== 'countdown') return;
      countdownEl.hidden = false;
      const num = document.createElement('div');
      num.className = 'countdown-num';
      num.textContent = String(n);
      countdownEl.replaceChildren(num);
      if (n <= 1) {
        countdownTimer = setTimeout(() => {
          countdownTimer = 0;
          if (matchPhase !== 'countdown') return;
          clearCountdown();
          onDone();
        }, 1000);
        return;
      }
      n -= 1;
      countdownTimer = setTimeout(tick, 1000);
    };
    tick();
  }

  function beginMatch() {
    ended = false;
    eliminated = false;
    matchPhase = 'playing';
    running = true;
    resetHeldKeys();
    hide(banner);
    hide(btnAgain);
    btnAgain.disabled = false;
    btnAgain.textContent = t('playAgain');
    roster.forEach(p => { p.ready = false; });
    last = performance.now();
    stopLoop();
    startLoop();
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
    // Focused: clamp spikes. Hidden: allow larger dt so throttled timers still catch up.
    const maxDt = document.hidden ? 2000 : 100;
    dt = Math.min(Math.max(0, dt), maxDt);
    if (!document.hidden) tickHeldKeys(dt);
    for (const b of boards) if (b.live) b.tick(dt);
  }

  function drawLoop() {
    for (const b of boards) b.draw();
    raf = requestAnimationFrame(drawLoop);
  }

  function sendGarbage(from, n) {
    netSend({t: 'garbage', n, from: from.playerId});
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
    if (!board.live || eliminated || ended) return;
    eliminated = true;
    if (board.els.over) board.els.over.textContent = t('eliminated');
    markDead(board.playerId);
    netSend({t: 'over', from: board.playerId});
    showBanner(t('eliminated'), 'lose');
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
    const winner = alive[0];
    if (winner) {
      broadcastOrLocal({t: 'win', id: winner.id});
      applyWin(winner.id);
    } else {
      showBanner(t('draw'), 'lose');
      showRematchBtn();
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
    roster.forEach(p => { p.ready = false; });
    if (winnerId === myId) {
      showBanner(t('victory'), 'win');
      burstFireworks();
    } else {
      const w = roster.find(p => p.id === winnerId);
      showBanner(t('wins', {name: w?.name || t('defaultName')}), 'lose');
    }
    showRematchBtn();
    updateRematchHint();
  }

  function showRematchBtn() {
    btnAgain.textContent = t('playAgain');
    btnAgain.disabled = false;
    show(btnAgain);
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
    const hint = $('rematchHint');
    if (!hint) return;
    const readyN = roster.filter(p => p.ready).length;
    const n = roster.length;
    if (n && readyN >= n) hint.textContent = t('rematchStart');
    else if (roster.find(p => p.id === myId)?.ready) hint.textContent = t('rematchWait', {ready: readyN, n});
    else if (readyN) hint.textContent = t('rematchPartial', {ready: readyN, n});
    else hint.textContent = t('rematchAll');
  }

  function rematch() {
    if (matchPhase !== 'post' && !ended) return;
    const me = roster.find(p => p.id === myId);
    if (!me || me.ready) return;
    me.ready = true;
    btnAgain.disabled = true;
    btnAgain.textContent = t('ready');
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

  function closeNet() {
    clearMigrateTimer();
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
      if (msg.t === 'over') {
        handleOver(msg.from);
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
    window.setTimeout(() => el.remove(), 900);
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

  function burstConfetti(x, y, count) {
    spawnBurst(x, y, count, () => {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.2 + Math.random() * 7.5;
      return {
        kind: 'rect',
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - (2 + Math.random() * 4),
        g: 0.18 + Math.random() * 0.12,
        life: 0.7 + Math.random() * 0.9,
        max: 0,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.35,
        w: 3 + Math.random() * 5,
        h: 2 + Math.random() * 3,
        color: FX_COLORS[(Math.random() * FX_COLORS.length) | 0],
      };
    });
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
    const hueColors = ['#d4af37', '#f0e0a0', '#e06060', '#5a9e9a', '#c9a227', '#f0c8c8'];
    const ring = 36 + ((Math.random() * 18) | 0);
    spawnBurst(x, y, ring, (i) => {
      const ang = (i / ring) * Math.PI * 2 + Math.random() * 0.08;
      const spd = 3.2 + Math.random() * 4.8;
      return {
        kind: 'ember',
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        g: 0.06,
        life: 0.7 + Math.random() * 0.6,
        max: 0,
        size: 1.8 + Math.random() * 2.2,
        color: hueColors[(Math.random() * hueColors.length) | 0],
        trail: true,
      };
    });
    burstGlitter(x, y, 18);
  }

  function burstFireworks() {
    if (!flashyEnabled || !fxCtx) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.38;
    burstFirework(cx, cy);
    window.setTimeout(() => burstFirework(cx - 90, cy + 30), 160);
    window.setTimeout(() => burstFirework(cx + 95, cy + 20), 280);
    window.setTimeout(() => burstFirework(cx - 40, cy - 40), 420);
    window.setTimeout(() => burstConfetti(cx, cy, 50), 200);
  }

  function fxForClear(board, cleared) {
    if (!flashyEnabled || !fxCtx) return;
    const o = boardOrigin(board);
    if (cleared >= 4) {
      burstConfetti(o.x, o.y, 70);
      burstGlitter(o.x, o.y, 40);
    } else if (cleared >= 3) {
      burstConfetti(o.x, o.y, 32);
    }
    if (board.combo >= 5) {
      burstGlitter(o.x, o.y - 10, 55);
      burstConfetti(o.x, o.y, 24);
    } else if (board.combo >= 3) {
      burstGlitter(o.x, o.y - 8, 36);
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
      if (p.kind === 'rect') {
        fxCtx.save();
        fxCtx.translate(p.x, p.y);
        fxCtx.rotate(p.rot || 0);
        fxCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        fxCtx.restore();
      } else if (p.kind === 'spark') {
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        fxCtx.fill();
        fxCtx.globalAlpha = a * 0.35;
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2);
        fxCtx.fill();
      } else {
        if (p.trail) {
          fxCtx.globalAlpha = a * 0.35;
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
  window.addEventListener('resize', resizeFxLayer);

  function showClearFx(board, cleared) {
    if (!flashyEnabled) return;
    const keys = ['', 'clearSingle', 'clearDouble', 'clearTriple', 'clearTetris'];
    const key = keys[cleared];
    if (key) {
      const kind = cleared >= 4 ? 'tetris' : (cleared >= 3 ? 'triple' : '');
      showBoardToast(board, t(key), kind);
    }
    if (board.combo >= 2) {
      window.setTimeout(() => {
        if (flashyEnabled) showBoardToast(board, t('comboN', {n: board.combo}), 'combo');
      }, 120);
    }
    fxForClear(board, cleared);
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
    if (roster.length < 1) return;
    if (!roster.every(p => p.ready)) return;
    const ids = roster.map(p => p.id);
    broadcast({t: 'start', speedRamp: timeRampEnabled, dropSpeed, garbageTarget, players: ids.map(id => {
      const p = roster.find(x => x.id === id);
      return {id, name: p.name};
    })});
    startRemoteMatch(ids.map(id => {
      const p = roster.find(x => x.id === id);
      return {id, name: p.name};
    }));
  }

  function startRemoteMatch(players) {
    hide(lobbyEl);
    hide(netPanel);
    show(gameEl);
    setPlayLayout(true);
    $('padTag0').textContent = getPlayerName();
    $('ctrlHint').textContent = t('ctrlHint');
    clearBoards();
    const n = players.length;
    const me = players.find(p => p.id === myId);
    const others = players.filter(p => p.id !== myId);
    if (me) createBoardSlot(me.id, me.name, true, true, n, boardsEl);
    if (others.length) {
      boardsEl.classList.add('multi');
      const opps = document.createElement('div');
      opps.className = 'opps';
      boardsEl.appendChild(opps);
      others.forEach(p => createBoardSlot(p.id, p.name, false, false, n, opps));
    }
    roster = players.map(p => ({id: p.id, name: p.name, ready: false, alive: true}));
    matchPhase = 'countdown';
    hide(banner);
    hide(btnAgain);
    for (const b of boards) b.draw();
    runCountdown(() => {
      beginMatch();
      const mine = boardById.get(myId);
      if (mine) syncState(mine, true);
    });
  }

  function onHostData(fromId, data) {
    if (!data || typeof data !== 'object') return;
    if (data.t === 'hello') {
      if (matchPhase === 'playing' || (matchPhase !== 'lobby' && matchPhase !== 'post')) {
        sendTo(connections.get(fromId), {t: 'reject', reason: 'match_started'});
        connections.get(fromId)?.close();
        connections.delete(fromId);
        return;
      }
      const existing = roster.find(p => p.id === fromId);
      if (!existing) {
        if (matchPhase !== 'lobby') {
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
    if (data.t === 'over') {
      handleOver(fromId);
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
      startRemoteMatch(data.players || []);
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
    if (data.t === 'hit') {
      if (data.to) showHitFx(data.to, data.n || 0);
      return;
    }
    if (data.t === 'over') {
      markDead(data.from);
      checkSelfWin();
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
      if (matchPhase === 'lobby') {
        roster = roster.filter(p => p.id !== peerId);
        roster.forEach(p => { p.ready = false; });
        broadcastRoster();
      } else if (matchPhase === 'playing' || matchPhase === 'countdown') {
        markDead(peerId);
        checkWinner();
      } else if (matchPhase === 'post') {
        roster = roster.filter(p => p.id !== peerId);
        broadcastRoster();
        tryHostStart();
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
    const name = setPlayerName(getPlayerName());
    roster = [{id: myId, name, ready: false, alive: true}];
    showLobby();
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

  function openNetUI(kind) {
    setPlayerName(menuName.value || getPlayerName());
    hide(menu);
    hide(lobbyEl);
    if (kind === 'host') {
      hide(netPanel);
      hostRoom(0);
    } else {
      show(netPanel);
      mode = 'guest';
      $('btnNetGo').disabled = false;
      showJoinUI();
    }
  }

  /* ---------- input (DAS/ARR — no OS key-repeat lag) ---------- */
  const DAS_MS = 160;
  const ARR_MS = 50;
  const SOFT_MS = 40;
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
    if (matchPhase !== 'playing' || ended || eliminated) return;
    const b = boards.find(x => x.live);
    if (!b) return;
    if (action === 'left') b.move(-1);
    else if (action === 'right') b.move(1);
    else if (action === 'rot') b.rot();
    else if (action === 'soft') b.soft();
    else if (action === 'hard') b.hard();
    else if (action === 'hold') b.hold();
  }

  document.addEventListener('keydown', e => {
    if (matchPhase !== 'playing' || ended || eliminated) return;
    // Don't steal typing from name/code fields
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const k = e.key;
    if (k === 'a' || k === 'A' || k === 'ArrowLeft') {
      if (e.repeat) { e.preventDefault(); return; }
      pressHorz(-1);
      e.preventDefault();
      return;
    }
    if (k === 'd' || k === 'D' || k === 'ArrowRight') {
      if (e.repeat) { e.preventDefault(); return; }
      pressHorz(1);
      e.preventDefault();
      return;
    }
    if (k === 's' || k === 'S' || k === 'ArrowDown') {
      if (e.repeat) { e.preventDefault(); return; }
      held.soft = true;
      softAcc = SOFT_MS; // soft once immediately
      e.preventDefault();
      return;
    }
    if (k === 'w' || k === 'W' || k === 'ArrowUp') {
      if (e.repeat) { e.preventDefault(); return; }
      act('rot');
      e.preventDefault();
      return;
    }
    if (k === ' ') {
      if (e.repeat) { e.preventDefault(); return; }
      act('hard');
      e.preventDefault();
      return;
    }
    if (k === 'c' || k === 'C') {
      if (e.repeat) { e.preventDefault(); return; }
      act('hold');
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', e => {
    const k = e.key;
    if (k === 'a' || k === 'A' || k === 'ArrowLeft') releaseHorz(-1);
    else if (k === 'd' || k === 'D' || k === 'ArrowRight') releaseHorz(1);
    else if (k === 's' || k === 'S' || k === 'ArrowDown') {
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
  $('btnHost').onclick = () => openNetUI('host');
  $('btnJoin').onclick = () => openNetUI('guest');
  $('btnNetBack').onclick = showMenu;
  $('btnLobbyLeave').onclick = showMenu;
  $('btnNetGo').onclick = joinRoom;
  $('btnReady').onclick = toggleReady;
  chkSpeedRamp.addEventListener('change', () => {
    if (mode === 'host') timeRampEnabled = chkSpeedRamp.checked;
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
  $('btnMenu').onclick = showMenu;
  $('btnAgain').onclick = rematch;
  $('btnLangDa').onclick = () => setLang('da');
  $('btnLangEn').onclick = () => setLang('en');
  const chkFlashy = $('chkFlashy');
  if (chkFlashy) {
    chkFlashy.checked = flashyEnabled;
    chkFlashy.addEventListener('change', () => setFlashy(chkFlashy.checked));
  }
  applyI18n();
})();