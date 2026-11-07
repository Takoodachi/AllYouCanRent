/* common.js — small helpers shared by all three apps */

const $ = (s, root = document) => root.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "$" + (Number(n) || 0).toFixed(2);
const today = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
const store = {
  get(k, d) { try { const v = localStorage.getItem("rental:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("rental:" + k, JSON.stringify(v)); } catch (e) {} }
};

/* The logged-in user for one app: {userId, userName, role} */
const Session = {
  get(app) { return store.get("session:" + app, null); },
  set(app, u) { store.set("session:" + app, u); },
  clear(app) { try { localStorage.removeItem("rental:session:" + app); } catch (e) {} }
};

function toast(text) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
  t.textContent = text; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.hidden = true, 2600);
}

/* Show a result line inside a form's [data-msg] slot. */
function say(el, kind, text) {
  if (!el) return;
  el.className = "msg " + kind; el.textContent = text; el.hidden = false;
}

/* Wire a form: runs fn(formData, form) on submit, disables the button while it waits,
   and shows the returned text (or the server's error) in the form's [data-msg] element. */
function onSubmit(form, fn) {
  if (!form) return;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    const msg = form.querySelector("[data-msg]");
    if (msg) msg.hidden = true;
    if (btn) btn.disabled = true;
    try {
      const ok = await fn(Object.fromEntries(new FormData(form)), form);
      if (ok && msg) say(msg, "ok", ok);
    } catch (err) {
      if (msg) say(msg, "err", err.message); else toast(err.message);
    } finally { if (btn) btn.disabled = false; }
  });
}

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 27 L13 9 L18 17 L21 12 L29 27 Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><circle cx="24" cy="7" r="2.6" fill="currentColor"/></svg>`;

/* Light or dark theme. A choice is saved in this browser; with none, the site follows the device setting.
   Each page's <head> applies the saved choice before drawing, so there's no flash of the other theme. */
const Theme = {
  get: () => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  set: t => { document.documentElement.dataset.theme = t; store.set("theme", t); }
};
const SUN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const MOON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
function wireThemeButton() {
  const b = $("#theme-btn"); if (!b) return;
  const paint = () => {
    const dark = Theme.get() === "dark", text = dark ? "Switch to light mode" : "Switch to dark mode";
    b.innerHTML = dark ? SUN : MOON; b.title = text; b.setAttribute("aria-label", text);
  };
  b.onclick = () => { Theme.set(Theme.get() === "dark" ? "light" : "dark"); paint(); };
  paint();
}

/* Header with app name, nav links, log out and the theme switch. links = [[hash, label]], shown as given. */
function renderHeader(appLabel, links, current, user, onLogout) {
  $("#header").innerHTML = `<div class="wrap">
    <a class="logo" href="index.html">${LOGO} All you can rent</a><span class="role-tag">${esc(appLabel)}</span>
    <nav class="main">${links.map(([h, l]) => `<a href="#${h}" class="${current === h ? "on" : ""}">${esc(l)}</a>`).join("")}
      ${user ? `<button type="button" id="logout">Log out ${esc(user.userName || "")}</button>` : ""}
      <button type="button" id="theme-btn" class="theme-btn"></button></nav></div>`;
  const lo = $("#logout"); if (lo) lo.onclick = onLogout;
  wireThemeButton();
}

/* Password box with a Show/Hide button. attrs go on the <input>. */
const passwordInput = attrs => `<span class="pw"><input class="in" type="password" ${attrs}><button type="button" class="pw-toggle" aria-label="Show password">Show</button></span>`;
document.addEventListener("click", e => {
  const b = e.target.closest(".pw-toggle"); if (!b) return;
  const input = b.previousElementSibling, show = input.type === "password";
  input.type = show ? "text" : "password";
  b.textContent = show ? "Hide" : "Show";
  b.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

/* Browser tab title for the current page. */
const setTitle = page => { document.title = page ? `${page} · All you can rent` : "All you can rent"; };

/* Keep an end date on or after its start date: moving the start past the end moves the end too. */
function linkDates(start, end) {
  const sync = () => { end.min = start.value; if (end.value < start.value) end.value = start.value; };
  start.addEventListener("change", sync);
  sync();
}

/* Login form shared by the three apps. */
function loginView(title, extraHtml = "") {
  return `<div class="auth card pad stack">
    <h2>${esc(title)}</h2>
    <form class="stack" id="login-form">
      <label class="f">User name<input class="in" name="userName" id="login-user" required autocomplete="username" autofocus></label>
      <label class="f">Password${passwordInput(`name="password" id="login-pass" required autocomplete="current-password"`)}</label>
      <div data-msg hidden></div>
      <button class="btn btn-green btn-block" type="submit">Log in</button>
    </form>
    ${extraHtml}
  </div>`;
}
/* allowed = roles that may use this app; done(user) runs after a good login. */
function wireLogin(allowed, app, done) {
  onSubmit($("#login-form"), async d => {
    const res = await API.login(d.userName.trim(), d.password);
    if (!res || !res.userId) throw new Error("User name or password is wrong.");
    const u = { userId: String(res.userId), userName: d.userName.trim(), role: API.roleOf(res.privilegeLevel), privilegeLevel: res.privilegeLevel };
    if (!allowed.includes(u.role)) throw new Error(`This is a ${u.role} account (privilege "${res.privilegeLevel}"). Use the ${u.role} app instead.`);
    Session.set(app, u); done(u);
  });
}

/* Simple illustration per bundle, picked from its tags. Stand-in for product photos. */
function bundleArt(b, seed = 1) {
  const tags = (b.tags || []).join(" ").toLowerCase() + " " + String(b.name || "").toLowerCase();
  const pal = /ski|snow|winter/.test(tags) ? ["#bcd8ee", "#eef5fa", "#dfe9f1", "#9fb4c4"]
    : /kayak|water|paddle|lake/.test(tags) ? ["#f6b98a", "#fde3c8", "#5c7f6c", "#5d9bb8"]
    : /climb|boulder/.test(tags) ? ["#f1c8a0", "#f7e8d2", "#b77d5a", "#6b4433"]
    : /hik|backpack|trail/.test(tags) ? ["#f3d8a4", "#eef0d6", "#9bb36f", "#46703a"]
    : ["#f7c98b", "#f4e3b5", "#6d8f5a", "#2d4f2b"];
  const s = typeof seed === "number" ? seed : [...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = n => ((Math.sin(s * 97 + n) * 10000) % 1 + 1) % 1;
  const ridge = (base, amp, n) => { let d = `M0 ${base}`; for (let i = 0; i <= n; i++) d += ` L${(i * 400 / n).toFixed(0)} ${(base - amp * r(i + base)).toFixed(0)}`; return d + " L400 225 L0 225 Z"; };
  const id = "sky" + s + Math.random().toString(36).slice(2, 6);
  return `<svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal[0]}"/><stop offset="1" stop-color="${pal[1]}"/></linearGradient></defs>
    <rect width="400" height="225" fill="url(#${id})"/><circle cx="${300 + r(3) * 60}" cy="48" r="16" fill="#fff6d8" opacity=".85"/>
    <path d="${ridge(130, 60, 7)}" fill="${pal[2]}" opacity=".8"/><path d="${ridge(175, 40, 9)}" fill="${pal[2]}"/><path d="${ridge(205, 18, 12)}" fill="${pal[3]}"/></svg>`;
}

/* Readable set name made from the set id, the same in every app. The server stores no set names.
   shortcut: 256 names, so two sets can share one (rare), upgrade if the server gets a set name field. */
const SET_WORDS = [["Alpine", "Aspen", "Birch", "Boulder", "Canyon", "Cedar", "Copper", "Granite", "Juniper", "Maple", "Pine", "River", "Sage", "Summit", "Timber", "Willow"],
  ["Basin", "Bluff", "Creek", "Falls", "Grove", "Hollow", "Lake", "Meadow", "Mesa", "Pass", "Peak", "Point", "Ridge", "Spring", "Trail", "Valley"]];
function setName(id) {
  let h = 5381;
  for (const c of String(id)) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return `${SET_WORDS[0][h % 16]} ${SET_WORDS[1][(h >>> 4) % 16]} set`;
}

/* The server rejects messages (and reviews) longer than 255 characters. */
const MSG_MAX = 255;

/* Custom kit requests travel as normal messages to the store, because customers can't create
   bundles or sets themselves. The text stays readable in the staff inbox. A big kit doesn't fit in
   255 characters, so it is split into parts that share a code:
     Custom kit request K7Q2 1/2
     Dates: 2026-11-20 to 2026-11-22
     - 2 × Mummy sleeping bag (20°F)
     Note: ...                                                     */
/* Short reservation codes. The server's reservation number is a 36-character id and it has no way
   to search, so people see the first 8 characters instead, like "B6C6-C579". When a customer
   reserves, the shop sends the store a note linking the code to the full number; the employee
   desk reads those notes to turn a typed code back into the full number.
   shortcut: 8 characters, so two reservations could share a code (very unlikely for one store);
   the notes are never deleted. Upgrade if the server gets short ids or a reservation search. */
const resCode = id => { const c = String(id).replace(/-/g, "").slice(0, 8).toUpperCase(); return `${c.slice(0, 4)}-${c.slice(4)}`; };
const ResNote = {
  text: (id, about) => `Reservation code ${resCode(id)}\nFull number: ${id}\n${about}`.slice(0, MSG_MAX),
  // → the full reservation id in a note, or null if the message isn't one
  parse: text => (String(text || "").match(/^Reservation code \S+\nFull number: ([0-9a-f-]{36})/i) || [])[1] || null,
  // A typed code (any case, with or without the dash) or a full number → the full id, using the store's notes
  resolve(typed, notes) {
    const v = String(typed).trim().toLowerCase().replace(/[\s-]/g, "");
    if (/^[0-9a-f]{32}$/.test(v)) return String(typed).trim();
    if (!/^[0-9a-f]{8}$/.test(v)) return null;
    return notes.map(m => ResNote.parse(m.content)).find(id => id && id.replace(/-/g, "").toLowerCase().startsWith(v)) || null;
  }
};

const KIT_HEAD = "Custom kit request";
const KitRequest = {
  // → the message texts to send, each within MSG_MAX
  messages({ startDate, endDate, items, note }) {
    const code = Math.random().toString(36).slice(2, 6).toUpperCase();
    const top = (i, n) => `${KIT_HEAD} ${code} ${i}/${n}\nDates: ${startDate} to ${endDate}`;
    const room = MSG_MAX - top(99, 99).length - 1;  // what's left for item lines in each message
    const lines = [...items.map(i => `- ${i.qty} × ${i.name}`), ...(note ? [`Note: ${note.replace(/\s+/g, " ")}`] : [])];
    const groups = [[]];
    for (const line of lines) {
      const g = groups[groups.length - 1];
      if (g.length && [...g, line].join("\n").length > room) groups.push([line]); else g.push(line);
    }
    return groups.map((g, i) => `${top(i + 1, groups.length)}\n${g.join("\n")}`);
  },
  // One message → { code, part, of, startDate, endDate, items: [{ qty, name }], note }, or null if it isn't a kit request
  parse(text) {
    const lines = String(text || "").split(/\r?\n/).map(l => l.trim());
    const head = lines[0].startsWith(KIT_HEAD + " ") && lines[0].slice(KIT_HEAD.length + 1).match(/^(\w+) (\d+)\/(\d+)$/);
    const dates = (lines[1] || "").match(/^Dates: (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})$/);
    if (!head || !dates) return null;
    return { code: head[1], part: +head[2], of: +head[3], startDate: dates[1], endDate: dates[2],
      items: lines.map(l => l.match(/^- (\d+) × (.+)$/)).filter(Boolean).map(m => ({ qty: +m[1], name: m[2] })),
      note: (lines.find(l => l.startsWith("Note: ")) || "").slice(6) };
  }
};

/* Real photos for the shop's bundles, matched by bundle name. All are from Unsplash and free to use
   under the Unsplash License (credits in README.txt). The value is the photo id on images.unsplash.com.
   A bundle that isn't listed here (like a custom kit) gets the drawn scene instead. */
const BUNDLE_PHOTOS = {
  "Day Hike Starter": "photo-1661001159798-cb33db460f21",
  "Bird Watching Walk": "photo-1675246198306-9ba2a1aee6de",
  "Snowshoe Trek": "photo-1761470077541-fc357e8382df",
  "Bouldering Starter": "photo-1516594905951-96326d2c3de6",
  "Hammock Camping": "photo-1567496662086-7cba3cf0de3a",
  "Beach Day": "photo-1771367530679-6b7f400834df",
  "Cross-Country Ski Day": "photo-1587647033811-0d7d23a54626",
  "Stargazing Night": "photo-1548124771-9f2040b66df8",
  "Lake Fishing Day": "photo-1541742425281-c1d3fc8aff96",
  "Surf Starter": "photo-1590767425054-ecc74aa82b82",
  "Paddleboard Day": "photo-1472745942893-4b9f730c7668",
  "Snowboard Day": "photo-1478700485868-972b69dc3fc4",
  "Kayak Day Trip": "photo-1588472235276-7638965471e2",
  "Weekend Camping for Two": "photo-1633431305692-00a2f1a5c3d5",
  "Ski Day": "photo-1551698618-1dfe5d97d256",
  "Backpacking Overnight": "photo-1708647507980-058ff659a497",
  "Sport Climbing Kit": "photo-1631045487342-a6143f645e2d",
  "Mountaineering Intro": "photo-1790693209032-645727eeff77",
  "Mountain Bike Day": "photo-1633707167682-9068729bc84c",
  "Gravel Bike Tour": "photo-1785711930095-7a6fb14b2492",
  "Canoe Weekend": "photo-1468221296755-1c53a9dbcd54",
  "Winter Camping for Two": "photo-1455496231601-e6195da1f841",
  "Family Car Camping": "photo-1504280390367-361c6d9f38f4"
};

/* Picture for a bundle: a product's own image if one has a link, then the bundle's photo, then the
   drawn scene. large = the bundle page's wide banner (16:8); otherwise a card picture (16:9).
   If a photo fails to load, it's removed and the card's plain colour shows instead of a broken icon. */
function bundleImage(b, seed, large = false) {
  const own = (b.products || []).map(p => p.imageUrl).find(u => u && /^https?:\/\//.test(u));
  const id = BUNDLE_PHOTOS[b.name];
  const src = own || (id && `https://images.unsplash.com/${id}?w=${large ? 1200 : 640}&h=${large ? 600 : 360}&fit=crop&auto=format&q=70`);
  return src ? `<img src="${esc(src)}" alt="" ${large ? "" : `loading="lazy"`} onerror="this.remove()" style="width:100%;height:100%;object-fit:cover;display:block">`
    : bundleArt(b, seed);
}
