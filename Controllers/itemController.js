const db = require('../Config/database');

// Create Item by category id
exports.createItem = async (req, res) => {
    try {
        const { name, description, price } = req.body;
        const {id} = req.params;
        // Check if all required fields are provided
        if (!name || !description || !price) {
            return res.status(400).json({ error: "Fill all fields" });
        }

        // Proceed with item creation if all fields are provided
        const query = `INSERT INTO items (name, price, description, category_id ) VALUES (?,?,?,?)`;
        const [result, fields] = await db.query(query, [name, price, description, id]);

        return res.status(200).json(
            { status : "success",
              result 
            });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// Read Items
exports.readItems = async (req, res) => {
    try {
        const {id} = req.params;
        const query = `SELECT * FROM items WHERE category_id = ?`;
        const [result, fields] = await db.query(query, [id]);
        return res.status(200).json({ result });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// Update Item
// exports.updateItembyid = async (req, res) => {
//     try {
//         const { name , description, price } = req.body;
//         const {id} = req.params;
//         // Check if all required fields are provided
//         if (!name || !description || !price) {
//             return res.status(400).json({ error: "Fill all fields" });
//         }
        
//         // Proceed with item update if all fields are provided
//         const query = `UPDATE items SET name = ?, description = ?, price = ? WHERE id = ?`;
//         const [result, fields] = await db.query(query, [name, description, price, id]);
//         return res.status(200).json({ result });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ error: 'Internal server error' });
//     }
// };

// // Delete Item
// exports.deleteItem = async (req, res) => {
//     try {
//         const { id } = req.params;
        
//         // Check if name is provided
//         if (!id) {
//             return res.status(400).json({ error: "item not found" });
//         }
        
//         // Proceed with item deletion if name is provided
//         const query = `DELETE FROM items WHERE id = ?`;
//         const [result, fields] = await db.query(query, [id]);
//         return res.status(200).json({ result });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ error: 'Internal server error' });
//     }
// };
