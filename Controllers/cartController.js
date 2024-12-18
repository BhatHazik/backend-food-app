const {pool} = require('../Config/database');
const { asyncChoke } = require('../Utils/asyncWrapper');
const AppError = require('../Utils/error');




// create cart is in the userLogin



// add item in cart
exports.addItemCart = asyncChoke(async (req, res, next) => {
    const { id: item_id } = req.params;  // Extract item_id from request parameters
    const { quantity } = req.body;  // Extract quantity from request body
    const user_id = req.user.id;  // Get user_id from the authenticated user

    if (!quantity || !item_id) {
        return next(new AppError(401, "Provide credentials!"));
    }

    // Check if user_id exists in users table
    const [user] = await pool.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (user.length === 0) {
        return next(new AppError(404, "User not found"));
    }

    // Fetch item details including restaurant_id
    const [item] = await pool.query(`
        SELECT items.id as item_id, items.price as item_price, menus.restaurant_id
        FROM items
        JOIN categories ON items.category_id = categories.id
        JOIN menus ON categories.menu_id = menus.id
        WHERE items.id = ?
    `, [item_id]);

    if (item.length === 0) {
        return next(new AppError(404, "Item not found"));
    }

    const { item_id: itemIdInMenu, restaurant_id } = item[0];
    const [cart] = await pool.query(`SELECT * FROM cart WHERE user_id = ?`, [user_id])
    const cart_id = cart[0].id
    // Check if the item is already in the cart for this user
    const [checkQuery] = await pool.query('SELECT * FROM cart_items WHERE item_id = ? AND cart_id = ?', [itemIdInMenu, cart_id]);
    if (checkQuery.length > 0) {
        return next(new AppError(400, "Item is already in the cart"));
    }

    // Check if adding this item violates restaurant consistency in the cart
    const [cartItems] = await pool.query(`
        SELECT items.id as item_id, menus.restaurant_id
        FROM cart_items
        JOIN items ON cart_items.item_id = items.id
        JOIN categories ON items.category_id = categories.id
        JOIN menus ON categories.menu_id = menus.id
        WHERE cart_items.cart_id = ?
    `, [cart_id]);

    const violatesConsistency = cartItems.some(cartItem => cartItem.restaurant_id !== restaurant_id);

    if (violatesConsistency) {
        return next(new AppError(400, "Cannot add items from different restaurants to the cart"));
    }
    const item_total = item[0].item_price * quantity;
    // Ensure that item_id and quantity are properly handled
    const query = `INSERT INTO cart_items (item_id, item_total, quantity, cart_id) VALUES (?, ?, ?, ?)`;

    // Execute the query
    const [result] = await pool.query(query, [itemIdInMenu, item_total, quantity, cart_id]);
    if(result.affectedRows < 1){
        return next(new AppError(400, "Error while adding item in cart!"))
    }
    // Respond with success status and the result
    res.json({
        status: "success",
        message: "Item added in your cart!"
    });
});



exports.removeItemsFromCartAndAddNew = asyncChoke(async(req,res,next)=>{
    const id = req.params.id;
    const user_id = req.user.id;
    const {quantity} = req.body;
    
    if(!quantity && !id){
        return next(new AppError(401, "provide credintials!"));
    }
    const checkQuery = `SELECT * FROM items WHERE id = ?`
    const value = [id];
    const [row] = await pool.query(checkQuery, value);
    if(row.length < 1){
        console.log(row)
        return next(new AppError(404, "Item not found!"));
    }
    const [cart] = await pool.query(`SELECT * FROM cart WHERE user_id = ?`, [user_id])
    const cart_id = cart[0].id;
    const RemoveQuery = `DELETE FROM cart_items WHERE cart_id = ?;`
    const RemoveValue = [cart_id];
    const [result] = await pool.query(RemoveQuery,RemoveValue);
    if(result.affectedRows < 1){
        console.log(result)
        return next(new AppError(500, "cannot remove item. Try again!"))
    }
    const query = `INSERT INTO cart (item_id, quantity, cart_id) VALUES (?, ?, ?);`
    const values = [id, quantity, cart_id];
    const [rows] = await pool.query(query, values);
    if(rows.affectedRows < 1){
        return next(new AppError(400, "cannot add item. Try again!"));
    }
    res.status(200).json({
        status:"succuss",
        message:"item added in your cart!"
    })
})



exports.getItemsCart = asyncChoke(async (req, res, next) => {
    const user_id = req.user.id;

    // Fetch the user's cart
    const [cart] = await pool.query(`SELECT * FROM cart WHERE user_id = ?`, [user_id]);
    if (cart.length === 0) {
        return next(new AppError(404, "Cart not found"));
    }
    const cart_id = cart[0].id;

    // Fetch cart items
    const fetchCartItemsQuery = `
        SELECT 
            ci.id as cart_item_id, 
            ci.item_id, 
            ci.quantity, 
            i.name as item_name, 
            i.price as item_price,
            ci.item_total 
        FROM cart_items ci
        JOIN items i ON ci.item_id = i.id
        WHERE ci.cart_id = ?
    `;
    const [cartItems] = await pool.query(fetchCartItemsQuery, [cart_id]);

    if (cartItems.length === 0) {
        return res.status(200).json({
            status: 'success',
            data: []
        });
    }

    // Fetch and attach customizations for each cart item
    const fetchCustomizationsQuery = `
        SELECT
            cit.cart_item_id,
            cit.title_id,
            ct.title,
            cit.option_id,
            co.option_name,
            co.additional_price,
            ct.selection_type
        FROM cart_item_customizations cit
        JOIN customisation_title ct ON cit.title_id = ct.id
        JOIN customisation_options co ON cit.option_id = co.id
        WHERE cit.cart_item_id IN (?)
    `;
    const cartItemIds = cartItems.map(item => item.cart_item_id);
    const [customizations] = await pool.query(fetchCustomizationsQuery, [cartItemIds]);

    // Structure customizations for easier access
    const customizationsByCartItem = {};
    customizations.forEach(customization => {
        const { cart_item_id, title, option_id, option_name, additional_price, selection_type, title_id } = customization;

        if (!customizationsByCartItem[cart_item_id]) {
            customizationsByCartItem[cart_item_id] = {};
        }

        if (!customizationsByCartItem[cart_item_id][title]) {
            customizationsByCartItem[cart_item_id][title] = {
                selection_type,
                title,
                title_id,
                options: []
            };
        }

        customizationsByCartItem[cart_item_id][title].options.push({
            option_id,
            option_name,
            additional_price
        });
    });

    // Attach customizations to cart items
    const result = cartItems.map(item => ({
        ...item,
        customizations: customizationsByCartItem[item.cart_item_id] || {}
    }));

    res.status(200).json({
        status: 'success',
        data: result
    });
});









exports.itemQuantity = asyncChoke(async (req, res, next) => {
    try {
        const user_id = req.user.id;
        const { quantity } = req.body;
        const { id: cart_item_id } = req.params;

        // Retrieve the user's cart
        const [cart] = await pool.query(`SELECT * FROM cart WHERE user_id = ?`, [user_id]);
        if (cart.length === 0) {
            return next(new AppError(404, "Cart not found"));
        }
        const cart_id = cart[0].id;

        // Check if the cart item exists in the user's cart
        const [check] = await pool.query(`SELECT * FROM cart_items WHERE cart_id = ? AND id = ?`, [cart_id, cart_item_id]);
        if (check.length < 1) {
            return next(new AppError(404, "This cart item does not belong to your cart"));
        }

        // Handle quantity less than 1
        if (quantity < 1) {
            // Check if there are customizations associated with the cart item
            const [cart_item_customizations] = await pool.query(`SELECT * FROM cart_item_customizations WHERE cart_item_id = ?`, [cart_item_id]);
            
            // Delete all customizations associated with the cart item
            if (cart_item_customizations.length > 0) {
                await pool.query(`DELETE FROM cart_item_customizations WHERE cart_item_id = ?`, [cart_item_id]);
            }

            // Remove the cart item
            await pool.query(`DELETE FROM cart_items WHERE id = ?`, [cart_item_id]);

            return res.json({
                status: "success",
                message: "Your item and its customizations have been removed successfully"
            });
        }

        // Update the quantity and item total
        const item_total = check[0].item_total * quantity;
        await pool.query(`UPDATE cart_items SET quantity = ?, item_total = ? WHERE id = ?`, [quantity, item_total, cart_item_id]);

        res.json({
            status: "success",
            message: "Cart item quantity updated successfully",
        });
    } catch (err) {
        console.log(err);
        next(err); // Pass the error to the global error handler
    }
});




