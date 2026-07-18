/* XenReality Pi Setup — wizard logic */
(function () {
  const TOTAL_STEPS = 9;
  let current = 1;
  let vertical = null;
  const confirmed = {}; // step number -> true once ticked

  const wizard = document.getElementById("wizard");
  const steps = Array.from(document.querySelectorAll(".step"));
  const stepCount = document.getElementById("stepCount");
  const progressFill = document.getElementById("progressFill");
  const verticalTag = document.getElementById("verticalTag");
  const btnBack = document.getElementById("btnBack");
  const btnHelp = document.getElementById("btnHelp");
  const btnNext = document.getElementById("btnNext");
  const btnDone = document.getElementById("btnDone");
  const stepConfirm = document.getElementById("stepConfirm");
  const doneModal = document.getElementById("doneModal");
  const btnFinish = document.getElementById("btnFinish");

  const VERTICAL_LABELS = { fnb: "F&B", retail: "Retail" };

  function render() {
    steps.forEach((s) => {
      s.classList.toggle("hidden", Number(s.dataset.step) !== current);
    });
    stepCount.textContent = "Step " + current + " of " + TOTAL_STEPS;
    progressFill.style.width = (current / TOTAL_STEPS) * 100 + "%";
    btnBack.style.visibility = current === 1 ? "hidden" : "visible";
    const last = current === TOTAL_STEPS;
    btnNext.classList.toggle("hidden", last);
    btnDone.classList.toggle("hidden", !last);
    stepConfirm.checked = !!confirmed[current];
    btnNext.disabled = !confirmed[current];
    btnDone.disabled = !confirmed[current];
    // collapse any open trouble panels on step change
    document.querySelectorAll(".trouble[open]").forEach((d) => d.removeAttribute("open"));
    wizard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startWizard(v) {
    vertical = v || vertical || "fnb";
    verticalTag.textContent = VERTICAL_LABELS[vertical];
    current = 1;
    wizard.classList.remove("hidden");
    render();
  }

  function exitWizard() {
    wizard.classList.add("hidden");
    document.getElementById("choose").scrollIntoView({ behavior: "smooth" });
  }

  function goNext() {
    if (!confirmed[current]) return;
    if (current < TOTAL_STEPS) {
      current++;
      render();
    }
  }

  function goBack() {
    if (current > 1) {
      current--;
      render();
    }
  }

  // vertical pickers (cards + hero chips)
  document.querySelectorAll("[data-vertical]").forEach((el) => {
    el.addEventListener("click", () => startWizard(el.dataset.vertical));
  });

  // "Start Setup" buttons: the journey begins at "What is a Raspberry Pi"
  document.querySelectorAll('[data-action="start"]').forEach((el) => {
    el.addEventListener("click", () => {
      document.getElementById("about").scrollIntoView({ behavior: "smooth" });
    });
  });

  // "What's a Raspberry Pi?"
  document.querySelectorAll('[data-action="learn"]').forEach((el) => {
    el.addEventListener("click", () => {
      document.getElementById("about").scrollIntoView({ behavior: "smooth" });
    });
  });

  document.querySelector('[data-action="exit"]').addEventListener("click", exitWizard);

  stepConfirm.addEventListener("change", () => {
    confirmed[current] = stepConfirm.checked;
    btnNext.disabled = !stepConfirm.checked;
    btnDone.disabled = !stepConfirm.checked;
  });

  btnHelp.addEventListener("click", () => {
    const active = steps.find((s) => Number(s.dataset.step) === current);
    const panel = active && active.querySelector(".trouble");
    if (panel) {
      if (panel.hasAttribute("open")) panel.removeAttribute("open");
      else {
        panel.setAttribute("open", "");
        panel.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  });

  btnNext.addEventListener("click", goNext);
  btnBack.addEventListener("click", goBack);

  btnDone.addEventListener("click", () => {
    if (!confirmed[current]) return;
    doneModal.classList.remove("hidden");
  });

  btnFinish.addEventListener("click", () => {
    doneModal.classList.add("hidden");
    wizard.classList.add("hidden");
    current = 1;
    for (const k in confirmed) delete confirmed[k];
    document.getElementById("top").scrollIntoView({ behavior: "smooth" });
  });

  // ── Feedback (sent to XenReality by email) ──
  const FEEDBACK_EMAIL = "omair@xenreality.com";
  let fbRating = 0;
  const fbStars = Array.from(document.querySelectorAll("#fbStars .star"));
  const fbText = document.getElementById("fbText");
  const btnSendFb = document.getElementById("btnSendFb");
  const fbThanks = document.getElementById("fbThanks");

  fbStars.forEach((s) => {
    s.addEventListener("click", () => {
      fbRating = Number(s.dataset.rate);
      fbStars.forEach((x) => x.classList.toggle("on", Number(x.dataset.rate) <= fbRating));
    });
  });

  btnSendFb.addEventListener("click", () => {
    const label = VERTICAL_LABELS[vertical] || "Unknown";
    const subject = "Pi Setup Feedback (" + label + ") - " + (fbRating ? fbRating + "/5" : "no rating");
    const body =
      "Setup type: " + label + "\n" +
      "Rating: " + (fbRating ? fbRating + "/5" : "not given") + "\n" +
      "Date: " + new Date().toLocaleString() + "\n\n" +
      "Comments:\n" + (fbText.value.trim() || "(none)");
    // keep a local copy too, in case the mail app doesn't open
    try {
      const log = JSON.parse(localStorage.getItem("xen-feedback") || "[]");
      log.push({ vertical: label, rating: fbRating, comments: fbText.value.trim(), at: Date.now() });
      localStorage.setItem("xen-feedback", JSON.stringify(log));
    } catch (e) {}
    window.location.href =
      "mailto:" + FEEDBACK_EMAIL +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
    fbThanks.classList.remove("hidden");
    btnSendFb.disabled = true;
  });

  // close modal on overlay click
  doneModal.addEventListener("click", (e) => {
    if (e.target === doneModal) doneModal.classList.add("hidden");
  });

  // keyboard: Enter/→ = next (when confirmed), ← = back (only while wizard visible)
  document.addEventListener("keydown", (e) => {
    if (wizard.classList.contains("hidden")) return;
    if (!doneModal.classList.contains("hidden")) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if (e.key === "ArrowRight" || e.key === "Enter") goNext();
    else if (e.key === "ArrowLeft") goBack();
  });

  // ── Export PDF: print the whole guide (all steps + requirements summary) ──
  function exportPdf() {
    document.querySelectorAll("details.trouble").forEach((d) => d.setAttribute("open", ""));
    window.print();
  }
  window.addEventListener("afterprint", () => {
    document.querySelectorAll("details.trouble[open]").forEach((d) => d.removeAttribute("open"));
  });
  const btnExportPdf = document.getElementById("btnExportPdf");
  const btnExportPdf2 = document.getElementById("btnExportPdf2");
  if (btnExportPdf) btnExportPdf.addEventListener("click", exportPdf);
  if (btnExportPdf2) btnExportPdf2.addEventListener("click", exportPdf);

  // deep link: index.html#choose from the requirements page
  if (location.hash === "#choose") {
    setTimeout(() => document.getElementById("choose").scrollIntoView({ behavior: "smooth" }), 100);
  }
})();
