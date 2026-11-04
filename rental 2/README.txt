All you can rent — rental system front end (CMSC 106)

Open index.html in a browser. It links to the three apps:
  customer.html  - sign up, browse bundles by tag, reserve a set, review, message the store
  employee.html  - check out / return sets, repair charges, lost items, invoices, messages
  manager.html   - create managers and employees, products, bundles and sets

BACK END
All three apps talk to the real server at https://cmsc106.net/rental.
Every API call is in js/api.js, using the field names from the server's Swagger spec.
Master password for new managers: RentalMaster106!

NOTES
  - The server has no "list products" call, so the manager app builds its product list
    from existing bundles plus products created in that browser.
  - Bundle prices (dailyCharge) are calculated by the server from the products.
  - The lost-item form lists the set's items once the set is returned.

FILES
  css/style.css   shared look
  js/api.js       every endpoint, in one place
  js/common.js    login, header, forms, helpers
  js/customer.js, js/employee.js, js/manager.js   one per app
