/* XenReality requirements checklist: gate the setup behind a completed checklist.
   Progress is saved locally (localStorage) so a later visit picks up where you left off. */
(function () {
  const boxes = Array.from(document.querySelectorAll(".req-box"));
  const reqCount = document.getElementById("reqCount");
  const reqFill = document.getElementById("reqFill");
  const btnContinue = document.getElementById("btnContinue");
  const btnReset = document.getElementById("btnReset");
  const TOTAL = boxes.length;
  const STORE_KEY = "xen-req-checklist";
  const COMPLETE_KEY = "xen-req-complete"; // read by index.html's gate

  // restore saved state from a previous visit
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) {}
  boxes.forEach((b, i) => { b.checked = !!saved[i]; });

  function update(persist) {
    const done = boxes.filter((b) => b.checked).length;
    reqCount.textContent = done + " of " + TOTAL + " checked";
    reqFill.style.width = (TOTAL ? (done / TOTAL) * 100 : 0) + "%";
    const ready = done === TOTAL && TOTAL > 0;
    btnContinue.classList.toggle("disabled", !ready);
    btnContinue.setAttribute("aria-disabled", String(!ready));
    btnContinue.textContent = ready ? "All checked! Continue to Setup" : "Continue to Setup";
    if (persist) {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(boxes.map((b) => b.checked)));
        localStorage.setItem(COMPLETE_KEY, ready ? "true" : "false");
      } catch (e) {}
    }
  }

  boxes.forEach((b) => b.addEventListener("change", () => update(true)));

  btnContinue.addEventListener("click", (e) => {
    if (btnContinue.classList.contains("disabled")) {
      e.preventDefault();
      // nudge: scroll to the first unchecked item
      const firstUnchecked = boxes.find((b) => !b.checked);
      if (firstUnchecked) {
        const li = firstUnchecked.closest("li");
        li.scrollIntoView({ behavior: "smooth", block: "center" });
        li.classList.add("req-nudge");
        setTimeout(() => li.classList.remove("req-nudge"), 1200);
      }
    }
  });

  // ── Reset (with in-page confirmation modal) ──
  const resetModal = document.getElementById("resetModal");
  const btnResetConfirm = document.getElementById("btnResetConfirm");
  const btnResetCancel = document.getElementById("btnResetCancel");

  btnReset.addEventListener("click", () => resetModal.classList.remove("hidden"));
  btnResetCancel.addEventListener("click", () => resetModal.classList.add("hidden"));
  resetModal.addEventListener("click", (e) => {
    if (e.target === resetModal) resetModal.classList.add("hidden");
  });

  btnResetConfirm.addEventListener("click", () => {
    boxes.forEach((b) => { b.checked = false; });
    try {
      localStorage.removeItem(STORE_KEY);
      localStorage.setItem(COMPLETE_KEY, "false");
    } catch (e) {}
    update(false);
    resetModal.classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // sync the completion flag on load too (covers pre-existing saved states)
  update(true);
})();
