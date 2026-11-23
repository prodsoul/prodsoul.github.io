/* Joann Bisseling portfolio: a small terminal emulator that runs every page.
   Needs data.js and audio.js loaded first. Each page only sets data-page / data-root on <body>. */
(function () {
  "use strict";
  var JB = window.JB, A = window.JBAudio, body = document.body;
  var PAGE = body.dataset.page || "home", ROOT = body.dataset.root || "", SLUG = body.dataset.slug || "";
  var coarse = matchMedia("(pointer: coarse)").matches;
  var WORKS = JB.works, doc = document.getElementById("doc");
  A.setRoot(ROOT);
  var THEMES = ["green", "amber", "blue", "ice"];
  var t0 = Date.now();

  /* ---------- build the monitor ---------- */
  var h = '<div class="stage" id="stage"><div class="monitor on-air" id="monitor"><div class="crt" id="crt">' +
    '<div class="screen on" id="screen">' +
    '<div class="mtop"><span>JB-TERM</span><span class="sp2"></span><button type="button" id="m-snd"></button><button type="button" id="m-thm"></button></div>' +
    '<div class="scroll" id="scroll"><div class="term" id="term"><div id="out" role="log" aria-live="off"></div>' +
    '<label id="promptwrap" hidden><span class="prompt" id="ps"></span><span id="line"><span id="cpre"></span><span class="cursor" id="ccur">&nbsp;</span><span id="cpost"></span></span>' +
    '<input id="inp" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="terminal input"></label></div></div>' +
    '<div class="dock" id="dock" hidden></div>' +
    '<div class="skiphint" id="skiphint" hidden></div>' +
    '<div class="fx fx-flick"></div><div class="fx fx-roll"></div><div class="fx fx-noise"></div><div class="fx fx-scan"></div><div class="fx fx-glare"></div><div class="fx fx-vig"></div>' +
    '</div></div>' +
    '<div class="plate"><span class="led"></span><span class="brand" id="brand">Prodsoul Terminal 4000</span><button type="button" id="b-snd"></button><button type="button" id="b-thm"></button></div>' +
    '</div></div>';
  var keep = [].slice.call(body.querySelectorAll("script, noscript, #doc"));
  body.insertAdjacentHTML("afterbegin", h);
  var $ = function (s) { return document.querySelector(s); };
  var screen = $("#screen"), scroller = $("#scroll"), out = $("#out"), pw = $("#promptwrap"), psEl = $("#ps"), inp = $("#inp");
  var cpre = $("#cpre"), ccur = $("#ccur"), cpost = $("#cpost"), dock = $("#dock"), skipHint = $("#skiphint");
  var bSnd = $("#b-snd"), bThm = $("#b-thm"), mSnd = $("#m-snd"), mThm = $("#m-thm");

  /* ---------- sizing: a fixed 4:3 monitor on desktop, full screen on phones ---------- */
  var mobile = false;
  function fitScreen() {
    var vw = innerWidth, vh = innerHeight;
    mobile = (coarse && Math.min(vw, vh) < 900) || vw < 760;
    body.classList.toggle("mobile", mobile);
    if (!mobile) {
      var s = Math.min((vw - 16) / 1048, (vh - 16) / 832, 1.25);
      document.documentElement.style.setProperty("--s", Math.max(0.35, s).toFixed(4));
    }
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
  function skip() { fast = true; sleepers.slice().forEach(function (f) { f(); }); }

  /* ---------- dom helpers ---------- */
  function el(tag, cls, content) {
    var e = document.createElement(tag); if (cls) e.className = cls;
    if (content != null) { if (content instanceof Node) e.append(content); else e.textContent = content; }
    return e;
  }
  function scrollEnd(force) { if (force) follow = true; if (follow) scroller.scrollTop = scroller.scrollHeight; }
  scroller.addEventListener("scroll", function () { follow = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 50; });
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
    var on = A.isOn(), tx = "sound: " + (on ? (A.ready() ? "on" : "tap") : "off");
    bSnd.textContent = tx; mSnd.textContent = on ? "snd on" : "snd off"; bSnd.setAttribute("aria-pressed", String(on));
    if (booting) paintSkipHint();
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
    if (firstGesture) { firstGesture = false; if (!wasReady && A.isOn() && booting) { e.__unlockOnly = true; } }
  }
  ["pointerdown", "keydown", "touchend"].forEach(function (ev) { addEventListener(ev, gesture, true); });

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
  var GL = {
    J: ["..###", "...#.", "...#.", "#..#.", ".##.."], O: [".###.", "#...#", "#...#", "#...#", ".###."], A: [".###.", "#...#", "#####", "#...#", "#...#"],
    N: ["#...#", "##..#", "#.#.#", "#..##", "#...#"], B: ["####.", "#...#", "####.", "#...#", "####."], I: ["#####", "..#..", "..#..", "..#..", "#####"],
    S: [".####", "#....", ".###.", "....#", "####."], E: ["#####", "#....", "####.", "#....", "#####"], L: ["#....", "#....", "#....", "#....", "#####"],
    G: [".####", "#....", "#..##", "#...#", ".###."]
  };
  function bannerRows(word) {
    var rows = [];
    for (var r = 0; r < 5; r++) rows.push(word.split("").map(function (ch) { return GL[ch][r].replace(/\./g, " "); }).join(" ").replace(/\s+$/, ""));
    return rows;
  }
  var CAT = ["   /\\___/\\", "  (  o o  )   zzZ", "  (  =^=  )", "   )     (", "  (  )_(  )__", "   \\_/ \\_/ (__)"];
  var PAD = ["    ___________________", "   /  _                \\", "  /  | |_    (Y)  (X)   \\", " |  _| |_|    (B)  (A)   |",
    " | |_   _|     .--.      |", " |   |_|      /    \\     |", "  \\    ______/      \\____/", "   '--'"];

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
      shot.append(im); fig.append(shot);
      var cap = f.querySelector("figcaption"); if (cap) fig.append(el("figcaption", "", cap.textContent));
      wrap.append(fig);
      setTimeout(function () { shot.classList.remove("pend"); shot.classList.add("reveal"); A.seek(2); scrollEnd(); }, fast ? 0 : k * 220);
    });
    scrollEnd(); await sleep(450 + n * 160);
  }
  function video(node) {
    var id = node.dataset.yt, title = node.dataset.title || "video";
    var wrap = el("div", "vid-wrap"), shot = el("div", "shot"), v = el("div", "vid");
    var poster = el("div", "poster"); poster.style.backgroundImage = "url(https://i.ytimg.com/vi/" + id + "/hqdefault.jpg)";
    var pb = el("button", "play", "> PLAY"); pb.type = "button"; pb.setAttribute("aria-label", "Play video: " + title);
    v.append(poster, pb); shot.append(v); wrap.append(shot, el("div", "vid-cap", title));
    function play() {
      var f = document.createElement("iframe"); f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1";
      f.title = title; f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true; f.referrerPolicy = "strict-origin-when-cross-origin";
      v.classList.add("playing"); poster.remove(); v.append(f); A.hum(false); A.beep(700, .05);
    }
    v.addEventListener("click", play); out.append(wrap); A.seek(3); scrollEnd();
  }

  /* case study renderer: reads the hidden #doc article */
  async function renderDoc() {
    if (!doc) return;
    var kids = [].slice.call(doc.children);
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i], tag = n.tagName.toLowerCase(), cls = n.className;
      if (tag === "h1") { var h1 = el("h1", "t ln new"); out.append(h1); await typeInto(h1, n.textContent, 55); }
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
      else if (cls === "video") video(n);
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
    if (leaving) return; leaving = true; busy = true; pw.hidden = true; dock.hidden = true;
    if (/^https?:/.test(file) || /^mailto:/.test(file)) { location.href = file; return; }
    A.seek(5); A.whoosh();
    var d = ln("", "dim"); d.textContent = "connecting to " + file.replace(/^projects\//, "") + " ..."; scrollEnd(true);
    await new Promise(function (r) { setTimeout(r, 380); });
    screen.classList.remove("on"); screen.classList.add("off"); A.powerOff();
    setTimeout(function () { location.href = href(file); }, 430);
  }
  addEventListener("pageshow", function (e) {
    if (e.persisted) { leaving = false; busy = false; screen.classList.remove("off"); screen.classList.add("on"); pw.hidden = false; dock.hidden = false; focusInput(); }
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

  def("help ?", async function () {
    var g = el("div", "help ln new"), rows = [
      ["about", "who is Joann?"], ["works", "all projects with previews"], ["open <name>", "open a project (try: open convex)"],
      ["ls [works]", "list projects, quick view"], ["cat <file>", "about.txt · sergio.png · resume.pdf"],
      ["skills", "tools and methods"], ["contact · resume", "reach me, see my resume"], ["neofetch · top", "system info"],
      ["theme <name>", "green · amber · blue · ice"], ["sound on|off", "typing clicks and beeps"],
      ["clear · reboot", "wipe the screen · restart"]
    ];
    rows.forEach(function (r) { g.append(el("b", "", r[0]), el("span", "dim", r[1])); }); out.append(g);
    ln("tab: autocomplete   up/down: history   or tap a shortcut below", "dim");
  });
  def("about", async function () { for (var i = 0; i < JB.about.length; i++) { var p = el("p", "p ln new"); out.append(p); await typeInto(p, JB.about[i], 170); } });
  def("whoami", async function () { await typeLn("Joann Bisseling | UX & Game Design | Singapore", "bright", 70); ln("status: open to internships", "dim"); });
  def("skills", async function () {
    var g = el("div", "help tight ln new"); JB.skills.forEach(function (s) { g.append(el("b", "", s[0]), el("span", "", s[1])); }); out.append(g); A.tick();
  });
  def("ls dir", async function (arg) {
    arg = (arg || "").replace(/^-\w+\s*/, function (m) { return m; });
    var flags = (arg.match(/^-\w+/) || [""])[0], rest = arg.replace(/^-\w+\s*/, "").replace(/\/$/, "");
    if (rest === "works" || rest === "all") { if (flags === "-l") { await workCards(WORKS); } else { workRows(WORKS); ln("tip: open <name>, e.g. open " + WORKS[0].alias, "dim"); } }
    else if (rest === "projects") { await workCards(WORKS.filter(function (w) { return w.featured; })); ln("3 of " + WORKS.length + " shown. type `works` to see them all", "dim"); }
    else if (!rest) {
      var d = el("div", "ln new"); d.append(el("span", "bright", "works/  "), "about.txt  contact.txt  resume.pdf  sergio.png  sergio.asc  README.md" + (flags.indexOf("a") > -1 ? "  " : ""));
      if (flags.indexOf("a") > -1) d.append(el("span", "warn", ".tetris"));
      out.append(d);
    } else ln("ls: cannot access '" + rest + "': No such file or directory");
  });
  def("works projects", async function () { await workCards(WORKS); ln("open <name> to read a case study, e.g. open " + WORKS[0].alias, "dim"); });
  def("cd", async function (arg) {
    arg = (arg || "~").replace(/\/$/, "");
    var map = { "~": "index.html", "": "index.html", "..": PAGE === "project" ? "works.html" : "index.html", works: "works.html", about: "about.html", contact: "contact.html", resume: "resume.html" };
    if (map[arg]) return go(map[arg]);
    var w = findWork(arg); if (w) return go("projects/" + w.slug + ".html");
    ln("cd: " + arg + ": No such file or directory", "warn");
  });
  def("pwd", async function () { ln("/home/guest/" + cwd().replace(/^~\/?/, "")); });
  def("cat more less", async function (arg, raw) {
    var a = (arg || "").toLowerCase();
    if (!a) return ln("cat: missing file operand. try `cat about.txt`", "warn");
    if (a === "about.txt") return C.about();
    if (a === "contact.txt") return C.contact();
    if (a === "readme.md") { await typeLn("This portfolio is a terminal. Type `help` to look around.", "", 90); ln("hint: there is a hidden file. `ls -a` shows it.", "dim"); return; }
    if (a === "resume.pdf") return C.resume();
    if (a === "sergio.asc") return C.sergio();
    if (a === "sergio.png") return catPhoto();
    if (a === ".tetris") return ln("cat: .tetris: binary file. run it with ./tetris", "warn");
    var w = findWork(a); if (w) return go("projects/" + w.slug + ".html");
    ln("cat: " + arg + ": No such file or directory", "warn");
  });
  async function catPhoto() {
    var wrap = el("div", "shot cat-pic pend"), im = new Image(); im.src = href("assets/images/sergio.png"); im.alt = "Sergio, the cat"; wrap.append(im);
    await loadImg(im.src); out.append(wrap); await sleep(60); wrap.classList.remove("pend"); wrap.classList.add("reveal"); A.seek(4); A.meow(); scrollEnd();
    await sleep(900); ln("SERGIO.PNG   status: unbothered   mood: judging your UI", "dim");
  }
  def("sergio", async function () {
    await art(CAT, { delay: 90, label: "ASCII cat named Sergio" }); A.meow();
    ln("SERGIO.EXE   status: unbothered   mood: judging your UI", "dim");
  });
  def("neofetch", async function () {
    var box = el("div", "nf ln new"); out.append(box); var holder = el("div"); box.append(holder);
    await art(PAD, { delay: 40, label: "ASCII game controller", into: holder });
    var info = el("div"); box.append(info);
    var up = Math.max(1, Math.round((Date.now() - t0) / 1000));
    var rows = [["guest@joann", null], ["-----------", null], ["OS", "PortfolioOS 1.0"], ["Role", "UX & Game Design student"], ["Location", "Singapore"],
      ["Tools", "Figma, Unity"], ["Background", "Big Data Analytics"], ["Mascot", "Sergio (cat)"], ["Status", "open to internships"], ["Uptime", up + "s"],
      ["Theme", document.documentElement.dataset.theme], ["Secrets", "1 (hint: ls -a)"]];
    for (var i = 0; i < rows.length; i++) {
      var d = el("div"), r = rows[i]; if (r[1] == null) d.append(el("span", "bright", r[0])); else d.append(el("span", "k", r[0] + ": "), r[1]);
      info.append(d); A.tick(); scrollEnd(); await sleep(60);
    }
  });
  def("top", async function () {
    var pre = el("pre", "art ln new"); out.append(pre); pre.style.lineHeight = "1.5";
    var procs = [["figma", "S", 34], ["unity", "R", 28], ["playtest", "S", 9], ["kopi.service", "S", 4], ["sergio", "Z", 0], ["coffee", "R", 2], ["tetris", "T", 0]];
    for (var f = 0; f < 5; f++) {
      var s = "top - " + new Date().toTimeString().slice(0, 8) + " up " + Math.max(1, Math.round((Date.now() - t0) / 60000)) + " min,  1 user,  load: " + (0.4 + Math.random()).toFixed(2) + "\n" +
        "Tasks: " + procs.length + " total   Cpu(s): " + (20 + Math.random() * 60 | 0) + "% us   Mem: 640K used (it is enough)\n\n  PID  USER   S  %CPU  COMMAND\n";
      procs.forEach(function (p, i) { s += String(1001 + i * 7).padStart(5) + "  guest  " + p[1] + "  " + String(Math.max(0, p[2] + (Math.random() * 10 - 5)) .toFixed(1)).padStart(4) + "  " + p[0] + "\n"; });
      pre.textContent = s; A.tick(); scrollEnd(); await sleep(520);
    }
    ln("(sergio has been asleep since boot)", "dim");
  });
  def("resume", async function () {
    var pdf = href(JB.links.resumePdf);
    await typeLn("resume.pdf   (30 KB)", "bright", 80);
    var ac = el("div", "actions ln new"), a = el("a", "", "[ open pdf ]"); a.href = pdf; a.target = "_blank"; a.rel = "noopener";
    var d = el("a", "", "[ download ]"); d.href = pdf; d.setAttribute("download", "JoannBisseling_Resume.pdf"); ac.append(a, d); out.append(ac); A.ok();
    if (!mobile) {
      var shot = el("div", "shot pend"), fr = document.createElement("iframe"); fr.className = "pdf-frame"; fr.title = "Joann Bisseling resume"; fr.src = pdf;
      shot.append(fr); out.append(shot); await sleep(120); shot.classList.remove("pend"); A.seek(4); scrollEnd();
    }
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
    var map = { resume: "resume.html", works: "works.html", about: "about.html", contact: "contact.html", home: "index.html" };
    if (arg === "email") return C.email(); if (arg === "linkedin") return C.linkedin();
    if (map[arg]) return go(map[arg]);
    var w = findWork(arg); if (!w) return ln("open: '" + arg + "' not found. type `works` to see the names.", "warn");
    await typeLn("opening " + w.title + " ...", "dim", 60); await go("projects/" + w.slug + ".html");
  });
  def("home", async function () { return go("index.html"); });
  def("back", async function () { return go(PAGE === "project" ? "works.html" : "index.html"); });
  def("next prev", async function (arg, raw) {
    var dir = raw.toLowerCase().indexOf("prev") === 0 ? -1 : 1, i = WORKS.indexOf(findWork(SLUG));
    if (PAGE !== "project" || i < 0) return ln("nothing open. try `open " + WORKS[0].alias + "` first.", "warn");
    var w = WORKS[(i + dir + WORKS.length) % WORKS.length]; await go("projects/" + w.slug + ".html");
  });
  def("theme", async function (arg) {
    if (THEMES.indexOf(arg) > -1) { setTheme(arg); A.ok(); ln("display phosphor set to " + arg + ".", "dim"); }
    else ln("usage: theme <" + THEMES.join("|") + ">   (now: " + document.documentElement.dataset.theme + ")");
  });
  def("sound", async function (arg) {
    if (arg === "on" || arg === "off") { A.unlock(); A.setOn(arg === "on"); if (arg === "on") A.ok(); paintSound(); ln("sound " + arg + ".", "dim"); } else ln("usage: sound on|off");
  });
  def("clear cls", async function () { out.replaceChildren(); });
  def("reboot restart", async function () { if (PAGE === "home") await powerCycle(); else await go("index.html"); });
  def("date", async function () { ln(new Date().toString()); });
  def("echo", async function (a, raw) { ln(raw.replace(/^echo\s*/i, "")); });
  def("history", async function () { history.forEach(function (x, i) { ln(String(i + 1).padStart(3) + "  " + x); }); });
  def("uname", async function () { ln("PortfolioOS 1.0 joann x86_16 CRT"); });
  def("ping", async function () { for (var i = 0; i < 3; i++) { ln("64 bytes from joann: icmp_seq=" + i + " time=" + (8 + Math.random() * 20).toFixed(1) + " ms"); A.tick(); await sleep(380); } });
  def("sudo", async function () { A.error(); ln("guest is not in the sudoers file. This incident will be reported to Sergio.", "warn"); });
  def("rm", async function () { A.error(); ln("rm: permission denied. nice try.", "warn"); });
  def("exit logout", async function () { ln("There is no escape. Try `reboot` instead.", "dim"); });
  def("hire", async function () { await typeLn("Excellent decision.", "bright", 40); await C.contact(); });
  def("man", async function () { ln("What manual? Try `help`.", "dim"); });
  def("matrix", async function () { await matrix(); });
  def("tetris ./tetris .tetris ./.tetris", async function () { await playTetris(); }, true);

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
    open: WORKS.map(function (w) { return w.alias; }).concat(["resume", "email", "linkedin", "works", "about", "contact"]), cat: ["about.txt", "sergio.png", "sergio.asc", "resume.pdf", "contact.txt", "README.md"],
    ls: ["works", "projects", "-l", "-a"], cd: ["works", "about", "contact", "resume", "~", ".."], theme: THEMES, sound: ["on", "off"]
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
    if (inGame) return;
    konami(e);
    if (e.__unlockOnly) return;
    if (booting || busy) {
      if (e.metaKey || e.altKey) return;
      if (e.ctrlKey && e.key !== "c") return;
      if (["Shift", "Control", "Alt", "Meta", "Tab"].indexOf(e.key) > -1) return;
      e.preventDefault(); skip(); return;
    }
    if (e.target !== inp && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) focusInput();
  });
  inp.addEventListener("keydown", function (e) {
    if (busy || booting) return;
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
    focusInput();
  });
  /* tap or click anywhere while something is typing: finish it instantly */
  screen.addEventListener("pointerdown", function (e) {
    if (e.__unlockOnly || !(booting || busy) || inGame) return;
    if (e.target.closest("a, button, iframe, .vid")) return;
    skip();
  });
  document.addEventListener("pointerdown", function (e) { if (e.__unlockOnly) e.stopImmediatePropagation(); }, true);
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-cmd]"); if (!b) return;
    if (booting) return skip(); if (busy) return skip(); exec(b.dataset.cmd);
  });
  skipHint.addEventListener("click", function (e) { if (e.target.closest("button")) skip(); });

  /* secret on touch screens and desktops: five quick taps on the brand */
  var taps = [];
  function brandTap() {
    var now = Date.now(); taps = taps.filter(function (t) { return now - t < 1800; }); taps.push(now);
    if (taps.length >= 5 && !busy && !booting && !inGame) { taps = []; exec("./tetris"); }
  }
  $("#brand").addEventListener("click", brandTap); $(".mtop span").addEventListener("click", brandTap);

  /* dock */
  function buildDock() {
    var list = [["help", "help"], ["works", "works"], ["about", "about"], ["contact", "contact"], ["resume", "resume"]];
    if (PAGE === "project") list = [["back", "back"], ["prev", "prev"], ["next", "next"], ["works", "works"], ["contact", "contact"]];
    dock.replaceChildren(); list.forEach(function (c) { var b = el("button", "chip"); b.type = "button"; b.dataset.cmd = c[1]; b.append(c[0]); dock.append(b); });
  }
  buildDock();

  /* ---------- boot and page intros ---------- */
  function paintSkipHint() {
    if (!booting) { skipHint.hidden = true; return; }
    skipHint.hidden = false; skipHint.replaceChildren();
    if (A.isOn() && !A.ready()) { var s = el("div", "soundhint", (coarse ? "tap" : "press a key") + " for sound"); skipHint.append(s); }
    var b = el("button", "", "skip"); b.type = "button"; skipHint.append(b);
  }
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
  async function boot() {
    booting = true; busy = true; pw.hidden = true; dock.hidden = true; paintSkipHint();
    out.replaceChildren(); A.powerOn(); await sleep(700);
    A.post();
    await typeLn("JB-BIOS v2.6.1   (C) 2026 PRODSOUL SYSTEMS", "bright", 70); await sleep(120);
    ln("UX-CORE(tm) 8 CORES @ 4.20GHz"); await sleep(150);
    await counter("MEMORY TEST  ", 65536, 4096, "OK"); await sleep(140); gap();
    ln("Detecting devices ...", "dim"); await sleep(240);
    var devs = [["/dev/figma", "OK"], ["/dev/unity", "OK"], ["/dev/playtest", "OK"], ["/dev/kopi", "OK"], ["/dev/sergio", "ZZZ", "warn"]];
    for (var i = 0; i < devs.length; i++) { statusLine(devs[i][0], devs[i][1], devs[i][2]); A.seek(3); scrollEnd(); await sleep(200); }
    gap(); await sleep(140);
    ln("Loading kernel: PORTFOLIO_OS 1.0", "bright"); await progress(""); await sleep(120);
    ln("Mounting /home/joann/works ... done"); await sleep(240);
    ln("Starting login service ......... READY", "bright"); A.ok(); await sleep(450);
    gap(); var lg = ln("", ""); lg.append("joann login: "); var t = document.createTextNode(""); lg.append(t);
    if (fast) t.data = "guest"; else { await sleep(300); for (var c of "guest") { t.data += c; A.key(); await sleep(110); } await sleep(200); }
    var pwl = ln("Password: ", ""); if (!fast) { for (var k = 0; k < 8; k++) { A.key(); await sleep(70); } } pwl.append("********"); A.enter(); await sleep(380);
    ln(lastLogin(), "dim"); await sleep(400);
    screen.classList.add("flash"); A.whoosh(); out.replaceChildren(); await sleep(130);
    var wrap = el("div", "banner"); out.append(wrap);
    await art(bannerRows("JOANN"), { delay: 70, label: "Joann", into: wrap, cls: "b1" });
    await art(bannerRows("BISSELING"), { delay: 70, label: "Bisseling", into: wrap, cls: "b2" });
    ln("PORTFOLIO_OS 1.0   //   UX & GAME DESIGN   //   SINGAPORE", "dim"); await sleep(450); gap();
    await autoType("whoami"); await sleep(220); gap();
    await autoType("cat about.txt"); await sleep(160);
    await autoType("ls projects"); await sleep(120); gap();
    var hint = ln("", "dim"); await typeInto(hint, "Type `help` for commands, or tap a shortcut below. Something is hiding in here. Try `ls -a`.", 110);
    finishIntro();
  }
  function finishIntro() { booting = false; fast = false; busy = false; skipHint.hidden = true; showPrompt(); screen.classList.remove("flash"); }
  async function powerCycle() {
    if (booting) return; pw.hidden = true; dock.hidden = true; screen.classList.remove("on"); screen.classList.add("off"); A.powerOff();
    await new Promise(function (r) { setTimeout(r, 520); }); out.replaceChildren(); screen.classList.remove("off"); void screen.offsetWidth; screen.classList.add("on");
    await boot();
  }
  async function pageIntro() {
    booting = true; busy = true; paintSkipHint(); A.powerOn(); A.seek(4); out.replaceChildren(); await sleep(450);
    var l1 = ln("", "dim"); await typeInto(l1, "link up ... 9600 baud ... " + lastLogin(), 160); gap();
    var f = { works: ["ls -l works", function () { return C.ls("-l works"); }], about: ["cat about.txt", null], contact: ["contact", null], resume: ["cat resume.pdf", null], project: ["cat " + ((findWork(SLUG) || { alias: SLUG }).alias) + ".txt", null] }[PAGE] || ["help", null];
    var d = ln("", ""); d.append(el("span", "prompt", psEl.textContent)); var t = document.createTextNode(""), cur = el("span", "cursor solid", "\u00a0"); d.append(t, cur);
    if (fast) t.data = f[0]; else { await sleep(180); for (var i = 0; i < f[0].length; i++) { t.data += f[0][i]; A.key(); await sleep(45 + Math.random() * 50); } await sleep(160); }
    cur.remove(); A.enter(); gap();
    if (PAGE === "works") await workCards(WORKS);
    else if (PAGE === "about") { await C.about(); await sleep(150); await autoType("skills", true); gap(); await autoType("cat sergio.png", true); }
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
  function start() { (PAGE === "home" ? boot() : pageIntro()).catch(function (e) { console.error(e); finishIntro(); }); }
  if (document.fonts && document.fonts.load) Promise.race([document.fonts.load('17px "Departure Mono"'), new Promise(function (r) { setTimeout(r, 1200); })]).then(start, start); else start();
})();
