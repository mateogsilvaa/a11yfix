// Progressive enhancement only. Without this file every panel, number and command is on the page, still.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motion = !reduce;
  if (motion) document.documentElement.classList.add("motion");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const status = document.createElement("p");
  status.className = "sr-only";
  status.setAttribute("role", "status");
  document.body.append(status);
  const announce = (text) => {
    status.textContent = "";
    setTimeout(() => (status.textContent = text), 50);
  };

  /* Copy buttons ---------------------------------------------------------- */
  const addCopy = (host, getText, label) => {
    if (!navigator.clipboard) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "copy";
    b.textContent = "Copy";
    b.setAttribute("aria-label", label);
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(getText());
        b.textContent = "Copied";
        b.classList.add("done");
        announce("Copied to the clipboard.");
      } catch {
        b.textContent = "Select it";
        announce("Could not copy. Select the text and copy it instead.");
      }
      setTimeout(() => {
        b.textContent = "Copy";
        b.classList.remove("done");
      }, 1800);
    });
    host.append(b);
  };
  for (const c of document.querySelectorAll(".cmd[data-copy]")) addCopy(c, () => c.dataset.copy, `Copy the command: ${c.dataset.copy}`);
  for (const c of document.querySelectorAll(".code[data-copy-block]")) {
    const title = c.closest(".ca-panel")?.querySelector(".ca-title")?.textContent ?? "code";
    addCopy(c, () => c.querySelector("pre").innerText.trim(), `Copy, ${title}`);
  }

  /* Tabs (WAI-ARIA tabs pattern) ------------------------------------------ */
  function setupTabs(list, onSelect) {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
    list.hidden = false;
    const select = (i, focus) => {
      tabs.forEach((t, j) => {
        const on = i === j;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
      onSelect?.(panels[i]);
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i, false));
      t.addEventListener("keydown", (e) => {
        const k = { ArrowRight: 1, ArrowLeft: -1, Home: "home", End: "end" }[e.key];
        if (k === undefined) return;
        e.preventDefault();
        select(k === "home" ? 0 : k === "end" ? tabs.length - 1 : (i + k + tabs.length) % tabs.length, true);
      });
    });
    select(0, false);
    return { selectById: (id) => { const i = tabs.findIndex((t) => t.id === id); if (i >= 0) select(i, false); } };
  }

  /* The demo: type the command, then run the checks one by one ------------ */
  const typed = document.querySelector(".typed");
  const command = typed?.textContent ?? "";
  let runId = 0;
  async function run(panel) {
    const id = ++runId;
    const items = [...panel.querySelectorAll(".va-checks li")];
    const verdict = panel.querySelector(".va-verdict strong")?.textContent ?? "";
    if (!motion) return;
    panel.classList.remove("done");
    panel.classList.add("running");
    items.forEach((li) => li.classList.remove("shown", "active"));
    if (typed) {
      for (let n = 0; n <= command.length; n += 2) {
        if (id !== runId) return;
        typed.textContent = command.slice(0, n);
        await wait(18);
      }
      typed.textContent = command;
    }
    for (const li of items) {
      if (id !== runId) return;
      li.classList.add("active");
      await wait(380);
      li.classList.remove("active");
      li.classList.add("shown");
    }
    await wait(150);
    if (id !== runId) return;
    panel.classList.add("done");
    announce(verdict);
  }
  const vaTabs = document.querySelector(".va-tabs");
  if (vaTabs) {
    let seen = false;
    setupTabs(vaTabs, (panel) => seen && run(panel));
    const replay = document.querySelector(".replay");
    if (motion) {
      replay.hidden = false;
      replay.addEventListener("click", () => run(document.querySelector(".va-panel:not([hidden])")));
    }
    const io = new IntersectionObserver((entries) => {
      if (!seen && entries.some((e) => e.isIntersecting)) {
        seen = true;
        run(document.querySelector(".va-panel:not([hidden])"));
        io.disconnect();
      }
    }, { threshold: 0.35 });
    io.observe(document.querySelector(".va-window"));
  }

  /* Install guide tabs, and the hero button that opens the right one -------- */
  const caTabs = document.querySelector(".ca-tabs");
  let guide = null;
  if (caTabs) {
    caTabs.closest(".guide, .code-app").classList.add("tabbed");
    for (const t of document.querySelectorAll(".ca-title")) t.classList.add("sr-only");
    guide = setupTabs(caTabs);
  }
  const tryBtn = document.querySelector("[data-try]");
  const rot = tryBtn?.querySelector(".try-rot");
  let current = rot?.firstElementChild ?? null;
  if (tryBtn && guide) tryBtn.addEventListener("click", () => current && guide.selectById(current.dataset.tab));
  if (rot && motion) {
    const items = [...rot.children];
    let i = 0;
    rot.classList.add("js");
    items[0].classList.add("on");
    setInterval(() => {
      const prev = items[i];
      i = (i + 1) % items.length;
      prev.classList.remove("on");
      items[i].classList.add("on");
      current = items[i];
    }, 2200);
  }

  /* Header: denser once the page scrolls; the current section is marked ---- */
  const header = document.querySelector(".site-header");
  const onScrollHeader = () => header?.classList.toggle("scrolled", scrollY > 24);
  addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();
  const navLinks = new Map([...document.querySelectorAll(".nav-links a")].map((a) => [a.getAttribute("href").slice(1), a]));
  const navSpy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      navLinks.forEach((a, id) => (id === e.target.id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    }
  }, { rootMargin: "-40% 0px -55% 0px" });
  navLinks.forEach((_, id) => { const s = document.getElementById(id); if (s) navSpy.observe(s); });

  /* How it works: pinned on wide screens, one step per stretch of scroll --- */
  const scene = document.querySelector(".scene");
  if (scene && motion) {
    const steps = [...scene.querySelectorAll(".scene-steps li")];
    const track = scene.querySelector(".scene-track");
    const wide = matchMedia("(min-width: 961px)");
    let last = 0;
    const set = (n) => {
      if (n === last) return;
      last = n;
      for (let k = 1; k <= 6; k++) scene.classList.toggle(`s${k}`, k <= n);
      steps.forEach((li) => li.classList.toggle("current", Number(li.dataset.step) === n && scene.classList.contains("pinned")));
    };
    const update = () => {
      if (!scene.classList.contains("pinned")) return;
      const r = track.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      scene.style.setProperty("--sp", p.toFixed(3));
      set(Math.min(6, Math.floor(p * 6.2) + 1));
    };
    const mode = () => {
      scene.classList.toggle("pinned", wide.matches);
      last = 0;
      if (wide.matches) update();
      else set(6);
    };
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    wide.addEventListener("change", mode);
    mode();
  }

  if (!motion) return;

  /* Hero tour: a focus ring tabs through the mock page, verdicts pop up ----- */
  const tour = document.querySelector(".tour");
  if (tour) {
    const page = tour.querySelector(".tour-page");
    const ring = tour.querySelector(".t-ring");
    const stops = [...tour.querySelectorAll("[data-tour]")].sort((a, b) => a.dataset.tour - b.dataset.tour);
    tour.classList.add("js");
    let k = 0;
    const place = (el) => {
      const pr = page.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      Object.assign(ring.style, { left: `${r.left - pr.left - 5}px`, top: `${r.top - pr.top - 5}px`, width: `${r.width + 10}px`, height: `${r.height + 10}px` });
    };
    const tick = () => {
      if (k === stops.length) {
        k = 0;
        tour.querySelectorAll(".t-chip.on").forEach((c) => c.classList.remove("on"));
        setTimeout(tick, 700);
        return;
      }
      const el = stops[k++];
      place(el);
      setTimeout(() => el.querySelector(".t-chip")?.classList.add("on"), 450);
      setTimeout(tick, k === stops.length ? 3200 : 1300);
    };
    addEventListener("resize", () => stops[Math.max(0, k - 1)] && place(stops[Math.max(0, k - 1)]));
    setTimeout(tick, 500);
  }

  /* Logo strip: duplicate it once so the marquee loops without a seam ----- */
  const mq = document.querySelector(".mq-list");
  if (mq) for (const li of [...mq.children]) { const c = li.cloneNode(true); c.setAttribute("aria-hidden", "true"); mq.append(c); }

  /* Reveal on scroll, with a small stagger between siblings ---------------- */
  const groups = new Map();
  for (const el of document.querySelectorAll("[data-reveal]")) {
    const i = groups.get(el.parentElement) ?? 0;
    groups.set(el.parentElement, i + 1);
    el.style.setProperty("--d", `${Math.min(i, 5) * 70}ms`);
  }
  const countUp = (el) => {
    const target = Number(el.textContent.replace(/[^\d]/g, ""));
    if (!target) return;
    const start = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - start) / 1100);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step);
      else el.textContent = String(target);
    };
    requestAnimationFrame(step);
  };
  const reveal = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      for (const n of e.target.querySelectorAll("[data-count]")) countUp(n);
      if (e.target.matches("[data-count]")) countUp(e.target);
      reveal.unobserve(e.target);
    }
  }, { rootMargin: "0px 0px -12% 0px" });
  document.querySelectorAll("[data-reveal]").forEach((el) => reveal.observe(el));

  /* The pipeline line fills as the section scrolls through ---------------- */
  const track = document.querySelector(".track");
  if (track) {
    const section = track.closest("section");
    const update = () => {
      const r = section.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height * 0.9)));
      track.style.setProperty("--p", p.toFixed(3));
    };
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    update();
  }
})();
