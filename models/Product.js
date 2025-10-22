const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: Number,
  name: String,
  price: Number,
  originalPrice: Number,
  discount: String,
  image: String,
  rating: Number,
  reviews: Number,
  category: String,
  points: Number,
  description:String,
  
});

module.exports = mongoose.model('Product', productSchema);
