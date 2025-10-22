const express = require('express');
const router = express.Router();
const {
  seedProducts,
  getAllProducts,
  getProductById,
} = require('../controllers/productController');

router.post('/seed', seedProducts);
router.get('/', getAllProducts);
router.get('/:id', getProductById);

module.exports = router;
