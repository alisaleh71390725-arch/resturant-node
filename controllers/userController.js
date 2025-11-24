const { sql, config } = require('../db/sqlConfig');
const fs = require('fs');
const path = require('path');

// GET all users
const getAllUsers = async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT 
        userId,
        userName,
        userPass,
        is_active,
        roleId,
        description,
        url,
        CONVERT(date, startTime) AS startTime,
        CONVERT(date, endTime) AS endTime
      FROM users
    `;
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// GET user by ID
const getUserbyID = async (req, res) => {
  const { userId } = req.params;
  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT userId, is_active, roleId, description, url 
      FROM users 
      WHERE userId = ${userId}
    `;
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getExpiration = async (req, res) => {
  const { userId } = req.params;
  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT userId,
             CONVERT(date, startTime) AS startTime,
             CONVERT(date, endTime) AS endTime
      FROM users 
      WHERE userId = ${userId}
    `;

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return the first object instead of an array
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// POST new user
const addUser = async (req, res) => {
  let { userName, userPass, is_active, roleId, description, url, startTime, endTime } = req.body;

  if (!userName || !userPass) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  try {
    await sql.connect(config);

    // Check if username exists
    const existingUser = await sql.query`SELECT * FROM users WHERE userName = ${userName}`;
    if (existingUser.recordset.length > 0) {
      return res.status(409).json({ error: 'Username exists' });
    }

    // Convert startTime and endTime to SQL-friendly format
    startTime = startTime ? new Date(startTime).toISOString().split('T')[0] : null; // YYYY-MM-DD
    endTime = endTime ? new Date(endTime).toISOString().split('T')[0] : null;       // YYYY-MM-DD

    // Insert user
    const insertUserResult = await sql.query`
      INSERT INTO users (userName, userPass, is_active, roleId, description, url, startTime, endTime)
      OUTPUT INSERTED.userId
      VALUES (${userName}, ${userPass}, ${is_active ?? true}, ${roleId ?? null}, ${description ?? ''}, ${url ?? ''}, ${startTime}, ${endTime})
    `;

    const newUserId = insertUserResult.recordset[0].userId;

    // Insert default profile
    await sql.query`
      INSERT INTO user_profiles (userId, companyName, phone, whatsapp, location, logo)
      VALUES (${newUserId}, '', '', '', '', '')
    `;

    res.status(201).json({ message: 'User and profile added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// PUT (update) user
const updateUser = async (req, res) => {
  const { userId } = req.params;
  const { userName, userPass, is_active, roleId, description, url, startTime, endTime } = req.body;

  if (!userName && !userPass && is_active === undefined && roleId === undefined && description === undefined && url === undefined &&
    startTime === undefined &&  endTime === undefined) {
    return res.status(400).json({ error: 'required_fields' });
  }

  try {
    await sql.connect(config);

    const userResult = await sql.query`SELECT * FROM users WHERE userId = ${userId}`;
    if (userResult.recordset.length === 0) {
      return res.status(404).json({ error: 'no_user' });
    }

    const currentUser = userResult.recordset[0];
    if (userName && userName !== currentUser.userName) {
      const duplicateUser = await sql.query`SELECT * FROM users WHERE userName = ${userName}`;
      if (duplicateUser.recordset.length > 0) {
        return res.status(409).json({ error: 'Username exists' });
      }
    }

    let updates = [];
    const request = new sql.Request();
    request.input('userId', sql.Int, userId);

    if (userName) { updates.push('userName = @userName'); request.input('userName', sql.NVarChar, userName); }
    if (userPass) { updates.push('userPass = @userPass'); request.input('userPass', sql.NVarChar, userPass); }
    if (typeof is_active === 'boolean') { updates.push('is_active = @is_active'); request.input('is_active', sql.Bit, is_active); }
    if (roleId !== undefined) { updates.push('roleId = @roleId'); request.input('roleId', sql.Int, roleId); }
    if (description !== undefined) { updates.push('description = @description'); request.input('description', sql.NVarChar, description); }
    if (url !== undefined) { updates.push('url = @url'); request.input('url', sql.NVarChar, url); }
    if (startTime !== undefined) { updates.push('startTime = @startTime'); request.input('startTime', sql.DateTime, startTime); }
    if (endTime !== undefined) { updates.push('endTime = @endTime'); request.input('endTime', sql.DateTime, endTime); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE userId = @userId`;
    await request.query(updateQuery);
    res.status(200).json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE user
const deleteUser = async (req, res) => {
  const { userId } = req.params;

  if (parseInt(userId) === 1) {
    return res.status(403).json({ error: 'Cannot delete admin user' });
  }

  try {
    await sql.connect(config);

    const linkedItems = await sql.query`SELECT COUNT(*) AS count FROM items WHERE userId = ${userId}`;
    if (linkedItems.recordset[0].count > 0) {
      return res.status(409).json({ error: 'User is linked in items!' });
    }

    const result = await sql.query`SELECT logo FROM user_profiles WHERE userId = ${userId}`;
    const userProfile = result.recordset[0];

    if (userProfile?.logo) {
      const logoPath = path.join(__dirname, '..', 'uploads', userProfile.logo);
      if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
    }

    await sql.query`DELETE FROM user_profiles WHERE userId = ${userId}`;
    await sql.query`DELETE FROM users WHERE userId = ${userId}`;

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// LOGIN user
const loginUser = async (req, res) => {
  const { userName, userPass } = req.body;

  if (!userName || !userPass) {
    return res.status(400).json({ error: 'missing_credentials' });
  }

  try {
    await sql.connect(config);

    const result = await sql.query`
      SELECT userId, userName, userPass, is_active, roleId, startTime, endTime
      FROM users
      WHERE userName = ${userName}
    `;

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const user = result.recordset[0];

    // Check password
    if (user.userPass !== userPass) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    // Admin bypasses active and time checks
    if (user.userId !== 1) {
      // Check if active
      if (!user.is_active) {
        return res.status(403).json({ error: 'user_inactive' });
      }

      // Only allow login if today is >= startDate and < endDate
      const today = new Date();
      const startDate = new Date(user.startTime);
      const endDate = new Date(user.endTime);

      // Remove time part for date-only comparison
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

      if (todayOnly < startOnly || todayOnly >= endOnly) {
        return res.status(403).json({ error: 'user_time_expired' });
      }
    }

    res.status(200).json({
      message: 'login_success',
      userId: user.userId,
      userName: user.userName,
      roleId: user.roleId,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};





// CHANGE PASSWORD
const changePassword = async (req, res) => {
  const { userId } = req.params;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  try {
    await sql.connect(config);

    // Fetch the user
    const result = await sql.query`SELECT userPass FROM users WHERE userId = ${userId}`;
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'no_user' });
    }

    const user = result.recordset[0];

    // Check old password
    if (user.userPass !== oldPassword) {
      return res.status(401).json({ error: 'wrong_password' });
    }

    // Update new password
    await sql.query`UPDATE users SET userPass = ${newPassword} WHERE userId = ${userId}`;

    res.status(200).json({ message: 'password_updated' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getDescription = async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT userId, roleId, description, url, is_active, startTime, endTime
      FROM users
    `;
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



module.exports = {
  getAllUsers,
  addUser,
  updateUser,
  deleteUser,
  getUserbyID,
  loginUser,      
  changePassword, 
  getDescription,
  getExpiration
};
