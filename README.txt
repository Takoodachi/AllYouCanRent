All you can rent — rental system front end (CMSC 106)

Open index.html in a browser. It links to the three apps:
  customer.html  - browse bundles by tag (no account needed); log in or sign up to reserve a set,
                   review, see reservations and message the store
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
  - The lost-item form lists the set's items once the set is returned.
  - GET /reservations only returns the given user's own reservations, so staff open a
    customer's reservation by the number the customer shows them.
  - Sets have no names on the server. setName() in js/common.js turns a set id into a fixed
    name like "Granite Ridge set", so customers never see set ids.
  - The server can't list sets or users. Set counts come from /sets/available on a far-future
    date (every set is free then). Employee, manager and customer accounts can't be counted.
  - Reviews are refused (HTTP 403) until the customer has rented and returned that bundle.
  - Message dates (dateSent) must be yyyy-mm-dd.

FILES
  css/style.css   shared look
  js/api.js       every endpoint, in one place
  js/common.js    login, header, forms, helpers
  js/customer.js, js/employee.js, js/manager.js   one per app
