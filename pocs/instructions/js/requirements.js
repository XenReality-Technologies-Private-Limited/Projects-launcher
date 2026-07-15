/* XenReality requirements checklist: gate the setup behind a completed checklist */
(function () {
  const boxes = Array.from(document.querySelectorAll(".req-box"));
  const reqCount = document.getElementById("reqCount");
  const reqFill = document.getElementById("reqFill");
  const btnContinue = document.getElementById("btnContinue");
  const TOTAL = boxes.length;
  const STORE_KEY = "xen-req-checklist";

  // restore saved state
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) {}
  boxes.forEach((b, i) => { b.checked = !!saved[i]; });

  function update() {
    const done = boxes.filter((b) => b.checked).length;
    reqCount.textContent = done + " of " + TOTAL + " checked";
    reqFill.style.width = (TOTAL ? (done / TOTAL) * 100 : 0) + "%";
    const ready = done === TOTAL;
    btnContinue.classList.toggle("disabled", !ready);
    btnContinue.setAttribute("aria-disabled", String(!ready));
    if (ready) btnContinue.textContent = "All checked! Continue to Setup";
    else btnContinue.textContent = "Continue to Setup";
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(boxes.map((b) => b.checked)));
    } catch (e) {}
  }

  boxes.forEach((b) => b.addEventListener("change", update));

  btnContinue.addEventListener("click", (e) => {
    if (btnContinue.classList.contains("disabled")) {
      e.preventDefault();
      // nudge: scroll to the first unchecked item
      const firstUnchecked = boxes.find((b) => !b.checked);
      if (firstUnchecked) {
        firstUnchecked.closest("li").scrollIntoView({ behavior: "smooth", block: "center" });
        firstUnchecked.closest("li").classList.add("req-nudge");
        setTimeout(() => firstUnchecked.closest("li").classList.remove("req-nudge"), 1200);
      }
    }
  });

  update();
})();
