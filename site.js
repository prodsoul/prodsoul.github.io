"use strict";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const page = document.body.dataset.page;
const topNav = document.querySelector(".top-nav");
const footerAnchor = document.getElementById("contact");
const aboutSection = document.getElementById("about");
const currentPageName = page === "home" ? "Home" : page === "resume" ? "" : "Works";
const siteRoot = new URL(".", document.currentScript.src);
const resumeURL = new URL("resume.html", siteRoot).href;
const isReload = performance.getEntriesByType("navigation")[0]?.type === "reload";

function clearPageHash() {
  if (location.hash) history.replaceState(history.state, "", location.pathname + location.search);
}

if (isReload) {
  // Clear anchor jumps and override native scroll restoration for an explicit reload.
  history.scrollRestoration = "manual";
  clearPageHash();
  window.scrollTo({ top: 0, behavior: "instant" });
  window.addEventListener("pageshow", () => {
    window.scrollTo({ top: 0, behavior: "instant" });
    // Finish after the browser's load-time anchor and focus adjustments.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
      history.scrollRestoration = "auto";
    }));
  }, { once: true });
}

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
  if (!container.contains(document.activeElement)) container.innerHTML = await response.text();
}
function setupContactLinks() {
  const contact = document.querySelector(".contact-copy");
  if (!contact) return;
  const resumePlaceholder = Array.from(contact.querySelectorAll(".contact-links span"))
    .find(span => span.textContent.trim().toLowerCase() === "resume");
  if (resumePlaceholder) {
    const resume = document.createElement("a");
    resume.href = resumeURL;
    resume.textContent = resumePlaceholder.textContent;
    if (page === "resume") resume.setAttribute("aria-current", "page");
    resumePlaceholder.replaceWith(resume);
  }

  if (contact.querySelector(".to-top")) return;
  const toTop = document.createElement("a");
  toTop.className = "to-top";
  toTop.href = "#top";
  topNav.id ||= "top";
  toTop.textContent = "Back to top";
  toTop.addEventListener("click", event => {
    event.preventDefault();
    clearPageHash();
    topNav.querySelector("a")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "instant" : "smooth" });
  });
  contact.append(toTop);
}

setupContactLinks();
if (location.protocol !== "file:") {
  const includes = Array.from(document.querySelectorAll("[data-include]"), loadSection);
  Promise.allSettled(includes).then(() => {
    setupContactLinks();
    setupScrollReveals();
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

// Keep the categories here so existing project HTML, media and case-study links can stay in place.
const workGroups = [
  { id: "product-ux", name: "Digital Product UX", works: ["convex", "netflix", "amazon", "gio"] },
  { id: "learning-tools", name: "Learning & Design Tools", works: ["eduvision", "specimen-tool"] },
  { id: "playtesting-analysis", name: "Playtesting & Analysis", works: ["order-kopi-lah", "stray", "order-up"] },
  { id: "game-level-design", name: "Game & Level Design", works: ["moustachve-been-the-wind", "key-to-purrdom", "game-feel", "molten-motion"] }
];

function workSlug(link) {
  return new URL(link.href).pathname.split("/").pop().replace(/\.html$/, "");
}

function groupWorks() {
  const list = document.querySelector(".work-list");
  const links = Array.from(list.querySelectorAll(".work-entry"));
  // Preserve the original three featured URLs used by older bookmarks.
  const legacy = { "#p1": "convex", "#p2": "moustachve-been-the-wind", "#p3": "specimen-tool" };
  const bySlug = new Map(links.map(link => [workSlug(link), link]));
  const oldLink = bySlug.get(legacy[location.hash]);
  if (oldLink) {
    location.replace(oldLink.href);
    return;
  }

  for (const group of workGroups) {
    const members = group.works.map(slug => bySlug.get(slug)).filter(Boolean);
    if (!members.length) continue;
    const section = document.createElement("section");
    section.className = "works-group";
    section.id = group.id;

    const heading = document.createElement("h2");
    const openGroup = document.createElement("a");
    openGroup.href = members[0].href;
    openGroup.textContent = group.name;
    heading.append(openGroup);

    const groupedList = document.createElement("ul");
    groupedList.className = "work-list";
    groupedList.setAttribute("aria-label", group.name);
    groupedList.append(...members.map(link => link.closest("li")));
    section.append(heading, groupedList);
    list.before(section);
  }
  if (!list.children.length) list.remove();
  // A direct link back to a category should land there after sections are built.
  const category = workGroups.find(group => location.hash === "#" + group.id);
  if (category) document.getElementById(category.id)?.scrollIntoView({ behavior: "instant" });
}

function showProjectGroup() {
  const track = document.querySelector(".tab-track");
  const tabs = Array.from(track.querySelectorAll(".file-tab"));
  const active = tabs.find(tab => tab.getAttribute("aria-current") === "page");
  const group = active && workGroups.find(group => group.works.includes(workSlug(active)));
  if (group) {
    const available = new Map(tabs.map(tab => [workSlug(tab), tab]));
    const visible = group.works.map(slug => available.get(slug)).filter(Boolean);
    track.replaceChildren(...visible);
    track.style.setProperty("--tab-count", visible.length);
    track.setAttribute("aria-label", group.name + " projects");
  }
  const back = document.querySelector(".back-link");
  if (back) {
    back.textContent = "BACK";
    if (group) back.hash = group.id;
  }
}

if (page === "works") groupWorks();
if (page === "project") showProjectGroup();

async function showResume() {
  const pdf = document.querySelector(".resume-pdf");
  const pending = document.querySelector(".resume-pending");
  const link = document.querySelector(".open-pdf");
  if (location.protocol !== "file:") {
    try {
      const response = await fetch(link.href, { method: "HEAD" });
      if (!response.ok) return;
    } catch {
      return;
    }
  }
  pdf.src = link.href;
  pdf.hidden = link.hidden = false;
  pending.hidden = true;
}

if (page === "resume") showResume();

function setupScrollReveals() {
  if (reducedMotion.matches || !("IntersectionObserver" in window)) return;
  const blocks = document.querySelectorAll(
    ".folder-sheet > *, .about-inner > *, .work-list > li, .case-intro, .case-story > *, .contact-copy"
  );
  const seen = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      seen.unobserve(entry.target);
      if (!reducedMotion.matches) {
        entry.target.animate(
          [{ opacity: .58, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
          { duration: 590, easing: "cubic-bezier(.18,.7,.24,1)" }
        );
      }
    }
  });
  blocks.forEach(block => seen.observe(block));
}

function setupGentleWheel() {
  const precisePointer = matchMedia("(any-pointer: fine)");
  let frame = 0;
  let target = 0;
  let position = 0;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function step() {
    position += (target - position) * .22;
    if (Math.abs(target - position) < 1) {
      position = target;
      frame = 0;
    } else {
      frame = requestAnimationFrame(step);
    }
    window.scrollTo({ top: position, behavior: "instant" });
  }

  window.addEventListener("wheel", event => {
    if (reducedMotion.matches || !precisePointer.matches || !event.cancelable ||
        event.ctrlKey || event.metaKey || event.shiftKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const element = event.target instanceof Element ? event.target : event.target.parentElement;
    if (element?.closest(".tab-track, [contenteditable], input, textarea, select")) return;
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight && /^(auto|scroll)$/.test(getComputedStyle(node).overflowY)) return;
    }

    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    if (!frame) position = target = window.scrollY;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    target = Math.max(0, Math.min(max, target + event.deltaY * unit * .74));
    event.preventDefault();
    if (!frame) frame = requestAnimationFrame(step);
  }, { passive: false });

  // Direct navigation, keyboard scrolling and dragging the scrollbar take priority.
  window.addEventListener("pointerdown", stop);
  window.addEventListener("keydown", stop);
  window.addEventListener("hashchange", stop);
  window.addEventListener("resize", stop);
  reducedMotion.addEventListener("change", stop);
}

setupGentleWheel();
if (location.protocol === "file:") setupScrollReveals();

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
