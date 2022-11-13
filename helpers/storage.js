const multer = require("multer");

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    //  console.log("req in storage", req, "file in storage", file);
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    // console.log("req in storage", req, "file in storage", file);
    const mimeType = file.mimetype.split("/");
    const fileType = mimeType[1];
    const fileName = file.originalname;
    cb(null, fileName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/png", "image/jpeg", "image/jpg"];
  allowedMimeTypes.includes(file.mimetype) ? cb(null, true) : cb(null, false);
};

const storage = multer({ storage: diskStorage, fileFilter: fileFilter }).array(
  "image"
);

module.exports = storage;
