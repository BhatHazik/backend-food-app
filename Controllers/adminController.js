const {pool} = require('../Config/database');
const AppError = require('../Utils/error');
const {asyncChoke} = require('../Utils/asyncWrapper');

exports.getRestaurantsAdmin = asyncChoke(async(req, res, next)=>{
    try{
    const qurey = `select * from restaurants where approved = ?`
    const [rows, feilds] = await pool.query(qurey, [false]);
    if(rows.length > 0){
      res.status(200).json({
        status: 'Success',
        data: rows,
      });
    } else{
      return next(new AppError(404, `No Restaurant Approvals Found!`))
    }
    
    } catch (error) {
        // console.error('Error getting all unApproved restaurants:', error);
        res.status(500).json({
          status: 'Error',
          message: 'Internal server error',
        });
      }
});



exports.approveRestaurants = asyncChoke(async(req, res, next)=>{
        const {id} = req.params;
        const [check] = await pool.query(`SELECT * FROM restaurants WHERE id = ?`, [id]);
        if(check.length <= 0){
          return next(new AppError(404, `Restaurant with id '${id}' not found`))
        }
        if(check[0].approved === 1){
          return next(new AppError(400, `Restaurant with id '${id}' is already approved`))
        }
        
        const query = `UPDATE restaurants SET approved = ? where id = ?`
        const result = await pool.query(query, [true , id]);
    if (result.affectedRows === 0) {
      return next(new AppError(400, `can't approve restaurant with id '${id}'`))
    }
    const menuAddQuery = `INSERT INTO menus (name,restaurant_id) VALUES (?,?)`
    const insertValues = [`Menu-${id}`,id];
    const [Menu] = await pool.query(menuAddQuery, insertValues);
    if(Menu.affectedRows=== 0){
      return next(new AppError(400, `error while adding menu to this restaurant ${id}`))
    }
    res.status(200).json({
      status: 'Success',
      message: `Restaurant with id '${id}' Approved and its menu created successfully`,
    });
});



exports.getDeleveryBoysAdmin = async(req, res)=>{
  try{
  const qurey = `select * from deliveryboys where approved = ?`
  const [rows, feilds] = await pool.query(qurey, [false]);
  res.status(200).json({
      status: 'Success',
      data: rows,
    });
  } catch (error) {
      console.error('Error getting all unApproved DeleveryBoys:', error);
      res.status(500).json({
        status: 'Error',
        message: 'Internal server error',
      });
    }   
}



exports.approveDeleveryBoys = async(req, res)=>{
  try{
      const {id} = req.params;
      const query = `UPDATE deliveryboys SET approved = ? where id = ?`
      const result = await pool.query(query, [true , id]);
  if (result.affectedRows === 0) {
    return res.status(404).json({
      status: 'Error',
      message: `delivery with id '${id}' not found`,
    });
  }
  res.status(200).json({
    status: 'Success',
    message: `deliveryBoy with id '${id}' Approved successfully`,
  });

} catch (error) {
  console.error('Error while Approving DeleveryBoys', error);
  res.status(500).json({
    status: 'Error',
    message: 'Internal server error',
  });
}
}




exports.createMainCategory = asyncChoke(async (req, res, next) => {
  const { name, image_url } = req.body;

  // Validate input
  if (!name || !image_url) {
    return res.status(400).json({
      status: "Error",
      message: "Name and image URL are required",
    });
  }

  const query = `
    INSERT INTO main_categories (name, image_url)
    VALUES (?, ?)
  `;

  const [result] = await pool.query(query, [name, image_url]);

  res.status(201).json({
    status: "Success",
    data: {
      id: result.insertId,
      name,
      image_url,
    },
  });
});




exports.updateMainCategory = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { name, image_url } = req.body;

  // Validate input
  if (!name && !image_url) {
    return res.status(400).json({
      status: "Error",
      message: "At least one field (name or image URL) is required to update",
    });
  }

  const query = `
    UPDATE main_categories
    SET name = COALESCE(?, name), image_url = COALESCE(?, image_url), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  const [result] = await pool.query(query, [name, image_url, id]);

  if (result.affectedRows === 0) {
    return res.status(404).json({
      status: "Error",
      message: "Category not found",
    });
  }

  res.status(200).json({
    status: "Success",
    message: "Category updated successfully",
  });
});





exports.deleteMainCategory = asyncChoke(async (req, res, next) => {
  const { id } = req.params;

  const query = `
    DELETE FROM main_categories
    WHERE id = ?
  `;

  const [result] = await pool.query(query, [id]);

  if (result.affectedRows === 0) {
    return res.status(404).json({
      status: "Error",
      message: "Category not found",
    });
  }

  res.status(200).json({
    status: "Success",
    message: "Category deleted successfully",
  });
});


