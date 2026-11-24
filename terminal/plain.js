/* Plain version of the portfolio: same content as the terminal, shown as a normal page. Hash routes: #/ #/works #/about #/contact #/resume #/work/<slug> */
(function () {
  "use strict";
  var JB = window.JB, W = JB.works, main = document.getElementById("main"), top = document.getElementById("top"), prog = document.getElementById("prog");
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { e.target.classList.toggle("in", e.isIntersecting); });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }) : null;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function rv(node, i) { node.classList.add("rv"); if (i) node.style.setProperty("--d", (Math.min(i, 8) * 0.07) + "s"); return node; }
  function link(text, href, cls, ext) { var a = el("a", cls, text); a.href = href; if (ext) { a.target = "_blank"; a.rel = "noopener noreferrer"; } return a; }
  function findWork(slug) { return W.filter(function (w) { return w.slug === slug; })[0]; }

  function card(w, i) {
    var a = el("a", "card"); a.href = "#/work/" + w.slug;
    var th = el("div", "th");
    if (w.thumb) { var im = new Image(); im.src = "assets/thumbnails/" + w.thumb + ".webp"; im.alt = ""; im.loading = "lazy"; th.append(im); } else th.textContent = "no preview";
    var tx = el("div", "tx"); tx.append(el("div", "no", String(W.indexOf(w) + 1).padStart(2, "0")), el("div", "nm", w.title), el("div", "tp", w.type));
    a.append(th, tx); return rv(a, i);
  }

  function aboutSection() {
    var sec = el("section", "home-sec"); sec.id = "about";
    sec.append(rv(el("div", "prompt", "guest@joann:~$ about")), rv(el("h2", "", "About me"), 1));
    JB.about.forEach(function (t, i) { sec.append(rv(el("p", i ? "" : "lede", t), 2 + i)); });
    sec.append(rv(el("h3", "jhead", "My journey"), 3));
    var jl = el("div", "journey"); JB.journey.forEach(function (j, i) {
      var it = el("div", "jitem"); it.append(el("b", "", j.school), el("span", "", j.what), el("em", "", j.when));
      j.notes.forEach(function (n) { it.append(el("small", "", n)); }); jl.append(rv(it, 4 + i));
    }); sec.append(jl);
    return sec;
  }
  function contactSection() {
    var sec = el("section", "home-sec"); sec.id = "contact";
    sec.append(rv(el("div", "prompt", "guest@joann:~$ contact")), rv(el("h2", "", "Contact me"), 1));
    sec.append(rv(el("p", "lede dim", "Open to conversations about design, internships and collaboration."), 2));
    var b = el("div", "big-links");
    [["Email", JB.email, JB.links.email, 0], ["LinkedIn", "linkedin.com/in/joannbisseling", JB.links.linkedin, 1, "joannbisseling"], ["Resume", "view the PDF", "#/resume", 0]].forEach(function (r, i) {
      var a = link("", r[2], "", r[3]); var sp = el("span", "", ""); if (r[4]) { sp.append(el("i", "full", r[1]), el("i", "short", r[4])); } else sp.textContent = r[1];
      a.append(el("b", "", r[0]), sp); a.firstChild.style.fontWeight = "normal"; b.append(rv(a, 3 + i));
    }); sec.append(b); return sec;
  }
  var views = {
    home: function () {
      var f = document.createDocumentFragment(), hero = el("section", "hero"); hero.id = "top-sec";
      hero.append(rv(el("div", "prompt", "guest@joann:~$ whoami")), rv(el("h1", "", "Joann Bisseling"), 1));
      hero.append(rv(el("p", "lede dim", "UX & Game Design student · Singapore · open to internships"), 2));
      f.append(hero);
      var sh = el("div", "sec-head"); sh.append(el("h2", "", "Featured projects"), link("All works →", "#/works")); f.append(rv(sh));
      var g = el("div", "grid"); W.filter(function (w) { return w.featured; }).forEach(function (w, i) { g.append(card(w, i)); }); f.append(g);
      f.append(aboutSection(), contactSection());
      return f;
    },
    works: function () {
      var f = document.createDocumentFragment(); f.append(rv(el("div", "prompt", "guest@joann:~/works$ ls")), rv(el("h1", "", "All works"), 1));
      f.append(rv(el("p", "lede dim", W.length + " projects across UX and game design."), 2));
      var g = el("div", "grid"); W.forEach(function (w, i) { g.append(card(w, i % 3)); }); f.append(g); return f;
    },
    resume: function () {
      var f = document.createDocumentFragment(); f.append(rv(el("div", "prompt", "guest@joann:~$ resume")), rv(el("h1", "", "Resume"), 1));
      var host = el("div", "pdfwrap"); f.append(rv(host, 2));
      setTimeout(function () { window.JBPdf.mount(host, { src: JB.links.resumePdf, fitH: Math.max(380, Math.min(720, innerHeight - 220)), name: "JoannBisseling_Resume.pdf" }); }, 0); return f;
    }
  };

  function lightbox(src, alt) {
    var lb = el("div", "lb"), im = new Image(); im.src = src; im.alt = alt || ""; lb.append(im);
    function close() { lb.remove(); document.removeEventListener("keydown", key); }
    function key(e) { if (e.key === "Escape") close(); }
    lb.addEventListener("click", close); document.addEventListener("keydown", key); document.body.append(lb);
  }
  function video(id, title) {
    var f = document.createDocumentFragment(), v = el("div", "vid"); v.style.backgroundImage = "url(https://i.ytimg.com/vi/" + id + "/hqdefault.jpg)";
    var pb = el("button", "play", "▶ Play video"); pb.type = "button"; v.append(pb);
    v.addEventListener("click", function () {
      var i = document.createElement("iframe"); i.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1"; i.title = title;
      i.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; i.allowFullscreen = true; v.classList.add("playing"); v.style.backgroundImage = "none"; v.append(i);
    });
    f.append(rv(v), rv(el("div", "vcap", title))); return f;
  }

  async function project(slug) {
    var w = findWork(slug), f = document.createDocumentFragment();
    if (!w) { f.append(el("h1", "", "Not found"), link("Back to works", "#/works")); return f; }
    var res; try { res = await fetch("projects/" + slug + ".html"); if (!res.ok) throw 0; } catch (e) { f.append(el("p", "loading", "Could not load this project. Open the site through its web address (not as a local file).")); return f; }
    var doc = new DOMParser().parseFromString(await res.text(), "text/html").getElementById("doc");
    f.append(rv(link("← All works", "#/works", "back")), rv(el("h1", "", doc.querySelector("h1").textContent), 1));
    var dl = el("dl", "meta"); [].slice.call(doc.querySelectorAll(".meta li")).forEach(function (li) { dl.append(el("dt", "", li.dataset.k), el("dd", "", li.textContent)); }); f.append(rv(dl, 2));
    var intro = doc.querySelector(".intro"); if (intro) f.append(rv(el("p", "lede", intro.textContent), 3));
    var act = doc.querySelector(".actions");
    if (act) { var bt = el("div", "btns"); [].slice.call(act.children).forEach(function (a) {
      if (a.tagName === "A") { var h = a.getAttribute("href"), ext = /^https?:/.test(h); bt.append(link(a.textContent, h, "btn", ext)); } else bt.append(el("span", "btn off", a.textContent));
    }); f.append(rv(bt, 4)); }
    [].slice.call(doc.children).forEach(function (n) {
      var tag = n.tagName.toLowerCase(), cls = n.className;
      if (["h1", "ul"].indexOf(tag) > -1 || cls === "intro" || cls === "actions") return;
      if (tag === "h2") f.append(rv(el("h2", "", n.textContent)));
      else if (tag === "p") f.append(rv(el("p", "", n.textContent)));
      else if (cls.indexOf("gallery") === 0) {
        var g = el("div", cls); [].slice.call(n.querySelectorAll("figure")).forEach(function (fg, i) {
          var im0 = fg.querySelector("img"), src = im0.getAttribute("src").replace(/^\.\.\//, ""), fig = el("figure"), im = new Image();
          im.src = src; im.alt = im0.getAttribute("alt") || ""; im.loading = "lazy"; im.addEventListener("click", function () { lightbox(src, im.alt); });
          fig.append(im); var c = fg.querySelector("figcaption"); if (c) fig.append(el("figcaption", "", c.textContent)); g.append(rv(fig, i));
        }); f.append(g);
      }
      else if (cls === "video") f.append(video(n.dataset.yt, n.dataset.title));
      else if (cls === "pdf") {
        f.append(rv(el("h2", "", "Report")));
        var host = el("div", "pdfwrap"); f.append(rv(host));
        setTimeout(function () { window.JBPdf.mount(host, { src: n.dataset.src, fitH: Math.max(380, Math.min(720, innerHeight - 220)), name: n.dataset.name }); }, 0);
      }
    });
    var i = W.indexOf(w), np = el("div", "nextprev");
    function npl(w, prev) { var a = link("", "#/work/" + w.slug, "np"); a.append.apply(a, prev ? [el("i", "", "←"), el("span", "t", w.title)] : [el("span", "t", w.title), el("i", "", "→")]); return a; }
    np.append(i > 0 ? npl(W[i - 1], true) : el("span"), i < W.length - 1 ? npl(W[i + 1], false) : el("span")); f.append(rv(np));
    return f;
  }

  var token = 0, current = null;
  /* slow, eased scrolling so content is easier to follow */
  var tgt = null, raf = 0, slow = !matchMedia("(prefers-reduced-motion: reduce)").matches && !matchMedia("(pointer: coarse)").matches;
  function maxY() { return document.documentElement.scrollHeight - innerHeight; }
  function glide() {
    var y = scrollY, d = tgt - y;
    if (Math.abs(d) < 0.6) { window.scrollTo(0, tgt); tgt = null; raf = 0; return; }
    window.scrollTo(0, y + d * 0.07); raf = requestAnimationFrame(glide);
  }
  function glideTo(y) { tgt = Math.max(0, Math.min(maxY(), y)); if (!raf) raf = requestAnimationFrame(glide); }
  if (slow) addEventListener("wheel", function (e) {
    if (e.ctrlKey || e.defaultPrevented || document.querySelector(".lb")) return;
    e.preventDefault();
    var dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    glideTo((tgt == null ? scrollY : tgt) + dy * 0.55);
  }, { passive: false });
  addEventListener("keydown", function (e) { if (tgt != null && /^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(e.key)) { tgt = null; } });
  function scrollToSection(sec) {
    var t = sec ? document.getElementById(sec) : null, y = t ? t.getBoundingClientRect().top + scrollY - 78 : 0;
    if (slow) glideTo(y); else window.scrollTo({ top: y, behavior: "smooth" });
  }
  function setNav(name) { [].slice.call(document.querySelectorAll("#nav a")).forEach(function (a) { a.classList.toggle("on", a.dataset.r === name); }); }
  async function route() {
    var h = location.hash.replace(/^#\/?/, ""), parts = h.split("/"), name = parts[0] || "home", my = ++token, section = null;
    if (name === "about" || name === "contact") { section = name; name = "home"; }
    if (name === "home" && current === "home") { scrollToSection(section); setNav(section || "home"); return; }
    main.replaceChildren(el("p", "loading", "loading ...")); tgt = null; window.scrollTo({ top: 0, behavior: "auto" });
    var content = name === "work" ? await project(parts[1]) : (views[name] || views.home)();
    if (my !== token) return;
    current = name === "work" || views[name] ? name : "home";
    main.replaceChildren(content); main.classList.remove("swap"); void main.offsetWidth; main.classList.add("swap");
    document.title = (name === "work" ? ((findWork(parts[1]) || {}).title || "Project") : name === "home" ? "Joann Bisseling" : name.charAt(0).toUpperCase() + name.slice(1)) + " | Joann Bisseling";
    setNav(section || (name === "work" ? "works" : name));
    [].slice.call(main.querySelectorAll(".rv")).forEach(function (n) { if (io) io.observe(n); else n.classList.add("in"); });
    if (section) setTimeout(function () { scrollToSection(section); }, 350);
  }
  addEventListener("hashchange", route); route();

  function onScroll() {
    var h = document.documentElement; top.classList.toggle("stuck", scrollY > 8);
    prog.style.width = (h.scrollHeight - innerHeight > 0 ? (scrollY / (h.scrollHeight - innerHeight)) * 100 : 0) + "%";
  }
  function spy() {
    if (current !== "home") return; var line = innerHeight * 0.4, name = "home";
    ["about", "contact"].forEach(function (id) { var t = document.getElementById(id); if (t && t.getBoundingClientRect().top <= line) name = id; });
    setNav(name);
  }
  addEventListener("scroll", function () { onScroll(); spy(); }, { passive: true }); onScroll();
})();
