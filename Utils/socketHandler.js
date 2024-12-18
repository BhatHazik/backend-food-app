const socketIo = require("socket.io");
const { socketAuth } = require("./socketAuth");
const AppError = require("./error");
const { pool } = require("../Config/database");

let io;

const allowedOrigins = [
  'http://192.168.100.42:8081',
  'http://localhost:8081',
  'http://192.168.100.43:5173', 
  'http://localhost:5173',
];

function initWebSocket(server) {
  io = socketIo(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Initialize connected entities
  io.connectedUsers = {}; // Stores connected users
  io.connectedRestaurants = {}; // Stores connected restaurants
  io.connectedDeliveryBoys = {}; // Stores connected delivery boys

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      await socketAuth(socket, next); // Call socket authentication
    } catch (err) {
      return next(new AppError(400, 'Authentication failed'));
    }
  });

  // When a new socket connection occurs
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle restaurant connection
    socket.on('restaurantConnect', () => {
      handleRestaurantConnect(socket);
    });

    // Handle user connection
    socket.on('userConnect', () => {
      handleUserConnect(socket);
    });

    // Handle delivery boy connection
    socket.on('deliveryBoyConnect', (data) => {
      handleDeliveryBoyConnect(socket, data);
    });

    // Handle delivery boy location update
    socket.on('updateDeliveryBoyLocation', (data) => {
      handleUpdateDeliveryBoyLocation(data);
    });
    
    // Handle disconnections
    socket.on('disconnect', () => {
      handleDisconnect(socket);
    });
  });
}

// Handle user connection
function handleUserConnect(socket) {
  io.connectedUsers[socket.user.id] = socket.id;  // Store user's socket ID
  console.log(`User ${socket.user.id} connected with socket ID: ${socket.id}`);
}

// Handle restaurant connection
function handleRestaurantConnect(socket) {
  io.connectedRestaurants[socket.user.id] = socket.id;  // Store restaurant's socket ID
  
  console.log(`Restaurant ${socket.user.id} connected with socket ID: ${socket.id}`);
}

// Handle delivery boy connection
function handleDeliveryBoyConnect(socket, data) {
  // Destructure data to extract deliveryBoyId, location, and status
  const { deliveryBoyId, location, status} = data; 

  console.log(data, deliveryBoyId); // This will now correctly print the entire data object

  // Now you can use deliveryBoyId, location, and status correctly
  io.connectedDeliveryBoys[deliveryBoyId] = {
    socketId: socket.id,
    location,
    status,  // Set initial status to 'online' or passed status
  };

  console.log(`Delivery Boy ${deliveryBoyId} connected with socket ID: ${socket.id} and status: ${status}`);
}


// Handle delivery boy location update
async function handleUpdateDeliveryBoyLocation({ deliveryBoyId, location, order_id }) {
  if (io.connectedDeliveryBoys[deliveryBoyId]) {
    // Update the delivery boy's location
    io.connectedDeliveryBoys[deliveryBoyId].location = location;

    // Fetch order details to get user and restaurant information
    const [order] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [order_id]);

    if (!order || order.length === 0) {
      throw new Error(`Order with id ${order_id} not found`);
    }

    if (order[0].del_id !== deliveryBoyId) {
      throw new Error(`This order does not belong to delivery boy with id ${deliveryBoyId}`);
    }

    const userId = order[0].user_id; // Get user ID from the order
    const restaurantId = order[0].restaurant_id; // Get restaurant ID from the order

    // Notify the user
    if (io.connectedUsers && io.connectedUsers[userId]) {
      io.to(io.connectedUsers[userId]).emit('deliveryBoyLocationUpdate', {
        deliveryBoyId,
        location,
      });
    } else {
      console.log(`User with ID ${userId} is not connected.`);
    }

    // Notify the restaurant
    if (io.connectedRestaurants && io.connectedRestaurants[restaurantId]) {
      io.to(io.connectedRestaurants[restaurantId]).emit('deliveryBoyLocationUpdate', {
        deliveryBoyId,
        location,
      });
    } else {
      console.log(`Restaurant with ID ${restaurantId} is not connected.`);
    }

    console.log(`Delivery Boy ${deliveryBoyId} location updated to:`, location);
  } else {
    console.log(`Delivery Boy ${deliveryBoyId} is not connected.`);
  }
}




// Handle disconnections
function handleDisconnect(socket) {
  console.log('A user disconnected:', socket.id);

  // Remove the disconnected user
  for (const userId in io.connectedUsers) {
    if (io.connectedUsers[userId] === socket.id) {
      delete io.connectedUsers[userId];
      console.log(`User ${userId} disconnected`);
      break;
    }
  }

  // Remove the disconnected restaurant
  for (const restaurantId in io.connectedRestaurants) {
    if (io.connectedRestaurants[restaurantId] === socket.id) {
      delete io.connectedRestaurants[restaurantId];
      console.log(`Restaurant ${restaurantId} disconnected`);
      break;
    }
  }

  // Remove the disconnected delivery boy
  for (const deliveryBoyId in io.connectedDeliveryBoys) {
    if (io.connectedDeliveryBoys[deliveryBoyId].socketId === socket.id) {
      delete io.connectedDeliveryBoys[deliveryBoyId];
      console.log(`Delivery Boy ${deliveryBoyId} disconnected`);
      break;
    }
  }
}

function getSocketIoServer() {
  return io;
}

module.exports = { initWebSocket, getSocketIoServer };
