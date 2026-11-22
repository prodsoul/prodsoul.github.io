"use strict";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const page = document.body.dataset.page;
const topNav = document.querySelector(".top-nav");
const footerAnchor = document.getElementById("contact");
const aboutSection = document.getElementById("about");
const currentPageName = page === "home" ? "Home" : "Works";

function updateNavigation() {
  const distance = window.scrollY;
  const atContact = footerAnchor.getBoundingClientRect().top < window.innerHeight * .45;
  const atAbout = aboutSection && aboutSection.getBoundingClientRect().top < window.innerHeight * .55;
  const active = atContact ? "Contact" : atAbout ? "About" : currentPageName;
  topNav.classList.toggle("fading", distance > 48);
  for (const link of topNav.querySelectorAll("a")) {
    if (link.textContent === active) {
      link.setAttribute("aria-current", atContact || atAbout ? "location" : "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}
window.addEventListener("scroll", updateNavigation, { passive: true });
window.addEventListener("resize", updateNavigation);
updateNavigation();

// The HTML already contains readable content for offline and script-free viewing.
// On the hosted site, these small editable fragments supply the shared content.
async function loadSection(container) {
  const response = await fetch(container.dataset.include);
  if (!response.ok) return;
  container.innerHTML = await response.text();
}
if (location.protocol !== "file:") {
  const includes = Array.from(document.querySelectorAll("[data-include]"), loadSection);
  Promise.allSettled(includes).then(() => {
    if (["#about", "#contact"].includes(location.hash)) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "instant" });
    }
    updateNavigation();
  });
}

document.querySelector(".contact-panel").addEventListener("focusin", event => {
  if (!event.target.matches(":focus-visible")) return;
  const box = event.target.getBoundingClientRect();
  const front = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (!event.currentTarget.contains(front)) footerAnchor.scrollIntoView({ behavior: "instant" });
});

function setupTabBar(bar) {
  const track = bar.querySelector(".tab-track");
  const [previous, next] = bar.querySelectorAll("button");
  function setButtons() {
    const overflow = track.scrollWidth > bar.clientWidth + 2;
    previous.hidden = next.hidden = !overflow;
    previous.disabled = track.scrollLeft < 2;
    next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
  }
  function revealCurrent() {
    setButtons();
    const active = track.querySelector('[aria-current="page"]');
    if (!active) return;
    const box = active.getBoundingClientRect();
    const viewport = track.getBoundingClientRect();
    if (box.right > viewport.right || box.left < viewport.left) {
      track.scrollLeft += box.left - viewport.left - (track.clientWidth - box.width) / 2;
    }
    setButtons();
  }
  bar.addEventListener("click", event => {
    const button = event.target.closest("button[data-pan]");
    if (button) track.scrollBy({
      left: Number(button.dataset.pan) * track.clientWidth * .8,
      behavior: reducedMotion.matches ? "instant" : "smooth"
    });
  });
  track.addEventListener("scroll", setButtons, { passive: true });
  window.addEventListener("resize", revealCurrent);
  revealCurrent();
  document.fonts.ready.then(revealCurrent);
}
document.querySelectorAll(".tab-bar").forEach(setupTabBar);

function videoId(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let id;
  if (host === "youtu.be") id = parts[0];
  if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
    id = ["embed", "shorts", "live"].includes(parts[0]) ? parts[1] : url.searchParams.get("v");
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : null;
}
for (const box of document.querySelectorAll("[data-youtube]")) {
  const id = videoId(box.dataset.youtube);
  if (!id) continue;
  const frame = document.createElement("iframe");
  frame.title = box.dataset.videoTitle || "Project walkthrough";
  frame.loading = "lazy";
  frame.allowFullscreen = true;
  frame.allow = "encrypted-media; picture-in-picture; fullscreen";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.src = "https://www.youtube-nocookie.com/embed/" + id;
  box.replaceChildren(frame);
}

// Old featured-project bookmarks continue to open their corresponding case study.
if (page === "works" && /^#p[1-3]$/.test(location.hash)) {
  const index = Number(location.hash.slice(2)) - 1;
  location.replace(document.querySelectorAll(".work-entry")[index].href);
}

if (page === "home") {
  setupCat();
  if (!reducedMotion.matches) runTypewriter();
}

function setupCat() {
  const clips = ["assets/meow-1.wav", "assets/meow-2.wav", "assets/meow-3.wav"];
  const player = new Audio();
  let previous;
  document.getElementById("cat").addEventListener("click", () => {
    const pool = clips.filter(clip => clip !== previous);
    previous = pool[Math.floor(Math.random() * pool.length)];
    player.pause();
    player.src = previous;
    player.play().catch(() => {});
  });
}

function createTypewriterSounds() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return () => {};
  let context;
  try { context = new Context(); } catch { return () => {}; }
  function resume() {
    if (context.state === "suspended") context.resume().catch(() => {});
  }
  resume();
  window.addEventListener("pointerdown", resume, { passive: true });
  window.addEventListener("keydown", resume);
  const noise = context.createBuffer(1, context.sampleRate * .055, context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  let lastClick = -Infinity;
  return function sound(bell) {
    if (context.state !== "running") return;
    const now = context.currentTime;
    if (!bell && now - lastClick < .065) return;
    if (!bell) lastClick = now;
    const gain = context.createGain();
    const duration = bell ? .46 : .032;
    const source = bell ? context.createOscillator() : context.createBufferSource();
    if (bell) {
      source.frequency.value = 1568;
      source.connect(gain);
    } else {
      source.buffer = noise;
      const filter = context.createBiquadFilter();
      filter.frequency.value = 1150;
      source.connect(filter);
      filter.connect(gain);
    }
    gain.gain.setValueAtTime(bell ? .025 : .065, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    gain.connect(context.destination);
    source.start(now);
    source.stop(now + duration);
  };
}

async function runTypewriter() {
  const sound = createTypewriterSounds();
  const sections = ["name","bio"].map(id => {
    const container = document.getElementById(id);
    const lines = Array.from(container.querySelectorAll(".typed-line"));
    container.setAttribute("aria-label", lines.map(line => line.textContent).join(" "));
    return lines.map(line => {
      const text = line.textContent;
      const visible = document.createElement("span");
      const waiting = document.createElement("span");
      waiting.className = "untyped";
      waiting.textContent = text;
      line.setAttribute("aria-hidden", "true");
      line.replaceChildren(visible, waiting);
      return { line, text, visible, waiting };
    });
  });
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  await Promise.race([document.fonts.ready, delay(600)]);
  for (const [index, lines] of sections.entries()) {
    for (const { line, text, visible, waiting } of lines) {
      line.classList.add("typing");
      for (let count = 1; count <= text.length; count++) {
        if (reducedMotion.matches) {
          count = text.length;
        }
        visible.textContent = text.slice(0, count);
        waiting.textContent = text.slice(count);
        line.style.setProperty("--caret-x", visible.getBoundingClientRect().width + "px");
        if (!reducedMotion.matches) {
          if (text[count - 1] !== " ") sound(false);
          await delay((index === 0 ? 67 : 17) + Math.random() * 24);
        }
      }
      line.classList.remove("typing");
    }
    if (!reducedMotion.matches) {
      sound(true);
      await delay(220);
    }
  }
}
