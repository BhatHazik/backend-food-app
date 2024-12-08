// Load environment variables
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });

// Import required dependencies
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Import custom modules
require('./Config/database');  // Database connection
const { sendErrorRes } = require('./Controllers/errorController');  // Error handling middleware
const { initWebSocket } = require("./Utils/socketHandler");


// Import routes
const menuRouter = require('./Routes/menuRouter');
const restaurantRouter = require('./Routes/restaurantRouter');
const userRoute = require('./Routes/userRouter');
const itemsRouter = require('./Routes/itemsRouter');
const adminRouter = require('./Routes/adminRouter');
const categoryRouter = require('./Routes/categoryRouter');
const offerRouter = require('./Routes/offerRouter');
const deliveryBoyRouter = require('./Routes/deiveryBoyRouter');
const cartRouter = require('./Routes/cartRouter');
const userBillRouter = require('./Routes/userBillRouter');
const ordersRouter = require('./Routes/ordersRouter');

// Initialize Express app
const app = express();

// Create HTTP server and attach to Express app
const server = http.createServer(app);
initWebSocket(server);
// Initialize Socket.IO with the server
// const io = socketIo(server, {
//   cors: {
//     origin: "*",  // You can restrict to specific origins as needed
//     methods: ["GET", "POST"]
//   }
// });

// // WebSocket handling
// io.on('connection', (socket) => {
//   console.log('A user connected:', socket.id);

//   // Listen for messages from the client
//   socket.on('message', (data) => {
//     console.log('Received message from client:', data);
//     // Send a message back to the client
//     socket.emit('message', 'Hello from the server!');
//   });

//   // Handle user disconnection
//   socket.on('disconnect', () => {
//     console.log('A user disconnected:', socket.id);
//   });
// });

// Define allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',  // React web application
  'http://localhost:8081',  // React Native application
];

// Enable CORS for specific origins
app.use(cors({
  origin: allowedOrigins,
  credentials: true,  // Allows cookies to be sent with cross-origin requests
}));

// Parse incoming request bodies (for JSON and URL-encoded data)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (if needed, e.g., for front-end assets)
app.use(express.static(path.join(__dirname, 'public')));

// Define API routes
app.use('/api/menu', menuRouter);
app.use('/api/restaurant', restaurantRouter);
app.use('/api/user', userRoute);
app.use('/api/items', itemsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/category', categoryRouter);
app.use('/api/offers', offerRouter);
app.use('/api/deliveryBoy', deliveryBoyRouter);
app.use('/api/cart', cartRouter);
app.use('/api/bill', userBillRouter);
app.use('/api/orders', ordersRouter);

// Error handling middleware
app.use(sendErrorRes);

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
