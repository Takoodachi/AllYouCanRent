/* customer.js — sign up, browse bundles, reserve, review, message the store */

const APP = "customer";
let me = Session.get(APP);
let state = { tag: "" };

function route() {
  const h = location.hash.slice(1) || "browse";
  const links = [["browse", "Browse bundles"], ["reservations", "My reservations"], ["messages", "Messages"]];
  renderHeader("Customer", links, h.split("-")[0], me, () => { Session.clear(APP); me = null; location.hash = "login"; route(); });

  if (!me && h !== "signup") return viewLogin();
  if (h === "signup") return viewSignup();
  if (h.startsWith("bundle-")) return viewBundle(decodeURIComponent(h.slice(7)));
  if (h === "reservations") return viewReservations();
  if (h === "messages") return viewMessages();
  return viewBrowse();
}

/* ---------- account ---------- */
function viewLogin() {
  $("#app").innerHTML = loginView("Log in to rent gear",
    `<p class="small muted">New to All you can rent? <a href="#signup">Create an account</a></p>`);
  wireLogin(["customer"], APP, u => { me = u; toast("Welcome, " + u.userName); location.hash = "browse"; route(); });
}
function viewSignup() {
  $("#app").innerHTML = `<div class="auth card pad stack">
    <h2>Create your account</h2>
    <form class="stack" id="signup-form">
      <label class="f">User name<input class="in" name="userName" id="su-user" required autocomplete="username"></label>
      <label class="f">Full name<input class="in" name="realName" id="su-name" required autocomplete="name"></label>
      <label class="f">Phone number<input class="in" name="phoneNumber" id="su-phone" type="tel" required autocomplete="tel" placeholder="920-555-0123"></label>
      <label class="f">Password<input class="in" name="password" id="su-pass" type="password" minlength="6" required autocomplete="new-password"></label>
      <div data-msg hidden></div>
      <button class="btn btn-green btn-block" type="submit">Sign up</button>
    </form>
    <p class="small muted">Already have an account? <a href="#login">Log in</a></p></div>`;
  onSubmit($("#signup-form"), async d => {
    const res = await API.createCustomer(d);
    me = { userId: String(res.id), userName: d.userName, role: "customer" };
    Session.set(APP, me); toast("Account created"); location.hash = "browse"; route();
  });
}

/* ---------- browse ---------- */
async function viewBrowse() {
  $("#app").innerHTML = `<div class="stack" style="margin-bottom:20px">
      <p class="eyebrow">Hi ${esc(me.userName)}</p>
      <h1>Browse bundles</h1>
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
    $("#list").innerHTML = `<div class="cards">${full.map(b => {
      const n = (b.reviews || []).length, avg = n ? (b.reviews.reduce((s, r) => s + (+r.rating || 0), 0) / n).toFixed(1) : null;
      return `<a class="card bcard" href="#bundle-${encodeURIComponent(b.bundleId)}"><div class="art">${bundleImage(b, b.bundleId)}</div><div class="body">
        <h3>${esc(b.name)}</h3>
        <div class="tagline">${(b.tags || []).map(t => `<span>#${esc(t)}</span>`).join("")}</div>
        <p class="small muted">${(b.products || []).map(p => esc(p.name)).join(" · ")}</p>
        <div class="row between" style="margin-top:auto">${b.dailyCharge != null ? `<span><span class="price">${money(b.dailyCharge)}</span><span class="small muted"> / day</span></span>` : "<span></span>"}
        <span class="small">${avg ? `<span class="stars">★</span> ${avg} <span class="muted">(${n})</span>` : `<span class="muted">No reviews yet</span>`}</span></div></div></a>`;
    }).join("")}</div>`;
  } catch (e) { $("#list").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
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
        <form class="stack" id="review-form" style="border-top:1px solid var(--line);padding-top:14px">
          <h3>Write a review</h3>
          <p class="small muted">You can review a bundle after you've rented and returned it.</p>
          <label class="f">Rating<select class="in" name="rating" id="rv-rating">${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${n} star${n > 1 ? "s" : ""}</option>`).join("")}</select></label>
          <label class="f">Your review<textarea class="in" name="content" id="rv-text" rows="3" required placeholder="How was the gear? Any tips for the next renter?"></textarea></label>
          <div data-msg hidden></div>
          <button class="btn btn-ghost" type="submit">Post review</button>
        </form>
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

  onSubmit($("#review-form"), async d => {
    try {
      await API.postReview(me.userId, { bundleId: b.bundleId, rating: +d.rating, content: d.content.trim() });
    } catch (err) {
      if (err.status === 403) throw new Error("You can review this bundle after you've rented and returned it.");
      throw err;
    }
    toast("Review posted"); viewBundle(id);
  });
  onSubmit($("#avail-form"), async d => {
    if (d.endDate < d.startDate) throw new Error("The end date is before the start date.");
    const sets = await API.availableSets(b.bundleId, d.startDate, d.endDate);
    const box = $("#sets");
    if (!sets || !sets.length) { box.innerHTML = `<div class="card pad empty">No sets are free from ${esc(d.startDate)} to ${esc(d.endDate)}. Try other dates.</div>`; return; }
    const nDays = Math.max(1, Math.round((Date.parse(d.endDate) - Date.parse(d.startDate)) / 864e5));
    const letters = await API.setLetters(b.bundleId);
    box.innerHTML = `<div class="card pad stack"><h3>${sets.length} set${sets.length > 1 ? "s" : ""} available</h3>
      ${sets.map((s, i) => `<div class="row between" style="border-top:${i ? "1px solid var(--line)" : "0"};padding-top:${i ? "12px" : "0"}">
        <div><b>${setLabel(s.setId, letters.get(String(s.setId)))}</b><br><span class="small muted">${s.dailyCharge != null ? `${money(s.dailyCharge)} × ${nDays} day${nDays > 1 ? "s" : ""}` : ""}${s.cleaningFee != null ? ` + ${money(s.cleaningFee)} cleaning fee` : ""}</span></div>
        <button type="button" class="btn btn-orange btn-sm" data-set="${esc(s.setId)}">Reserve</button></div>`).join("")}
      <p class="small muted">You pay at the store when you return the set. Lost or damaged items are added to your invoice.</p>
      <div data-msg hidden id="res-msg"></div></div>`;
    box.onclick = async e => {
      const btn = e.target.closest("[data-set]"); if (!btn) return;
      btn.disabled = true;
      try {
        const r = await API.reserve(me.userId, { setId: btn.dataset.set, startDate: d.startDate, endDate: d.endDate });
        box.innerHTML = `<div class="card pad stack" style="border:2px solid var(--green)">
          <p class="eyebrow">Reserved</p><h2>Reservation ${idTag(r.id)}</h2>
          <p>${setName(b.name, btn.dataset.set, letters.get(btn.dataset.set))}<br>${esc(d.startDate)} to ${esc(d.endDate)}</p>
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
    const letters = await Promise.all((list || []).map(r => API.setLetter(r.bundleName, r.setId)));
    $("#rlist").innerHTML = list && list.length ? `<div class="card pad tbl-wrap"><table class="tbl"><thead><tr><th>Reservation</th><th>Bundle</th><th>Set</th><th>Dates</th><th>Status</th></tr></thead><tbody>
      ${list.map((r, i) => `<tr><td><b>${idTag(r.reservationId)}</b></td><td>${esc(r.bundleName)}</td><td>${setLabel(r.setId, letters[i])}</td><td>${esc(r.startDate)} → ${esc(r.endDate)}</td><td><span class="pill">${esc(r.status)}</span></td></tr>`).join("")}
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
