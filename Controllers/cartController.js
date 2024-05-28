const db = require('../Config/database');




// create cart is in the userLogin



// add item in cart

exports.addItemCart = async (req, res) => {
    try {
        const { id: item_id } = req.params;  // Extract item_id from request parameters
        const { quantity } = req.body;  // Extract quantity from request body
        const user_id = req.user.id;  // Get user_id from the authenticated user

        // Fetch item details including restaurant_id
        const [item] = await db.query(`
            SELECT items.id as item_id, menus.restaurant_id
            FROM items
            JOIN categories ON items.category_id = categories.id
            JOIN menus ON categories.menu_id = menus.id
            WHERE items.id = ?
        `, [item_id]);

        if (item.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Item not found"
            });
        }

        const { item_id: itemIdInMenu, restaurant_id } = item[0];

        // Check if the item is already in the cart for this user
        const [checkQuery] = await db.query('SELECT * FROM cart WHERE item_id = ? AND user_id = ?', [itemIdInMenu, user_id]);
        if (checkQuery.length > 0) {
            return res.status(400).json({
                status: "error",
                message: "Item is already in the cart"
            });
        }

        // Check if adding this item violates restaurant consistency in the cart
        const [cartItems] = await db.query(`
            SELECT items.id as item_id, menus.restaurant_id
            FROM cart
            JOIN items ON cart.item_id = items.id
            JOIN categories ON items.category_id = categories.id
            JOIN menus ON categories.menu_id = menus.id
            WHERE cart.user_id = ?
        `, [user_id]);

        const violatesConsistency = cartItems.some(cartItem => cartItem.restaurant_id !== restaurant_id);

        if (violatesConsistency) {
            return res.status(400).json({
                status: "error",
                message: "Cannot add items from different restaurants to the cart"
            });
        }

        // Ensure that item_id and quantity are properly handled
        const query = `INSERT INTO cart (item_id, quantity, user_id) VALUES (?, ?, ?)`;

        // Execute the query
        const [result] = await db.query(query, [itemIdInMenu, quantity, user_id]);

        // Respond with success status and the result
        res.json({
            status: "success",
            result
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};





// see items in cart





exports.getItemsCart = async(req, res)=>{
    try{
        const user_id = req.user.id;
        // console.log(user_id)
        const [rows] = await db.query(`SELECT * FROM cart WHERE user_id = ?` ,[user_id]);
        res.json({
        status: "success",
        rows
    });
    }
    catch(err){
        console.log(err)
    }
}



exports.itemQuantity = async(req, res) =>{
    try{
    const user_id = req.user.id;
    const {quantity} = req.body;
    const { id: item_id } = req.params;
    if(quantity < 1){
      const removeQuery = await db.query(`DELETE FROM cart WHERE item_id = ? AND user_id = ?`, [item_id, user_id]);
      return res.json({
        status :"success",
        message: "your item has been removed successfully"
      })
    }
    const [itemQuantity] = await db.query(`UPDATE cart SET quantity = ? WHERE item_id = ? AND user_id = ?`, [quantity, item_id, user_id]);
    
    res.json({
        status:"success",
        itemQuantity
    });
    }catch(err){
        console.log(err);
    }

}