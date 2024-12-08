const {pool} = require('../Config/database');
const AppError = require('../Utils/error');
const {asyncChoke} = require('../Utils/asyncWrapper');

exports.getRestaurantsAdmin = asyncChoke(async(req, res, next)=>{
  const {approvalType} = req.query;
    try{
      if(approvalType !== 'pending' && approvalType !== 'approved'){
        return next(new AppError(400, "Invalid approval type! Please provide pending or approved for restaurants."))
      }
      let approval;
      if(approvalType === 'approved'){
        approval = 1;
      } else if(approvalType === 'pending'){
        approval = 0;
      }
    const qurey = `SELECT 
  -- Restaurant Information
  r.id AS restaurant_id,
  r.owner_name,
  r.owner_email,
  r.owner_phone_no,
  r.restaurant_name,
  r.pan_no,
  r.GSTIN_no,
  r.FSSAI_no,
  r.outlet_type,
  r.bank_IFSC,
  r.bank_account_no,
  r.approved,
  r.updated_at,
  
  -- Restaurant Address Information
  ra.id AS address_id,
  ra.street,
  ra.landmark,
  ra.area,
  ra.pincode,
  ra.city,
  ra.state,
  ra.latitude,
  ra.longitude,
  
  -- Restaurant Documents Information
  rd.id AS document_id,
  rd.pan_no AS doc_pan_no,
  rd.GSTIN_no AS doc_GSTIN_no,
  rd.FSSAI_no AS doc_FSSAI_no,
  rd.outlet_type AS doc_outlet_type,
  rd.bank_IFSC AS doc_bank_IFSC,
  rd.bank_account_no AS doc_bank_account_no,
  
  -- Restaurant Working Hours Information
  rw.id AS working_id,
  rw.monday,
  rw.tuesday,
  rw.wednesday,
  rw.thursday,
  rw.friday,
  rw.saturday,
  rw.sunday,
  rw.opening_time,
  rw.closing_time
  
FROM restaurants r
LEFT JOIN restaurantaddress ra ON ra.restaurant_id = r.id
LEFT JOIN restaurant_docs rd ON rd.restaurant_id = r.id
LEFT JOIN restaurants_working rw ON rw.restaurant_id = r.id
WHERE approved = ?;
`
    const [results] = await pool.query(qurey, [approval]);
    const structuredData = results.map(row => ({
      restaurant_info: {
        id: row.restaurant_id,
        owner_name: row.owner_name,
        owner_email: row.owner_email,
        owner_phone_no: row.owner_phone_no,
        restaurant_name: row.restaurant_name,
        pan_no: row.pan_no,
        GSTIN_no: row.GSTIN_no,
        FSSAI_no: row.FSSAI_no,
        outlet_type: row.outlet_type,
        bank_IFSC: row.bank_IFSC,
        bank_account_no: row.bank_account_no,
        approved: row.approved,
        updated_at: row.updated_at
      },
      address_info: {
        id: row.address_id,
        street: row.street,
        landmark: row.landmark,
        area: row.area,
        pincode: row.pincode,
        city: row.city,
        state: row.state,
        latitude: row.latitude,
        longitude: row.longitude
      },
      documents_info: {
        id: row.document_id,
        pan_no: row.doc_pan_no,
        GSTIN_no: row.doc_GSTIN_no,
        FSSAI_no: row.doc_FSSAI_no,
        outlet_type: row.doc_outlet_type,
        bank_IFSC: row.doc_bank_IFSC,
        bank_account_no: row.doc_bank_account_no
      },
      working_info: {
        id: row.working_id,
        monday: row.monday,
        tuesday: row.tuesday,
        wednesday: row.wednesday,
        thursday: row.thursday,
        friday: row.friday,
        saturday: row.saturday,
        sunday: row.sunday,
        opening_time: row.opening_time,
        closing_time: row.closing_time
      }
    }));
    
   
    
    if(results.length > 0){
      res.status(200).json({
        status: 'Success',
        data: structuredData,
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
        const {approvalType} = req.query;
        try{
          if(approvalType !== 'pending' && approvalType !== 'approved'){
            return next(new AppError(400, "Invalid approval type! Please provide pending or approved for restaurants."))
          }
          let approval;
          if(approvalType === 'approved'){
            approval = 1;
          } else if(approvalType === 'pending'){
            approval = 0;
          }

        const [check] = await pool.query(`SELECT * FROM restaurants WHERE id = ?`, [id]);
        if(check.length <= 0){
          return next(new AppError(404, `Restaurant with id '${id}' not found`))
        }
        if(check[0].approved === 1 && approval === 1){
          return next(new AppError(400, `Restaurant with id '${id}' is already approved`))
        }
        
        const query = `UPDATE restaurants SET approved = ? where id = ?`
        const result = await pool.query(query, [approval , id]);
    if (result.affectedRows === 0) {
      return next(new AppError(400, `can't ${approvalType} restaurant with id '${id}'`))
    }
    const [check2] = await pool.query(`SELECT * FROM menus WHERE restaurant_id = ?`, [id])
    if(check2.length === 0){
      const menuAddQuery = `INSERT INTO menus (name,restaurant_id) VALUES (?,?)`
      const insertValues = [`Menu-${id}`,id];
      const [Menu] = await pool.query(menuAddQuery, insertValues);
      if(Menu.affectedRows=== 0){
        return next(new AppError(400, `error while adding menu to this restaurant ${id}`))
      }
    }
    
    res.status(200).json({
      status: 'Success',
      message: `Restaurant with id '${id}' set to ${approvalType} successfully`,
    });
  }catch(err){
    return next(new AppError(500, 'Internal Server Error', err))
  }
});



exports.getDeleveryBoysAdmin = asyncChoke(async(req, res, next)=>{
  const {approvalType} = req.query;
  try{

    if(approvalType !== 'approved' && approvalType !== 'pending' && approvalType !== 'declined'){
      return next(new AppError(400, 'Invalid approval type. Use approved, pending, declined or all'))
    }

  const qurey = `SELECT 
  db.id AS delivery_boy_id,
  db.first_name,
  db.last_name,
  db.gender,
  db.profile_pic,
  db.approved,
  db.phone_no,
  
  dbd.id AS delivery_doc_id,
  dbd.adhar_front,
  dbd.adhar_back,
  dbd.pan_front,
  dbd.pan_back,
  dbd.dl_front,
  dbd.dl_back,
  
  dbb.id AS delivery_bank_id,
  dbb.account_no,
  dbb.bank_name,
  dbb.IFSC_code,
  
  dv.id AS delivery_vehicle_id,
  dv.vehicle_no,
  dv.registration_no,
  dv.vehicle_type,
  dv.vehicle_image,
  
  dw.id AS delivery_work_id,
  dw.type AS work_type,
  dw.work_area
  
FROM delivery_boys db
JOIN delivery_docs dbd ON dbd.del_id = db.id
JOIN delivery_work dw ON dw.del_id = db.id
JOIN delivery_bank dbb ON dbb.del_id = db.id
JOIN delivery_vehicles dv ON dv.del_id = db.id
WHERE db.approved = ?

`
  const [results] = await pool.query(qurey, [approvalType]);
  const structuredData = results.map(row => ({
    personal_info: {
      id: row.delivery_boy_id,
      first_name: row.first_name,
      last_name: row.last_name,
      gender: row.gender,
      profile_pic: row.profile_pic,
      approved: row.approved,
      phone_no: row.phone_no
    },
    documents: {
      id: row.delivery_doc_id,
      adhar_front: row.adhar_front,
      adhar_back: row.adhar_back,
      pan_front: row.pan_front,
      pan_back: row.pan_back,
      dl_front: row.dl_front,
      dl_back: row.dl_back
    },
    bank_details: {
      id: row.delivery_bank_id,
      account_no: row.account_no,
      bank_name: row.bank_name,
      IFSC_code: row.IFSC_code
    },
    vehicle_info: {
      id: row.delivery_vehicle_id,
      vehicle_no: row.vehicle_no,
      registration_no: row.registration_no,
      vehicle_type: row.vehicle_type,
      vehicle_image: row.vehicle_image
    },
    work_info: {
      id: row.delivery_work_id,
      work_type: row.work_type,
      work_area: row.work_area
    }
  }));
  res.status(200).json({
      status: 'Success',
      data: structuredData,
    });
  } catch (error) {
      console.error('Error getting all unApproved DeleveryBoys:', error);
      return next(new AppError(500, 'Internal Server Error', error))
    }   
})



exports.approveDeleveryBoys = asyncChoke(async(req, res,next)=>{
  const {id} = req.params;
  const {approveType} = req.query;
  try{
      if(approveType!== 'approved' && approveType!== 'declined'){
        return next(new AppError(400, 'Invalid approval type. Use approved, pending, declined or all'))
      }

      const [check] = await pool.query(`SELECT * FROM delivery_boys WHERE id =?`, [id]);
      if(check.length <= 0){
        return next(new AppError(404, `Delivery boy with id '${id}' not found`))
      }
      
      if(approveType === check[0].approved){
        return next(new AppError(400, `Delivery boy with id '${id}' is already ${approveType}`))
      }

      const query = `UPDATE delivery_boys SET approved = ? where id = ?`

      await pool.query(query, [approveType , id]);
  
  res.status(200).json({
    status: 'Success',
    message: `deliveryBoy with id '${id}' ${approveType} successfully`,
  });

} catch (error) {
  console.error('Error while Approving DeleveryBoys', error);
  res.status(500).json({
    status: 'Error',
    message: 'Internal server error',
  });
}
})




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


