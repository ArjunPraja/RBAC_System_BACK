
const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  userUuid: { type: String, required: true },
  imageData: { type: Buffer, required: true },
  contentType: { type: String, required: true },
});

const Image = mongoose.model('Image', imageSchema);

module.exports = Image;
