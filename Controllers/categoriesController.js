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
  const RestaurantQuery = `SELECT * FROM menus WHERE restaurant_id = ?`;
  const [menu] = await db.query(RestaurantQuery, [restaurant_id]);

  if (!menu.length) {
      return next(new AppError(404, "No menu found for the given restaurant"));
  }

  const menuId = menu[0].id;
  

  const query = 'SELECT * FROM categories WHERE menu_id = ?';
  const [rows] = await db.query(query, [menuId]);

  if (!rows.length) {
      return next(new AppError(404, 'No categories found for this menu id'));
  }

  res.status(200).json({
      status: 'success',
      result: rows,
  });
});

  