const Razorpay = require("razorpay");
const { asyncChoke } = require("./asyncWrapper");
const AppError = require("./error");
const crypto = require("crypto");
const { pool } = require("../Config/database");
const { calculateBill, calculateBillForReOrder } = require("../Controllers/userBillController");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
exports.initaiteWalletRefill = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;
  const { offer_code: offerCode } = req.body;
  const delivery_tip = req.body.delivery_tip;
  const deliveryTip = Number(delivery_tip);

  try {
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
    let offer_id;

    if (offerCode) {
      const [offer] = await pool.query(
        `SELECT * FROM offers WHERE code = ? AND status = 'active'`,
        [offerCode]
      );
      // console.log("ok", offer.length);
      if (offer.length === 0) {
        return next(new AppError(400, "Invalid or expired offer code"));
      }

      offer_id = offer[0].id;

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

    const bill = await calculateBill(next, data);

    const options = {
      amount: bill.total_bill * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        purpose: "Product Buy",
        user_address: user_address[0],
        user_id: user_id,
        bill: bill,
        offer_id: offer_id,
      },
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json({
      success: true,
      message: "Order initiated successfully!",
      order,
    });
  } catch (error) {
    console.log(error);
  }
});


exports.initiateReOrder = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;
  const { order_id, offer_code: offerCode, delivery_tip } = req.body;
  const deliveryTip = Number(delivery_tip) || 0;

  try {
    if (!order_id) {
      return next(new AppError(400, "Order ID is required"));
    }
    // Fetch original order details
    const [originalOrder] = await pool.query(
      `SELECT o.*, i.price 
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN items i ON oi.item_id = i.id
      WHERE o.id = ? AND o.user_id = ?`,
      [order_id, user_id]
    );

    const [useraddress] = await pool.query("SELECT * FROM useraddress WHERE user_id = ? AND selected = ?", [user_id, true]);
    if (!useraddress || !useraddress.length) {
      return next(new AppError(404, "No address selected"));
    }
    console.log(useraddress);
    if (originalOrder.length === 0) {
      return next(new AppError(404, "Original order not found"));
    }

    if (originalOrder[0].order_status !== "delivered" && originalOrder[0].order_status !== "cancelled") {
      return next(new AppError(400, "This order is already in progress!"));
    }

    const originalOrderDetails = originalOrder[0];

    // Fetch original order items
    const [originalOrderItems] = await pool.query(
      `SELECT oi.*, i.price
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      WHERE order_id = ?`,
      [order_id]
    );

    if (originalOrderItems.length === 0) {
      return next(new AppError(404, "No items found for the original order"));
    }

    // Fetch items details
    const [items] = await pool.query(
      `SELECT * FROM items WHERE id IN (?)`,
      [originalOrderItems.map((item) => item.item_id)]
    );

    // Check if any item is inactive
    for (let i = 0; i < items.length; i++) {
      if (!items[i].is_active) {
        return next(new AppError(400, "One of the items in this order bundle is removed by the restaurant"));
      }
    }

    

    let offer_id;

    if (offerCode) {
      const [offer] = await pool.query(
        `SELECT * FROM offers WHERE code = ? AND status = 'active'`,
        [offerCode]
      );
      // console.log("ok", offer.length);
      if (offer.length === 0) {
        return next(new AppError(400, "Invalid or expired offer code"));
      }

      offer_id = offer[0].id;

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
      userLat: useraddress[0].lat,
      userLon: useraddress[0].lon,
      offer_code: offerCode,
      originalOrderItems: originalOrderItems,
      items: items,
      
    };

    const bill = await calculateBillForReOrder(next, data);
    console.log(bill);

    const options = {
      amount: bill.total_bill * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        purpose: "Product Buy",
        user_address: originalOrderDetails,
        user_id: user_id,
        bill: bill,
        offer_id: offer_id || null,
      },
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json({
      success: true,
      message: "Order initiated successfully!",
      order,
    });
  } catch (error) {
    console.log(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.verifyPaymentOrder = async (
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature
) => {
  const sha = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const digest = sha.digest("hex");
  if (digest !== razorpay_signature) return false;
  const trx = await razorpay.payments.fetch(razorpay_payment_id);

  return trx;
};
