const socketIo = require("socket.io");
const { socketAuth } = require("./socketAuth");
const AppError = require("./error");

let io;

function initWebSocket(server) {
  io = socketIo(server, {
    cors: {
      origin: '*',
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
    socket.on('restaurantConnect', (restaurantId) => {
      handleRestaurantConnect(socket, restaurantId);
    });

    // Handle user connection
    socket.on('userConnect', (userId) => {
      handleUserConnect(socket, userId);
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
function handleUserConnect(socket, userId) {
  io.connectedUsers[userId] = socket.id;  // Store user's socket ID
  console.log(`User ${userId} connected with socket ID: ${socket.id}`);
}

// Handle restaurant connection
function handleRestaurantConnect(socket, restaurantId) {
  io.connectedRestaurants[restaurantId] = socket.id;  // Store restaurant's socket ID
  
  console.log(`Restaurant ${restaurantId} connected with socket ID: ${socket.id}`);
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
function handleUpdateDeliveryBoyLocation({ deliveryBoyId, location }) {
  if (io.connectedDeliveryBoys[deliveryBoyId]) {
    // Update the delivery boy's location
    io.connectedDeliveryBoys[deliveryBoyId].location = location;
    console.log(`Delivery Boy ${deliveryBoyId} location updated to: ${location}`);
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
