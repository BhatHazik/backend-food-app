const db = require('../Config/database');




// create cart is in the userLogin



// add item in cart

exports.addItemCart = async (req, res) => {
    try {
        const { id: item_id } = req.params;  // Extract item_id from request parameters
        const { quantity } = req.body;  // Extract quantity from request body
        const user_id = req.user.id;  // Get user_id from the authenticated user

        // Check if item_id exists in items table
        const [item] = await db.query('SELECT id FROM items WHERE id = ?', [item_id]);
        if (item.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Item not found"
            });
        }

        // Check if the item is already in the cart for this user
        const [checkQuery] = await db.query(`SELECT * FROM cart WHERE item_id = ? AND user_id = ?`, [item_id, user_id]);
        if (checkQuery.length > 0) {
            return res.status(400).json({
                status: "error",
                message: "Item is already in the cart"
            });
        }

        // Ensure that item_id and quantity are properly handled
        const query = `INSERT INTO cart (item_id, quantity, user_id) VALUES (?, ?, ?)`;

        // Execute the query
        const [result] = await db.query(query, [item_id, quantity, user_id]);

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





