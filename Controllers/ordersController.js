const db = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");

// Define constants
const PER_KM_FEE = 10;
const PLATFORM_FEE = 5; // Example platform fee amount, adjust as needed
const RESTAURANT_CHARGES_RATE = 0.15; // GST and restaurant charges rate

exports.createOrder = async (req, res, next) => {
  const user_id = req.user.id;
  const distance = req.params.distance; // Assuming distance is passed in the request params
  const deliveryTip = parseFloat(req.params.delivery_tip) || 0; // Default to 0 if delivery tip is not provided
  const offerCode = req.params.code; // Optional offer code
  const { paymentPassKey } = req.body;

  try {
    // Check if the user has any orders in process
    const [userOrderCheck] = await db.query(
      "SELECT * FROM orders WHERE user_id = ?",
      [user_id]
    );
    if (userOrderCheck.length > 0) {
      const [orderCheck] = await db.query(
        "SELECT * FROM orders WHERE user_id = ? AND order_status IN (?, ?, ?, ?)",
        [user_id, "pending", "confirmed", "on the way", "arrived"]
      );
      if (orderCheck.length > 0) {
        return next(
          new AppError(401, "Your previous order is already in process!")
        );
      }
    }
    // Verify payment pass key
    if (paymentPassKey !== "hrod49chr5") {
      return next(new AppError(404, "Payment Not Found!"));
    }

    // Step 1: Retrieve the cart_id for the user
    const [cart] = await db.execute("SELECT id FROM cart WHERE user_id = ?", [
      user_id,
    ]);
    if (cart.length === 0) return next(new AppError(404, "Cart not found"));

    const cart_id = cart[0].id;

    // Query to calculate total amount of items in the cart
    const itemTotalQuery = `
    SELECT c.user_id, SUM(i.price * ci.quantity) AS total_amount
    FROM cart c
    JOIN cart_items ci ON c.id = ci.cart_id
    JOIN items i ON ci.item_id = i.id
    WHERE c.user_id = ?
    GROUP BY c.user_id
    `;

    // Execute the query to get item total
    const [result] = await db.query(itemTotalQuery, [user_id]);
    if (!result || !result.length) {
      return next(
        new AppError(404, "No items found in the cart for the given user")
      );
    }

    // Extract item_total from result
    let item_total = parseFloat(result[0].total_amount);
    let item_discount = 0; // Initialize item_discount to 0

    // Apply offer code if provided
    if (offerCode) {
      const [offer] = await db.query(
        `SELECT * FROM offers WHERE code = ? AND status = 'active'`,
        [offerCode]
      );
      if (offer.length === 0) {
        return next(new AppError(400, "Invalid or expired offer code"));
      }
      const offer_id = offer[0].id;

      // Check if user has already used this offer
      const [userOffer] = await db.query(
        `SELECT * FROM user_used_offer WHERE user_id = ? AND offer_id = ?`,
        [user_id, offer_id]
      );
      if (userOffer.length) {
        return next(new AppError(400, "Offer code already been used"));
      }

      // Check if the order meets the minimum order amount
      if (item_total < parseFloat(offer[0].minimum_order_amount)) {
        return next(
          new AppError(
            400,
            `To apply this offer your order should be a minimum of ${offer[0].minimum_order_amount}`
          )
        );
      }

      // Calculate discount based on discount type
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

    // Calculate GST and restaurant charges
    const gst_and_restaurant_charges = RESTAURANT_CHARGES_RATE * item_total;

    // Calculate distance fee
    const delivery_fee = distance * PER_KM_FEE;

    // Calculate total bill including all components
    const total_bill =
      item_total -
      item_discount +
      delivery_fee +
      deliveryTip +
      PLATFORM_FEE +
      gst_and_restaurant_charges;

    // Insert bill into bills table
    const billQuery =
      "INSERT INTO bills (item_total, delivery_fee, item_discount, delivery_tip, platform_fee, gst_and_restaurant_charges, total_bill, user_id) VALUES (?,?,?,?,?,?,?,?)";
    const billValues = [
      item_total,
      delivery_fee,
      item_discount,
      deliveryTip,
      PLATFORM_FEE,
      gst_and_restaurant_charges,
      total_bill,
      user_id,
    ];
    const [insert_bill] = await db.query(billQuery, billValues);

    // Retrieve the bill ID
    const bill_id_query = "SELECT * FROM bills WHERE user_id = ? AND status = ?";
    const bill_id_value = [user_id, "unpaid"];
    const [bill] = await db.query(bill_id_query, bill_id_value);
    const bill_id = bill[0].id;

    // Step 2: Retrieve cart_items for the cart_id
    const [cart_items] = await db.execute(
      "SELECT id, item_id, quantity FROM cart_items WHERE cart_id = ?",
      [cart_id]
    );
    if (cart_items.length === 0)
      return next(new AppError(404, "No items in the cart"));

    // Step 3: Get restaurant_id from the first cart_item
    const first_item_id = cart_items[0].item_id;
    const [item] = await db.execute(
      "SELECT category_id FROM items WHERE id = ?",
      [first_item_id]
    );
    if (item.length === 0) {
      return next(new AppError(404, "Item not found"));
    }

    const category_id = item[0].category_id;
    const [category] = await db.execute(
      "SELECT menu_id FROM categories WHERE id = ?",
      [category_id]
    );
    if (category.length === 0)
      return next(new AppError(404, "Category not found"));

    const menu_id = category[0].menu_id;
    const [menu] = await db.execute(
      "SELECT restaurant_id FROM menus WHERE id = ?",
      [menu_id]
    );
    if (menu.length === 0) return next(new AppError(404, "Menu not found"));

    const restaurant_id = menu[0].restaurant_id;

    // Step 4: Insert into orders table
    const [orderResult] = await db.execute(
      "INSERT INTO orders (user_id, order_status, restaurant_id) VALUES (?, ?, ?)",
      [user_id, "pending", restaurant_id]
    );
    const order_id = orderResult.insertId;

    // Step 5: Insert into order_items table
    const orderItemsData = cart_items.map((item) => [
      order_id,
      item.item_id,
      item.quantity,
    ]);
    await db.query(
      "INSERT INTO order_items (order_id, item_id, quantity) VALUES ?",
      [orderItemsData]
    );

    // Step 6: Insert customizations into order_item_customisation table
    for (const cart_item of cart_items) {
      const cart_item_id = cart_item.id;
      const order_item_id_query = `
        SELECT id FROM order_items WHERE order_id = ? AND item_id = ?`;
      const [order_item] = await db.query(order_item_id_query, [
        order_id,
        cart_item.item_id,
      ]);
      const order_item_id = order_item[0].id;

      const customizationsQuery = `
        SELECT title_id, option_id FROM cart_item_customizations WHERE cart_item_id = ?`;
      const [customizations] = await db.query(customizationsQuery, [
        cart_item_id,
      ]);

      const orderItemCustomizationsData = customizations.map((custom) => [
        order_item_id,
        custom.title_id,
        custom.option_id,
      ]);
      if (orderItemCustomizationsData.length > 0) {
        await db.query(
          "INSERT INTO order_item_customisation (order_items_id, title_id, option_id) VALUES ?",
          [orderItemCustomizationsData]
        );
      }
    }

    // Update bill status to 'paid' and associate with the order
    const [billUpdate] = await db.query(
      `UPDATE bills SET status = ?, order_id = ? WHERE id = ?`,
      ["paid", order_id, bill_id]
    );
    
    // Return the created order as a response
    res.status(201).json({
      status: "success",
      data: {
        order_id,
      },
    });
  } catch (error) {
    return next(new AppError(500, "Internal Server Error", error));
  }
};



exports.getOrderDetails = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;

  try {
    // Step 1: Retrieve the newest order for the user_id
    const [orders] = await db.execute(
      "SELECT id, order_status, restaurant_id, delivery_boy_id FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
      [user_id]
    );
    if (orders.length === 0) {
      return next(new AppError(404, "No orders found for this user"));
    }

    const order = orders[0];
    const order_id = order.id;
    const restaurant_id = order.restaurant_id;
    const delivery_boy_id = order.delivery_boy_id;

    // Step 2: Get item count from order_items
    const [orderItemsCount] = await db.execute(
      "SELECT COUNT(*) as item_count FROM order_items WHERE order_id = ?",
      [order_id]
    );
    const item_count = orderItemsCount[0].item_count;

    // Step 3: Get restaurant name
    const [restaurant] = await db.execute(
      "SELECT restaurant_name FROM restaurants WHERE id = ?",
      [restaurant_id]
    );
    if (restaurant.length === 0) {
      return next(new AppError(404, "Restaurant not found"));
    }

    const restaurant_name = restaurant[0].restaurant_name;

    // Construct the detailed order information
    const orderDetails = {
      order_id,
      order_status: order.order_status,
      item_count,
      restaurant_name,
      delivery_boy_id,
    };

    // Return the detailed order information as a response
    res.status(200).json({
      status: "success",
      data: orderDetails,
    });
  } catch (error) {
    console.log(error);
    return next(new AppError(500, "Internal Server Error"));
  }
});
