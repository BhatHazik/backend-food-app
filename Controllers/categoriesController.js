const db = require('../Config/database');
const AppError = require('../Utils/error');
const {asyncChoke} = require('../Utils/asyncWrapper');


exports.addCategoryById = asyncChoke(async (req, res, next) => {
  const { categoryName } = req.body;
  const restaurant_id = req.user.id;

  // Fetch menu for the given restaurant ID
  const RestaurantQuery = `SELECT * FROM menus WHERE restaurant_id = ?`;
  const [menu] = await db.query(RestaurantQuery, [restaurant_id]);

  if (!menu.length) {
      return next(new AppError(404, "No menu found for the given restaurant"));
  }

  const menuId = menu[0].id;
  console.log(menuId);

  // Insert category with the fetched menu_id
  const query = `INSERT INTO categories (category, menu_id) VALUES (?, ?)`;
  const [result] = await db.query(query, [categoryName, menuId]);

  if (result.affectedRows === 0) {
      return next(new AppError(400, "Error while adding category"));
  }

  res.status(200).json({
      status: "success",
      message: "Category added successfully"
  });
});




// get all categories by menu_id


exports.getAllCategories = asyncChoke(async (req, res, next) => {
    const restaurant_id = req.user.id;
  
    // Fetch menu for the given restaurant ID
    const RestaurantQuery = 'SELECT * FROM menus WHERE restaurant_id = ?';
    const [menu] = await db.query(RestaurantQuery, [restaurant_id]);
  
    if (!menu.length) {
      return next(new AppError(404, 'No menu found for the given restaurant'));
    }
  
    const menuId = menu[0].id;
  
    const categoryQuery = 'SELECT * FROM categories WHERE menu_id = ?';
    const [categories] = await db.query(categoryQuery, [menuId]);
  
    if (!categories.length) {
      return next(new AppError(404, 'No categories found for this menu id'));
    }
  
    // Fetch item counts for each category
    const categoryIds = categories.map(category => category.id);
    const itemCountQuery = `
      SELECT category_id, COUNT(*) as item_count
      FROM items
      WHERE category_id IN (?)
      GROUP BY category_id
    `;
    const [itemCounts] = await db.query(itemCountQuery, [categoryIds]);
  
    // Create a map of category_id to item_count for easy lookup
    const itemCountMap = itemCounts.reduce((acc, itemCount) => {
      acc[itemCount.category_id] = itemCount.item_count;
      return acc;
    }, {});
  
    // Add item_count to each category
    const result = categories.map(category => ({
      ...category,
      item_count: itemCountMap[category.id] || 0
    }));
  
    res.status(200).json({
      status: 'success',
      result
    });
  });
  

  