const Product = require('../models/Product');
const UserInvestment = require('../models/UserInvestment');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess, sendError, paginate } = require('../utils/helpers');

// @desc    Get all active products
// @route   GET /api/products
// @access  Private
const getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ isActive: true }).sort({ sortOrder: 1, amount: 1 });
  return sendSuccess(res, { products });
});

// @desc    Buy/invest in a product
// @route   POST /api/invest/:productId
// @access  Private
const buyProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return sendError(res, 'Product not found or unavailable');
  }

  if (product.availableUnits <= 0) {
    return sendError(res, 'This product is sold out');
  }

  // Check how many times user already bought this product
  const existingCount = await UserInvestment.countDocuments({
    user: userId,
    product: productId,
    status: 'in_progress',
  });

  if (existingCount >= product.maxUnits) {
    return sendError(res, `You can only purchase ${product.maxUnits} unit(s) of this product`);
  }

  // Check balance (free product is $0)
  const user = await User.findById(userId);
  if (product.amount > 0 && user.balance < product.amount) {
    return sendError(res, 'Insufficient balance. Please recharge your account.');
  }

  // Calculate expiration date
  const startDate = new Date();
  const expirationDate = new Date(startDate);
  expirationDate.setDate(expirationDate.getDate() + product.cycleDays);

  // Deduct balance (if paid product)
  const balanceBefore = user.balance;
  if (product.amount > 0) {
    user.balance -= product.amount;
    await user.save({ validateBeforeSave: false });
  }

  // Create investment record
  const investment = await UserInvestment.create({
    user: userId,
    product: productId,
    productSnapshot: {
      name: product.name,
      amount: product.amount,
      cycleDays: product.cycleDays,
      dailyIncome: product.dailyIncome,
    },
    investmentAmount: product.amount,
    dailyIncome: product.dailyIncome,
    startDate,
    expirationDate,
  });

  // Reduce available units
  if (!product.isFree) {
    product.availableUnits -= 1;
    await product.save();
  }

  // Record transaction (out)
  if (product.amount > 0) {
    await Transaction.create({
      user: userId,
      type: 'out',
      category: 'investment',
      amountUSD: product.amount,
      balanceBefore,
      balanceAfter: user.balance,
      description: `Invested in ${product.name}`,
      refModel: 'UserInvestment',
      refId: investment._id,
    });
  }

  return sendSuccess(res, { investment }, 'Investment successful', 201);
});

// @desc    Get user's investments
// @route   GET /api/invest/my
// @access  Private
const getMyInvestments = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);

  const [investments, total] = await Promise.all([
    UserInvestment.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .populate('product', 'name image'),
    UserInvestment.countDocuments({ user: req.user._id }),
  ]);

  return sendSuccess(res, {
    investments,
    pagination: { total, page: pg, limit: lim, pages: Math.ceil(total / lim) },
  });
});

module.exports = { getProducts, buyProduct, getMyInvestments };
