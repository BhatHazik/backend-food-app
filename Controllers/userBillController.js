const db = require('../Config/database');
const AppError = require('../Utils/error');
const {asyncChoke} = require('../Utils/asyncWrapper');

// Define constants
const PER_KM_FEE = 10;
const PLATFORM_FEE = 5; // Example platform fee amount, adjust as needed
const RESTAURANT_CHARGES_RATE = 0.15; // GST and restaurant charges rate

exports.calculateBill = asyncChoke(async (req, res, next) => {
    const user_id = req.user.id;
    const distance = req.body.distance; // Assuming distance is passed in the request body
    const deliveryTip = parseFloat(req.body.delivery_tip) || 0; // Default to 0 if delivery tip is not provided
    const offerCode = req.body.code; // Optional offer code

    // Fetch the cart of the user
    const [cart] = await db.query(`SELECT * FROM cart WHERE user_id = ?`, [user_id]);
    if (!cart.length) {
        return next(new AppError(404, "Cart not found for the given user"));
    }

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
        return next(new AppError(404, "No items found in the cart for the given user"));
    }

    // Extract item_total from result
    let item_total = parseFloat(result[0].total_amount);
    let item_discount = 0; // Initialize item_discount to 0

    // Apply offer code if provided
    if (offerCode) {
        const [offer] = await db.query(`SELECT * FROM offers WHERE code = ? AND status = 'active'`, [offerCode]);
        if (offer.length === 0) {
            return next(new AppError(400, "Invalid or expired offer code"));
        }
        const offer_id = offer[0].id;

        // Check if user has already used this offer
        const [userOffer] = await db.query(`SELECT * FROM user_used_offer WHERE user_id = ? AND offer_id = ?`, [user_id, offer_id]);
        if (userOffer.length) {
            return next(new AppError(400, "Offer code already been used"));
        }

        // Check if the order meets the minimum order amount
        if (item_total < parseFloat(offer[0].minimum_order_amount)) {
            return next(new AppError(400, `To apply this offer your order should be a minimum of ${offer[0].minimum_order_amount}`));
        }

        // Calculate discount based on discount type
        if (offer[0].discount_type === 'percentage') {
            const discountValue = (item_total * parseFloat(offer[0].discount_value)) / 100;
            item_discount = Math.min(discountValue, parseFloat(offer[0].maximum_discount_amount));
        } else if (offer[0].discount_type === 'fixed_amount') {
            item_discount = parseFloat(offer[0].discount_value);
        }

        // Record the use of the offer by the user
        await db.query(`INSERT INTO user_used_offer (user_id, offer_id) VALUES (?, ?)`, [user_id, offer_id]);
    }
    

    // Calculate GST and restaurant charges
    const gst_and_restaurant_charges = RESTAURANT_CHARGES_RATE * item_total;

    // Calculate distance fee
    const delivery_fee = distance * PER_KM_FEE;

    // Calculate total bill including all components
    const total_bill = item_total - item_discount + delivery_fee + deliveryTip + PLATFORM_FEE + gst_and_restaurant_charges;

    // Respond with the structured response object
    res.status(200).json({
        item_total: item_total.toFixed(2),
        item_discount: item_discount.toFixed(2),
        delivery_fee: delivery_fee.toFixed(2),
        delivery_tip: deliveryTip.toFixed(2),
        platform_fee: PLATFORM_FEE.toFixed(2),
        gst_and_restaurant_charges: gst_and_restaurant_charges.toFixed(2),
        total_bill: total_bill.toFixed(2)
    });
});
