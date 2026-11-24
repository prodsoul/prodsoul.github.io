/* Joann Bisseling portfolio: a small terminal emulator that runs every page.
   Needs data.js and audio.js loaded first. Each page only sets data-page / data-root on <body>. */
(function () {
  "use strict";
  var JB = window.JB, A = window.JBAudio, body = document.body;
  var PAGE = body.dataset.page || "home", ROOT = body.dataset.root || "", SLUG = body.dataset.slug || "";
  var coarse = matchMedia("(pointer: coarse)").matches;
  var WORKS = JB.works, doc = document.getElementById("doc");
  A.setRoot(ROOT);
  var THEMES = ["green", "amber", "blue", "ice", "pink"];
  var t0 = Date.now();

  /* ---------- build the monitor ---------- */
  var h = '<div class="stage" id="stage"><div class="monitor" id="monitor"><div class="crt" id="crt">' +
    '<div class="screen" id="screen">' +
    '<div class="mtop"><button type="button" id="m-plain" aria-label="Plain site"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8v22"/><path d="M19 17a22 22 0 1 0 26 0"/></svg></button><span>JB-TERM</span><span class="sp2"></span><button type="button" id="m-skip" hidden>skip</button><button type="button" id="m-snd"></button><button type="button" id="m-thm"></button></div>' +
    '<div class="scroll" id="scroll"><div class="term" id="term"><div id="out" role="log" aria-live="off"></div>' +
    '<label id="promptwrap" hidden><span class="prompt" id="ps"></span><span id="line"><span id="cpre"></span><span class="cursor" id="ccur">&nbsp;</span><span id="cpost"></span></span>' +
    '<input id="inp" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="terminal input"></label></div></div>' +
    '<div class="dock" id="dock" hidden></div>' +
    '<div class="gate" id="gate" hidden></div>' +
    '<div class="fx fx-flick"></div><div class="fx fx-roll"></div><div class="fx fx-noise"></div><div class="fx fx-scan"></div><div class="fx fx-glare"></div><div class="fx fx-vig"></div>' +
    '</div></div>' +
    '<div class="plate"><button type="button" class="pwr" id="b-pwr" aria-label="Power"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8v22"/><path d="M19 17a22 22 0 1 0 26 0"/></svg></button><span class="led"></span><span class="brand" id="brand">Prodsoul Terminal 29007</span><button type="button" id="b-skip" hidden>skip</button><button type="button" id="b-snd"></button><button type="button" id="b-thm"></button></div>' +
    '</div></div>';
  var keep = [].slice.call(body.querySelectorAll("script, noscript, #doc"));
  body.insertAdjacentHTML("afterbegin", h);
  var $ = function (s) { return document.querySelector(s); };
  var screen = $("#screen"), scroller = $("#scroll"), out = $("#out"), pw = $("#promptwrap"), psEl = $("#ps"), inp = $("#inp");
  var cpre = $("#cpre"), ccur = $("#ccur"), cpost = $("#cpost"), dock = $("#dock"), gate = $("#gate"), monitor = $("#monitor");
  var bSnd = $("#b-snd"), bThm = $("#b-thm"), mSnd = $("#m-snd"), mThm = $("#m-thm"), bSkip = $("#b-skip"), mSkip = $("#m-skip");

  /* ---------- sizing: a fixed 4:3 monitor on desktop, full screen on phones ---------- */
  var mobile = false;
  function fitScreen() {
    var vw = innerWidth, vh = innerHeight;
    mobile = (coarse && Math.min(vw, vh) < 900) || vw < 760;
    body.classList.toggle("mobile", mobile);
    if (!mobile) {
      var s = Math.min((vw - 16) / 1048, (vh - 16) / 848, 1.25);
      document.documentElement.style.setProperty("--s", Math.max(0.35, s).toFixed(4));
    }
  }
  if (window.visualViewport) {
    var vvFix = function () { var h = visualViewport.height; document.documentElement.style.setProperty("--vvh", h + "px"); if (mobile) { window.scrollTo(0, 0); scrollEnd(); } };
    visualViewport.addEventListener("resize", vvFix); visualViewport.addEventListener("scroll", function () { if (mobile) window.scrollTo(0, 0); }); vvFix();
  }
  fitScreen(); addEventListener("resize", fitScreen); addEventListener("orientationchange", fitScreen);

  /* ---------- state ---------- */
  var fast = false, busy = false, booting = false, inGame = false, follow = true;
  var history = [], hIdx = 0, draft = "";
  var sleepers = [];
  function sleep(ms) {
    if (fast) return Promise.resolve();
    return new Promise(function (res) {
      var f = function () { clearTimeout(t); var i = sleepers.indexOf(f); if (i > -1) sleepers.splice(i, 1); res(); };
      var t = setTimeout(f, ms); sleepers.push(f);
    });
  }
  var navNow = null;
  var allClear = false; try { allClear = localStorage.getItem("jb-filter") === "off"; } catch (e) {}
  function syncFx() { document.body.classList.toggle("allclear", allClear); monitor.classList.toggle("nofx", allClear || !!screen.querySelector(".shot.clear")); }
  setTimeout(syncFx, 0);
  new MutationObserver(syncFx).observe(screen, { subtree: true, attributes: true, attributeFilter: ["class"] });
  function working() { return booting || busy || leaving; }
  /* skip: finish typing at once, drop any half-played screen animation, and cut straight to the next page when leaving */
  var leaveAt = 0;
  function skip() {
    if (leaving && Date.now() - leaveAt < 1000) return;
    fast = true; sleepers.slice().forEach(function (f) { f(); });
    screen.classList.remove("on", "flash", "glitch");
    if (navNow) { screen.style.opacity = "0"; navNow(); }
  }

  /* ---------- dom helpers ---------- */
  function el(tag, cls, content) {
    var e = document.createElement(tag); if (cls) e.className = cls;
    if (content != null) { if (content instanceof Node) e.append(content); else e.textContent = content; }
    return e;
  }
  function scrollEnd(force) { if (force) follow = true; if (follow) scroller.scrollTop = scroller.scrollHeight; }
  /* auto-follow stops only when the visitor scrolls up on purpose, and resumes when they reach the bottom */
  scroller.addEventListener("scroll", function () { if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 50) follow = true; });
  scroller.addEventListener("wheel", function (e) {
    if (e.deltaY < 0) follow = false;
    if (e.ctrlKey || e.target.closest("iframe, .pdfv")) return;
    e.preventDefault(); scroller.scrollTop += (e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY) * 0.45;
  }, { passive: false });
  scroller.addEventListener("touchmove", function () { follow = false; }, { passive: true });
  scroller.addEventListener("pointerdown", function (e) { if (e.target === scroller) follow = false; });
  document.addEventListener("keydown", function (e) { if (["PageUp", "Home"].indexOf(e.key) > -1 || (e.key === "ArrowUp" && document.activeElement !== inp)) follow = false; });
  if (window.ResizeObserver) new ResizeObserver(function () { scrollEnd(); }).observe(out);
  function ln(content, cls) {
    var d = el("div", "ln new" + (cls ? " " + cls : ""), content == null ? "" : content); out.append(d); scrollEnd(); return d;
  }
  function gap() { out.append(el("div", "sp")); }
  function frag() { var f = document.createDocumentFragment(); [].slice.call(arguments).forEach(function (p) { f.append(p); }); return f; }
  function href(file) { return ROOT + file; }
  function link(label, file, external) {
    var a = el("a", "", label); a.href = external ? file : href(file);
    if (external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    else if (!/^mailto:/.test(file)) a.addEventListener("click", function (e) { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); go(file); });
    return a;
  }
  function pad2(n) { return String(n).padStart(2, "0"); }

  /* typing with teletype pacing: small bursts, a longer beat at punctuation */
  async function typeInto(node, str, cps) {
    cps = cps || 90;
    var t = document.createTextNode(""), cur = el("span", "cursor solid", "\u00a0"); node.append(t, cur);
    var i = 0, tk = 0;
    while (i < str.length) {
      if (fast) { t.data = str; break; }
      var n = 1 + (Math.random() * 2 | 0); t.data += str.slice(i, i + n);
      var last = str[i + n - 1]; i += n;
      if (++tk % 2 === 0 && last !== " ") A.tick();
      if (tk % 4 === 0) scrollEnd();
      await sleep(1000 * n / cps * (0.6 + Math.random() * 0.8) + (/[.!?]/.test(last) ? 140 : /[,;:]/.test(last) ? 60 : 0));
    }
    cur.remove(); scrollEnd();
  }
  async function typeLn(str, cls, cps) { var d = ln("", cls); await typeInto(d, str, cps); return d; }

  /* ---------- theme and sound ---------- */
  function setTheme(n) {
    if (THEMES.indexOf(n) < 0) n = "green";
    document.documentElement.dataset.theme = n;
    var tx = "theme: " + n; bThm.textContent = tx; mThm.textContent = n;
    try { localStorage.setItem("jb-theme", n); } catch (e) {}
  }
  var themeSaved = "green"; try { themeSaved = localStorage.getItem("jb-theme") || "green"; } catch (e) {}
  setTheme(themeSaved);
  function paintSound() {
    var on = A.isOn(), tx = "sound: " + (on ? "on" : "off");
    bSnd.textContent = tx; mSnd.textContent = on ? (A.ready() ? "snd on" : "tap: snd") : "snd off"; bSnd.setAttribute("aria-pressed", String(on));
  }
  A.onChange(paintSound); paintSound();
  function toggleSound() { A.unlock(); A.setOn(!A.isOn()); if (A.isOn()) A.ok(); paintSound(); }
  bSnd.addEventListener("click", toggleSound); mSnd.addEventListener("click", toggleSound);
  function nextTheme() { setTheme(THEMES[(THEMES.indexOf(document.documentElement.dataset.theme) + 1) % THEMES.length]); A.ok(); }
  bThm.addEventListener("click", nextTheme); mThm.addEventListener("click", nextTheme);

  /* the first tap or key press unlocks audio (browsers insist on it). During boot that press only unlocks sound; the next one skips. */
  var firstGesture = true;
  function gesture(e) {
    var wasReady = A.ready();
    if (!wasReady) { A.unlock(); }
    firstGesture = false;
  }
  ["pointerdown", "keydown", "touchend", "click"].forEach(function (ev) { addEventListener(ev, gesture, true); });

  /* ---------- ascii art ---------- */
  var arts = [];
  function fitArt(pre) {
    pre.style.fontSize = ""; var avail = out.clientWidth; if (!avail) return;
    if (pre.scrollWidth > avail) pre.style.fontSize = (parseFloat(getComputedStyle(pre).fontSize) * avail / pre.scrollWidth * 0.985) + "px";
  }
  addEventListener("resize", function () { arts.forEach(function (p) { if (p.isConnected) fitArt(p); }); });
  async function art(rows, o) {
    o = o || {}; var p = el("pre", "art " + (o.cls || "")); p.setAttribute("role", "img"); p.setAttribute("aria-label", o.label || "ASCII art");
    var holder = o.into || out; holder.append(p); arts.push(p);
    for (var i = 0; i < rows.length; i++) { p.append(document.createTextNode(rows[i] + "\n")); fitArt(p); A.tick(); scrollEnd(); await sleep(o.delay || 45); }
    return p;
  }
  /* Name banner drawn from block characters as SVG rectangles, so it looks the same on every device and font. */
  var NAME1 = ["     ▄▄▄", "     ███", "     ███ ▄███▄  ▀▀█▄ ████▄ ████▄", "▄▄▄  ███ ██ ██ ▄█▀██ ██ ██ ██ ██", " ▀████▀  ▀███▀ ▀█▄██ ██ ██ ██ ██"];
  var NAME2 = ["▄▄▄▄▄▄▄                         ▄▄", "███▀▀███▄ ▀▀                    ██ ▀▀", "███▄▄███▀ ██  ▄█▀▀▀ ▄█▀▀▀ ▄█▀█▄ ██ ██  ████▄ ▄████",
    "███  ███▄ ██  ▀███▄ ▀███▄ ██▄█▀ ██ ██  ██ ██ ██ ██", "████████▀ ██▄ ▄▄▄█▀ ▄▄▄█▀ ▀█▄▄▄ ██ ██▄ ██ ██ ▀████", "                                                ██", "                                              ▀▀▀"];
  async function blockArt(rows, o) {
    o = o || {}; var NS = "http://www.w3.org/2000/svg";
    var cols = Math.max.apply(null, rows.map(function (r) { return r.replace(/\s+$/, "").length; })), n = rows.length;
    var svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 " + cols + " " + (n * 2)); svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("role", "img"); svg.setAttribute("aria-label", o.label || "name"); svg.setAttribute("shape-rendering", "crispEdges");
    svg.style.cssText = "display:block;font-size:" + (o.fs || "1em") + ";width:calc(" + cols + " * .6em);max-width:100%;height:auto;aspect-ratio:" + (cols * 0.6) + " / " + n + ";color:var(--bright);fill:currentColor;filter:drop-shadow(0 0 5px rgba(var(--fg-rgb),.75));margin:.15em 0 .5em";
    var groups = rows.map(function (row, r) {
      var g = document.createElementNS(NS, "g"); g.style.visibility = "hidden"; var c = 0;
      while (c < row.length) {
        var ch = row[c]; if (ch === " ") { c++; continue; } var e = c; while (e < row.length && row[e] === ch) e++;
        var rect = document.createElementNS(NS, "rect"); rect.setAttribute("x", c); rect.setAttribute("width", e - c);
        rect.setAttribute("y", ch === "▄" ? r * 2 + 1 : r * 2); rect.setAttribute("height", ch === "█" ? 2 : 1); g.appendChild(rect); c = e;
      } svg.appendChild(g); return g;
    });
    (o.into || out).append(svg);
    for (var i = 0; i < groups.length; i++) { groups[i].style.visibility = "visible"; A.tick(); scrollEnd(); await sleep(o.delay || 80); }
    return svg;
  }
  var CAT = ["    /\\_____/\\", "   /  o   o  \\", "  ( ==  ^  == )", "   )         (", "  (           )", " ( (  )   (  ) )", "(__(__)___(__)__)"];

  /* ---------- works, figures, video ---------- */
  function findWork(q) {
    q = (q || "").toLowerCase().replace(/^(works\/|projects\/)/, "").replace(/\.(html|txt)$/, "");
    return WORKS.filter(function (w) { return w.alias === q || w.slug === q || w.title.toLowerCase() === q; })[0] ||
      (q.length > 2 ? WORKS.filter(function (w) { return w.title.toLowerCase().indexOf(q) > -1; })[0] : null);
  }
  function thumbBox(w) {
    var b = el("div", "th" + (w.thumb ? "" : " none"));
    if (w.thumb) { b = el("div", "th shot"); var im = new Image(); im.src = href("assets/thumbnails/" + w.thumb + ".webp"); im.alt = w.title + " thumbnail"; im.loading = "lazy"; b.append(im); b.style.padding = "4px"; }
    else b.textContent = "no preview";
    b.style.cursor = "pointer"; b.title = "open " + w.title; b.addEventListener("click", function () { go("projects/" + w.slug + ".html"); });
    return b;
  }
  async function workCards(items) {
    var wrap = el("div", "works"); out.append(wrap);
    for (var i = 0; i < items.length; i++) {
      var w = items[i], r = el("div", "work ln new");
      var nm = el("div", "nm"); nm.append(link(w.title, "projects/" + w.slug + ".html")); nm.append(el("span", "tp", w.type + "   [" + w.alias + "]"));
      r.append(el("span", "dim", pad2(WORKS.indexOf(w) + 1)), thumbBox(w), nm); wrap.append(r);
      A.tick(); scrollEnd(); await sleep(130);
    }
  }
  function workRows(items) {
    var wrap = el("div"); out.append(wrap);
    items.forEach(function (w) {
      var r = el("div", "row"); var nm = el("div", "nm"); nm.append(link(w.title, "projects/" + w.slug + ".html")); nm.append(el("span", "tp", w.type + "   [" + w.alias + "]"));
      r.append(el("span", "dim", pad2(WORKS.indexOf(w) + 1)), nm); wrap.append(r);
    }); scrollEnd();
  }
  function loadImg(src) {
    return new Promise(function (res) { var im = new Image(); var t = setTimeout(function () { res(im); }, 5000); im.onload = im.onerror = function () { clearTimeout(t); res(im); }; im.src = src; });
  }
  async function gallery(node) {
    var figs = [].slice.call(node.querySelectorAll("figure")), n = figs.length;
    var wrap = el("div", "gallery n" + n); var loaded = [];
    var prog = ln("", "dim"); var label = "rx image data x" + n;
    var imgs = figs.map(function (f) { var im = f.querySelector("img"); return loadImg(href(im.getAttribute("src").replace(/^\.\.\//, ""))); });
    var done = Promise.all(imgs);
    for (var i = 0; i <= 10; i++) { prog.textContent = label + "  [" + "#".repeat(i) + ".".repeat(10 - i) + "]"; if (i % 2 === 0) A.tick(); scrollEnd(); await sleep(45); }
    await done; prog.remove();
    out.append(wrap);
    figs.forEach(function (f, k) {
      var src = f.querySelector("img"), fig = el("figure"), shot = el("div", "shot pend");
      var im = new Image(); im.alt = src.getAttribute("alt") || ""; im.src = href(src.getAttribute("src").replace(/^\.\.\//, "")); im.decoding = "async";
      shot.append(im); fig.append(shot); shot.title = "click to toggle the screen filter";
      shot.addEventListener("click", function () { shot.classList.toggle("clear"); });
      var cap = f.querySelector("figcaption"); if (cap) fig.append(el("figcaption", "", cap.textContent));
      wrap.append(fig);
      setTimeout(function () { shot.classList.remove("pend"); shot.classList.add("reveal"); A.seek(2); scrollEnd(); }, fast ? 0 : k * 220);
    });
    scrollEnd(); await sleep(450 + n * 160);
  }
  async function video(node) {
    var id = node.dataset.yt, title = node.dataset.title || "video";
    var wrap = el("div", "vid-wrap vid-in"), shot = el("div", "shot"), v = el("div", "vid");
    var poster = el("div", "poster"); poster.style.backgroundImage = "url(https://i.ytimg.com/vi/" + id + "/hqdefault.jpg)";
    var pb = el("button", "play", "> PLAY"); pb.type = "button"; pb.setAttribute("aria-label", "Play video: " + title);
    v.append(poster, pb); shot.append(v); wrap.append(shot, el("div", "vid-cap", title));
    function play() {
      var f = document.createElement("iframe"); f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1";
      f.title = title; f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true; f.referrerPolicy = "strict-origin-when-cross-origin";
      v.classList.add("playing"); shot.classList.add("clear"); poster.remove(); v.append(f); A.beep(700, .05);
    }
    v.addEventListener("click", play); var vp = ln("", "dim"); for (var q = 0; q <= 10; q++) { vp.textContent = "rx video stream  [" + "#".repeat(q) + ".".repeat(10 - q) + "]"; if (q % 2 === 0) A.tick(); scrollEnd(); await sleep(fast ? 0 : 55); } vp.remove(); out.append(wrap); A.seek(3); scrollEnd(); if (!fast) await sleep(700);
  }

  function pdfBlock(src, name) {
    var cap = ln("", "dim"); cap.textContent = "loading " + (name || "report.pdf") + " ...";
    var shot = el("div", "shot pdfshot"); out.append(shot); var fitH = mobile ? Math.max(220, innerHeight - 230) : 400;
    window.JBPdf.mount(shot, { src: href(src), fitH: fitH, name: name, onNav: function () { shot.classList.add("clear"); } });
    cap.remove(); A.seek(4); scrollEnd();
  }

  /* case study renderer: reads the hidden #doc article */
  async function renderDoc() {
    if (!doc) return;
    var kids = [].slice.call(doc.children);
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i], tag = n.tagName.toLowerCase(), cls = n.className;
      if (tag === "h1") {
        var rowsT = window.JB_TITLES && window.JB_TITLES[SLUG];
        if (rowsT) { var hw = el("div", "ptitle"); out.append(hw); await blockArt(rowsT, { delay: 55, label: n.textContent, into: hw, fs: "1.1em" }); }
        else { var h1 = el("h1", "t ln new"); out.append(h1); await typeInto(h1, n.textContent, 55); }
      }
      else if (cls === "meta") {
        var m = el("div", "meta"); out.append(m);
        [].slice.call(n.children).forEach(function (li) { var r = el("div", "ln new"); r.append(el("span", "", li.dataset.k), el("span", "bright", li.textContent)); m.append(r); A.tick(); });
        scrollEnd(); await sleep(250);
      }
      else if (cls === "intro") { var p0 = el("p", "p ln new"); out.append(p0); await typeInto(p0, n.textContent, 380); }
      else if (cls === "actions") {
        var ac = el("div", "actions ln new"); [].slice.call(n.children).forEach(function (a) {
          if (a.tagName === "A") { var x = link("[ " + a.textContent + " ]", a.getAttribute("href").indexOf("http") === 0 ? a.getAttribute("href") : a.getAttribute("href").replace(/^\.\.\//, ""), a.getAttribute("href").indexOf("http") === 0); ac.append(x); }
          else ac.append(el("span", "off", "[ " + a.textContent + " ]"));
        }); out.append(ac); A.ok(); scrollEnd(); await sleep(300);
      }
      else if (tag === "h2") { var hh = el("h2", "h ln new"); out.append(hh); A.seek(2); await typeInto(hh, n.textContent, 90); }
      else if (tag === "p") { var pp = el("p", "p ln new"); out.append(pp); await typeInto(pp, n.textContent, 400); }
      else if (cls.indexOf("gallery") === 0) await gallery(n);
      else if (cls === "video") await video(n);
      else if (cls === "pdf") { gap(); var pc = ln("", "dim"); await typeInto(pc, "report: " + n.dataset.name, 90); pdfBlock(n.dataset.src, n.dataset.name); }
    }
    gap(); ln("-- end of file --", "dim");
    var idx = WORKS.indexOf(findWork(SLUG)), prev = WORKS[idx - 1], next = WORKS[idx + 1];
    var nav = el("div", "actions ln new"); nav.append(link("[ < back to works ]", "works.html"));
    if (prev) nav.append(link("[ < " + prev.title + " ]", "projects/" + prev.slug + ".html"));
    if (next) nav.append(link("[ " + next.title + " > ]", "projects/" + next.slug + ".html"));
    out.append(el("div", "sp"), nav); scrollEnd();
  }

  /* ---------- navigation between pages (each page is a separate screen) ---------- */
  var leaving = false;
  async function go(file) {
    if (leaving) return; leaving = true; leaveAt = Date.now(); busy = true; pw.hidden = true; dock.hidden = true;
    if (/^https?:/.test(file) || /^mailto:/.test(file)) { location.href = file; return; }
    var done = false, target = href(file);
    navNow = function () { if (done) return; done = true; location.href = target; };
    A.seek(5);
    var d = ln("", "dim"); d.textContent = "connecting to " + file.replace(/^projects\//, "").replace(/^index.html\?home$/, "home") + " ..."; scrollEnd(true);
    setTimeout(function () { if (done) return; A.whoosh(); screen.classList.remove("on"); screen.classList.add("off"); A.powerOff(); }, 750);
    setTimeout(navNow, 1750);
  }
  addEventListener("pageshow", function (e) {
    if (e.persisted) { leaving = false; navNow = null; busy = false; screen.style.opacity = ""; screen.classList.remove("off"); screen.classList.add("on", "settled"); pw.hidden = false; dock.hidden = false; focusInput(); }
  });

  /* ---------- prompt ---------- */
  function cwd() { return PAGE === "works" ? "~/works" : PAGE === "project" ? "~/works/" + (findWork(SLUG) || { alias: SLUG }).alias : "~"; }
  function paintPS() { psEl.textContent = "guest@joann:" + cwd() + "$ "; }
  paintPS();
  function echoCmd(c) { var d = ln("", ""); d.append(el("span", "prompt", psEl.textContent), document.createTextNode(c)); }
  function renderInput() {
    var v = inp.value, p = Math.min(inp.selectionStart == null ? v.length : inp.selectionStart, v.length);
    cpre.textContent = v.slice(0, p); ccur.textContent = v[p] || "\u00a0"; cpost.textContent = v.slice(p + 1);
  }
  function setInput(v) { inp.value = v; renderInput(); }
  function focusInput() { if (!pw.hidden && !inGame && !(coarse && booting)) { try { inp.focus({ preventScroll: true }); } catch (e) {} } }
  ["input", "keyup", "click", "select", "focus"].forEach(function (e) { inp.addEventListener(e, renderInput); });
  document.addEventListener("selectionchange", function () { if (document.activeElement === inp) renderInput(); });
  inp.addEventListener("focus", function () { pw.classList.remove("unfocused"); });
  inp.addEventListener("blur", function () { pw.classList.add("unfocused"); });
  function showPrompt() { pw.hidden = false; dock.hidden = false; setInput(""); if (!coarse) focusInput(); scrollEnd(true); }

  /* ---------- commands ---------- */
  var C = {}, SECRET = {};
  function def(names, fn, secret) { names.split(" ").forEach(function (n) { C[n] = fn; if (secret) SECRET[n] = 1; }); }

  var HOME = "index.html?home";
  var CMDS = [
    ["navigate", [["home", "back to home"], ["projects", "three showcase projects"], ["works", "every project, with previews"], ["about", "who I am"], ["contact", "email and LinkedIn"],
      ["resume", "read my resume"], ["open <name>", "open a project, e.g. open convex"], ["next / prev", "move between projects"], ["back", "go up one level"],
      ["cd <place>", "works, about, contact, resume, ~ or .."], ["ls [works]", "list projects"], ["pwd", "show where you are"]]],
    ["info", [["whoami", "one-line profile"], ["skills", "tools and methods"], ["neofetch", "system info"], ["top", "running processes"],
      ["date", "current date and time"], ["uname", "system name"], ["ping", "test the connection"], ["history", "commands you typed so far"], ["echo <text>", "repeat some text"]]],
    ["display and sound", [["theme <name>", "green, amber, blue, ice or pink"], ["sound on|off", "key clicks, beeps and effects"], ["clear", "wipe the screen"], ["filter on|off", "turn the screen filter on all images on or off"],
      ["plain", "switch to the plain, easy-to-read site"]]],
    ["system", [["help", "short help"], ["commands", "this list"], ["reboot", "restart the terminal experience"]]],
    ["extras", [["matrix", "digital rain (any key stops it)"], ["hire", "a good decision"], ["sudo", "ask nicely"], ["rm", "please do not"], ["man", "the manual"]]]
  ];

  def("help ?", async function () {
    var g = el("div", "help ln new"), rows = [
      ["home", "back to home"], ["projects", "three showcase projects"], ["works", "all projects with previews"], ["about", "who is Joann?"], ["open <name>", "open a project (try: open convex)"],
      ["contact · resume", "reach me, read my resume"], ["theme <name>", "green · amber · blue · ice · pink"], ["sound on|off", "clicks and beeps"],
      ["reboot", "restart the terminal experience"]
    ];
    rows.forEach(function (r) { g.append(el("b", "", r[0]), el("span", "dim", r[1])); }); out.append(g);
    ln("type `commands` for the full list.   tab: autocomplete   up/down: history", "dim");
  });
  def("commands", async function () {
    for (var i = 0; i < CMDS.length; i++) {
      var h2 = el("div", "ln new bright", "[ " + CMDS[i][0] + " ]"); h2.style.marginTop = i ? "1.1em" : ".3em"; out.append(h2);
      var g = el("div", "help tight ln new"); CMDS[i][1].forEach(function (r) { g.append(el("b", "", r[0]), el("span", "dim", r[1])); }); out.append(g);
      A.tick(); scrollEnd(); await sleep(140);
    }
    ln("a few commands are not listed. keep poking around.", "dim");
  });
  def("about", async function () { for (var i = 0; i < JB.about.length; i++) { var p = el("p", "p ln new"); out.append(p); await typeInto(p, JB.about[i], 170); }
    gap(); var jh = el("h2", "h ln new"); out.append(jh); await typeInto(jh, "my journey", 90);
    for (var j = 0; j < JB.journey.length; j++) { var it = JB.journey[j], jp = el("p", "p ln new"); jp.style.whiteSpace = "pre-wrap"; out.append(jp); await typeInto(jp, it.school + "\n" + it.what + "\n" + it.when + (it.notes.length ? "\n" + it.notes.join("\n") : ""), 170); }
  });
  def("whoami", async function () { await typeLn("Joann Bisseling | UX & Game Design | Singapore", "bright", 70); ln("status: open to internships", "dim"); });
  def("skills", async function () {
    var g = el("div", "help tight ln new"); JB.skills.forEach(function (s) { g.append(el("b", "", s[0]), el("span", "", s[1])); }); out.append(g); A.tick();
  });
  def("ls dir", async function (arg) {
    var flags = (arg.match(/^-\w+/) || [""])[0], rest = arg.replace(/^-\w+\s*/, "").replace(/\/$/, "");
    if (rest === "works" || rest === "all") { if (flags === "-l") { await workCards(WORKS); } else { workRows(WORKS); ln("tip: open <name>, e.g. open " + WORKS[0].alias, "dim"); } }
    else if (rest === "projects") { await workCards(WORKS.filter(function (w) { return w.featured; })); ln("3 of " + WORKS.length + " shown. type `works` to see them all", "dim"); }
    else if (!rest) {
      var d = el("div", "ln new"); d.append(el("span", "bright", "works/  "), "about  contact  resume");
      if (flags.indexOf("a") > -1) { d.append("  "); d.append(el("span", "warn", ".tetris")); }
      out.append(d);
    } else ln("ls: cannot access '" + rest + "': No such file or directory", "warn");
  });
  def("works", async function () { await workCards(WORKS); ln("open <name> to read a case study, e.g. open " + WORKS[0].alias, "dim"); });
  def("projects", async function () { await workCards(WORKS.filter(function (w) { return w.featured; })); ln("3 of " + WORKS.length + " shown. type `works` to see them all", "dim"); });
  def("cd", async function (arg) {
    arg = (arg || "~").replace(/\/$/, "");
    var map = { "~": HOME, "": HOME, "..": PAGE === "project" ? "works.html" : HOME, works: "works.html", about: "about.html", contact: "contact.html", resume: "resume.html" };
    if (map[arg]) return go(map[arg]);
    var w = findWork(arg); if (w) return go("projects/" + w.slug + ".html");
    ln("cd: " + arg + ": No such file or directory", "warn");
  });
  def("pwd", async function () { ln("/home/guest/" + cwd().replace(/^~\/?/, "")); });
  /* secret: plain `cat` shows the cat */
  def("cat sergio more less", async function (arg) {
    var a = (arg || "").toLowerCase();
    if (!a) return catPhoto();
    if (a === "about.txt") return C.about();
    if (a === "contact.txt") return C.contact();
    if (a === "resume.pdf") return C.resume();
    if (a === ".tetris") return ln("cat: .tetris: binary file. run it with ./tetris", "warn");
    var w = findWork(a); if (w) return go("projects/" + w.slug + ".html");
    ln("cat: " + arg + ": No such file or directory", "warn");
  }, true);
  async function catPhoto() {
    var wrap = el("div", "shot cat-pic pend"), im = new Image(); im.src = href("assets/images/sergio.png"); im.alt = "My cat"; wrap.append(im);
    wrap.title = "click to toggle the screen filter"; wrap.addEventListener("click", function () { wrap.classList.toggle("clear"); });
    await loadImg(im.src); out.append(wrap); await sleep(60); wrap.classList.remove("pend"); wrap.classList.add("reveal"); A.seek(4); A.meow(); scrollEnd();
    await sleep(900); await typeLn("meow.", "dim", 20);
  }
  def("neofetch", async function () {
    var box = el("div", "nf ln new"); out.append(box); var holder = el("div"); box.append(holder);
    await art(CAT, { delay: 70, label: "ASCII cat", into: holder });
    var info = el("div"); box.append(info);
    var up = Math.max(1, Math.round((Date.now() - t0) / 1000));
    var rows = [["guest@joann", null], ["-----------", null], ["OS", "PortfolioOS 1.0"], ["Role", "UX & Game Design student"], ["Location", "Singapore"],
      ["Tools", "Figma, Unity"], ["Background", "Big Data Analytics"], ["Status", "open to internships"], ["Uptime", up + "s"],
      ["Theme", document.documentElement.dataset.theme], ["Secrets", "1 (hint: ls -a)"]];
    for (var i = 0; i < rows.length; i++) {
      var d = el("div"), r = rows[i]; if (r[1] == null) d.append(el("span", "bright", r[0])); else d.append(el("span", "k", r[0] + ": "), r[1]);
      info.append(d); A.tick(); scrollEnd(); await sleep(60);
    }
  });
  def("top", async function () {
    var pre = el("pre", "art ln new"); out.append(pre); pre.style.lineHeight = "1.5";
    var procs = [["figma", "S", 34], ["unity", "R", 28], ["playtest", "S", 9], ["digipen.service", "S", 4], ["coffee", "R", 2], ["tetris", "T", 0]];
    for (var f = 0; f < 5; f++) {
      var s = "top - " + new Date().toTimeString().slice(0, 8) + " up " + Math.max(1, Math.round((Date.now() - t0) / 60000)) + " min,  1 user,  load: " + (0.4 + Math.random()).toFixed(2) + "\n" +
        "Tasks: " + procs.length + " total   Cpu(s): " + (20 + Math.random() * 60 | 0) + "% us   Mem: 640K used (it is enough)\n\n  PID  USER   S  %CPU  COMMAND\n";
      procs.forEach(function (p, i) { s += String(1001 + i * 7).padStart(5) + "  guest  " + p[1] + "  " + String(Math.max(0, p[2] + (Math.random() * 10 - 5)).toFixed(1)).padStart(4) + "  " + p[0] + "\n"; });
      pre.textContent = s; A.tick(); scrollEnd(); await sleep(520);
    }
  });
  def("resume", async function () {
    var pdf = JB.links.resumePdf;
    await typeLn("resume.pdf", "bright", 80);
    var shot = el("div", "shot pdfshot"); out.append(shot); var fitH = mobile ? Math.max(220, innerHeight - 230) : 400;
    window.JBPdf.mount(shot, { src: href(pdf), fitH: fitH, name: "JoannBisseling_Resume.pdf", onNav: function () { shot.classList.add("clear"); } }); A.seek(4); scrollEnd();
  });
  def("contact", async function () {
    var r1 = ln("", ""), r2 = ln("", ""), r3 = ln("", "");
    r1.append(el("span", "dim", "email     "), link(JB.email, JB.links.email, true));
    r2.append(el("span", "dim", "linkedin  "), link("linkedin.com/in/joannbisseling", JB.links.linkedin, true));
    r3.append(el("span", "dim", "resume    "), link("resume.html", "resume.html")); A.ok();
  });
  def("email", async function () { await typeLn("opening mail client ...", "dim", 60); await sleep(300); location.href = JB.links.email; });
  def("linkedin", async function () { await typeLn("opening linkedin ...", "dim", 60); await sleep(300); window.open(JB.links.linkedin, "_blank", "noopener"); });
  def("open", async function (arg) {
    if (!arg) return ln("usage: open <name>   e.g. open convex · open resume", "warn");
    var map = { resume: "resume.html", works: "works.html", about: "about.html", contact: "contact.html", home: HOME };
    if (arg === "email") return C.email(); if (arg === "linkedin") return C.linkedin();
    if (map[arg]) return go(map[arg]);
    var w = findWork(arg); if (!w) return ln("open: '" + arg + "' not found. type `works` to see the names.", "warn");
    await typeLn("opening " + w.title + " ...", "dim", 60); await go("projects/" + w.slug + ".html");
  });
  def("home", async function () { return go(HOME); });
  def("back", async function () { return go(PAGE === "project" ? "works.html" : HOME); });
  def("plain", async function () { await typeLn("switching to the plain site ...", "dim", 60); await go("plain.html"); });
  def("next prev", async function (arg, raw) {
    var dir = raw.toLowerCase().indexOf("prev") === 0 ? -1 : 1, i = WORKS.indexOf(findWork(SLUG));
    if (PAGE !== "project" || i < 0) return ln("nothing open. try `open " + WORKS[0].alias + "` first.", "warn");
    var w = WORKS[(i + dir + WORKS.length) % WORKS.length]; await go("projects/" + w.slug + ".html");
  });
  def("filter", async function (arg) {
    var a = (arg || "").toLowerCase();
    if (a !== "on" && a !== "off") { ln("usage: filter <on|off>   (now: " + (allClear ? "off" : "on") + ")"); return; }
    allClear = a === "off"; try { localStorage.setItem("jb-filter", a); } catch (e) {} syncFx(); A.ok();
    ln("screen filter on images is now " + a + ".", "dim");
  });
  def("theme", async function (arg) {
    if (THEMES.indexOf(arg) > -1) { setTheme(arg); A.ok(); ln("display phosphor set to " + arg + ".", "dim"); }
    else ln("usage: theme <" + THEMES.join("|") + ">   (now: " + document.documentElement.dataset.theme + ")");
  });
  def("sound", async function (arg) {
    if (arg === "on" || arg === "off") { A.unlock(); A.setOn(arg === "on"); if (arg === "on") A.ok(); paintSound(); ln("sound " + arg + ".", "dim"); } else ln("usage: sound on|off");
  });
  def("clear cls", async function () { out.replaceChildren(); });
  def("reboot shutdown restart exit logout poweroff", async function () { await shutdown(); });
  def("date", async function () { ln(new Date().toString()); });
  def("echo", async function (a, raw) { ln(raw.replace(/^echo\s*/i, "")); });
  def("history", async function () { history.forEach(function (x, i) { ln(String(i + 1).padStart(3) + "  " + x); }); });
  def("uname", async function () { ln("PortfolioOS 1.0 joann x86_16 CRT"); });
  def("ping", async function () { for (var i = 0; i < 3; i++) { ln("64 bytes from joann: icmp_seq=" + i + " time=" + (8 + Math.random() * 20).toFixed(1) + " ms"); A.tick(); await sleep(380); } });
  def("sudo", async function () { A.error(); ln("guest is not in the sudoers file. This incident will be reported.", "warn"); });
  def("rm", async function () { A.error(); ln("rm: permission denied. nice try.", "warn"); });
  def("hire", async function () { await typeLn("Excellent decision.", "bright", 40); await C.contact(); });
  def("man", async function () { ln("What manual? Try `commands`.", "dim"); });
  def("matrix", async function () { await matrix(); });
  def("tetris ./tetris .tetris ./.tetris", async function () { await playTetris(); }, true);
  /* shutdown: screen collapses, then the page reloads on the power-on screen */
  async function shutdown() {
    if (leaving) return; leaving = true; busy = true; pw.hidden = true; dock.hidden = true;
    ln("Broadcast message: the system is going down for power-off NOW.", "warn"); A.seek(4); await sleep(500);
    ln("Stopping services ... done", "dim"); await new Promise(function (r) { setTimeout(r, 750); });
    var gone = false; navNow = function () { if (gone) return; gone = true; if (PAGE === "home" && !location.search) location.reload(); else location.href = href("index.html"); };
    A.whoosh(); screen.classList.remove("on"); screen.classList.add("off"); A.powerOff(); monitor.classList.remove("on-air");
    setTimeout(navNow, 1100);
  }

  function loadScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  async function playTetris() {
    ln("chmod +x .tetris ... ok", "dim"); await sleep(250); A.seek(6);
    try { if (!window.JBTetris) await loadScript(href("terminal/tetris.js")); } catch (e) { return ln("tetris: could not load (offline?)", "warn"); }
    inGame = true; pw.hidden = true; dock.hidden = true;
    await new Promise(function (done) { window.JBTetris.start({ host: screen, A: A, mobile: mobile, onExit: done }); });
    inGame = false; ln("game over. thanks for playing.", "dim");
  }
  function matrix() {
    return new Promise(function (res) {
      var c = el("canvas", "matrix"); screen.append(c); c.width = screen.clientWidth; c.height = screen.clientHeight;
      var x = c.getContext("2d"), fs = 16, cols = Math.max(1, Math.floor(c.width / fs)), drops = [];
      for (var i = 0; i < cols; i++) drops.push(Math.random() * -40);
      var chars = "01ABCDEFGHIJKLMNOPQRSTUVWXYZ<>/\\|#$%&*+=UXGAME", color = getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#5dff7a";
      var raf, tm;
      function draw() {
        x.fillStyle = "rgba(0,0,0,.09)"; x.fillRect(0, 0, c.width, c.height); x.fillStyle = color; x.font = fs + "px monospace";
        drops.forEach(function (y, i) { x.fillText(chars[Math.random() * chars.length | 0], i * fs, y * fs); drops[i] = (y * fs > c.height && Math.random() > .975) ? 0 : y + 1; });
        raf = requestAnimationFrame(draw);
      }
      function stop() { cancelAnimationFrame(raf); clearTimeout(tm); c.remove(); removeEventListener("keydown", stop, true); removeEventListener("pointerdown", stop, true); res(); }
      setTimeout(function () { addEventListener("keydown", stop, true); addEventListener("pointerdown", stop, true); }, 200);
      tm = setTimeout(stop, 15000); draw();
    });
  }

  /* ---------- running commands ---------- */
  async function run(cmd) {
    var parts = cmd.trim().split(/\s+/), name = parts[0].toLowerCase(), rest = parts.slice(1).join(" "), arg = rest.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(C, name)) return C[name](arg, cmd);
    A.error();
    var names = Object.keys(C).filter(function (k) { return !SECRET[k]; });
    var close = names.filter(function (k) { return name.length > 1 && k.indexOf(name.slice(0, 2)) === 0; })[0];
    ln("bash: " + parts[0] + ": command not found" + (close ? ". did you mean `" + close + "`?" : ". type `help`"), "warn");
  }
  async function exec(raw) {
    if (confirming) { answerConfirm(raw); return; }
    var cmd = raw.trim(); busy = true; pw.hidden = true; dock.hidden = true; A.enter(); echoCmd(raw);
    if (cmd) {
      if (history[history.length - 1] !== cmd) history.push(cmd);
      try { await run(cmd); } catch (err) { ln("error: " + err.message, "warn"); }
    }
    fast = false; busy = false; hIdx = history.length; draft = "";
    if (!booting && !leaving && !inGame) showPrompt();
  }
  async function autoType(cmd, quick) {
    var d = ln("", ""); d.append(el("span", "prompt", psEl.textContent)); var t = document.createTextNode(""), cur = el("span", "cursor solid", "\u00a0"); d.append(t, cur);
    if (fast) t.data = cmd; else {
      await sleep(quick ? 140 : 320);
      for (var i = 0; i < cmd.length; i++) { t.data += cmd[i]; A.key(); await sleep((quick ? 45 : 70) + Math.random() * 70); }
      await sleep(quick ? 120 : 260);
    }
    cur.remove(); A.enter(); await run(cmd);
  }

  /* ---------- input handling ---------- */
  var ARGS = {
    open: WORKS.map(function (w) { return w.alias; }).concat(["resume", "email", "linkedin", "works", "about", "contact"]), 
    ls: ["works", "projects", "-l", "-a"], cd: ["works", "about", "contact", "resume", "~", ".."], theme: THEMES, sound: ["on", "off"], filter: ["on", "off"]
  };
  function complete() {
    var v = inp.value, parts = v.split(/\s+/), last = parts[parts.length - 1].toLowerCase();
    var pool = parts.length === 1 ? Object.keys(C).filter(function (k) { return !SECRET[k] && k !== "?"; }) : (ARGS[parts[0].toLowerCase()] || []);
    var m = pool.filter(function (k) { return k.toLowerCase().indexOf(last) === 0; }); if (!m.length) return;
    if (m.length === 1) { parts[parts.length - 1] = m[0]; setInput(parts.join(" ") + " "); return; }
    var pre = m[0]; m.forEach(function (s) { while (s.toLowerCase().indexOf(pre.toLowerCase()) !== 0) pre = pre.slice(0, -1); });
    parts[parts.length - 1] = pre; setInput(parts.join(" "));
    var d = ln("", ""); d.append(el("span", "prompt", psEl.textContent), document.createTextNode(v)); ln(m.join("   "), "dim");
  }
  var KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"], kpos = 0;
  function konami(e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === KONAMI[kpos]) { if (++kpos === KONAMI.length) { kpos = 0; if (!busy && !booting && !inGame) { inp.blur(); exec("./tetris"); } } } else kpos = (k === KONAMI[0]) ? 1 : 0;
  }
  document.addEventListener("keydown", function (e) {
    if (inGame || !gate.hidden) return;
    konami(e);
    if (e.__unlockOnly) return;
    if (working()) {
      if (e.repeat) { e.preventDefault(); return; }
      if (e.metaKey || e.altKey) return;
      if (e.ctrlKey && e.key !== "c") return;
      if (["Shift", "Control", "Alt", "Meta", "Tab"].indexOf(e.key) > -1) return;
      e.preventDefault(); skip(); return;
    }
    if (e.target !== inp && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) focusInput();
  });
  inp.addEventListener("keydown", function (e) {
    if (busy || booting) return;
    if (e.key === "Escape" && confirming) { e.preventDefault(); confirming = null; echoCmd(inp.value); ln("cancelled.", "dim"); setInput(""); return; }
    if (e.key === "Enter") { e.preventDefault(); exec(inp.value); }
    else if (e.key === "Tab") { e.preventDefault(); complete(); A.key(); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault(); if (!history.length) return;
      if (hIdx === history.length) draft = inp.value;
      hIdx = Math.min(history.length, Math.max(0, hIdx + (e.key === "ArrowUp" ? -1 : 1))); setInput(hIdx < history.length ? history[hIdx] : draft);
      requestAnimationFrame(function () { inp.setSelectionRange(inp.value.length, inp.value.length); renderInput(); });
    }
    else if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); out.replaceChildren(); }
    else if (e.ctrlKey && e.key.toLowerCase() === "c") { e.preventDefault(); echoCmd(inp.value + "^C"); setInput(""); A.error(); }
    else if (e.key.length === 1 || e.key === "Backspace") A.key();
  });
  inp.addEventListener("input", function () { if (/Android|iPhone|iPad/i.test(navigator.userAgent)) A.key(); });
  screen.addEventListener("click", function (e) {
    if (e.target.closest("a, button, iframe, .vid")) return;
    if (String(getSelection())) return;
    if (booting || busy) return;
    if (coarse && e.target.closest(".shot, .vid-wrap, .gallery, .work, .cat-pic")) return;
    focusInput();
  });
  /* tap or click anywhere while something is typing: finish it instantly */
  screen.addEventListener("pointerdown", function (e) {
    if (e.__unlockOnly || !working() || inGame || !gate.hidden) return;
    if (e.target.closest("a, button, iframe, .vid")) return;
    skip();
  });
  document.addEventListener("pointerdown", function (e) { if (e.__unlockOnly) e.stopImmediatePropagation(); }, true);
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-cmd]"); if (!b) return;
    if (booting) return skip(); if (busy) return skip(); exec(b.dataset.cmd);
  });

  /* secret on touch screens and desktops: five quick taps on the brand */
  var taps = [];
  function brandTap() {
    var now = Date.now(); taps = taps.filter(function (t) { return now - t < 1800; }); taps.push(now);
    if (taps.length >= 5 && !busy && !booting && !inGame) { taps = []; exec("./tetris"); }
  }
  $("#brand").addEventListener("click", brandTap); document.querySelector(".mtop span").addEventListener("click", brandTap);

  /* dock */
  function buildDock() {
    var list = [["home", "home"], ["works", "works"], ["about", "about"], ["contact", "contact"], ["resume", "resume"], ["help", "help"]];
    if (PAGE === "project") list = [["back", "back"], ["works", "works"], ["home", "home"], ["contact", "contact"]];
    dock.replaceChildren(); list.forEach(function (c) { var b = el("button", "chip"); b.type = "button"; b.dataset.cmd = c[1]; b.append(c[0]); dock.append(b); });
  }
  buildDock();

  /* ---------- boot and page intros ---------- */
  setInterval(function () { var v = working() && !inGame && gate.hidden; bSkip.hidden = !v; mSkip.hidden = !v; }, 120);
  bSkip.addEventListener("click", skip); mSkip.addEventListener("click", skip);

  var W = 40;
  function statusLine(name, status, cls) {
    var d = ln("", ""), left = ("  " + name).padEnd(W - status.length - 4, ".");
    d.append(document.createTextNode(left + " ["), el("span", cls || "ok", status), document.createTextNode("]"));
  }
  async function counter(label, to, step, suffix) {
    var d = ln("", "");
    for (var k = 0; k <= to; k += step) { d.textContent = label + String(Math.min(k, to)).padStart(6) + "K"; if (k % (step * 4) === 0) A.tick(); scrollEnd(); await sleep(30); }
    d.textContent = label + String(to).padStart(6) + "K  "; d.append(el("span", "ok", suffix));
  }
  async function progress(label) {
    var d = ln("", ""), n = 26;
    for (var i = 0; i <= n; i++) { d.textContent = label + " [" + "#".repeat(i) + ".".repeat(n - i) + "] " + String(Math.round(i / n * 100)).padStart(3) + "%"; if (i % 2 === 0) A.seek(1); await sleep(40 + Math.random() * 60); }
  }
  function lastLogin() {
    var prev = null; try { prev = localStorage.getItem("jb-last"); localStorage.setItem("jb-last", new Date().toString().slice(0, 24)); } catch (e) {}
    return prev ? "Last login: " + prev + " on tty1" : "Welcome, new user. This is your first login.";
  }
  function lightUp() { monitor.classList.add("on-air"); screen.classList.remove("off", "settled"); void screen.offsetWidth; screen.classList.add("on"); setTimeout(function () { screen.classList.add("settled"); }, 1500); }

  /* power-on screen: a real power button, plus the plain-site and sound choices */
  function doPowerOn() { if (gate.hidden) return; A.unlock(); gate.hidden = true; gate.innerHTML = ""; lightUp(); boot(); }
  function showGate() {
    busy = true; gate.hidden = false;
    gate.innerHTML = '<div class="gate-box"><div class="gate-title">PRODSOUL TERMINAL 29007</div><div class="gate-sub">standby</div>' +
      '<button type="button" class="pbtn" id="g-power" aria-label="Power on"><span class="ring"></span><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8v22"/><path d="M19 17a22 22 0 1 0 26 0"/></svg></button>' +
      '<div class="gate-hint">press the button to power on</div>' +
      '<div class="gate-opts"><a class="gbtn" id="g-plain" href="plain.html">plain site</a>' +
      '</div>' +
      '<div class="gate-hint">power on starts the full terminal experience.<br>the plain site is a simple, easy-to-read version.</div></div>';
    var gp = gate.querySelector("#g-power");
    gp.addEventListener("click", doPowerOn);
    setTimeout(function () { try { gp.focus(); } catch (e) {} }, 50);
  }
  /* the button on the monitor does the same thing: powers on from standby, shuts down otherwise */
  $("#b-pwr").addEventListener("click", function () { if (!gate.hidden) doPowerOn(); else askPlain(); });
  $("#m-plain").addEventListener("click", function () { if (!gate.hidden) return; askPlain(); });
  /* yes/no confirmation: enter or "yes" confirms, esc or "no" cancels */
  var confirming = null;
  function askPlain() {
    if (busy || booting || leaving || inGame || confirming) return;
    pw.hidden = false; dock.hidden = false;
    var q = ln("Leave the terminal and open the plain site? [Y/n]  (enter = yes, esc = no)", "warn");
    confirming = function (yes) { if (yes) { ln("switching to the plain site ...", "dim"); busy = true; pw.hidden = true; dock.hidden = true; go("plain.html"); } else ln("cancelled.", "dim"); };
    setInput(""); focusInput(); scrollEnd(true);
  }
  function answerConfirm(raw) {
    var a = raw.trim().toLowerCase(), f = confirming; echoCmd(raw);
    if (a === "" || a === "y" || a === "yes") { confirming = null; f(true); }
    else if (a === "n" || a === "no") { confirming = null; f(false); }
    else ln("please answer yes or no.", "dim");
    setInput("");
  }

  async function boot() {
    booting = true; busy = true; pw.hidden = true; dock.hidden = true; fast = false;
    out.replaceChildren(); A.powerOn(); A.hum(true); await sleep(900);
    A.post();
    await typeLn("JB-BIOS v2.6.1   (C) 2026 PRODSOUL SYSTEMS", "bright", 70); await sleep(120);
    ln("UX-CORE(tm) 8 CORES @ 4.20GHz"); await sleep(150);
    await counter("MEMORY TEST  ", 65536, 4096, "OK"); await sleep(140); gap();
    ln("Detecting devices ...", "dim"); await sleep(240);
    var devs = [["/dev/figma", "OK"], ["/dev/unity", "OK"], ["/dev/playtest", "OK"], ["/dev/digipen", "OK"], ["/dev/sergio", "MEOW", "warn"]];
    for (var i = 0; i < devs.length; i++) { statusLine(devs[i][0], devs[i][1], devs[i][2]); A.seek(3); scrollEnd(); await sleep(200); }
    gap(); await sleep(140);
    ln("Loading kernel: PORTFOLIO_OS 1.0", "bright"); await progress(""); await sleep(120);
    ln("Mounting /home/joann/works ... done"); await sleep(240);
    ln("Starting login service ......... READY", "bright"); A.ok(); await sleep(450);
    gap(); var lg = ln("", ""); lg.append("joann login: "); var t = document.createTextNode(""); lg.append(t);
    if (fast) t.data = "guest"; else { await sleep(300); for (var c of "guest") { t.data += c; A.key(); await sleep(110); } await sleep(200); }
    var pwl = ln("Password: ", ""); if (!fast) { for (var k = 0; k < 8; k++) { A.key(); await sleep(70); } } pwl.append("********"); A.enter(); await sleep(380);
    ln(lastLogin(), "dim"); await sleep(500);
    A.hum(false);
    await intro();
  }
  /* home screen: name banner, then a few commands typed for the visitor. Also used by the `home` command (no boot). */
  async function intro() {
    booting = true; busy = true; pw.hidden = true; dock.hidden = true;
    A.whoosh(); out.replaceChildren(); await sleep(200);
    var wrap = el("div", "banner"); out.append(wrap);
    await blockArt(NAME1, { delay: 90, label: "Joann", into: wrap });
    await blockArt(NAME2, { delay: 90, label: "Bisseling", into: wrap });
    ln("PORTFOLIO_OS 1.0   //   UX & GAME DESIGN   //   SINGAPORE", "dim"); await sleep(450); gap();
    await autoType("whoami"); await sleep(220); gap();
    await autoType("about"); await sleep(160);
    await autoType("ls projects"); await sleep(120); gap();
    var hint = ln("", "dim"); await typeInto(hint, "Type `help` for commands, `commands` for the full list, or tap a shortcut below. Something is hiding in here. Try `ls -a`.", 110);
    finishIntro();
  }
  function finishIntro() { booting = false; fast = false; busy = false; A.hum(false); showPrompt(); }
  async function pageIntro() {
    booting = true; busy = true; lightUp(); A.powerOn(); A.seek(4); out.replaceChildren(); await sleep(700);
    var l1 = ln("", "dim"); await typeInto(l1, "link up ... 9600 baud ... " + lastLogin(), 160); gap();
    var typed = { works: "works", about: "about", contact: "contact", resume: "resume", project: "open " + ((findWork(SLUG) || { alias: SLUG }).alias) }[PAGE] || "help";
    var d = ln("", ""); d.append(el("span", "prompt", psEl.textContent)); var t = document.createTextNode(""), cur = el("span", "cursor solid", " "); d.append(t, cur);
    if (fast) t.data = typed; else { await sleep(220); for (var i = 0; i < typed.length; i++) { t.data += typed[i]; A.key(); await sleep(50 + Math.random() * 50); } await sleep(200); }
    cur.remove(); A.enter(); gap();
    if (PAGE === "works") await workCards(WORKS);
    else if (PAGE === "about") { await C.about(); await sleep(200); gap(); await autoType("skills", true); }
    else if (PAGE === "contact") { await C.contact(); gap(); ln("Open to conversations about design, internships and collaboration.", "dim"); }
    else if (PAGE === "resume") await C.resume();
    else if (PAGE === "project") await renderDoc();
    gap(); var hint = ln("", "dim"); await typeInto(hint, "type `help`, or use the shortcuts below.", 140);
    finishIntro();
  }

  /* ---------- little life: random glitch, power LED ---------- */
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!calm) (function glitch() {
    setTimeout(function () { if (!busy || booting) { screen.classList.add("glitch"); setTimeout(function () { screen.classList.remove("glitch"); }, 240); } glitch(); }, 18000 + Math.random() * 22000);
  })();

  /* ---------- go ---------- */
  window.JBTerm = { run: run, go: go };
  function start() {
    var q = location.search;
    if (PAGE === "home" && q.indexOf("home") > -1) {
      try { history_.replaceState(null, "", location.pathname); } catch (e) {}
      lightUp(); A.powerOn(); intro().catch(function (e) { console.error(e); finishIntro(); });
    } else if (PAGE === "home") showGate();
    else pageIntro().catch(function (e) { console.error(e); finishIntro(); });
  }
  var history_ = window.history;
  if (document.fonts && document.fonts.load) Promise.race([document.fonts.load('17px "Departure Mono"'), new Promise(function (r) { setTimeout(r, 1200); })]).then(start, start); else start();
})();
