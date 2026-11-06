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

/* Header with app name, nav links and log out. links = [[hash, label]] */
function renderHeader(appLabel, links, current, user, onLogout) {
  $("#header").innerHTML = `<div class="wrap">
    <a class="logo" href="index.html">${LOGO} All you can rent</a><span class="role-tag">${esc(appLabel)}</span>
    <nav class="main">${user ? links.map(([h, l]) => `<a href="#${h}" class="${current === h ? "on" : ""}">${esc(l)}</a>`).join("") : ""}
      ${user ? `<button type="button" id="logout">Log out ${esc(user.userName || "")}</button>` : ""}</nav></div>`;
  const lo = $("#logout"); if (lo) lo.onclick = onLogout;
}

/* Login form shared by the three apps. */
function loginView(title, extraHtml = "") {
  return `<div class="auth card pad stack">
    <h2>${esc(title)}</h2>
    <form class="stack" id="login-form">
      <label class="f">User name<input class="in" name="userName" id="login-user" required autocomplete="username"></label>
      <label class="f">Password<input class="in" name="password" id="login-pass" type="password" required autocomplete="current-password"></label>
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

/* Product image if it has one, otherwise the illustration. */
function bundleImage(b, seed) {
  const img = (b.products || []).map(p => p.imageUrl).find(u => u && /^https?:\/\//.test(u));
  return img ? `<img src="${esc(img)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">` : bundleArt(b, seed);
}
