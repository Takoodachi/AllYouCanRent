/* customer.js — browse bundles, reserve, review, message the store.
   Anyone can browse. A log-in pop-up opens only for things that need an account. */

const APP = "customer";
let me = Session.get(APP);
let state = { tag: "" };

function drawHeader(h) {
  const links = me ? [["browse", "Browse bundles"], ["reservations", "My reservations"], ["messages", "Messages"]] : [["browse", "Browse bundles"]];
  renderHeader("Customer", links, h.split("-")[0], me, () => { Session.clear(APP); me = null; go("browse"); });
  if (!me) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = "Log in"; b.onclick = () => needLogin(route);
    $("#header nav.main").appendChild(b);
  }
}
function route() {
  const h = location.hash.slice(1) || "browse";
  drawHeader(h);
  if (h.startsWith("bundle-")) return viewBundle(decodeURIComponent(h.slice(7)));
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
    // Runs on every close (after logging in, the X button, or Esc): carry on, or back out.
    dlg.addEventListener("close", () => {
      const p = pending; pending = null;
      const next = p && (me ? p.done : p.cancel);
      if (next) next();
    });
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
}
function showSignup() {
  authDialog().innerHTML = CLOSE_X + `<div class="auth card pad stack">
    <h2>Create your account</h2>
    <form class="stack" id="signup-form">
      <label class="f">User name<input class="in" name="userName" id="su-user" required autocomplete="username"></label>
      <label class="f">Full name<input class="in" name="realName" id="su-name" required autocomplete="name"></label>
      <label class="f">Phone number<input class="in" name="phoneNumber" id="su-phone" type="tel" required autocomplete="tel" placeholder="920-555-0123"></label>
      <label class="f">Password<input class="in" name="password" id="su-pass" type="password" minlength="6" required autocomplete="new-password"></label>
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
async function viewBrowse() {
  $("#app").innerHTML = `<div class="stack" style="margin-bottom:20px">
      <p class="eyebrow">${me ? `Hi ${esc(me.userName)}` : "Outdoor gear rental"}</p>
      <h1>Browse bundles</h1>
      <input class="in" type="search" id="search" value="${esc(state.q || "")}" aria-label="Search bundles"
        placeholder="Search bundles, gear or activities">
      <div class="row" id="tags"><span class="muted small">Loading tags…</span></div>
    </div>
    <div id="list"><p class="muted">Loading bundles…</p></div>`;
  try {
    const tags = await API.listTags();
    $("#tags").innerHTML = [`<button type="button" class="chip ${state.tag ? "" : "on"}" data-tag="">All</button>`]
      .concat((tags || []).map(t => `<button type="button" class="chip ${state.tag === t ? "on" : ""}" data-tag="${esc(t)}">#${esc(t)}</button>`)).join("");
    $("#tags").onclick = e => { const b = e.target.closest("[data-tag]"); if (b) { state.tag = b.dataset.tag; viewBrowse(); } };
  } catch (e) { $("#tags").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
  try {
    const list = await API.listBundles(state.tag);
    if (!list || !list.length) { $("#list").innerHTML = `<div class="card empty">No bundles${state.tag ? " with #" + esc(state.tag) : ""} yet.</div>`; return; }
    // The list only has ids and names, so load each bundle's details for the cards.
    const full = await Promise.all(list.map(b => API.getBundle(b.bundleId).catch(() => b)));
    // Search runs on the loaded bundles: every word must appear in the name, a tag or an item.
    const draw = () => {
      state.q = $("#search").value;
      const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      const shown = full.filter(b => {
        const text = [b.name, ...(b.tags || []), ...(b.products || []).map(p => p.name)].join(" ").toLowerCase();
        return words.every(w => text.includes(w));
      });
      $("#list").innerHTML = shown.length ? `<div class="cards">${shown.map(bundleCard).join("")}</div>`
        : `<div class="card empty">No bundles match “${esc(state.q)}”${state.tag ? " in #" + esc(state.tag) : ""}.</div>`;
    };
    $("#search").oninput = draw;
    draw();
    $("#list").onclick = e => {
      const btn = e.target.closest("[data-more]"); if (!btn) return;
      const open = btn.textContent === "See more";
      btn.previousElementSibling.hidden = !open; btn.previousElementSibling.previousElementSibling.hidden = open;
      btn.textContent = open ? "See less" : "See more";
    };
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

/* ---------- side ads for popular bundles (shown on wide screens) ---------- */
const ADS = [
  { name: "Weekend Camping for Two", badge: "Most rented", line: "Tent, sleeping bags and a stove. Just bring the marshmallows." },
  { name: "Kayak Day Trip", badge: "Summer favorite", line: "On the water by lunch: kayak, paddle, life jacket and dry bag." },
  { name: "Ski Day", badge: "Skip the rental line", line: "Skis, boots, poles and a helmet, ready the night before." },
  { name: "Family Car Camping", badge: "Families love it", line: "A 6-person tent, beds for four and chairs around the fire." }
];
async function renderAds() {
  const left = $("#ads-left"), right = $("#ads-right");
  if (!left || !right) return;
  try {
    const list = await API.listBundles();
    const ads = (await Promise.all(ADS.map(async a => {
      const b = list.find(x => x.name === a.name);
      return b ? { ...a, ...(await API.getBundle(b.bundleId)) } : null;
    }))).filter(Boolean);
    const ad = a => `<a class="ad" href="#bundle-${encodeURIComponent(a.bundleId)}">
      <div class="art">${bundleImage(a, a.bundleId)}</div>
      <div class="body"><span class="ad-label">Ad</span><span class="badge">${esc(a.badge)}</span>
        <h3>${esc(a.name)}</h3><p class="small muted">${esc(a.line)}</p>
        <span><span class="price">${money(a.dailyCharge)}</span><span class="small muted"> / day</span></span>
        <span class="btn btn-orange btn-sm">Rent it</span></div></a>`;
    left.innerHTML = ads.slice(0, 2).map(ad).join("");
    right.innerHTML = ads.slice(2, 4).map(ad).join("");
  } catch (e) { /* ads are extra; the shop works without them */ }
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

/* ---------- bundle details, availability, reserve, review ---------- */
async function viewBundle(id) {
  $("#app").innerHTML = `<p class="muted">Loading bundle…</p>`;
  let b;
  try { b = await API.getBundle(id); } catch (e) { $("#app").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; return; }
  const items = b.products || [], reviews = b.reviews || [];
  const avg = reviews.length ? (reviews.reduce((s, r) => s + (+r.rating || 0), 0) / reviews.length).toFixed(1) : null;
  const start = addDays(today(), 7), end = addDays(today(), 9);

  $("#app").innerHTML = `<a href="#browse" class="small">← Back to bundles</a>
  <div class="side-col" style="margin-top:12px">
    <div class="stack">
      <div class="art-lg">${bundleImage(b, b.bundleId)}</div>
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
          <label class="f">Your review<textarea class="in" name="content" id="rv-text" rows="3" required placeholder="How was the gear? Any tips for the next renter?"></textarea></label>
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
        box.innerHTML = `<div class="card pad stack" style="border:2px solid var(--green)">
          <p class="eyebrow">Reserved</p><h2>Reservation ${esc(r.id)}</h2>
          <p>${esc(b.name)}, ${esc(setName(btn.dataset.set))}<br>${esc(d.startDate)} to ${esc(d.endDate)}</p>
          <p class="small muted">Show this reservation number at the store to pick up your gear.</p>
          <a class="btn btn-ghost" href="#reservations">View my reservations</a></div>`;
      } catch (err) { say($("#res-msg"), "err", err.message); btn.disabled = false; }
    };
  });
}

/* ---------- my reservations ---------- */
async function viewReservations() {
  $("#app").innerHTML = `<h1 style="margin-bottom:6px">My reservations</h1>
    <p class="muted small" style="margin-bottom:18px">Bring the reservation number to the store to pick up your gear.</p><div id="rlist"><p class="muted">Loading…</p></div>`;
  try {
    const list = await API.listReservations(me.userId);
    $("#rlist").innerHTML = list && list.length ? `<div class="card pad tbl-wrap"><table class="tbl"><thead><tr><th>Reservation</th><th>Bundle</th><th>Set</th><th>Dates</th><th>Status</th></tr></thead><tbody>
      ${list.map(r => `<tr><td><b>${esc(r.reservationId)}</b></td><td>${esc(r.bundleName)}</td><td>${esc(setName(r.setId))}</td><td>${esc(r.startDate)} → ${esc(r.endDate)}</td><td><span class="pill">${esc(r.status)}</span></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="card empty stack"><p>No reservations yet.</p><div><a class="btn btn-green" href="#browse">Browse bundles</a></div></div>`;
  } catch (e) { $("#rlist").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
}

/* ---------- messages ---------- */
async function viewMessages() {
  $("#app").innerHTML = `<h1 style="margin-bottom:18px">Messages</h1>
  <div class="two-col">
    <form class="card pad stack" id="msg-form">
      <h2>Message the store</h2>
      <p class="small muted">Ask about sizing, dates or pickup. Staff reply here.</p>
      <label class="f">Message<textarea class="in" name="content" id="msg-text" rows="5" required></textarea></label>
      <div data-msg hidden></div>
      <button class="btn btn-green" type="submit">Send to store</button>
    </form>
    <div class="card pad stack"><h2>Replies from the store</h2><div id="inbox"><p class="muted small">Loading…</p></div></div>
  </div>`;
  onSubmit($("#msg-form"), async (d, f) => { await API.messageStore(me.userId, d.content.trim()); f.reset(); return "Sent. The store will reply here."; });
  loadInbox();
}
async function loadInbox() {
  const box = $("#inbox");
  try {
    const msgs = await API.myMessages(me.userId);
    box.innerHTML = msgs && msgs.length ? msgs.map(m => `<div class="inbox-item">
      <div class="row between"><b>${esc(m.senderName || "Store")}</b><span class="small muted">${esc(m.dateSent || "")}</span></div>
      <p>${esc(m.content)}</p>
      <div><button type="button" class="btn btn-danger btn-sm" data-del="${esc(m.messageId)}">Delete</button></div></div>`).join("")
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
renderAds();
