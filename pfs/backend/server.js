require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS and JSON parsing for frontend requests
app.use(cors());
app.use(express.json());

// Configure Multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Access denied' });
  
  const token = authHeader.split(' ')[1];
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'supersecret123456789');
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

app.post('/api/upload', verifyToken, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate a unique file name to avoid collisions
    const fileExtension = path.extname(file.originalname);
    const uniqueName = crypto.randomUUID() + fileExtension;
    const bucketName = process.env.AWS_S3_BUCKET_NAME;

    // Build the upload command
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueName,
      Body: file.buffer,
      ContentType: file.mimetype, // Ensure correct content type so browser displays instead of downloading
      // ACL: 'public-read' // Note: Most modern S3 buckets disable ACLs. We rely on Bucket Policy instead.
    });

    // Send the file to S3
    await s3Client.send(command);

    // Provide the public URL directly (bucket must be configured for public access)
    const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueName}`;

    // Also generate a pre-signed URL with 1-hour expiry to guarantee access even without a public bucket
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: uniqueName,
    });
    const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 }); // 3600 seconds = 1 hour

    // Insert into database to keep track of user uploads
    await pool.query('INSERT INTO files (user_id, file_name, file_url) VALUES (?, ?, ?)', [req.user.id, file.originalname, publicUrl]);

    res.json({
      message: 'File uploaded successfully',
      url: presignedUrl, // Giving priority to the presigned URL
      publicUrl: publicUrl,
      fileName: file.originalname,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file to S3' });
  }
});

// Basic check
app.get('/', (req, res) => res.send('Backend is running.'));

// Authentication Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await pool.query('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, passwordHash]);
    
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Error registering user' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'supersecret123456789',
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error logging in' });
  }
});

app.get('/api/files', verifyToken, async (req, res) => {
  try {
    const [files] = await pool.query('SELECT file_name, file_url, created_at FROM files WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ files });
  } catch (error) {
    console.error('Fetch files error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
