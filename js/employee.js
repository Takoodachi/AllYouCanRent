/* employee.js — check out and return sets, charges, invoices, store messages */

const APP = "employee";
const STAFF = ["employee", "manager"];
let me = Session.get(APP);

function route() {
  const h = location.hash.slice(1) || "today";
  scrollTo(0, 0);  // each tab starts at the top
  renderHeader("Employee", me ? [["today", "Today"], ["desk", "Rental desk"], ["messages", "Messages"], ["sets", "Add sets"]] : [], h, me,
    () => { Session.clear(APP); me = null; route(); });
  if (!me) return viewLogin();
  if (h === "desk") return viewDesk();
  if (h === "messages") return viewMessages();
  if (h === "sets") return viewSets();
  return viewToday();
}

function viewLogin() {
  $("#app").innerHTML = loginView("Staff log in",
    `<p class="small muted">Employee accounts are created by a manager in the <a href="manager.html">manager app</a>.</p>`);
  wireLogin(STAFF, APP, u => { me = u; toast("Logged in as " + u.userName); route(); });
}

/* ---------- today: the day's pickups, returns and reservations ---------- */
let dashDay = today(), openNext = null;  // openNext: a reservation the desk should open when it loads

async function viewToday() {
  const isToday = dashDay === today();
  const nice = new Date(dashDay + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  $("#app").innerHTML = `<div class="row between" style="margin-bottom:18px;align-items:end">
      <div><p class="eyebrow">${isToday ? "Today" : "Day view"}</p><h1>${esc(nice)}</h1></div>
      <div class="row"><input class="in" type="date" id="dash-day" value="${dashDay}" aria-label="Show another day" style="width:auto">
        ${isToday ? "" : `<button type="button" class="btn btn-quiet btn-sm" id="dash-today">Back to today</button>`}
        <button type="button" class="btn btn-quiet btn-sm" id="dash-refresh">Refresh</button></div>
    </div>
    <div id="dash"><p class="muted">Loading…</p></div>`;
  $("#dash-day").onchange = e => { dashDay = e.target.value || today(); viewToday(); };
  if ($("#dash-today")) $("#dash-today").onclick = () => { dashDay = today(); viewToday(); };
  $("#dash-refresh").onclick = viewToday;
  let all;
  try { all = await fetchReservations(); } catch (e) { $("#dash").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; return; }

  const day = dashDay;
  const pickups = all.filter(r => r.startDate === day && r.status === "RESERVED");
  const returns = all.filter(r => r.endDate === day && r.status === "CHECKED_OUT");
  const overdue = day >= today() ? all.filter(r => r.endDate < day && r.status === "CHECKED_OUT") : [];  // still out after their end date
  const onDay = all.filter(r => r.startDate <= day && day <= r.endDate);
  const section = (title, hint, list, action, empty) => `<div class="card pad stack">
      <div class="row between"><h2>${title} <span class="muted">(${list.length})</span></h2><span class="small muted">${hint}</span></div>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Customer</th><th>Bundle</th><th>Dates</th><th>Status</th><th></th></tr></thead><tbody>
        ${list.map(r => `<tr><td><b class="code">${esc(resCode(r.reservationId))}</b></td><td>${esc(r.userName)}</td><td>${esc(r.bundleName)}</td>
          <td class="small">${esc(r.startDate)} → ${esc(r.endDate)}</td><td>${statusPill(r.status)}</td>
          <td class="num"><div class="row" style="justify-content:flex-end;flex-wrap:nowrap">
            ${action ? `<button type="button" class="btn btn-green btn-sm" data-act="${action}" data-rid="${esc(r.reservationId)}">${action === "checkout" ? "Check out" : "Return"}</button>` : ""}
            <button type="button" class="btn btn-ghost btn-sm" data-act="open" data-rid="${esc(r.reservationId)}">Open</button></div></td></tr>`).join("")}
        </tbody></table></div>` : `<p class="empty">${empty}</p>`}</div>`;

  $("#dash").innerHTML = `<div class="stats" style="margin-bottom:18px">
      <div class="card stat"><span class="small muted">Pickups</span><b>${pickups.length}</b></div>
      <div class="card stat"><span class="small muted">Returns due</span><b>${returns.length}</b></div>
      <div class="card stat ${overdue.length ? "alert" : ""}"><span class="small muted">Overdue</span><b>${overdue.length}</b></div>
      <div class="card stat"><span class="small muted">Reservations ${isToday ? "today" : "this day"}</span><b>${onDay.length}</b></div>
    </div>
    <div class="stack">
      ${section("Pickups", "Starting this day, not collected yet", pickups, "checkout", "No pickups.")}
      ${section("Returns due", "Ending this day, still out", returns, "return", "No returns due.")}
      ${overdue.length ? section("Overdue", "Past their end date, still out", overdue, "return", "") : ""}
      ${section(`All reservations ${isToday ? "today" : "this day"}`, "Every reservation covering this day", onDay, "", "No reservations cover this day.")}
    </div>`;

  $("#dash").onclick = async e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const rid = b.dataset.rid;
    if (b.dataset.act === "open") { openNext = rid; location.hash = "desk"; return; }
    b.disabled = true;
    try {
      if (b.dataset.act === "checkout") { await API.checkout(me.userId, rid); toast(`Set ${resCode(rid)} checked out`); }
      else { await API.returnSet(me.userId, rid); toast(`Set ${resCode(rid)} returned. Add any charges on the desk.`); }
      viewToday();
    } catch (err) { toast(err.message); b.disabled = false; }
  };
}

/* ---------- rental desk ---------- */
let reservations = [], current = null, inbox = [];
const STATUS_ORDER = { CHECKED_OUT: 0, RESERVED: 1, RETURNED: 2 };  // sets that are out first, then pickups

async function viewDesk() {
  $("#app").innerHTML = `<h1 style="margin-bottom:6px">Rental desk</h1>
    <p class="muted" style="margin-bottom:18px">Pick a reservation to check the set out, take it back, record damage or losses, and send the invoice.</p>
    <div class="side-col">
      <div class="card pad stack">
        <form class="stack" id="lookup">
          <label class="f">Reservation code<span class="hint">The code the customer shows you, like B6C6-C579. The full number works too.</span>
            <input class="in code" name="rid" id="lookup-id" required autocomplete="off" placeholder="B6C6-C579"></label>
          <div data-msg hidden></div>
          <button class="btn btn-green btn-sm" type="submit">Open reservation</button>
        </form>
        <div class="row between"><h2>Reservations</h2><button type="button" class="btn btn-quiet btn-sm" id="refresh">Refresh</button></div>
        <input class="in" id="rfilter" placeholder="Filter by code, customer, bundle or status" aria-label="Filter reservations">
        <div id="rlist"><p class="muted small">Loading…</p></div>
      </div>
      <div id="desk"><div class="card pad empty">Select a reservation.</div></div>
    </div>`;
  $("#refresh").onclick = loadReservations;
  $("#rfilter").oninput = drawList;
  onSubmit($("#lookup"), async d => {
    // A code is matched against the list first, then against the code notes the shop sends the store.
    const key = d.rid.trim().toLowerCase().replace(/[\s-]/g, "");
    const listed = key.length >= 8 && reservations.find(r => r.reservationId.replace(/-/g, "").toLowerCase().startsWith(key));
    const id = listed ? listed.reservationId : ResNote.resolve(d.rid, inbox);
    if (!id) throw new Error(`No reservation found for "${d.rid.trim()}". Check the code with the customer.`);
    openReservation(id);
  });
  await loadReservations();
  if (openNext) { const id = openNext; openNext = null; await openReservation(id); }  // sent here from Today
}

/* The server only lists one user's reservations at a time, and staff have none. So the desk lists the
   reservations of every customer the store knows: anyone who has messaged the store, which includes
   the code note the shop sends whenever a customer reserves. Sets that are out first, then pickups. */
async function fetchReservations() {
  inbox = await API.storeInbox(me.userId) || [];
  const customers = [...new Set(inbox.filter(m => !m.fromStore).map(m => m.senderUserId || m.userId).filter(Boolean))];
  const lists = await Promise.all(customers.map(id =>
    API.listReservations(id).then(l => (l || []).map(r => ({ ...r, customerId: id })), () => [])));
  return lists.flat().sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
    || String(a.startDate).localeCompare(String(b.startDate)));
}
async function loadReservations() {
  try {
    reservations = await fetchReservations();
    drawList();
    if (current) await openReservation(current.reservationId);
  } catch (e) { $("#rlist").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
}
function drawList() {
  const f = ($("#rfilter")?.value || "").toLowerCase();
  const list = reservations.filter(r => !f || [resCode(r.reservationId), r.reservationId, r.userName, r.bundleName, r.status].join(" ").toLowerCase().includes(f));
  $("#rlist").innerHTML = list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Customer</th><th>Bundle</th><th>Dates</th><th>Status</th></tr></thead><tbody>
    ${list.map(r => `<tr data-rid="${esc(r.reservationId)}" style="cursor:pointer;${current && current.reservationId === r.reservationId ? "background:var(--green-soft)" : ""}">
      <td><b class="code">${esc(resCode(r.reservationId))}</b></td><td>${esc(r.userName)}</td><td>${esc(r.bundleName)}</td><td class="small">${esc(r.startDate)} → ${esc(r.endDate)}</td>
      <td>${statusPill(r.status)}</td></tr>`).join("")}</tbody></table></div>`
    : `<p class="empty">${reservations.length ? "No reservations match." : "No reservations yet. Customers' reservations show here once they reserve or message the store."}</p>`;
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

/* A reservation that isn't in the list (its customer hasn't messaged the store): the invoice names the
   customer, and that customer's reservation list gives the status. */
async function lookUp(id) {
  try {
    const inv = await API.invoice(me.userId, id);
    const theirs = await API.listReservations(inv.customerId).catch(() => []);
    const r = (theirs || []).find(x => x.reservationId === id) || {};
    return { reservationId: id, customerId: inv.customerId, userName: inv.customerName, bundleName: inv.bundleName,
      setId: inv.setId, startDate: inv.startDate, endDate: inv.endDate, ...r };
  } catch (e) { return { reservationId: id, noDetails: true }; }
}

const NEXT_STEP = {
  RESERVED: "Waiting for pickup. Check the set out when the customer collects it.",
  CHECKED_OUT: r => `Out with the customer, due back ${r.endDate}. Return the set when it comes back.`,
  RETURNED: "Back in the store. Add any repair charges or lost items, then send the invoice."
};

/* note: a short line shown at the top of the panel, like "Set checked out". */
async function openReservation(id, note = "") {
  current = reservations.find(r => String(r.reservationId) === String(id)) || await lookUp(id);
  drawList();
  const r = current, status = String(r.status || "").toUpperCase();
  // The staff invoice lists every charge so far (rental, cleaning, repairs, lost items), straight from the server.
  const [items, inv] = await Promise.all([findItems(r), API.invoice(me.userId, r.reservationId).catch(() => null)]);
  const charges = (inv && inv.charges) || [];
  const next = NEXT_STEP[status];
  const itemField = items && items.length
    ? `<select class="in" name="itemId" required>${items.map(i => `<option value="${esc(i.itemId)}">${esc(i.productName)} (worth ${money(i.depreciatedValue)} now)</option>`).join("")}</select>`
    : `<input class="in" name="itemId" required placeholder="Item id">`;

  $("#desk").innerHTML = `<div class="stack">
    <div class="card pad stack">
      ${note ? `<div class="msg ok">${esc(note)}</div>` : ""}
      <div class="row between"><h2>Reservation <span class="code">${esc(resCode(r.reservationId))}</span></h2>${statusPill(r.status)}</div>
      ${next ? `<p class="small">${esc(typeof next === "function" ? next(r) : next)}</p>` : ""}
      <p class="small muted">Full number: ${esc(r.reservationId)}</p>
      ${r.noDetails ? `<p class="small muted">Couldn't load details for this reservation. Check it matches the customer's.</p>` : ""}
      <div class="grid-2 small">
        <div><span class="muted">Customer</span><br><b>${esc(r.userName || "")}</b></div>
        <div><span class="muted">Bundle</span><br><b>${esc(r.bundleName || "")}</b>${r.setId ? `, ${esc(setName(r.setId))} <span class="muted">(${esc(r.setId)})</span>` : ""}</div>
        <div><span class="muted">Dates</span><br>${esc(r.startDate || "")} → ${esc(r.endDate || "")}</div>
      </div>
      <div class="row">
        <button type="button" class="btn btn-green" data-act="checkout" ${status && status !== "RESERVED" ? "disabled" : ""}>Check out set</button>
        <button type="button" class="btn btn-ghost" data-act="return" ${status && status !== "CHECKED_OUT" ? "disabled" : ""}>Return set</button>
      </div>
      <div data-msg hidden id="desk-msg"></div>
    </div>
    <div class="card pad stack">
      <h3>Charges so far</h3>
      ${inv ? `<div class="lines">${charges.map(c => `<div><span>${esc(chargeLabel(c))}</span><span>${money(c.amount)}</span></div>`).join("")}
        <div class="total"><span>Total so far</span><span class="price">${money(inv.total)}</span></div></div>
        <p class="small muted">From the store's system, so it's the same for every employee and after a refresh. The cleaning fee is added when the set is returned.</p>`
        : `<p class="small muted">Couldn't load the charges for this reservation.</p>`}
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
      <p class="small muted">Send it after the set is returned and all charges are in. The customer gets it in Messages and under My reservations.</p>
      <button type="button" class="btn btn-orange" data-act="invoice">Send invoice to customer</button>
      <div data-msg hidden id="invoice-msg"></div>
      <div id="invoice"></div>
    </div></div>`;

  $("#desk").onclick = async e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    b.disabled = true;
    try {
      if (b.dataset.act === "checkout") { await API.checkout(me.userId, r.reservationId); await reopen(r, "Set checked out."); }
      else if (b.dataset.act === "return") { await API.returnSet(me.userId, r.reservationId); await reopen(r, "Set returned. The cleaning fee is now on the bill."); }
      else { say($("#invoice-msg"), "ok", await sendInvoice(r)); b.disabled = false; }
    } catch (err) {
      say($(b.dataset.act === "invoice" ? "#invoice-msg" : "#desk-msg"), "err", err.message);
      b.disabled = false;
    }
  };
  onSubmit($("#charge-form"), async d => {
    const desc = d.description.trim(), amount = +d.amount;
    const same = charges.some(c => c.type === "REPAIR" && String(c.description).trim().toLowerCase() === desc.toLowerCase() && +c.amount === amount);
    if (same && !confirm(`"${desc}" for ${money(amount)} is already on this reservation. Add it again?`)) return;
    await API.addCharge(me.userId, { reservationId: r.reservationId, description: desc, amount });
    await reopen(r, `Added ${money(amount)} repair charge.`);
  });
  onSubmit($("#lost-form"), async d => {
    await API.reportLost(me.userId, { reservationId: r.reservationId, itemId: d.itemId.trim() });
    await reopen(r, "Lost item recorded.");
  });
}
/* After a change: reload the list (statuses) and redraw this reservation with a note. */
async function reopen(r, note) {
  const keep = current; current = null;
  await loadReservations();
  current = keep;
  toast(note);
  await openReservation(r.reservationId, note);
}

/* Shows the invoice and sends it to the customer as a message, unless they already have this exact one. */
async function sendInvoice(r) {
  const inv = await API.invoice(me.userId, r.reservationId);
  showInvoice(inv);
  const code = resCode(r.reservationId), customerId = inv.customerId || r.customerId;
  const had = InvoiceNote.latest(await API.myMessages(customerId).catch(() => []))[code];
  const now = { lines: (inv.charges || []).map(c => ({ label: chargeLabel(c), amount: money(c.amount) })), total: money(inv.total) };
  if (had && had.total === now.total && JSON.stringify(had.lines) === JSON.stringify(now.lines))
    return `${inv.customerName || "The customer"} already has this invoice. They can see it under My reservations.`;
  for (const text of InvoiceNote.messages(inv, code)) await API.messageCustomer(me.userId, customerId, text);
  return `Invoice sent to ${inv.customerName || "the customer"}. They can see it in Messages and under My reservations.`;
}
function showInvoice(inv) {
  $("#invoice").innerHTML = `<div class="lines" style="margin-top:6px">
    <div class="small muted"><span>Customer</span><span>${esc(inv.customerName || "")}</span></div>
    <div class="small muted"><span>Bundle</span><span>${esc(inv.bundleName || "")}${inv.setId ? ", " + esc(setName(inv.setId)) : ""}</span></div>
    <div class="small muted"><span>Dates</span><span>${esc(inv.startDate || "")} → ${esc(inv.endDate || "")}</span></div>
    ${(inv.charges || []).map(c => `<div><span>${esc(chargeLabel(c))}</span><span>${money(c.amount)}</span></div>`).join("")}
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
      <label class="f">Message<textarea class="in" name="content" id="send-text" rows="5" required maxlength="255"></textarea></label>
      <div data-msg hidden></div>
      <button class="btn btn-green" type="submit">Send</button>
    </form></div>`;
  onSubmit($("#send-form"), async (d, f) => { await API.messageCustomer(me.userId, d.to.trim(), d.content.trim()); f.reset(); return "Sent."; });
  const box = $("#inbox");
  try {
    // Reservation code notes are for the desk's lookup, not for reading, so they're left out here.
    const msgs = (await API.storeInbox(me.userId) || []).filter(m => !ResNote.parse(m.content));
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
  onSubmit($("#set-form"), async d => { const s = await API.createSet(me.userId, { bundleId: d.bundleId, cleaningFee: +d.cleaningFee }); return `${setName(s.id)} created (id ${s.id}).`; });
}

window.addEventListener("hashchange", route);
route();
