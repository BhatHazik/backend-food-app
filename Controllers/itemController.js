const db = require('../Config/database');
const AppError = require('../Utils/error');
const {asyncChoke} = require('../Utils/asyncWrapper');


// Create Item by category id
exports.createItem = asyncChoke(async (req, res, next) => {
    const { name, description, price, type } = req.body;
    const { id } = req.params;

    if (!name || !description || !price || !type) {
        return next(new AppError(400, "Fill all fields"));
    }
    if (type !== "veg" && type !== "non-veg") {
        return next(new AppError(400, `Type can't be ${type}`));
    }
    const query = `INSERT INTO items (name, price, description, category_id, type) VALUES (?,?,?,?,?)`;
    const [result] = await db.query(query, [name, price, description, id, type]);

    if (result.affectedRows === 0) {
        return next(new AppError(400, "Failed to create item"));
    }

    res.status(200).json({
        status: "success",
        result
    });
});

// Create title by item_id
exports.createTitle = asyncChoke(async (req, res, next) => {
    const { title_name } = req.body;
    const { id } = req.params;

    if (!title_name) {
        return next(new AppError(400, "Provide title name"));
    }

    const query = `INSERT INTO customisation_title (item_id, title) VALUES (?, ?)`;
    const [result] = await db.query(query, [id, title_name]);

    if (result.affectedRows === 0) {
        return next(new AppError(400, "Failed to create title"));
    }

    res.status(200).json({
        status: "success",
        result
    });
});


exports.updateSelectionType = asyncChoke(async (req, res, next) => {
    const { id } = req.params;
    const { selection_type } = req.body;

    if (!id) {
        return next(new AppError(400, "Provide title ID"));
    }

    if (!selection_type) {
        return next(new AppError(400, "Provide selection type"));
    }

    if (selection_type !== "one" && selection_type !=="more than one") {
        return next(new AppError(400, "Selection type must be 'one' or 'more than one'"));
    }

    const query = "UPDATE customisation_title SET selection_type = ? WHERE id = ?";
    const [result] = await db.query(query, [selection_type, id]);

    if (result.affectedRows === 0) {
        return next(new AppError(400, "Failed to update selection type"));
    }

    res.status(200).json({
        status: "success",
        result
    });
});



// Get all titles by item_id
exports.getTitlesByItemId = asyncChoke(async (req, res, next) => {
    const { id } = req.params;

    const query = `SELECT id, title FROM customisation_title WHERE item_id = ?`;
    const [titles] = await db.query(query, [id]);

    if (!titles || titles.length === 0) {
        return next(new AppError(404, "No titles found for this item"));
    }

    res.status(200).json({
        status: "success",
        data: titles
    });
});

// Create option by title_id
exports.createOption = asyncChoke(async (req, res, next) => {
    const { option_name, additional_price } = req.body;
    const { id } = req.params;

    if (!option_name && !additional_price) {
        return next(new AppError(400, "Provide All Fields!"));
    }
    const checkQuery = `SELECT * FROM customisation_title WHERE id = ?`;
    const [options] = await db.query(checkQuery, [id]);
    if(options.length <= 0){
        return next(new AppError(404, "Customisation title not found!"))
    }
    const query = `INSERT INTO customisation_options (title_id, option_name, additional_price) VALUES (?, ?, ?)`;
    const [result] = await db.query(query, [id, option_name, additional_price || 0.00]);

    if (result.affectedRows === 0) {
        return next(new AppError(400, "Failed to create option"));
    }

    res.status(200).json({
        status: "success",
        result
    });
});

// Get all options by title_id
exports.getOptionsByTitleId = asyncChoke(async (req, res, next) => {
    const { id } = req.params;

    const query = `SELECT * FROM customisation_options WHERE title_id = ?`;
    const [options] = await db.query(query, [id]);
    if(options.length <= 0){
        return next(new AppError(404, "Customisation title not found!"))
    }
    if (options.length === 0) {
        return next(new AppError(404, `No options found for title with id '${id}'`));
    }

    res.status(200).json({
        status: 'success',
        data: options
    });
});

// for (NEXT button) check is there any title with no added options
exports.checkTitlesWithNoOptions = asyncChoke(async (req, res, next) => {
    const { id } = req.params;

    // First, check if there are any titles for the given item_id
    const checkTitlesQuery = `SELECT * FROM customisation_title WHERE item_id = ?`;
    const [titles] = await db.query(checkTitlesQuery, [id]);

    if (titles.length === 0) {
        return next(new AppError(404, `No titles found for item with id '${id}'`));
    }

    // Then, find titles with no options
    const query = `
        SELECT customisation_title.id, customisation_title.title 
        FROM customisation_title 
        LEFT JOIN customisation_options 
        ON customisation_title.id = customisation_options.title_id 
        WHERE customisation_title.item_id = ? 
        GROUP BY customisation_title.id 
        HAVING COUNT(customisation_options.id) = 0
    `;
    const [titlesWithNoOptions] = await db.query(query, [id]);

    if (titlesWithNoOptions.length === 0) {
        const updateQuery = `UPDATE items SET customisation = ? WHERE id = ?`
        const value = [true , id]
        const [result] = await db.query(updateQuery,value);
        if(result.affectedRows < 1){
           return next(new AppError(400, "Cannot add customisation to this item!"))
        }
        return res.status(200).json({
            status: 'success',
            message: 'All titles have options'
        });
    }

    res.status(200).json({
        status: 'success',
        titlesWithNoOptions
    });
});


// Edit option by option_id
exports.updateOption = asyncChoke(async (req, res, next) => {
    const { id } = req.params;
    const { option_name, additional_price } = req.body;

    // Check if all required fields are provided
    if (!option_name || additional_price == null) {
        return next(new AppError(400, 'Option name and additional price are required'));
    }

    // Update the option in the database
    const query = `UPDATE customisation_options SET option_name = ?, additional_price = ? WHERE id = ?`;
    const [result] = await db.query(query, [option_name, additional_price, id]);

    // Check if the option was found and updated
    if (result.affectedRows === 0) {
        return next(new AppError(404, `Option with id '${id}' not found`));
    }

    res.status(200).json({
        status: 'success',
        message: `Option with id '${id}' updated successfully`
    });
});

// Discard all added customisation for a item by item_id
exports.discardCustomizations = asyncChoke(async (req, res, next) => {
    const { id } = req.params;

    // Step 1: Fetch all titles for the given item ID
    const fetchTitlesQuery = `SELECT id FROM customisation_title WHERE item_id = ?`;
    const [titles] = await db.query(fetchTitlesQuery, [id]);

    if (titles.length === 0) {
        return next(new AppError(404, `No titles found for item with id '${id}'`));
    }

    const titleIds = titles.map(title => title.id);

    // Step 2: Fetch all options for the fetched titles
    const fetchOptionsQuery = `SELECT id FROM customisation_options WHERE title_id IN (?)`;
    const [options] = await db.query(fetchOptionsQuery, [titleIds]);

    const optionIds = options.map(option => option.id);

    // Step 3: Delete all fetched options
    if (optionIds.length > 0) {
        const deleteOptionsQuery = `DELETE FROM customisation_options WHERE id IN (?)`;
        await db.query(deleteOptionsQuery, [optionIds]);
    }

    // Step 4: Delete all fetched titles
    const deleteTitlesQuery = `DELETE FROM customisation_title WHERE id IN (?)`;
    await db.query(deleteTitlesQuery, [titleIds]);

    res.status(200).json({
        status: 'success',
        message: `All customizations for item with id '${id}' have been discarded`
    });
});

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



exports.getCustomizations = asyncChoke(async (req, res, next) => {
    const { id: item_id } = req.params;
    const user_id = req.user.id;

    // Fetch all titles for the given item ID, including selection_type
    const fetchTitlesQuery = `SELECT id, title, selection_type FROM customisation_title WHERE item_id = ?`;
    const [titles] = await db.query(fetchTitlesQuery, [item_id]);

    if (titles.length === 0) {
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

        // Check if the item is already in the cart for this user
        const [checkQuery] = await db.query('SELECT * FROM cart WHERE item_id = ? AND user_id = ?', [itemIdInMenu, user_id]);
        if (checkQuery.length > 0) {
            return next(new AppError(400, "Item is already in the cart"));
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
            return next(new AppError(400, "Cannot add items from different restaurants to the cart"));
        }

        // Ensure that item_id and quantity are properly handled
        const query = `INSERT INTO cart (item_id, user_id) VALUES (?, ?)`;

        // Execute the query
        const [result] = await db.query(query, [itemIdInMenu, user_id]);
        if(result.affectedRows < 1){
            return next(new AppError(400, "Error while adding item in cart!"))
        }

        // Respond with success status and the result
        return res.json({
            status: "success",
            message: "Item added in your cart!"
        });
    }

    // Prepare the result object
    const customizations = {};

    // Fetch all options for each title
    for (const title of titles) {
        const fetchOptionsQuery = `SELECT option_name, additional_price FROM customisation_options WHERE title_id = ?`;
        const [options] = await db.query(fetchOptionsQuery, [title.id]);

        customizations[title.title] = {
            selection_type: title.selection_type,
            options: options.map(option => ({
                name: option.option_name,
                price: option.additional_price,
            }))
        };
    }

    res.status(200).json({
        status: 'success',
        customizations
    });
});

