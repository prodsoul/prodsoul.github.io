(() => {
  "use strict";

  function start() {
    const nav = document.querySelector("#nav");
    const files = document.querySelector(".files");
    const name = document.querySelector("#name");
    const bio = document.querySelector("#bio");
    const cat = document.querySelector("#cat");

    installStyles();
    setupNavigation(nav);
    setupFolders(files);
    setupFooter();

    if (cat) setupMeows(cat);

    if (name && bio) {
      const sounds = createTypewriterSounds();
      playIntro(name, bio, sounds);
    }
  }

  function installStyles() {
    const styles = document.createElement("style");

    styles.textContent = `
      /* Scroll the homepage navigation away with the page. */
      body .nav {
        position: absolute;
        inset: 0 0 auto;
        background: transparent;
        border: 0;
        transition: none;
      }

      /* Show a little of the first folder cover below its tab. */
      body .hero {
        min-height: max(536px, calc(var(--vh) - var(--tab) - 24px));
      }

      /* Preserve the line break before, during and after typing. */
      #name {
        white-space: pre-line;
        text-transform: uppercase;
        line-height: 1.2;
      }

      /* Keep the existing gap above the stacked folders. */
      .files {
        --file-air: clamp(32px, 7vh, 64px);
      }

      .files .folder {
        top: calc(var(--file-air) + var(--tab));
        min-height: calc(var(--vh) - var(--file-air) - var(--tab));
      }

      .files .folder[data-tall] {
        top: var(--tall-top);
      }

      /* Both layers occupy the same space so typing doesn't move the bio. */
      .tw-block {
        display: grid;
      }

      .tw-measure,
      .tw-output {
        grid-area: 1 / 1;
        min-width: 0;
        overflow-wrap: break-word;
      }

      .tw-measure {
        visibility: hidden;
        pointer-events: none;
        user-select: none;
      }

      .tw-caret {
        display: inline-block;
        width: 0;
        height: .86em;
        margin-left: .04em;
        border-left: .075em solid var(--rust);
        vertical-align: -.06em;
        animation: tw-blink .85s steps(1) infinite;
      }

      @keyframes tw-blink {
        50% { opacity: 0; }
      }

      .site-ending {
        position: relative;
        min-height: 52vh;
        display: grid;
        align-content: center;
        gap: 22px;
        padding: clamp(54px, 9vw, 140px) var(--margin);
        background: var(--dark-cover, #393a34);
        color: var(--light-ink, #e4e0d5);
      }

      .site-ending h2 {
        margin: 0;
        font-size: clamp(3rem, 7vw, 7rem);
        line-height: 1.05;
        font-weight: 400;
      }

      .site-ending .ending-email {
        width: fit-content;
        max-width: 100%;
        overflow-wrap: anywhere;
        font-size: clamp(1.05rem, 2.2vw, 2rem);
        text-underline-offset: .2em;
      }

      .site-ending .ending-links {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 28px;
      }

      .site-ending a + a {
        margin-left: 0;
      }

      .site-ending a:focus-visible {
        outline-color: #e4e0d5;
      }

      @media (max-width: 680px) {
        body .hero {
          min-height: calc(var(--vh) - var(--tab) - 24px);
        }

        #name {
          font-size: clamp(2.5rem, 11.5vw, 4.4rem);
        }

        .files { --file-air: 28px; }
        .site-ending { min-height: 44vh; }
      }

      @media (prefers-reduced-motion: reduce) {
        .tw-caret { animation: none; }
      }
    `;

    document.head.append(styles);
  }

  function setupMeows(cat) {
    const clips = [
      "assets/meow-1.wav",
      "assets/meow-2.wav",
      "assets/meow-3.wav"
    ];

    const player = new Audio();
    player.volume = 0.75;

    let previous = -1;

    cat.addEventListener("click", () => {
      const choices = clips
        .map((_, index) => index)
        .filter(index => index !== previous);

      const selected = choices[Math.floor(Math.random() * choices.length)];
      previous = selected;

      player.pause();
      player.src = clips[selected];

      // Start directly inside the click so the first tap works on mobile.
      player.play().catch(error => {
        // A second click can intentionally interrupt the first recording.
        if (error.name !== "AbortError") {
          console.warn("Could not play the cat recording:", clips[selected], error);
        }
      });
    });

    window.addEventListener("pagehide", () => player.pause());
  }

  function setupNavigation(nav) {
    if (!nav) return;

    let scheduled = false;

    function paint() {
      scheduled = false;

      const distance = Math.max(1, nav.offsetHeight);
      const fraction = Math.min(1, Math.max(0, window.scrollY / distance));

      nav.style.opacity = String(1 - fraction);
      nav.style.visibility = fraction === 1 ? "hidden" : "visible";
      nav.style.pointerEvents = fraction === 1 ? "none" : "";
    }

    function requestPaint() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(paint);
    }

    window.addEventListener("scroll", requestPaint, { passive: true });
    window.addEventListener("resize", requestPaint);
    window.addEventListener("pageshow", requestPaint);
    paint();
  }

  function setupFolders(files) {
    if (!files) return;

    const folders = [...files.querySelectorAll(".folder")];

    function measure() {
      const viewport = document.documentElement.clientHeight;

      for (const folder of folders) {
        folder.removeAttribute("data-tall");

        const top = parseFloat(getComputedStyle(folder).top);
        const height = folder.getBoundingClientRect().height;

        if (height + top > viewport + 2) {
          folder.style.setProperty("--tall-top", `${viewport - height}px`);
          folder.setAttribute("data-tall", "");
        }
      }
    }

    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    if (document.fonts) document.fonts.ready.then(measure);
    measure();
  }

  function setupFooter() {
    const footer = document.querySelector("footer");
    if (!footer) return;

    footer.classList.add("site-ending");
    document.documentElement.id = "top";

    const backToTop = footer.querySelector('a[href="#nav"]');
    if (backToTop) backToTop.href = "#top";
  }

  function createTypewriterSounds() {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    let context;
    let clickSample;

    async function enable() {
      if (!AudioEngine) return false;

      try {
        if (!context) context = new AudioEngine();
        if (context.state !== "running") await context.resume();
        return context.state === "running";
      } catch {
        return false;
      }
    }

    function unlock() {
      enable().then(ready => {
        if (!ready) return;
        for (const event of ["pointerdown", "click", "keydown"]) {
          document.removeEventListener(event, unlock);
        }
      });
    }

    for (const event of ["pointerdown", "click", "keydown"]) {
      document.addEventListener(event, unlock);
    }

    // The animation continues even when the browser requires a gesture for audio.
    unlock();

    function key() {
      if (context?.state !== "running") return;

      if (!clickSample) {
        const length = Math.ceil(context.sampleRate * 0.035);
        clickSample = context.createBuffer(1, length, context.sampleRate);
        const samples = clickSample.getChannelData(0);

        for (let i = 0; i < length; i++) {
          samples[i] = (Math.random() * 2 - 1) * Math.exp(-7 * i / length);
        }
      }

      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();

      source.buffer = clickSample;
      source.playbackRate.value = 0.86 + Math.random() * 0.3;
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      gain.gain.value = 0.2;

      source.connect(filter).connect(gain).connect(context.destination);

      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      source.start();
    }

    function ding() {
      if (context?.state !== "running") return;

      const now = context.currentTime;

      for (const [frequency, volume] of [[1320, 0.06], [2644, 0.017]]) {
        const tone = context.createOscillator();
        const gain = context.createGain();

        tone.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(volume, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

        tone.connect(gain).connect(context.destination);

        tone.onended = () => {
          tone.disconnect();
          gain.disconnect();
        };

        tone.start(now);
        tone.stop(now + 0.5);
      }
    }

    return { key, ding };
  }

  async function playIntro(name, bio, sounds) {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

    // A real newline is shared by the finished heading and the animation.
    const fullName = "JOANN\nBISSELING";
    const fullBio = bio.textContent.trim();

    name.textContent = fullName;
    name.setAttribute("aria-label", "Joann Bisseling");

    if (reducedMotion.matches) return;

    function prepare(element, text, label) {
      const measure = document.createElement("span");
      const output = document.createElement("span");
      const letters = document.createTextNode("");
      const caret = document.createElement("span");

      element.classList.add("tw-block");
      element.setAttribute("aria-label", label);

      measure.className = "tw-measure";
      measure.setAttribute("aria-hidden", "true");
      measure.textContent = text;

      output.className = "tw-output";
      output.setAttribute("aria-hidden", "true");

      caret.className = "tw-caret";
      output.append(letters);
      element.replaceChildren(measure, output);

      return { element, text, output, letters, caret };
    }

    const title = prepare(name, fullName, "Joann Bisseling");
    const paragraph = prepare(bio, fullBio, fullBio);

    async function type(section, speed) {
      section.output.append(section.caret);

      for (const character of section.text) {
        if (reducedMotion.matches) break;

        section.letters.appendData(character);

        if (character === "\n") {
          // Brief carriage return between names, without ringing the bell.
          await delay(160);
          continue;
        }

        if (character.trim()) sounds.key();

        const pause = /[.!?]/.test(character) ? 90 : 0;
        await delay(speed + pause);
      }

      section.element.textContent = section.text;
      section.element.classList.remove("tw-block");

      if (!reducedMotion.matches) sounds.ding();
    }

    await delay(260);
    await type(title, 85);
    await delay(300);
    await type(paragraph, 30);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();