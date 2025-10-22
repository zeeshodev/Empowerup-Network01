const Product = require('../models/Product');

// 📥 Add All Static Products to DB
exports.seedProducts = async (req, res) => {
  try {
     const products = [
    {
      id: 1,
      name: "Charcol Face Wash",
      price:1550,
      originalPrice: "",
      discount: "23% OFF",
      image: "../src/Assets/1-Photoroom.png",
      rating: 4.8,
      reviews: 124,
      category: "Skincare",
      points :1.5 
    },
    {
      id: 2,
      name: "Brightening Clay Mask",
      price: 500,
      originalPrice: "",
      discount: "25% OFF",
      image: "../src/Assets/2-Photoroom.png",
      rating: 4.9,
      reviews: 89,
      category: "Masks",
      points: 0.5
    },
    {
      id: 3,
      name: "Lightening Face Scrub",
      price: 1050,
      originalPrice: "$49.99",
      discount: "30% OFF",
      image: "../src/Assets/3-Photoroom.png",
      rating: 4.7,
      reviews: 67,
    points:1
    },
    {
      id: 4,
      name: "24K Gold Face Scrub",
      price: 1450,
      originalPrice: "$69.99",
      discount: "24% OFF",
      image: "../src/Assets/4-Photoroom.png",
      rating: 4.8,
      reviews: 156,
      category: "Anti-Aging",
       points: 1.5
    },
    {
      id: 5,
      name: "Bright Beauty Face Wash",
      price: 1400,
      originalPrice: "$32.99",
      discount: "24% OFF",
      image: "../src/Assets/5-Photoroom.png",
      rating: 4.6,
      reviews: 203,
      category: "Cleansers",
       points: 1.5
    },
    {
      id: 6,
      name: "Whitening Delight Soap",
      price: 3500,
      originalPrice: "$24.99",
      discount: "24% OFF",
      image: "../src/Assets/7-Photoroom.png",  
      rating: 4.9,
      reviews: 98,
      category: "Lips",
       points: 3
    },
    {
      id: 7,
      name: "Refreshing Scrub Soap",
      price: 1050,
      originalPrice: "$24.99",
      discount: "24% OFF",
      image: "../src/Assets/8-Photoroom.png",  
      rating: 4.9,
      reviews: 98,
      category: "Lips",
       points: 1
    },
    {
      id: 8,
      name: "Shine & Strong Shampoo",
      price: 1750,
      originalPrice: "$24.99",
      discount: "24% OFF",
      image: "../src/Assets/product-shampoo-Photoroom.png",  
      rating: 4.9,
      reviews: 98,
      category: "Lips",
       points:1.5 
    }
  ];
    await Product.deleteMany(); // Clear old
    await Product.insertMany(products);
    res.status(201).json({ message: 'Products seeded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to seed products' });
  }
};

// 📤 Get All Products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

// 📄 Get Product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};
