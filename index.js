const express = require('express');
const menuRouter = require('./Routes/menuRouter');
const restaurantRouter = require('./Routes/restaurantRouter'); 
const userRoute = require('./Routes/userRouter')
const path = require("path");
const bodyParser = require('body-parser');
const itemsRouter = require('./Routes/itemsRouter')
const app = express();

app.use(bodyParser.json());




// Routes
app.use('/api/menu', menuRouter);
app.use('/api/restaurant', restaurantRouter); 
app.use('/api/user', userRoute);
app.use('/api/items', itemsRouter);


// Error handling middleware
// app.use(errorHandler);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
