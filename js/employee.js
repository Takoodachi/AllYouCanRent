/* employee.js — check out and return sets, charges, invoices, store messages */

const APP = "employee";
const STAFF = ["employee", "manager"];
let me = Session.get(APP);

function route() {
  const h = location.hash.slice(1) || "desk";
  renderHeader("Employee", [["desk", "Rental desk"], ["messages", "Messages"], ["sets", "Add sets"]], h, me,
    () => { Session.clear(APP); me = null; route(); });
  if (!me) return viewLogin();
  if (h === "messages") return viewMessages();
  if (h === "sets") return viewSets();
  return viewDesk();
}

function viewLogin() {
  $("#app").innerHTML = loginView("Staff log in",
    `<p class="small muted">Employee accounts are created by a manager in the <a href="manager.html">manager app</a>.</p>`);
  wireLogin(STAFF, APP, u => { me = u; toast("Logged in as " + u.userName); route(); });
}

/* ---------- rental desk ---------- */
let reservations = [], current = null;
const PILL = s => { const v = String(s || "").toLowerCase(); return v.includes("return") || v.includes("invoice") ? "" : v.includes("out") ? "warn" : "warn"; };

async function viewDesk() {
  $("#app").innerHTML = `<h1 style="margin-bottom:6px">Rental desk</h1>
    <p class="muted" style="margin-bottom:18px">Pick a reservation to check the set out, take it back, record damage or losses, and generate the invoice.</p>
    <div class="side-col">
      <div class="card pad stack">
        <div class="row between"><h2>Reservations</h2><button type="button" class="btn btn-quiet btn-sm" id="refresh">Refresh</button></div>
        <input class="in" id="rfilter" placeholder="Filter by number, customer or bundle" aria-label="Filter reservations">
        <div id="rlist"><p class="muted small">Loading…</p></div>
      </div>
      <div id="desk"><div class="card pad empty">Select a reservation.</div></div>
    </div>`;
  $("#refresh").onclick = loadReservations;
  $("#rfilter").oninput = drawList;
  await loadReservations();
}
async function loadReservations() {
  try { reservations = await API.listReservations(me.userId) || []; drawList(); if (current) openReservation(current.reservationId); }
  catch (e) { $("#rlist").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
}
function drawList() {
  const f = ($("#rfilter")?.value || "").toLowerCase();
  const list = reservations.filter(r => !f || [r.reservationId, r.userName, r.bundleName].join(" ").toLowerCase().includes(f));
  $("#rlist").innerHTML = list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>No.</th><th>Customer</th><th>Bundle</th><th>Dates</th><th>Status</th></tr></thead><tbody>
    ${list.map(r => `<tr data-rid="${esc(r.reservationId)}" style="cursor:pointer;${current && current.reservationId === r.reservationId ? "background:var(--green-soft)" : ""}">
      <td><b>${idTag(r.reservationId)}</b></td><td>${esc(r.userName)}</td><td>${esc(r.bundleName)}</td><td class="small">${esc(r.startDate)} → ${esc(r.endDate)}</td>
      <td><span class="pill ${PILL(r.status)}">${esc(r.status)}</span></td></tr>`).join("")}</tbody></table></div>`
    : `<p class="empty">${reservations.length ? "No reservations match." : "No reservations yet."}</p>`;
  $("#rlist").onclick = e => { const tr = e.target.closest("[data-rid]"); if (tr) openReservation(tr.dataset.rid); };
}

/* Items in the reservation's set, found through /sets/available once the set is back in stock. */
async function findItems(r) {
  try {
    const bundles = await API.listBundles();
    const b = bundles.find(x => x.name === r.bundleName); if (!b) return null;
    const sets = await API.availableSets(b.bundleId, r.startDate, r.endDate);
    const s = (sets || []).find(x => String(x.setId) === String(r.setId));
    return s ? s.items : null;
  } catch (e) { return null; }
}

async function openReservation(id) {
  current = reservations.find(r => String(r.reservationId) === String(id)) || { reservationId: id };
  drawList();
  const r = current;
  const st = String(r.status || "").toLowerCase();
  const [items, letter] = await Promise.all([findItems(r), API.setLetter(r.bundleName, r.setId)]);
  const itemField = items && items.length
    ? `<select class="in" name="itemId" required>${items.map(i => `<option value="${esc(i.itemId)}">${esc(i.productName)} (worth ${money(i.depreciatedValue)} now)</option>`).join("")}</select>`
    : `<input class="in" name="itemId" required placeholder="Item id">`;

  $("#desk").innerHTML = `<div class="stack">
    <div class="card pad stack">
      <div class="row between"><h2>Reservation ${idTag(r.reservationId)}</h2>${r.status ? `<span class="pill ${PILL(r.status)}">${esc(r.status)}</span>` : ""}</div>
      <div class="grid-2 small">
        <div><span class="muted">Customer</span><br><b>${esc(r.userName || "")}</b></div>
        <div><span class="muted">Set</span><br><b>${setName(r.bundleName, r.setId, letter)}</b></div>
        <div><span class="muted">Dates</span><br>${esc(r.startDate || "")} → ${esc(r.endDate || "")}</div>
      </div>
      <div class="row">
        <button type="button" class="btn btn-green" data-act="checkout">Check out set</button>
        <button type="button" class="btn btn-ghost" data-act="return">Return set</button>
      </div>
      <div data-msg hidden id="desk-msg"></div>
    </div>
    <form class="card pad stack" id="charge-form">
      <h3>Repair charge</h3>
      <p class="small muted">For a damaged item that can be fixed.</p>
      <label class="f">What's damaged<input class="in" name="description" required placeholder="e.g. torn tent rain fly"></label>
      <label class="f">Repair cost ($)<input class="in" name="amount" type="number" min="0.01" step="0.01" required></label>
      <div data-msg hidden></div>
      <button class="btn btn-quiet" type="submit">Add charge</button>
    </form>
    <form class="card pad stack" id="lost-form">
      <h3>Lost item</h3>
      <p class="small muted">The customer is charged the item's remaining value.${items ? "" : " The item list shows once the set is returned."}</p>
      <label class="f">Item${itemField}</label>
      <div data-msg hidden></div>
      <button class="btn btn-danger" type="submit">Report lost</button>
    </form>
    <div class="card pad stack">
      <h3>Invoice</h3>
      <p class="small muted">Generate it after the set is returned and charges are entered. The customer pays this total.</p>
      <button type="button" class="btn btn-orange" data-act="invoice">Generate invoice</button>
      <div id="invoice"></div>
    </div></div>`;

  $("#desk").onclick = async e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    b.disabled = true;
    try {
      if (b.dataset.act === "checkout") { await API.checkout(me.userId, r.reservationId); toast("Set checked out"); await loadReservations(); }
      else if (b.dataset.act === "return") { await API.returnSet(me.userId, r.reservationId); toast("Set returned"); await loadReservations(); }
      else { await showInvoice(await API.invoice(me.userId, r.reservationId)); b.disabled = false; }
    } catch (err) {
      if (b.dataset.act === "invoice") $("#invoice").innerHTML = `<div class="msg err">${esc(err.message)}</div>`; else say($("#desk-msg"), "err", err.message);
      b.disabled = false;
    }
  };
  onSubmit($("#charge-form"), async (d, f) => {
    await API.addCharge(me.userId, { reservationId: r.reservationId, description: d.description.trim(), amount: +d.amount });
    f.reset(); return `Added ${money(d.amount)} repair charge.`;
  });
  onSubmit($("#lost-form"), async d => {
    await API.reportLost(me.userId, { reservationId: r.reservationId, itemId: d.itemId.trim() });
    return "Lost item recorded. It will show on the invoice.";
  });
}
async function showInvoice(inv) {
  const letter = await API.setLetter(inv.bundleName, inv.setId);
  $("#invoice").innerHTML = `<div class="lines" style="margin-top:6px">
    <div class="small muted"><span>Customer</span><span>${esc(inv.customerName || "")}</span></div>
    <div class="small muted"><span>Set</span><span>${setName(inv.bundleName, inv.setId, letter)}</span></div>
    <div class="small muted"><span>Dates</span><span>${esc(inv.startDate || "")} → ${esc(inv.endDate || "")}</span></div>
    ${(inv.charges || []).map(c => `<div><span>${esc(c.description || c.type)}</span><span>${money(c.amount)}</span></div>`).join("")}
    <div class="total"><span>Total due</span><span class="price">${money(inv.total)}</span></div></div>`;
}

/* ---------- messages ---------- */
async function viewMessages() {
  $("#app").innerHTML = `<h1 style="margin-bottom:18px">Messages to the store</h1>
    <div class="side-col"><div class="card pad"><div id="inbox"><p class="muted small">Loading…</p></div></div>
    <form class="card pad stack" id="send-form">
      <h2>Message a customer</h2>
      <p class="small muted">Click Reply on a message to fill in the customer.</p>
      <label class="f">Customer user id<input class="in" name="to" id="send-to" required></label>
      <label class="f">Message<textarea class="in" name="content" id="send-text" rows="5" required></textarea></label>
      <div data-msg hidden></div>
      <button class="btn btn-green" type="submit">Send</button>
    </form></div>`;
  onSubmit($("#send-form"), async (d, f) => { await API.messageCustomer(me.userId, d.to.trim(), d.content.trim()); f.reset(); return "Sent."; });
  const box = $("#inbox");
  try {
    const msgs = await API.storeInbox(me.userId);
    box.innerHTML = msgs && msgs.length ? msgs.map(m => `<div class="inbox-item">
      <div class="row between"><b>${esc(m.senderName || m.userName || "Customer")}</b><span class="small muted">${esc(m.dateSent || "")}</span></div>
      <p>${esc(m.content)}</p>
      <div class="row"><button type="button" class="btn btn-ghost btn-sm" data-reply="${esc(m.senderUserId || m.userId)}">Reply</button><button type="button" class="btn btn-danger btn-sm" data-del="${esc(m.messageId)}">Delete</button></div></div>`).join("")
      : `<p class="empty">No customer messages.</p>`;
    box.onclick = async e => {
      const r = e.target.closest("[data-reply]"), dl = e.target.closest("[data-del]");
      if (r) { $("#send-to").value = r.dataset.reply; $("#send-text").focus(); }
      if (dl) { dl.disabled = true; try { await API.deleteStoreMessage(me.userId, dl.dataset.del); toast("Message deleted"); viewMessages(); } catch (err) { toast(err.message); dl.disabled = false; } }
    };
  } catch (e) { box.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
}

/* ---------- sets ---------- */
async function viewSets() {
  $("#app").innerHTML = `<div style="max-width:560px;margin:0 auto"><form class="card pad stack" id="set-form">
    <h1>Add a set</h1>
    <p class="muted small">A set is one rentable copy of a bundle. All its items start new.</p>
    <label class="f">Bundle<select class="in" name="bundleId" id="set-bundle" required><option value="">Loading…</option></select></label>
    <label class="f">Cleaning fee ($)<span class="hint">Charged when the set comes back</span><input class="in" name="cleaningFee" type="number" min="0" step="0.01" value="10" required></label>
    <div data-msg hidden></div>
    <button class="btn btn-green" type="submit">Create set</button></form></div>`;
  try {
    const bs = await API.listBundles();
    $("#set-bundle").innerHTML = bs.length ? bs.map(b => `<option value="${esc(b.bundleId)}">${esc(b.name)}</option>`).join("") : `<option value="">No bundles yet</option>`;
  } catch (e) { say($("#set-form [data-msg]"), "err", e.message); }
  onSubmit($("#set-form"), async d => {
    const s = await API.createSet(me.userId, { bundleId: d.bundleId, cleaningFee: +d.cleaningFee });
    const letter = (await API.setLetters(d.bundleId)).get(String(s.id));
    return `Created ${$("#set-bundle").selectedOptions[0].text}, Set ${letter || shortId(s.id)}.`;
  });
}

window.addEventListener("hashchange", route);
route();
