/* ==========================================================================
   api.js — every call to the rental back end lives in this one file.
   Property names match the server's OpenAPI spec:
   https://cmsc106.net/rental/swagger-ui/index.html
   All ids are strings.
   ========================================================================== */

const API = (() => {
  const BASE_URL = "https://cmsc106.net/rental";
  // First bundles, priced with long lifetimes. The server can't delete bundles, so the apps hide them.
  // shortcut: hardcoded ids, remove this if the server gets a delete-bundle call.
  const RETIRED_BUNDLES = new Set([
    "17189796-0863-424d-96d2-49b26edf02d9", "28ea374e-f5f8-4f30-8f63-9838c92f4215", "4fa6f71a-c229-4b90-a0af-1e4fde919a50",
    "76f7761b-6e88-44b4-8e48-9402cb2d252c", "8387f90f-9ae5-4742-91c1-2d776be5275e", "9ef470d2-c16a-49fd-bcce-a81a170f2204"
  ]);

  async function request(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(BASE_URL + path, opts);
    } catch (e) {
      throw new Error("Couldn't reach the rental server. Check your internet connection and try again.");
    }
    const text = await res.text();
    let data = text;
    try { data = text ? JSON.parse(text) : null; } catch (e) { /* plain-text reply */ }
    if (!res.ok) {
      const why = (data && typeof data === "object" && (data.message || data.error)) || (typeof data === "string" && data) || res.statusText;
      throw Object.assign(new Error(`${why} (HTTP ${res.status})`), { status: res.status });
    }
    return data;
  }
  const get = p => request("GET", p);
  const post = (p, b) => request("POST", p, b);
  const del = p => request("DELETE", p);
  const q = obj => "?" + Object.entries(obj).filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  // dateSent is a plain date (yyyy-mm-dd); the server rejects a time with HTTP 400.
  const now = () => { const d = new Date(), p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

  /* privilegeLevel from /users/login → "manager" | "employee" | "customer" */
  function roleOf(level) {
    const raw = String(level ?? "").toLowerCase();
    if (raw.includes("manager") || raw === "high" || raw === "2") return "manager";
    if (raw.includes("employee") || raw === "medium" || raw === "1") return "employee";
    return "customer";
  }

  /* Set letters (A, B, C...). The server stores no set names and has no "list sets" call, but a
     far-future search returns every set of a bundle, booked or not, so all browsers get the same letters.
     shortcut: adding a set can shift letters, because the order comes from the set's random id. */
  const letterOf = i => (i >= 26 ? letterOf(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + i % 26);
  const lettersByBundle = {};
  function setLetters(bundleId) {
    if (!lettersByBundle[bundleId]) {
      lettersByBundle[bundleId] = get("/sets/available" + q({ bundleId, startDate: "2099-01-01", endDate: "2099-01-02" }))
        .then(sets => new Map((sets || []).map(s => String(s.setId)).sort().map((id, i) => [id, letterOf(i)])))
        .catch(() => { delete lettersByBundle[bundleId]; return new Map(); });
    }
    return lettersByBundle[bundleId];
  }
  /* Reservations only give the bundle's name, and names repeat (hidden old bundles included), so try each match.
     Resolves to null if the letter can't be worked out; callers then show the short id. */
  async function setLetter(bundleName, setId) {
    try {
      const bundles = await get("/bundles");
      for (const b of (bundles || []).filter(x => x.name === bundleName)) {
        const letter = (await setLetters(b.bundleId)).get(String(setId));
        if (letter) return letter;
      }
    } catch (e) { /* fall through to the short id */ }
    return null;
  }

  return {
    BASE_URL, roleOf, setLetters, setLetter,

    /* ---------- users ---------- (all return {id}) */
    createCustomer: ({ userName, realName, phoneNumber, password }) =>
      post("/users", { userName, realName, phoneNumber, password }),
    createManager: ({ userName, realName, phoneNumber, password, masterPassword }) =>
      post("/users/managers", { masterPassword, userName, realName, phoneNumber, password }),
    createEmployee: (managerId, { userName, realName, phoneNumber, password }) =>
      post("/users/employees", { userId: managerId, userName, realName, phoneNumber, password }),
    // → {userId, privilegeLevel}
    login: (userName, password) => post("/users/login", { userName, password, realName: "", phoneNumber: "" }),

    /* ---------- products ---------- */
    // The server has no "list products" call, so the manager app keeps its own list (see manager.js).
    createProduct: (managerId, { name, description, imageUrl, costWhenNew, lifetimeInDays }) =>
      post("/products", { userId: managerId, name, description, imageUrl: imageUrl || "", costWhenNew, lifetimeInDays }),

    /* ---------- bundles and sets ---------- */
    // products = list of product names, not ids (repeat a name to include it twice)
    createBundle: (managerId, { name, products, tags }) =>
      post("/bundles", { userId: managerId, name, products, tags }),
    listBundles: tag => get("/bundles" + (tag ? q({ tag }) : ""))      // → [{bundleId, name}]
      .then(bs => (bs || []).filter(b => !RETIRED_BUNDLES.has(String(b.bundleId)))),
    getBundle: id => get(`/bundles/${encodeURIComponent(id)}`),         // → {bundleId, name, dailyCharge, tags, products[], reviews[]}
    listTags: () => get("/tags"),                                         // → ["camping", ...]
    createSet: (staffId, { bundleId, cleaningFee }) =>
      post("/sets", { userId: staffId, bundleId, cleaningFee }).then(r => { delete lettersByBundle[bundleId]; return r; }),
    // → [{setId, bundleId, bundleName, dailyCharge, cleaningFee, items:[{itemId, productName, depreciatedValue}]}]
    availableSets: (bundleId, startDate, endDate) =>
      get("/sets/available" + q({ bundleId, startDate, endDate })),
    // shortcut: the server can't list a bundle's sets, so count the ones free on a far-future date (all of them).
    countSets: bundleId => get("/sets/available" + q({ bundleId, startDate: "2099-01-01", endDate: "2099-01-02" })).then(s => (s || []).length),

    /* ---------- reservations ---------- */
    reserve: (customerId, { setId, startDate, endDate }) =>
      post("/reservations", { userId: customerId, setId, startDate, endDate }),
    // → [{reservationId, userName, setId, bundleName, startDate, endDate, status}]
    listReservations: userId => get("/reservations" + q({ userId })),
    checkout: (employeeId, reservationId) => post("/reservations/checkout", { userId: employeeId, reservationId }),
    returnSet: (employeeId, reservationId) => post("/reservations/return", { userId: employeeId, reservationId }),
    addCharge: (employeeId, { reservationId, description, amount }) =>
      post("/reservations/charges", { userId: employeeId, reservationId, description, amount }),
    reportLost: (employeeId, { reservationId, itemId }) =>
      post("/reservations/lostitem", { userId: employeeId, reservationId, itemId }),
    // → {reservationId, customerId, customerName, setId, bundleName, startDate, endDate, charges:[{type, description, amount}], total}
    invoice: (employeeId, reservationId) => get("/reservations/invoice" + q({ userId: employeeId, reservationId })),

    /* ---------- reviews ---------- */
    postReview: (customerId, { bundleId, rating, content }) =>
      post("/reviews", { userId: customerId, bundleId, rating, content }),

    /* ---------- messages ---------- (MessageDTO: messageId, userId, userName, senderUserId, senderName, fromStore, content, dateSent) */
    messageStore: (customerId, content) => post("/messages/tostore", { userId: customerId, content, dateSent: now() }),
    messageCustomer: (staffId, customerId, content) =>
      post("/messages/fromstore", { userId: customerId, senderUserId: staffId, content, dateSent: now() }),
    myMessages: customerId => get(`/messages/${encodeURIComponent(customerId)}`),
    storeInbox: staffId => get("/messages/store" + q({ userId: staffId })),
    deleteMyMessage: (customerId, messageId) => del(`/messages/${encodeURIComponent(messageId)}` + q({ userId: customerId })),
    deleteStoreMessage: (staffId, messageId) => del(`/messages/tostore/${encodeURIComponent(messageId)}` + q({ userId: staffId }))
  };
})();
