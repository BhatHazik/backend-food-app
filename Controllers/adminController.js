const db = require('../Config/database');
const AppError = require('../Utils/error');
const {asyncChoke} = require('../Utils/asyncWrapper');

exports.getRestaurantsAdmin = async(req, res)=>{
    try{
    const qurey = `select * from restaurants where approved = ?`
    const [rows, feilds] = await db.query(qurey, [false]);
    res.status(200).json({
        status: 'Success',
        data: rows,
      });
    } catch (error) {
        console.error('Error getting all unApproved restaurants:', error);
        res.status(500).json({
          status: 'Error',
          message: 'Internal server error',
        });
      }   
}


exports.approveRestaurants = asyncChoke(async(req, res, next)=>{
        const {id} = req.params;
        const query = `UPDATE restaurants SET approved = ? where id = ?`
        const result = await db.query(query, [true , id]);
    if (result.affectedRows === 0) {
      return next(new AppError(404, `Restaurant with id '${id}' not found`))
    }
    const menuAddQuery = `INSERT INTO menus (name,restaurant_id) VALUES (?,?)`
    const insertValues = [`Menu-${id}`,id];
    const [Menu] = await db.query(menuAddQuery, insertValues);
    if(Menu.affectedRows=== 0){
      return next(new AppError(400, `error while adding menu to this restaurant ${id}`))
    }
    res.status(200).json({
      status: 'Success',
      message: `Restaurant with id '${id}' Approved and its menu created successfully`,
    });
})



exports.getDeleveryBoysAdmin = async(req, res)=>{
  try{
  const qurey = `select * from deliveryboys where approved = ?`
  const [rows, feilds] = await db.query(qurey, [false]);
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
      const result = await db.query(query, [true , id]);
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





