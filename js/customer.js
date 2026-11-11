/* customer.js — browse bundles, reserve, review, message the store.
   Anyone can browse. A log-in pop-up opens only for things that need an account. */

const APP = "customer";
let me = Session.get(APP);
let state = { tag: "", kit: store.get("kit", {}) };  // kit: item name → how many, kept in this browser until sent

function drawHeader(h) {
  const links = me ? [["browse", "Browse bundles"], ["kit", "Build a kit"], ["reservations", "My reservations"], ["messages", "Messages"]]
    : [["browse", "Browse bundles"], ["kit", "Build a kit"]];
  renderHeader("Customer", links, h.split("-")[0], me, () => { Session.clear(APP); me = null; go("browse"); });
  if (!me) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = "Log in"; b.onclick = () => needLogin(route);
    $("#header nav.main").insertBefore(b, $("#theme-btn"));  // keep the theme switch last
  }
}
let page = "";  // the page on screen, to tell moving to a new page from redrawing this one
function route() {
  const h = location.hash.slice(1) || "browse";
  if (h !== page) {  // a new page starts at the top; the bundle list goes back to where you left it
    if (page === "browse") state.browseY = scrollY;
    state.backToList = h === "browse";
    if (h !== "browse") scrollTo(0, 0);
    page = h;
  }
  setTitle({ browse: "Browse bundles", kit: "Build a kit", reservations: "My reservations", messages: "Messages" }[h]);
  drawHeader(h);
  if (h.startsWith("bundle-")) return viewBundle(decodeURIComponent(h.slice(7)));
  if (h === "kit") return viewKit();
  if (h === "reservations" || h === "messages") {
    if (!me) { viewBrowse(); return needLogin(route, () => go("browse")); }
    return h === "reservations" ? viewReservations() : viewMessages();
  }
  return viewBrowse();
}
function go(h) {
  if ((location.hash.slice(1) || "browse") === h) route(); else location.hash = h;
}

/* ---------- log-in / sign-up pop-up ---------- */
let pending = null;  // { done, cancel } for the action waiting on a log-in
function needLogin(done, cancel) {
  pending = { done, cancel };
  showLogin();
  if (!authDialog().open) authDialog().showModal();
}
function authDialog() {
  let dlg = $("#auth-dialog");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "auth-dialog"; dlg.className = "modal"; dlg.setAttribute("aria-label", "Log in");
    // Runs on every close (after logging in, the X button, Esc, or a click outside): carry on, or back out.
    dlg.addEventListener("close", () => {
      const p = pending; pending = null;
      const next = p && (me ? p.done : p.cancel);
      if (next) next();
    });
    // A click on the dark area around the box closes it. The press must start there too, so
    // selecting text in a field and letting go outside the box doesn't close it.
    let pressedOutside = false;
    dlg.addEventListener("pointerdown", e => { pressedOutside = e.target === dlg; });
    dlg.addEventListener("click", e => { if (pressedOutside && e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
  }
  return dlg;
}
const CLOSE_X = `<form method="dialog" class="modal-x"><button aria-label="Close">×</button></form>`;
function loggedIn(u, msg) {
  me = u; Session.set(APP, u); toast(msg);
  drawHeader(location.hash.slice(1) || "browse");
  authDialog().close();
}
function showLogin() {
  authDialog().innerHTML = CLOSE_X + loginView("Log in to continue",
    `<p class="small muted">New to All you can rent? <button type="button" class="more" id="to-signup">Create an account</button></p>`);
  wireLogin(["customer"], APP, u => loggedIn(u, "Welcome, " + u.userName));
  $("#to-signup").onclick = showSignup;
  $("#login-user").focus();  // when switching back from sign-up; on opening, autofocus does it
}
function showSignup() {
  authDialog().innerHTML = CLOSE_X + `<div class="auth card pad stack">
    <h2>Create your account</h2>
    <form class="stack" id="signup-form">
      <label class="f">User name<input class="in" name="userName" id="su-user" required autocomplete="username"></label>
      <label class="f">Full name<input class="in" name="realName" id="su-name" required autocomplete="name"></label>
      <label class="f">Phone number<input class="in" name="phoneNumber" id="su-phone" type="tel" required autocomplete="tel" placeholder="920-555-0123"></label>
      <label class="f">Password${passwordInput(`name="password" id="su-pass" minlength="6" required autocomplete="new-password"`)}</label>
      <div data-msg hidden></div>
      <button class="btn btn-green btn-block" type="submit">Sign up</button>
    </form>
    <p class="small muted">Already have an account? <button type="button" class="more" id="to-login">Log in</button></p></div>`;
  $("#to-login").onclick = showLogin;
  onSubmit($("#signup-form"), async d => {
    const res = await API.createCustomer(d);
    loggedIn({ userId: String(res.id), userName: d.userName, role: "customer" }, "Account created");
  });
  $("#su-user").focus();
}

/* ---------- browse ---------- */
const label = t => t.charAt(0).toUpperCase() + t.slice(1);  // "cross-country ski" → "Cross-country ski"
/* Every bundle with its details. The list call only returns ids and names. */
const loadBundles = async () => Promise.all((await API.listBundles()).map(b => API.getBundle(b.bundleId).then(withSamples, () => b)));
/* A bundle's real reviews plus the demo store's sample reviews (js/sample-reviews.js), newest first. */
const withSamples = b => ({ ...b, reviews: [...(b.reviews || []), ...((typeof SAMPLE_REVIEWS === "object" ? SAMPLE_REVIEWS : {})[b.name] || [])]
  .sort((x, y) => String(y.dateEntered || "").localeCompare(String(x.dateEntered || ""))) });
// Kits built for one customer are tagged "custom". They stay out of the shop; the customer gets a link.
const isCustomKit = b => (b.tags || []).includes("custom");

async function viewBrowse() {
  $("#app").innerHTML = `<div class="stack" style="margin-bottom:20px">
      <p class="eyebrow">${me ? `Hi ${esc(me.userName)}` : "Outdoor gear rental"}</p>
      <div class="row between"><h1>Browse bundles</h1><a class="btn btn-ghost btn-sm" href="#kit">Build your own kit</a></div>
      <div class="filters">
        <input class="in" type="search" id="search" value="${esc(state.q || "")}" aria-label="Search bundles"
          placeholder="Search bundles, gear or activities">
        <select class="in" id="activity" aria-label="Filter by activity"><option value="">All activities</option></select>
      </div>
      <div class="row between"><div class="row" id="popular"></div><span class="small muted" id="count"></span></div>
    </div>
    <div id="list"><p class="muted">Loading bundles…</p></div>`;
  try {
    const full = (await loadBundles()).filter(b => !isCustomKit(b));
    if (!full.length) { $("#list").innerHTML = `<div class="card empty">No bundles yet.</div>`; return; }
    // Activities come from the bundles on show, so every choice has results. Most used first.
    const uses = new Map();
    full.forEach(b => (b.tags || []).forEach(t => uses.set(t, (uses.get(t) || 0) + 1)));
    const byUse = [...uses.keys()].sort((a, b) => uses.get(b) - uses.get(a) || a.localeCompare(b));
    if (!uses.has(state.tag)) state.tag = "";
    $("#activity").innerHTML += [...uses.keys()].sort()
      .map(t => `<option value="${esc(t)}">${esc(label(t))} (${uses.get(t)})</option>`).join("");

    // Every word of the search must appear in the bundle's name, a tag or an item.
    const draw = () => {
      state.q = $("#search").value;
      $("#activity").value = state.tag;
      const quick = byUse.slice(0, 6);
      if (state.tag && !quick.includes(state.tag)) quick.push(state.tag);
      $("#popular").innerHTML = `<span class="small muted">Popular:</span>` + quick.map(t =>
        `<button type="button" class="chip ${state.tag === t ? "on" : ""}" data-tag="${esc(t)}" aria-pressed="${state.tag === t}">${esc(label(t))}</button>`).join("");
      const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      const shown = full.filter(b => {
        const text = [b.name, ...(b.tags || []), ...(b.products || []).map(p => p.name)].join(" ").toLowerCase();
        return (!state.tag || (b.tags || []).includes(state.tag)) && words.every(w => text.includes(w));
      });
      $("#count").textContent = `${shown.length} of ${full.length} bundles`;
      $("#list").innerHTML = shown.length ? `<div class="cards">${shown.map(bundleCard).join("")}</div>`
        : `<div class="card empty">No bundles match your search. <button type="button" class="more" data-clear>Clear filters</button></div>`;
    };
    $("#search").oninput = draw;
    $("#activity").onchange = e => { state.tag = e.target.value; draw(); };
    $("#popular").onclick = e => {
      const b = e.target.closest("[data-tag]"); if (!b) return;
      state.tag = state.tag === b.dataset.tag ? "" : b.dataset.tag;  // clicking the active one clears it
      draw();
    };
    $("#list").onclick = e => {
      if (e.target.closest("[data-clear]")) { state.tag = ""; $("#search").value = ""; return draw(); }
      const btn = e.target.closest("[data-more]"); if (!btn) return;
      const open = btn.textContent === "See more";
      btn.previousElementSibling.hidden = !open; btn.previousElementSibling.previousElementSibling.hidden = open;
      btn.textContent = open ? "See less" : "See more";
    };
    draw();
    if (state.backToList) { state.backToList = false; scrollTo(0, state.browseY || 0); }
  } catch (e) { $("#list").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
}

function bundleCard(b) {
  const n = (b.reviews || []).length, avg = n ? (b.reviews.reduce((s, r) => s + (+r.rating || 0), 0) / n).toFixed(1) : null;
  return `<div class="card bcard"><div class="art">${bundleImage(b, b.bundleId)}</div><div class="body">
    <h3><a href="#bundle-${encodeURIComponent(b.bundleId)}">${esc(b.name)}</a></h3>
    <div class="tagline">${(b.tags || []).map(t => `<span>#${esc(t)}</span>`).join("")}</div>
    <p class="small muted">${seeMore(itemSummary(b))}</p>
    <div class="row between" style="margin-top:auto">${b.dailyCharge != null ? `<span><span class="price">${money(b.dailyCharge)}</span><span class="small muted"> / day</span></span>` : "<span></span>"}
    <span class="small">${avg ? `<span class="stars">★</span> ${avg} <span class="muted">(${n})</span>` : `<span class="muted">No reviews yet</span>`}</span></div></div></div>`;
}

/* "2× Sleeping bag · Tent", counting repeated items once. */
function itemSummary(b) {
  const count = new Map();
  (b.products || []).forEach(p => count.set(p.name, (count.get(p.name) || 0) + 1));
  return [...count].map(([name, n]) => (n > 1 ? n + "× " : "") + name).join(" · ");
}
/* Text cut to max characters with a See more toggle (wired in viewBrowse). */
function seeMore(text, max = 90) {
  if (text.length <= max) return esc(text);
  const cut = text.slice(0, max), at = cut.lastIndexOf(" · ");  // end on a whole item when we can
  return `<span>${esc(at > 0 ? cut.slice(0, at) : cut.replace(/\s+\S*$/, ""))}…</span><span hidden>${esc(text)}</span> <button type="button" class="more" data-more>See more</button>`;
}

/* ---------- build your own kit ---------- */
async function viewKit() {
  $("#app").innerHTML = `<div class="stack" style="margin-bottom:20px">
      <p class="eyebrow">Build your own kit</p>
      <h1>Pick exactly the gear you need</h1>
      <p class="muted">Choose items and dates, then send the request. The store checks the shelves, puts your kit together and messages you a link to reserve it.</p>
    </div>
    <div class="side-col">
      <div class="card pad stack">
        <input class="in" type="search" id="kit-search" aria-label="Search gear" placeholder="Search gear, like tent or helmet">
        <div class="kit-list" id="kit-items"><p class="muted small">Loading gear…</p></div>
      </div>
      <form class="card pad stack" id="kit-form">
        <h2>Your kit</h2>
        <div id="kit-summary"></div>
        <div class="grid-2">
          <label class="f">Start date<input class="in" type="date" name="startDate" value="${addDays(today(), 7)}" min="${today()}" required></label>
          <label class="f">End date<input class="in" type="date" name="endDate" value="${addDays(today(), 9)}" min="${today()}" required></label>
        </div>
        <label class="f">Note for the store<span class="hint">Optional, like sizes or group size</span><textarea class="in" name="note" rows="2" maxlength="150"></textarea></label>
        <div data-msg hidden></div>
        <button class="btn btn-green btn-block" type="submit">Send request</button>
        <p class="small muted">A cleaning fee is added when you bring the kit back. The store replies in Messages.</p>
      </form>
    </div>`;
  // The gear list is every item in the shop's bundles. The server matches kit items by name.
  let gear;
  try {
    const byName = new Map();
    (await loadBundles()).forEach(b => (b.products || []).forEach(p => { if (!byName.has(p.name)) byName.set(p.name, p); }));
    gear = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) { $("#kit-items").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; return; }
  const price = new Map(gear.map(p => [p.name, +p.dailyCharge || 0]));
  const picked = () => Object.entries(state.kit).filter(([name, n]) => n > 0 && price.has(name));

  const drawList = () => {
    const words = $("#kit-search").value.toLowerCase().split(/\s+/).filter(Boolean);
    const shown = gear.filter(p => words.every(w => `${p.name} ${p.description || ""}`.toLowerCase().includes(w)));
    $("#kit-items").innerHTML = shown.length ? shown.map(p => `<label class="kit-row">
        <span><b>${esc(p.name)}</b><br><span class="small muted">${esc(p.description || "")}</span></span>
        <span class="small muted">${money(p.dailyCharge)}/day</span>
        <input class="in" type="number" min="0" max="10" value="${state.kit[p.name] || 0}" data-item="${esc(p.name)}" aria-label="How many: ${esc(p.name)}"></label>`).join("")
      : `<p class="empty">No gear matches.</p>`;
  };
  // Same formula the server uses (each item's cost ÷ lifetime), so this matches the bundle price it makes.
  const drawSummary = () => {
    const f = $("#kit-form"), list = picked();
    const perDay = list.reduce((s, [name, n]) => s + n * price.get(name), 0);
    const days = Math.max(1, Math.round((Date.parse(f.endDate.value) - Date.parse(f.startDate.value)) / 864e5)) || 1;
    $("#kit-summary").innerHTML = list.length ? `<div class="lines">
        ${list.map(([name, n]) => `<div><span>${n} × ${esc(name)}</span><span>${money(n * price.get(name))}</span></div>`).join("")}
        <div class="total"><span>Per day</span><span class="price">${money(perDay)}</span></div>
        <div class="small muted"><span>${days} day${days > 1 ? "s" : ""}, before the cleaning fee</span><span>${money(perDay * days)}</span></div></div>`
      : `<p class="muted small">Nothing picked yet. Set a number next to any item.</p>`;
  };
  $("#kit-search").oninput = drawList;
  $("#kit-items").oninput = e => {
    const i = e.target.closest("[data-item]"); if (!i) return;
    state.kit[i.dataset.item] = Math.max(0, Math.min(10, parseInt(i.value, 10) || 0));
    store.set("kit", state.kit);
    drawSummary();
  };
  linkDates($("#kit-form").startDate, $("#kit-form").endDate);
  $("#kit-form").onchange = e => { if (e.target.type === "date") drawSummary(); };
  onSubmit($("#kit-form"), async d => {
    const items = picked().map(([name, qty]) => ({ name, qty }));
    if (!items.length) throw new Error("Pick at least one item for your kit.");
    if (d.endDate < d.startDate) throw new Error("The end date is before the start date.");
    if (!me) return needLogin(() => $("#kit-form").requestSubmit());  // send right after logging in
    const parts = KitRequest.messages({ startDate: d.startDate, endDate: d.endDate, items, note: d.note.trim() });
    for (const [i, text] of parts.entries()) {
      try { await API.messageStore(me.userId, text); }
      catch (e) { throw new Error(i ? "Only part of your request was sent. Please send it again." : e.message); }
    }
    state.kit = {}; store.set("kit", {}); drawList();
    $("#kit-form").innerHTML = `<p class="eyebrow">Request sent</p><h2>We're putting your kit together</h2>
      <p>The store will message you a link to reserve it for ${esc(d.startDate)} to ${esc(d.endDate)}.</p>
      <div><a class="btn btn-ghost" href="#messages">Go to Messages</a></div>`;
  });
  drawList(); drawSummary();
}

/* ---------- bundle details, availability, reserve, review ---------- */
async function viewBundle(id) {
  $("#app").innerHTML = `<p class="muted">Loading bundle…</p>`;
  let b;
  try { b = withSamples(await API.getBundle(id)); } catch (e) { $("#app").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; return; }
  setTitle(b.name);
  const items = b.products || [], reviews = b.reviews || [];
  const avg = reviews.length ? (reviews.reduce((s, r) => s + (+r.rating || 0), 0) / reviews.length).toFixed(1) : null;
  const start = addDays(today(), 7), end = addDays(today(), 9);

  $("#app").innerHTML = `<a href="#browse" class="small">← Back to bundles</a>
  <div class="side-col" style="margin-top:12px">
    <div class="stack">
      <div class="art-lg">${bundleImage(b, b.bundleId, true)}</div>
      <div class="card pad stack">
        <h1>${esc(b.name)}</h1>
        <div class="row between">${b.dailyCharge != null ? `<span><span class="price" style="font-size:1.5rem">${money(b.dailyCharge)}</span> <span class="muted">/ day</span></span>` : ""}
          <span>${avg ? `<span class="stars">★</span> <b>${avg}</b> <span class="muted">(${reviews.length} review${reviews.length > 1 ? "s" : ""})</span>` : `<span class="muted small">No reviews yet</span>`}</span></div>
        <div class="tagline">${(b.tags || []).map(t => `<span>#${esc(t)}</span>`).join("")}</div>
      </div>
      <div class="card pad stack"><h2>What's included</h2>
        ${items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Item</th><th>Details</th><th class="num">Per day</th></tr></thead><tbody>
          ${items.map(p => `<tr><td>${esc(p.name)}</td><td class="muted">${esc(p.description || "")}</td><td class="num">${p.dailyCharge != null ? money(p.dailyCharge) : ""}</td></tr>`).join("")}</tbody></table></div>`
          : `<p class="muted small">No items listed.</p>`}
      </div>
      <div class="card pad stack"><h2>Reviews</h2>
        ${reviews.length ? reviews.map(r => `<div class="inbox-item"><div class="row between"><b>${esc(r.userName || "Customer")}</b>
          <span class="stars">${"★".repeat(+r.rating || 0)}<span class="muted">${"★".repeat(Math.max(0, 5 - (+r.rating || 0)))}</span></span></div>
          <p>${esc(r.content || "")}</p>${r.dateEntered ? `<span class="small muted">${esc(r.dateEntered)}</span>` : ""}</div>`).join("") : `<p class="muted small">Be the first to review this bundle after your trip.</p>`}
        ${me ? `<form class="stack" id="review-form" style="border-top:1px solid var(--line);padding-top:14px">
          <h3>Write a review</h3>
          <p class="small muted">You can review a bundle after you've rented and returned it.</p>
          <label class="f">Rating<select class="in" name="rating" id="rv-rating">${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${n} star${n > 1 ? "s" : ""}</option>`).join("")}</select></label>
          <label class="f">Your review<textarea class="in" name="content" id="rv-text" rows="3" required maxlength="255" placeholder="How was the gear? Any tips for the next renter?"></textarea></label>
          <div data-msg hidden></div>
          <button class="btn btn-ghost" type="submit">Post review</button>
        </form>` : `<p class="small muted" style="border-top:1px solid var(--line);padding-top:14px"><button type="button" class="more" id="review-login">Log in</button> to review this bundle after your trip.</p>`}
      </div>
    </div>
    <div class="stack">
      <form class="card pad stack" id="avail-form">
        <h2>Check availability</h2>
        <div class="grid-2">
          <label class="f">Start date<input class="in" type="date" name="startDate" id="av-start" value="${start}" min="${today()}" required></label>
          <label class="f">End date<input class="in" type="date" name="endDate" id="av-end" value="${end}" min="${today()}" required></label>
        </div>
        <div data-msg hidden></div>
        <button class="btn btn-green btn-block" type="submit">See available sets</button>
      </form>
      <div id="sets"></div>
    </div>
  </div>`;

  linkDates($("#av-start"), $("#av-end"));
  if ($("#review-login")) $("#review-login").onclick = () => needLogin(() => viewBundle(id));
  onSubmit($("#review-form"), async d => {
    try {
      await API.postReview(me.userId, { bundleId: b.bundleId, rating: +d.rating, content: d.content.trim() });
    } catch (e) {
      // The server only takes reviews from customers who rented this bundle and returned the set.
      if (e.status === 403) throw new Error("You can review this bundle after you've rented it and returned the set to the store.");
      throw e;
    }
    toast("Review posted"); viewBundle(id);
  });
  onSubmit($("#avail-form"), async d => {
    if (d.endDate < d.startDate) throw new Error("The end date is before the start date.");
    const sets = await API.availableSets(b.bundleId, d.startDate, d.endDate);
    const box = $("#sets");
    if (!sets || !sets.length) { box.innerHTML = `<div class="card pad empty">No sets are free from ${esc(d.startDate)} to ${esc(d.endDate)}. Try other dates.</div>`; return; }
    const nDays = Math.max(1, Math.round((Date.parse(d.endDate) - Date.parse(d.startDate)) / 864e5));
    box.innerHTML = `<div class="card pad stack"><h3>${sets.length} set${sets.length > 1 ? "s" : ""} available</h3>
      ${sets.map((s, i) => `<div class="row between" style="border-top:${i ? "1px solid var(--line)" : "0"};padding-top:${i ? "12px" : "0"}">
        <div><b>${esc(setName(s.setId))}</b><br><span class="small muted">${s.dailyCharge != null ? `${money(s.dailyCharge)} × ${nDays} day${nDays > 1 ? "s" : ""}` : ""}${s.cleaningFee != null ? ` + ${money(s.cleaningFee)} cleaning fee` : ""}</span></div>
        <button type="button" class="btn btn-orange btn-sm" data-set="${esc(s.setId)}">${me ? "Reserve" : "Log in to reserve"}</button></div>`).join("")}
      <p class="small muted">You pay at the store when you return the set. Lost or damaged items are added to your invoice.</p>
      <div data-msg hidden id="res-msg"></div></div>`;
    box.onclick = e => {
      const btn = e.target.closest("[data-set]"); if (!btn) return;
      if (me) return reserve(btn);
      // Guests log in first, then the reservation goes ahead.
      needLogin(() => { box.querySelectorAll("[data-set]").forEach(x => { x.textContent = "Reserve"; }); reserve(btn); });
    };
    const reserve = async btn => {
      btn.disabled = true;
      try {
        const r = await API.reserve(me.userId, { setId: btn.dataset.set, startDate: d.startDate, endDate: d.endDate });
        const code = resCode(r.id);
        const noted = await sendCodeNote(r.id, `${b.name}, ${d.startDate} to ${d.endDate}`);
        box.innerHTML = `<div class="card pad stack" style="border:2px solid var(--green)">
          <p class="eyebrow">Reserved</p><h2>Reservation code <span class="code">${esc(code)}</span></h2>
          <p>${esc(b.name)}, ${esc(setName(btn.dataset.set))}<br>${esc(d.startDate)} to ${esc(d.endDate)}</p>
          <p class="small muted">Show this code at the store to pick up your gear. It's also under My reservations.</p>
          ${noted ? "" : `<p class="small muted">If the store can't find the code, show them the full number: ${esc(r.id)}</p>`}
          <div class="row"><button type="button" class="btn btn-quiet" id="copy-res">Copy code</button>
            <a class="btn btn-ghost" href="#reservations">View my reservations</a></div></div>`;
        $("#copy-res").onclick = () => navigator.clipboard.writeText(code)
          .then(() => toast("Reservation code copied"), () => toast("Couldn't copy. Write the code down instead."));
      } catch (err) { say($("#res-msg"), "err", err.message); btn.disabled = false; }
    };
  });
}

/* ---------- my reservations ---------- */
/* Send the store the note that links a short code to its reservation (see ResNote in common.js).
   Reservations noted from this browser are remembered so each note goes once. → true if it's noted. */
async function sendCodeNote(id, about) {
  const noted = new Set(store.get("codeNotes", []));
  if (noted.has(id)) return true;
  try { await API.messageStore(me.userId, ResNote.text(id, about)); } catch (e) { return false; }
  noted.add(id); store.set("codeNotes", [...noted]);
  return true;
}

async function viewReservations() {
  $("#app").innerHTML = `<h1 style="margin-bottom:6px">My reservations</h1>
    <p class="muted small" style="margin-bottom:18px">Show the code at the store to pick up your gear.</p><div id="rlist"><p class="muted">Loading…</p></div>`;
  try {
    // Invoices arrive as messages from the store (customers can't load them from the server directly).
    const [list, msgs] = await Promise.all([API.listReservations(me.userId), API.myMessages(me.userId).catch(() => [])]);
    const invoices = InvoiceNote.latest(msgs);
    $("#rlist").innerHTML = list && list.length ? `<div class="card pad tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Bundle</th><th>Set</th><th>Dates</th><th>Status</th><th>Invoice</th></tr></thead><tbody>
      ${list.map(r => { const code = resCode(r.reservationId), inv = invoices[code];
        return `<tr><td><b class="code" title="Full number: ${esc(r.reservationId)}">${esc(code)}</b></td><td>${esc(r.bundleName)}</td><td>${esc(setName(r.setId))}</td><td>${esc(r.startDate)} → ${esc(r.endDate)}</td><td>${statusPill(r.status)}</td>
          <td>${inv ? `<button type="button" class="btn btn-ghost btn-sm" data-inv="${esc(code)}" aria-expanded="false">${esc(inv.total || "View")} · View</button>`
            : `<span class="small muted">${String(r.status).toUpperCase() === "RETURNED" ? "On its way" : "After return"}</span>`}</td></tr>
          ${inv ? `<tr data-inv-row="${esc(code)}" hidden><td colspan="6"><div class="lines" style="max-width:440px">
            ${inv.lines.map(l => `<div><span>${esc(l.label)}</span><span>${esc(l.amount)}</span></div>`).join("")}
            <div class="total"><span>Total due</span><span class="price">${esc(inv.total || "")}</span></div>
            <div class="small muted"><span>Sent by the store on ${esc(inv.sentOn || "")}</span><span>Pay at the store</span></div></div></td></tr>` : ""}`; }).join("")}
      </tbody></table></div>` : `<div class="card empty stack"><p>No reservations yet.</p><div><a class="btn btn-green" href="#browse">Browse bundles</a></div></div>`;
    $("#rlist").onclick = e => {
      const b = e.target.closest("[data-inv]"); if (!b) return;
      const row = $(`[data-inv-row="${b.dataset.inv}"]`);
      row.hidden = !row.hidden; b.setAttribute("aria-expanded", String(!row.hidden));
    };
    // Reservations made before codes existed (or whose note didn't send) get their note now, in the background.
    (async () => { for (const r of list || []) await sendCodeNote(r.reservationId, `${r.bundleName}, ${r.startDate} to ${r.endDate}`); })();
  } catch (e) { $("#rlist").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
}

/* ---------- messages ---------- */
async function viewMessages() {
  $("#app").innerHTML = `<h1 style="margin-bottom:18px">Messages</h1>
  <div class="two-col">
    <form class="card pad stack" id="msg-form">
      <h2>Message the store</h2>
      <p class="small muted">Ask about sizing, dates or pickup. Staff reply here.</p>
      <label class="f">Message<textarea class="in" name="content" id="msg-text" rows="5" required maxlength="255"></textarea></label>
      <div data-msg hidden></div>
      <button class="btn btn-green" type="submit">Send to store</button>
    </form>
    <div class="card pad stack"><h2>Replies from the store</h2><div id="inbox"><p class="muted small">Loading…</p></div></div>
  </div>`;
  onSubmit($("#msg-form"), async (d, f) => { await API.messageStore(me.userId, d.content.trim()); f.reset(); return "Sent. The store will reply here."; });
  loadInbox();
}
/* Links in store messages become clickable. A link to one of our bundles (like a finished custom kit)
   becomes a button that opens it here. The text is escaped first, so a message can't inject HTML. */
function linkify(text) {
  return esc(text).replace(/https?:\/\/[^\s<]+/g, url => {
    const kit = url.match(/#bundle-([\w-]+)/);
    return kit ? `<a class="btn btn-orange btn-sm" href="#bundle-${kit[1]}">View and reserve your kit</a>`
      : `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
  });
}
async function loadInbox() {
  const box = $("#inbox");
  try {
    // An invoice can come in several parts; show it once, as a pointer to My reservations.
    const msgs = (await API.myMessages(me.userId) || []).filter(m => { const p = InvoiceNote.parse(m.content); return !p || p.part === 1; });
    // Invoices can't be deleted here, so My reservations can always show them.
    box.innerHTML = msgs && msgs.length ? msgs.map(m => { const inv = InvoiceNote.parse(m.content); return `<div class="inbox-item">
      <div class="row between"><b>${esc(m.senderName || "Store")}</b><span class="small muted">${esc(m.dateSent || "")}</span></div>
      <p>${inv ? `Your invoice for reservation <b class="code">${esc(inv.code)}</b> is ready. <a href="#reservations">See it under My reservations</a>` : linkify(m.content)}</p>
      ${inv ? "" : `<div><button type="button" class="btn btn-danger btn-sm" data-del="${esc(m.messageId)}">Delete</button></div>`}</div>`; }).join("")
      : `<p class="empty">No messages from the store yet.</p>`;
    box.onclick = async e => {
      const b = e.target.closest("[data-del]"); if (!b) return;
      b.disabled = true;
      try { await API.deleteMyMessage(me.userId, b.dataset.del); toast("Message deleted"); loadInbox(); }
      catch (err) { toast(err.message); b.disabled = false; }
    };
  } catch (e) { box.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
}

window.addEventListener("hashchange", route);
route();
