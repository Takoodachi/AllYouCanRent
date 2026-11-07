/* manager.js — create managers and employees, products, bundles and sets */

const APP = "manager";
let me = Session.get(APP);

function route() {
  const h = location.hash.slice(1) || "products";
  renderHeader("Manager", me ? [["products", "Products"], ["bundles", "Bundles"], ["sets", "Sets"], ["requests", "Kit requests"], ["staff", "Staff accounts"]] : [], h, me,
    () => { Session.clear(APP); me = null; location.hash = ""; route(); });
  if (!me) return h === "new-manager" ? viewNewManager() : viewLogin();
  if (h === "bundles") return viewBundles();
  if (h === "sets") return viewSets();
  if (h === "requests") return viewRequests();
  if (h === "staff") return viewStaff();
  return viewProducts();
}

/* ---------- accounts ---------- */
function viewLogin() {
  $("#app").innerHTML = loginView("Manager log in",
    `<p class="small muted">Setting up the store? <a href="#new-manager">Create a manager account</a> with the master password.</p>`);
  wireLogin(["manager"], APP, u => { me = u; toast("Logged in as " + u.userName); location.hash = "products"; route(); });
}
const userFields = p => `
  <label class="f">User name<input class="in" name="userName" id="${p}-user" required autocomplete="off"></label>
  <label class="f">Full name<input class="in" name="realName" id="${p}-name" required autocomplete="off"></label>
  <label class="f">Phone number<input class="in" name="phoneNumber" id="${p}-phone" type="tel" required autocomplete="off"></label>
  <label class="f">Password<input class="in" name="password" id="${p}-pass" type="password" minlength="6" required autocomplete="new-password"></label>`;
function newManagerForm(standalone) {
  return `<form class="card pad stack" id="mgr-form">
    <h2>${standalone ? "Create a manager account" : "New manager"}</h2>
    <p class="small muted">Managers have full access. Creating one needs the store's master password.</p>
    ${userFields("nm")}
    <label class="f">Master password<input class="in" name="masterPassword" id="nm-master" type="password" required autocomplete="off"></label>
    <div data-msg hidden></div>
    <button class="btn btn-green" type="submit">Create manager</button>
    ${standalone ? `<p class="small muted"><a href="#">Back to log in</a></p>` : ""}
  </form>`;
}
function viewNewManager() {
  $("#app").innerHTML = `<div class="auth">${newManagerForm(true)}</div>`;
  onSubmit($("#mgr-form"), async d => {
    const res = await API.createManager(d);
    me = { userId: String(res.id), userName: d.userName, role: "manager" };
    Session.set(APP, me); toast("Manager account created"); location.hash = "products"; route();
  });
}
function viewStaff() {
  $("#app").innerHTML = `<h1 style="margin-bottom:6px">Staff accounts</h1>
    <p class="muted" style="margin-bottom:18px">Employees can check sets in and out, record charges and answer customer messages. They log in with their user name and password.</p>
    <div class="two-col">
      <form class="card pad stack" id="emp-form"><h2>New employee</h2>${userFields("ne")}<div data-msg hidden></div>
        <button class="btn btn-green" type="submit">Create employee</button></form>
      ${newManagerForm(false)}
    </div>`;
  onSubmit($("#emp-form"), async (d, f) => { const r = await API.createEmployee(me.userId, d); f.reset(); return `Employee ${d.realName} created (user id ${r.id}).`; });
  onSubmit($("#mgr-form"), async (d, f) => { const r = await API.createManager(d); f.reset(); return `Manager ${d.realName} created (user id ${r.id}).`; });
}

/* ---------- products ----------
   The server can't list products, so we collect them from every bundle's details
   plus the products created in this browser that aren't in a bundle yet. */
async function knownProducts() {
  const map = new Map();
  store.get("products", []).forEach(p => map.set(String(p.productId), p));
  try {
    const bs = await API.listBundles();
    const full = await Promise.all(bs.map(b => API.getBundle(b.bundleId).catch(() => null)));
    full.forEach(b => (b && b.products || []).forEach(p => map.set(String(p.productId), { ...map.get(String(p.productId)), ...p })));
  } catch (e) { /* show local ones only */ }
  return [...map.values()];
}
async function viewProducts() {
  $("#app").innerHTML = `<h1 style="margin-bottom:18px">Products</h1>
  <div class="side-col">
    <div class="card pad stack"><h2>Products</h2><div id="plist"><p class="muted small">Loading…</p></div></div>
    <form class="card pad stack" id="prod-form">
      <h2>Add a product</h2>
      <label class="f">Name<input class="in" name="name" id="p-name" required placeholder="e.g. 2-person dome tent"></label>
      <label class="f">Description<input class="in" name="description" id="p-desc" placeholder="Size, weight, model"></label>
      <label class="f">Image URL<span class="hint">Optional, a link to a photo</span><input class="in" name="imageUrl" id="p-img" type="url" placeholder="https://…"></label>
      <div class="grid-2">
        <label class="f">Cost when new ($)<input class="in" name="costWhenNew" id="p-value" type="number" min="0" step="0.01" required></label>
        <label class="f">Lifetime (days)<span class="hint">Also sets the price: per day = cost ÷ lifetime</span><input class="in" name="lifetimeInDays" id="p-life" type="number" min="1" step="1" required></label>
      </div>
      <div data-msg hidden></div>
      <button class="btn btn-green" type="submit">Add product</button>
    </form>
  </div>`;
  onSubmit($("#prod-form"), async (d, f) => {
    const p = { name: d.name.trim(), description: d.description.trim(), imageUrl: d.imageUrl.trim(), costWhenNew: +d.costWhenNew, lifetimeInDays: parseInt(d.lifetimeInDays, 10) };
    const r = await API.createProduct(me.userId, p);
    store.set("products", [...store.get("products", []), { productId: String(r.id), ...p }]);
    f.reset(); loadProducts(); return `Added ${p.name} (product ${r.id}).`;
  });
  loadProducts();
}
async function loadProducts() {
  const ps = await knownProducts();
  $("#plist").innerHTML = ps.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th class="num">Cost new</th><th class="num">Lifetime</th><th class="num">Per day</th></tr></thead><tbody>
    ${ps.map(p => `<tr><td><b>${esc(p.name)}</b><br><span class="small muted">${esc(p.description || "")} · id ${esc(p.productId)}</span></td>
      <td class="num">${money(p.costWhenNew)}</td><td class="num">${esc(p.lifetimeInDays)} d</td><td class="num">${p.dailyCharge != null ? money(p.dailyCharge) : "–"}</td></tr>`).join("")}</tbody></table></div>`
    : `<p class="empty">No products yet. Add the first one.</p>`;
}

/* ---------- bundles ---------- */
async function viewBundles() {
  $("#app").innerHTML = `<h1 style="margin-bottom:18px">Bundles</h1>
  <div class="side-col">
    <form class="card pad stack" id="bundle-form">
      <h2>Create a bundle</h2>
      <label class="f">Name<input class="in" name="name" id="b-name" required placeholder="e.g. First Camping Weekend"></label>
      <label class="f">Tags<span class="hint">Separate with commas</span><input class="in" name="tags" id="b-tags" placeholder="camping, beginner"></label>
      <div style="display:flex;flex-direction:column;gap:6px"><span style="font-weight:600;font-size:.9rem">Products and quantity</span>
        <div class="checklist" id="b-products"><span class="muted small">Loading products…</span></div>
        <label class="f"><span class="hint">Other product names, separated by commas</span><input class="in" id="b-ids" placeholder="optional"></label></div>
      <p class="small muted">The daily price is worked out by the server from the products in the bundle.</p>
      <div data-msg hidden></div>
      <button class="btn btn-green" type="submit">Create bundle</button>
    </form>
    <div class="card pad stack"><h2>Current bundles</h2><div id="blist"><p class="muted small">Loading…</p></div></div>
  </div>`;
  const products = await knownProducts();
  $("#b-products").innerHTML = products.length ? products.map(p => `<label><input type="number" class="in" style="width:64px;padding:6px 8px" min="0" value="0" data-pname="${esc(p.name)}" aria-label="Quantity of ${esc(p.name)}"><span>${esc(p.name)} <span class="muted small">${money(p.costWhenNew)}</span></span></label>`).join("")
    : `<span class="muted small">Add products first on the Products page.</span>`;
  onSubmit($("#bundle-form"), async (d, f) => {
    // The server matches bundle products by name, not by product id.
    const names = $("#b-ids").value.split(",").map(s => s.trim()).filter(Boolean);
    f.querySelectorAll("[data-pname]").forEach(i => { for (let n = 0; n < (+i.value || 0); n++) names.push(i.dataset.pname); });
    if (!names.length) throw new Error("Pick at least one product for the bundle.");
    const tags = d.tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    const r = await API.createBundle(me.userId, { name: d.name.trim(), products: names, tags });
    f.reset(); loadBundles();
    return `Created ${d.name} (bundle ${r.id}). Add sets so customers can reserve it.`;
  });
  loadBundles();
}
async function loadBundles() {
  const box = $("#blist");
  try {
    const bs = await API.listBundles();
    const full = await Promise.all(bs.map(async b => ({
      ...(await API.getBundle(b.bundleId).catch(() => b)), sets: await API.countSets(b.bundleId).catch(() => null) })));
    box.innerHTML = full.length ? full.map(b => `<div class="inbox-item"><div class="row between"><b>${esc(b.name)}</b>
      ${b.dailyCharge != null ? `<span class="price">${money(b.dailyCharge)}/day</span>` : ""}</div>
      <span class="small muted">${(b.products || []).length} items · ${b.sets != null ? `<b>${b.sets} set${b.sets === 1 ? "" : "s"}</b> · ` : ""}${(b.tags || []).map(t => "#" + esc(t)).join(" ")} · id ${esc(b.bundleId)}</span></div>`).join("")
      : `<p class="empty">No bundles yet.</p>`;
  } catch (e) { box.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
}

/* ---------- sets ---------- */
async function viewSets() {
  $("#app").innerHTML = `<div style="max-width:560px;margin:0 auto"><form class="card pad stack" id="set-form">
    <h1>Add sets</h1>
    <p class="muted small">A set is one rentable copy of a bundle. Make one set for each copy the store owns. All items in a new set start at day 0 of their lifetime.</p>
    <label class="f">Bundle<select class="in" name="bundleId" id="set-bundle" required><option value="">Loading…</option></select></label>
    <div class="grid-2">
      <label class="f">Cleaning fee ($)<span class="hint">Charged on return</span><input class="in" name="cleaningFee" id="set-fee" type="number" min="0" step="0.01" value="10" required></label>
      <label class="f">How many copies<span class="hint">&nbsp;</span><input class="in" name="count" id="set-count" type="number" min="1" max="20" value="1" required></label>
    </div>
    <div data-msg hidden></div>
    <button class="btn btn-green" type="submit">Create sets</button></form></div>`;
  try {
    const bs = await API.listBundles();
    $("#set-bundle").innerHTML = bs.length ? bs.map(b => `<option value="${esc(b.bundleId)}">${esc(b.name)}</option>`).join("") : `<option value="">Create a bundle first</option>`;
  } catch (e) { say($("#set-form [data-msg]"), "err", e.message); }
  onSubmit($("#set-form"), async d => {
    const made = [];
    for (let i = 0; i < Math.max(1, +d.count); i++) made.push((await API.createSet(me.userId, { bundleId: d.bundleId, cleaningFee: +d.cleaningFee })).id);
    return `Created ${made.length} set${made.length > 1 ? "s" : ""}: ${made.map(setName).join(", ")}.`;
  });
}

/* ---------- custom kit requests ----------
   Customers can't create bundles or sets, so they send a kit request as a message to the store.
   Building one makes a bundle (tagged "custom", hidden from the shop) and a set, then messages the
   customer a link to reserve it, and removes the request from the store inbox. */
async function viewRequests() {
  $("#app").innerHTML = `<h1 style="margin-bottom:6px">Kit requests</h1>
    <p class="muted" style="margin-bottom:18px">Customers build these in the shop. <b>Build kit</b> creates the bundle and one set, then messages the customer a link to reserve it.</p>
    <div class="stack" id="rq"><p class="muted">Loading…</p></div>`;
  let reqs;
  try {
    const [msgs, products] = await Promise.all([API.storeInbox(me.userId), knownProducts()]);
    const price = new Map(products.map(p => [p.name, p]));
    // A big request arrives as several messages sharing a code. Put the parts back together.
    const groups = new Map();
    for (const m of msgs || []) {
      const k = KitRequest.parse(m.content); if (!k) continue;
      const key = `${m.senderUserId || m.userId}|${k.code}`;
      if (!groups.has(key)) groups.set(key, { m, k: { ...k, items: [], note: "" }, msgs: [], parts: new Set() });
      const g = groups.get(key);
      g.msgs.push(m); g.parts.add(k.part); g.k.items.push(...k.items);
      if (k.note) g.k.note = k.note;
    }
    reqs = [...groups.values()];
    $("#rq").innerHTML = reqs.length ? reqs.map((r, i) => {
      const waiting = r.parts.size < r.k.of;  // some parts haven't arrived
      const missing = r.k.items.filter(it => !price.has(it.name));
      const perDay = r.k.items.reduce((s, it) => s + it.qty * (+(price.get(it.name) || {}).dailyCharge || 0), 0);
      return `<div class="card pad stack" data-i="${i}">
        <div class="row between"><h2>${esc(r.m.userName || r.m.senderName || "Customer")}</h2><span class="small muted">Sent ${esc(r.m.dateSent || "")}</span></div>
        <div class="small"><span class="muted">Dates wanted:</span> <b>${esc(r.k.startDate)} → ${esc(r.k.endDate)}</b></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th class="num">Qty</th><th>Item</th><th class="num">Per day</th></tr></thead><tbody>
          ${r.k.items.map(it => { const p = price.get(it.name); return `<tr><td class="num">${it.qty}</td><td>${esc(it.name)}${p ? "" : ` <span class="pill bad">not in catalog</span>`}</td>
            <td class="num">${p && p.dailyCharge != null ? money(it.qty * p.dailyCharge) : "–"}</td></tr>`; }).join("")}
        </tbody></table></div>
        <div class="row between"><span class="small muted">Estimated price</span><span class="price">${money(perDay)}/day</span></div>
        ${r.k.note ? `<p class="small"><span class="muted">Note:</span> ${esc(r.k.note)}</p>` : ""}
        <div class="row" style="align-items:end">
          <label class="f" style="width:150px">Cleaning fee ($)<input class="in" type="number" min="0" step="0.01" value="10" data-fee></label>
          <button type="button" class="btn btn-green" data-build ${missing.length || waiting ? "disabled" : ""}>Build kit</button>
          <button type="button" class="btn btn-quiet" data-delete>Delete request</button>
        </div>
        ${waiting ? `<p class="small muted">Only ${r.parts.size} of ${r.k.of} parts of this request arrived. Ask the customer to send it again, then delete this one.</p>` : ""}
        ${missing.length ? `<p class="small muted">Add the missing items on the Products page first, or delete the request and message the customer.</p>` : ""}
        <div data-msg hidden></div></div>`;
    }).join("") : `<div class="card empty">No kit requests right now.</div>`;
  } catch (e) { $("#rq").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; return; }

  $("#rq").onclick = async e => {
    const btn = e.target.closest("[data-build],[data-delete]"); if (!btn) return;
    const card = btn.closest("[data-i]"), r = reqs[+card.dataset.i], msg = card.querySelector("[data-msg]");
    const customerId = r.m.senderUserId || r.m.userId, who = r.m.userName || r.m.senderName || "customer";
    if (btn.matches("[data-delete]") && !confirm(`Delete ${who}'s kit request? This can't be undone.`)) return;
    btn.disabled = true;
    try {
      const removeRequest = () => Promise.all(r.msgs.map(m => API.deleteStoreMessage(me.userId, m.messageId)));
      if (btn.matches("[data-delete]")) { await removeRequest(); toast("Request deleted"); return viewRequests(); }
      // Each step is remembered on r, so pressing Build again after a failure doesn't make a second bundle.
      const name = `Custom kit for ${who}, ${r.k.startDate}`;
      r.bundleId = r.bundleId || (await API.createBundle(me.userId, { name, tags: ["custom"],
        products: r.k.items.flatMap(it => Array(it.qty).fill(it.name)) })).id;
      r.setId = r.setId || (await API.createSet(me.userId, { bundleId: r.bundleId, cleaningFee: +card.querySelector("[data-fee]").value || 0 })).id;
      if (!r.replied) {
        const b = await API.getBundle(r.bundleId);
        const link = new URL("index.html#bundle-" + r.bundleId, location.href).href;
        // Kept short: messages over 255 characters are rejected by the server.
        await API.messageCustomer(me.userId, customerId,
          `Your custom kit is ready, ${money(b.dailyCharge)} a day. Reserve it for ${r.k.startDate} to ${r.k.endDate} here:\n${link}`);
        r.replied = true;
      }
      await removeRequest();
      toast(`Built the kit and sent ${who} a link`); viewRequests();
    } catch (err) {
      const step = btn.matches("[data-delete]") ? "deleting the request" : !r.bundleId ? "creating the bundle"
        : !r.setId ? "creating the set" : !r.replied ? "messaging the customer" : "removing the request";
      say(msg, "err", `Stopped while ${step}: ${err.message} Press the button again to retry from there.`);
      btn.disabled = false;
    }
  };
}

window.addEventListener("hashchange", route);
route();
