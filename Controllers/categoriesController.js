const db = require('../Config/database');



exports.addCategoryById = async(req, res) =>{
    try{
    const {id} = req.params;
    const {categoryName} = req.body;
    const query = `INSERT INTO categories (category, menu_id) VALUES (?,?)`
    const values = [categoryName, id];
    const result = await db.query(query, values);
    if(!result || result.length[0]){
        res.json({
            status:"error",
            message:"no menu found"
        })
    }
    res.json({
        status: "success",
        result
    })
    } catch(err){
        console.log(err)
        res.json({
            status:"error",
            message: "error while adding category"
        })
    }
}


// get all categories by menu_id


exports.getAllCategories = async (req, res) => {
    try {
      const { id } = req.params;
      const query = 'SELECT * FROM categories WHERE menu_id = ?';
      const [rows] = await db.query(query, [id]);
  
      if (!rows || rows.length === 0) {
        return res.status(404).json({
          status: 'Error',
          message: 'No categories found for this menu id',
        });
      }
  
      res.status(200).json({
        status: 'Success',
        result: rows,
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        status: 'Error',
        message: 'Internal server error',
      });
    }
  };
  