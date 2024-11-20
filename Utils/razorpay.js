const Razorpay = require('razorpay');
const { asyncChoke } = require("./asyncWrapper");
const AppError = require("./error");

exports.initaiteWalletRefill = asyncChoke(async (req, res, next) => {
  const { amount } = req.body;

  if (!amount) return next(new AppError(401, "Provide the amount"));
console.log(process.env.RAZORPAY_KEY_ID, process.env.RAZORPAY_KEY_SECRET)
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const options = {
    amount: amount,
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
    notes: { purpose: "Wallet Refill" },
  };
  
  const order = await razorpay.orders.create(options);
  console.log(order)
  res.status(200).json({
    success: true,
    message: "Order initiated successfully!",
    order,
  });
});
