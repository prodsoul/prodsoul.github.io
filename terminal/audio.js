/* Synthesised terminal sounds (WebAudio). Browsers keep audio locked until the first tap or key press,
   so the engine unlocks on the first gesture and every sound is a no-op until then. */
(function () {
  var A = (window.JBAudio = {});
  var ctx = null, master = null, noiseBuf = null, humNodes = null, on = true, root = "";
  try { on = localStorage.getItem("jb-sound") !== "off"; } catch (e) {}
  var listeners = [];

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      var n = ctx.sampleRate * 1;
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function ready() { return !!(on && ctx && ctx.state === "running"); }
  function emit() { listeners.forEach(function (f) { try { f(ready()); } catch (e) {} }); }

  A.setRoot = function (r) { root = r || ""; };
  A.onChange = function (f) { listeners.push(f); };
  A.isOn = function () { return on; };
  A.ready = ready;
  A.unlock = function () {
    var c = ensure(); if (!c) return false;
    if (c.state === "running") { startHum(); emit(); return true; }
    c.resume && c.resume().then(function () { startHum(); emit(); }, function () {});
    return false;
  };
  A.setOn = function (v) {
    on = !!v; try { localStorage.setItem("jb-sound", on ? "on" : "off"); } catch (e) {}
    if (on) { ensure(); startHum(); } else stopHum();
    emit();
  };

  function env(g, t, a, peak, d) {
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function noise(t, dur, type, freq, q, peak) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    var g = ctx.createGain(); env(g, t, 0.002, peak, dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5, dur + 0.05);
  }
  function tone(f0, dur, type, peak, f1, when) {
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(); o.type = type || "square"; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ctx.createGain(); env(g, t, 0.004, peak || 0.04, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  /* keyboard click: sharp noise tick plus a soft low knock */
  A.key = function () {
    if (!ready()) return; var t = ctx.currentTime;
    noise(t, 0.035, "bandpass", 2200 + Math.random() * 1800, 0.9, 0.16);
    tone(110 + Math.random() * 30, 0.05, "sine", 0.09, 60);
  };
  /* output tick: quieter, like a teletype hammer */
  A.tick = function () {
    if (!ready()) return; var t = ctx.currentTime;
    noise(t, 0.02, "bandpass", 3000 + Math.random() * 1500, 1.2, 0.05);
  };
  A.enter = function () {
    if (!ready()) return; var t = ctx.currentTime;
    noise(t, 0.06, "bandpass", 1400, 0.8, 0.2); tone(80, 0.09, "sine", 0.12, 45);
  };
  A.beep = function (f, d, v) { if (ready()) tone(f || 880, d || 0.1, "square", v || 0.035); };
  A.ok = function () { if (!ready()) return; tone(660, 0.07, "square", 0.03); tone(990, 0.09, "square", 0.03, 0, 0.07); };
  A.error = function () { if (ready()) tone(150, 0.22, "sawtooth", 0.05, 100); };
  A.ding = function () { A.sample("assets/audio/ding.wav", 0.5); };
  A.meow = function () { A.sample("assets/audio/meow/meow-" + (1 + Math.floor(Math.random() * 3)) + ".wav", 0.7); };
  A.sample = function (path, vol) {
    if (!ready()) return;
    try { var a = new Audio(root + path); a.volume = vol || 0.6; a.play().catch(function () {}); } catch (e) {}
  };
  /* BIOS beep */
  A.post = function () { A.beep(1000, 0.16, 0.05); };
  /* CRT power on: thump, degauss buzz, then high whine fading */
  A.powerOn = function () {
    if (!ready()) return; var t = ctx.currentTime;
    tone(55, 0.5, "sine", 0.35, 28);
    noise(t, 0.7, "lowpass", 900, 0.7, 0.18);
    tone(120, 0.6, "sawtooth", 0.03, 60);
    tone(15700, 1.2, "sine", 0.008);
  };
  A.powerOff = function () {
    if (!ready()) return; tone(900, 0.28, "sine", 0.08, 40); noise(ctx.currentTime, 0.25, "lowpass", 2000, 0.5, 0.08);
  };
  /* disk seek: a few quick grinding ticks */
  A.seek = function (n) {
    if (!ready()) return; n = n || 6;
    for (var i = 0; i < n; i++) (function (k) {
      var t = ctx.currentTime + k * (0.035 + Math.random() * 0.05);
      noise(t, 0.03, "bandpass", 500 + Math.random() * 500, 3, 0.12);
    })(i);
  };
  A.whoosh = function () { if (ready()) noise(ctx.currentTime, 0.35, "bandpass", 1200, 0.6, 0.1); };
  /* quiet mains hum plus faint hiss: only wanted during power-on and boot */
  var wantHum = false;
  function startHum() {
    if (!wantHum || humNodes || !ready()) return;
    var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 50;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 180;
    var g = ctx.createGain(); g.gain.value = 0.006;
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 5000;
    var g2 = ctx.createGain(); g2.gain.value = 0.004;
    o.connect(lp); lp.connect(g); g.connect(master); s.connect(hp); hp.connect(g2); g2.connect(master);
    o.start(); s.start(); humNodes = [o, s];
  }
  function stopHum() { if (humNodes) { humNodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); humNodes = null; } }
  A.hum = function (v) { wantHum = !!v; if (v) startHum(); else stopHum(); };

  /* Tetris effects */
  A.t = {
    move: function () { if (ready()) tone(300, 0.03, "square", 0.02); },
    rot: function () { if (ready()) tone(520, 0.05, "square", 0.025, 700); },
    lock: function () { if (ready()) { tone(140, 0.07, "square", 0.04, 90); } },
    drop: function () { if (ready()) { tone(220, 0.1, "sawtooth", 0.05, 60); noise(ctx.currentTime, 0.08, "lowpass", 600, 1, 0.12); } },
    clear: function (n) {
      if (!ready()) return; var base = [523, 659, 784, 1047, 1319];
      for (var i = 0; i < Math.min(n + 2, 5); i++) tone(base[i], 0.09, "square", 0.04, 0, i * 0.07);
    },
    level: function () { if (ready()) [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.1, "square", 0.04, 0, i * 0.08); }); },
    over: function () { if (ready()) [440, 392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.22, "square", 0.045, f * 0.97, i * 0.2); }); }
  };

  /* try an immediate unlock (works when the browser already trusts this site) */
  ensure();
})();
