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
  const hideOnHome = page === "home" && distance > 48 &&
    homeFolders && homeFolders.getBoundingClientRect().bottom > navHeight + 2;
  const hideOnProject = page === "project" && distance > navHeight && scrollingDown;
  topNav.classList.toggle("fading", Boolean(hideOnHome || hideOnProject));
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
  showResume();
}

function setupScrollReveals() {
  if (reducedMotion.matches || !("IntersectionObserver" in window)) return;
  const blocks = document.querySelectorAll(
    ".folder-sheet > *, .about-inner > *, .case-intro, .case-story > *, .see-more, .contact-copy"
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
