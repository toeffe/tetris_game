/* STONEFALL — host-relay lobby (max 8) */
(() => {
  const COLS = 10, ROWS = 20;
  const BLOCK_L = 20, BLOCK_S = 10;
  const MAX_PLAYERS = 8;
  const TYPES = ['I','O','T','S','Z','J','L'];
  const SHAPES = {
    I:{color:'#5ec8d4',m:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]]},
    O:{color:'#e6c84a',m:[[1,1],[1,1]]},
    T:{color:'#9b5fd4',m:[[0,1,0],[1,1,1],[0,0,0]]},
    S:{color:'#4ecf7a',m:[[0,1,1],[1,1,0],[0,0,0]]},
    Z:{color:'#d9445a',m:[[1,1,0],[0,1,1],[0,0,0]]},
    J:{color:'#4a7fd4',m:[[1,0,0],[1,1,1],[0,0,0]]},
    L:{color:'#e08a3c',m:[[0,0,1],[1,1,1],[0,0,0]]},
  };
  const GARBAGE = {1:0,2:1,3:2,4:4};
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const NAME_KEY = 'stonefall-name';
  const LANG_KEY = 'stonefall-lang';

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
      leave: 'Leave',
      playAgain: 'Play again',
      menu: 'Menu',
      you: 'You',
      youTag: ' (you)',
      waiting: 'Waiting',
      next: 'Next',
      meta: 'LV {lv} · {lines} lines',
      defaultName: 'Player',
      topOut: 'TOP OUT',
      eliminated: 'ELIMINATED',
      victory: 'VICTORY',
      draw: 'DRAW',
      wins: '{name} WINS',
      rosterStatus: '{n}/{max} · {ready} ready',
      needTwo: ' · need at least 2',
      waitReady: ' · waiting for ready',
      startingSoon: ' · starting…',
      ctrlHint: 'WASD + space · last survivor wins · garbage hits everyone',
      rematchStart: 'Starting…',
      rematchWait: 'Waiting for others ({ready}/{n})…',
      rematchPartial: '{ready}/{n} ready',
      rematchAll: 'Everyone must click Play again',
      matchStarted: 'Match already started',
      roomFull: 'Room full',
      rejected: 'Rejected',
      joinedLobby: 'Joined lobby…',
      disconnected: 'Disconnected from host.',
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
      leave: 'Forlad',
      playAgain: 'Spil igen',
      menu: 'Menu',
      you: 'Dig',
      youTag: ' (dig)',
      waiting: 'Venter',
      next: 'Næste',
      meta: 'NIV {lv} · {lines} linjer',
      defaultName: 'Spiller',
      topOut: 'TOPPET UD',
      eliminated: 'ELIMINERET',
      victory: 'SEJR',
      draw: 'UAFGJORT',
      wins: '{name} VINDER',
      rosterStatus: '{n}/{max} · {ready} klar',
      needTwo: ' · mindst 2 spillere',
      waitReady: ' · venter på klar',
      startingSoon: ' · starter…',
      ctrlHint: 'WASD + mellemrum · sidste overlevende vinder · skrald rammer alle',
      rematchStart: 'Starter…',
      rematchWait: 'Venter på de andre ({ready}/{n})…',
      rematchPartial: '{ready}/{n} klar',
      rematchAll: 'Alle skal trykke på Spil igen',
      matchStarted: 'Kampen er allerede startet',
      roomFull: 'Rummet er fuldt',
      rejected: 'Afvist',
      joinedLobby: 'Tilsluttet lobby…',
      disconnected: 'Forbindelsen til værten blev afbrudt.',
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
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'en' || saved === 'da') return saved;
    } catch (_) {}
    const nav = (navigator.language || '').toLowerCase();
    return nav.startsWith('da') ? 'da' : 'en';
  }

  let lang = detectLang();

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
    try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
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
  const rosterList = $('rosterList'), btnReady = $('btnReady');
  const menuName = $('menuName'), lobbyName = $('lobbyName');

  function sanitizeName(raw) {
    const s = String(raw || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 12);
    return s || t('defaultName');
  }

  function getPlayerName() {
    const fromInput = (lobbyName.value || menuName.value || '').trim();
    if (fromInput) return sanitizeName(fromInput);
    try {
      const stored = localStorage.getItem(NAME_KEY);
      if (stored) return sanitizeName(stored);
    } catch (_) {}
    return t('defaultName');
  }

  function setPlayerName(raw) {
    const name = sanitizeName(raw);
    try { localStorage.setItem(NAME_KEY, name); } catch (_) {}
    menuName.value = name;
    lobbyName.value = name;
    return name;
  }

  try {
    const stored = localStorage.getItem(NAME_KEY);
    if (stored) {
      menuName.value = sanitizeName(stored);
      lobbyName.value = menuName.value;
    }
  } catch (_) {}

  let mode = null; // 'host' | 'guest'
  let boards = [];
  let boardById = new Map();
  let running = false, ended = false, eliminated = false;
  let matchPhase = 'idle'; // idle | lobby | playing | post
  let last = 0, raf = 0;
  let peer = null, guestConn = null, roomCode = '';
  let myId = null;
  let roster = []; // {id, name, ready, alive}
  let connections = new Map(); // host: peerId -> DataConnection
  let syncAcc = 0;

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

  function drawBlock(ctx, x, y, color, size) {
    const px = x * size, py = y * size;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(px + 2, py + 2, Math.max(1, size - 4), Math.max(1, 2));
  }

  function drawMini(ctx, type, size) {
    ctx.clearRect(0, 0, size, size);
    if (!type) return;
    const m = SHAPES[type].m, n = m.length, bs = Math.max(8, (size / n) | 0) - 2;
    const ox = (size - n * (bs + 2)) / 2, oy = (size - n * (bs + 2)) / 2;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!m[r][c]) continue;
      ctx.fillStyle = SHAPES[type].color;
      ctx.fillRect(ox + c * (bs + 2), oy + r * (bs + 2), bs, bs);
    }
  }

  class Board {
    constructor({canvas, nextCanvas, els, live, block, playerId, nextSize}) {
      this.ctx = canvas.getContext('2d');
      this.nextCtx = nextCanvas.getContext('2d');
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
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.dropMs = 1000;
      this.acc = 0;
      this.over = false;
      this.gQueue = 0;
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
      const cleared = this.clearLines();
      if (cleared) {
        const base = [0, 100, 300, 500, 800][cleared] || 800;
        this.score += base * this.level;
        this.lines += cleared;
        this.level = 1 + ((this.lines / 10) | 0);
        this.dropMs = Math.max(120, 1000 - (this.level - 1) * 75);
        if (navigator.vibrate) navigator.vibrate(30);
        const g = GARBAGE[cleared] || 0;
        if (g) sendGarbage(this, g);
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
        const row = Array(COLS).fill('#3a3a4a');
        row[gap] = null;
        this.grid.push(row);
      }
    }

    tick(dt) {
      if (!this.canPlay()) return;
      this.acc += dt;
      if (this.acc < this.dropMs) return;
      this.acc = 0;
      if (!this.hits(this.piece.m, this.piece.x, this.piece.y + 1)) {
        this.piece.y++;
        syncState(this);
      } else this.lock();
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
    }

    draw() {
      const ctx = this.ctx, s = this.block;
      ctx.clearRect(0, 0, COLS * s, ROWS * s);
      ctx.strokeStyle = 'rgba(255,255,255,.04)';
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath(); ctx.moveTo(x * s, 0); ctx.lineTo(x * s, ROWS * s); ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * s); ctx.lineTo(COLS * s, y * s); ctx.stroke();
      }
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c]) drawBlock(ctx, c, r, this.grid[r][c], s);
      }
      if (this.piece && !this.over) {
        const gy = this.ghostY();
        ctx.globalAlpha = .25;
        for (let r = 0; r < this.piece.m.length; r++) for (let c = 0; c < this.piece.m.length; c++) {
          if (this.piece.m[r][c]) drawBlock(ctx, this.piece.x + c, gy + r, this.piece.color, s);
        }
        ctx.globalAlpha = 1;
        for (let r = 0; r < this.piece.m.length; r++) for (let c = 0; c < this.piece.m.length; c++) {
          if (this.piece.m[r][c]) drawBlock(ctx, this.piece.x + c, this.piece.y + r, this.piece.color, s);
        }
      }
    }

    snapshot() {
      return {
        t: 'state',
        from: this.playerId,
        grid: this.grid,
        piece: this.piece && {m: this.piece.m, x: this.piece.x, y: this.piece.y, color: this.piece.color},
        next: this.next,
        score: this.score,
        level: this.level,
        lines: this.lines,
        over: this.over,
      };
    }

    applyRemote(data) {
      this.grid = data.grid;
      this.piece = data.piece;
      this.next = data.next;
      this.score = data.score;
      this.level = data.level;
      this.lines = data.lines;
      this.over = !!data.over;
      this.paintHud();
      if (this.els.over) this.els.over.textContent = this.over ? t('topOut') : '';
    }
  }

  /* ---------- UI helpers ---------- */
  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

  function clearBoards() {
    boards = [];
    boardById.clear();
    boardsEl.innerHTML = '';
  }

  function createBoardSlot(playerId, label, live, large) {
    const block = large ? BLOCK_L : BLOCK_S;
    const cw = COLS * block, ch = ROWS * block;
    const nw = large ? 56 : 40;
    const box = document.createElement('div');
    box.className = 'player ' + (live ? 'you' : 'opp');
    box.dataset.id = playerId;

    const title = document.createElement('h2');
    title.textContent = label;
    box.appendChild(title);

    const row = document.createElement('div');
    row.className = 'row';

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
    row.appendChild(side);
    box.appendChild(row);
    boardsEl.appendChild(box);

    const board = new Board({
      canvas, nextCanvas: next,
      els: {
        score,
        level: meta.querySelector('.lv'),
        lines: meta.querySelector('.ln'),
        over,
        title,
        miniLabel,
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
    if (n < 2) status += t('needTwo');
    else if (readyN < n) status += t('waitReady');
    else status += t('startingSoon');
    $('lobbyStatus').textContent = status;

    const me = roster.find(p => p.id === myId);
    btnReady.textContent = me?.ready ? t('unready') : t('ready');
    btnReady.classList.toggle('ready-on', !!me?.ready);
  }

  function showLobby() {
    hide(menu);
    hide(netPanel);
    hide(gameEl);
    hide(banner);
    show(lobbyEl);
    matchPhase = 'lobby';
    $('lobbyCode').textContent = roomCode || '·····';
    lobbyName.value = getPlayerName();
    renderRoster();
  }

  function showMenu() {
    stopLoop();
    closeNet();
    running = false;
    ended = false;
    eliminated = false;
    matchPhase = 'idle';
    roster = [];
    clearBoards();
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
    roster.forEach(p => { p.alive = true; p.ready = false; });
    last = performance.now();
    stopLoop();
    raf = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function loop(t) {
    const dt = t - last;
    last = t;
    if (running && matchPhase === 'playing' && !ended) {
      tickHeldKeys(dt);
      for (const b of boards) if (b.live) b.tick(dt);
    }
    for (const b of boards) b.draw();
    raf = requestAnimationFrame(loop);
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
    if (b && b.els.over) b.els.over.textContent = t('topOut');
  }

  function checkWinner() {
    if (ended) return;
    const alive = roster.filter(p => p.alive);
    if (alive.length > 1) return;
    ended = true;
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

  function applyWin(winnerId) {
    ended = true;
    matchPhase = 'post';
    roster.forEach(p => { p.ready = false; });
    if (winnerId === myId) showBanner(t('victory'), 'win');
    else {
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

  function closeNet() {
    connections.forEach(c => { try { c.close(); } catch (_) {} });
    connections.clear();
    try { guestConn?.close(); } catch (_) {}
    try { peer?.destroy(); } catch (_) {}
    guestConn = null;
    peer = null;
    roomCode = '';
    myId = null;
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

  function fanoutGarbage(fromId, n) {
    // apply to host local board if not sender and alive
    const local = boardById.get(myId);
    if (fromId !== myId && local && !local.over && matchPhase === 'playing') {
      local.addGarbage(n);
    }
    connections.forEach((c, id) => {
      if (id === fromId) return;
      const p = roster.find(x => x.id === id);
      if (p && p.alive === false) return;
      sendTo(c, {t: 'garbage', n, from: fromId});
    });
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
    if (roster.length < 2) return;
    if (!roster.every(p => p.ready)) return;
    const ids = roster.map(p => p.id);
    broadcast({t: 'start', players: ids.map(id => {
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
    $('padTag0').textContent = getPlayerName();
    $('ctrlHint').textContent = t('ctrlHint');
    clearBoards();
    players.forEach(p => {
      createBoardSlot(p.id, p.name, p.id === myId, p.id === myId);
    });
    const you = boardsEl.querySelector('.player.you');
    if (you) boardsEl.prepend(you);
    roster = players.map(p => ({id: p.id, name: p.name, ready: false, alive: true}));
    beginMatch();
    const mine = boardById.get(myId);
    if (mine) syncState(mine, true);
  }

  function onHostData(fromId, data) {
    if (!data || typeof data !== 'object') return;
    if (data.t === 'hello') {
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
      if (!roster.find(p => p.id === fromId)) {
        roster.push({
          id: fromId,
          name: sanitizeName(data.name),
          ready: false,
          alive: true,
        });
        roster.forEach(p => { p.ready = false; });
      }
      sendTo(connections.get(fromId), {t: 'welcome', id: fromId, code: roomCode});
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
      showLobby();
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
    if (data.t === 'over') {
      markDead(data.from);
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
      connections.delete(peerId);
      if (matchPhase === 'lobby') {
        roster = roster.filter(p => p.id !== peerId);
        roster.forEach(p => { p.ready = false; });
        broadcastRoster();
      } else if (matchPhase === 'playing') {
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
      $('netStatus').textContent = t('joinedLobby');
      sendTo(c, {t: 'hello', name: getPlayerName()});
    };
    if (c.open) onOpen();
    else c.on('open', onOpen);
    c.on('data', onGuestData);
    c.on('close', () => {
      if (matchPhase !== 'idle') {
        $('ctrlHint').textContent = t('disconnected');
        if (matchPhase === 'lobby') {
          hide(lobbyEl);
          showMenu();
        }
      }
    });
    c.on('error', () => {
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
    peer = new Peer(code);
    peer.on('open', id => showHostUI(id));
    peer.on('connection', c => {
      if (matchPhase !== 'lobby') {
        c.on('open', () => {
          sendTo(c, {t: 'reject', reason: 'match_started'});
          c.close();
        });
        return;
      }
      if (roster.length >= MAX_PLAYERS) {
        c.on('open', () => {
          sendTo(c, {t: 'reject', reason: 'room_full'});
          c.close();
        });
        return;
      }
      wireHostConn(c);
    });
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
    peer = new Peer();
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
  const DAS_MS = 100;
  const ARR_MS = 25;
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
  }

  document.addEventListener('keydown', e => {
    if (matchPhase !== 'playing' || ended || eliminated) return;
    // Don't steal typing from name/code fields
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const k = e.key;
    if (k === 'a' || k === 'A') {
      if (e.repeat) { e.preventDefault(); return; }
      pressHorz(-1);
      e.preventDefault();
      return;
    }
    if (k === 'd' || k === 'D') {
      if (e.repeat) { e.preventDefault(); return; }
      pressHorz(1);
      e.preventDefault();
      return;
    }
    if (k === 's' || k === 'S') {
      if (e.repeat) { e.preventDefault(); return; }
      held.soft = true;
      softAcc = SOFT_MS; // soft once immediately
      e.preventDefault();
      return;
    }
    if (k === 'w' || k === 'W') {
      if (e.repeat) { e.preventDefault(); return; }
      act('rot');
      e.preventDefault();
      return;
    }
    if (k === ' ') {
      if (e.repeat) { e.preventDefault(); return; }
      act('hard');
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', e => {
    const k = e.key;
    if (k === 'a' || k === 'A') releaseHorz(-1);
    else if (k === 'd' || k === 'D') releaseHorz(1);
    else if (k === 's' || k === 'S') {
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
  applyI18n();
})();
