(function () {
  'use strict';

  // ── Triple-click detector ─────────────────────────────────────────────────
  var clickTimes = [];
  var logo = document.querySelector('.nav-logo-img');
  if (!logo) return;

  logo.addEventListener('click', function () {
    var now = Date.now();
    clickTimes.push(now);
    clickTimes = clickTimes.filter(function (t) { return now - t < 2000; });
    if (clickTimes.length >= 3) {
      clickTimes = [];
      launchGame();
    }
  });

  // ── Palette Canix ─────────────────────────────────────────────────────────
  var COLORS = {
    bg:     '#0f2444',
    ball:   '#F4A93A',
    paddle: '#F4A93A',
    bricks: ['#F4A93A', '#C47B22', '#2563eb', '#1e3a5f', '#7FB3D3'],
    btnBg:  '#2563eb',
    text:   '#ffffff',
  };

  // ── Fixed logical canvas size ─────────────────────────────────────────────
  var CW = 800, CH = 520;
  var COLS = 8, ROWS = 5;
  var BRICK_H = 22, BRICK_PAD = 6;
  var BRICK_TOP = 55;   // y where first brick row starts (below HUD)
  var PADDLE_Y = CH - 40;

  function launchGame() {
    if (document.getElementById('eg-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'eg-overlay';
    overlay.className = 'eg-overlay';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'eg-close';
    closeBtn.setAttribute('aria-label', 'Fermer');
    closeBtn.textContent = '✕';

    var canvas = document.createElement('canvas');
    canvas.id = 'eg-canvas';
    canvas.className = 'eg-canvas';
    canvas.width  = CW;
    canvas.height = CH;

    overlay.appendChild(closeBtn);
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    var ctx = canvas.getContext('2d');
    var raf;

    function close() {
      cancelAnimationFrame(raf);
      document.body.removeChild(overlay);
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup',   onKeyUp);
      window.removeEventListener('mousemove', onMouse);
    }

    closeBtn.addEventListener('click', close);

    var state = {
      score: 0, lives: 3,
      phase: 'play',
      keys: { left: false, right: false },
      mouseX: null,
      paddle: { x: CW / 2 - 55, y: PADDLE_Y, w: 110, h: 14 },
      ball: null,
      bricks: [],
      replayBtn: null,
    };

    // ── Bricks ───────────────────────────────────────────────────────────────
    function initBricks() {
      var bw = (CW - BRICK_PAD * (COLS + 1)) / COLS;
      state.bricks = [];
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          state.bricks.push({
            x: BRICK_PAD + c * (bw + BRICK_PAD),
            y: BRICK_TOP + r * (BRICK_H + BRICK_PAD),
            w: bw, h: BRICK_H,
            color: COLORS.bricks[r % COLORS.bricks.length],
            alive: true,
          });
        }
      }
    }

    function resetBall() {
      state.ball = {
        x: CW / 2,
        y: PADDLE_Y - 30,
        vx: 3.5 * (Math.random() > 0.5 ? 1 : -1),
        vy: -4.5,
      };
    }

    initBricks();
    resetBall();

    // ── Input ─────────────────────────────────────────────────────────────────
    function onKeyDown(e) {
      if (e.key === 'Escape')      { close(); return; }
      if (e.key === 'ArrowLeft')   state.keys.left  = true;
      if (e.key === 'ArrowRight')  state.keys.right = true;
    }
    function onKeyUp(e) {
      if (e.key === 'ArrowLeft')   state.keys.left  = false;
      if (e.key === 'ArrowRight')  state.keys.right = false;
    }
    function onMouse(e) {
      // Scale mouse coords from CSS pixels to canvas logical pixels
      var rect = canvas.getBoundingClientRect();
      var scaleX = CW / rect.width;
      state.mouseX = (e.clientX - rect.left) * scaleX;
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup',   onKeyUp);
    window.addEventListener('mousemove', onMouse);

    // ── Update ────────────────────────────────────────────────────────────────
    function update() {
      if (state.phase !== 'play') return;

      var pw = state.paddle.w;

      if (state.mouseX !== null) {
        state.paddle.x = state.mouseX - pw / 2;
      }
      if (state.keys.left)  state.paddle.x -= 7;
      if (state.keys.right) state.paddle.x += 7;
      state.paddle.x = Math.max(0, Math.min(CW - pw, state.paddle.x));

      var b = state.ball, r = 8;
      b.x += b.vx;
      b.y += b.vy;

      if (b.x - r < 0)   { b.x = r;      b.vx =  Math.abs(b.vx); }
      if (b.x + r > CW)  { b.x = CW - r; b.vx = -Math.abs(b.vx); }
      if (b.y - r < 0)   { b.y = r;      b.vy =  Math.abs(b.vy); }

      // Paddle collision
      var px = state.paddle.x, py = state.paddle.y, ph = state.paddle.h;
      if (b.vy > 0 && b.y + r >= py && b.y + r <= py + ph &&
          b.x >= px && b.x <= px + pw) {
        var rel = (b.x - (px + pw / 2)) / (pw / 2);
        b.vx = rel * 5;
        b.vy = -Math.abs(b.vy);
        b.y  = py - r;
      }

      // Bottom → lose life
      if (b.y - r > CH) {
        state.lives--;
        if (state.lives <= 0) { state.phase = 'gameover'; return; }
        resetBall();
      }

      // Brick collision
      var remaining = 0;
      state.bricks.forEach(function (bk) {
        if (!bk.alive) return;
        remaining++;
        if (b.x + r > bk.x && b.x - r < bk.x + bk.w &&
            b.y + r > bk.y && b.y - r < bk.y + bk.h) {
          bk.alive = false;
          state.score += 10;
          remaining--;
          var ol = b.x + r - bk.x, or2 = bk.x + bk.w - (b.x - r);
          var ot = b.y + r - bk.y, ob  = bk.y + bk.h - (b.y - r);
          if (Math.min(ol, or2) < Math.min(ot, ob)) b.vx = -b.vx; else b.vy = -b.vy;
        }
      });
      if (remaining === 0) state.phase = 'win';
    }

    // ── Draw ──────────────────────────────────────────────────────────────────
    function draw() {
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, CW, CH);

      // HUD
      ctx.fillStyle = COLORS.text;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('Score : ' + state.score, 14, 26);

      var hearts = '♥ '.repeat(state.lives).trim();
      ctx.textAlign = 'right';
      ctx.fillText('Vies : ' + hearts, CW - 14, 26);
      ctx.textAlign = 'left';

      // Bricks
      state.bricks.forEach(function (bk) {
        if (!bk.alive) return;
        ctx.fillStyle = bk.color;
        ctx.beginPath();
        ctx.roundRect(bk.x, bk.y, bk.w, bk.h, 3);
        ctx.fill();
      });

      // Paddle
      ctx.fillStyle = COLORS.paddle;
      ctx.beginPath();
      ctx.roundRect(state.paddle.x, state.paddle.y, state.paddle.w, state.paddle.h, 6);
      ctx.fill();

      // Ball
      ctx.fillStyle = COLORS.ball;
      ctx.beginPath();
      ctx.arc(state.ball.x, state.ball.y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Game over / win overlay
      if (state.phase === 'gameover' || state.phase === 'win') {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, CW, CH);

        var msg = state.phase === 'win' ? '🎉 Gagné !' : '💀 Game Over';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 38px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(msg, CW / 2, CH / 2 - 40);
        ctx.font = '20px system-ui, sans-serif';
        ctx.fillText('Score final : ' + state.score, CW / 2, CH / 2);

        var btn = { x: CW / 2 - 70, y: CH / 2 + 30, w: 140, h: 44 };
        state.replayBtn = btn;
        ctx.fillStyle = COLORS.btnBg;
        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 8);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillText('Rejouer', CW / 2, btn.y + btn.h / 2);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    }

    // Rejouer click — scale canvas coords
    canvas.addEventListener('click', function (e) {
      if (state.phase !== 'gameover' && state.phase !== 'win') return;
      var rect = canvas.getBoundingClientRect();
      var mx = (e.clientX - rect.left) * (CW / rect.width);
      var my = (e.clientY - rect.top)  * (CH / rect.height);
      var btn = state.replayBtn;
      if (btn && mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
        state.score = 0; state.lives = 3; state.phase = 'play';
        initBricks(); resetBall();
      }
    });

    function loop() { update(); draw(); raf = requestAnimationFrame(loop); }
    raf = requestAnimationFrame(loop);
  }
})();
