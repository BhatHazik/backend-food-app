const db = require('../Config/database');

// Create Item
exports.createItem = async (req, res) => {
    try {
        const { name, description, price } = req.body;

        // Check if all required fields are provided
        if (!name || !description || !price) {
            return res.status(400).json({ error: "Fill all fields" });
        }

        // Proceed with item creation if all fields are provided
        const query = `INSERT INTO items (name, description, price) VALUES (?,?,?)`;
        const [result, fields] = await db.query(query, [name, description, price]);

        return res.status(200).json({ result });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// Read Items
exports.readItems = async (req, res) => {
    try {
        const query = `SELECT * FROM items`;
        const [result, fields] = await db.query(query);
        return res.status(200).json({ result });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// Update Item
exports.updateItem = async (req, res) => {
    try {
        const { newItemName, oldItemName, description, price } = req.body;
        
        // Check if all required fields are provided
        if (!newItemName || !oldItemName || !description || !price) {
            return res.status(400).json({ error: "Fill all fields" });
        }
        
        // Proceed with item update if all fields are provided
        const query = `UPDATE items SET Name = ?, description = ?, price = ? WHERE Name = ?`;
        const [result, fields] = await db.query(query, [newItemName, description, price, oldItemName]);
        return res.status(200).json({ result });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete Item
exports.deleteItem = async (req, res) => {
    try {
        const { name } = req.body;
        
        // Check if name is provided
        if (!name) {
            return res.status(400).json({ error: "Fill all fields" });
        }
        
        // Proceed with item deletion if name is provided
        const query = `DELETE FROM items WHERE Name = ?`;
        const [result, fields] = await db.query(query, [name]);
        return res.status(200).json({ result });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
