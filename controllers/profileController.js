const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { sql, config } = require('../db/sqlConfig');

exports.getUserProfile = async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT * FROM user_profiles WHERE userId = ${userId}
    `);

    const profile = result.recordset[0];
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    if (profile.logo) {
      profile.logoUrl = `http://localhost:3000/api/uploads/${profile.logo}`;

    }

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUserProfile = async (req, res) => {
  const userId = parseInt(req.params.id);
  const { companyName, phone, whatsapp, location ,direction,dollarRate,currency} = req.body;

  try {
    await sql.connect(config);

    // ✅ Check if another user already uses the same company name
    const dupCheck = await sql.query(`
      SELECT userId FROM user_profiles 
      WHERE companyName = '${companyName.replace(/'/g, "''")}' AND userId != ${userId}
    `);

    if (dupCheck.recordset.length > 0) {
      return res.status(400).json({ error: 'Company name is already taken' });
    }

    // ✅ Get existing profile (for logo handling)
    const existing = await sql.query(`SELECT logo FROM user_profiles WHERE userId = ${userId}`);
    const existingProfile = existing.recordset[0];

    let logo = existingProfile?.logo || '';

    // ✅ Handle image upload
    if (req.file) {
      const originalPath = req.file.path;
      const ext = path.extname(req.file.originalname);
      const filename = `profile-${Date.now()}${ext}`;
      const userFolder = `user_${userId}`;
      const outputDir = path.join('/mnt/uploads', userFolder);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputPath = path.join(outputDir, filename);

      await sharp(originalPath)
        .resize(300, 300, { fit: 'fill' })
        .toFile(outputPath);

      fs.unlinkSync(originalPath);

      if (existingProfile?.logo) {
        const oldLogoPath = path.join('/mnt/uploads', existingProfile.logo);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }

      logo = path.join(userFolder, filename);
    }

    // ✅ Update or insert profile
    const request = new sql.Request();
    request.input('companyName', sql.NVarChar(255), companyName);
    request.input('phone', sql.VarChar(20), phone);
    request.input('whatsapp', sql.VarChar(20), whatsapp);
    request.input('location', sql.NVarChar(255), location);
    request.input('direction', sql.NVarChar(255), direction);
    request.input('dollarRate', sql.NVarChar(100), dollarRate);
    request.input('currency', sql.NVarChar(100), currency);
    request.input('logo', sql.VarChar(255), logo);
    request.input('userId', sql.Int, userId);

    if (existingProfile) {
      await request.query(`
        UPDATE user_profiles SET
          companyName = @companyName,
          phone = @phone,
          whatsapp = @whatsapp,
          location = @location,
          direction = @direction,
          dollarRate=@dollarRate,
          currency=@currency,
          logo = @logo
        WHERE userId = @userId
      `);
    } else {
      await request.query(`
        INSERT INTO user_profiles (companyName, phone, whatsapp, location, logo, userId,direction,dollarRate,currency)
        VALUES (@companyName, @phone, @whatsapp, @location, @logo, @userId,@direction,@dollarRate,@currency)
      `);
    }

    res.json({ message: 'Profile saved successfully' });

  } catch (err) {
    console.error('Error saving profile:', err);
    res.status(500).json({ error: 'Server error' });
  }
};



exports.getProfileByCompanyName = async (req, res) => {
  const companyName = req.params.companyName;

  try {
    await sql.connect(config);
    const request = new sql.Request();

    request.input('companyName', sql.NVarChar(255), companyName);

    const result = await request.query(`
      SELECT 
        p.*,
        u.is_active,
        u.startTime,
        u.endTime
      FROM user_profiles p
      JOIN users u ON u.userId = p.userId
      WHERE p.companyName = @companyName
    `);

    const profile = result.recordset[0];

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    if (!profile.is_active) {
      return res.status(403).json({
        message: "User is not active."
      });
    }
    const today = new Date();
    const endDate = new Date(profile.endTime);

    if (endDate < today) {
      return res.status(403).json({
        message: "User subscription has expired."
      });
    }

    // Add full logo URL
    if (profile.logo) {
      profile.logoUrl = `http://localhost:3000/api/uploads/${profile.logo}`;
    }

    res.json(profile);

  } catch (err) {
    console.error('Error fetching profile by companyName:', err);
    res.status(500).json({ error: 'Server error' });
  }
};



exports.getAllProfiles = async (req, res) => {
  try {
    await sql.connect(config);

    const result = await sql.query(`
      SELECT * FROM user_profiles
    `);

    const profiles = result.recordset.map(profile => {
      if (profile.logo) {
        profile.logoUrl = `http://localhost:3000/api/uploads/${profile.logo}`;
      }
      return profile;
    });

    res.json(profiles);
  } catch (err) {
    console.error('Error fetching all profiles:', err);
    res.status(500).json({ error: 'Server error while fetching profiles' });
  }
};
