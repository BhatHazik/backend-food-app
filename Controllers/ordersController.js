const {pool} = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const { emitOrderStatus, getSocketIoServer } = require("../Utils/socketHandler");
const { calculateBill } = require("./userBillController");

exports.createOrder = async (req, res, next) => {
  const user_id = req.user.id;
  const { offerCode, paymentPassKey, deliveryTip, transaction_id, payment_type } = req.body;
// console.log(payment_type);
  try {
    // Validate payment pass key
    if (paymentPassKey !== "hrod49chr5") {
      return next(new AppError(404, "Payment Not Found!"));
    }
    if (payment_type !== 'card' && payment_type !== 'upi' && payment_type !== 'net banking' && payment_type !== 'wallets' && payment_type !== 'cod') {
      return next(new AppError(400, "Invalid payment type"));
    }    

    const [user_address] = await pool.query(`SELECT * FROM useraddress WHERE user_id = ? AND selected = ?`,[user_id,true])
    if(user_address.length === 0){
      return next(new AppError(404, "Address not selected"));
    }

    const [cart] = await pool.query(`SELECT * FROM cart WHERE user_id = ?`, [
      user_id,
    ]);
    if (!cart.length) {
      return next(new AppError(404, "Cart not found for the given user"));
    }
  
    const cart_id = cart[0].id;
    // Query to fetch and sum item totals from `cart_items`
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
  // Extract item_total from the result
  let item_total = parseFloat(result[0].total_amount);
  
  
    if (offerCode) {
      const [offer] = await pool.query(
        `SELECT * FROM offers WHERE code = ? AND status = 'active'`,
        [offerCode]
      );
      console.log("ok", offer.length);
      if (offer.length === 0) {
        return next(new AppError(400, "Invalid or expired offer code"));
      }
      const offer_id = offer[0].id;
  
      // Check if the user has already used this offer
      const [userOffer] = await pool.query(
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
    }

    // Prepare data for calculating the bill
    const data = {
      user_id: user_id,
      offer_code: offerCode,
      delivery_tip: parseFloat(deliveryTip) || 0, // default to 0 if no delivery tip provided
      userLat: user_address[0].lat,
      userLon: user_address[0].lon,
    };


    // Calculate the bill
    const billData = await calculateBill(next, data);


    
    const [insertAddress] = await pool.query(`
      INSERT INTO orderaddress 
      (state, city, area, house_no, lat, lon, type, R_name, R_phone_no, user_id)
      VALUES (?,?,?,?,?,?,?,?,?,?);
      `,[user_address[0].state, user_address[0].city, user_address[0].area, user_address[0].house_no, user_address[0].lat, user_address[0].lon, user_address[0].type, user_address[0].R_name, user_address[0].R_phone_no, user_id]);

    

    // Fetch cart items from the database
    const [cartItems] = await pool.query(`
      SELECT 
        ci.id AS cart_item_id, 
        ci.item_id AS item_id, 
        ci.quantity AS quantity, 
        c.id AS cart_id, 
        r.id AS restaurant_id,
        i.customisation 
      FROM users u
      JOIN cart c ON u.id = c.user_id
      JOIN cart_items ci ON c.id = ci.cart_id
      JOIN items i ON ci.item_id = i.id
      JOIN categories cat ON i.category_id = cat.id
      JOIN menus m ON cat.menu_id = m.id
      JOIN restaurants r ON m.restaurant_id = r.id
      WHERE u.id = ?
    `, [user_id]);

    // Make sure that the cartItems array is not empty before proceeding
    if (!cartItems.length) {
      return next(new AppError(400, "No items in the cart!"));
    }
    const [billInsertion] = await pool.query(`INSERT INTO bills (item_total,delivery_fee,item_discount, delivery_tip, platform_fee,gst_and_restaurant_charges,total_bill, user_id, transaction_id, payment_type) VALUES(?,?,?,?,?,?,?,?,?,?)`,[billData.item_total,billData.delivery_fee, billData.item_discount,billData.delivery_tip, billData.platform_fee, billData.gst_and_restaurant_charges, billData.total_bill, user_id,transaction_id, payment_type])
    // Insert order into the orders table
    const [order] = await pool.query(`
      INSERT INTO orders (user_id, restaurant_id, order_status, bill_id, res_amount, del_amount) 
      VALUES (?, ?, ?,?,?,?)
    `, [user_id, cartItems[0].restaurant_id, "pending", billInsertion.insertId, billData.item_total,billData.delivery_fee]);

       await pool.query(`UPDATE orderaddress SET order_id = ? WHERE id = ?`,[order.insertId, insertAddress.insertId]);

    // Insert items into the order_items table
    for (let i = 0; i < cartItems.length; i++) {
      // Insert item into order_items
      const [orderItem] = await pool.query(`
        INSERT INTO order_items (order_id, item_id, quantity) 
        VALUES (?, ?, ?)
      `, [order.insertId, cartItems[i].item_id, cartItems[i].quantity]);

      
 
      // If the item has customizations, add them to the order_item_customizations table
      if (cartItems[i].customisation) {
        const [customization] = await pool.query(`
          SELECT * FROM cart_item_customizations 
          WHERE cart_item_id = ?
        `, [cartItems[i].cart_item_id]);

        if (customization.length > 0) {
          for (const custom of customization) {
            // Insert each customization into the order_item_customisation table
            await pool.query(`
              INSERT INTO order_item_customisation (order_items_id, title_id, option_id) 
              VALUES (?, ?, ?)
            `, [orderItem.insertId, custom.title_id, custom.option_id]);
          }
        }
      }
    }

    const io = getSocketIoServer();
    const restaurantSocket = io.connectedRestaurants[cartItems[0].restaurant_id];
    console.log("restaurant socket",restaurantSocket);
    if (restaurantSocket) {
     
        const restaurant_id = cartItems[0].restaurant_id;
        const order_id = order.insertId;
      
        // Fetch the user's order
        const [orders] = await pool.query(`
          SELECT
              o.id, 
              o.res_amount, 
              o.created_at,
              o.user_id, 
              o.restaurant_id, 
              o.bill_id,
              o.order_status,
              oa.area AS user_area,
              oa.house_no AS user_house_no,
              oa.city AS user_city,
              oa.lat AS user_latitude,
              oa.lon AS user_longitude,
              ra.street AS restaurant_street,
              ra.area AS restaurant_area,
              ra.city AS restaurant_city,
              ra.latitude AS restaurant_latitude,
              ra.longitude AS restaurant_longitude,
              b.payment_type
          FROM orders o
          JOIN orderaddress oa ON oa.order_id = o.id
          JOIN restaurantaddress ra ON ra.restaurant_id = o.restaurant_id
          JOIN bills b ON b.id = o.bill_id
          WHERE o.restaurant_id = ? AND o.id = ?`, [restaurant_id, order_id]);
      
        if (orders.length === 0) {
          return next(new AppError(404, "Order not found or does not belong to this restaurant"));
        }
      
        // Fetch order items
        const fetchOrderItemsQuery = `
          SELECT 
              oi.order_id,
              o.created_at,
              oi.id as order_item_id, 
              oi.item_id,
              oi.quantity, 
              i.name as item_name, 
              i.price as item_price
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          JOIN items i ON oi.item_id = i.id
          WHERE oi.order_id = ?
        `;
        const [orderItems] = await pool.query(fetchOrderItemsQuery, [order_id]);
      
        if (orderItems.length === 0) {
          return res.status(200).json({
            status: 'success',
            data: {
              order_details: orders[0],  // Include the order details in the response
              items: []
            }
          });
        }
      
        // Fetch and attach customizations for each order item
        const fetchCustomizationsQuery = `
          SELECT
              oic.order_items_id,
              oic.title_id,
              ct.title,
              oic.option_id,
              co.option_name,
              co.additional_price,
              ct.selection_type
          FROM order_item_customisation oic
          JOIN customisation_title ct ON oic.title_id = ct.id
          JOIN customisation_options co ON oic.option_id = co.id
          WHERE oic.order_items_id IN (?)
        `;
        const orderItemIds = orderItems.map(item => item.order_item_id);
        const [customizations] = await pool.query(fetchCustomizationsQuery, [orderItemIds]);
      
        // Structure customizations for easier access
        const customizationsByOrderItem = {};
        customizations.forEach(customization => {
          const { order_items_id, title, option_id, option_name, additional_price, selection_type, title_id } = customization;
      
          if (!customizationsByOrderItem[order_items_id]) {
            customizationsByOrderItem[order_items_id] = {};
          }
      
          if (!customizationsByOrderItem[order_items_id][title]) {
            customizationsByOrderItem[order_items_id][title] = {
              selection_type,
              title,
              title_id,
              options: []
            };
          }
      
          customizationsByOrderItem[order_items_id][title].options.push({
            option_id,
            option_name,
            additional_price
          });
        });
      
        // Attach customizations to order items
        const resultItems = orderItems.map(item => ({
          ...item,
          customizations: customizationsByOrderItem[item.order_item_id] || {}
        }));
      
        
        
     const data =  {
      order_details: orders[0],  // Include order details as the first part
      items: resultItems          // Include items with their customizations
    }
      io.to(restaurantSocket).emit('newOrder', data);
    }

    // Return the success response
    return res.status(200).json({
      status: "success",
      message:"Order initiated successfully",
      data: {
        cartItems: cartItems,
        bill: billData,
      }
    });

  } catch (error) {
    console.log(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
};

exports.reorder = async (req, res, next) => {
  const user_id = req.user.id;
  const { order_id, paymentPassKey, payment_type, deliveryTip, transaction_id } = req.body;

  try {
    // Validate payment pass key
    if (paymentPassKey !== "hrod49chr5") {
      return next(new AppError(404, "Payment Not Found!"));
    }
    if (!order_id) {
      return next(new AppError(400, "Order ID is required"));
    }
    if (payment_type !== 'card' && payment_type !== 'upi' && payment_type !== 'net banking' && payment_type !== 'wallets' && payment_type !== 'cod') {
      return next(new AppError(400, "Invalid payment type"));
    }

    // Fetch user address
    const [user_address] = await pool.query(`SELECT * FROM useraddress WHERE user_id = ? AND selected = ?`, [user_id, true]);
    if (user_address.length === 0) {
      return next(new AppError(404, "Address not selected"));
    }

    // Fetch the previous order details
    const [orderDetails] = await pool.query(`
      SELECT 
        o.id AS order_id, 
        o.restaurant_id, 
        o.order_status, 
        r.restaurant_name, 
        ra.street AS restaurant_address
      FROM orders o
      JOIN restaurants r ON o.restaurant_id = r.id
      JOIN restaurantaddress ra ON ra.restaurant_id = r.id
      WHERE o.id = ? AND o.user_id = ?
    `, [order_id, user_id]);

    if (orderDetails.length === 0) {
      return next(new AppError(404, "Order not found or does not belong to the user"));
    }

    const order = orderDetails[0];

    // Prepare data for calculating the bill
    const data = {
      user_id: user_id,
      offer_code: null,  // No offer code for reorder (if any, it can be modified)
      delivery_tip: parseFloat(deliveryTip) || 0, // default to 0 if no delivery tip provided
      userLat: user_address[0].lat,
      userLon: user_address[0].lon,
    };

    // Calculate the bill (use previous items or create new calculation logic if needed)
    const billData = await calculateBill(next, data);

    // Insert into orderaddress table
    const [insertAddress] = await pool.query(`
      INSERT INTO orderaddress 
      (state, city, area, house_no, lat, lon, type, R_name, R_phone_no, user_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `, [
      user_address[0].state, user_address[0].city, user_address[0].area, user_address[0].house_no, 
      user_address[0].lat, user_address[0].lon, user_address[0].type, user_address[0].R_name, 
      user_address[0].R_phone_no, user_id
    ]);

    // Fetch previous order items
    const [orderItems] = await pool.query(`
      SELECT 
        oi.id AS order_item_id, 
        oi.item_id, 
        oi.quantity, 
        i.name AS item_name, 
        i.price AS item_price
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      WHERE oi.order_id = ?
    `, [order_id]);

    if (!orderItems.length) {
      return next(new AppError(400, "No items in the past order"));
    }

    // Insert into bills table
    const [billInsertion] = await pool.query(`
      INSERT INTO bills 
      (item_total, delivery_fee, item_discount, delivery_tip, platform_fee, gst_and_restaurant_charges, total_bill, user_id, transaction_id, payment_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      billData.item_total, billData.delivery_fee, billData.item_discount, billData.delivery_tip, 
      billData.platform_fee, billData.gst_and_restaurant_charges, billData.total_bill, 
      user_id, transaction_id, payment_type
    ]);

    // Insert order into orders table
    const [newOrder] = await pool.query(`
      INSERT INTO orders 
      (user_id, restaurant_id, order_status, bill_id, res_amount, del_amount) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      user_id, order.restaurant_id, "pending", billInsertion.insertId, 
      billData.item_total, billData.delivery_fee
    ]);

    // Update order address with new order ID
    await pool.query(`UPDATE orderaddress SET order_id = ? WHERE id = ?`, [newOrder.insertId, insertAddress.insertId]);

    // Insert items into the order_items table
    const customizationsByOrderItem = {}; // Create an object to store customizations
    for (let i = 0; i < orderItems.length; i++) {
      const [newOrderItem] = await pool.query(`
        INSERT INTO order_items 
        (order_id, item_id, quantity) 
        VALUES (?, ?, ?)
      `, [newOrder.insertId, orderItems[i].item_id, orderItems[i].quantity]);

      // Fetch customizations for the item
      const [customizations] = await pool.query(`
        SELECT * FROM order_item_customisation 
        WHERE order_items_id = ?
      `, [orderItems[i].order_item_id]);

      // Store customizations in customizationsByOrderItem object
      customizationsByOrderItem[orderItems[i].order_item_id] = customizations.map(custom => ({
        title_id: custom.title_id,
        option_id: custom.option_id
      }));

      if (customizations.length > 0) {
        for (const customization of customizations) {
          await pool.query(`
            INSERT INTO order_item_customisation (order_items_id, title_id, option_id) 
            VALUES (?, ?, ?)
          `, [newOrderItem.insertId, customization.title_id, customization.option_id]);
        }
      }
    }

    // Return success response with new order details
    res.status(200).json({
      status: "success",
      message: "Order successfully placed again.",
      data: {
        order_id: newOrder.insertId,
        restaurant_id: order.restaurant_id,
        order_status: "pending",
        restaurant_name: order.restaurant_name,
        restaurant_address: order.restaurant_address,
        items: orderItems.map(item => ({
          order_item_id: item.order_item_id,
          item_id: item.item_id,
          quantity: item.quantity,
          item_name: item.item_name,
          item_price: item.item_price,
          customizations: customizationsByOrderItem[item.order_item_id] || {}
        }))
      }
    });

  } catch (error) {
    console.log(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
};




exports.getOrderDetails = asyncChoke(async (req, res, next) => {
  const user_id = req.user.id;
  const offerCode = "WELCOME20";
  const deliveryTip = 10;

  const [user_address] = await pool.query(`SELECT * FROM useraddress WHERE user_id = ? AND selected = ?`,[user_id,true]);
  if (user_address.length === 0) {
    return next(new AppError(404, "No address selected"));
  }
  console.log(user_address);
  const data = {
    user_id: user_id,
    delivery_tip: deliveryTip,
      userLat: user_address[0].lat,
      userLon: user_address[0].lon
  }
  console.log(data);
  const bill = await calculateBill(next , data);
  console.log({bill:bill});
  return res.status(200).json({
    status: "success",
    data: {
      bill
    },
  });
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


exports.getOrdersById = asyncChoke(async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id: order_id } = req.params;
    // console.log(user_id, order_id, req.params);

    // Fetch the order to ensure it belongs to the user
    const [orders] = await pool.query(`
      SELECT 
  o.id as order_id, 
  o.restaurant_id,
  o.order_status,
  r.restaurant_name as restaurant_name,
  ra.street as restaurant_address
FROM orders o
JOIN restaurants r ON o.restaurant_id = r.id
JOIN restaurantaddress ra ON ra.restaurant_id = r.id
WHERE o.id = ? AND o.user_id = ?;
    `, [order_id, user_id]);

console.log(orders);

    if (orders.length === 0) {
      return next(new AppError(404, "Order not found or does not belong to the user"));
    }

    const order = orders[0];

    // Fetch order items
    const fetchOrderItemsQuery = `
      SELECT 
          oi.id as order_item_id, 
          oi.item_id, 
          oi.quantity, 
          i.name as item_name, 
          i.price as item_price
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      WHERE oi.order_id = ?
    `;
    const [orderItems] = await pool.query(fetchOrderItemsQuery, [order_id]);

    if (orderItems.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          ...order,
          items: []
        }
      });
    }

    // Fetch and attach customizations for each order item
    const fetchCustomizationsQuery = `
      SELECT
          oic.order_items_id,
          oic.title_id,
          ct.title,
          oic.option_id,
          co.option_name,
          co.additional_price,
          ct.selection_type
      FROM order_item_customisation oic
      JOIN customisation_title ct ON oic.title_id = ct.id
      JOIN customisation_options co ON oic.option_id = co.id
      WHERE oic.order_items_id IN (?)
    `;
    const orderItemIds = orderItems.map(item => item.order_item_id);
    const [customizations] = await pool.query(fetchCustomizationsQuery, [orderItemIds]);

    // Structure customizations for easier access
    const customizationsByOrderItem = {};
    customizations.forEach(customization => {
      const { order_items_id, title, option_id, option_name, additional_price, selection_type,title_id } = customization;

      if (!customizationsByOrderItem[order_items_id]) {
        customizationsByOrderItem[order_items_id] = {};
      }

      if (!customizationsByOrderItem[order_items_id][title]) {
        customizationsByOrderItem[order_items_id][title] = {
          selection_type,
          title,
          title_id,
          options: []
        };
      }

      customizationsByOrderItem[order_items_id][title].options.push({
        option_id,
        option_name,
        additional_price
      });
    });

    // Attach customizations to order items
    const result = orderItems.map(item => ({
      ...item,
      customizations: customizationsByOrderItem[item.order_item_id] || {}
    }));

    res.status(200).json({
      status: 'success',
      data: {
   
        ...order,
        items: result
      }
    });
  } catch (error) {
    console.error('Error fetching order details:', error); // Log the error for debugging
    return next(new AppError(500, "Internal Server Error"));
  }
});


exports.getPastOrders = asyncChoke(async (req, res, next) => {
  try {
    const user_id = req.user.id; // Get the authenticated user's ID

    // Fetch all past orders for the user
    const [orders] = await pool.query(`
      SELECT 
        o.id as order_id, 
        o.restaurant_id,
        o.order_status,
        r.restaurant_name as restaurant_name,
        ra.street as restaurant_address
      FROM orders o
      JOIN restaurants r ON o.restaurant_id = r.id
      JOIN restaurantaddress ra ON ra.restaurant_id = r.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC;  -- Assuming orders are ordered by creation date
    `, [user_id]);

    if (orders.length === 0) {
      return next(new AppError(404, "No past orders found for this user"));
    }

    // For each order, fetch the order items and customizations
    const result = [];

    for (const order of orders) {
      // Fetch order items
      const [orderItems] = await pool.query(`
        SELECT 
          oi.id as order_item_id, 
          oi.item_id, 
          oi.quantity, 
          i.name as item_name, 
          i.price as item_price
        FROM order_items oi
        JOIN items i ON oi.item_id = i.id
        WHERE oi.order_id = ?;
      `, [order.order_id]);

      // If there are no order items, continue to the next order
      if (orderItems.length === 0) {
        result.push({
          ...order,
          items: []
        });
        continue;
      }

      // Fetch and attach customizations for each order item
      const [customizations] = await pool.query(`
        SELECT
          oic.order_items_id,
          oic.title_id,
          ct.title,
          oic.option_id,
          co.option_name,
          co.additional_price,
          ct.selection_type
        FROM order_item_customisation oic
        JOIN customisation_title ct ON oic.title_id = ct.id
        JOIN customisation_options co ON oic.option_id = co.id
        WHERE oic.order_items_id IN (?);
      `, [orderItems.map(item => item.order_item_id)]);

      // Structure customizations for easier access
      const customizationsByOrderItem = {};
      customizations.forEach(customization => {
        const { order_items_id, title, option_id, option_name, additional_price, selection_type, title_id } = customization;

        if (!customizationsByOrderItem[order_items_id]) {
          customizationsByOrderItem[order_items_id] = {};
        }

        if (!customizationsByOrderItem[order_items_id][title]) {
          customizationsByOrderItem[order_items_id][title] = {
            selection_type,
            title,
            title_id,
            options: []
          };
        }

        customizationsByOrderItem[order_items_id][title].options.push({
          option_id,
          option_name,
          additional_price
        });
      });

      // Attach customizations to order items
      const orderWithItemsAndCustomizations = orderItems.map(item => ({
        ...item,
        customizations: customizationsByOrderItem[item.order_item_id] || {}
      }));

      // Push the order details with items and customizations to the result array
      result.push({
        ...order,
        items: orderWithItemsAndCustomizations
      });
    }

    // Return the response with the complete data
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Error fetching past orders:', error); // Log the error for debugging
    return next(new AppError(500, "Internal Server Error"));
  }
});




exports.getAllOrdersRestaurant = asyncChoke(async (req, res, next) => {
  try {
    const { id: restaurant_id } = req.user;
    const {startDate, endDate} = req.query;
    // Fetch all orders for the restaurant
    const [orders] = await pool.query(
      `
      SELECT 
        o.id,
        o.restaurant_id,
        o.created_at,
        o.res_amount,
        u.username AS user_name,
        COALESCE(del.first_name, 'Not Assigned') AS delivery_boy,
        CASE
            WHEN o.order_status = 'pending' THEN 'Pending'
            WHEN o.order_status = 'confirmed' THEN 'Active'
            ELSE 'Completed'
        END AS order_status
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN delivery_boys del ON del.id = o.del_id
      WHERE o.restaurant_id = ?
      ORDER BY 
          CASE
              WHEN o.order_status = 'pending' THEN 1
              WHEN o.order_status = 'confirmed' THEN 2
              ELSE 3
          END, 
          o.created_at DESC;
      `,
      [restaurant_id]
    );

    if (orders.length === 0) {
      return next(new AppError(400, "Orders not found yet! Try accepting orders"));
    }

    // Count the orders by status
    const pendingOrdersCount = orders.filter(order => order.order_status === 'Pending').length;
    const activeOrdersCount = orders.filter(order => order.order_status === 'Active').length;
    const completedOrdersCount = orders.filter(order => order.order_status === 'Completed').length;

    // Respond with counts and all orders
    res.status(200).json({
      status: 'success',
      data: {
        counts: {
          pendingOrders: pendingOrdersCount,
          activeOrders: activeOrdersCount,
          completedOrders: completedOrdersCount,
        },
        orders, // All orders with full details
      },
    });
  } catch (error) {
    console.error('Error fetching all orders for restaurant:', error);
    return next(new AppError(500, "Internal Server Error"));
  }
});



exports.getItemsOrder = asyncChoke(async (req, res, next) => {
  const { id: restaurant_id } = req.user;
  const { id: order_id } = req.params;

  // Fetch the user's order
  const [orders] = await pool.query(`
    SELECT
        o.id, 
        o.res_amount, 
        o.created_at,
        o.user_id, 
        o.restaurant_id, 
        o.bill_id,
        o.order_status,
        oa.area AS user_area,
        oa.house_no AS user_house_no,
        oa.city AS user_city,
        oa.lat AS user_latitude,
        oa.lon AS user_longitude,
        ra.street AS restaurant_street,
        ra.area AS restaurant_area,
        ra.city AS restaurant_city,
        ra.latitude AS restaurant_latitude,
        ra.longitude AS restaurant_longitude,
        b.payment_type
    FROM orders o
    JOIN orderaddress oa ON oa.order_id = o.id
    JOIN restaurantaddress ra ON ra.restaurant_id = o.restaurant_id
    JOIN bills b ON b.id = o.bill_id
    WHERE o.restaurant_id = ? AND o.id = ?`, [restaurant_id, order_id]);

  if (orders.length === 0) {
    return next(new AppError(404, "Order not found or does not belong to this restaurant"));
  }

  // Fetch order items
  const fetchOrderItemsQuery = `
    SELECT 
        oi.order_id,
        o.created_at,
        oi.id as order_item_id, 
        oi.item_id,
        oi.quantity, 
        i.name as item_name, 
        i.price as item_price
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN items i ON oi.item_id = i.id
    WHERE oi.order_id = ?
  `;
  const [orderItems] = await pool.query(fetchOrderItemsQuery, [order_id]);

  if (orderItems.length === 0) {
    return res.status(200).json({
      status: 'success',
      data: {
        order_details: orders[0],  // Include the order details in the response
        items: []
      }
    });
  }

  // Fetch and attach customizations for each order item
  const fetchCustomizationsQuery = `
    SELECT
        oic.order_items_id,
        oic.title_id,
        ct.title,
        oic.option_id,
        co.option_name,
        co.additional_price,
        ct.selection_type
    FROM order_item_customisation oic
    JOIN customisation_title ct ON oic.title_id = ct.id
    JOIN customisation_options co ON oic.option_id = co.id
    WHERE oic.order_items_id IN (?)
  `;
  const orderItemIds = orderItems.map(item => item.order_item_id);
  const [customizations] = await pool.query(fetchCustomizationsQuery, [orderItemIds]);

  // Structure customizations for easier access
  const customizationsByOrderItem = {};
  customizations.forEach(customization => {
    const { order_items_id, title, option_id, option_name, additional_price, selection_type, title_id } = customization;

    if (!customizationsByOrderItem[order_items_id]) {
      customizationsByOrderItem[order_items_id] = {};
    }

    if (!customizationsByOrderItem[order_items_id][title]) {
      customizationsByOrderItem[order_items_id][title] = {
        selection_type,
        title,
        title_id,
        options: []
      };
    }

    customizationsByOrderItem[order_items_id][title].options.push({
      option_id,
      option_name,
      additional_price
    });
  });

  // Attach customizations to order items
  const resultItems = orderItems.map(item => ({
    ...item,
    customizations: customizationsByOrderItem[item.order_item_id] || {}
  }));

  // Return the structured response with order details and items array
  res.status(200).json({
    status: 'success',
    data: {
      order_details: orders[0],  // Include order details as the first part
      items: resultItems          // Include items with their customizations
    }
  });
});


exports.getItemsOrderSocket = asyncChoke(async (req, res, next, restaurant_id, order_id) => {


  // Fetch the user's order
  const [orders] = await pool.query(`
    SELECT
        o.id, 
        o.res_amount, 
        o.created_at,
        o.user_id, 
        o.restaurant_id, 
        o.bill_id,
        o.order_status,
        oa.area AS user_area,
        oa.house_no AS user_house_no,
        oa.city AS user_city,
        oa.lat AS user_latitude,
        oa.lon AS user_longitude,
        ra.street AS restaurant_street,
        ra.area AS restaurant_area,
        ra.city AS restaurant_city,
        ra.latitude AS restaurant_latitude,
        ra.longitude AS restaurant_longitude,
        b.payment_type
    FROM orders o
    JOIN orderaddress oa ON oa.order_id = o.id
    JOIN restaurantaddress ra ON ra.restaurant_id = o.restaurant_id
    JOIN bills b ON b.id = o.bill_id
    WHERE o.restaurant_id = ? AND o.id = ?`, [restaurant_id, order_id]);

  if (orders.length === 0) {
    return next(new AppError(404, "Order not found or does not belong to this restaurant"));
  }

  // Fetch order items
  const fetchOrderItemsQuery = `
    SELECT 
        oi.order_id,
        o.created_at,
        oi.id as order_item_id, 
        oi.item_id,
        oi.quantity, 
        i.name as item_name, 
        i.price as item_price
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN items i ON oi.item_id = i.id
    WHERE oi.order_id = ?
  `;
  const [orderItems] = await pool.query(fetchOrderItemsQuery, [order_id]);

  if (orderItems.length === 0) {
    return res.status(200).json({
      status: 'success',
      data: {
        order_details: orders[0],  // Include the order details in the response
        items: []
      }
    });
  }

  // Fetch and attach customizations for each order item
  const fetchCustomizationsQuery = `
    SELECT
        oic.order_items_id,
        oic.title_id,
        ct.title,
        oic.option_id,
        co.option_name,
        co.additional_price,
        ct.selection_type
    FROM order_item_customisation oic
    JOIN customisation_title ct ON oic.title_id = ct.id
    JOIN customisation_options co ON oic.option_id = co.id
    WHERE oic.order_items_id IN (?)
  `;
  const orderItemIds = orderItems.map(item => item.order_item_id);
  const [customizations] = await pool.query(fetchCustomizationsQuery, [orderItemIds]);

  // Structure customizations for easier access
  const customizationsByOrderItem = {};
  customizations.forEach(customization => {
    const { order_items_id, title, option_id, option_name, additional_price, selection_type, title_id } = customization;

    if (!customizationsByOrderItem[order_items_id]) {
      customizationsByOrderItem[order_items_id] = {};
    }

    if (!customizationsByOrderItem[order_items_id][title]) {
      customizationsByOrderItem[order_items_id][title] = {
        selection_type,
        title,
        title_id,
        options: []
      };
    }

    customizationsByOrderItem[order_items_id][title].options.push({
      option_id,
      option_name,
      additional_price
    });
  });

  // Attach customizations to order items
  const resultItems = orderItems.map(item => ({
    ...item,
    customizations: customizationsByOrderItem[item.order_item_id] || {}
  }));

  // Return the structured response with order details and items array
  res.status(200).json({
    status: 'success',
    data: {
      order_details: orders[0],  // Include order details as the first part
      items: resultItems          // Include items with their customizations
    }
  });
});





// Example function to update order status
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Update order status in database (mock example)
    const result = await pool.query('UPDATE orders SET order_status = ? WHERE id = ?', [status, orderId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    // Emit real-time update to the connected users
    emitOrderStatus(orderId, status);

    res.status(200).json({ status: 'success', message: 'Order status updated', data: { orderId, status } });
  } catch (err) {
    next(err);
  }
};
