const { S3 } = require("@aws-sdk/client-s3");
const { asyncChoke } = require("../Utils/asyncWrapper");

exports.uploadFile = asyncChoke(async (file) => {
  console.log(file);
  console.log("key");
  const s3 = new S3({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const buffer = file[0].buffer;
  const mimeType = file[0].mimetype;

  const extension = ".png";
  const contentType = mimeType || "image/png";
  const folder = "items";

  const uploadParams = {
    Bucket: "raybitfood",
    Key: `${folder}/image-${Date.now()}${extension}`,
    Body: buffer,
    ContentType: contentType,
  };

  try {
    await s3.putObject(uploadParams);
    const url = `https://${uploadParams.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadParams.Key}`;
    return url;
  } catch (error) {
    console.error("Error uploading file: ", error);
    throw error;
  }
});

exports.uploadDocuments = asyncChoke(async (files) => {
  const s3 = new S3({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const uploadedUrls = [];

  try {
    for (const [fieldName, file] of Object.entries(files)) {
      const buffer = file[0].buffer;
      const mimeType = file[0].mimetype;

      const extension = mimeType === "image/jpeg" ? ".jpg" : ".png";
      const contentType = mimeType || "image/png";

      const folder = "documents";
      const fileName = `${folder}/${fieldName}-${Date.now()}${extension}`;

      const uploadParams = {
        Bucket: "raybitfood",
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
      };

      await s3.putObject(uploadParams);

      const fileUrl = `https://${uploadParams.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadParams.Key}`;

      uploadedUrls.push({ [fieldName]: fileUrl });
    }

    return uploadedUrls;
  } catch (error) {
    console.error("Error uploading documents: ", error);
    throw error;
  }
});
