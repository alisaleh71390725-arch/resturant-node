const { sql, config } = require('../db/sqlConfig');

// Add a new role
const addRole = async (req, res) => {
  const { roleName } = req.body;
  if (!roleName) return res.status(400).json({ error: 'roleName is required' });

  try {
    await sql.connect(config);

    // Check if the role already exists
    const existing = await sql.query`SELECT * FROM Roles WHERE roleName = ${roleName}`;
    if (existing.recordset.length > 0) {
      return res.status(409).json({ error: 'Role name already exists' });
    }

    // Insert new role
    await sql.query`INSERT INTO Roles (roleName) VALUES (${roleName})`;
    res.status(201).json({ message: 'Role created successfully' });
  } catch (err) {
    console.error('Error adding role:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update an existing role
const updateRole = async (req, res) => {
  const { roleId } = req.params;
  const { roleName } = req.body;

  if (!roleName) return res.status(400).json({ error: 'roleName is required' });

  try {
    await sql.connect(config);

    // Check if role exists
    const existingRole = await sql.query`SELECT * FROM Roles WHERE roleId = ${roleId}`;
    if (existingRole.recordset.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Check if new name already exists for a different role
    const duplicateCheck = await sql.query`SELECT * FROM Roles WHERE roleName = ${roleName} AND roleId <> ${roleId}`;
    if (duplicateCheck.recordset.length > 0) {
      return res.status(409).json({ error: 'Role name already exists' });
    }

    // Update the role
    await sql.query`UPDATE Roles SET roleName = ${roleName} WHERE roleId = ${roleId}`;
    res.json({ message: 'Role updated successfully' });
  } catch (err) {
    console.error('Error updating role:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete a role
const deleteRole = async (req, res) => {
  const { roleId } = req.params;

  try {
    await sql.connect(config);

    // Check if role exists
    const result = await sql.query`SELECT * FROM Roles WHERE roleId = ${roleId}`;
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
      const userResult = await sql.query`SELECT * FROM Users WHERE roleId = ${roleId}`;
    if (userResult.recordset.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete role: users are assigned to this role' 
      });
    }

    // Delete the role
    await sql.query`DELETE FROM Roles WHERE roleId = ${roleId}`;
    res.json({ message: 'Role deleted successfully' });
  } catch (err) {
    console.error('Error deleting role:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all roles
const getAllRoles = async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM Roles`;
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching roles:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  addRole,
  updateRole,
  deleteRole,
  getAllRoles,
};
