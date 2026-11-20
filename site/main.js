// Progressive enhancement only: without this file every panel, step and command is still on the page.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
        announce("Copied to the clipboard.");
      } catch {
        b.textContent = "Select and copy";
        announce("Could not copy. Select the text and copy it instead.");
      }
      setTimeout(() => (b.textContent = "Copy"), 2200);
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
        const n = k === "home" ? 0 : k === "end" ? tabs.length - 1 : (i + k + tabs.length) % tabs.length;
        select(n, true);
      });
    });
    select(0, false);
  }

  /* The verdict window: checks light up one by one ------------------------ */
  let timers = [];
  const run = (panel) => {
    timers.forEach(clearTimeout);
    timers = [];
    const items = [...panel.querySelectorAll(".va-checks li")];
    const verdict = panel.querySelector(".va-verdict strong")?.textContent ?? "";
    if (reduce) {
      panel.classList.remove("running", "done");
      return;
    }
    panel.classList.remove("done");
    panel.classList.add("running");
    items.forEach((li) => li.classList.remove("shown"));
    items.forEach((li, i) => timers.push(setTimeout(() => li.classList.add("shown"), 350 + i * 380)));
    timers.push(
      setTimeout(() => {
        panel.classList.add("done");
        announce(verdict);
      }, 450 + items.length * 380),
    );
  };
  const vaTabs = document.querySelector(".va-tabs");
  if (vaTabs) {
    let seen = false;
    setupTabs(vaTabs, (panel) => seen && run(panel));
    const replay = document.querySelector(".replay");
    replay.hidden = false;
    replay.addEventListener("click", () => run(document.querySelector(".va-panel:not([hidden])")));
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !seen) {
        seen = true;
        run(document.querySelector(".va-panel:not([hidden])"));
        io.disconnect();
      }
    }, { threshold: 0.45 });
    io.observe(document.querySelector(".va-window"));
  }

  const caTabs = document.querySelector(".ca-tabs");
  if (caTabs) {
    caTabs.closest(".code-app").classList.add("tabbed");
    for (const t of document.querySelectorAll(".ca-title")) t.classList.add("sr-only");
    setupTabs(caTabs);
  }

})();
