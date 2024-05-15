const db = require('../Config/database');


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


exports.approveRestaurants = async(req, res)=>{
    try{
        const {id} = req.params;
        const query = `UPDATE restaurants SET approved = ?`
        const result = await db.query(query, [true]);
    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'Error',
        message: `Restaurant with id '${id}' not found`,
      });
    }
    res.status(200).json({
      status: 'Success',
      message: `Restaurant with id '${id}' Approved successfully`,
    });
  } catch (error) {
    console.error('Error while Approving restaurants', error);
    res.status(500).json({
      status: 'Error',
      message: 'Internal server error',
    });
  }
}


