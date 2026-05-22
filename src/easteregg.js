(function () {
  'use strict';

  // ── Triple-click detector ────────────────────────────────────────────────
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

  // ── Canix palette ────────────────────────────────────────────────────────
  var COLORS = {
    bg:      '#0f2444',
    overlay: 'rgba(10, 20, 40, 0.92)',
    ball:    '#F4A93A',
    paddle:  '#F4A93A',
    score:   '#ffffff',
    bricks: [
      '#F4A93A', // orange café
      '#C47B22', // brun foncé
      '#2563eb', // accent bleu
      '#1e3a5f', // bleu mid
      '#7FB3D3', // bleu clair
    ],
    btnBg:   '#2563eb',
    btnText: '#ffffff',
  };

  var COLS = 8, ROWS = 5;
  var BRICK_PAD = 6;

  // ── DOM setup ─────────────────────────────────────────────────────────────
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

    overlay.appendChild(closeBtn);
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);

    // prevent body scroll
    document.body.style.overflow = 'hidden';

    function close() {
      cancelAnimationFrame(raf);
      document.body.removeChild(overlay);
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousemove', onMouse);
    }

    closeBtn.addEventListener('click', close);

    var raf, state;

    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowLeft')  state.keys.left  = true;
      if (e.key === 'ArrowRight') state.keys.right = true;
    }
    function onKeyUp(e) {
      if (e.key === 'ArrowLeft')  state.keys.left  = false;
      if (e.key === 'ArrowRight') state.keys.right = false;
    }
    function onMouse(e) {
      var rect = canvas.getBoundingClientRect();
      state.mouseX = e.clientX - rect.left;
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouse);

    // size canvas to window
    function resize() {
      canvas.width  = Math.min(window.innerWidth  - 32, 800);
      canvas.height = Math.min(window.innerHeight - 80, 600);
      if (state) initBricks();
    }

    window.addEventListener('resize', resize);

    // ── Game state ─────────────────────────────────────────────────────────
    function initBricks() {
      var bw = (canvas.width - BRICK_PAD * (COLS + 1)) / COLS;
      var bh = 24;
      state.bricks = [];
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          state.bricks.push({
            x: BRICK_PAD + c * (bw + BRICK_PAD),
            y: 60 + r * (bh + BRICK_PAD),
            w: bw,
            h: bh,
            color: COLORS.bricks[r % COLORS.bricks.length],
            alive: true,
          });
        }
      }
    }

    function resetBall() {
      var cx = canvas.width / 2;
      state.ball = { x: cx, y: canvas.height * 0.6, vx: 3.5 * (Math.random() > 0.5 ? 1 : -1), vy: -4 };
    }

    state = {
      score: 0,
      lives: 3,
      phase: 'play', // 'play' | 'gameover' | 'win'
      keys: { left: false, right: false },
      mouseX: null,
      paddle: { w: 100, h: 12, y: 0 },
      ball: null,
      bricks: [],
    };
    state.paddle.x = canvas.width / 2 - state.paddle.w / 2;
    state.paddle.y = canvas.height - 40;
    resize();
    resetBall();

    // ── Loop ───────────────────────────────────────────────────────────────
    var ctx = canvas.getContext('2d');

    function update() {
      if (state.phase !== 'play') return;

      var pw = state.paddle.w, ph = state.paddle.h;
      var speed = 7;

      // paddle movement
      if (state.mouseX !== null) {
        state.paddle.x = state.mouseX - pw / 2;
      }
      if (state.keys.left)  state.paddle.x -= speed;
      if (state.keys.right) state.paddle.x += speed;
      state.paddle.x = Math.max(0, Math.min(canvas.width - pw, state.paddle.x));

      // ball movement
      var b = state.ball;
      b.x += b.vx;
      b.y += b.vy;
      var r = 8;

      // wall bounce
      if (b.x - r < 0)            { b.x = r;                   b.vx = Math.abs(b.vx); }
      if (b.x + r > canvas.width) { b.x = canvas.width - r;    b.vx = -Math.abs(b.vx); }
      if (b.y - r < 0)            { b.y = r;                   b.vy = Math.abs(b.vy); }

      // paddle collision
      var px = state.paddle.x, py = state.paddle.y;
      if (b.y + r >= py && b.y + r <= py + ph && b.x >= px && b.x <= px + pw && b.vy > 0) {
        var rel = (b.x - (px + pw / 2)) / (pw / 2);
        b.vx = rel * 5;
        b.vy = -Math.abs(b.vy);
        b.y = py - r;
      }

      // bottom
      if (b.y - r > canvas.height) {
        state.lives--;
        if (state.lives <= 0) { state.phase = 'gameover'; return; }
        resetBall();
      }

      // brick collision
      var alive = 0;
      state.bricks.forEach(function (brick) {
        if (!brick.alive) return;
        alive++;
        if (b.x + r > brick.x && b.x - r < brick.x + brick.w &&
            b.y + r > brick.y && b.y - r < brick.y + brick.h) {
          brick.alive = false;
          state.score += 10;
          alive--;
          // determine bounce axis
          var overlapL = b.x + r - brick.x;
          var overlapR = brick.x + brick.w - (b.x - r);
          var overlapT = b.y + r - brick.y;
          var overlapB = brick.y + brick.h - (b.y - r);
          var minH = Math.min(overlapL, overlapR);
          var minV = Math.min(overlapT, overlapB);
          if (minH < minV) b.vx = -b.vx; else b.vy = -b.vy;
        }
      });
      if (alive === 0) state.phase = 'win';
    }

    function draw() {
      var w = canvas.width, h = canvas.height;
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, w, h);

      // score + lives
      ctx.fillStyle = COLORS.score;
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText('Score : ' + state.score, 16, 34);
      ctx.fillText('Vies : ' + '♥ '.repeat(state.lives).trim(), w - 100, 34);

      // bricks
      state.bricks.forEach(function (brick) {
        if (!brick.alive) return;
        ctx.fillStyle = brick.color;
        ctx.beginPath();
        ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 4);
        ctx.fill();
      });

      // paddle
      ctx.fillStyle = COLORS.paddle;
      ctx.beginPath();
      ctx.roundRect(state.paddle.x, state.paddle.y, state.paddle.w, state.paddle.h, 6);
      ctx.fill();

      // ball
      var b = state.ball;
      ctx.fillStyle = COLORS.ball;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
      ctx.fill();

      // overlay messages
      if (state.phase === 'gameover' || state.phase === 'win') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, w, h);

        var msg = state.phase === 'win' ? '🎉 Gagné !' : '💀 Game Over';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(msg, w / 2, h / 2 - 30);
        ctx.font = '20px system-ui, sans-serif';
        ctx.fillText('Score final : ' + state.score, w / 2, h / 2 + 10);
        ctx.textAlign = 'left';

        // Rejouer button area stored for click
        state.replayBtn = { x: w / 2 - 70, y: h / 2 + 40, w: 140, h: 44 };
        ctx.fillStyle = COLORS.btnBg;
        ctx.beginPath();
        ctx.roundRect(state.replayBtn.x, state.replayBtn.y, state.replayBtn.w, state.replayBtn.h, 8);
        ctx.fill();
        ctx.fillStyle = COLORS.btnText;
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Rejouer', w / 2, h / 2 + 68);
        ctx.textAlign = 'left';
      }
    }

    canvas.addEventListener('click', function (e) {
      if (state.phase !== 'gameover' && state.phase !== 'win') return;
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var btn = state.replayBtn;
      if (btn && mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
        state.score = 0;
        state.lives = 3;
        state.phase = 'play';
        initBricks();
        resetBall();
      }
    });

    function loop() {
      update();
      draw();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
  }
})();
