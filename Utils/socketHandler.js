const socketIo = require("socket.io");
const { socketAuth } = require("./socketAuth");
const AppError = require("./error");
const { pool } = require("../Config/database");

let io;

const allowedOrigins = [
  "*",
  "http://192.168.100.42:8081",
  "http://localhost:8081",
  "http://localhost:8085",
  "http://192.168.100.43:5173",
  "http://localhost:5173",
];

function initWebSocket(server) {
  io = socketIo(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.connectedUsers = {};
  io.connectedRestaurants = {};
  io.connectedDeliveryBoys = {};

  io.use(async (socket, next) => {
    try {
      await socketAuth(socket, next);
    } catch (err) {
      return next(new AppError(400, "Authentication failed"));
    }
  });
  
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.once("restaurantConnect", () => handleRestaurantConnect(socket));
    socket.once("userConnect", () => handleUserConnect(socket));
    socket.once("deliveryBoyConnect", (data) =>
      handleDeliveryBoyConnect(socket, data)
    );
    socket.on("updateDeliveryBoyLocation", (data) =>
      handleUpdateDeliveryBoyLocation(socket, data)
    );

    socket.on("disconnect", () => handleDisconnect(socket));
  });
}

function handleUserConnect(socket) {
  io.connectedUsers[socket.user.id] = socket.id;
  console.log(`User ${socket.user.id} connected with socket ID: ${socket.id}`);
}

function handleRestaurantConnect(socket) {
  io.connectedRestaurants[socket.user.id] = socket.id;
  console.log(
    `Restaurant ${socket.user.id} connected with socket ID: ${socket.id}`
  );
}

function handleDeliveryBoyConnect(socket, data) {
  const { location, status } = data;
  io.connectedDeliveryBoys[socket.user.id] = {
    socketId: socket.id,
    location,
    status,
  };
  console.log(
    `Delivery Boy ${socket.user.id} connected with socket ID: ${socket.id} and status: ${status}`
  );
}

async function handleUpdateDeliveryBoyLocation(socket, { location, order_id }) {
  const deliveryBoyId = socket.user.id;
  if (io.connectedDeliveryBoys[deliveryBoyId]) {
    io.connectedDeliveryBoys[deliveryBoyId].location = location;

    console.log(deliveryBoyId,location, order_id);
    try {
      const [order] = await pool.query("SELECT * FROM orders WHERE id = ?", [
        order_id,
      ]);
      if (!order || order.length === 0 || order[0].del_id !== deliveryBoyId) {
        throw new Error(`Invalid order or delivery boy mismatch.`);
      }

      const { user_id: userId, restaurant_id: restaurantId } = order[0];
      notifyUsersAndRestaurants(userId, restaurantId, deliveryBoyId, location);
      console.log(`Delivery Boy ${deliveryBoyId} location updated`);
    } catch (err) {
      console.error(`Error updating delivery boy location: ${err.message}`);
    }
  } else {
    console.log(`Delivery Boy ${deliveryBoyId} is not connected.`);
  }
}

function notifyUsersAndRestaurants(
  userId,
  restaurantId,
  deliveryBoyId,
  location
) {
  console.log(restaurantId);
  if (io.connectedUsers[userId]) {
    io.to(io.connectedUsers[userId]).emit("deliveryBoyLocationUpdate", {
      deliveryBoyId,
      location,
    });
  } else {
    console.log(`User with ID ${userId} is not connected.`);
  }

  if (io.connectedRestaurants[restaurantId]) {
    io.to(io.connectedRestaurants[restaurantId]).emit(
      "deliveryBoyLocationUpdate",
      { deliveryBoyId, location }
    );
  } else {
    console.log(`Restaurant with ID ${restaurantId} is not connected.`);
  }
}

function handleDisconnect(socket) {
  console.log("A user disconnected:", socket.id);

  removeEntityFromConnectedList(io.connectedUsers, socket);
  removeEntityFromConnectedList(io.connectedRestaurants, socket);
  removeEntityFromConnectedList(io.connectedDeliveryBoys, socket);
}

function removeEntityFromConnectedList(connectedList, socket) {
  for (const entityId in connectedList) {
    if (
      connectedList[entityId] === socket.id ||
      connectedList[entityId].socketId === socket.id
    ) {
      delete connectedList[entityId];
      console.log(`${entityId} disconnected`);
      break;
    }
  }
}

function getSocketIoServer() {
  return io;
}

module.exports = { initWebSocket, getSocketIoServer };
