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

// Declared up here because typing starts while the script is still loading.
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const SR_ONLY = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";

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

let lastScroll = Math.max(0, window.scrollY);
let scrollingDown = false;
const homeFolders = document.querySelector(".folders");

function updateNavigation() {
  const distance = Math.max(0, window.scrollY);
  if (Math.abs(distance - lastScroll) >= 6) {
    scrollingDown = distance > lastScroll;
    lastScroll = distance;
  }
  const navHeight = topNav.offsetHeight;
  const atContact = footerAnchor.getBoundingClientRect().top < window.innerHeight * .45;
  const atAbout = aboutSection && aboutSection.getBoundingClientRect().top < window.innerHeight * .55;
  const active = atContact ? "Contact" : atAbout ? "About" : currentPageName;
  const folders = homeFolders?.getBoundingClientRect();
  const inHomeFolders = page === "home" && folders &&
    folders.top < navHeight && folders.bottom > navHeight + 2;
  const hidden = distance > navHeight && (scrollingDown || inHomeFolders);
  topNav.classList.toggle("fading", Boolean(hidden));
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
  if (!contact.querySelector(".contact-note")) {
    const note = document.createElement("p");
    note.className = "contact-note";
    note.textContent = "Made it to the end, thank you. If anything here sparked questions or you’d like to talk about design, internships, or collaboration, I’d love to hear from you.";
    contact.querySelector("h2")?.after(note);
  }
  const resumePlaceholder = Array.from(contact.querySelectorAll(".contact-links span"))
    .find(span => span.textContent.trim().toLowerCase() === "resume");
  if (resumePlaceholder) {
    const resume = document.createElement("a");
    resume.href = resumeURL;
    resume.textContent = resumePlaceholder.textContent;
    if (page === "resume") resume.setAttribute("aria-current", "page");
    resumePlaceholder.replaceWith(resume);
  }
}

setupContactLinks();
let includesDone = Promise.resolve();
if (location.protocol !== "file:") {
  const includes = Array.from(document.querySelectorAll("[data-include]"), loadSection);
  includesDone = Promise.allSettled(includes).then(() => {
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

function cardCaption(text, number) {
  const caption = document.createElement("div");
  caption.className = "project-card-caption";
  const title = document.createElement("span");
  title.className = "project-card-title";
  title.textContent = text;
  caption.append(title);
  if (number != null) {
    const index = document.createElement("span");
    index.className = "project-card-index";
    index.setAttribute("aria-hidden", "true");
    index.textContent = String(number).padStart(2, "0");
    caption.append(index);
  }
  return caption;
}

function projectCard(link, number) {
  const card = document.createElement("a");
  card.className = "project-card";
  card.href = link.href;

  const frame = document.createElement("div");
  frame.className = "project-card-frame";
  const cover = document.createElement("img");
  cover.alt = "";
  cover.loading = "lazy";
  cover.decoding = "async";
  cover.className = "project-card-image";
  cover.addEventListener("load", () => { cover.classList.add("loaded"); }, { once: true });
  cover.src = link.dataset.cover
    ? new URL(link.dataset.cover, siteRoot).href
    : new URL("assets/covers/" + workSlug(link) + ".jpg", siteRoot).href;
  frame.append(cover);

  const title = (link.querySelector(".work-name") || link).textContent.trim();
  card.append(frame, cardCaption(title, number));
  return card;
}

function projectGrid(links, slots = 0) {
  const grid = document.createElement("ul");
  grid.className = "project-grid";
  for (const [index, link] of links.entries()) {
    const item = document.createElement("li");
    item.append(projectCard(link, slots ? index + 1 : null));
    grid.append(item);
  }
  for (let index = links.length; index < slots; index++) {
    const item = document.createElement("li");
    item.className = "coming-soon";
    const frame = document.createElement("div");
    frame.className = "project-card-frame";
    frame.setAttribute("aria-hidden", "true");
    item.append(frame, cardCaption("Coming soon", index + 1));
    grid.append(item);
  }
    if (slots > 0) {
    const coverSizes = new ResizeObserver(entries => {
      for (const { target: frame } of entries) {
        const caption = frame.nextElementSibling;
        caption.style.inlineSize = `${frame.getBoundingClientRect().width}px`;
      }
    });

    grid.querySelectorAll(".project-card-frame").forEach(frame => {
      coverSizes.observe(frame);
    });
  }
  return grid;
}

function labelLink(link, text, arrow, before = false) {
  const icon = document.createElement("span");
  icon.className = "link-arrow";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = arrow;
  link.replaceChildren(...(before ? [icon, text] : [text, icon]));
}

function updateFeaturedFolders() {
  const dates = { "convex": "2026", "moustachve-been-the-wind": "2025–2026", "specimen-tool": "2026" };
  for (const folder of document.querySelectorAll(".folders .folder")) {
    const link = folder.querySelector(".view-link");
    if (!link) continue;
    labelLink(link, "VIEW PROJECT", "→");
    const slug = workSlug(link);
    const group = workGroups.find(category => category.works.includes(slug));
    const meta = folder.querySelector(".folder-sheet header > div");
    const skills = meta?.querySelector("br")?.nextSibling?.textContent.trim();
    if (!meta || !group || !dates[slug] || !skills) continue;

    meta.classList.add("folder-meta");
    const year = document.createElement("span");
    year.textContent = dates[slug];
    const category = document.createElement("span");
    category.textContent = group.name;
    const skillsLabel = document.createElement("span");
    skillsLabel.className = "folder-skills";
    skillsLabel.textContent = skills;
    meta.replaceChildren(year, category, skillsLabel);
  }
}

function groupWorks() {
  const list = document.querySelector(".work-list");
  if (!list) return;
  const links = Array.from(list.querySelectorAll(".work-entry"));
  const bySlug = new Map(links.map(link => [workSlug(link), link]));
  const legacy = { "#p1": "convex", "#p2": "moustachve-been-the-wind", "#p3": "specimen-tool" };
  const oldLink = bySlug.get(legacy[location.hash]);
  if (oldLink) {
    location.replace(oldLink.href);
    return;
  }

  const tabs = document.createElement("nav");
  tabs.className = "tab-track gallery-tabs";
  tabs.setAttribute("aria-label", "Work categories");
  const gallery = document.createElement("div");
  gallery.className = "work-gallery";
  const panelStack = document.createElement("div");
  panelStack.className = "gallery-panels";
  gallery.append(tabs, panelStack);
  const panels = [];

  const assigned = new Set(workGroups.flatMap(group => group.works));
  const extras = links.map(workSlug).filter(slug => !assigned.has(slug));
  const groups = extras.length ? [...workGroups, { id: "other-work", name: "Other Work", works: extras }] : workGroups;
  const longestGroup = Math.max(...groups.map(group => group.works.filter(slug => bySlug.has(slug)).length));
  const slots = Math.max(6, Math.ceil(longestGroup / 3) * 3);
  for (const group of groups) {
    const members = group.works.map(slug => bySlug.get(slug)).filter(Boolean);
    if (!members.length) continue;

    const tab = document.createElement("a");
    tab.className = "file-tab";
    tab.href = "#" + group.id;
    const label = document.createElement("span");
    label.textContent = group.name;
    tab.append(label);
    tabs.append(tab);

    const panel = document.createElement("section");
    panel.className = "gallery-panel";
    panel.id = group.id;
    const heading = document.createElement("h2");
    heading.textContent = group.name;
    panel.append(heading, projectGrid(members, slots));
    panelStack.append(panel);
    panels.push({ group, tab, panel });
  }
  if (!panels.length) return;

  function selectCategory() {
    const selected = panels.find(({ group }) => "#" + group.id === location.hash) || panels[0];
    for (const entry of panels) {
      const inactive = entry !== selected;
      entry.panel.hidden = inactive;
      entry.panel.inert = inactive;
      if (entry === selected) entry.tab.setAttribute("aria-current", "location");
      else entry.tab.removeAttribute("aria-current");
    }
  }

  tabs.addEventListener("click", event => {
    const tab = event.target.closest(".file-tab");
    if (!tab || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (location.hash !== tab.hash) history.pushState(history.state, "", tab.hash);
    selectCategory();
  });
  tabs.style.setProperty("--tab-count", panels.length);
  list.closest(".works-index")?.classList.add("has-gallery");
  list.replaceWith(gallery);
  selectCategory();
  window.addEventListener("hashchange", selectCategory);
}

function showProjectRecommendations() {
  const track = document.querySelector(".tab-track");
  const tabs = Array.from(track?.querySelectorAll(".file-tab") || []);
  const current = tabs.find(tab => tab.getAttribute("aria-current") === "page");
  const slug = current ? workSlug(current) : location.pathname.split("/").pop().replace(/\.html$/, "");
  const group = workGroups.find(group => group.works.includes(slug));
  track?.closest(".tab-bar")?.remove();

  const back = document.querySelector(".back-link");
  if (back) {
    labelLink(back, "SEE ALL WORKS", "←", true);
    if (group) back.hash = group.id;
  }
  if (!group) return;

  const bySlug = new Map(tabs.map(tab => [workSlug(tab), tab]));
  const related = group.works.filter(member => member !== slug).map(member => bySlug.get(member)).filter(Boolean);
  if (!related.length) return;
  const section = document.createElement("section");
  section.className = "see-more";
  const heading = document.createElement("h2");
  heading.textContent = "SEE MORE";
  section.append(heading, projectGrid(related));
  document.querySelector(".project-main").append(section);
}

if (page === "home") updateFeaturedFolders();
if (page === "works") groupWorks();
if (page === "project") showProjectRecommendations();

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

if (page === "resume") {
  document.querySelector(".resume-tab")?.remove();
  const back = document.querySelector(".back-link");
  if (back) labelLink(back, "BACK", "←", true);
  showResume();
}

function setupScrollReveals() {
  if (!("IntersectionObserver" in window)) return;
  const blocks = document.querySelectorAll(
    ".folder-sheet > *, .about-inner > *, .case-intro, .case-story > *, .see-more, .contact-copy"
  );
  const seen = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      seen.unobserve(entry.target);
      entry.target.animate(
        [{ opacity: .3, transform: "translateY(30px)" }, { opacity: 1, transform: "none" }],
        { duration: 950, easing: "cubic-bezier(.18,.7,.24,1)" }
      );
    }
  });
  blocks.forEach(block => seen.observe(block));
}

function setupGentleWheel() {
  const precisePointer = matchMedia("(any-pointer: fine)");
  let frame = 0;
  let target = 0;
  let position = 0;
  let ease = .075;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function step() {
    position += (target - position) * ease;
    if (Math.abs(target - position) < 1) {
      position = target;
      frame = 0;
    } else {
      frame = requestAnimationFrame(step);
    }
    window.scrollTo({ top: position, behavior: "instant" });
  }

  window.addEventListener("wheel", event => {
    if (!precisePointer.matches || !event.cancelable ||
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
    // From the About section down to Contact the page scrolls more gently, so a quick flick
    // no longer outruns (and cancels) the typing there. The cap keeps even a hard flick slow.
    const slow = aboutSection && aboutSection.getBoundingClientRect().top < window.innerHeight * .9;
    ease = slow ? .055 : .075;
    target += event.deltaY * unit * (slow ? .35 : .5);
    if (slow) target = Math.max(position - 380, Math.min(position + 380, target));
    target = Math.max(0, Math.min(max, target));
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

// Typing plays once per visit. Moving between pages does not replay it; reloading the site does.
const navigationType = performance.getEntriesByType("navigation")[0]?.type;
let typingEnabled = true;
try {
  const store = window.sessionStorage;
  if (navigationType === "reload") {
    for (const key of Object.keys(store)) if (key.startsWith("typed:")) store.removeItem(key);
  }
  typingEnabled = !store.getItem("typed:" + page);
  store.setItem("typed:" + page, "1");
} catch { /* storage blocked: type every time */ }

// The welcome page offers an interactive version (type START) or a plain one with no typing effects.
let siteMode = null;
try { siteMode = window.sessionStorage.getItem("mode"); } catch { /* storage blocked */ }
// Touch-only devices (phones) always get the plain site: the typewriter needs a keyboard.
const isPhone = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
const plainMode = siteMode === "plain" || isPhone;
if (plainMode) typingEnabled = false;
const introActive = page === "home" && document.documentElement.classList.contains("intro-active");

// Sound can be switched off with the button; the choice is remembered between visits.
// The welcome page always starts with sound on.
let soundMuted = false;
let audioContext = null;
try { soundMuted = window.localStorage.getItem("sound") === "off"; } catch { /* storage blocked */ }
if (introActive) {
  soundMuted = false;
  try { window.localStorage.setItem("sound", "on"); } catch { /* storage blocked */ }
}

const usesSound = page === "home" || page === "works" || page === "project";
const sound = usesSound ? createTypewriterSounds() : () => {};
if (usesSound) setupSoundButton();
let heroTyping = false;
if (page === "home") {
  setupCat();
  setupCatFade();
  if (introActive) setupWelcome(hide => startInteractiveHome(hide));
  else if (typingEnabled) startInteractiveHome();
}
if (page === "works") setupWorksTyping();
if (page === "project") setupCardHoverTyping();

// Card titles stay on one line: a title that is too wide for its card is scaled down to fit.
function fitCardTitles() {
  for (const title of document.querySelectorAll(".project-card-title")) {
    title.style.fontSize = "";
    const base = parseFloat(getComputedStyle(title).fontSize);
    let size = base;
    while (title.scrollWidth > title.clientWidth + 1 && size > base * .7) {
      size -= .5;
      title.style.fontSize = size + "px";
    }
  }
}
if (page === "works" || page === "project") {
  fitCardTitles();
  document.fonts?.ready.then(fitCardTitles);
  window.addEventListener("load", fitCardTitles);
  window.addEventListener("resize", fitCardTitles);
}

function setupCat() {
  const clips = ["assets/meow-1.wav", "assets/meow-2.wav", "assets/meow-3.wav"];
  const player = new Audio();
  let previous;
  document.getElementById("cat").addEventListener("click", () => {
    if (soundMuted) return;
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
  audioContext = context;
  function resume() {
    if (context.state === "suspended") context.resume().catch(() => {});
  }
  resume();
  for (const type of ["pointerdown", "click", "touchend", "keydown", "focus", "pageshow"]) {
    window.addEventListener(type, resume, { passive: true });
  }
  document.addEventListener("visibilitychange", resume);
  const noise = context.createBuffer(1, context.sampleRate * .055, context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  let lastClick = -Infinity;
  function play(bell, force) {
    const now = context.currentTime;
    // Only some letters click, with a minimum gap, so fast typing sounds natural.
    if (!bell && !force && (now - lastClick < .09 || Math.random() < .35)) return;
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
    gain.gain.setValueAtTime(bell ? .025 : .045 + Math.random() * .03, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    gain.connect(context.destination);
    source.start(now);
    source.stop(now + duration);
  }
  // "force" is used for key presses on the welcome page: they are a user gesture, so audio that the
  // browser had suspended is started right then and the very first key already clicks.
  return function sound(bell, force) {
    if (soundMuted) return;
    if (context.state === "running") { play(bell, force); return; }
    if (force) context.resume().then(() => play(bell, force)).catch(() => {});
  };
}

// Browsers often block audio until the visitor interacts with the page. The typing never waits
// for audio: this button shows the state and lets the visitor turn sound on or off at any time.
function setupSoundButton() {
  if (!audioContext) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sound-toggle";
  function render() {
    button.textContent = soundMuted ? "Sound off" : "Sound on";
    button.setAttribute("aria-pressed", String(!soundMuted));
    button.setAttribute("aria-label", soundMuted ? "Sound is off. Turn sound on" : "Sound is on. Turn sound off");
  }
  button.addEventListener("click", () => {
    soundMuted = !soundMuted;
    try { window.localStorage.setItem("sound", soundMuted ? "off" : "on"); } catch { /* storage blocked */ }
    if (!soundMuted) audioContext.resume().catch(() => {});
    render();
  });
  window.addEventListener("soundchange", render);
  render();
  document.body.append(button);
}

// The cat's lower edge is a hard cut. Once the first folder pins and the cat scrolls away from
// it, that edge would show, so the bottom of the cat fades out as the two separate.
function setupCatFade() {
  const cat = document.getElementById("cat");
  const folder = document.querySelector(".folders .folder");
  if (!cat || !folder) return;
  let queued = false;
  function paint() {
    queued = false;
    const gap = folder.getBoundingClientRect().top - cat.getBoundingClientRect().bottom;
    const progress = Math.min(1, Math.max(0, gap / 40));
    cat.style.setProperty("--cat-fade", (progress * 32).toFixed(1) + "%");
  }
  function request() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(paint);
  }
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  paint();
}

/* ---------- Typewriter ---------- */

// An uneven, human rhythm: quick runs, small hesitations, pauses at word starts and punctuation.
function pace(base, character, previous) {
  let wait = base * (.55 + Math.random());
  if (Math.random() < .12) wait *= .5;
  if (Math.random() < .05) wait += base * (3 + Math.random() * 4);
  if (previous === " ") wait += base * Math.random() * 1.2;
  if (character === " ") wait += base * .5;
  if (",;:".includes(character)) wait += 90 + Math.random() * 90;
  if (".!?".includes(character)) wait += 170 + Math.random() * 140;
  return wait;
}


// The full text stays in the layout (hidden) while it types, so nothing around it moves.
function prepareText(element) {
  const text = (element.dataset.typedText ??= element.textContent.replace(/\s+/g, " ").trim());
  const full = document.createElement("span");
  const visible = document.createElement("span");
  const caret = document.createElement("span");
  const waiting = document.createElement("span");
  full.style.cssText = SR_ONLY;
  full.textContent = text;
  // An inline (not inline-block) caret adds no line-break opportunity, so typing never re-wraps the text.
  caret.style.cssText = "display:inline;padding-left:2px;margin-right:-2px;background:linear-gradient(currentColor,currentColor) left center/2px .82em no-repeat;visibility:hidden";
  const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
  if (lineHeight && element.getBoundingClientRect().height < lineHeight * 1.5) element.style.whiteSpace = "nowrap";
  waiting.textContent = text;
  waiting.style.visibility = "hidden";
  for (const part of [visible, caret, waiting]) part.setAttribute("aria-hidden", "true");
  element.replaceChildren(full, visible, caret, waiting);
  return { element, text, visible, caret, waiting };
}

function showFull(item) {
  item.visible.textContent = item.text;
  item.waiting.textContent = "";
  item.caret.style.visibility = "hidden";
}

async function typeItem(item, base, token) {
  const { text, visible, waiting, caret } = item;
  caret.style.visibility = "visible";
  for (let count = 1; count <= text.length; count++) {
    if (token.stop) { showFull(item); return false; }
    visible.textContent = text.slice(0, count);
    waiting.textContent = text.slice(count);
    if (text[count - 1] !== " ") sound(false);
    await delay(pace(base, text[count - 1], text[count - 2]));
  }
  showFull(item);
  return true;
}

async function runGroup(group, token) {
  for (const [index, item] of group.items.entries()) {
    if (token.stop) { showFull(item); continue; }
    if (await typeItem(item, group.speeds[index], token)) await delay(180);
  }
}

// Typing starts only when the visitor settles on a section. Scrolling quickly stops it and
// shows the full text, and anything scrolled past is shown in full.
function setupScrollTyping(groups) {
  if (!groups.length) return;
  let lastY = window.scrollY;
  let lastTime = performance.now();
  let lastFast = lastTime;
  let running = null;
  let token = null;

  const finishGroup = group => {
    group.state = "done";
    for (const item of group.items) showFull(item);
  };

  window.addEventListener("scroll", () => {
    const now = performance.now();
    const speed = Math.abs(window.scrollY - lastY) / Math.max(1, now - lastTime) * 1000;
    lastY = window.scrollY;
    lastTime = now;
    if (speed > 650) lastFast = now;
    if (speed > 1500 && token) token.stop = true;
  }, { passive: true });

  setInterval(() => {
    if (running) {
      if (!running.visible()) token.stop = true;
      return;
    }
    if (heroTyping || performance.now() - lastFast < 380) return;
    for (const group of groups) {
      if (group.state === "pending" && group.passed?.()) finishGroup(group);
    }
    const next = groups.find(group => group.state === "pending" && group.visible());
    if (!next) return;
    if (next.skipEarlier !== false) {
      for (const group of groups) {
        if (group === next) break;
        if (group.state === "pending") finishGroup(group);
      }
    }
    running = next;
    next.state = "running";
    token = { stop: false };
    runGroup(next, token).then(() => { next.state = "done"; next.onDone?.(); running = null; token = null; });
  }, 140);
}

const onScreen = element => {
  const box = element.getBoundingClientRect();
  return box.bottom > window.innerHeight * .12 && box.top < window.innerHeight * .8;
};

function textGroup(elements, headingSpeed = 46) {
  const items = elements.map(prepareText);
  const speeds = items.map(item => item.element.matches("h2") ? headingSpeed : item.text.length > 200 ? 11 : 18);
  return { items, speeds, state: "pending" };
}

function setupHomeTyping() {
  const groups = [];
  const folders = Array.from(document.querySelectorAll(".folders .folder"));
  for (const [index, folder] of folders.entries()) {
    const heading = folder.querySelector(".folder-sheet header h2");
    const description = folder.querySelector(".folder-body p");
    if (!heading || !description) continue;
    const group = textGroup([heading, description]);
    const next = folders[index + 1];
    group.visible = () => {
      const box = heading.getBoundingClientRect();
      return onScreen(heading) && box.top >= 0 && (!next || next.getBoundingClientRect().top > box.bottom);
    };
    groups.push(group);
  }

  const about = Array.from(document.querySelectorAll(".about-inner h2, .about-inner p"));
  if (about.length) {
    const group = textGroup(about);
    group.visible = () => group.items.some(item => onScreen(item.element));
    group.passed = () => group.items.every(item => item.element.getBoundingClientRect().bottom < 0);
    groups.push(group);
  }

  // The contact panel waits underneath the page and is revealed as the page scrolls away.
  const contactHeading = document.querySelector(".contact-copy h2");
  const contactNote = document.querySelector(".contact-copy .contact-note");
  if (contactHeading) {
    const group = textGroup(contactNote ? [contactHeading, contactNote] : [contactHeading]);
    group.visible = () => {
      const box = contactHeading.getBoundingClientRect();
      return footerAnchor.getBoundingClientRect().top <= box.top + box.height * .4 &&
        box.top < window.innerHeight * .85 && box.bottom > 0;
    };
    groups.push(group);
  }
  setupScrollTyping(groups);
}

// Short titles type more slowly and long titles faster, so every title takes a similar, readable time.
function hoverSpeed(length) {
  return Math.max(20, Math.min(85, 105 - length * 3));
}

function setupCardHoverTyping() {
  if (plainMode) return;
  // Typing starts only while the pointer is over the visible box or its title, and replays every time
  // the pointer enters a box (including after switching tabs). Leaving puts the normal title back.
  let current = null;
  let last = null;
  function stopHover() {
    if (!current) return;
    current.token.stop = true;
    current.title.textContent = current.title.dataset.typedText;
    current = null;
  }
  function update() {
    if (!last) return;
    const found = document.elementFromPoint(last.x, last.y)?.closest?.(".project-card");
    if (found === current?.card) return;
    stopHover();
    const title = found?.querySelector(".project-card-title");
    if (!title) return;
    const token = { stop: false };
    current = { card: found, title, token };
    const item = prepareText(title);
    typeItem(item, hoverSpeed(item.text.length), token);
  }
  document.addEventListener("pointermove", event => {
    if (event.pointerType === "touch") return;
    last = { x: event.clientX, y: event.clientY };
    update();
  }, { passive: true });
  // Cards moving under a still pointer (scrolling, switching tabs) are picked up too.
  window.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
  document.addEventListener("click", event => {
    if (event.target.closest?.(".file-tab")) { stopHover(); requestAnimationFrame(update); }
  });
  document.documentElement.addEventListener("pointerleave", () => { last = null; stopHover(); });
  window.addEventListener("hashchange", () => { stopHover(); requestAnimationFrame(update); });
}

function setupWorksTyping() {
  setupCardHoverTyping();

  if (plainMode) return;
  // Each category title is remembered once it has typed, so it never replays (until the site is reloaded).
  // This is tracked per title rather than per page, so tabs opened later still get their typing.
  const typedBefore = id => { try { return Boolean(window.sessionStorage.getItem("typed:works:" + id)); } catch { return false; } };
  const markTyped = id => { try { window.sessionStorage.setItem("typed:works:" + id, "1"); } catch { /* storage blocked */ } };
  const groups = Array.from(document.querySelectorAll(".gallery-panel"))
    .filter(panel => !typedBefore(panel.id))
    .map(panel => {
      const group = textGroup([panel.querySelector("h2")]);
      group.skipEarlier = false;
      group.visible = () => !panel.hidden && onScreen(group.items[0].element);
      group.onDone = () => markTyped(panel.id);
      return group;
    });
  setupScrollTyping(groups);
}

function prepareHero() {
  heroTyping = true;
  const sections = ["name", "bio"].map(id => {
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
  // A blinking caret waits at the start of the first line until the typing begins.
  const first = sections[0]?.[0];
  if (first) {
    first.line.classList.add("typing", "idle");
    first.line.style.setProperty("--caret-x", "0px");
  }
  return sections;
}

function startInteractiveHome(reveal) {
  const hero = prepareHero();
  includesDone.then(setupHomeTyping);
  if (reveal) reveal();
  runHeroTyping(hero);
}

async function runHeroTyping(sections) {
  // Typing never waits for the whole page (large images) or for audio, only briefly for the fonts,
  // and the finished text is always restored, so the hero content can never stay hidden.
  const finishAll = () => {
    for (const { line, text, visible, waiting } of sections.flat()) {
      line.classList.remove("typing", "idle");
      visible.textContent = text;
      waiting.textContent = "";
    }
    heroTyping = false;
  };
  try {
    await Promise.race([document.fonts?.ready, delay(600)]);
    await delay(450);
    await typeHero(sections);
  } catch { /* fall through and show the text */ }
  finishAll();
}

async function typeHero(sections) {
  let away = false;
  for (const [index, lines] of sections.entries()) {
    for (const { line, text, visible, waiting } of lines) {
      if (window.scrollY > window.innerHeight * .55) away = true;
      line.classList.remove("idle");
      line.classList.add("typing");
      for (let count = 1; count <= text.length && !away; count++) {
        if (window.scrollY > window.innerHeight * .55) { away = true; break; }
        visible.textContent = text.slice(0, count);
        waiting.textContent = text.slice(count);
        line.style.setProperty("--caret-x", visible.getBoundingClientRect().width + "px");
        if (text[count - 1] !== " ") sound(false);
        await delay(pace(index === 0 ? 62 : 24, text[count - 1], text[count - 2]));
      }
      visible.textContent = text;
      waiting.textContent = "";
      line.classList.remove("typing");
    }
    if (!away) await delay(220);
  }
}

// The welcome page: a working typewriter. Type START (capitals don't matter) for the interactive version,
// or skip to a plain site. Anything typed appears on the paper; the one bell rings when START is typed.
function setupWelcome(onStart) {
  const root = document.getElementById("welcome");
  if (!root) {
    document.documentElement.classList.remove("intro-active");
    onStart(() => {});
    return;
  }
  const WORD = "start";
  const MAX_SHOWN = 40; // older letters have slid out of view, so they are dropped
  const status = root.querySelector(".welcome-status");
  const text = root.querySelector(".tw-text");
  const bar = root.querySelector(".tw-bar");
  const soundButton = root.querySelector(".welcome-sound");
  const skipButton = root.querySelector(".welcome-skip");
  let typed = "";
  let finished = false;

  const setMode = mode => { try { window.sessionStorage.setItem("mode", mode); } catch { /* storage blocked */ } };
  function hide() {
    root.classList.add("leaving");
    setTimeout(() => {
      root.hidden = true;
      document.documentElement.classList.remove("intro-active");
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 520);
  }

  // The typebar swings up to the ribbon and back; the letter lands as it strikes.
  function swingBar() {
    if (reducedMotion.matches) return;
    bar.getAnimations().forEach(animation => animation.cancel());
    bar.animate([
      { transform: "translateY(240px)" },
      { transform: "translateY(58px)", offset: .4, easing: "ease-in" },
      { transform: "translateY(58px)", offset: .55 },
      { transform: "translateY(240px)" }
    ], { duration: 170, easing: "ease-out" });
  }

  // The paper moves left by one letter after each strike: new text is drawn at the strike point first.
  function print(direction) {
    const before = text.offsetWidth;
    text.textContent = typed.slice(-MAX_SHOWN);
    const moved = text.offsetWidth - before;
    text.getAnimations().forEach(animation => animation.cancel());
    if (!reducedMotion.matches && moved) {
      text.animate([{ transform: `translateX(${moved}px)` }, { transform: "none" }], { duration: 90, easing: "ease-out" });
    }
    if (direction > 0 && !finished && typed.toLowerCase().endsWith(WORD)) {
      finished = true;
      status.textContent = "Starting\u2026";
      setTimeout(() => sound(true, true), 120); // the only bell on the site
      setTimeout(() => { setMode("interactive"); onStart(hide); }, 700);
    }
  }

  function press(character) {
    if (finished) return;
    typed += character;
    sound(false, true);
    if (character !== " ") swingBar();
    setTimeout(() => print(1), character === " " ? 0 : 55);
  }

  window.addEventListener("keydown", event => {
    if (finished || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Backspace") {
      if (typed) { typed = typed.slice(0, -1); sound(false, true); print(-1); }
      return;
    }
    if (event.key.length !== 1) return;
    if (event.target.closest?.("button") && event.key === " ") return; // Space still presses a focused button
    event.preventDefault();
    press(event.key);
  });

  function showSound() {
    soundButton.textContent = soundMuted ? "Sound off" : "Sound on";
    soundButton.setAttribute("aria-pressed", String(!soundMuted));
  }
  soundButton.addEventListener("click", () => {
    soundMuted = !soundMuted;
    try { window.localStorage.setItem("sound", soundMuted ? "off" : "on"); } catch { /* storage blocked */ }
    if (!soundMuted) { audioContext?.resume().catch(() => {}); sound(false, true); }
    showSound();
    window.dispatchEvent(new Event("soundchange"));
  });
  skipButton.addEventListener("click", () => {
    if (finished) return;
    finished = true;
    setMode("plain");
    hide();
  });
  showSound();
}
