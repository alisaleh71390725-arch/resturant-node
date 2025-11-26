const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { sql, config } = require('../db/sqlConfig');
const compressToUnder100KB = async (inputPath, outputPath) => {
  let quality = 80;
  let width = null;

  let buffer = await sharp(inputPath)
    .jpeg({ quality })
    .toBuffer();

  // Step 1: Lower quality
  while (buffer.length > 100 * 1024 && quality > 30) {
    quality -= 10;
    buffer = await sharp(inputPath)
      .jpeg({ quality })
      .toBuffer();
  }

  // Step 2: Reduce width if still >100kb
  width = 1200;
  while (buffer.length > 100 * 1024 && width > 400) {
    width -= 200;
    buffer = await sharp(inputPath)
      .resize({ width })
      .jpeg({ quality })
      .toBuffer();
  }

  // Save final image
  await sharp(buffer).toFile(outputPath);

  return buffer.length; // return bytes
};
const getAllItems = async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT 
        i.*, 
        c.categoryName
      FROM items i
      LEFT JOIN category c ON i.categoryId = c.categoryId
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAllItemsById = async (req, res) => {
  const { userId } = req.params;
  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT 
        i.*, 
        c.categoryName
      FROM items i
      LEFT JOIN category c ON i.categoryId = c.categoryId
      WHERE i.userId = ${userId}
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCategories = async (req, res) => {
  const { userId } = req.params;
  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT * FROM category WHERE userId = ${userId}
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addItem = async (req, res) => {
  const { itemName, itemDesc, itemPrice, categoryId, userId } = req.body;

  let item_picture = '';
  let finalImageSizeKB = null;
  let originalImageSizeKB = null;

  try {
    await sql.connect(config);

    const request = new sql.Request();
request.input('userId', sql.Int, userId);
request.input('itemName', sql.NVarChar, itemName);

const existing = await request.query(`
  SELECT * FROM items
  WHERE userId = @userId AND itemName = @itemName
`);


    if (existing.recordset.length > 0) {
      return res.status(400).json({ error: 'Item name already exists' });
    }

    // --------------------------
    // Image Handling
    // --------------------------
    if (req.file) {
      const originalPath = req.file.path;

      // Read original file size
      const originalStats = fs.statSync(originalPath);
      originalImageSizeKB = (originalStats.size / 1024).toFixed(2);

      const filename = `compressed-${Date.now()}.jpg`;
      const userFolder = `user_${userId}`;
      const outputDir = path.join('/mnt/uploads', userFolder);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputPath = path.join(outputDir, filename);

      let finalBytes;

      // 🔥 If original image is already smaller than 100 KB → DO NOT COMPRESS
      if (originalStats.size < 100 * 1024) {
        fs.copyFileSync(originalPath, outputPath);
        finalBytes = originalStats.size;
      } else {
        // 🔥 Compress only if larger than 100 KB
        finalBytes = await compressToUnder100KB(originalPath, outputPath);
      }

      // Remove original file
      fs.unlinkSync(originalPath);

      item_picture = path.join(userFolder, filename);
      finalImageSizeKB = (finalBytes / 1024).toFixed(2);
    }

    await sql.query`
  INSERT INTO items (itemName, itemDesc, itemPrice, categoryId, userId, item_picture)
  VALUES (${itemName}, ${itemDesc}, ${itemPrice}, ${categoryId}, ${userId}, ${item_picture})
`;

    res.status(201).json({
      message: 'Item created successfully',
      originalSizeKB: originalImageSizeKB ? `${originalImageSizeKB} KB` : null,
      imageSizeKB: finalImageSizeKB ? `${finalImageSizeKB} KB` : null,
      imagePath: item_picture
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


const updateItem = async (req, res) => {
  const { itemId } = req.params;
  const { itemName, itemDesc, itemPrice, categoryId, userId } = req.body;

  let item_picture = req.body.item_picture || '';
  let finalImageSizeKB = null;
  let originalImageSizeKB = null;

  try {
    await sql.connect(config);
   const checkRequest = new sql.Request();
checkRequest.input('userId', sql.Int, userId);
checkRequest.input('itemName', sql.NVarChar, itemName);
checkRequest.input('itemId', sql.Int, itemId);

const duplicateCheck = await checkRequest.query(`
  SELECT * FROM items 
  WHERE userId = @userId AND itemName = @itemName AND itemId != @itemId
`);


    if (duplicateCheck.recordset.length > 0) {
      return res.status(400).json({ error: 'Item name alrady exists!' });
    }
    // Get existing item and its image path
    const existingItemResult = await sql.query(`SELECT item_picture FROM items WHERE itemId = ${itemId}`);
    const existingItem = existingItemResult.recordset[0];

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

   let oldImagePath = existingItem.item_picture
      ? path.join('/mnt/uploads', existingItem.item_picture)
      : null;

    if (req.file) {
      const originalPath = req.file.path;
      const originalStats = fs.statSync(originalPath);
      originalImageSizeKB = (originalStats.size / 1024).toFixed(2);
      const filename = `compressed-${Date.now()}.jpg`;
      const userFolder = `user_${userId}`;
      const outputDir = path.join('/mnt/uploads', userFolder);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputPath = path.join(outputDir, filename);
       let finalBytes;

      if (originalStats.size < 100 * 1024) {
        // Copy small images as-is (just change extension)
        await sharp(originalPath).jpeg().toFile(outputPath);
        finalBytes = fs.statSync(outputPath).size;
      } else {
        // Compress large images
        finalBytes = await compressToUnder100KB(originalPath, outputPath);
      }

      fs.unlinkSync(originalPath); // remove original
      item_picture = path.join(userFolder, filename);
      finalImageSizeKB = (finalBytes / 1024).toFixed(2);
     

      // Delete old image file
      if (oldImagePath && fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    } else {
      // No new file uploaded, keep old image path
      item_picture = existingItem.item_picture;
    }

const updateRequest = new sql.Request();
updateRequest.input('itemName', sql.NVarChar, itemName);
updateRequest.input('itemDesc', sql.NVarChar, itemDesc);
updateRequest.input('itemPrice', sql.Decimal(10,2), itemPrice);
updateRequest.input('categoryId', sql.Int, categoryId);
updateRequest.input('userId', sql.Int, userId);
updateRequest.input('item_picture', sql.NVarChar, item_picture);
updateRequest.input('itemId', sql.Int, itemId);

await updateRequest.query(`
  UPDATE items
  SET
    itemName = @itemName,
    itemDesc = @itemDesc,
    itemPrice = @itemPrice,
    categoryId = @categoryId,
    userId = @userId,
    item_picture = @item_picture
  WHERE itemId = @itemId
`);

    

    res.json({
  message: 'Item updated successfully',
  originalSizeKB: originalImageSizeKB ? `${originalImageSizeKB} KB` : null,
  imageSizeKB: finalImageSizeKB ? `${finalImageSizeKB} KB` : null,
  imagePath: item_picture
});

  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ error: err.message });
  }
};


const deleteItem = async (req, res) => {
  const { itemId } = req.params;

  try {
    await sql.connect(config);

    // Get item image path
    const result = await sql.query(`SELECT item_picture FROM items WHERE itemId = ${itemId}`);
    const item = result.recordset[0];

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    
    const imagePath = item.item_picture ? path.join('/mnt/uploads', item.item_picture) : null;

    // Delete image file if exists
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }


    // Delete item from DB
    await sql.query(`DELETE FROM items WHERE itemId = ${itemId}`);

    res.json({ message: 'Item and image deleted successfully' });

  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllItems,
  getAllItemsById,
  getCategories,
  addItem,
  updateItem,
  deleteItem,
};
