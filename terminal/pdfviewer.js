/* Page-by-page PDF viewer (pdf.js, self-hosted in terminal/pdf/). Each page is scaled to fit the box, so nobody scrolls. */
(function () {
  var base = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/pdfviewer\.js.*$/, "") : "terminal/";
  var libPromise = null;
  function lib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!libPromise) libPromise = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = base + "pdf/pdf.min.js";
      s.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + "pdf/pdf.worker.min.js"; res(window.pdfjsLib); };
      s.onerror = function () { rej(new Error("pdf.js failed to load")); }; document.head.appendChild(s);
    });
    return libPromise;
  }
  var css = document.createElement("style");
  css.textContent =
    ".pdfv{outline:none}.pdfv-stage{position:relative;display:grid;place-items:center;min-height:120px;background:rgba(0,0,0,.25)}" +
    ".pdfv canvas{display:block;max-width:100%}.pdfv-load{position:absolute;inset:0;display:grid;place-items:center;opacity:.7;pointer-events:none}" +
    ".pdfv-bar{display:flex;flex-wrap:wrap;align-items:center;gap:.5em 1em;margin-top:.8em;font-size:.9em}" +
    ".pdfv-bar button{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;padding:.15em .8em;cursor:pointer;opacity:.9}" +
    ".pdfv-bar button:disabled{opacity:.3;cursor:default}.pdfv-bar button:hover:not(:disabled){background:currentColor}.pdfv-bar button:hover:not(:disabled) span{color:var(--bg,#000)}" +
    ".pdfv-bar .sp{flex:1}.pdfv-hint{margin-top:.5em;opacity:.6;font-size:.82em}";
  document.head.appendChild(css);

  function mount(host, o) {
    var fitH = o.fitH || 480, cur = 1, total = 0, pdf = null, task = null, gen = 0;
    var root = document.createElement("div"); root.className = "pdfv"; root.tabIndex = 0;
    root.innerHTML = '<div class="pdfv-stage"><canvas></canvas><div class="pdfv-load">loading report ...</div></div>' +
      '<div class="pdfv-bar"><button type="button" data-d="-1" disabled><span>&lt; prev</span></button><span class="pdfv-n">- / -</span>' +
      '<button type="button" data-d="1" disabled><span>next &gt;</span></button><span class="sp"></span>' +
      '<a target="_blank" rel="noopener">open</a><a download>download</a></div>' +
      '<div class="pdfv-hint">click the page, then use the left and right arrow keys (or swipe)</div>';
    host.appendChild(root);
    var stage = root.querySelector(".pdfv-stage"), cv = root.querySelector("canvas"), nEl = root.querySelector(".pdfv-n"), loadEl = root.querySelector(".pdfv-load");
    var btns = root.querySelectorAll("button"), links = root.querySelectorAll("a");
    links[0].href = o.src; links[1].href = o.src; if (o.name) links[1].setAttribute("download", o.name);
    function maxW() { return Math.max(160, (host.clientWidth || 600) - 4); }
    function render(n) {
      if (!pdf) return; var my = ++gen;
      pdf.getPage(n).then(function (page) {
        var v1 = page.getViewport({ scale: 1 }), sc = Math.min(maxW() / v1.width, fitH / v1.height), dpr = Math.min(2, window.devicePixelRatio || 1);
        var v = page.getViewport({ scale: sc * dpr });
        if (task) { try { task.cancel(); } catch (e) {} }
        var c = document.createElement("canvas"); c.width = Math.floor(v.width); c.height = Math.floor(v.height);
        c.style.width = Math.floor(v.width / dpr) + "px"; c.style.height = Math.floor(v.height / dpr) + "px";
        task = page.render({ canvasContext: c.getContext("2d"), viewport: v });
        task.promise.then(function () { if (my !== gen) return; cv.replaceWith(c); cv = c; loadEl.style.display = "none"; stage.style.minHeight = c.style.height; }, function () {});
      });
      nEl.textContent = n + " / " + total; btns[0].disabled = n <= 1; btns[1].disabled = n >= total;
    }
    function go(d, user) {
      var n = Math.min(total, Math.max(1, cur + d)); if (n === cur) return; cur = n; render(cur); if (user && o.onNav) o.onNav();
    }
    btns[0].addEventListener("click", function () { go(-1, true); root.focus(); });
    btns[1].addEventListener("click", function () { go(1, true); root.focus(); });
    root.addEventListener("keydown", function (e) {
      var k = e.key, d = (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown") ? 1 : (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") ? -1 : 0;
      if (k === "Home") { e.preventDefault(); e.stopPropagation(); go(1 - cur, true); return; }
      if (k === "End") { e.preventDefault(); e.stopPropagation(); go(total - cur, true); return; }
      if (d) { e.preventDefault(); e.stopPropagation(); go(d, true); }
    });
    var sx = null;
    stage.addEventListener("pointerdown", function (e) { sx = e.clientX; root.focus({ preventScroll: true }); });
    stage.addEventListener("pointerup", function (e) { if (sx != null && Math.abs(e.clientX - sx) > 40) go(e.clientX < sx ? 1 : -1, true); sx = null; });
    var rt; addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { render(cur); }, 200); });
    lib().then(function (L) {
      return L.getDocument({ url: o.src }).promise;
    }).then(function (p) { pdf = p; total = p.numPages; render(1); }).catch(function () {
      root.innerHTML = '<iframe title="report" src="' + o.src + '#view=Fit" style="width:100%;height:' + fitH + 'px;border:0;background:#fff"></iframe>';
    });
    return { root: root };
  }
  window.JBPdf = { mount: mount };
})();
