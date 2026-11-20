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

  /* Install: filter the tools by name -------------------------------------- */
  const picker = document.querySelector(".picker");
  const search = document.getElementById("tool-search");
  const noMatch = document.querySelector(".no-match");
  const cats = document.querySelector(".cats");
  if (picker && search && caTabs) {
    picker.hidden = false;
    const toolTabs = [...caTabs.querySelectorAll('[role="tab"]')];
    const catButtons = cats ? [...cats.querySelectorAll("button")] : [];
    let cat = catButtons[0]?.dataset.cat ?? null;
    // One row of tools at a time: the chosen category, or whatever the search matches.
    const filter = () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      for (const t of toolTabs) {
        const hit = q ? t.textContent.toLowerCase().includes(q) : !cat || t.dataset.cat === cat;
        t.hidden = !hit;
        if (hit) shown++;
      }
      catButtons.forEach((b) => b.setAttribute("aria-pressed", String(!q && b.dataset.cat === cat)));
      noMatch.textContent = shown ? "" : "Not listed? Any tool that speaks MCP works: pick “Other MCP hosts” under CI and terminal.";
      return toolTabs.filter((t) => !t.hidden);
    };
    if (cats) {
      cats.hidden = false;
      catButtons.forEach((b) => b.addEventListener("click", () => {
        cat = b.dataset.cat;
        search.value = "";
        const visible = filter();
        if (!visible.some((t) => t.getAttribute("aria-selected") === "true")) visible[0]?.click();
      }));
    }
    search.addEventListener("input", () => {
      const visible = filter();
      if (visible.length === 1) visible[0].click();
    });
    // When something else opens a tab (the hero button), show its category.
    caTabs.addEventListener("click", (e) => {
      const t = e.target.closest('[role="tab"]');
      if (t && !search.value) { cat = t.dataset.cat ?? cat; filter(); }
    });
    for (const t of toolTabs) {
      new MutationObserver(() => {
        if (t.getAttribute("aria-selected") === "true" && t.hidden && !search.value) { cat = t.dataset.cat; filter(); }
      }).observe(t, { attributes: true, attributeFilter: ["aria-selected"] });
    }
    filter();
  }

  /* The verifier: two real fixes go through the six gates ------------------- */
  const gates = document.querySelector(".gates");
  if (gates) {
    const list = [...gates.querySelectorAll(".gate")];
    const paint = (a, b) => {
      gates.style.setProperty("--a", String(a));
      gates.style.setProperty("--b", String(b));
      list.forEach((g, i) => { g.classList.toggle("lit", i < a); g.classList.toggle("stop", i === 2 && b >= 3); });
      gates.classList.toggle("g-end", a >= 6);
      gates.classList.toggle("g-stop", b >= 3);
    };
    if (!motion) paint(6, 3);
    else {
      paint(0.6, 0.6);
      let started = false;
      const run = async () => {
        for (let k = 1; k <= 6; k++) { paint(k, Math.min(k, 3)); await wait(650); }
        await wait(2600);
        paint(0.6, 0.6);
        await wait(900);
        run();
      };
      new IntersectionObserver((entries, o) => {
        if (!started && entries.some((e) => e.isIntersecting)) { started = true; o.disconnect(); setTimeout(run, 400); }
      }, { threshold: 0.4 }).observe(gates);
    }
  }

  /* Background: the glow drifts with how far down the page you are -------- */
  const ambient = document.querySelector(".ambient");
  if (ambient) {
    const drift = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      ambient.style.setProperty("--sp", (max > 0 ? scrollY / max : 0).toFixed(3));
    };
    addEventListener("scroll", drift, { passive: true });
    drift();
  }

  /* How it works: a scan line runs down the page with your scroll ----------- */
  const scan = document.querySelector(".scan");
  if (scan && motion) {
    const track = scan.querySelector(".scan-track");
    const frame = scan.querySelector(".scan-frame");
    const rows = [...scan.querySelectorAll(".sf-row[data-at]")];
    const hud = Object.fromEntries([...scan.querySelectorAll("[data-hud]")].map((el) => [el.dataset.hud, el]));
    const wide = matchMedia("(min-width: 861px)");
    let at = [];
    const measure = () => {
      const fh = frame.offsetHeight || 1;
      at = rows.map((r) => { const p = r.querySelector(".sf-page"); return (p.offsetTop + p.offsetHeight * 0.5) / fh; });
    };
    const update = () => {
      if (!scan.classList.contains("pinned")) return;
      const r = track.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (-r.top + innerHeight * 0.15) / Math.max(1, r.height - innerHeight * 0.85)));
      scan.style.setProperty("--sp", p.toFixed(4));
      let found = 0, ok = 0, no = 0;
      rows.forEach((row, i) => {
        const phase = p < at[i] ? 0 : p < at[i] + 0.05 ? 1 : p < at[i] + 0.1 ? 2 : 3;
        if (phase) row.dataset.phase = String(phase); else delete row.dataset.phase;
        if (phase) found++;
        if (phase === 3) row.dataset.ok === "1" ? ok++ : no++;
      });
      hud.found.textContent = found; hud.ok.textContent = ok; hud.no.textContent = no;
    };
    const mode = () => {
      const on = wide.matches;
      scan.classList.toggle("pinned", on);
      scan.classList.toggle("live", on);
      scan.classList.toggle("done", !on);
      if (on) { measure(); update(); }
      else {
        rows.forEach((row) => delete row.dataset.phase);
        hud.found.textContent = rows.length;
        hud.ok.textContent = rows.filter((r) => r.dataset.ok === "1").length;
        hud.no.textContent = rows.filter((r) => r.dataset.ok === "0").length;
      }
    };
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", () => { measure(); update(); });
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
