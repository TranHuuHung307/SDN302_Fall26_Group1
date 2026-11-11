// Chay trong tab MONGOSH cua Compass (hoac: mongosh fruit_fresh_commerce indexes.js)
// sau khi da import xong cac file .json
db = db.getSiblingDB("fruit_fresh_commerce");
db.users.createIndex({"email":1}, {"unique":true});
db.shops.createIndex({"ownerId":1});
db.shop_staff.createIndex({"shopId":1,"userId":1}, {"unique":true});
db.categories.createIndex({"shopId":1,"categoryName":1}, {"unique":true});
db.products.createIndex({"shopId":1,"categoryId":1});
db.products.createIndex({"productName":"text"});
db.orders.createIndex({"customerId":1,"createdAt":-1});
db.orders.createIndex({"shopId":1,"orderStatus":1});
db.stock_transactions.createIndex({"productId":1,"createdAt":-1});
db.carts.createIndex({"customerId":1}, {"unique":true});
db.notifications.createIndex({"receiverId":1,"isRead":1,"createdAt":-1});
db.shop_registration_requests.createIndex({"status":1});
