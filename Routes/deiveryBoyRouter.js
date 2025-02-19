const express = require("express");
const {
  getDocumentStatus,
  deliveryBoyOTPsender,
  deliveryBoyLogin,
  createDeleveryBoy,
  getAllApprovedDeliveryBoys,
  getApprovedDeliveryBoyById,
  updateApprovedDeliveryBoy,
  deleteApprovedDeliveryBoy,
  deliveryOTPsender,
  deliveryLogin,
  updateDeliveryPersonal,
  updateDeliveryDocs,
  updateWorkType,
  updateDeliveryVehicle,
  updateDeliveryBank,
  sendApprovalRequest,
  acceptOrder,
  confirmOrder,
  arrivedOrder,
  deliverOrder,
  updateAdharDocs,
  updatePanDocs,
  updateDlDocs,
  getPersonalDocsStatus,
  getEarningsAndDutyTime,
} = require("../Controllers/deliveryBoyController");
const { protect } = require("../Controllers/deliveryAuth");
const upload = require("multer")();
const router = express.Router();

router.get("/getDocsStatus", protect, getDocumentStatus);
router.get("/getPersonalDocsStatus", protect, getPersonalDocsStatus);
router.get("/getEarnings", protect, getEarningsAndDutyTime);
router.post("/deliverySendOtp", deliveryOTPsender);
router.post("/deliveryLogin/:phNO", deliveryLogin);

router.patch(
  "/infoUpdate",
  protect,
  upload.fields([{ name: "profile_pic", maxCount: 1 }]),
  updateDeliveryPersonal
);

router.patch("/docsUpdate", protect, updateDeliveryDocs);
router.patch(
  "/adharUpdate",
  protect,
  upload.fields([
    { name: "adhar_front", maxCount: 1 },
    { name: "adhar_back", maxCount: 1 },
  ]),
  updateAdharDocs
);
router.patch(
  "/panUpdate",
  protect,
  upload.fields([
    { name: "pan_front", maxCount: 1 },
    { name: "pan_back", maxCount: 1 },
  ]),
  updatePanDocs
);
router.patch(
  "/dlUpdate",
  protect,
  upload.fields([
    { name: "dl_front", maxCount: 1 },
    { name: "dl_back", maxCount: 1 },
  ]),
  updateDlDocs
);

router.patch("/workUpdate", protect, updateWorkType);
router.patch(
  "/vehicleUpdate",
  protect,
  upload.fields([{ name: "vehicle_image", maxCount: 1 }]),
  updateDeliveryVehicle
);
router.patch("/bankUpdate", protect, updateDeliveryBank);
router.patch("/sendForApproval", protect, sendApprovalRequest);
router.patch("/acceptOrder", protect, acceptOrder);
router.patch("/confirmOrder", protect, confirmOrder);
router.patch("/arrivedOrder", protect, arrivedOrder);
router.patch("/deliverOrder", protect, deliverOrder);

module.exports = router;
