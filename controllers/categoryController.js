const { sql, config } = require('../db/sqlConfig');

const addCategory = async (req, res) => {
  const { categoryName, userId } = req.body;

  if (!categoryName || !userId) {
    return res.status(400).json({ error: 'categoryName and userId are required' });
  }

  try {
    await sql.connect(config);
    const existing = await sql.query(`
      SELECT * FROM category WHERE userId = ${userId} AND categoryName = N'${categoryName}'
    `);

    if (existing.recordset.length > 0) {
      return res.status(400).json({ error: 'Category name already exists!' });
    }
    await sql.query(`
      INSERT INTO category (categoryName, userId)
      VALUES (N'${categoryName}', ${userId})
    `);
    res.status(201).json({ message: 'Category created successfully' });
  } catch (err) {
    console.error('Error adding category:', err);
    res.status(500).json({ error: err.message });
  }
};

const updateCategory = async (req, res) => {
  const { categoryId } = req.params;
  const { categoryName, userId } = req.body;

  if (!categoryName|| !userId) {
    return res.status(400).json({ error: 'categoryName and userId are required' });
  }

  try {
    await sql.connect(config);

    const result = await sql.query(`SELECT * FROM category WHERE categoryId = ${categoryId}`);
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const duplicateCheck = await sql.query(`
      SELECT * FROM category 
      WHERE userId = ${userId} 
        AND categoryName = N'${categoryName}' 
        AND categoryId != ${categoryId}
    `);

    if (duplicateCheck.recordset.length > 0) {
      return res.status(400).json({ error: 'Category name already exists!' });
    }

    await sql.query(`
      UPDATE category SET categoryName = N'${categoryName}'
      WHERE categoryId = ${categoryId}
    `);

    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ error: err.message });
  }
};

const deleteCategory = async (req, res) => {
  const { categoryId } = req.params;

  try {
    await sql.connect(config);

    // Check if category exists
    const categoryResult = await sql.query(`
      SELECT * FROM category WHERE categoryId = ${categoryId}
    `);
    if (categoryResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if the category has items
    const itemsResult = await sql.query(`
      SELECT * FROM items WHERE categoryId = ${categoryId}
    `);
    if (itemsResult.recordset.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category. It contains items.' 
      });
    }

    // Delete category if no items
    await sql.query(`
      DELETE FROM category WHERE categoryId = ${categoryId}
    `);

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: err.message });
  }
};


const getAllCategories = async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query(`SELECT * FROM category ORDER BY categoryName ASC`); 
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: err.message });
  }
};


module.exports = {
  addCategory,
  updateCategory,
  deleteCategory,
  getAllCategories
};
