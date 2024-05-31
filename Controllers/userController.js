const db = require('../Config/database');
const jwt = require('jsonwebtoken');
const { asyncChoke } = require('../Utils/asyncWrapper');
const AppError = require('../Utils/error');

// create or signup with otp



const createSendToken = (res, req, phone_no) => {
    const tokenOptions = { expiresIn: process.env.JWT_EXPIRY };
    const token = jwt.sign(
      { data: phone_no },
      process.env.JWT_SECRET,
      tokenOptions
    );
    return token;
}

// create otp on number
// createUserOTP API
const createUserOTP = asyncChoke(async (req, res, next) => {
    const generateOTP = () => Math.floor(1000 + Math.random() * 9000);
    const otp = generateOTP();
    const { username, email, phone_no } = req.body;
   
        if( username !== "" && email !== "" && phone_no !== ""){
            const checkQuery = `SELECT * FROM users WHERE phone_no = ? OR email = ?;`;
        const [checkResult] = await db.query(checkQuery, [phone_no, email]);

        if (checkResult.length > 0) {
            return next(new AppError(400, 'Phone number or email already exists'));
            
        } else {
            const insertQuery = `INSERT INTO otps (phone_no, otp) VALUES (?, ?);`;
            await db.query(insertQuery, [phone_no, otp]);

            return res.status(200).json({ username, email , phone_no, otp });
        }
        }else{
            
            return next(new AppError(400, "fill all feilds"))
            
        }
        
});



// userSignUp API
const userSignUp = asyncChoke(async (req, res, next) => {
        const { givenOTP } = req.body;
        const { name , email, phNO: phone_no } = req.params;

       
        if (givenOTP !== "" && phone_no !== "" && email !== "" && name !== "") {
            const checkUserQuery = `SELECT COUNT(*) AS phone_exist FROM users WHERE phone_no = ?`;
        const [userResult] = await db.query(checkUserQuery, [phone_no]);

        if (userResult[0].phone_exist > 0) {
            return next(new AppError(409, 'user already exists'));
        }

        const checkOTPQuery = `SELECT COUNT(*) AS otp_matched FROM otps WHERE phone_no = ? AND otp = ?`;
        const [otpResult] = await db.query(checkOTPQuery, [phone_no, givenOTP]);

        if (otpResult[0].otp_matched === 0) {
            return next(new AppError(401,'Invalid OTP' ))
        }
        const token = createSendToken(res, req, phone_no);
        const insertUserQuery = `INSERT INTO users (username, email, phone_no) VALUES (?, ?, ?)`;
        await db.query(insertUserQuery, [name, email, phone_no]);

        return res.status(200).json({ message: "Account created" , token});
        }
        else{
            return next(new AppError(400 , 'Fill all fields'));
        }
        
});




// read


const readUsers = async (req, res) => {
    
        const query = `SELECT * FROM user`;
        const [result, fields] = await db.query(query);
        res.status(200).json({ result });
    
};

// update


const updateUser = asyncChoke(async (req, res, next) => {
   
        const { newUsername, oldUsername, phone_no } = req.body;

        // Check if all required fields are provided
        if (!newUsername || !oldUsername || !phone_no) {
            return next(new AppError(400, 'Fill all fields'));
         }

        // Proceed with the update if all fields are provided
        const query = `UPDATE users SET username = ?, phone_no = ? WHERE username = ? AND phone_no = ?`;
        const [result, fields] = await db.query(query, [newUsername, phone_no, oldUsername, phone_no]);
        
        return res.status(200).json({ result });
    
});


// delete


const deleteUser = asyncChoke(async (req, res, next) => {
  
        const { username } = req.body;

        // Check if username is provided
        if (!username) {
            return next(new AppError(400, 'Fill all fields'));
        }

        // Proceed with deletion if username is provided
        const query = `DELETE FROM user WHERE username = ?`;
        const [result, fields] = await db.query(query, [username]);

        return res.status(200).json({ result });
    
});



// OTPSENDER
const userOTPsender = asyncChoke(async (req, res, next) => {
   
        const generateOTP = () => {
            return Math.floor(1000 + Math.random() * 9000);
        };

        const otp = generateOTP();
        const { phone_no } = req.body;
        // Check if phone_no is provided
        if (!phone_no) {
            return next(new AppError(400, 'Fill all fields'));
        }
        
        const [checkQuery] = await db.query(`SELECT * FROM users WHERE phone_no = ?`, [phone_no]);
        
        if(checkQuery.length === 1){
            // Update OTP in the database for the provided phone number
        const query = `UPDATE otps SET otp = ? WHERE phone_no = ?`;
        const [result, fields] = await db.query(query, [otp, phone_no]);
        return res.status(200).json({ message: 'OTP sent successfully', otp });
        }
        return next(new AppError(404, 'User not found'));
        
   
});




// OTP CHECKER (LOGIN)
const userLogin = asyncChoke( async (req, res, next) => {
    
        const { givenOTP } = req.body;
        const phone_no = req.params.phNO;
        

        // Check if givenOTP is provided
        if (!givenOTP) {
            return next(new AppError(400, "Provide an otp"));
        }
        if(!phone_no){
            return next(new AppError(400, "Provide an Phone_no"));
        }
        const [checkQuery] = await db.query(`SELECT * FROM users WHERE phone_no = ?`, phone_no)
        if(checkQuery.length < 1){
            return next(new AppError(400, "user does not exist"));
        }
        // Check if the provided OTP matches the OTP stored for the phone number
        const otpQuery = `
            SELECT COUNT(*) AS otp_matched
            FROM otps
            WHERE phone_no = ?
              AND otp = ?
        `;
        const [otpResult] = await db.query(otpQuery, [phone_no, givenOTP]);

        if (otpResult[0].otp_matched === 1) {

            const token = createSendToken(res, req, phone_no);
            

            return res.status(200).json({ message: 'Login success', token });
        } else {
            return next(new AppError(401, "Invalid OTP"));
        }
    
});



module.exports = {createUserOTP,userSignUp,readUsers,updateUser,deleteUser,userOTPsender,userLogin}