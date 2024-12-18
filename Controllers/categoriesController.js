const {pool} = require('../Config/database');
const AppError = require('../Utils/error');
const {asyncChoke} = require('../Utils/asyncWrapper');


exports.addCategoryById = asyncChoke(async (req, res, next) => {
  const { categoryName } = req.body;
  const restaurant_id = req.user.id;
  console.log(restaurant_id);
  if(!categoryName || categoryName === ""){
    return next(new AppError(401, "Category name required!"));
  }
  const [approved]= await pool.query(`SELECT * FROM restaurants WHERE id = ? AND approved = ?`, [restaurant_id, true]);
  if(!approved.length || approved.length === 0){
    return next(new AppError(401, "Restaurant is currently not approved!"));
  }
  // Fetch menu for the given restaurant ID
  const RestaurantQuery = `SELECT * FROM menus WHERE restaurant_id = ?`;
  const [menu] = await pool.query(RestaurantQuery, [restaurant_id, true]);

  if (!menu.length) {
      return next(new AppError(404, "No menu found for the given restaurant"));
  }
  

  const menuId = menu[0].id;

  const [check] = await pool.query(`SELECT * FROM categories WHERE category = ? AND menu_id = ?`, [categoryName, menuId]);
  // console.log(check.length);
  if( check.length === 1 ){
    return next(new AppError(401, "Category with this name already exists!"));
  }

  // Insert category with the fetched menu_id
  const query = `INSERT INTO categories (category, menu_id) VALUES (?, ?)`;
  const [result] = await pool.query(query, [categoryName, menuId]);

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
  
    const [approved]= await pool.query(`SELECT * FROM restaurants WHERE id = ? AND approved = ?`, [restaurant_id, true]);
  if(!approved.length || approved.length === 0){
    return next(new AppError(401, "Restaurant is currently not approved!"));
  }
    // Fetch menu for the given restaurant ID
    const RestaurantQuery = 'SELECT * FROM menus WHERE restaurant_id = ?';
    const [menu] = await pool.query(RestaurantQuery, [restaurant_id]);
  
    if (!menu.length) {
      return next(new AppError(404, 'No menu found for the given restaurant'));
    }
  
    const menuId = menu[0].id;
  
    const categoryQuery = 'SELECT * FROM categories WHERE menu_id = ?';
    const [categories] = await pool.query(categoryQuery, [menuId]);
  
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
    const [itemCounts] = await pool.query(itemCountQuery, [categoryIds]);
  console.log(itemCounts);
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
  


  exports.DeleteCategory = asyncChoke(async (req, res, next) => {
    const { categoryId } = req.params;
    const restaurant_id = req.user.id;
  
    try {
      const [approved]= await pool.query(`SELECT * FROM restaurants WHERE id = ? AND approved = ?`, [restaurant_id, true]);
  if(!approved.length || approved.length === 0){
    return next(new AppError(401, "Restaurant is currently not approved!"));
  }
      // Fetch menu for the given restaurant ID
      const RestaurantQuery = 'SELECT id FROM menus WHERE restaurant_id = ?';
      const [menu] = await pool.query(RestaurantQuery, [restaurant_id]);
  
      if (!menu.length) {
        return next(new AppError(404, 'No menu found for the given restaurant'));
      }
  
      const menuId = menu[0].id;
      const getcategoryQuery = 'SELECT id FROM categories WHERE menu_id = ? and id = ?';
      const [getcategories] = await pool.query(getcategoryQuery, [menuId, categoryId]);
  
      if (!getcategories.length) {
        return next(new AppError(404, 'No such category found!'));
      }
      const getItemsCategoryQuery = 'SELECT * FROM items WHERE category_id = ?'
      const [getItems] = await pool.query(getItemsCategoryQuery, [categoryId]);
      const itemsLength = getItems.length;
      if(getItems.length > 0){
        const deleteItemsQuery = 'DELETE FROM items WHERE category_id = ?';
      const [deletedItems] = await pool.query(deleteItemsQuery, [categoryId]);
  
      if (deletedItems.affectedRows === 0) {
        return next(new AppError(401, 'Error while deleting items with this category!'));
      }
      }
      
  
      const categoryQuery = 'DELETE FROM categories WHERE menu_id = ? AND id = ?';
      const [categories] = await pool.query(categoryQuery, [menuId, categoryId]);
  
      if (categories.affectedRows === 0) {
        return next(new AppError(404, 'Unable to delete this category, try again later!'));
      }
  
      res.status(200).json({
        status: 'success',
        message: `Category and its ${itemsLength} items deleted successfully`
      });
    } catch (err) {
      return next(new AppError(500, err));
    }
  });
  

  exports.getAllMainCategories = asyncChoke(async (req, res, next) => {
    const query = `
      SELECT id, name, image_url, created_at, updated_at
      FROM main_categories
    `;
    let rows 
    const [dataRows] = await pool.query(query);
    rows = dataRows
    res.status(200).json({
      status: "Success",
      data: rows,
    });
  });
  