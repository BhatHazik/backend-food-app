const { S3 } = require("@aws-sdk/client-s3");
const multer = require("multer");
const { asyncChoke } = require("../Utils/asyncWrapper"); // Assuming you have a custom async wrapper

// Multer memory storage for storing files in memory temporarily
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize S3 Client
const s3 = new S3({
  region: "ap-south-1", // Use your region, e.g. ap-south-1 for Mumbai
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY, // Add your AWS access key here
    secretAccessKey: process.env.S3_SECRET, // Add your AWS secret here
  },
});

// Upload file to S3 bucket
exports.uploadFile = asyncChoke(async (file) => {
  const buffer = file.buffer; // The file is in memory as a buffer
  const mimeType = file.mimetype;

  let fileType = "image";
  let extension = ".png";
  let contentType = "image/png";
  let folder = "images"; // Default folder for images

  const uploadParams = {
    Bucket: process.env.S3_BUCKET_NAME, // Your S3 bucket name
    Key: `${folder}/${fileType}-${Date.now()}${extension}`, // Unique file name
    Body: buffer, // File buffer
    ContentType: contentType, // File content type (MIME type)
  };

  try {
    // Upload to S3
    await s3.putObject(uploadParams);
    const fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadParams.Key}`;
    return fileUrl;
  } catch (error) {
    console.error("Error uploading file to S3: ", error);
    throw error;
  }
});

// Get file from S3
exports.getFile = asyncChoke(async (fileKey) => {
  const downloadParams = {
    Bucket: process.env.S3_BUCKET_NAME, // Your S3 bucket name
    Key: fileKey, // The key for the file in the bucket
  };

  try {
    // Fetch the file metadata from S3
    const data = await s3.getObject(downloadParams);
    return data.Body; // Returning file content (Buffer)
  } catch (error) {
    console.error("Error getting file from S3: ", error);
    throw error;
  }
});

// Delete file from S3
exports.deleteFile = asyncChoke(async (fileKey) => {
  const deleteParams = {
    Bucket: process.env.S3_BUCKET_NAME, // Your S3 bucket name
    Key: fileKey, // The key for the file in the bucket
  };

  try {
    // Delete the file from S3
    await s3.deleteObject(deleteParams);
    return { message: "File deleted successfully" };
  } catch (error) {
    console.error("Error deleting file from S3: ", error);
    throw error;
  }
});

// Update file on S3 (Delete old and upload new)
exports.updateFile = asyncChoke(async (oldFileKey, newFile) => {
  // First, delete the old file
  await exports.deleteFile(oldFileKey);

  // Then upload the new file
  const fileUrl = await exports.uploadFile(newFile);
  return fileUrl; // Return new file URL after upload
});

// Middleware for file upload handling via Multer
exports.upload = upload.single("file"); // Use this middleware for routes that handle file uploads (e.g. 'file' is the field name in form)

// Helper function to handle asynchronous control flow for custom errors
exports.asyncChoke = asyncChoke;
