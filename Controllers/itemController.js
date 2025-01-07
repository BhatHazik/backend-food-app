const { pool } = require("../Config/database");
const AppError = require("../Utils/error");
const { asyncChoke } = require("../Utils/asyncWrapper");
const { uploadDocuments } = require("../Config/aws");

exports.createItem = asyncChoke(async (req, res, next) => {
  const { name, description, price, type } = req.body;
  const { id } = req.params;

  const restaurant_id = req.user.id;
  let thumbnailUrl;

  if (!name || !description || !price || !type || !id) {
    return next(new AppError(400, "Provide all fields"));
  }

  thumbnailUrl = await uploadDocuments(req.files);
  if (!thumbnailUrl) {
    return next(new AppError(400, "Failed to upload thumbnail"));
  }

  if (type !== "veg" && type !== "non-veg") {
    return next(new AppError(400, `Type can't be ${type}`));
  }

  const [checkCategory] = await pool.query(
    `
        SELECT c.id, m.id, r.id
        FROM categories c
        JOIN menus m ON c.menu_id = m.id
        JOIN restaurants r ON m.restaurant_id = r.id
        WHERE c.id = ?`,
    [id]
  );

  if (
    checkCategory.length === 0 ||
    checkCategory[0].id === null ||
    checkCategory[0].menu_id === null ||
    checkCategory[0].restaurant_id === null
  ) {
    return next(
      new AppError(404, "Category not found or not associated with this menu")
    );
  }

  const [check] = await pool.query(
    `SELECT * FROM items WHERE category_id = ? AND name = ? AND type = ?`,
    [id, name, type]
  );
  if (check.length >= 1) {
    return next(
      new AppError(401, `Item with this name and type already exists!`)
    );
  }

  const query = `INSERT INTO items (name, price, description, category_id, type, image) VALUES (?,?,?,?,?,?)`;
  const [result] = await pool.query(query, [
    name,
    price,
    description,
    id,
    type,
    thumbnailUrl[0].thumbnail,
  ]);

  if (result.affectedRows === 0) {
    return next(new AppError(400, "Failed to create item"));
  }

  res.status(200).json({
    status: "success",
    message: "Item created successfully",
    data: { id: result.insertId, name, description, price, type, thumbnailUrl },
  });
});

exports.createTitle = asyncChoke(async (req, res, next) => {
  const { title_name, make_price_option } = req.body;
  const restaurant_id = req.user.id;
  const { id } = req.params;

  if (!title_name) {
    return next(new AppError(400, "Provide title name"));
  }
  if (make_price_option !== true && make_price_option !== false) {
    return next(new AppError(400, "Make price option should be true or false"));
  }

  const [check] = await pool.query(
    `SELECT 
        r.id AS restaurant_id
    FROM 
        restaurants r
    JOIN 
        menus m ON r.id = m.restaurant_id
    JOIN 
        categories c ON m.id = c.menu_id
    JOIN 
        items i ON c.id = i.category_id
    WHERE 
        r.id = ?
        AND i.id = ?`,
    [restaurant_id, id]
  );

  if (check.length === 0) {
    return next(
      new AppError(404, "Item not found or not associated with this restaurant")
    );
  }
  const [itemCheck] = await pool.query(
    `SELECT * FROM customisation_title WHERE item_id = ? AND title = ?`,
    [id, title_name]
  );

  if (itemCheck.length === 1) {
    return next(new AppError(401, "Title with this name already exists"));
  }
  const [checkTitle] = await pool.query(
    `SELECT * FROM customisation_title WHERE item_id = ? && make_price_option = ?`,
    [id, true]
  );
  if (checkTitle.length === 1 && make_price_option === true) {
    return next(new AppError(401, "You cannot add 2 customisation as price"));
  }

  const query = `INSERT INTO customisation_title (item_id, title, make_price_option) VALUES (?, ?, ?)`;
  const [result] = await pool.query(query, [id, title_name, make_price_option]);

  if (result.affectedRows === 0) {
    return next(new AppError(400, "Failed to create title"));
  }

  res.status(200).json({
    status: "success",
    message: "Customisation title created successfully!",
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

  if (selection_type !== "one" && selection_type !== "more than one") {
    return next(
      new AppError(400, "Selection type must be 'one' or 'more than one'")
    );
  }

  const query =
    "UPDATE customisation_title SET selection_type = ? WHERE id = ?";
  const [result] = await pool.query(query, [selection_type, id]);

  if (result.affectedRows === 0) {
    return next(new AppError(400, "Failed to update selection type"));
  }

  res.status(200).json({
    status: "success",
    message: "selection type submited successfully!",
  });
});

exports.getTitlesByItemId = asyncChoke(async (req, res, next) => {
  const { id } = req.params;

  const query = `SELECT id, title, make_price_option FROM customisation_title WHERE item_id = ?`;
  const [titles] = await pool.query(query, [id]);

  if (!titles || titles.length === 0) {
    return next(new AppError(404, "No titles found for this item"));
  }

  res.status(200).json({
    status: "success",
    data: titles,
  });
});

exports.createOption = asyncChoke(async (req, res, next) => {
  const { option_name, additional_price } = req.body;
  const { id } = req.params;

  if (!option_name && !additional_price) {
    return next(new AppError(400, "Provide All Fields!"));
  }
  const checkQuery = `SELECT * FROM customisation_title WHERE id = ?`;
  const [options] = await pool.query(checkQuery, [id]);
  if (options.length <= 0) {
    return next(new AppError(404, "Customisation title not found!"));
  }
  const query = `INSERT INTO customisation_options (title_id, option_name, additional_price) VALUES (?, ?, ?)`;
  const [result] = await pool.query(query, [
    id,
    option_name,
    additional_price || 0.0,
  ]);

  if (result.affectedRows === 0) {
    return next(new AppError(400, "Failed to create option"));
  }

  res.status(200).json({
    status: "success",
    message: "Option created successfully!",
  });
});

exports.getOptionsByTitleId = asyncChoke(async (req, res, next) => {
  const { id } = req.params;

  const query = `SELECT * FROM customisation_options WHERE title_id = ?`;
  const [options] = await pool.query(query, [id]);
  if (options.length <= 0) {
    return next(new AppError(404, "Customisation title not found!"));
  }
  if (options.length === 0) {
    return next(
      new AppError(404, `No options found for title with id '${id}'`)
    );
  }

  res.status(200).json({
    status: "success",
    data: options,
  });
});

exports.getTitlesWithOptionsByItemId = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const restaurant_id = req.user.id;

  try {
    const verifyQuery = `
        SELECT i.id AS item_id
        FROM restaurants r
        JOIN menus m ON r.id = m.restaurant_id
        JOIN categories c ON m.id = c.menu_id
        JOIN items i ON c.id = i.category_id
        WHERE r.id = ? AND i.id = ?
      `;
    const [verificationResult] = await pool.query(verifyQuery, [
      restaurant_id,
      id,
    ]);

    if (verificationResult.length === 0) {
      return next(
        new AppError(403, "This item does not belong to your restaurant")
      );
    }

    const titlesQuery = `SELECT id AS title_id, title, make_price_option FROM customisation_title WHERE item_id = ?`;
    const [titles] = await pool.query(titlesQuery, [id]);

    if (!titles || titles.length === 0) {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    const titleIds = titles.map((title) => title.title_id);
    const optionsQuery = `SELECT * FROM customisation_options WHERE title_id IN (?)`;
    const [options] = await pool.query(optionsQuery, [titleIds]);

    const titlesWithOptions = titles.map((title) => {
      return {
        ...title,
        options: options.filter((option) => option.title_id === title.title_id),
      };
    });

    res.status(200).json({
      status: "success",
      data: titlesWithOptions,
    });
  } catch (error) {
    console.error(error);
    return next(new AppError(500, "Internal Server Error", error));
  }
});

exports.checkTitlesWithNoOptions = asyncChoke(async (req, res, next) => {
  const { id } = req.params;

  const checkTitlesQuery = `SELECT * FROM customisation_title WHERE item_id = ?`;
  const [titles] = await pool.query(checkTitlesQuery, [id]);

  if (titles.length === 0) {
    return next(new AppError(404, `No titles found for item with id '${id}'`));
  }

  const query = `
        SELECT customisation_title.id, customisation_title.title 
        FROM customisation_title 
        LEFT JOIN customisation_options 
        ON customisation_title.id = customisation_options.title_id 
        WHERE customisation_title.item_id = ? 
        GROUP BY customisation_title.id 
        HAVING COUNT(customisation_options.id) = 0
    `;
  const [titlesWithNoOptions] = await pool.query(query, [id]);

  if (titlesWithNoOptions.length === 0) {
    const updateQuery = `UPDATE items SET customisation = ? WHERE id = ?`;
    const value = [true, id];
    const [result] = await pool.query(updateQuery, value);
    if (result.affectedRows < 1) {
      return next(new AppError(400, "Cannot add customisation to this item!"));
    }
    return res.status(200).json({
      status: "success",
      message: "All titles have options",
    });
  }

  res.status(200).json({
    status: "success",
    titlesWithNoOptions,
  });
});

exports.updateOption = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { option_name, additional_price } = req.body;

  if (!option_name || additional_price == null) {
    return next(
      new AppError(400, "Option name and additional price are required")
    );
  }

  const query = `UPDATE customisation_options SET option_name = ?, additional_price = ? WHERE id = ?`;
  const [result] = await pool.query(query, [option_name, additional_price, id]);

  if (result.affectedRows === 0) {
    return next(new AppError(404, `Option with id '${id}' not found`));
  }

  res.status(200).json({
    status: "success",
    message: `Option with id '${id}' updated successfully`,
  });
});

exports.discardCustomizations = asyncChoke(async (req, res, next) => {
  const { id } = req.params;

  const fetchTitlesQuery = `SELECT id FROM customisation_title WHERE item_id = ?`;
  const [titles] = await pool.query(fetchTitlesQuery, [id]);

  if (titles.length === 0) {
    return next(new AppError(404, `No titles found for item with id '${id}'`));
  }

  const titleIds = titles.map((title) => title.id);

  const fetchOptionsQuery = `SELECT id FROM customisation_options WHERE title_id IN (?)`;
  const [options] = await pool.query(fetchOptionsQuery, [titleIds]);

  const optionIds = options.map((option) => option.id);

  if (optionIds.length > 0) {
    const deleteOptionsQuery = `DELETE FROM customisation_options WHERE id IN (?)`;
    await pool.query(deleteOptionsQuery, [optionIds]);
  }

  const deleteTitlesQuery = `DELETE FROM customisation_title WHERE id IN (?)`;
  await pool.query(deleteTitlesQuery, [titleIds]);

  res.status(200).json({
    status: "success",
    message: `All customizations for item with id '${id}' have been discarded`,
  });
});

exports.readItems = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM items WHERE category_id = ?`;
    const [result, fields] = await pool.query(query, [id]);
    return res.status(200).json({ result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getCustomizations = asyncChoke(async (req, res, next) => {
  const { id: item_id } = req.params;
  const user_id = req.user.id;

  const fetchTitlesQuery = `SELECT id, title, selection_type FROM customisation_title WHERE item_id = ?`;
  const [titles] = await pool.query(fetchTitlesQuery, [item_id]);

  if (titles.length === 0) {
    const [item] = await pool.query(
      `
            SELECT items.id as item_id, menus.restaurant_id
            FROM items
            JOIN categories ON items.category_id = categories.id
            JOIN menus ON categories.menu_id = menus.id
            WHERE items.id = ?
        `,
      [item_id]
    );

    if (item.length === 0) {
      return next(new AppError(404, "Item not found"));
    }

    const { item_id: itemIdInMenu, restaurant_id } = item[0];
    const [cart] = await pool.query(`SELECT * FROM cart WHERE user_id = ?`, [
      user_id,
    ]);
    const cart_id = cart[0].id;

    const [checkQuery] = await pool.query(
      "SELECT * FROM cart_items WHERE item_id = ? AND cart_id = ?",
      [itemIdInMenu, cart_id]
    );
    if (checkQuery.length > 0) {
      return next(new AppError(400, "Item is already in the cart"));
    }

    const [cartItems] = await pool.query(
      `
            SELECT items.id as item_id, menus.restaurant_id
            FROM cart_items
            JOIN items ON cart_items.item_id = items.id
            JOIN categories ON items.category_id = categories.id
            JOIN menus ON categories.menu_id = menus.id
            WHERE cart_items.cart_id = ?
        `,
      [cart_id]
    );

    const violatesConsistency = cartItems.some(
      (cartItem) => cartItem.restaurant_id !== restaurant_id
    );

    if (violatesConsistency) {
      return next(
        new AppError(
          400,
          "Cannot add items from different restaurants to the cart"
        )
      );
    }

    const query = `INSERT INTO cart_items (item_id, quantity, cart_id) VALUES (?, ?, ?)`;

    const [result] = await pool.query(query, [itemIdInMenu, quantity, cart_id]);
    if (result.affectedRows < 1) {
      return next(new AppError(400, "Error while adding item in cart!"));
    }

    res.json({
      status: "success",
      message: "Item added in your cart!",
    });
  }

  const customizations = {};

  for (const title of titles) {
    const fetchOptionsQuery = `SELECT id, option_name, additional_price FROM customisation_options WHERE title_id = ?`;
    const [options] = await pool.query(fetchOptionsQuery, [title.id]);

    customizations[title.title] = {
      selection_type: title.selection_type,
      title_id: title.id,
      title: title.title,
      options: options.map((option) => ({
        option_name: option.option_name,
        additional_price: option.additional_price,
        option_id: option.id,
      })),
    };
  }

  res.status(200).json({
    status: "success",
    customizations,
  });
});

exports.submitCustomizations = asyncChoke(async (req, res, next) => {
  const { id: item_id } = req.params;
  const user_id = req.user.id;
  const { customizations, quantity } = req.body;

  const [item] = await pool.query(
    `SELECT items.id as item_id, items.price as base_price, menus.restaurant_id
         FROM items
         JOIN categories ON items.category_id = categories.id
         JOIN menus ON categories.menu_id = menus.id
         WHERE items.id = ?`,
    [item_id]
  );

  if (item.length === 0) {
    return next(new AppError(404, "Item not found"));
  }

  const base_price = item[0]?.base_price;
  if (!base_price || isNaN(base_price)) {
    return next(
      new AppError(400, "Invalid or missing base price for the item")
    );
  }

  const [cart] = await pool.query(`SELECT * FROM cart WHERE user_id = ?`, [
    user_id,
  ]);
  if (cart.length === 0) {
    return next(new AppError(404, "Cart not found"));
  }
  const cart_id = cart[0].id;

  const [cartItems] = await pool.query(
    `SELECT * FROM cart_items WHERE item_id = ? AND cart_id = ?`,
    [item_id, cart_id]
  );
  if (cartItems.length === 1) {
    return next(new AppError(404, "Item is already in cart"));
  }

  if (!quantity || isNaN(quantity) || quantity <= 0) {
    return next(new AppError(400, "Invalid or missing quantity"));
  }

  let customization_price = 0;
  let final_base_price = parseFloat(base_price);

  for (const customization of customizations) {
    const { title_id, option_ids } = customization;

    const [title] = await pool.query(
      `SELECT make_price_option FROM customisation_title WHERE id = ? AND item_id = ?`,
      [title_id, item_id]
    );
    if (title.length === 0) {
      return next(new AppError(400, `Invalid title_id: ${title_id}`));
    }

    const make_price_option = title[0]?.make_price_option;

    for (const option_id of option_ids) {
      const [option] = await pool.query(
        `SELECT additional_price FROM customisation_options WHERE id = ? AND title_id = ?`,
        [option_id, title_id]
      );
      if (option.length === 0) {
        return next(new AppError(400, `Invalid option_id: ${option_id}`));
      }

      const option_price = parseFloat(option[0]?.additional_price);

      if (isNaN(option_price)) {
        return next(
          new AppError(
            400,
            `Invalid or missing price for option_id: ${option_id}`
          )
        );
      }

      if (make_price_option) {
        final_base_price = option_price;
      } else {
        customization_price += option_price;
      }
    }
  }

  const item_total = (final_base_price + customization_price) * quantity;

  const [addItemCart] = await pool.query(
    `INSERT INTO cart_items (item_id, quantity, cart_id, item_total) VALUES (?, ?, ?, ?)`,
    [item_id, quantity, cart_id, item_total]
  );

  const cart_item_id = addItemCart.insertId;

  for (const customization of customizations) {
    const { title_id, option_ids } = customization;

    for (const option_id of option_ids) {
      const insertQuery = `INSERT INTO cart_item_customizations (cart_item_id, title_id, option_id) VALUES (?, ?, ?)`;
      await pool.query(insertQuery, [cart_item_id, title_id, option_id]);
    }
  }

  res.status(200).json({
    status: "success",
    message: "Customizations submitted successfully",
  });
});

exports.submitCustomizationsWithCheck = asyncChoke(async (req, res, next) => {
  const { id: item_id } = req.params;
  const user_id = req.user.id;
  const { customizations, quantity } = req.body;

  if (!customizations || !quantity)
    return next(
      new AppError(401, "Provide selected customizations and quantity")
    );

  const [item] = await pool.query(
    `SELECT items.id as item_id, items.price as base_price, menus.restaurant_id
         FROM items
         JOIN categories ON items.category_id = categories.id
         JOIN menus ON categories.menu_id = menus.id
         WHERE items.id = ?`,
    [item_id]
  );

  if (item.length === 0) {
    return next(new AppError(404, "Item not found"));
  }

  const base_price = parseFloat(item[0]?.base_price);
  if (!base_price || isNaN(base_price)) {
    return next(
      new AppError(400, "Invalid or missing base price for the item")
    );
  }

  const [cart] = await pool.query(`SELECT * FROM cart WHERE user_id = ?`, [
    user_id,
  ]);
  if (cart.length === 0) {
    return next(new AppError(404, "Cart not found"));
  }
  const cart_id = cart[0].id;

  let customization_price = 0;
  let final_base_price = base_price;

  for (const customization of customizations) {
    const { title_id, option_ids } = customization;

    const [title] = await pool.query(
      `SELECT make_price_option FROM customisation_title WHERE id = ? AND item_id = ?`,
      [title_id, item_id]
    );
    if (title.length === 0) {
      return next(new AppError(400, `Invalid title_id: ${title_id}`));
    }

    const make_price_option = title[0]?.make_price_option;

    for (const option_id of option_ids) {
      const [option] = await pool.query(
        `SELECT additional_price FROM customisation_options WHERE id = ? AND title_id = ?`,
        [option_id, title_id]
      );
      if (option.length === 0) {
        return next(new AppError(400, `Invalid option_id: ${option_id}`));
      }

      const option_price = parseFloat(option[0]?.additional_price);
      if (isNaN(option_price)) {
        return next(
          new AppError(
            400,
            `Invalid or missing price for option_id: ${option_id}`
          )
        );
      }

      if (make_price_option) {
        final_base_price = option_price;
      } else {
        customization_price += option_price;
      }
    }
  }

  const item_total = (final_base_price + customization_price) * quantity;

  const [cartItems] = await pool.query(
    `SELECT ci.id as cart_item_id, ci.quantity 
         FROM cart_items ci
         LEFT JOIN cart_item_customizations cic ON ci.id = cic.cart_item_id
         WHERE ci.item_id = ? AND ci.cart_id = ?`,
    [item_id, cart_id]
  );

  let matchingCartItemId = null;
  let customizationMatches = false;

  for (const cartItem of cartItems) {
    const cart_item_id = cartItem.cart_item_id;

    const [existingCustomizations] = await pool.query(
      `SELECT title_id, option_id
             FROM cart_item_customizations
             WHERE cart_item_id = ?`,
      [cart_item_id]
    );

    customizationMatches =
      existingCustomizations.length === customizations.length &&
      customizations.every((cust) => {
        const { title_id, option_ids } = cust;
        return existingCustomizations.some(
          (exCust) =>
            exCust.title_id === title_id &&
            option_ids.every((optId) => optId === exCust.option_id)
        );
      });

    if (customizationMatches) {
      matchingCartItemId = cart_item_id;
      break;
    }
  }

  if (customizationMatches && matchingCartItemId) {
    await pool.query(
      `UPDATE cart_items 
             SET quantity = quantity + ?, item_total = item_total + ? 
             WHERE id = ?`,
      [quantity, item_total, matchingCartItemId]
    );
  } else {
    const [addItemCart] = await pool.query(
      `INSERT INTO cart_items (item_id, quantity, cart_id, item_total) VALUES (?, ?, ?, ?)`,
      [item_id, quantity, cart_id, item_total]
    );
    const cart_item_id = addItemCart.insertId;

    for (const customization of customizations) {
      const { title_id, option_ids } = customization;

      for (const option_id of option_ids) {
        await pool.query(
          `INSERT INTO cart_item_customizations (cart_item_id, title_id, option_id) VALUES (?, ?, ?)`,
          [cart_item_id, title_id, option_id]
        );
      }
    }
  }

  res.status(200).json({
    status: "success",
    message: "Customizations handled successfully",
  });
});

exports.getSelectedCustomizations = asyncChoke(async (req, res, next) => {
  const { id: cart_item_id } = req.params;
  const user_id = req.user.id;

  const [cart] = await pool.query(`SELECT * FROM cart WHERE user_id = ?`, [
    user_id,
  ]);
  if (cart.length === 0) {
    return next(new AppError(404, "Cart not found"));
  }

  const [cartItems] = await pool.query(
    `SELECT * FROM cart_items WHERE id = ?`,
    [cart_item_id]
  );
  if (cartItems.length === 0) {
    return next(new AppError(404, "Item not found in the cart"));
  }

  const fetchCustomizationsQuery = `
        SELECT
            cit.title_id,
            ct.title,
            cit.option_id,
            co.option_name,
            co.additional_price,
            ct.selection_type
        FROM cart_item_customizations cit
        JOIN customisation_title ct ON cit.title_id = ct.id
        JOIN customisation_options co ON cit.option_id = co.id
        WHERE cit.cart_item_id = ?`;

  const [customizations] = await pool.query(fetchCustomizationsQuery, [
    cart_item_id,
  ]);

  if (customizations.length === 0) {
    return next(new AppError(404, "No customizations found for this item"));
  }

  const result = {};
  customizations.forEach((customization) => {
    const {
      title,
      option_id,
      option_name,
      additional_price,
      selection_type,
      title_id,
    } = customization;

    if (!result[title]) {
      result[title] = {
        selection_type,
        title_id,
        title,
        options: [],
      };
    }

    result[title].options.push({
      option_id,
      option_name,
      additional_price,
    });
  });

  res.status(200).json({
    status: "success",
    data: result,
  });
});

exports.updateItemCustomizations = asyncChoke(async (req, res, next) => {
  const { id: cart_item_id } = req.params;
  const { customizations, quantity } = req.body;

  const [cartItem] = await pool.query(
    `SELECT ci.item_id, i.price as base_price
         FROM cart_items ci
         JOIN items i ON ci.item_id = i.id
         WHERE ci.id = ?`,
    [cart_item_id]
  );

  if (cartItem.length === 0) {
    return next(new AppError(404, "Cart item not found"));
  }

  const { item_id, base_price } = cartItem[0];
  if (!base_price || isNaN(base_price)) {
    return next(
      new AppError(400, "Invalid or missing base price for the item")
    );
  }

  let customization_price = 0;
  let final_base_price = parseFloat(base_price);

  const [currentCustomizations] = await pool.query(
    `SELECT * FROM cart_item_customizations WHERE cart_item_id = ?`,
    [cart_item_id]
  );

  const currentCustomizationMap = new Map();
  currentCustomizations.forEach((cust) => {
    if (!currentCustomizationMap.has(cust.title_id)) {
      currentCustomizationMap.set(cust.title_id, new Set());
    }
    currentCustomizationMap.get(cust.title_id).add(cust.option_id);
  });

  for (const customization of customizations) {
    const { title_id, option_ids } = customization;

    const [title] = await pool.query(
      `SELECT make_price_option FROM customisation_title WHERE id = ? AND item_id = ?`,
      [title_id, item_id]
    );
    if (title.length === 0) {
      return next(new AppError(400, `Invalid title_id: ${title_id}`));
    }

    const make_price_option = title[0]?.make_price_option;

    for (const option_id of option_ids) {
      const [option] = await pool.query(
        `SELECT additional_price FROM customisation_options WHERE id = ? AND title_id = ?`,
        [option_id, title_id]
      );
      if (option.length === 0) {
        return next(new AppError(400, `Invalid option_id: ${option_id}`));
      }

      const option_price = parseFloat(option[0]?.additional_price);
      if (isNaN(option_price)) {
        return next(
          new AppError(
            400,
            `Invalid or missing price for option_id: ${option_id}`
          )
        );
      }

      if (make_price_option) {
        final_base_price = option_price;
      } else {
        customization_price += option_price;
      }

      if (
        currentCustomizationMap.has(title_id) &&
        currentCustomizationMap.get(title_id).has(option_id)
      ) {
        currentCustomizationMap.get(title_id).delete(option_id);
      } else {
        const insertQuery = `INSERT INTO cart_item_customizations (cart_item_id, title_id, option_id) VALUES (?, ?, ?)`;
        await pool.query(insertQuery, [cart_item_id, title_id, option_id]);
      }
    }
  }

  for (const [title_id, option_ids] of currentCustomizationMap.entries()) {
    for (const option_id of option_ids) {
      const deleteQuery = `DELETE FROM cart_item_customizations WHERE cart_item_id = ? AND title_id = ? AND option_id = ?`;
      await pool.query(deleteQuery, [cart_item_id, title_id, option_id]);
    }
  }

  const updated_item_total =
    (final_base_price + customization_price) * quantity;

  await pool.query(
    `UPDATE cart_items SET item_total = ?, quantity = ? WHERE id = ?`,
    [updated_item_total, quantity, cart_item_id]
  );

  res.status(200).json({
    status: "success",
    message: "Customizations updated successfully",
    item_total: updated_item_total,
  });
});
