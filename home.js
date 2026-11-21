(() => {
  "use strict";

  function start() {
    const nav = document.querySelector("#nav");
    const files = document.querySelector(".files");
    const name = document.querySelector("#name");
    const bio = document.querySelector("#bio");
    const cat = document.querySelector("#cat");

    const styles = document.createElement("style");
    styles.textContent = `
      /* The navigation belongs to the top of the page and scrolls with it. */
      body .nav {
        position: absolute;
        inset: 0 0 auto;
        background: transparent;
        border: 0;
        transition: none;
      }

      /* Folded files stop below a visible strip of the page background. */
      .files {
        --file-air: clamp(32px, 7vh, 64px);
      }

      .files .folder {
        top: calc(var(--file-air) + var(--tab));
        min-height: calc(var(--vh) - var(--file-air) - var(--tab));
      }

      /* Taller files can scroll far enough to reveal their last line. */
      .files .folder[data-tall] {
        top: var(--tall-top);
      }

      /* Reserve the final text dimensions while typing into the same space. */
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

      .site-ending a + a { margin-left: 0; }
      .site-ending a:focus-visible { outline-color: #e4e0d5; }

      @media (max-width: 680px) {
        .files { --file-air: 28px; }
        .site-ending { min-height: 44vh; }
      }
    `;
    document.head.append(styles);

    setupNavigation(nav);
    setupFolders(files);
    setupFooter();

    const sound = createSound();
    if (cat) cat.addEventListener("click", sound.meow);

    if (name && bio) {
      typeIntro(name, bio, sound);
    }
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
    const footer = document.querySelector("footer") ||
      document.body.appendChild(document.createElement("footer"));

    footer.className = "site-ending";
    footer.innerHTML = `
      <h2>Contact me</h2>
      <a class="ending-email" href="mailto:j29bisseling@gmail.com">
        j29bisseling@gmail.com
      </a>
      <div class="ending-links">
        <a href="https://www.linkedin.com/in/joannbisseling/">LinkedIn</a>
        <a href="works.html">See all works</a>
        <a href="#top">Back to top ↑</a>
      </div>
    `;
    document.documentElement.id = "top";
  }

  function createSound() {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    let context;
    let clickSample;
    let lastMeow = -Infinity;

    function enable() {
      if (!AudioEngine) return Promise.resolve(false);

      try {
        context ||= new AudioEngine();
        if (context.state === "running") return Promise.resolve(true);
        return context.resume()
          .then(() => context.state === "running")
          .catch(() => false);
      } catch {
        return Promise.resolve(false);
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
    unlock();

    function key() {
      if (context?.state !== "running") return;

      if (!clickSample) {
        const length = Math.ceil(context.sampleRate * .035);
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
      source.playbackRate.value = .86 + Math.random() * .3;
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      gain.gain.value = .2;

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

      for (const [frequency, volume] of [[1320, .06], [2644, .017]]) {
        const tone = context.createOscillator();
        const gain = context.createGain();

        tone.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, now);
        gain.gain.exponentialRampToValueAtTime(volume, now + .006);
        gain.gain.exponentialRampToValueAtTime(.0001, now + .48);

        tone.connect(gain).connect(context.destination);
        tone.onended = () => {
          tone.disconnect();
          gain.disconnect();
        };
        tone.start(now);
        tone.stop(now + .5);
      }
    }

    async function meow() {
      if (!(await enable())) return;
      const now = context.currentTime;
      if (now - lastMeow < .55) return;
      lastMeow = now;

      const voice = context.createOscillator();
      const mouth = context.createBiquadFilter();
      const gain = context.createGain();

      voice.type = "sawtooth";
      voice.frequency.setValueAtTime(420, now);
      voice.frequency.exponentialRampToValueAtTime(730, now + .13);
      voice.frequency.exponentialRampToValueAtTime(530, now + .31);
      voice.frequency.exponentialRampToValueAtTime(315, now + .55);

      mouth.type = "bandpass";
      mouth.Q.value = 2.4;
      mouth.frequency.setValueAtTime(1000, now);
      mouth.frequency.exponentialRampToValueAtTime(2150, now + .12);
      mouth.frequency.exponentialRampToValueAtTime(790, now + .52);

      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.14, now + .04);
      gain.gain.exponentialRampToValueAtTime(.09, now + .28);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .56);

      voice.connect(mouth).connect(gain).connect(context.destination);
      voice.onended = () => {
        voice.disconnect();
        mouth.disconnect();
        gain.disconnect();
      };
      voice.start(now);
      voice.stop(now + .58);
    }

    return { key, ding, meow };
  }

  async function typeIntro(name, bio, sound) {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

    if (reduceMotion.matches) return;

    function prepare(element) {
      const text = element.textContent.trim();
      const measure = document.createElement("span");
      const output = document.createElement("span");
      const letters = document.createTextNode("");
      const caret = document.createElement("span");

      element.classList.add("tw-block");
      element.setAttribute("aria-label", text);
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

    const title = prepare(name);
    const paragraph = prepare(bio);

    async function type(section, speed) {
      section.output.append(section.caret);

      for (const character of section.text) {
        if (reduceMotion.matches) break;
        section.letters.appendData(character);
        if (character.trim()) sound.key();

        const pause = /[.!?]/.test(character) ? 90 : 0;
        await delay(speed + pause);
      }

      section.element.textContent = section.text;
      section.element.classList.remove("tw-block");

      // Only a finished section rings. Wrapping onto a new line is silent.
      if (!reduceMotion.matches) sound.ding();
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