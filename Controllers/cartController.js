const db = require('../Config/database');
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
    const [user] = await db.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (user.length === 0) {
        return next(new AppError(404, "User not found"));
    }

    // Fetch item details including restaurant_id
    const [item] = await db.query(`
        SELECT items.id as item_id, menus.restaurant_id
        FROM items
        JOIN categories ON items.category_id = categories.id
        JOIN menus ON categories.menu_id = menus.id
        WHERE items.id = ?
    `, [item_id]);

    if (item.length === 0) {
        return next(new AppError(404, "Item not found"));
    }

    const { item_id: itemIdInMenu, restaurant_id } = item[0];
    const [cart] = await db.query(`SELECT * FROM cart WHERE user_id = ?`, [user_id])
    const cart_id = cart[0].id
    // Check if the item is already in the cart for this user
    const [checkQuery] = await db.query('SELECT * FROM cart_items WHERE item_id = ? AND cart_id = ?', [itemIdInMenu, cart_id]);
    if (checkQuery.length > 0) {
        return next(new AppError(400, "Item is already in the cart"));
    }

    // Check if adding this item violates restaurant consistency in the cart
    const [cartItems] = await db.query(`
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

    // Ensure that item_id and quantity are properly handled
    const query = `INSERT INTO cart_items (item_id, quantity, cart_id) VALUES (?, ?, ?)`;

    // Execute the query
    const [result] = await db.query(query, [itemIdInMenu, quantity, cart_id]);
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
    const [row] = await db.query(checkQuery, value);
    if(row.length < 1){
        console.log(row)
        return next(new AppError(404, "Item not found!"));
    }
    const [cart] = await db.query(`SELECT * FROM cart WHERE user_id = ?`, [user_id])
    const cart_id = cart[0].id;
    const RemoveQuery = `DELETE FROM cart_items WHERE cart_id = ?;`
    const RemoveValue = [cart_id];
    const [result] = await db.query(RemoveQuery,RemoveValue);
    if(result.affectedRows < 1){
        console.log(result)
        return next(new AppError(500, "cannot remove item. Try again!"))
    }
    const query = `INSERT INTO cart (item_id, quantity, cart_id) VALUES (?, ?, ?);`
    const values = [id, quantity, cart_id];
    const [rows] = await db.query(query, values);
    if(rows.affectedRows < 1){
        return next(new AppError(400, "cannot add item. Try again!"));
    }
    res.status(200).json({
        status:"succuss",
        message:"item added in your cart!"
    })
})



// see items in cart
exports.getItemsCart = asyncChoke(async (req, res, next) => {
    const user_id = req.user.id;
    const [cart] = await db.query(`SELECT * FROM cart WHERE user_id = ?`, [user_id])
    const cart_id = cart[0].id;
    // Fetch cart items for the given user ID
    const query = `
        SELECT 
            cart_items.id,
            cart_items.item_id,
            cart_items.quantity,
            items.name,
            items.price,
            items.type
        FROM cart_items
        JOIN items ON cart_items.item_id = items.id
        WHERE cart_items.cart_id = ?
    `;
    const [rows] = await db.query(query, [cart_id]);

    if (!rows.length) {
        return next(new AppError(404, "No items found in the cart for the given user"));
    }

    res.status(200).json({
        status: "success",
        rows
    });
});




exports.itemQuantity = async(req, res) =>{
    try{
    const user_id = req.user.id;
    const {quantity} = req.body;
    const { id: item_id } = req.params;
    const [cart] = await db.query(`SELECT * FROM cart WHERE user_id = ?`, [user_id])
    const cart_id = cart[0].id;
    if(quantity < 1){
      const removeQuery = await db.query(`DELETE FROM cart_items WHERE item_id = ? AND cart_id = ?`, [item_id, cart_id]);
      return res.json({
        status :"success",
        message: "your item has been removed successfully"
      })
    }
    const [itemQuantity] = await db.query(`UPDATE cart_items SET quantity = ? WHERE item_id = ? AND cart_id = ?`, [quantity, item_id, cart_id]);
    
    res.json({
        status:"success",
        itemQuantity
    });
    }catch(err){
        console.log(err);
    }
}


