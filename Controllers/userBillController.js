const { pool } = require("../Config/database");
const AppError = require("../Utils/error");
const { asyncChoke } = require("../Utils/asyncWrapper");
const { default: axios } = require("axios");

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

  const API_KEY = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${userLon},${userLat}&end=${restaurantLocation[0].longitude},${restaurantLocation[0].latitude}`;
  console.log(url);

  try {
    const response = await axios({
      method: "GET",
      url: url,
    });

    const distanceInMeters =
      response.data.features[0].properties.segments[0].distance;
    const distanceInKilometers = distanceInMeters / 1000;
    distance = distanceInKilometers.toFixed(2);
  } catch (err) {
    return next(new AppError(400, err));
  }

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
    delivery_fee: delivery_fee,
    delivery_tip: deliveryTip,
    platform_fee: PLATFORM_FEE,
    gst_and_restaurant_charges: gst_and_restaurant_charges,
    total_bill: total_bill,
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
