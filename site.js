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
// Typing waits while this time is in the future: the paper-flip sound plays in full before a title starts typing.
let typingHoldUntil = 0;
// Works page: true while the paper-flip sound or a category title's typing is still going.
let worksSettling = () => false;
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

// These filenames are shared by the All Works gallery and project recommendations.
const projectCovers = {
  convex: "convex.webp",
  "moustachve-been-the-wind": "moustachvebeenthewind.webp",
  "specimen-tool": "3dadaptationtool.webp",
  eduvision: "eduvision.webp",
  "order-kopi-lah": "orderkopilah.webp",
  netflix: "netflix.webp",
  amazon: "amazon.webp",
  gio: "gio.webp",
  "key-to-purrdom": "keytopurrdom.webp",
  "order-up": "orderup.webp",
  stray: "stray.webp",
  "game-feel": "gamefeel.webp",
  "molten-motion": "moltenmotion.webp",
};

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
  const filename = projectCovers[workSlug(link)];
  const coverPath = link.dataset.cover || (filename && `assets/thumbnails/${filename}`);
  if (coverPath) {
    cover.src = new URL(coverPath, siteRoot).href;
    frame.append(cover);
  }

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

  if (slots) {
    const coverSizes = new ResizeObserver(entries => {
      for (const { target: frame } of entries) {
        frame.nextElementSibling.style.inlineSize = `${frame.getBoundingClientRect().width}px`;
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
  const label = document.createElement("span");
  label.className = "link-label";
  label.dataset.label = text;
  const visibleLabel = document.createElement("span");
  visibleLabel.textContent = text;
  label.append(visibleLabel);
  link.replaceChildren(...(before ? [icon, label] : [label, icon]));
}

function updateFeaturedFolders() {
  // Phones show one wide project tab plus "See all works" on every folder, so each folder carries its own copy.
  const allTab = document.querySelector(".folders .all-tab");
  if (allTab) {
    for (const folder of document.querySelectorAll(".folders .folder")) {
      if (folder.querySelector(".all-tab")) continue;
      const copy = allTab.cloneNode(true);
      copy.classList.add("all-tab-extra");
      copy.setAttribute("aria-hidden", "true");
      copy.tabIndex = -1;
      folder.querySelector(".folder-tab")?.after(copy);
    }
  }
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

// Must match the phone breakpoint in style.css.
const phoneView = window.matchMedia("(max-width: 640px) and (orientation: portrait)");

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
  const back = document.createElement("a");
  back.className = "back-link gallery-back";
  back.href = location.pathname;
  labelLink(back, "ALL CATEGORIES", "←", true);
  gallery.append(back, tabs, panelStack);
  const panels = [];

  const assigned = new Set(workGroups.flatMap(group => group.works));
  const extras = links.map(workSlug).filter(slug => !assigned.has(slug));
  const groups = extras.length ? [...workGroups, { id: "other-work", name: "Other Work", works: extras }] : workGroups;
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
    panel.append(heading, projectGrid(members, 6));
    panelStack.append(panel);
    panels.push({ group, tab, panel });
  }
  if (!panels.length) return;

  function selectCategory() {
    // On phones nothing is open until a category tab is tapped; on larger screens the first one is.
    const selected = panels.find(({ group }) => "#" + group.id === location.hash) || (phoneView.matches ? null : panels[0]);
    gallery.dataset.view = selected ? "category" : "index";
    if (selected) gallery.dataset.tone = String(panels.findIndex(entry => entry === selected) + 1);
    else delete gallery.dataset.tone;
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
    if (location.hash !== tab.hash) {
      history.pushState(history.state, "", tab.hash);
      sound("paper", true);
    }
    selectCategory();
    if (phoneView.matches) window.scrollTo({ top: 0, behavior: "instant" });
  });
  back.addEventListener("click", event => {
    event.preventDefault();
    if (location.hash) history.pushState(history.state, "", location.pathname + location.search);
    selectCategory();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  phoneView.addEventListener("change", selectCategory);
  tabs.style.setProperty("--tab-count", panels.length);
  list.closest(".works-index")?.classList.add("has-gallery");
  list.replaceWith(gallery);
  selectCategory();
  // Arriving at (or going back to) a category must not jump down to its anchor: always start at the top.
  const toTop = () => window.scrollTo({ top: 0, behavior: "instant" });
  if (panels.some(({ group }) => "#" + group.id === location.hash)) {
    toTop();
    window.addEventListener("load", () => { toTop(); requestAnimationFrame(toTop); }, { once: true });
  }
  window.addEventListener("hashchange", () => { selectCategory(); requestAnimationFrame(toTop); });
}

// Phones show a compact details block (date, category, methods) instead of the Date / Role / Methods list.
// It is built from the list that is already on the page, which stays in place for larger screens.
function setupCaseMeta() {
  const list = document.querySelector(".case-intro dl");
  const heading = document.querySelector(".case-intro h1");
  if (!list || !heading) return;
  const facts = {};
  for (const row of list.children) {
    const key = row.querySelector("dt")?.textContent.trim().toLowerCase();
    if (key) facts[key] = row.querySelector("dd")?.textContent.trim() || "";
  }
  const slug = location.pathname.split("/").pop().replace(/\.html$/, "");
  const group = workGroups.find(entry => entry.works.includes(slug));
  const meta = document.createElement("div");
  meta.className = "case-meta";
  const line = (className, text) => {
    if (!text) return;
    const item = document.createElement("span");
    item.className = className;
    item.textContent = text;
    meta.append(item);
  };
  line("case-date", facts["date"]);
  line("case-category", group?.name);
  line("case-skills", facts["methods used"]);
  line("case-extra", [facts["project type"], facts["my role"], facts["organisation"]].filter(Boolean).join(" · "));
  heading.after(meta);
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
if (page === "project") { setupCaseMeta(); showProjectRecommendations(); }

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
  // Side thumbnails off and the page fitted to the box's width, so the whole page is visible without scrolling.
  pdf.src = link.href + "#navpanes=0&view=FitH";
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
  if (!("IntersectionObserver" in window) || reducedMotion.matches) return;
  const blocks = document.querySelectorAll(
    ".folder-sheet > *, .about-inner > *, .case-intro, .case-story > *, .see-more, .contact-copy, " +
    ".works-index h1, .gallery-panel .project-grid li, .see-more .project-grid li"
  );
  const seen = new IntersectionObserver(entries => {
    // Items that arrive together (a row of cards) rise one after another.
    let order = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      seen.unobserve(entry.target);
      // Landing folders in the interactive version reveal in step with their typing instead (setupFolderReveal).
      if (document.documentElement.classList.contains("folder-reveals") && entry.target.closest(".folders .folder-sheet")) continue;
      entry.target.animate(
        [{ opacity: 0, transform: "translateY(36px)" }, { opacity: 1, transform: "none" }],
        { duration: 1100, delay: Math.min(order++, 5) * 90, easing: "cubic-bezier(.18,.7,.24,1)", fill: "backwards" }
      );
    }
  }, { threshold: .08 });
  blocks.forEach(block => seen.observe(block));
}

// Project and works pages ease in instead of appearing all at once.
if ((page === "works" || page === "project") && !reducedMotion.matches) {
  document.querySelector("main")?.animate(
    [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
    { duration: 700, easing: "cubic-bezier(.18,.7,.24,1)" }
  );
}

function setupGentleWheel() {
  const precisePointer = matchMedia("(any-pointer: fine)");
  let frame = 0;
  let target = 0;
  let position = 0;
  let ease = .075;
  // Going back up through the landing-page folders covers the same ground with a little less wheel travel.
  // 1 = same as going down; 1.35 = about a quarter less scrolling. Raise or lower to taste.
  const FOLDERS_UP_BOOST = 1.35;
  // Going through the landing-page folders (either way) is a little quicker than everywhere else.
  const FOLDERS_SPEED = 1.3;
  function inLandingFolders() {
    if (page !== "home" || !homeFolders) return false;
    const box = homeFolders.getBoundingClientRect();
    return box.top < window.innerHeight && box.bottom > window.innerHeight * .25;
  }

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
    // Every page scrolls gently and glides to a stop. The cap keeps even a hard flick slow, so a quick
    // scroll no longer outruns (and cancels) the typing.
    const inFolders = inLandingFolders();
    ease = inFolders ? .07 : .055;
    const boost = (event.deltaY < 0 && inFolders ? FOLDERS_UP_BOOST : 1) * (inFolders ? FOLDERS_SPEED : 1);
    target += event.deltaY * unit * .35 * boost;
    target = Math.max(position - 380 * boost, Math.min(position + 380 * boost, target));
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

// Phones skip typing and paper-flip audio. The cats can meow in response to an explicit tap.
const usesSound = !isPhone && (page === "home" || page === "works" || page === "project" || page === "resume");
const sound = usesSound ? createTypewriterSounds() : () => {};
let heroTyping = false;
let heroSkip = false;
setupCat();
if (page === "home") {
  setupCatFade();
  if (introActive) setupWelcome(hide => startInteractiveHome(hide));
  else if (typingEnabled) startInteractiveHome();
}
if (page === "works") setupWorksTyping();
if (page === "resume" && typingEnabled) setupResumeTyping();

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
  const cats = document.querySelectorAll("#cat, .contact-panel img.footer-cat");
  if (!cats.length) return;

  const clips = [1, 2, 3].map(number =>
    new URL(`assets/audio/meow/meow-${number}.wav`, siteRoot).href
  );
  const player = new Audio();
  let previous;

  function meow() {
    if (soundMuted) return;
    const pool = clips.filter(clip => clip !== previous);
    previous = pool[Math.floor(Math.random() * pool.length)];
    player.pause();
    player.src = previous;
    player.play().catch(() => {});
  }

  for (const cat of cats) {
    cat.addEventListener("click", meow);
    if (cat.matches("img.footer-cat")) {
      cat.setAttribute("role", "button");
      cat.setAttribute("aria-label", "Make the cat meow");
      cat.tabIndex = 0;
      cat.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (!event.repeat) meow();
      });
    }
  }
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
  // Your own recordings live in the assets folder:
  //   assets/audio/paper-flip.wav   - flipping between folder tabs on the works page
  //   assets/audio/ding.wav        - the bell on the welcome page
  //   assets/audio/type/type-1.wav ... type-19.wav - typing
  // Typing works like footsteps in a game: every key press picks one of the clips at random
  // (never the same clip twice in a row). Volumes are 0 to 1; change them here if a clip is too loud or quiet.
  const TYPE_CLIP_COUNT = 19;
  const TYPE_VOLUME = .6;
  const PAPER_VOLUME = .8;
  const DING_VOLUME = .8;
  const clipURL = name => new URL("assets/audio/" + name, siteRoot).href;
  const clips = {};
  function loadClip(name) {
    if (clips[name]) return;
    const clip = clips[name] = { buffer: null, failed: false };
    fetch(clipURL(name))
      .then(response => { if (!response.ok) throw new Error(response.status); return response.arrayBuffer(); })
      .then(data => context.decodeAudioData(data))
      .then(buffer => { clip.buffer = buffer; })
      .catch(() => { clip.failed = true; });
  }
  const buffer_duration = clip => clip.buffer.duration * 1000;
  function playClip(name, volume) {
    const clip = clips[name];
    if (!clip) { loadClip(name); return; }
    if (clip.buffer) {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = clip.buffer;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(context.destination);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
      if (name === "paper-flip.wav") typingHoldUntil = Math.max(typingHoldUntil, performance.now() + buffer_duration(clip));
    } else if (clip.failed) {
      // Fallback (for example when the page is opened straight from a folder): play the file normally.
      const audio = new Audio(clipURL(name));
      audio.volume = Math.min(1, volume);
      const paper = name === "paper-flip.wav";
      if (paper) {
        typingHoldUntil = Infinity;
        audio.addEventListener("ended", () => { typingHoldUntil = 0; });
      }
      audio.play().catch(() => { if (paper) typingHoldUntil = 0; });
    }
  }
  // Load the clips a page needs up front so the first key press already has its sound.
  // Project pages have no typing sounds, so they load nothing.
  if (page !== "project") {
    for (let n = 1; n <= TYPE_CLIP_COUNT; n++) loadClip("type/type-" + n + ".wav");
    if (page === "home") loadClip("ding.wav");
    if (page === "works") loadClip("paper-flip.wav");
  }
  let lastClick = -Infinity;
  let lastType = 0;
  function typeKey() {
    let pick;
    do { pick = 1 + Math.floor(Math.random() * TYPE_CLIP_COUNT); } while (pick === lastType);
    lastType = pick;
    playClip("type/type-" + pick + ".wav", TYPE_VOLUME);
  }
  function play(bell, force) {
    if (bell === "paper") { playClip("paper-flip.wav", PAPER_VOLUME); return; }
    if (bell) { playClip("ding.wav", DING_VOLUME); return; }
    const now = context.currentTime;
    // A minimum gap between clicks keeps very fast typing from turning into a buzz.
    if (!force && now - lastClick < .09) return;
    lastClick = now;
    typeKey();
  }
  // "force" is used for key presses on the welcome page: they are a user gesture, so audio that the
  // browser had suspended is started right then and the very first key already clicks.
  return function sound(bell, force) {
    if (soundMuted) return;
    if (context.state === "running") { play(bell, force); return; }
    if (force) context.resume().then(() => play(bell, force)).catch(() => {});
  };
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
  // The caret has no width of its own (its bar is positioned absolutely), so a word sitting right at the end of
  // a line can never be pushed down to the next line while the caret is inside it.
  caret.style.cssText = "display:inline;position:relative;visibility:hidden";
  const bar = document.createElement("span");
  bar.style.cssText = "position:absolute;left:0;top:50%;width:2px;height:.82em;transform:translateY(-50%);background:currentColor";
  caret.append(bar);
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

// With "total" (hover titles) the whole title takes about that long, however long or short it is.
async function typeItem(item, base, token, total) {
  const { text, visible, waiting, caret, element } = item;
  caret.style.visibility = "visible";
  item.typing = true;
  if (item.skippable) element.style.cursor = "pointer";
  let finished = true;
  for (let count = 1; count <= text.length; count++) {
    if (token.stop) { finished = false; break; }
    if (item.skip) break; // clicked: finish the paragraph straight away
    visible.textContent = text.slice(0, count);
    waiting.textContent = text.slice(count);
    if (text[count - 1] !== " ") sound(false);
    await delay(total ? total / text.length * (.85 + Math.random() * .3) : pace(base, text[count - 1], text[count - 2]));
  }
  item.typing = false;
  item.skip = false;
  element.style.cursor = "";
  showFull(item);
  return finished;
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
    group.onFinish?.();
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
    if (heroTyping || performance.now() - lastFast < 380 || performance.now() < typingHoldUntil) return;
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
    next.onStart?.();
    runGroup(next, token).then(() => { next.state = "done"; next.onDone?.(); running = null; token = null; });
  }, 140);
}

const onScreen = element => {
  const box = element.getBoundingClientRect();
  return box.bottom > window.innerHeight * .12 && box.top < window.innerHeight * .8;
};

function textGroup(elements, headingSpeed = 46) {
  const items = elements.map(prepareText);
  // Clicking a paragraph while it is typing completes it. Headings are not skippable.
  for (const item of items) {
    if (item.element.matches("h2") || item.element.dataset.skipReady) continue;
    item.element.dataset.skipReady = "1";
    item.skippable = true;
    item.element.addEventListener("click", () => { if (item.typing) item.skip = true; });
  }
  const speeds = items.map(item => item.element.matches("h2") ? headingSpeed : item.text.length > 200 ? 11 : 18);
  return { items, speeds, state: "pending" };
}

// Landing folders (interactive version only): the top-right details, the media and the "View project" link stay
// hidden until the folder's title starts typing, then ease in one after another. The link waits for the paragraph.
// Anything skipped (scrolling fast, scrolling past) is simply shown, so nothing can stay hidden.
// With "reduce motion" on (the typing still plays), they fade in without moving.
function setupFolderReveal(folder, group) {
  const sheet = folder.querySelector(".folder-sheet");
  if (!sheet) return;
  const metaBox = sheet.querySelector("header > div");
  const meta = !metaBox ? [] : metaBox.classList.contains("folder-meta") ? [...metaBox.children] : [metaBox];
  const screens = [...sheet.querySelectorAll(".convex-showcase-screens > img")];
  const video = sheet.querySelector(".folder-video");
  const media = screens.length ? screens : video ? [video] : [];
  const link = sheet.querySelector(".view-link");

  const waiting = new Set([...meta, ...media, ...(link ? [link] : [])]);
  for (const el of waiting) {
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
  }
  if (link) link.style.visibility = "hidden";

  function reveal(els, { delay = 0, stagger = 0, duration = 700, rise = 12, instant = false } = {}) {
    els.forEach((el, index) => {
      if (!waiting.delete(el)) return;
      el.style.opacity = el.style.pointerEvents = el.style.visibility = "";
      if (instant) return;
      el.animate(
        [{ opacity: 0, transform: `translateY(${reducedMotion.matches ? 0 : rise}px)` }, { opacity: 1, transform: "none" }],
        { duration, delay: delay + index * stagger, easing: "cubic-bezier(.18,.7,.24,1)", fill: "backwards" }
      );
    });
  }
  const all = [...meta, ...media, ...(link ? [link] : [])];

  group.onStart = () => {
    reveal(meta, { delay: 350, stagger: 90, duration: 800 });
    reveal(media, { delay: 700, stagger: 110, duration: 1000, rise: 28 });
  };
  group.onDone = () => {
    reveal([...meta, ...media], { duration: 500 });
    if (link) reveal([link], { delay: 150, duration: 800, rise: 10 });
  };
  group.onFinish = () => reveal(all, { instant: true });
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
    setupFolderReveal(folder, group);
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

// Every hover title takes about as long as "Netflix Mobile Discovery" did: short titles type slower, long ones faster.
const HOVER_TOTAL = 1050;
// The pointer has to rest on a box this long before its title starts typing, so just passing over is calm.
const HOVER_DELAY = 280;

function setupCardHoverTyping() {
  if (plainMode) return () => {};
  // Typing starts only while the pointer is over the visible box or its title, and replays every time
  // the pointer enters a box (including after switching tabs). Leaving puts the normal title back.
  let current = null;
  let last = null;
  let timer = 0;
  function stopHover() {
    clearTimeout(timer);
    if (!current) return;
    current.token.stop = true;
    if (current.started) current.title.textContent = current.title.dataset.typedText;
    current = null;
  }
  function update() {
    if (!last) return;
    if (worksSettling()) { stopHover(); return; }
    const found = document.elementFromPoint(last.x, last.y)?.closest?.(".project-card");
    if (found === current?.card) return;
    stopHover();
    const title = found?.querySelector(".project-card-title");
    if (!title) return;
    const token = { stop: false };
    const entry = current = { card: found, title, token, started: false };
    timer = setTimeout(() => {
      if (current !== entry || worksSettling()) return;
      entry.started = true;
      typeItem(prepareText(title), 0, token, HOVER_TOTAL);
    }, HOVER_DELAY);
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
  return update;
}

function setupWorksTyping() {
  const refreshHover = setupCardHoverTyping();
  let titleGroups = [];
  let syncNow = () => {};
  worksSettling = () => performance.now() < typingHoldUntil ||
    titleGroups.some(group => group.state === "running" || (group.state === "pending" && group.visible()));
  const gallery = document.querySelector(".work-gallery");
  if (gallery) {
    let was = false;
    const sync = () => {
      const now = worksSettling();
      if (now === was) return;
      was = now;
      gallery.classList.toggle("settling", now);
      if (!now) refreshHover();
    };
    // Checked right away when a tab is chosen (so nothing can slip through before the next check) and often after.
    document.addEventListener("click", event => { if (event.target.closest?.(".file-tab")) sync(); });
    window.addEventListener("hashchange", () => requestAnimationFrame(sync));
    setInterval(sync, 40);
    syncNow = sync;
  }

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
  titleGroups = groups;
  setTimeout(() => syncNow(), 0); // after the whole script has run (it uses helpers declared further down)
  setupScrollTyping(groups);
}

function setupResumeTyping() {
  const title = document.querySelector(".case-intro h1");
  if (!title) return;
  const group = textGroup([title]);
  group.speeds[0] = 46; // the same pace as the other page headings
  group.visible = () => onScreen(title);
  setupScrollTyping([group]);
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
  // Clicking the bio while it is typing finishes it (the name is not skippable).
  const bioBox = document.getElementById("bio");
  bioBox.style.cursor = "pointer";
  bioBox.addEventListener("click", () => { if (heroTyping) heroSkip = true; });
  // A blinking caret waits at the start of the first line until the typing begins.
  const first = sections[0]?.[0];
  if (first) {
    first.line.classList.add("typing", "idle");
    first.line.style.setProperty("--caret-x", "0px");
  }
  return sections;
}

function startInteractiveHome(reveal) {
  document.documentElement.classList.add("folder-reveals");
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
    const bioBox = document.getElementById("bio");
    if (bioBox) bioBox.style.cursor = "";
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
      for (let count = 1; count <= text.length && !away && !(index === 1 && heroSkip); count++) {
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

// The welcome page: type START (capitals don't matter) for the interactive version, or skip to a plain site.
// The word is shown faintly; each correct letter turns solid, a wrong one turns red, and a caret leads the way.
function setupWelcome(onStart) {
  const root = document.getElementById("welcome");
  if (!root) {
    document.documentElement.classList.remove("intro-active");
    onStart(() => {});
    return;
  }
  const WORD = "start";
  const status = root.querySelector(".welcome-status");
  const box = root.querySelector(".welcome-type");
  const caret = root.querySelector(".wt-caret");
  const letters = Array.from(root.querySelectorAll(".wt-letter"));
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
  function render() {
    letters.forEach((letter, i) => {
      letter.classList.toggle("typed", i < typed.length && typed[i] === WORD[i]);
      letter.classList.toggle("wrong", i < typed.length && typed[i] !== WORD[i]);
    });
    box.insertBefore(caret, letters[typed.length] || null);
  }

  window.addEventListener("keydown", event => {
    if (finished || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Backspace") {
      if (typed) { typed = typed.slice(0, -1); render(); }
      return;
    }
    if (!/^[a-zA-Z]$/.test(event.key) || typed.length >= WORD.length) return;
    typed += event.key.toLowerCase();
    sound(false, true);
    render();
    if (typed === WORD) {
      finished = true;
      status.textContent = "Starting\u2026";
      setTimeout(() => sound(true, true), 120); // the only bell on the site
      setTimeout(() => { setMode("interactive"); onStart(hide); }, 600);
    }
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
  render();
}
