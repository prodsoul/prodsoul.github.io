/* Secret mini game, loaded only when someone runs ./tetris. Phosphor-style Tetris with keyboard and touch controls. */
(function () {
  var SHAPES = {
    I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
    S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]]
  };
  var NAMES = "IOTSZJL", ALPHA = { I: 1, O: 0.55, T: 0.8, S: 0.65, Z: 0.9, J: 0.45, L: 0.72 };
  var W = 10, H = 20;

  function rotate(cells, size, dir) {
    return cells.map(function (c) { return dir > 0 ? [size - 1 - c[1], c[0]] : [c[1], size - 1 - c[0]]; });
  }

  function start(opts) {
    var host = opts.host, A = opts.A, mobile = opts.mobile;
    var root = document.createElement("div"); root.className = "game";
    root.innerHTML = '<button class="quit" type="button">' + (mobile ? "quit" : "esc: quit") + '</button><div class="box"><canvas></canvas><div class="side">' +
      '<div class="big">T E T R I S</div><div class="stat">score <b id="g-score">0</b></div><div class="stat">lines <b id="g-lines">0</b></div><div class="stat">level <b id="g-level">1</b></div><div class="stat dim">best <span id="g-best">0</span></div>' +
      '<div class="nextbox"><div class="dim">next</div><canvas id="g-next" width="96" height="64"></canvas></div>' +
      '<div class="keys">arrows / wasd  move<br>up / w / x  rotate<br>z  rotate back<br>space  hard drop<br>p  pause<br>esc / q  quit</div></div>' +
      '<div class="pad"><button type="button" data-k="left" aria-label="Move left">&lt;</button><button type="button" data-k="right" aria-label="Move right">&gt;</button><button type="button" data-k="rot">turn</button><button type="button" data-k="down">down</button><button type="button" data-k="drop">drop</button></div></div>' +
      '<div class="msg" id="g-msg"></div>';
    host.appendChild(root);
    var cv = root.querySelector("canvas"), ctx = cv.getContext("2d"), nx = root.querySelector("#g-next"), nctx = nx.getContext("2d");
    var cell = 28;
    if (mobile) {
      /* give the board whatever height is left once the stats and buttons are laid out */
      var box = root.querySelector(".box"), bs = getComputedStyle(box); cv.width = cv.height = 0;
      var free = box.clientHeight - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom) - 2 * parseFloat(bs.rowGap) - root.querySelector(".side").offsetHeight - root.querySelector(".pad").offsetHeight - 2;
      cell = Math.max(10, Math.floor(Math.min(free / H, (box.clientWidth - 32) / W)));
    }
    cv.width = W * cell; cv.height = H * cell;
    var q = function (s) { return root.querySelector(s); };
    var best = 0; try { best = +localStorage.getItem("jb-tetris-hi") || 0; } catch (e) {}
    q("#g-best").textContent = best;
    var rgb = (getComputedStyle(document.documentElement).getPropertyValue("--fg-rgb") || "93,255,122").trim();

    var grid, cur, bag, nextType, score, lines, level, dropT, lockT, over, paused, clearing, raf, last, dead = false, msgEl = q("#g-msg");
    function newBag() { var b = NAMES.split(""); for (var i = b.length - 1; i > 0; i--) { var j = Math.random() * (i + 1) | 0, t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
    function draw7() { if (!bag || !bag.length) bag = newBag(); return bag.pop(); }
    function spawn() {
      var type = nextType || draw7(); nextType = draw7();
      var size = type === "I" ? 4 : type === "O" ? 4 : 3, cells = SHAPES[type].map(function (c) { return c.slice(); });
      cur = { type: type, size: size, cells: cells, x: type === "O" || type === "I" ? 3 : 3, y: type === "I" ? -1 : 0 };
      lockT = 0; if (collides(cur.cells, cur.x, cur.y)) gameOver(); drawNext();
    }
    function collides(cells, x, y) {
      for (var i = 0; i < cells.length; i++) {
        var cx = cells[i][0] + x, cy = cells[i][1] + y;
        if (cx < 0 || cx >= W || cy >= H) return true; if (cy >= 0 && grid[cy][cx]) return true;
      } return false;
    }
    function reset() {
      grid = []; for (var r = 0; r < H; r++) grid.push(new Array(W).fill(0));
      bag = null; nextType = null; score = 0; lines = 0; level = 1; dropT = 0; over = false; paused = false; clearing = null; msgEl.textContent = ""; spawn(); hud();
    }
    function hud() { q("#g-score").textContent = score; q("#g-lines").textContent = lines; q("#g-level").textContent = level; }
    function speed() { return Math.max(0.05, Math.pow(0.8 - (level - 1) * 0.007, level - 1)); }
    function move(dx) { if (!collides(cur.cells, cur.x + dx, cur.y)) { cur.x += dx; lockT = 0; A.t.move(); } }
    function rot(dir) {
      if (cur.type === "O") return; var nc = rotate(cur.cells, cur.size, dir), kicks = [0, -1, 1, -2, 2];
      for (var i = 0; i < kicks.length; i++) if (!collides(nc, cur.x + kicks[i], cur.y)) { cur.cells = nc; cur.x += kicks[i]; lockT = 0; A.t.rot(); return; }
      if (!collides(nc, cur.x, cur.y - 1)) { cur.cells = nc; cur.y -= 1; A.t.rot(); }
    }
    function soft() { if (!collides(cur.cells, cur.x, cur.y + 1)) { cur.y++; score += 1; hud(); } else lock(); }
    function hard() { var n = 0; while (!collides(cur.cells, cur.x, cur.y + 1)) { cur.y++; n++; } score += n * 2; A.t.drop(); lock(); }
    function lock() {
      cur.cells.forEach(function (c) { var y = c[1] + cur.y, x = c[0] + cur.x; if (y >= 0) grid[y][x] = cur.type; });
      A.t.lock(); var full = [];
      for (var r = 0; r < H; r++) if (grid[r].every(function (v) { return v; })) full.push(r);
      if (full.length) { clearing = { rows: full, t: 0 }; A.t.clear(full.length); } else spawn();
      cur = clearing ? null : cur; hud();
    }
    function finishClear() {
      var rows = clearing.rows, n = rows.length;
      rows.forEach(function (r) { grid.splice(r, 1); grid.unshift(new Array(W).fill(0)); });
      score += [0, 100, 300, 500, 800][n] * level; lines += n;
      var nl = 1 + Math.floor(lines / 10); if (nl > level) { level = nl; A.t.level(); }
      clearing = null; hud(); spawn();
    }
    function gameOver() {
      over = true; A.t.over(); msgEl.innerHTML = "GAME OVER<br><span style='font-size:.6em'>" + (mobile ? "tap the board to play again" : "enter / tap: again &nbsp; esc: quit") + "</span>";
      if (score > best) { best = score; try { localStorage.setItem("jb-tetris-hi", best); } catch (e) {} q("#g-best").textContent = best; }
    }
    function block(c, x, y, size, type, a, ghost) {
      var px = x * size, py = y * size;
      if (ghost) { c.strokeStyle = "rgba(" + rgb + ",.35)"; c.lineWidth = 1; c.strokeRect(px + 2.5, py + 2.5, size - 5, size - 5); return; }
      c.fillStyle = "rgba(" + rgb + "," + (a * 0.55) + ")"; c.fillRect(px + 1, py + 1, size - 2, size - 2);
      c.strokeStyle = "rgba(" + rgb + ",.95)"; c.lineWidth = 1; c.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
      c.fillStyle = "rgba(" + rgb + ",.9)"; c.fillRect(px + size * 0.3, py + size * 0.3, size * 0.4, size * 0.4);
    }
    function drawNext() {
      nctx.clearRect(0, 0, nx.width, nx.height); if (!nextType) return;
      SHAPES[nextType].forEach(function (c) { block(nctx, c[0] + 0.3, c[1] + 0.2, 20, nextType, ALPHA[nextType]); });
    }
    function render() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "rgba(" + rgb + ",.07)"; ctx.lineWidth = 1;
      for (var i = 1; i < W; i++) { ctx.beginPath(); ctx.moveTo(i * cell + .5, 0); ctx.lineTo(i * cell + .5, cv.height); ctx.stroke(); }
      for (var j = 1; j < H; j++) { ctx.beginPath(); ctx.moveTo(0, j * cell + .5); ctx.lineTo(cv.width, j * cell + .5); ctx.stroke(); }
      for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) if (grid[r][c]) {
        if (clearing && clearing.rows.indexOf(r) > -1 && Math.floor(clearing.t / 60) % 2 === 0) continue;
        block(ctx, c, r, cell, grid[r][c], ALPHA[grid[r][c]]);
      }
      if (cur && !over) {
        var gy = cur.y; while (!collides(cur.cells, cur.x, gy + 1)) gy++;
        cur.cells.forEach(function (c) { block(ctx, c[0] + cur.x, c[1] + gy, cell, cur.type, 1, true); });
        cur.cells.forEach(function (c) { if (c[1] + cur.y >= 0) block(ctx, c[0] + cur.x, c[1] + cur.y, cell, cur.type, ALPHA[cur.type]); });
      }
    }
    function tick(ts) {
      if (dead) return; var dt = Math.min(100, ts - (last || ts)); last = ts;
      if (!paused && !over) {
        if (clearing) { clearing.t += dt; if (clearing.t > 360) finishClear(); }
        else if (cur) {
          dropT += dt / 1000;
          if (collides(cur.cells, cur.x, cur.y + 1)) { lockT += dt; if (lockT > 500) lock(); }
          else if (dropT >= speed()) { dropT = 0; cur.y++; }
        }
      }
      render(); raf = requestAnimationFrame(tick);
    }
    function act(k) {
      if (over) { if (k === "enter") reset(); return; }
      if (k === "pause") { paused = !paused; msgEl.textContent = paused ? "PAUSED" : ""; return; }
      if (paused || clearing || !cur) return;
      if (k === "left") move(-1); else if (k === "right") move(1); else if (k === "rot") rot(1); else if (k === "rotb") rot(-1);
      else if (k === "down") soft(); else if (k === "drop") hard();
    }
    var KEYS = { ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", ArrowUp: "rot", w: "rot", x: "rot", z: "rotb", ArrowDown: "down", s: "down", " ": "drop", p: "pause", Enter: "enter" };
    function key(e) {
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === "Escape" || k === "q") { e.preventDefault(); e.stopPropagation(); quit(); return; }
      if (KEYS[k]) { e.preventDefault(); e.stopPropagation(); act(KEYS[k]); }
    }
    function quit() {
      dead = true; cancelAnimationFrame(raf); removeEventListener("keydown", key, true); root.remove(); opts.onExit && opts.onExit();
    }
    addEventListener("keydown", key, true);
    q(".quit").addEventListener("click", quit);
    [].slice.call(root.querySelectorAll(".pad button")).forEach(function (b) {
      var h; function fire(e) { e.preventDefault(); act(b.dataset.k); }
      b.addEventListener("pointerdown", function (e) { fire(e); if (b.dataset.k === "left" || b.dataset.k === "right" || b.dataset.k === "down") { clearInterval(h); h = setInterval(function () { act(b.dataset.k); }, 110); } });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { b.addEventListener(ev, function () { clearInterval(h); }); });
    });
    cv.addEventListener("pointerdown", function () { if (over) reset(); else act("rot"); });
    reset(); raf = requestAnimationFrame(tick);
  }
  window.JBTetris = { start: start };
})();
