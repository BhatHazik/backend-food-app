const dotenv = require('dotenv');
dotenv.config({path: "./config.env"});
const express = require('express');
const menuRouter = require('./Routes/menuRouter');
const restaurantRouter = require('./Routes/restaurantRouter'); 
const userRoute = require('./Routes/userRouter')
const path = require("path");
require('./Config/database')
const bodyParser = require('body-parser');
const itemsRouter = require('./Routes/itemsRouter');
const adminRouter = require('./Routes/adminRouter');
const categoryRouter = require('./Routes/categoryRouter');
const offerRouter = require('./Routes/offerRouter');
const deliveryBoyRouter = require('./Routes/deiveryBoyRouter');
const cartRouter = require('./Routes/cartRouter');
const app = express();

app.use(bodyParser.json());




// Routes
app.use('/api/menu', menuRouter);
app.use('/api/restaurant', restaurantRouter); 
app.use('/api/user', userRoute);
app.use('/api/items', itemsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/category', categoryRouter);
app.use('/api/offers', offerRouter);
app.use('/api/deliveryBoy', deliveryBoyRouter);
app.use('/api/cart', cartRouter);
// Error handling middleware
// app.use(errorHandler);

// console.log(process.env)
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
