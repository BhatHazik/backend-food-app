const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");

require("./Config/database");
const { sendErrorRes } = require("./Controllers/errorController");
const { initWebSocket } = require("./Utils/socketHandler");

const menuRouter = require("./Routes/menuRouter");
const restaurantRouter = require("./Routes/restaurantRouter");
const userRoute = require("./Routes/userRouter");
const itemsRouter = require("./Routes/itemsRouter");
const adminRouter = require("./Routes/adminRouter");
const categoryRouter = require("./Routes/categoryRouter");
const offerRouter = require("./Routes/offerRouter");
const deliveryBoyRouter = require("./Routes/deiveryBoyRouter");
const cartRouter = require("./Routes/cartRouter");
const userBillRouter = require("./Routes/userBillRouter");
const ordersRouter = require("./Routes/ordersRouter");

const app = express();

const server = http.createServer(app);
initWebSocket(server);

const allowedOrigins = ["*", "http://localhost:5173", "http://localhost:8081"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.use("/api/menu", menuRouter);
app.use("/api/restaurant", restaurantRouter);
app.use("/api/user", userRoute);
app.use("/api/items", itemsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/category", categoryRouter);
app.use("/api/offers", offerRouter);
app.use("/api/deliveryBoy", deliveryBoyRouter);
app.use("/api/cart", cartRouter);
app.use("/api/bill", userBillRouter);
app.use("/api/orders", ordersRouter);

app.use(sendErrorRes);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
