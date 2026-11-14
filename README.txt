All you can rent — rental system front end (CMSC 106)

Open index.html in a browser. It is the shop, and its footer links to the staff apps:
  index.html     - browse bundles by tag (no account needed). A log-in pop-up opens when a customer
                   reserves, reviews, or opens My reservations or Messages.
                   (customer.html just redirects here, so old links still work.)
                   A search box and an activity filter narrow the bundles by name, tag or gear.
  employee.html  - check out / return sets, repair charges, lost items, invoices, messages
  manager.html   - create managers and employees, products, bundles and sets

BACK END
All three apps talk to the real server at https://cmsc106.net/rental.
Every API call is in js/api.js, using the field names from the server's Swagger spec.
Master password for new managers: RentalMaster106!

NOTES
  - The server has no "list products" call, so the manager app builds its product list
    from existing bundles plus products created in that browser.
  - Bundle prices (dailyCharge) are calculated by the server from the products:
    each product costs (cost when new / lifetime in days) per day, so a shorter lifetime means a higher price.
  - The server can't edit or delete bundles. Old bundles are hidden by id in js/api.js (RETIRED_BUNDLES).
    Bundles made by automated tests on the shared class server (names ending in a run number, like
    "FavKit A 498308fav") are hidden by name there too (TEST_BUNDLE).
  - The lost-item form lists the set's items once the set is returned.
  - GET /reservations only returns the given user's own reservations, so staff open a
    customer's reservation by the number the customer shows them.
  - Sets have no names on the server. setName() in js/common.js turns a set id into a fixed
    name like "Granite Ridge set", so customers never see set ids.
  - The server can't list sets or users. Set counts come from /sets/available on a far-future
    date (every set is free then). Employee, manager and customer accounts can't be counted.
  - Reviews are refused (HTTP 403) until the customer has rented and returned that bundle.
  - Message dates (dateSent) must be yyyy-mm-dd, and the server rejects messages over 255 characters.
  - Reservation codes: people see an 8-character code (like B6C6-C579) instead of the 36-character
    reservation number. On reserving, the shop sends the store a short note linking the two; the
    employee desk uses those notes to open a reservation by code (ResNote in js/common.js). The
    notes are hidden from the staff Messages page. Older reservations get their note the next time
    the customer opens My reservations.
  - Custom kits: customers can't create bundles or sets, so "Build a kit" in the shop sends the
    request as message(s) to the store (format in KitRequest, js/common.js; big kits are split into
    parts). Manager > Kit requests builds it with one click: a bundle tagged "custom" (hidden from
    the shop), one set, and a message to the customer with a link to reserve it.
  - Invoices: staff can load an invoice at any time, but customers get HTTP 403. So "Send invoice to
    customer" on the rental desk sends it as a message (InvoiceNote in js/common.js, split into parts
    if long), and My reservations shows the newest one. Re-sending an identical invoice is skipped.
  - Today (the employee app's first tab): pickups, returns due, overdue sets and every reservation for
    a chosen day, with Check out / Return / Open buttons. Uses the same list as the rental desk.
  - Rental desk: it lists the reservations of every customer who has messaged the store (including the
    reservation code notes), with their status (Reserved, Checked out, Returned). "Charges so far"
    comes from the staff invoice, so repairs already added show after a refresh and for every employee.
  - Reviews: js/sample-reviews.js holds sample reviews for the demo store, shown alongside real ones
    (the server only accepts reviews from customers who rented and returned the bundle).
  - The sun/moon button in every header switches light and dark mode. The choice is saved in the
    browser (localStorage "rental:theme"); without one, the site follows the device setting.
  - Favorites: the heart on a bundle saves it to the customer's account on the server
    (/users/{id}/favorites); the Favorites chip on Browse shows only saved bundles. A guest who taps a
    heart logs in first, then the bundle is saved.
  - Trips (My trips): a trip has a name, dates, group size, notes and a list of bundles, saved on the
    server. Bundles are added from a bundle page ("Add to a trip") and can be removed until the trip is
    reserved. "Reserve all" first checks that every bundle has a free set for the dates, then reserves
    each one, adds the reservation to the trip and sends the store its code note. If a bundle has no
    free set, the customer picks new dates: the server can't change a trip's dates, so the shop makes a
    new trip with the same details and bundles, deletes the old one and tries again. Trips that aren't
    reserved yet can be deleted. The server keeps each bundle once per trip.

PHOTOS
Bundle photos come from Unsplash (unsplash.com) and are free to use under the Unsplash License.
They load straight from images.unsplash.com; the list is BUNDLE_PHOTOS in js/common.js.
Thanks to the photographers:
  Day Hike Starter - Christian Meyer-Hentschel     Bird Watching Walk - Annie Spratt
  Snowshoe Trek - Dominik Neuner                  Bouldering Starter - Brook Anderson
  Hammock Camping - Ris & Ry                      Beach Day - Ivett M
  Cross-Country Ski Day - Pierre Jarry            Stargazing Night - Patrick Hendry
  Lake Fishing Day - James Wheeler                Surf Starter - Ale Romo
  Paddleboard Day - Ben White                     Snowboard Day - Mattias Olsson
  Kayak Day Trip - Christian Bowen                Weekend Camping for Two - Zest Tea
  Ski Day - Maarten Duineveld                     Backpacking Overnight - Alex Moliski
  Sport Climbing Kit - Devon Dennis               Mountaineering Intro - Mael Balland
  Mountain Bike Day - Axel Brunst                 Gravel Bike Tour - Patrick Hendry
  Canoe Weekend - Michael Niessl                  Winter Camping for Two - David Schultz
  Family Car Camping - Scott Goodwill

FILES
  favicon.svg     browser tab icon (the logo's mountains and sun)
  css/style.css   shared look
  js/api.js       every endpoint, in one place
  js/common.js    login, header, forms, helpers
  js/customer.js, js/employee.js, js/manager.js   one per app
