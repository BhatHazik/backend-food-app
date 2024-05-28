const db = require('../Config/database');
const jwt = require('jsonwebtoken')

// create or signup with otp


// create otp on number
const createUserOTP = async (req, res) => {
    const generateOTP = () => {
        return Math.floor(1000 + Math.random() * 9000);
    }

    const otp = generateOTP();
    const { phone_no } = req.body;

    if (!phone_no) {
        return res.status(400).json({ error: "Fill all fields" });
    }

    try {
        // Check if the phone number already exists in the database
        const checkQuery = `SELECT * FROM user WHERE phone_no = ?;`;
        const [checkResult, checkFields] = await db.query(checkQuery, [phone_no]);

        if (checkResult.length > 0) {
            // Phone number already exists
            return res.status(400).json({ error: 'Phone number already exists' });
        } else {
            // Phone number does not exist, proceed with inserting OTP
            const insertQuery = `INSERT INTO otps (phone_no, otp) VALUES (?, ?);`;
            const [insertResult, insertFields] = await db.query(insertQuery, [phone_no, otp]);
            
            return res.status(200).json({ phoneNO : phone_no, otp });
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};


// check otp and make entry in user
const userSignUp = async (req, res) => {
    try {
        const { givenOTP } = req.body;
        const phone_no = req.params.phNO;

        // Check if both givenOTP and phone_no are provided
        if (!givenOTP || !phone_no) {
            return res.status(400).json({ error: "Fill all fields" });
        }

        // Check if the phone number already exists in the user table
        const checkUserQuery = `SELECT COUNT(*) AS phone_exist FROM user WHERE phone_no = ?`;
        const [userResult, userFields] = await db.query(checkUserQuery, [phone_no]);

        if (userResult[0].phone_exist > 0) {
            return res.json({ message: "User already exists" });
        }

        // Check if the provided OTP matches the OTP stored for the phone number
        const checkOTPQuery = `
            SELECT COUNT(*) AS otp_matched
            FROM otps
            WHERE phone_no = ?
            AND otp = ?
        `;
        const [otpResult, otpFields] = await db.query(checkOTPQuery, [phone_no, givenOTP]);

        if (otpResult[0].otp_matched === 0) {
            return res.status(401).json({ message: 'Invalid OTP' });
        }

        // Insert the user into the user table
        const insertUserQuery = `INSERT INTO user (phone_no) VALUES (?)`;
        await db.query(insertUserQuery, [phone_no]);

        return res.status(200).json({ message: "Account created" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};




// read


const readUsers = async (req, res) => {
    try {
        const query = `SELECT * FROM user`;
        const [result, fields] = await db.query(query);
        res.status(200).json({ result });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error while fetching users' });
    }
};

// update


const updateUser = async (req, res) => {
    try {
        const { newUsername, oldUsername, phone_no } = req.body;

        // Check if all required fields are provided
        if (!newUsername || !oldUsername || !phone_no) {
            return res.status(400).json({ error: "Fill all fields" });
        }

        // Proceed with the update if all fields are provided
        const query = `UPDATE user SET username = ?, phone_no = ? WHERE username = ? AND phone_no = ?`;
        const [result, fields] = await db.query(query, [newUsername, phone_no, oldUsername, phone_no]);
        
        return res.status(200).json({ result });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};


// delete


const deleteUser = async (req, res) => {
    try {
        const { username } = req.body;

        // Check if username is provided
        if (!username) {
            return res.status(400).json({ error: "Fill all fields" });
        }

        // Proceed with deletion if username is provided
        const query = `DELETE FROM user WHERE username = ?`;
        const [result, fields] = await db.query(query, [username]);

        return res.status(200).json({ result });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};



// OTPSENDER
const userOTPsender = async (req, res) => {
    try {
        const generateOTP = () => {
            return Math.floor(1000 + Math.random() * 9000);
        };

        const otp = generateOTP();
        const { phone_no } = req.body;
        // Check if phone_no is provided
        if (!phone_no) {
            return res.status(400).json({ error: "Fill all fields" });
        }

        // Update OTP in the database for the provided phone number
        const query = `UPDATE otps SET otp = ? WHERE phone_no = ?`;
        const [result, fields] = await db.query(query, [otp, phone_no]);
        return res.status(200).json({ message: 'OTP sent successfully', result, otp });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};


const createSendToken = (res, req, phone_no) => {
    const tokenOptions = { expiresIn: process.env.JWT_EXPIRY };
    const token = jwt.sign(
      { data: phone_no },
      process.env.JWT_SECRET,
      tokenOptions
    );
    return token;
}

// OTP CHECKER (LOGIN)
const userLogin = async (req, res) => {
    try {
        const { givenOTP } = req.body;
        const phone_no = req.params.phNO;

        // Check if givenOTP is provided
        if (!givenOTP) {
            return res.status(400).json({ message: 'OTP cannot be empty' });
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
            return res.status(401).json({ message: 'Invalid OTP' });
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};



module.exports = {createUserOTP,userSignUp,readUsers,updateUser,deleteUser,userOTPsender,userLogin}