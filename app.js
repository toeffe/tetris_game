/* STONEFALL — local duel + short-code PeerJS remote */
(() => {
  const COLS = 10, ROWS = 20, BLOCK = 20;
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

  const $ = id => document.getElementById(id);
  const menu = $('menu'), netPanel = $('netPanel'), gameEl = $('game');
  const banner = $('banner'), btnAgain = $('btnAgain');

  let mode = null; // 'local' | 'host' | 'guest'
  let boards = [null, null];
  let remoteView = null;
  let running = false, ended = false;
  let last = 0, raf = 0;
  let peer = null, conn = null, roomCode = '';
  let localReady = false, remoteReady = false;
  let p1Ready = false, p2Ready = false;

  function rotate(m) {
    const n = m.length, out = Array.from({length:n}, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out[c][n-1-r] = m[r][c];
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
    ctx.fillRect(px + 2, py + 2, size - 4, 2);
  }

  function drawMini(ctx, type) {
    ctx.clearRect(0, 0, 56, 56);
    if (!type) return;
    const m = SHAPES[type].m, n = m.length, bs = 12;
    const ox = (56 - n * bs) / 2, oy = (56 - n * bs) / 2;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!m[r][c]) continue;
      ctx.fillStyle = SHAPES[type].color;
      ctx.fillRect(ox + c * bs + 1, oy + r * bs + 1, bs - 2, bs - 2);
    }
  }

  class Board {
    constructor(canvas, nextCanvas, ids, live) {
      this.ctx = canvas.getContext('2d');
      this.nextCtx = nextCanvas.getContext('2d');
      this.ids = ids;
      this.live = live;
      this.reset();
    }

    reset() {
      this.grid = Array.from({length:ROWS}, () => Array(COLS).fill(null));
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
      $(this.ids.over).textContent = '';
    }

    spawn() {
      const type = this.next;
      this.next = bagPiece(this.bag);
      const shape = SHAPES[type];
      const m = shape.m.map(r => r.slice());
      this.piece = {type, m, color:shape.color, x:((COLS - m.length) / 2) | 0, y:0};
      if (this.hits(this.piece.m, this.piece.x, this.piece.y)) {
        this.over = true;
        $(this.ids.over).textContent = 'TOP OUT';
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

    move(dx) {
      if (!this.live || this.over || ended) return;
      if (!this.hits(this.piece.m, this.piece.x + dx, this.piece.y)) {
        this.piece.x += dx;
        syncState(this);
      }
    }

    rot() {
      if (!this.live || this.over || ended) return;
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
      if (!this.live || this.over || ended) return;
      if (!this.hits(this.piece.m, this.piece.x, this.piece.y + 1)) {
        this.piece.y++;
        this.score += 1;
        this.acc = 0;
        this.paintHud();
        syncState(this);
      } else this.lock();
    }

    hard() {
      if (!this.live || this.over || ended) return;
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
      if (!this.live || this.over || ended) return;
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
      $(this.ids.score).textContent = this.score;
      $(this.ids.level).textContent = this.level;
      $(this.ids.lines).textContent = this.lines;
      drawMini(this.nextCtx, this.next);
    }

    draw() {
      const ctx = this.ctx, s = BLOCK;
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
      this.over = data.over;
      this.paintHud();
      if (data.over) $(this.ids.over).textContent = 'TOP OUT';
    }
  }

  /* ---------- modes / lifecycle ---------- */
  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

  function showMenu() {
    stopLoop();
    closeNet();
    running = false;
    ended = false;
    localReady = false;
    remoteReady = false;
    p1Ready = false;
    p2Ready = false;
    hide(gameEl);
    hide(netPanel);
    hide(banner);
    hide(btnAgain);
    btnAgain.disabled = false;
    btnAgain.textContent = 'Play again';
    show(menu);
  }

  function startLocal() {
    mode = 'local';
    hide(menu);
    hide(netPanel);
    show(gameEl);
    $('p1Title').textContent = 'P1';
    $('p2Title').textContent = 'P2';
    $('ctrlHint').textContent = 'P1: WASD + space · P2: arrows + Shift hard-drop';
    show($('pad2'));
    $('p2Box').hidden = false;
    boards[0] = new Board($('c1'), $('n1'), {score:'s1', level:'l1', lines:'ln1', over:'o1'}, true);
    boards[1] = new Board($('c2'), $('n2'), {score:'s2', level:'l2', lines:'ln2', over:'o2'}, true);
    remoteView = null;
    beginMatch();
  }

  function beginMatch() {
    ended = false;
    localReady = false;
    remoteReady = false;
    p1Ready = false;
    p2Ready = false;
    running = true;
    hide(banner);
    hide(btnAgain);
    btnAgain.disabled = false;
    btnAgain.textContent = 'Play again';
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
    if (running && !ended) {
      if (boards[0]?.live) boards[0].tick(dt);
      if (boards[1]?.live) boards[1].tick(dt);
    }
    boards[0]?.draw();
    boards[1]?.draw();
    raf = requestAnimationFrame(loop);
  }

  function opponentOf(board) {
    if (mode === 'local') return board === boards[0] ? boards[1] : boards[0];
    return null;
  }

  function sendGarbage(from, n) {
    if (mode === 'local') {
      const opp = opponentOf(from);
      if (opp && !opp.over) opp.addGarbage(n);
      return;
    }
    netSend({t: 'garbage', n});
  }

  let syncAcc = 0;
  function syncState(board, force) {
    if (mode === 'local' || !board.live) return;
    if (!force) {
      syncAcc++;
      if (syncAcc < 3) return;
    }
    syncAcc = 0;
    netSend(board.snapshot());
  }

  function onTopOut(board) {
    if (ended) return;
    ended = true;
    localReady = false;
    remoteReady = false;
    p1Ready = false;
    p2Ready = false;
    if (mode === 'local') {
      const win = opponentOf(board);
      const youWin = win && !win.over;
      showBanner(youWin ? (board === boards[0] ? 'P2 WINS' : 'P1 WINS') : 'DRAW', youWin ? 'win' : 'lose');
      btnAgain.textContent = 'P1 ready';
    } else if (board.live) {
      netSend({t: 'over'});
      showBanner('DEFEAT', 'lose');
      btnAgain.textContent = 'Play again';
    }
    btnAgain.disabled = false;
    show(btnAgain);
    updateRematchHint();
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
    if (mode === 'local') {
      if (p1Ready && p2Ready) hint.textContent = 'Starting…';
      else if (p1Ready) hint.textContent = 'Waiting for P2…';
      else if (p2Ready) hint.textContent = 'Waiting for P1…';
      else hint.textContent = 'Both players must ready up';
      return;
    }
    if (localReady && remoteReady) hint.textContent = 'Starting…';
    else if (localReady) hint.textContent = 'Waiting for opponent…';
    else if (remoteReady) hint.textContent = 'Opponent is ready';
    else hint.textContent = 'Both must click Play again';
  }

  function tryStartRematch() {
    if (mode === 'local') {
      if (!p1Ready || !p2Ready) return;
      boards[0].reset();
      boards[1].reset();
      beginMatch();
      return;
    }
    if (!localReady || !remoteReady) return;
    boards[0].reset();
    if (boards[1]) {
      boards[1].reset();
      $(boards[1].ids.over).textContent = '';
    }
    beginMatch();
  }

  function rematch() {
    if (!ended) return;
    if (mode === 'local') {
      if (!p1Ready) {
        p1Ready = true;
        btnAgain.textContent = 'P2 ready';
        updateRematchHint();
        tryStartRematch();
        return;
      }
      if (!p2Ready) {
        p2Ready = true;
        btnAgain.disabled = true;
        btnAgain.textContent = 'Ready';
        updateRematchHint();
        tryStartRematch();
      }
      return;
    }
    if (localReady) return;
    localReady = true;
    btnAgain.disabled = true;
    btnAgain.textContent = 'Ready';
    netSend({t: 'rematch'});
    updateRematchHint();
    tryStartRematch();
  }

  /* ---------- PeerJS short room codes ---------- */
  function makeCode() {
    let s = '';
    for (let i = 0; i < 5; i++) s += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
    return s;
  }

  function closeNet() {
    try { conn?.close(); } catch (_) {}
    try { peer?.destroy(); } catch (_) {}
    conn = null;
    peer = null;
    roomCode = '';
  }

  function netSend(msg) {
    if (conn && conn.open) {
      try { conn.send(msg); } catch (_) {}
    }
  }

  function onNetMessage(data) {
    if (!data || typeof data !== 'object') return;
    if (data.t === 'state' && boards[1]) boards[1].applyRemote(data);
    else if (data.t === 'garbage' && boards[0]) boards[0].addGarbage(data.n);
    else if (data.t === 'over') {
      if (!ended) {
        ended = true;
        localReady = false;
        remoteReady = false;
        if (boards[1]) $(boards[1].ids.over).textContent = 'TOP OUT';
        showBanner('VICTORY', 'win');
        btnAgain.textContent = 'Play again';
        btnAgain.disabled = false;
        show(btnAgain);
        updateRematchHint();
      }
    } else if (data.t === 'rematch') {
      remoteReady = true;
      updateRematchHint();
      tryStartRematch();
    } else if (data.t === 'hello') {
      netSend(boards[0]?.snapshot());
    }
  }

  function wireConn(c) {
    conn = c;
    const start = () => {
      $('netStatus').textContent = 'Connected — starting…';
      startRemoteGame();
    };
    if (c.open) start();
    else c.on('open', start);
    c.on('data', onNetMessage);
    c.on('close', () => {
      if (running) $('ctrlHint').textContent = 'Opponent disconnected.';
    });
    c.on('error', () => {
      $('netStatus').textContent = 'Connection error.';
    });
  }

  function startRemoteGame() {
    hide(menu);
    hide(netPanel);
    show(gameEl);
    $('p1Title').textContent = 'You';
    $('p2Title').textContent = 'Opponent';
    $('ctrlHint').textContent = 'WASD + space · remote is best-effort';
    hide($('pad2'));
    $('p2Box').hidden = false;
    boards[0] = new Board($('c1'), $('n1'), {score:'s1', level:'l1', lines:'ln1', over:'o1'}, true);
    boards[1] = new Board($('c2'), $('n2'), {score:'s2', level:'l2', lines:'ln2', over:'o2'}, false);
    remoteView = boards[1];
    netSend({t: 'hello'});
    netSend(boards[0].snapshot());
    beginMatch();
  }

  function showHostUI(code) {
    $('netLabel').textContent = 'Share this code with your opponent.';
    $('roomCode').textContent = code;
    show($('roomCode'));
    show($('btnCopy'));
    hide($('netIn'));
    hide($('btnNetGo'));
    $('netStatus').textContent = 'Waiting for them to join…';
  }

  function showJoinUI() {
    $('netLabel').textContent = 'Enter their 5-character code.';
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
    const code = makeCode();
    roomCode = code;
    peer = new Peer(code);
    peer.on('open', id => showHostUI(id));
    peer.on('connection', c => {
      wireConn(c);
    });
    peer.on('error', err => {
      if (err.type === 'unavailable-id' && attempt < 8) {
        hostRoom(attempt + 1);
        return;
      }
      $('netStatus').textContent = 'Could not create room (' + (err.type || 'error') + '). Try again.';
    });
  }

  function joinRoom() {
    const code = ($('netIn').value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) {
      $('netStatus').textContent = 'Need a 5-character code.';
      return;
    }
    closeNet();
    mode = 'guest';
    $('btnNetGo').disabled = true;
    $('netStatus').textContent = 'Connecting…';
    peer = new Peer();
    peer.on('open', () => {
      wireConn(peer.connect(code, {reliable: true}));
    });
    peer.on('error', err => {
      $('btnNetGo').disabled = false;
      $('netStatus').textContent = 'Join failed (' + (err.type || 'error') + ').';
    });
  }

  function openNetUI(kind) {
    hide(menu);
    show(netPanel);
    $('btnNetGo').disabled = false;
    if (kind === 'host') hostRoom(0);
    else {
      mode = 'guest';
      showJoinUI();
    }
  }

  /* ---------- input ---------- */
  function act(who, action) {
    const b = boards[who];
    if (!b || !b.live || ended) return;
    if (action === 'left') b.move(-1);
    else if (action === 'right') b.move(1);
    else if (action === 'rot') b.rot();
    else if (action === 'soft') b.soft();
    else if (action === 'hard') b.hard();
  }

  document.addEventListener('keydown', e => {
    if (!running || ended) return;
    const k = e.key;

    const p1 = {a:'left', A:'left', d:'right', D:'right', w:'rot', W:'rot', s:'soft', S:'soft', ' ':'hard'};
    if (p1[k]) {
      act(0, p1[k]);
      e.preventDefault();
      return;
    }
    if (mode === 'local') {
      const p2 = {
        ArrowLeft:'left', ArrowRight:'right', ArrowUp:'rot', ArrowDown:'soft'
      };
      if (p2[k]) { act(1, p2[k]); e.preventDefault(); }
      else if (k === 'Shift') { act(1, 'hard'); e.preventDefault(); }
    }
  });

  document.querySelectorAll('.pad').forEach(pad => {
    const who = +pad.dataset.who;
    pad.querySelectorAll('button[data-act]').forEach(btn => {
      const fire = ev => {
        ev.preventDefault();
        act(who, btn.dataset.act);
      };
      btn.addEventListener('pointerdown', fire);
      btn.addEventListener('click', ev => ev.preventDefault());
    });
  });

  /* ---------- UI wiring ---------- */
  $('btnLocal').onclick = startLocal;
  $('btnHost').onclick = () => openNetUI('host');
  $('btnJoin').onclick = () => openNetUI('guest');
  $('btnNetBack').onclick = showMenu;
  $('btnNetGo').onclick = joinRoom;
  $('netIn').addEventListener('keydown', e => {
    if (e.key === 'Enter') joinRoom();
  });
  $('netIn').addEventListener('input', () => {
    const el = $('netIn');
    const cur = el.selectionStart;
    el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    el.setSelectionRange(cur, cur);
  });
  $('btnCopy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(roomCode || $('roomCode').textContent);
      $('netStatus').textContent = 'Copied — waiting for them to join…';
    } catch (_) {
      $('netStatus').textContent = 'Copy failed — share the code manually.';
    }
  };
  $('btnMenu').onclick = showMenu;
  $('btnAgain').onclick = rematch;
})();
