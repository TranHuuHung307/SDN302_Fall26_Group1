# Fruit Fresh Commerce API

Backend REST API for the Fruit Fresh course project. It uses Express and MongoDB/Mongoose and supports simulated online payments; no payment gateway is connected.

## Run locally

1. Install Node.js and MongoDB, then run `npm install`.
2. Copy `.env.example` to `.env`; set `MONGO_URI` and replace `JWT_SECRET` with a private random value.
3. Import the project's Extended JSON files into the `fruit_fresh_commerce` database with MongoDB Compass. Run the companion `indexes.js` after importing.
4. Start the web app and API with `npm run dev` (development) or `npm start` (normal start). The storefront is at `http://localhost:9999`; API routes work under `/api` and retain root-level aliases.

The sample JSON files are located outside this repository in the supplied `fruit_fresh_json` folder. Import `users`, `shops`, `shop_staff`, `categories`, `products`, `carts`, `orders`, `stock_transactions`, `notifications`, and `shop_registration_requests` into collections with matching names.

## Response format

Successful endpoints return `{ "success": true, "data": ... }`. List endpoints include `pagination` when paginated. Errors return `{ "success": false, "message": "..." }`. Authenticated endpoints use `Authorization: Bearer <token>`.
The routes below omit the `/api` prefix for readability; both `/api/products` and `/products` work. The included storefront uses the `/api` forms.

## API routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | Check API and MongoDB connection |
| GET | `/` | Public | Serve the storefront and category/product manager |

### Authentication and profile

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Create a CUSTOMER account and return a 12-hour JWT |
| POST | `/auth/login` | Public | Return a 12-hour JWT |
| GET | `/auth/me` | Signed in | Get the current profile |
| PATCH | `/auth/me` | Signed in | Update `fullName`, `phone`, or password (`currentPassword`, `newPassword`) |
| GET | `/admin/users?role=&accountStatus=&search=&page=&limit=` | ADMIN | List/filter accounts |
| PATCH | `/admin/users/:id/status` | ADMIN | Activate or ban an account |
| GET | `/users?role=&accountStatus=&search=&page=&limit=` | ADMIN | Backward-compatible user list alias |
| PATCH | `/users/:id` | ADMIN | Backward-compatible account status alias |

Public registration cannot set a role or account status. Shop-owner and staff roles are granted through the corresponding workflows.

### Products, categories, and shops

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/products?page=1&limit=20&shopId=&categoryId=&keyword=&minPrice=&maxPrice=&sort=` | Public | Browse products from open shops with filters |
| GET | `/products/:id` | Public | Get one visible product |
| POST | `/products` | ADMIN, SHOP_OWNER, authorized STAFF | Create a product |
| PUT/PATCH | `/products/:id` | ADMIN, SHOP_OWNER, authorized STAFF | Update product details/status |
| DELETE | `/products/:id` | ADMIN, SHOP_OWNER, authorized STAFF | Delete a product |
| GET | `/myshop/products?shopId=&categoryId=&productStatus=&keyword=&outOfStock=&page=&limit=` | Shop owner or assigned shop staff | List own shop products |
| GET | `/myshop/products/:id?shopId=` | Shop owner or assigned shop staff | View own shop product |
| POST | `/myshop/products` | ADMIN or owning SHOP_OWNER | Create product and optionally upload images |
| PUT | `/myshop/products/:id` | ADMIN or owning SHOP_OWNER | Update product and optionally upload images |
| PATCH | `/myshop/products/:id/status` | ADMIN or owning SHOP_OWNER | Hide/show a product |
| GET | `/categories?shopId=&status=&search=&page=&limit=` | Public | List/filter categories |
| GET | `/categories/shop/:shopId` | Public | List categories for one shop |
| GET | `/categories/:id` | Public | Get a category |
| GET | `/shops/:id/categories` | Public | List ACTIVE categories for an open shop |
| GET | `/myshop/categories?shopId=&status=&keyword=&page=&limit=` | Shop owner or assigned shop staff | List own shop categories |
| POST | `/myshop/categories` | ADMIN or owning SHOP_OWNER | Create category for own shop |
| PUT | `/myshop/categories/:id` | ADMIN or owning SHOP_OWNER | Update own shop category |
| POST | `/categories` | ADMIN, owning SHOP_OWNER | Create a category |
| PUT/PATCH | `/categories/:id` | ADMIN, owning SHOP_OWNER | Update a category |
| DELETE | `/categories/:id` | ADMIN, owning SHOP_OWNER | Delete an unused category |
| GET | `/shops?page=1&limit=20&search=` | Public | Browse open approved shops |
| GET | `/shops/:id` | Public | Get an approved shop |
| PATCH | `/shops/:id` | ADMIN, owning SHOP_OWNER | Update shop details or OPEN/CLOSED status |
| GET | `/admin/shops?approvalStatus=&operationStatus=&search=&page=&limit=` | ADMIN | List/filter shops |
| PATCH | `/admin/shops/:id/status` | ADMIN | Reactivate or suspend a shop |

Product creation requires `shopId`, `categoryId`, `productName`, and `price`. A category must be active and belong to the same shop. Product stock is changed through inventory transactions so movements are auditable. For image upload, use `multipart/form-data` with field `images`; JPEG/PNG/WEBP/GIF are accepted, up to 2 MB per image and 10 images per request.

For `/myshop/...` routes, an owner with multiple shops or an admin must provide `shopId`; staff assigned to multiple shops must also provide it.

### Shop registration and staff

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/shop-requests` | CUSTOMER | Request shop approval (`shopName`, optional `description`) |
| GET | `/shop-requests/mine` | Signed in | View own requests |
| GET | `/admin/shop-requests?status=PENDING` | ADMIN | Review queue |
| GET | `/shop-requests?status=PENDING` | ADMIN | Alias for the review queue |
| PATCH | `/admin/shop-requests/:id/review` | ADMIN | Approve/reject with `status`; approval creates a shop and grants SHOP_OWNER |
| GET | `/shops/:shopId/staff` | ADMIN, owning SHOP_OWNER | List staff assignments |
| POST | `/shops/:shopId/staff` | ADMIN, owning SHOP_OWNER | Assign `{ "userId": "...", "role": "INVENTORY_STAFF" }` or `ORDER_STAFF` |
| DELETE | `/shops/:shopId/staff/:userId` | ADMIN, owning SHOP_OWNER | Remove a staff assignment |

### Shop statistics

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/myshop/statistics/revenue?shopId=&groupBy=day&from=YYYY-MM-DD&to=YYYY-MM-DD` | SHOP_OWNER or ADMIN | Revenue and paid order count by day or month |
| GET | `/myshop/statistics/topProducts?shopId=&limit=5&from=YYYY-MM-DD&to=YYYY-MM-DD` | SHOP_OWNER or ADMIN | Best-selling products by quantity and revenue |

Statistics include only orders that are both `DELIVERED` and `PAID`.

### Cart and orders

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/cart` | Signed in | Get cart items with current prices and calculated total |
| POST | `/cart/items` | Signed in | Add `{ "productId": "...", "quantity": 2 }` |
| POST | `/cart` | Signed in | Alias for adding an item |
| PATCH | `/cart/items/:productId` | Signed in | Set `{ "quantity": 3 }` |
| PUT | `/cart/items/:productId` | Signed in | Alias for setting quantity |
| DELETE | `/cart/items/:productId` | Signed in | Remove one item |
| DELETE | `/cart` | Signed in | Clear cart |
| POST | `/orders` or `/orders/checkout` | Signed in | Checkout; split cart into one order per shop |
| GET | `/orders?page=1&limit=20&shopId=&status=&orderStatus=` | Signed in | Customer's own orders or authorized shop orders |
| GET | `/orders/:id` | Customer, ADMIN, authorized order staff | Get order details |
| POST | `/orders/:id/pay` | Order owner | Simulate successful payment for an ONLINE order |
| POST | `/orders/:id/pay-simulate` | Order owner | Alias for simulated payment |
| PATCH/POST | `/orders/:id/cancel` | Order owner | Cancel own PENDING order |
| PATCH | `/orders/:id/status` | ADMIN, owning shop, ORDER_STAFF | Advance the order status |
| GET | `/myshop/orders?orderStatus=&paymentStatus=&from=&to=&shopId=` | Shop owner or ORDER_STAFF | List shop orders |
| GET | `/myshop/orders/:id?shopId=` | Shop owner or ORDER_STAFF | View a shop order |
| PATCH | `/myshop/orders/:id/confirm` | Shop owner or ORDER_STAFF | Confirm an order and deduct stock |
| PATCH | `/myshop/orders/:id/status` | Shop owner or ORDER_STAFF | Advance delivery status |
| PATCH | `/myshop/orders/:id/cancel` | Shop owner or ORDER_STAFF | Cancel a shop order; refund/restock as needed |

Checkout body example:

```json
{
  "shopId": "<shop ObjectId>",
  "shippingAddress": "25 Tran Hung Dao, Can Tho",
  "phone": "0912000007",
  "paymentMethod": "ONLINE"
}
```

`shopId` may be omitted. Checkout then creates one order for each shop represented in the cart. Include `shopId` to check out only one shop and leave other items in the cart. If `paymentMethod` is `ONLINE` (or the legacy alias `MOCK_ONLINE`), checkout creates the order as `UNPAID`; call `POST /orders/:id/pay` or `/orders/:id/pay-simulate` to simulate payment and mark it `PAID`. `COD` stays `UNPAID` until delivery, when it becomes `PAID`. No card details are accepted or stored.

Order status flow: `PENDING -> CONFIRMED -> PREPARING -> SHIPPING -> DELIVERED`. Stock is deducted when the shop confirms the order. The customer may cancel while `PENDING`; the shop may cancel before shipping. Canceling a confirmed/preparing order restores stock, and a paid ONLINE order becomes `REFUNDED` (simulated).

### Inventory and notifications

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/shops/:shopId/stock-transactions?page=1&limit=20&type=IMPORT` | ADMIN, owning SHOP_OWNER, INVENTORY_STAFF | List stock movements |
| POST | `/shops/:shopId/stock-transactions` | ADMIN, owning SHOP_OWNER, INVENTORY_STAFF | Import/export stock |
| POST | `/myshop/inventory/import` or `/inventory/import` | Shop owner or INVENTORY_STAFF | Import stock (`productId`, `quantity`, optional `note`) |
| POST | `/myshop/inventory/export` or `/inventory/export` | Shop owner or INVENTORY_STAFF | Export stock (`productId`, `quantity`, optional `note`) |
| GET | `/myshop/inventory/transactions?shopId=&productId=&type=&from=&to=&page=&limit=` | Shop owner or INVENTORY_STAFF | Filter stock transaction history |
| GET | `/myshop/inventory/alerts?shopId=&days=3` | Shop owner or INVENTORY_STAFF | List out-of-stock and near-expiry products |
| POST | `/products/:id/stock` | Shop owner or INVENTORY_STAFF | Import/export stock using `type`, `quantity`, `note` |
| GET | `/products/:id/stock-transactions` | Shop owner or INVENTORY_STAFF | List one product's stock history |
| GET | `/notifications?page=1&limit=20&isRead=false` | Signed in | List own notifications and unread count |
| PATCH | `/notifications/:id/read` | Signed in | Mark one notification read |
| PATCH | `/notifications/read-all` | Signed in | Mark all own notifications read |

Stock transaction body example:

```json
{
  "productId": "<product ObjectId>",
  "type": "IMPORT",
  "quantity": 20,
  "note": "October restock"
}
```
