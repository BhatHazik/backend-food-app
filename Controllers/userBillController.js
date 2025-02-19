const { pool } = require("../Config/database");
const AppError = require("../Utils/error");
const { asyncChoke } = require("../Utils/asyncWrapper");
const { default: axios } = require("axios");
const { getRouteDistance } = require("../Utils/utils");

exports.calculateBill = asyncChoke(async (next, data) => {
  const {
    userLat,
    userLon,
    user_id,
    offer_code: offerCode,
    delivery_tip: deliveryTip,
  } = data;

  // Fetch app settings dynamically
  const [appSettings] = await pool.query(`SELECT * FROM app_settings LIMIT 1`);
  const PER_KM_FEE = parseFloat(appSettings[0].per_km_fee);
  const PLATFORM_FEE = parseFloat(appSettings[0].platform_fee);
  const RESTAURANT_CHARGES_RATE = parseFloat(appSettings[0].restaurant_charges_rate);

  let distance;
  const [cart] = await pool.query(`SELECT * FROM cart WHERE user_id = ?`, [
    user_id,
  ]);

  const cart_id = cart[0].id;

  const itemTotalQuery = `
        SELECT SUM(item_total) AS total_amount
        FROM cart_items
        WHERE cart_id = ?
    `;

  const [result] = await pool.query(itemTotalQuery, [cart_id]);
  console.log(result);
  const [restaurantLocation] = await pool.query(
    `
        SELECT ra.latitude, ra.longitude
        FROM cart c
        JOIN cart_items ci ON c.id = ci.cart_id
        JOIN items i ON ci.item_id = i.id
        JOIN categories cat ON i.category_id = cat.id
        JOIN menus m ON cat.menu_id = m.id
        JOIN restaurantaddress ra ON m.restaurant_id = ra.restaurant_id
        WHERE c.id = ?;
    `,
    [cart_id]
  );

  
  // console.log(userLon, );

    const response = await getRouteDistance(userLat,userLon,restaurantLocation[0].latitude,restaurantLocation[0].longitude);
    console.log(response);
    distance = response.distanceValue / 1000;
    // console.log(result[0].total_amount);
  let item_total = parseFloat(result[0].total_amount);
  let item_discount = 0;

  if (offerCode) {
    const [offer] = await pool.query(
      `SELECT * FROM offers WHERE code = ? AND status = 'active'`,
      [offerCode]
    );

    if (offer[0].discount_type === "percentage") {
      const discountValue =
        (item_total * parseFloat(offer[0].discount_value)) / 100;
      item_discount = Math.min(
        discountValue,
        parseFloat(offer[0].maximum_discount_amount)
      );
    } else if (offer[0].discount_type === "fixed_amount") {
      item_discount = parseFloat(offer[0].discount_value);
    }
  }

  const gst_and_restaurant_charges = RESTAURANT_CHARGES_RATE * item_total;

  const delivery_fee = distance * PER_KM_FEE;
  console.log("delivery_fee", delivery_fee, distance);

  const total_bill =
    item_total -
    item_discount +
    delivery_fee +
    deliveryTip +
    PLATFORM_FEE +
    gst_and_restaurant_charges;

  const dataToSend = {
    item_total: item_total,
    item_discount: item_discount,
    delivery_fee: Number(delivery_fee.toFixed(2)),
    delivery_tip: deliveryTip,
    platform_fee: PLATFORM_FEE,
    gst_and_restaurant_charges: gst_and_restaurant_charges,
    total_bill: total_bill,
  };

  return dataToSend;
});


exports.calculateBillForReOrder = asyncChoke(async (next, data) => {
  const {
    userLat,
    userLon,
    user_id,
    offer_code: offerCode,
    delivery_tip: deliveryTip,
    items,
    originalOrderItems,
  } = data;

  // Fetch app settings dynamically
  const [appSettings] = await pool.query(`SELECT * FROM app_settings LIMIT 1`);
  const PER_KM_FEE = parseFloat(appSettings[0].per_km_fee);
  const PLATFORM_FEE = parseFloat(appSettings[0].platform_fee);
  const RESTAURANT_CHARGES_RATE = parseFloat(appSettings[0].restaurant_charges_rate);

  let distance;

 console.log("hii",originalOrderItems);
  let item_total = 0;
  for (let i = 0; i < originalOrderItems.length; i++) {
    item_total += parseFloat(originalOrderItems[i].price) * parseInt(originalOrderItems[i].quantity);
  }
  console.log(item_total);


  const [restaurantLocation] = await pool.query(
    `
        SELECT ra.latitude, ra.longitude
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN items i ON oi.item_id = i.id
        JOIN categories cat ON i.category_id = cat.id
        JOIN menus m ON cat.menu_id = m.id
        JOIN restaurantaddress ra ON m.restaurant_id = ra.restaurant_id
        WHERE o.id = ?;
    `,
    [originalOrderItems[0].order_id]
  );
console.log(restaurantLocation
);
  const response = await getRouteDistance(userLat, userLon, restaurantLocation[0].latitude, restaurantLocation[0].longitude);
  distance = response.distanceValue / 1000;

  let item_discount = 0;

  if (offerCode) {
    const [offer] = await pool.query(
      `SELECT * FROM offers WHERE code = ? AND status = 'active'`,
      [offerCode]
    );

    if (offer.length > 0) {
      if (offer[0].discount_type === "percentage") {
        const discountValue =
          (item_total * parseFloat(offer[0].discount_value)) / 100;
        item_discount = Math.min(
          discountValue,
          parseFloat(offer[0].maximum_discount_amount)
        );
      } else if (offer[0].discount_type === "fixed_amount") {
        item_discount = parseFloat(offer[0].discount_value);
      }
    }
  }

  const gst_and_restaurant_charges = RESTAURANT_CHARGES_RATE * item_total;

  const delivery_fee = distance * PER_KM_FEE;

  const total_bill =
    item_total -
    item_discount +
    delivery_fee +
    deliveryTip +
    PLATFORM_FEE +
    gst_and_restaurant_charges;

  const dataToSend = {
    item_total: parseFloat(item_total.toFixed(2)),
    item_discount: parseFloat(item_discount.toFixed(2)),
    delivery_fee: parseFloat(delivery_fee.toFixed(2)),
    delivery_tip: parseFloat(deliveryTip.toFixed(2)),
    platform_fee: parseFloat(PLATFORM_FEE.toFixed(2)),
    gst_and_restaurant_charges: parseFloat(gst_and_restaurant_charges.toFixed(2)),
    total_bill: parseFloat(total_bill.toFixed(2)),
  };

  return dataToSend;
});


exports.getMyBill = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;
  const offerCode = req.query.offer_code;
  const delivery_tip = req.query.delivery_tip;
  const deliveryTip = Number(delivery_tip);

  const [user_address] = await pool.query(
    `SELECT * FROM useraddress WHERE user_id = ? AND selected = ?`,
    [user_id, true]
  );
  if (user_address.length === 0) {
    return next(new AppError(404, "No address selected"));
  }

  const [cart] = await pool.query(`SELECT * FROM cart WHERE user_id = ?`, [
    user_id,
  ]);
  if (!cart.length) {
    return next(new AppError(404, "Cart not found for the given user"));
  }

  const cart_id = cart[0].id;

  const itemTotalQuery = `
        SELECT SUM(item_total) AS total_amount
        FROM cart_items
        WHERE cart_id = ?
    `;

  const [result] = await pool.query(itemTotalQuery, [cart_id]);
  console.log(result, cart_id);
  if (!result || !result.length || !result[0].total_amount) {
    return next(
      new AppError(404, "No items found in the cart for the given user")
    );
  }

  let item_total = parseFloat(result[0].total_amount);

  if (offerCode) {
    const [offer] = await pool.query(
      `SELECT * FROM offers WHERE code = ? AND status = 'active'`,
      [offerCode]
    );
    if (offer.length === 0) {
      return next(new AppError(400, "Invalid or expired offer code"));
    }
    const offer_id = offer[0].id;

    const [userOffer] = await pool.query(
      `SELECT * FROM user_used_offer WHERE user_id = ? AND offer_id = ?`,
      [user_id, offer_id]
    );
    if (userOffer.length) {
      return next(new AppError(400, "Offer code already been used"));
    }

    if (item_total < parseFloat(offer[0].minimum_order_amount)) {
      return next(
        new AppError(
          400,
          `To apply this offer your order should be a minimum of ${offer[0].minimum_order_amount}`
        )
      );
    }
  }

  const data = {
    user_id: user_id,
    delivery_tip: deliveryTip,
    userLat: user_address[0].lat,
    userLon: user_address[0].lon,
    offer_code: offerCode,
  };
  const bill = await this.calculateBill(next, data);
  return res.status(200).json({
    status: "success",
    data: {
      bill,
    },
  });
});
