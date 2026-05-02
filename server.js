const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error connecting to database:', err.stack);
  }
  console.log('✅ Connected to database');
  release();
});

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('\n🔐 AUTH MIDDLEWARE - Headers:', authHeader);
  
  const token = authHeader?.split(' ')[1];
  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    console.log('🔑 Verifying token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Decoded token:', decoded);
    
    console.log('🔍 Fetching user from DB with ID:', decoded.userId);
    const user = await pool.query(
      'SELECT id, lab_id, role, permissions, is_super_admin FROM users WHERE id = $1', 
      [decoded.userId]
    );
    
    if (user.rows.length === 0) {
      console.log('❌ User not found in DB');
      return res.status(401).json({ error: 'User not found' });
    }
    
    console.log('✅ User found in DB:', user.rows[0]);
    console.log('✅ Setting req.labId =', user.rows[0].lab_id);
    
    req.userId = decoded.userId;
    req.labId = user.rows[0].lab_id;  // THIS MUST BE SET
    req.userRole = user.rows[0].role;
    req.userPermissions = user.rows[0].permissions || {};
    req.isSuperAdmin = user.rows[0].is_super_admin || false;
    req.user = user.rows[0];
    
    console.log('✅ Authentication successful. req.labId =', req.labId);
    next();
  } catch (err) {
    console.error('❌ Auth error:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads/referrals');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'referral-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|jpg|jpeg|png|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, images, and Word documents are allowed'));
    }
  }
});
// Role-based authorization middleware
const authorize = (roles = [], permissions = [], options = { allowSuperAdmin: true }) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    
    // Super admin can do everything
    if (options.allowSuperAdmin && req.isSuperAdmin) {
      return next();
    }
    
    // Check roles
    if (roles.length > 0 && !roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Check specific permissions
    if (permissions.length > 0 && req.userPermissions) {
      const hasPermission = permissions.some(p => req.userPermissions[p]);
      if (!hasPermission) {
        return res.status(403).json({ error: 'Permission denied' });
      }
    }
    
    next();
  };
};
// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Lab Management API is running' });
});

// Auth route - LOGIN (update this section)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body; // 'email' field can actually be username

  console.log('\n' + '='.repeat(60));
  console.log('🔐 LOGIN ATTEMPT');
  console.log('📧 Email/Username:', email);
  console.log('🔑 Password provided:', password ? 'Yes' : 'No');

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email/Username and password are required' });
    }

    // Check both email AND name fields
    const user = await pool.query(
      `SELECT id, lab_id, password_hash, role, permissions, name, email, is_super_admin 
       FROM users 
       WHERE email = $1 OR name = $1`,
      [email]
    );

    if (user.rows.length === 0) {
      console.log('❌ No user found with email/username:', email);
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const dbUser = user.rows[0];

    console.log('✅ User found:', dbUser.name);
    console.log('🔑 Comparing passwords...');
    
    const valid = await bcrypt.compare(password, dbUser.password_hash);
    console.log('✅ Password match:', valid);

    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: dbUser.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Login successful!');
    console.log('='.repeat(60) + '\n');

    res.json({
      token,
      labId: dbUser.lab_id,
      role: dbUser.role,
      permissions: dbUser.permissions,
      name: dbUser.name,
      email: dbUser.email,
      is_super_admin: dbUser.is_super_admin || false
    });

  } catch (err) {
    console.error('🔥 Login error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});
// Orders
app.post('/api/orders', authenticate, async (req, res) => {
  const { patientId, testIds, totalAmount } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query(
      'INSERT INTO orders (lab_id, patient_id, total_amount) VALUES ($1, $2, $3) RETURNING id',
      [req.labId, patientId, totalAmount]
    );
    const orderId = order.rows[0].id;
    for (let testId of testIds) {
      await client.query(
        'INSERT INTO order_tests (order_id, test_id) VALUES ($1, $2)',
        [orderId, testId]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ orderId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// Update payment endpoint with better error handling
app.post('/api/orders/:orderId/payment', authenticate, async (req, res) => {
  const { orderId } = req.params;
  const { amount, method, mpesa_code, notes } = req.body;
  
  // Validate input
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if order exists and belongs to this lab
    const order = await client.query(
      'SELECT total_amount, paid_amount FROM orders WHERE id = $1 AND lab_id = $2',
      [orderId, req.labId]
    );
    
    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const newPaid = parseFloat(order.rows[0].paid_amount) + parseFloat(amount);
    if (newPaid > parseFloat(order.rows[0].total_amount)) {
      return res.status(400).json({ error: 'Payment exceeds total' });
    }
    
    // Update order paid amount
    await client.query(
      `UPDATE orders SET 
        paid_amount = $1, 
        status = CASE WHEN $1 >= total_amount THEN 'completed' ELSE status END 
      WHERE id = $2`,
      [newPaid, orderId]
    );
    
    // Insert payment
    const payment = await client.query(
      `INSERT INTO payments (order_id, lab_id, amount, payment_method, mpesa_code, notes) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [orderId, req.labId, amount, method, mpesa_code || null, notes || null]
    );
    
    const paymentId = payment.rows[0].id;
    const receiptNumber = `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create receipt
    const receipt = await client.query(
      'INSERT INTO receipts (payment_id, lab_id, receipt_number) VALUES ($1, $2, $3) RETURNING id',
      [paymentId, req.labId, receiptNumber]
    );
    
    await client.query('COMMIT');
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`lab_${req.labId}`).emit('paymentReceived', { orderId, amount });
    }
    
    res.json({ 
      success: true,
      paymentId, 
      receiptId: receipt.rows[0].id, 
      receiptNumber 
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Payment error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


app.get('/api/reports/summary', authenticate, async (req, res) => {
  const { period } = req.query;
  let interval;
  switch (period) {
    case 'daily': interval = '1 day'; break;
    case 'weekly': interval = '1 week'; break;
    case 'monthly': interval = '1 month'; break;
    case 'quarterly': interval = '3 months'; break;
    default: return res.status(400).json({ error: 'Invalid period' });
  }
  try {
    const orders = await pool.query(
      `SELECT COUNT(*) as order_count, SUM(total_amount) as total_revenue
       FROM orders
       WHERE lab_id = $1 AND created_at >= NOW() - $2::interval`,
      [req.labId, interval]
    );
    const payments = await pool.query(
      `SELECT SUM(amount) as total_paid
       FROM payments
       WHERE lab_id = $1 AND created_at >= NOW() - $2::interval`,
      [req.labId, interval]
    );
    res.json({
      orders: orders.rows[0],
      payments: payments.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Print results
app.get('/api/orders/:orderId/print', authenticate, async (req, res) => {
  const { orderId } = req.params;
  const order = await pool.query(
    `SELECT o.*, p.name as patient_name, p.email as patient_email, l.name as lab_name, l.logo_url
     FROM orders o 
     JOIN patients p ON o.patient_id = p.id 
     JOIN labs l ON o.lab_id = l.id
     WHERE o.id = $1 AND o.lab_id = $2`,
    [orderId, req.labId]
  );
  const tests = await pool.query(
    'SELECT t.name, ot.result FROM order_tests ot JOIN tests t ON ot.test_id = t.id WHERE ot.order_id = $1',
    [orderId]
  );
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=results-${orderId}.pdf`);
  doc.pipe(res);
  if (order.rows[0].logo_url) {
    doc.image(path.join(__dirname, order.rows[0].logo_url), 50, 45, { width: 100 });
  }
  doc.fontSize(20).text(order.rows[0].lab_name, 200, 50);
  doc.fontSize(12).text(`Patient: ${order.rows[0].patient_name}`, 50, 150);
  tests.rows.forEach((t, i) => {
    doc.text(`${t.name}: ${t.result || 'pending'}`, 50, 180 + i * 20);
  });
  doc.end();
});

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = socketIo(server, { 
  cors: { 
    origin: '*',
    methods: ['GET', 'POST']
  } 
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('unauthorized'));
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('unauthorized'));
    socket.userId = decoded.userId;
    // Get lab_id for the user
    pool.query('SELECT lab_id FROM users WHERE id = $1', [decoded.userId])
      .then(result => {
        socket.labId = result.rows[0].lab_id;
        next();
      })
      .catch(() => next(new Error('database error')));
  });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);
  socket.join(`lab_${socket.labId}`);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.userId);
  });
});
// Get all labs - Super admin sees all, regular admins see only their own
app.get('/api/labs', authenticate, async (req, res) => {
  try {
    let query;
    if (req.isSuperAdmin) {
      // Super admin sees all labs
      query = `
        SELECT l.*, 
          (SELECT COUNT(*) FROM users WHERE lab_id = l.id) as user_count,
          (SELECT COUNT(*) FROM patients WHERE lab_id = l.id) as patient_count
        FROM labs l
        ORDER BY l.created_at DESC
      `;
      const labs = await pool.query(query);
      res.json(labs.rows);
    } else {
      // Regular admin sees only their own lab
      query = `
        SELECT l.*, 
          (SELECT COUNT(*) FROM users WHERE lab_id = l.id) as user_count,
          (SELECT COUNT(*) FROM patients WHERE lab_id = l.id) as patient_count
        FROM labs l
        WHERE l.id = $1
      `;
      const labs = await pool.query(query, [req.labId]);
      res.json(labs.rows);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Create new lab - ONLY SUPER ADMIN
app.post('/api/labs', authenticate, async (req, res) => {
  // Check if user is super admin
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: 'Only super admin can create new labs' });
  }
  
  const { company_name, name, email, password, phone, address, website, subscription_plan, kra_pin, business_reg } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Insert the lab
    const labResult = await client.query(
      `INSERT INTO labs (company_name, name, phone, address, website, subscription_plan, subscription_status, kra_pin, business_reg) 
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8) 
       RETURNING *`,
      [company_name, name, phone, address, website, subscription_plan, kra_pin, business_reg]
    );
    
    const newLab = labResult.rows[0];
    
    // Hash the admin password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create the admin user for this lab
    await client.query(
      `INSERT INTO users (lab_id, email, password_hash, name, role, permissions) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newLab.id, email, hashedPassword, 'Lab Admin', 'admin', '{"can_delete": true, "can_manage_patients": true, "can_manage_tests": true}']
    );
    
    // Create subscription record
    const planPrices = {
      basic: 5000,
      professional: 15000,
      enterprise: 45000
    };
    
    await client.query(
      `INSERT INTO subscriptions (lab_id, plan_name, price, billing_cycle, start_date) 
       VALUES ($1, $2, $3, 'monthly', CURRENT_DATE)`,
      [newLab.id, subscription_plan, planPrices[subscription_plan] || 0]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json({ 
      success: true, 
      lab: newLab,
      message: 'Lab registered successfully' 
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating lab:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// Create new user for current lab
app.post('/api/users', authenticate, authorize(['admin']), async (req, res) => {
  const { email, password, name, role, permissions } = req.body;
  
  // Always use the authenticated user's lab ID
  const labId = req.labId;
  
  // Check if user already exists in this lab
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND lab_id = $2',
    [email, labId]
  );
  
  if (existingUser.rows.length > 0) {
    return res.status(400).json({ error: 'User already exists in this lab' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    const result = await pool.query(
      `INSERT INTO users (lab_id, email, password_hash, name, role, permissions) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, name, role, permissions, created_at`,
      [labId, email, hashedPassword, name, role, permissions || {}]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: err.message });
  }
});;
// Example for patients endpoint
app.get('/api/patients', authenticate, async (req, res) => {
  try {
    const patients = await pool.query(
      'SELECT * FROM patients WHERE lab_id = $1 ORDER BY created_at DESC',
      [req.labId]  // Always filter by lab_id
    );
    res.json(patients.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Add new patient
app.post('/api/patients', authenticate, async (req, res) => {
  const { name, phone, email } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO patients (lab_id, name, phone, email) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.labId, name, phone, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all tests
app.get('/api/tests', authenticate, async (req, res) => {
  try {
    const tests = await pool.query('SELECT * FROM tests WHERE lab_id = $1', [req.labId]);
    res.json(tests.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new test
app.post('/api/tests', authenticate, async (req, res) => {
  const { name, price } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tests (lab_id, name, price) VALUES ($1, $2, $3) RETURNING *',
      [req.labId, name, price]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent orders
app.get('/api/orders', authenticate, async (req, res) => {
  const { limit = 10 } = req.query;
  try {
    const orders = await pool.query(
      `SELECT o.*, p.name as patient_name 
       FROM orders o 
       JOIN patients p ON o.patient_id = p.id 
       WHERE o.lab_id = $1 
       ORDER BY o.created_at DESC 
       LIMIT $2`,
      [req.labId, limit]
    );
    res.json(orders.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Get user profile
app.get('/api/user/profile', authenticate, async (req, res) => {
  try {
    // Check if name column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='name'
    `);
    
    let query;
    if (columnCheck.rows.length > 0) {
      query = 'SELECT id, email, name, role, lab_id, created_at, is_super_admin FROM users WHERE id = $1';
    } else {
      query = 'SELECT id, email, role, lab_id, created_at, is_super_admin FROM users WHERE id = $1';
    }
    
    const user = await pool.query(query, [req.userId]);
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // If name doesn't exist, use email as name
    if (!user.rows[0].name) {
      user.rows[0].name = user.rows[0].email.split('@')[0];
    }
    
    // Ensure is_super_admin is included (default to false if null)
    user.rows[0].is_super_admin = user.rows[0].is_super_admin || false;
    
    res.json(user.rows[0]);
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: err.message });
  }
});


// Get all patients
app.get('/api/patients', authenticate, async (req, res) => {
  try {
    const patients = await pool.query(
      'SELECT * FROM patients WHERE lab_id = $1 ORDER BY created_at DESC',
      [req.labId]
    );
    res.json(patients.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new patient
app.post('/api/patients', authenticate, async (req, res) => {
  const { name, phone, email, address, date_of_birth, gender, blood_group, emergency_contact } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO patients (lab_id, name, phone, email, address, date_of_birth, gender, blood_group, emergency_contact) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [req.labId, name, phone, email, address, date_of_birth, gender, blood_group, emergency_contact]
    );
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details) 
       VALUES ($1, $2, 'PATIENT_CREATED', 'patient', $3, $4)`,
      [req.labId, req.userId, result.rows[0].id, JSON.stringify({ name })]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all tests
app.get('/api/tests', authenticate, async (req, res) => {
  try {
    const tests = await pool.query(
      'SELECT * FROM tests WHERE lab_id = $1 AND is_active = true ORDER BY category, name',
      [req.labId]
    );
    res.json(tests.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new test
app.post('/api/tests', authenticate, async (req, res) => {
  const { name, category, price, description, turnaround_time, sample_type } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO tests (lab_id, name, category, price, description, turnaround_time, sample_type) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [req.labId, name, category, price, description, turnaround_time, sample_type]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent orders with details
app.get('/api/orders', authenticate, async (req, res) => {
  const { limit = 10 } = req.query;
  try {
    const orders = await pool.query(
      `SELECT o.*, p.name as patient_name, p.phone as patient_phone,
        (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'price', t.price, 'result', ot.result))
         FROM order_tests ot JOIN tests t ON ot.test_id = t.id 
         WHERE ot.order_id = o.id) as tests
       FROM orders o 
       JOIN patients p ON o.patient_id = p.id 
       WHERE o.lab_id = $1 
       ORDER BY o.created_at DESC 
       LIMIT $2`,
      [req.labId, limit]
    );
    res.json(orders.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get invoices
app.get('/api/invoices', authenticate, async (req, res) => {
  try {
    const invoices = await pool.query(
      `SELECT i.*, p.name as patient_name 
       FROM invoices i 
       JOIN patients p ON i.patient_id = p.id 
       WHERE i.lab_id = $1 
       ORDER BY i.created_at DESC`,
      [req.labId]
    );
    res.json(invoices.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get activity logs with better formatting
app.get('/api/activity-logs', authenticate, async (req, res) => {
  const { limit = 50 } = req.query;
  try {
    const logs = await pool.query(
      `SELECT l.*, u.email as user_email, u.name as user_name
       FROM activity_logs l 
       LEFT JOIN users u ON l.user_id = u.id 
       WHERE l.lab_id = $1 
       ORDER BY l.created_at DESC 
       LIMIT $2`,
      [req.labId, limit]
    );
    
    // Get unique actions and entity types for filters
    const filters = await pool.query(
      `SELECT 
        ARRAY_AGG(DISTINCT action) as actions,
        ARRAY_AGG(DISTINCT entity_type) as entity_types
       FROM activity_logs 
       WHERE lab_id = $1`,
      [req.labId]
    );
    
    // Format the logs with descriptions
    const formattedLogs = logs.rows.map(log => {
      let description = '';
      const user = log.user_name || log.user_email || 'System';
      let details = {};
      
      try {
        details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      } catch (e) {
        details = log.details || {};
      }
      
      switch(log.action) {
        case 'LAB_CREATED':
          description = `🏢 ${user} created a new lab: ${details.name || ''}`;
          break;
        case 'PATIENT_CREATED':
          description = `👤 ${user} added patient: ${details.name || ''}`;
          break;
        case 'PATIENT_UPDATED':
          description = `✏️ ${user} updated patient: ${details.name || ''}`;
          break;
        case 'PATIENT_DELETED':
          description = `🗑️ ${user} deleted patient: ${details.name || ''}`;
          break;
        case 'TEST_CREATED':
          description = `🔬 ${user} added test: ${details.name || ''}`;
          break;
        case 'TEST_UPDATED':
          description = `✏️ ${user} updated test: ${details.name || ''}`;
          break;
        case 'TEST_DELETED':
          description = `🗑️ ${user} deleted test: ${details.name || ''}`;
          break;
        case 'ORDER_CREATED':
          description = `📋 ${user} created order #${log.entity_id}`;
          break;
        case 'ORDER_UPDATED':
          description = `✏️ ${user} updated order #${log.entity_id}`;
          break;
        case 'ORDER_DELETED':
          description = `🗑️ ${user} deleted order #${log.entity_id}`;
          break;
        case 'PAYMENT_ADDED':
          description = `💰 ${user} added payment of ${details.amount || ''} via ${details.method || ''}`;
          break;
        case 'RESULT_ADDED':
          description = `📊 ${user} added test result for order #${log.entity_id}`;
          break;
        case 'RESULT_UPDATED':
          description = `📊 ${user} updated test result for order #${log.entity_id}`;
          break;
        case 'USER_CREATED':
          description = `👤 ${user} created user: ${details.email || ''}`;
          break;
        case 'USER_UPDATED':
          description = `✏️ ${user} updated user: ${details.email || ''}`;
          break;
        case 'USER_DELETED':
          description = `🗑️ ${user} deleted user: ${details.email || ''}`;
          break;
        case 'LOGIN':
          description = `🔐 ${user} logged in`;
          break;
        case 'LOGOUT':
          description = `🚪 ${user} logged out`;
          break;
        default:
          description = `${log.action}: ${JSON.stringify(details)}`;
      }
      
      return {
        ...log,
        description
      };
    });
    
    res.json({
      logs: formattedLogs,
      filters: filters.rows[0] || { actions: [], entity_types: [] }
    });
    
  } catch (err) {
    console.error('Error fetching activity logs:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function to format log descriptions
const formatLogDescription = (log) => {
  const time = new Date(log.created_at).toLocaleString('en-KE');
  const user = log.user_name || log.user_email || 'System';
  
  try {
    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    
    switch(log.action) {
      case 'LAB_CREATED':
        return `🏢 ${user} created a new lab: ${details?.name || ''}`;
      case 'PATIENT_CREATED':
        return `👤 ${user} added patient: ${details?.name || ''}`;
      case 'PATIENT_UPDATED':
        return `✏️ ${user} updated patient: ${details?.name || ''}`;
      case 'PATIENT_DELETED':
        return `🗑️ ${user} deleted patient: ${details?.name || ''}`;
      case 'TEST_CREATED':
        return `🔬 ${user} added test: ${details?.name || ''}`;
      case 'TEST_UPDATED':
        return `✏️ ${user} updated test: ${details?.name || ''}`;
      case 'TEST_DELETED':
        return `🗑️ ${user} deleted test: ${details?.name || ''}`;
      case 'ORDER_CREATED':
        return `📋 ${user} created order #${log.entity_id}`;
      case 'ORDER_UPDATED':
        return `✏️ ${user} updated order #${log.entity_id}`;
      case 'ORDER_DELETED':
        return `🗑️ ${user} deleted order #${log.entity_id}`;
      case 'PAYMENT_ADDED':
        return `💰 ${user} added payment of KES ${details?.amount || ''} via ${details?.method || ''}`;
      case 'RESULT_ADDED':
        return `📊 ${user} added test result for order #${log.entity_id}`;
      case 'RESULT_UPDATED':
        return `📊 ${user} updated test result for order #${log.entity_id}`;
      case 'USER_CREATED':
        return `👤 ${user} created user: ${details?.email || ''}`;
      case 'USER_UPDATED':
        return `✏️ ${user} updated user: ${details?.email || ''}`;
      case 'USER_DELETED':
        return `🗑️ ${user} deleted user: ${details?.email || ''}`;
      case 'LOGIN':
        return `🔐 ${user} logged in`;
      case 'LOGOUT':
        return `🚪 ${user} logged out`;
      case 'TEST_LOG':
        return `🧪 Test: ${details?.message || ''}`;
      default:
        return `${log.action}: ${JSON.stringify(details)}`;
    }
  } catch (e) {
    return `${log.action}: ${log.details}`;
  }
};
// Debug endpoint - REMOVE AFTER TESTING
app.get('/api/debug/check-logs', authenticate, async (req, res) => {
  try {
    const count = await pool.query(
      'SELECT COUNT(*) FROM activity_logs WHERE lab_id = $1',
      [req.labId]
    );
    
    const sample = await pool.query(
      'SELECT * FROM activity_logs WHERE lab_id = $1 ORDER BY created_at DESC LIMIT 5',
      [req.labId]
    );
    
    res.json({
      count: count.rows[0].count,
      sample: sample.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate invoice for order
app.post('/api/orders/:orderId/generate-invoice', authenticate, async (req, res) => {
  const { orderId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const order = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND lab_id = $2',
      [orderId, req.labId]
    );
    
    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const invoiceNumber = `INV-${Date.now()}-${orderId}`;
    const result = await client.query(
      `INSERT INTO invoices (lab_id, order_id, invoice_number, patient_id, subtotal, total, due_date) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE + INTERVAL '30 days') 
       RETURNING *`,
      [req.labId, orderId, invoiceNumber, order.rows[0].patient_id, order.rows[0].total_amount, order.rows[0].total_amount]
    );
    
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }// Get single order details
app.get('/api/orders/:orderId', authenticate, async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await pool.query(
      `SELECT o.*, p.name as patient_name, p.phone as patient_phone, p.email as patient_email,
        p.id_number as patient_id_number, p.address as patient_address
       FROM orders o 
       JOIN patients p ON o.patient_id = p.id 
       WHERE o.id = $1 AND o.lab_id = $2`,
      [orderId, req.labId]
    );
    
    const tests = await pool.query(
      `SELECT ot.*, t.name as test_name, t.price, t.category
       FROM order_tests ot
       JOIN tests t ON ot.test_id = t.id
       WHERE ot.order_id = $1`,
      [orderId]
    );
    
    const payments = await pool.query(
      `SELECT * FROM payments WHERE order_id = $1`,
      [orderId]
    );
    
    res.json({
      ...order.rows[0],
      tests: tests.rows,
      payments: payments.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single invoice
app.get('/api/invoices/:invoiceId', authenticate, async (req, res) => {
  const { invoiceId } = req.params;
  try {
    const invoice = await pool.query(
      `SELECT i.*, p.name as patient_name, p.phone as patient_phone, 
        p.email as patient_email, p.address as patient_address,
        l.name as lab_name, l.address as lab_address, l.phone as lab_phone,
        l.kra_pin as lab_kra_pin
       FROM invoices i
       JOIN patients p ON i.patient_id = p.id
       JOIN labs l ON i.lab_id = l.id
       WHERE i.id = $1 AND i.lab_id = $2`,
      [invoiceId, req.labId]
    );
    
    if (invoice.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json(invoice.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Get receipt PDF with logo
app.get('/api/receipts/:receiptId/pdf', authenticate, async (req, res) => {
  const { receiptId } = req.params;
  
  console.log('📄 Generating PDF for receipt:', receiptId);
  
  try {
    // Get receipt data with lab info
    const receipt = await pool.query(
      `SELECT r.*, 
        p.amount, 
        p.payment_method, 
        p.mpesa_code, 
        p.created_at as payment_date,
        o.id as order_id, 
        o.total_amount,
        pt.name as patient_name, 
        pt.phone as patient_phone,
        l.id as lab_id,
        l.name as lab_name, 
        l.address as lab_address, 
        l.phone as lab_phone,
        l.kra_pin as lab_kra_pin,
        ll.logo_data,
        ll.logo_path
       FROM receipts r
       JOIN payments p ON r.payment_id = p.id
       JOIN orders o ON p.order_id = o.id
       JOIN patients pt ON o.patient_id = pt.id
       JOIN labs l ON r.lab_id = l.id
       LEFT JOIN lab_logos ll ON l.id = ll.lab_id
       WHERE r.id = $1 AND r.lab_id = $2`,
      [receiptId, req.labId]
    );
    
    if (receipt.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    const data = receipt.rows[0];
    
    // Generate PDF
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${data.receipt_number}.pdf`);
    
    doc.pipe(res);
    
    // Add logo if available
    if (data.logo_data) {
      try {
        const matches = data.logo_data.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          const logoBuffer = Buffer.from(matches[2], 'base64');
          doc.image(logoBuffer, 50, 45, { width: 100, height: 50, align: 'center', valign: 'center' });
        }
      } catch (logoErr) {
        console.error('Error adding logo to PDF:', logoErr);
        // Continue without logo
      }
    } else if (data.logo_path) {
      try {
        const logoPath = path.join(__dirname, data.logo_path);
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 50, 45, { width: 100, height: 50 });
        }
      } catch (logoErr) {
        console.error('Error adding logo from path:', logoErr);
      }
    }
    
    // Add lab header
    doc.fontSize(20).text(data.lab_name || 'Laboratory', { align: 'center' });
    
    if (data.lab_address) {
      doc.fontSize(10).text(data.lab_address, { align: 'center' });
    }
    
    if (data.lab_phone) {
      doc.fontSize(10).text(`Tel: ${data.lab_phone}`, { align: 'center' });
    }
    
    if (data.lab_kra_pin) {
      doc.fontSize(10).text(`KRA PIN: ${data.lab_kra_pin}`, { align: 'center' });
    }
    
    doc.moveDown();
    doc.fontSize(16).text('OFFICIAL RECEIPT', { align: 'center' });
    doc.moveDown();
    
    // Receipt details
    doc.fontSize(12);
    doc.text(`Receipt No: ${data.receipt_number}`);
    doc.text(`Date: ${new Date(data.payment_date || data.created_at).toLocaleString('en-KE')}`);
    doc.text(`Order No: #${data.order_id}`);
    doc.moveDown();
    
    doc.text(`Patient: ${data.patient_name || 'N/A'}`);
    doc.text(`Phone: ${data.patient_phone || 'N/A'}`);
    doc.moveDown();
    
    doc.text(`Payment Method: ${data.payment_method ? data.payment_method.toUpperCase() : 'N/A'}`);
    if (data.payment_method === 'mpesa' && data.mpesa_code) {
      doc.text(`M-PESA Code: ${data.mpesa_code}`);
    }
    doc.moveDown();
    
    // Amount
    doc.fontSize(14);
    const amount = data.amount ? parseFloat(data.amount).toLocaleString() : '0';
    const total = data.total_amount ? parseFloat(data.total_amount).toLocaleString() : '0';
    
    doc.text(`Amount Paid: KES ${amount}`);
    doc.text(`Total Order: KES ${total}`);
    
    doc.moveDown();
    doc.moveDown();
    
    // Footer
    doc.fontSize(10).text('This is a computer generated receipt', { align: 'center' });
    doc.text('Thank you for choosing ' + (data.lab_name || 'us'), { align: 'center' });
    
    doc.end();
    console.log('✅ PDF generated successfully');
    
  } catch (err) {
    console.error('❌ Receipt PDF error:', err);
    res.status(500).json({ error: err.message });
  }
});
// Get receipts by order ID
app.get('/api/orders/:orderId/receipts', authenticate, async (req, res) => {
  const { orderId } = req.params;
  try {
    // Check if mpesa_code column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='payments' AND column_name='mpesa_code'
    `);
    
    let query;
    if (columnCheck.rows.length > 0) {
      query = `
        SELECT r.*, p.amount, p.payment_method, p.mpesa_code
        FROM receipts r
        JOIN payments p ON r.payment_id = p.id
        WHERE p.order_id = $1 AND r.lab_id = $2
        ORDER BY r.created_at DESC
      `;
    } else {
      query = `
        SELECT r.*, p.amount, p.payment_method, NULL as mpesa_code
        FROM receipts r
        JOIN payments p ON r.payment_id = p.id
        WHERE p.order_id = $1 AND r.lab_id = $2
        ORDER BY r.created_at DESC
      `;
    }
    
    const receipts = await pool.query(query, [orderId, req.labId]);
    res.json(receipts.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Generate invoice PDF
app.get('/api/invoices/:invoiceId/pdf', authenticate, async (req, res) => {
  const { invoiceId } = req.params;
  try {
    const invoice = await pool.query(
      `SELECT i.*, p.name as patient_name, p.phone as patient_phone, p.address as patient_address,
        o.id as order_id, o.created_at as order_date,
        l.name as lab_name, l.address as lab_address, l.phone as lab_phone, l.kra_pin as lab_kra_pin,
        (SELECT json_agg(json_build_object('name', t.name, 'price', t.price))
         FROM order_tests ot
         JOIN tests t ON ot.test_id = t.id
         WHERE ot.order_id = o.id) as tests
       FROM invoices i
       JOIN orders o ON i.order_id = o.id
       JOIN patients p ON i.patient_id = p.id
       JOIN labs l ON i.lab_id = l.id
       WHERE i.id = $1 AND i.lab_id = $2`,
      [invoiceId, req.labId]
    );
    
    if (invoice.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const data = invoice.rows[0];
    
    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${data.invoice_number}.pdf`);
    
    doc.pipe(res);
    
    // Header
    doc.fontSize(20).text(data.lab_name, { align: 'center' });
    doc.fontSize(10).text(data.lab_address || 'Nairobi, Kenya', { align: 'center' });
    doc.fontSize(10).text(`Tel: ${data.lab_phone || 'N/A'}`, { align: 'center' });
    if (data.lab_kra_pin) {
      doc.fontSize(10).text(`KRA PIN: ${data.lab_kra_pin}`, { align: 'center' });
    }
    
    doc.moveDown();
    doc.fontSize(18).text('INVOICE', { align: 'center' });
    doc.moveDown();
    
    // Invoice details
    doc.fontSize(12);
    doc.text(`Invoice No: ${data.invoice_number}`);
    doc.text(`Date: ${new Date(data.created_at).toLocaleString('en-KE')}`);
    doc.text(`Due Date: ${new Date(data.due_date).toLocaleDateString('en-KE')}`);
    doc.text(`Order No: #${data.order_id}`);
    doc.moveDown();
    
    // Patient details
    doc.text(`Bill To:`);
    doc.text(`${data.patient_name}`);
    doc.text(`${data.patient_phone}`);
    if (data.patient_address) doc.text(`${data.patient_address}`);
    doc.moveDown();
    
    // Items table
    const tableTop = doc.y;
    doc.text('Description', 50, tableTop);
    doc.text('Amount (KES)', 400, tableTop, { align: 'right' });
    
    doc.moveDown();
    let y = doc.y;
    
    if (data.tests) {
      data.tests.forEach(test => {
        doc.text(test.name, 50, y);
        doc.text(parseFloat(test.price).toLocaleString(), 400, y, { align: 'right' });
        y += 20;
      });
    }
    
    doc.moveDown();
    doc.moveDown();
    
    // Totals
    const totalY = doc.y + 20;
    doc.text('Subtotal:', 300, totalY);
    doc.text(`KES ${parseFloat(data.subtotal).toLocaleString()}`, 400, totalY, { align: 'right' });
    
    if (data.tax > 0) {
      doc.text('VAT (16%):', 300, totalY + 20);
      doc.text(`KES ${parseFloat(data.tax).toLocaleString()}`, 400, totalY + 20, { align: 'right' });
    }
    
    if (data.discount > 0) {
      doc.text('Discount:', 300, totalY + 40);
      doc.text(`-KES ${parseFloat(data.discount).toLocaleString()}`, 400, totalY + 40, { align: 'right' });
    }
    
    doc.fontSize(14);
    doc.text('TOTAL:', 300, totalY + 60);
    doc.text(`KES ${parseFloat(data.total).toLocaleString()}`, 400, totalY + 60, { align: 'right' });
    
    doc.fontSize(10);
    doc.text(`Status: ${data.status.toUpperCase()}`, 50, totalY + 100);
    
    if (data.status === 'paid' && data.paid_at) {
      doc.text(`Paid on: ${new Date(data.paid_at).toLocaleDateString('en-KE')}`, 50, totalY + 120);
    }
    
    doc.moveDown();
    doc.moveDown();
    
    // Footer
    doc.fontSize(10).text('This is a computer generated invoice', { align: 'center' });
    doc.text('Thank you for your business', { align: 'center' });
    
    doc.end();
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark invoice as paid
app.post('/api/invoices/:invoiceId/pay', authenticate, async (req, res) => {
  const { invoiceId } = req.params;
  const { payment_method, amount, mpesa_code } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get invoice details
    const invoice = await client.query(
      'SELECT * FROM invoices WHERE id = $1 AND lab_id = $2',
      [invoiceId, req.labId]
    );
    
    if (invoice.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Create payment
    const payment = await client.query(
      `INSERT INTO payments (order_id, lab_id, amount, payment_method, mpesa_code) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [invoice.rows[0].order_id, req.labId, amount, payment_method, mpesa_code]
    );
    
    // Create receipt
    const receiptNumber = `RCP-${Date.now()}`;
    await client.query(
      'INSERT INTO receipts (payment_id, lab_id, receipt_number) VALUES ($1, $2, $3)',
      [payment.rows[0].id, req.labId, receiptNumber]
    );
    
    // Update invoice status
    await client.query(
      `UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE id = $1`,
      [invoiceId]
    );
    
    // Update order paid amount
    await client.query(
      `UPDATE orders SET paid_amount = paid_amount + $1 WHERE id = $2`,
      [amount, invoice.rows[0].order_id]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      payment_id: payment.rows[0].id,
      receipt_number: receiptNumber 
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update payment endpoint to include M-PESA
app.post('/api/orders/:orderId/payment', authenticate, async (req, res) => {
  const { orderId } = req.params;
  const { amount, method, mpesa_code, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query('SELECT total_amount, paid_amount FROM orders WHERE id = $1 AND lab_id = $2', [orderId, req.labId]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    
    const newPaid = parseFloat(order.rows[0].paid_amount) + amount;
    if (newPaid > order.rows[0].total_amount) {
      return res.status(400).json({ error: 'Payment exceeds total' });
    }
    
    await client.query('UPDATE orders SET paid_amount = $1 WHERE id = $2', [newPaid, orderId]);
    
    const payment = await client.query(
      'INSERT INTO payments (order_id, lab_id, amount, payment_method, mpesa_code, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [orderId, req.labId, amount, method, mpesa_code, notes]
    );
    
    const paymentId = payment.rows[0].id;
    const receiptNumber = `RCP-${Date.now()}`;
    const receipt = await client.query(
      'INSERT INTO receipts (payment_id, lab_id, receipt_number) VALUES ($1, $2, $3) RETURNING id',
      [paymentId, req.labId, receiptNumber]
    );
    
    await client.query('COMMIT');
    
    // Emit socket event
    io.to(`lab_${req.labId}`).emit('paymentReceived', { orderId, amount });
    
    res.json({ 
      paymentId, 
      receiptId: receipt.rows[0].id, 
      receiptNumber 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
});
// Get receipt by payment ID
app.get('/api/payments/:paymentId/receipt', authenticate, async (req, res) => {
  const { paymentId } = req.params;
  try {
    const receipt = await pool.query(
      `SELECT id, receipt_number FROM receipts WHERE payment_id = $1 AND lab_id = $2`,
      [paymentId, req.labId]
    );
    
    if (receipt.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    res.json(receipt.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get receipt PDF with detailed logging
app.get('/api/receipts/:receiptId/pdf', authenticate, async (req, res) => {
  const { receiptId } = req.params;
  
  console.log('='.repeat(50));
  console.log('📄 RECEIPT PDF REQUEST');
  console.log('Receipt ID:', receiptId);
  console.log('Lab ID:', req.labId);
  console.log('User ID:', req.userId);
  
  try {
    // First, let's check if the receipts table exists and what columns it has
    const tableInfo = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'receipts'
    `);
    console.log('Receipts table columns:', tableInfo.rows);
    
    // Check payments table columns
    const paymentsTableInfo = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'payments'
    `);
    console.log('Payments table columns:', paymentsTableInfo.rows);
    
    // Now try to get the receipt data with a simpler query first
    console.log('Attempting to fetch receipt...');
    
    // Simpler query to test basic receipt access
    const simpleReceipt = await pool.query(
      `SELECT * FROM receipts WHERE id = $1 AND lab_id = $2`,
      [receiptId, req.labId]
    );
    
    console.log('Simple receipt query result:', simpleReceipt.rows.length > 0 ? 'Found' : 'Not found');
    if (simpleReceipt.rows.length > 0) {
      console.log('Receipt data:', simpleReceipt.rows[0]);
    } else {
      console.log('No receipt found with ID:', receiptId);
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    // Now try the full query with joins
    console.log('Attempting full query with joins...');
    
    const receipt = await pool.query(
      `SELECT 
        r.*, 
        p.amount, 
        p.payment_method, 
        p.mpesa_code, 
        p.created_at as payment_date,
        o.id as order_id, 
        o.total_amount,
        pt.name as patient_name, 
        pt.phone as patient_phone,
        l.name as lab_name, 
        l.address as lab_address, 
        l.phone as lab_phone,
        l.kra_pin as lab_kra_pin
       FROM receipts r
       LEFT JOIN payments p ON r.payment_id = p.id
       LEFT JOIN orders o ON p.order_id = o.id
       LEFT JOIN patients pt ON o.patient_id = pt.id
       LEFT JOIN labs l ON r.lab_id = l.id
       WHERE r.id = $1 AND r.lab_id = $2`,
      [receiptId, req.labId]
    );
    
    console.log('Full query result:', receipt.rows.length > 0 ? 'Found' : 'Not found');
    
    if (receipt.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt data incomplete' });
    }
    
    const data = receipt.rows[0];
    console.log('Receipt data retrieved for:', data.patient_name);
    console.log('Payment method:', data.payment_method);
    console.log('Amount:', data.amount);
    
    // Generate PDF
    try {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=receipt-${data.receipt_number}.pdf`);
      
      doc.pipe(res);
      
      // Add lab header
      doc.fontSize(20).text(data.lab_name || 'Lab', { align: 'center' });
      doc.fontSize(10).text(data.lab_address || 'Nairobi, Kenya', { align: 'center' });
      doc.fontSize(10).text(`Tel: ${data.lab_phone || 'N/A'}`, { align: 'center' });
      if (data.lab_kra_pin) {
        doc.fontSize(10).text(`KRA PIN: ${data.lab_kra_pin}`, { align: 'center' });
      }
      
      doc.moveDown();
      doc.fontSize(16).text('OFFICIAL RECEIPT', { align: 'center' });
      doc.moveDown();
      
      // Receipt details
      doc.fontSize(12);
      doc.text(`Receipt No: ${data.receipt_number}`);
      doc.text(`Date: ${data.payment_date ? new Date(data.payment_date).toLocaleString('en-KE') : 'N/A'}`);
      doc.text(`Order No: #${data.order_id || 'N/A'}`);
      doc.moveDown();
      
      doc.text(`Patient: ${data.patient_name || 'N/A'}`);
      doc.text(`Phone: ${data.patient_phone || 'N/A'}`);
      doc.moveDown();
      
      doc.text(`Payment Method: ${data.payment_method ? data.payment_method.toUpperCase() : 'N/A'}`);
      if (data.payment_method === 'mpesa' && data.mpesa_code) {
        doc.text(`M-PESA Code: ${data.mpesa_code}`);
      }
      doc.moveDown();
      
      // Amount
      doc.fontSize(14);
      doc.text(`Amount Paid: KES ${data.amount ? parseFloat(data.amount).toLocaleString() : '0'}`);
      doc.text(`Total Order: KES ${data.total_amount ? parseFloat(data.total_amount).toLocaleString() : '0'}`);
      
      doc.moveDown();
      doc.moveDown();
      
      // Footer
      doc.fontSize(10).text('This is a computer generated receipt', { align: 'center' });
      doc.text('Thank you for choosing ' + (data.lab_name || 'us'), { align: 'center' });
      
      doc.end();
      console.log('PDF generated successfully');
      
    } catch (pdfErr) {
      console.error('PDF generation error:', pdfErr);
      res.status(500).json({ error: 'PDF generation failed: ' + pdfErr.message });
    }
    
  } catch (err) {
    console.error('❌ Receipt PDF error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Get invoice PDF
app.get('/api/invoices/:invoiceId/pdf', authenticate, async (req, res) => {
  const { invoiceId } = req.params;
  try {
    const invoice = await pool.query(
      `SELECT i.*, p.name as patient_name, p.phone as patient_phone, p.address as patient_address,
        o.id as order_id, o.created_at as order_date,
        l.name as lab_name, l.address as lab_address, l.phone as lab_phone, l.kra_pin as lab_kra_pin,
        (SELECT json_agg(json_build_object('name', t.name, 'price', t.price))
         FROM order_tests ot
         JOIN tests t ON ot.test_id = t.id
         WHERE ot.order_id = o.id) as tests
       FROM invoices i
       JOIN orders o ON i.order_id = o.id
       JOIN patients p ON i.patient_id = p.id
       JOIN labs l ON i.lab_id = l.id
       WHERE i.id = $1 AND i.lab_id = $2`,
      [invoiceId, req.labId]
    );
    
    if (invoice.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const data = invoice.rows[0];
    
    // Generate PDF
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${data.invoice_number}.pdf`);
    
    doc.pipe(res);
    
    // Header
    doc.fontSize(20).text(data.lab_name, { align: 'center' });
    doc.fontSize(10).text(data.lab_address || 'Nairobi, Kenya', { align: 'center' });
    doc.fontSize(10).text(`Tel: ${data.lab_phone || 'N/A'}`, { align: 'center' });
    if (data.lab_kra_pin) {
      doc.fontSize(10).text(`KRA PIN: ${data.lab_kra_pin}`, { align: 'center' });
    }
    
    doc.moveDown();
    doc.fontSize(18).text('INVOICE', { align: 'center' });
    doc.moveDown();
    
    // Invoice details
    doc.fontSize(12);
    doc.text(`Invoice No: ${data.invoice_number}`);
    doc.text(`Date: ${new Date(data.created_at).toLocaleString('en-KE')}`);
    doc.text(`Due Date: ${new Date(data.due_date).toLocaleDateString('en-KE')}`);
    doc.text(`Order No: #${data.order_id}`);
    doc.moveDown();
    
    // Patient details
    doc.text(`Bill To:`);
    doc.text(`${data.patient_name}`);
    doc.text(`${data.patient_phone}`);
    if (data.patient_address) doc.text(`${data.patient_address}`);
    doc.moveDown();
    
    // Items table
    const tableTop = doc.y;
    doc.text('Description', 50, tableTop);
    doc.text('Amount (KES)', 400, tableTop, { align: 'right' });
    
    doc.moveDown();
    let y = doc.y + 10;
    
    if (data.tests) {
      data.tests.forEach(test => {
        doc.text(test.name, 50, y);
        doc.text(parseFloat(test.price).toLocaleString(), 400, y, { align: 'right' });
        y += 20;
      });
    }
    
    doc.moveDown();
    doc.moveDown();
    
    // Totals
    const totalY = y + 20;
    doc.text('Subtotal:', 300, totalY);
    doc.text(`KES ${parseFloat(data.subtotal).toLocaleString()}`, 400, totalY, { align: 'right' });
    
    if (data.tax > 0) {
      doc.text('VAT (16%):', 300, totalY + 20);
      doc.text(`KES ${parseFloat(data.tax).toLocaleString()}`, 400, totalY + 20, { align: 'right' });
    }
    
    if (data.discount > 0) {
      doc.text('Discount:', 300, totalY + 40);
      doc.text(`-KES ${parseFloat(data.discount).toLocaleString()}`, 400, totalY + 40, { align: 'right' });
    }
    
    doc.fontSize(14);
    doc.text('TOTAL:', 300, totalY + 60);
    doc.text(`KES ${parseFloat(data.total).toLocaleString()}`, 400, totalY + 60, { align: 'right' });
    
    doc.fontSize(10);
    doc.text(`Status: ${data.status.toUpperCase()}`, 50, totalY + 100);
    
    if (data.status === 'paid' && data.paid_at) {
      doc.text(`Paid on: ${new Date(data.paid_at).toLocaleDateString('en-KE')}`, 50, totalY + 120);
    }
    
    doc.moveDown();
    doc.moveDown();
    
    // Footer
    doc.fontSize(10).text('This is a computer generated invoice', { align: 'center' });
    doc.text('Thank you for your business', { align: 'center' });
    
    doc.end();
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get receipts for an order
app.get('/api/orders/:orderId/receipts', authenticate, async (req, res) => {
  const { orderId } = req.params;
  try {
    const receipts = await pool.query(
      `SELECT r.*, p.amount, p.payment_method, p.mpesa_code
       FROM receipts r
       JOIN payments p ON r.payment_id = p.id
       WHERE p.order_id = $1 AND r.lab_id = $2
       ORDER BY r.created_at DESC`,
      [orderId, req.labId]
    );
    res.json(receipts.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:orderId/payment', authenticate, async (req, res) => {
  const { orderId } = req.params;
  const { amount, method, mpesa_code, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query('SELECT total_amount, paid_amount FROM orders WHERE id = $1 AND lab_id = $2', [orderId, req.labId]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    
    const newPaid = parseFloat(order.rows[0].paid_amount) + amount;
    if (newPaid > order.rows[0].total_amount) {
      return res.status(400).json({ error: 'Payment exceeds total' });
    }
    
    // FIXED: Using backticks for the SQL string
    await client.query(
      `UPDATE orders SET paid_amount = $1, status = CASE WHEN $1 >= total_amount THEN 'completed' ELSE status END WHERE id = $2`, 
      [newPaid, orderId]
    );
    
    const payment = await client.query(
      'INSERT INTO payments (order_id, lab_id, amount, payment_method, mpesa_code, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [orderId, req.labId, amount, method, mpesa_code, notes]
    );
    
    const paymentId = payment.rows[0].id;
    const receiptNumber = `RCP-${Date.now()}`;
    const receipt = await client.query(
      'INSERT INTO receipts (payment_id, lab_id, receipt_number) VALUES ($1, $2, $3) RETURNING id',
      [paymentId, req.labId, receiptNumber]
    );
    
    await client.query('COMMIT');
    
    // Emit socket event
    const io = req.app.get('io');
    io.to(`lab_${req.labId}`).emit('paymentReceived', { orderId, amount });
    
    res.json({ 
      paymentId, 
      receiptId: receipt.rows[0].id, 
      receiptNumber 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// Helper function to log activities
const logActivity = async (labId, userId, action, entityType, entityId, details = {}) => {
  try {
    await pool.query(
      `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [labId, userId, action, entityType, entityId, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};

// When creating a lab
app.post('/api/labs', authenticate, async (req, res) => {
  // Check if user is super admin
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: 'Only super admin can create new labs' });
  }
  
  const { company_name, name, email, password, phone, address, website, subscription_plan, kra_pin, business_reg } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Insert the lab
    const labResult = await client.query(
      `INSERT INTO labs (company_name, name, phone, address, website, subscription_plan, subscription_status, kra_pin, business_reg) 
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8) 
       RETURNING *`,
      [company_name, name, phone, address, website, subscription_plan, kra_pin, business_reg]
    );
    
    const newLab = labResult.rows[0];
    
    // Hash the admin password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create the admin user for this lab
    const userResult = await client.query(
      `INSERT INTO users (lab_id, email, password_hash, name, role, permissions) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [newLab.id, email, hashedPassword, 'Lab Admin', 'admin', '{"can_delete": true, "can_manage_patients": true, "can_manage_tests": true}']
    );
    
    // Create subscription record
    const planPrices = {
      basic: 5000,
      professional: 15000,
      enterprise: 45000
    };
    
    await client.query(
      `INSERT INTO subscriptions (lab_id, plan_name, price, billing_cycle, start_date) 
       VALUES ($1, $2, $3, 'monthly', CURRENT_DATE)`,
      [newLab.id, subscription_plan, planPrices[subscription_plan] || 0]
    );
    
    await client.query('COMMIT');
    
    // Log activity
    try {
      await pool.query(
        `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.labId, req.userId, 'LAB_CREATED', 'lab', newLab.id, JSON.stringify({ name: company_name })]
      );
    } catch (logErr) {
      console.error('Error logging activity:', logErr);
    }
    
    res.status(201).json({ 
      success: true, 
      lab: newLab,
      message: 'Lab registered successfully' 
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating lab:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// When adding a patient
app.post('/api/patients', authenticate, async (req, res) => {
  const { name, phone, email, address, date_of_birth, gender, blood_group, id_number, emergency_contact, emergency_phone } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO patients (lab_id, name, phone, email, address, date_of_birth, gender, blood_group, id_number, emergency_contact, emergency_phone) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING *`,
      [req.labId, name, phone, email, address, date_of_birth, gender, blood_group, id_number, emergency_contact, emergency_phone]
    );
    
    // Log activity
    try {
      await pool.query(
        `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.labId, req.userId, 'PATIENT_CREATED', 'patient', result.rows[0].id, JSON.stringify({ name })]
      );
    } catch (logErr) {
      console.error('Error logging activity:', logErr);
    }
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating patient:', err);
    res.status(500).json({ error: err.message });
  }
});

// When adding a test
app.post('/api/tests', authenticate, async (req, res) => {
  const { name, category, price, description, turnaround_time, sample_type } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO tests (lab_id, name, category, price, description, turnaround_time, sample_type) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [req.labId, name, category, price, description, turnaround_time, sample_type]
    );
    
    // Log activity
    try {
      await pool.query(
        `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.labId, req.userId, 'TEST_CREATED', 'test', result.rows[0].id, JSON.stringify({ name })]
      );
    } catch (logErr) {
      console.error('Error logging activity:', logErr);
    }
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating test:', err);
    res.status(500).json({ error: err.message });
  }
});

// When creating an order
app.post('/api/orders', authenticate, async (req, res) => {
  const { patientId, testIds, notes, doctor_name, doctor_email, priority, totalAmount } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query(
      `INSERT INTO orders (lab_id, patient_id, total_amount, notes, doctor_name, doctor_email, priority, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING id`,
      [req.labId, patientId, totalAmount, notes, doctor_name, doctor_email, priority]
    );
    const orderId = order.rows[0].id;
    
    for (let testId of testIds) {
      await client.query(
        'INSERT INTO order_tests (order_id, test_id) VALUES ($1, $2)',
        [orderId, testId]
      );
    }
    
    await client.query('COMMIT');
    
    // Log activity
    try {
      await pool.query(
        `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.labId, req.userId, 'ORDER_CREATED', 'order', orderId, JSON.stringify({ patientId })]
      );
    } catch (logErr) {
      console.error('Error logging activity:', logErr);
    }
    
    res.status(201).json({ orderId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// When adding payment
app.post('/api/orders/:orderId/payment', authenticate, async (req, res) => {
  const { orderId } = req.params;
  const { amount, method, mpesa_code, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query('SELECT total_amount, paid_amount FROM orders WHERE id = $1 AND lab_id = $2', [orderId, req.labId]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    
    const newPaid = parseFloat(order.rows[0].paid_amount) + amount;
    if (newPaid > order.rows[0].total_amount) {
      return res.status(400).json({ error: 'Payment exceeds total' });
    }
    
    await client.query(
      `UPDATE orders SET paid_amount = $1, status = CASE WHEN $1 >= total_amount THEN 'completed' ELSE status END WHERE id = $2`, 
      [newPaid, orderId]
    );
    
    const payment = await client.query(
      'INSERT INTO payments (order_id, lab_id, amount, payment_method, mpesa_code, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [orderId, req.labId, amount, method, mpesa_code, notes]
    );
    
    const paymentId = payment.rows[0].id;
    const receiptNumber = `RCP-${Date.now()}`;
    const receipt = await client.query(
      'INSERT INTO receipts (payment_id, lab_id, receipt_number) VALUES ($1, $2, $3) RETURNING id',
      [paymentId, req.labId, receiptNumber]
    );
    
    await client.query('COMMIT');
    
    // Emit socket event
    io.to(`lab_${req.labId}`).emit('paymentReceived', { orderId, amount });
    
    // Log activity
    try {
      await pool.query(
        `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.labId, req.userId, 'PAYMENT_ADDED', 'payment', paymentId, JSON.stringify({ amount, method })]
      );
    } catch (logErr) {
      console.error('Error logging activity:', logErr);
    }
    
    res.json({ 
      paymentId, 
      receiptId: receipt.rows[0].id, 
      receiptNumber 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Payment error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get tests for a specific order
app.get('/api/orders/:orderId/tests', authenticate, async (req, res) => {
  const { orderId } = req.params;
  try {
    const tests = await pool.query(
      `SELECT t.*, ot.result_value, ot.result_unit, ot.reference_range, 
        ot.is_abnormal, ot.test_notes, ot.result_status, ot.id as order_test_id
       FROM order_tests ot
       JOIN tests t ON ot.test_id = t.id
       WHERE ot.order_id = $1`,
      [orderId]
    );
    res.json(tests.rows);
  } catch (err) {
    console.error('Error fetching order tests:', err);
    res.status(500).json({ error: err.message });
  }
});
// Get tests for a specific order (your existing endpoint - GOOD!)
app.get('/api/orders/:orderId/tests', authenticate, async (req, res) => {
  const { orderId } = req.params;
  try {
    const tests = await pool.query(
      `SELECT t.*, ot.result_value, ot.result_unit, ot.reference_range, 
        ot.is_abnormal, ot.test_notes, ot.result_status, ot.id as order_test_id
       FROM order_tests ot
       JOIN tests t ON ot.test_id = t.id
       WHERE ot.order_id = $1`,
      [orderId]
    );
    res.json(tests.rows);
  } catch (err) {
    console.error('Error fetching order tests:', err);
    res.status(500).json({ error: err.message });
  }
});

// Send results to clinician (email/SMS)
app.post('/api/orders/:orderId/send-results', authenticate, async (req, res) => {
  const { orderId } = req.params;
  const { feedback, results } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get order details with patient info
    const order = await client.query(
      `SELECT o.*, 
        p.name as patient_name, p.phone as patient_phone,
        l.name as lab_name, l.phone as lab_phone, l.email as lab_email
       FROM orders o
       JOIN patients p ON o.patient_id = p.id
       JOIN labs l ON o.lab_id = l.id
       WHERE o.id = $1 AND o.lab_id = $2`,
      [orderId, req.labId]
    );
    
    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const orderData = order.rows[0];
    
    // Save feedback to database (if you have a feedback table)
    // This is optional - you can skip if no table exists
    
    await client.query('COMMIT');
    
    // Here you would implement actual email/SMS sending
    // For now, just return success
    res.json({ 
      success: true, 
      message: 'Results prepared for sending',
      email: feedback.sendEmail ? 'Ready to send' : 'Not requested',
      sms: feedback.sendSMS ? 'Ready to send' : 'Not requested'
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error sending results:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// Get results for an order (only tests with results)
app.get('/api/orders/:orderId/results', authenticate, async (req, res) => {
  const { orderId } = req.params;
  try {
    const results = await pool.query(
      `SELECT 
        ot.id,
        ot.order_id,
        ot.test_id,
        ot.result_value,
        ot.result_unit,
        ot.reference_range,
        ot.is_abnormal,
        ot.test_notes,
        ot.result_status,
        ot.tested_at,
        ot.verified_at,
        ot.tested_by,
        ot.verified_by,
        t.name as test_name,
        t.category,
        t.sample_type
       FROM order_tests ot
       JOIN tests t ON ot.test_id = t.id
       WHERE ot.order_id = $1 AND ot.result_value IS NOT NULL
       ORDER BY t.category, t.name`,
      [orderId]
    );
    
    console.log(`Found ${results.rows.length} results for order ${orderId}`);
    res.json(results.rows);
    
  } catch (err) {
    console.error('Error fetching results:', err);
    res.status(500).json({ 
      error: 'Failed to fetch results',
      details: err.message 
    });
  }
});
// Update patient
app.put('/api/patients/:patientId', authenticate, async (req, res) => {
  const { patientId } = req.params;
  const { name, phone, email, address, date_of_birth, gender, blood_group, id_number, emergency_contact, emergency_phone } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE patients 
       SET name = $1, phone = $2, email = $3, address = $4, date_of_birth = $5, 
           gender = $6, blood_group = $7, id_number = $8, emergency_contact = $9, emergency_phone = $10,
           updated_at = NOW()
       WHERE id = $11 AND lab_id = $12
       RETURNING *`,
      [name, phone, email, address, date_of_birth, gender, blood_group, id_number, emergency_contact, emergency_phone, patientId, req.labId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update test
app.put('/api/tests/:testId', authenticate, async (req, res) => {
  const { testId } = req.params;
  const { name, category, price, description, turnaround_time, sample_type } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE tests 
       SET name = $1, category = $2, price = $3, description = $4, 
           turnaround_time = $5, sample_type = $6, updated_at = NOW()
       WHERE id = $7 AND lab_id = $8
       RETURNING *`,
      [name, category, price, description, turnaround_time, sample_type, testId, req.labId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Get all users in current lab
app.get('/api/users', authenticate, async (req, res) => {
  try {
    const users = await pool.query(
      `SELECT id, email, name, role, permissions, created_at 
       FROM users 
       WHERE lab_id = $1 
       ORDER BY created_at DESC`,
      [req.labId]
    );
    res.json(users.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new user (admin only)
app.post('/api/users', authenticate, authorize(['admin']), async (req, res) => {
  const { email, password, name, role, permissions } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    const result = await pool.query(
      `INSERT INTO users (lab_id, email, password_hash, name, role, permissions) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role`,
      [req.labId, email, hashedPassword, name, role, permissions || {}]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user role/permissions
app.put('/api/users/:userId', authenticate, authorize(['admin']), async (req, res) => {
  const { userId } = req.params;
  const { role, permissions } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE users SET role = $1, permissions = $2 WHERE id = $3 AND lab_id = $4 RETURNING id, email, role',
      [role, permissions, userId, req.labId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user (admin only)
app.delete('/api/users/:userId', authenticate, authorize(['admin']), async (req, res) => {
  const { userId } = req.params;
  
  try {
    await pool.query('DELETE FROM users WHERE id = $1 AND lab_id = $2', [userId, req.labId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Backup database (admin only)
app.get('/api/backup', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const tables = ['labs', 'users', 'patients', 'tests', 'orders', 'order_tests', 'payments', 'receipts', 'invoices', 'doctor_feedback', 'activity_logs', 'subscriptions'];
    const backup = {
      lab_id: req.labId,
      exported_at: new Date().toISOString(),
      exported_by: req.userId,
      data: {}
    };
    
    for (const table of tables) {
      // Check if table exists
      const tableCheck = await pool.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
        [table]
      );
      
      if (tableCheck.rows[0].exists) {
        // Get columns for this table
        const columns = await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
          [table]
        );
        
        const hasLabId = columns.rows.some(col => col.column_name === 'lab_id');
        
        if (hasLabId) {
          const result = await pool.query(`SELECT * FROM ${table} WHERE lab_id = $1`, [req.labId]);
          backup.data[table] = result.rows;
        } else {
          const result = await pool.query(`SELECT * FROM ${table}`);
          backup.data[table] = result.rows;
        }
      } else {
        backup.data[table] = [];
      }
    }
    
    // Log the backup
    try {
      await pool.query(
        `INSERT INTO export_logs (lab_id, user_id, export_type, file_name, record_count) 
         VALUES ($1, $2, $3, $4, $5)`,
        [req.labId, req.userId, 'backup', `backup_${Date.now()}.json`, 
         Object.values(backup.data).reduce((acc, arr) => acc + arr.length, 0)]
      );
    } catch (logErr) {
      console.error('Error logging backup:', logErr);
      // Continue even if logging fails
    }
    
    const fileName = `backup_${req.labId}_${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.json(backup);
    
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Export data to CSV
app.get('/api/export/:type', authenticate, async (req, res) => {
  const { type } = req.params;
  const { format = 'csv' } = req.query;
  
  // Validate export type
  const validTypes = ['patients', 'tests', 'orders', 'payments', 'invoices'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid export type. Valid types: ' + validTypes.join(', ') });
  }
  
  try {
    let query = '';
    let fileName = '';
    
    switch(type) {
      case 'patients':
        query = 'SELECT * FROM patients WHERE lab_id = $1 ORDER BY created_at DESC';
        fileName = `patients_${Date.now()}.csv`;
        break;
      case 'tests':
        query = 'SELECT * FROM tests WHERE lab_id = $1 ORDER BY category, name';
        fileName = `tests_${Date.now()}.csv`;
        break;
      case 'orders':
        query = `SELECT o.*, p.name as patient_name, p.phone as patient_phone 
                 FROM orders o 
                 JOIN patients p ON o.patient_id = p.id 
                 WHERE o.lab_id = $1 
                 ORDER BY o.created_at DESC`;
        fileName = `orders_${Date.now()}.csv`;
        break;
      case 'payments':
        query = `SELECT p.*, o.patient_id, pt.name as patient_name 
                 FROM payments p
                 JOIN orders o ON p.order_id = o.id
                 JOIN patients pt ON o.patient_id = pt.id
                 WHERE p.lab_id = $1 
                 ORDER BY p.created_at DESC`;
        fileName = `payments_${Date.now()}.csv`;
        break;
      case 'invoices':
        query = `SELECT i.*, pt.name as patient_name 
                 FROM invoices i
                 JOIN patients pt ON i.patient_id = pt.id
                 WHERE i.lab_id = $1 
                 ORDER BY i.created_at DESC`;
        fileName = `invoices_${Date.now()}.csv`;
        break;
    }
    
    const result = await pool.query(query, [req.labId]);
    
    if (format === 'csv') {
      // Convert to CSV
      const csv = jsonToCsv(result.rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.send(csv);
    } else {
      res.json(result.rows);
    }
    
    // Log export
    try {
      await pool.query(
        'INSERT INTO export_logs (lab_id, user_id, export_type, file_name, record_count) VALUES ($1, $2, $3, $4, $5)',
        [req.labId, req.userId, type, fileName, result.rows.length]
      );
    } catch (logErr) {
      console.error('Error logging export:', logErr);
    }
    
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function to convert JSON to CSV
function jsonToCsv(json) {
  if (!json || json.length === 0) return '';
  
  const headers = Object.keys(json[0]);
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Add rows
  for (const row of json) {
    const values = headers.map(header => {
      const value = row[header]?.toString() || '';
      // Escape quotes and wrap in quotes if contains comma or quote
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}
// Helper function to convert JSON to CSV
function jsonToCsv(json) {
  if (json.length === 0) return '';
  
  const headers = Object.keys(json[0]);
  const csvRows = [];
  
  csvRows.push(headers.join(','));
  
  for (const row of json) {
    const values = headers.map(header => {
      const value = row[header]?.toString() || '';
      return `"${value.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}
// Delete patient
app.delete('/api/patients/:patientId', authenticate, async (req, res) => {
  const { patientId } = req.params;
  
  // Check permissions
  if (req.userRole !== 'admin' && !req.userPermissions?.can_delete) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  try {
    await pool.query('DELETE FROM patients WHERE id = $1 AND lab_id = $2', [patientId, req.labId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete test
app.delete('/api/tests/:testId', authenticate, async (req, res) => {
  const { testId } = req.params;
  
  if (req.userRole !== 'admin' && !req.userPermissions?.can_delete) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  try {
    await pool.query('DELETE FROM tests WHERE id = $1 AND lab_id = $2', [testId, req.labId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete order
app.delete('/api/orders/:orderId', authenticate, async (req, res) => {
  const { orderId } = req.params;
  
  if (req.userRole !== 'admin' && !req.userPermissions?.can_delete) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete related records
    await client.query('DELETE FROM order_tests WHERE order_id = $1', [orderId]);
    await client.query('DELETE FROM payments WHERE order_id = $1', [orderId]);
    await client.query('DELETE FROM invoices WHERE order_id = $1', [orderId]);
    await client.query('DELETE FROM doctor_feedback WHERE order_id = $1', [orderId]);
    await client.query('DELETE FROM orders WHERE id = $1 AND lab_id = $2', [orderId, req.labId]);
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// Delete lab - ONLY SUPER ADMIN
app.delete('/api/labs/:labId', authenticate, async (req, res) => {
  // Check if user is super admin
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: 'Only super admin can delete labs' });
  }
  
  const { labId } = req.params;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get lab info for logging
    const lab = await client.query('SELECT name, company_name FROM labs WHERE id = $1', [labId]);
    
    if (lab.rows.length === 0) {
      return res.status(404).json({ error: 'Lab not found' });
    }
    
    // Delete all related data (cascading delete)
    await client.query('DELETE FROM receipts WHERE payment_id IN (SELECT id FROM payments WHERE lab_id = $1)', [labId]);
    await client.query('DELETE FROM payments WHERE lab_id = $1', [labId]);
    await client.query('DELETE FROM order_tests WHERE order_id IN (SELECT id FROM orders WHERE lab_id = $1)', [labId]);
    await client.query('DELETE FROM doctor_feedback WHERE order_id IN (SELECT id FROM orders WHERE lab_id = $1)', [labId]);
    await client.query('DELETE FROM invoices WHERE order_id IN (SELECT id FROM orders WHERE lab_id = $1)', [labId]);
    await client.query('DELETE FROM orders WHERE lab_id = $1', [labId]);
    await client.query('DELETE FROM tests WHERE lab_id = $1', [labId]);
    await client.query('DELETE FROM patients WHERE lab_id = $1', [labId]);
    await client.query('DELETE FROM users WHERE lab_id = $1', [labId]);
    await client.query('DELETE FROM subscriptions WHERE lab_id = $1', [labId]);
    await client.query('DELETE FROM activity_logs WHERE lab_id = $1', [labId]);
    await client.query('DELETE FROM labs WHERE id = $1', [labId]);
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: `Lab "${lab.rows[0].company_name || lab.rows[0].name}" has been permanently deleted` 
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting lab:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Save test result (for a single test) - UPDATED TO MATCH FRONTEND
app.post('/api/orders/:orderId/tests/:testId/result', authenticate, async (req, res) => {
  const { orderId, testId } = req.params;
  const { 
    result_value, 
    result_unit, 
    reference_range, 
    is_abnormal, 
    test_notes, 
    result_status,
    performed_by 
  } = req.body;
  
  // 🔍 DETAILED DEBUG LOGS
  console.log('\n' + '='.repeat(60));
  console.log('📝 SAVING TEST RESULT');
  console.log('Order ID:', orderId);
  console.log('Test ID:', testId);
  console.log('Request Body:', JSON.stringify(req.body, null, 2));
  console.log('User ID:', req.userId);
  console.log('Lab ID:', req.labId);
  console.log('='.repeat(60));
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // First, check if the test exists
    console.log('🔍 Checking if test exists...');
    const testCheck = await client.query(
      'SELECT id FROM order_tests WHERE order_id = $1 AND test_id = $2',
      [orderId, testId]
    );
    
    if (testCheck.rows.length === 0) {
      console.log('❌ Test not found in this order');
      return res.status(404).json({ error: 'Test not found in this order' });
    }
    console.log('✅ Test found, ID:', testCheck.rows[0].id);
    
    // Log the values we're about to update
    console.log('📤 Updating with values:', {
      result_value,
      result_unit,
      reference_range,
      is_abnormal,
      test_notes,
      result_status: result_status || 'completed',
      performed_by: performed_by || 'Lab Technician',
      orderId,
      testId
    });
    
    // Update the test result
    const updateResult = await client.query(
      `UPDATE order_tests 
       SET result_value = $1, 
           result_unit = $2, 
           reference_range = $3, 
           is_abnormal = $4, 
           test_notes = $5, 
           result_status = $6,
           tested_by = $7,
           tested_at = NOW(),
           updated_at = NOW()
       WHERE order_id = $8 AND test_id = $9
       RETURNING id, result_value, result_unit, is_abnormal`,
      [result_value, result_unit, reference_range, is_abnormal, test_notes, result_status || 'completed', performed_by || 'Lab Technician', orderId, testId]
    );
    
    if (updateResult.rows.length === 0) {
      console.log('❌ Failed to update test result - no rows returned');
      return res.status(404).json({ error: 'Failed to update test result' });
    }
    
    console.log('✅ Update successful:', updateResult.rows[0]);
    
    // Log activity
    try {
      await client.query(
        `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.labId, req.userId, 'RESULT_ADDED', 'test_result', testId, JSON.stringify({ orderId, testId, result_value })]
      );
      console.log('✅ Activity logged');
    } catch (logErr) {
      console.error('⚠️ Error logging activity (non-fatal):', logErr.message);
      // Continue even if logging fails
    }
    
    await client.query('COMMIT');
    console.log('✅ Transaction committed successfully!');
    
    // Emit socket event
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`lab_${req.labId}`).emit('resultUpdated', { orderId, testId });
        console.log('✅ Socket event emitted');
      }
    } catch (socketErr) {
      console.error('⚠️ Socket error (non-fatal):', socketErr.message);
    }
    
    res.json({ success: true, message: 'Result saved successfully' });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌❌❌ ERROR SAVING TEST RESULT ❌❌❌');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error code:', err.code);
    console.error('Error detail:', err.detail);
    console.error('Error hint:', err.hint);
    console.error('Error position:', err.position);
    console.error('Error stack:', err.stack);
    
    // Check for specific PostgreSQL error codes
    if (err.code === '23502') {
      res.status(500).json({ error: 'Database constraint violation - missing required field' });
    } else if (err.code === '23503') {
      res.status(500).json({ error: 'Foreign key violation' });
    } else if (err.code === '23505') {
      res.status(500).json({ error: 'Duplicate key violation' });
    } else if (err.code === '22P02') {
      res.status(500).json({ error: 'Invalid data type' });
    } else {
      res.status(500).json({ error: err.message });
    }
  } finally {
    client.release();
  }
});
// Backup database (admin only)
app.get('/api/backup', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const tables = ['labs', 'users', 'patients', 'tests', 'orders', 'order_tests', 'payments', 'receipts', 'invoices', 'doctor_feedback', 'activity_logs', 'subscriptions'];
    const backup = {
      lab_id: req.labId,
      exported_at: new Date().toISOString(),
      exported_by: req.userId,
      data: {}
    };
    
    for (const table of tables) {
      // Check if table exists
      const tableCheck = await pool.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
        [table]
      );
      
      if (tableCheck.rows[0].exists) {
        // For tables with lab_id, filter by lab_id
        let query = `SELECT * FROM ${table}`;
        const columns = await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
          [table]
        );
        
        const hasLabId = columns.rows.some(col => col.column_name === 'lab_id');
        
        if (hasLabId) {
          query += ` WHERE lab_id = $1`;
          const result = await pool.query(query, [req.labId]);
          backup.data[table] = result.rows;
        } else {
          // Tables without lab_id (like system tables) - include all
          const result = await pool.query(query);
          backup.data[table] = result.rows;
        }
      } else {
        backup.data[table] = [];
      }
    }
    
    // Log the backup
    await pool.query(
      `INSERT INTO export_logs (lab_id, user_id, export_type, file_name, record_count) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.labId, req.userId, 'backup', `backup_${Date.now()}.json`, Object.values(backup.data).reduce((acc, arr) => acc + arr.length, 0)]
    );
    
    const fileName = `backup_${req.labId}_${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.json(backup);
    
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Restore from backup (admin only)
app.post('/api/restore', authenticate, authorize(['admin']), async (req, res) => {
  const backup = req.body;
  
  if (!backup || !backup.data) {
    return res.status(400).json({ error: 'Invalid backup file' });
  }
  
  // Verify this backup belongs to this lab
  if (backup.lab_id && backup.lab_id !== req.labId) {
    return res.status(403).json({ error: 'Backup belongs to a different lab' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const results = {
      restored: {},
      errors: [],
      skipped: []
    };
    
    // Define restoration order (respect foreign keys)
    const restoreOrder = [
      'labs', 'users', 'patients', 'tests', 'orders', 
      'order_tests', 'payments', 'receipts', 'invoices', 
      'doctor_feedback', 'activity_logs', 'subscriptions'
    ];
    
    // First, clear existing data for this lab (optional - you might want to keep this)
    // Uncomment if you want to clear before restore
    /*
    for (const table of restoreOrder) {
      const columns = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
        [table]
      );
      
      const hasLabId = columns.rows.some(col => col.column_name === 'lab_id');
      
      if (hasLabId) {
        await client.query(`DELETE FROM ${table} WHERE lab_id = $1`, [req.labId]);
      }
    }
    */
    
    for (const table of restoreOrder) {
      if (backup.data[table] && backup.data[table].length > 0) {
        let restoredCount = 0;
        
        for (const row of backup.data[table]) {
          try {
            // Remove id to let database generate new one
            const { id, ...dataWithoutId } = row;
            
            // Ensure lab_id is correct for this lab
            if (dataWithoutId.lab_id && dataWithoutId.lab_id !== req.labId) {
              dataWithoutId.lab_id = req.labId;
            }
            
            const columns = Object.keys(dataWithoutId);
            const values = Object.values(dataWithoutId);
            
            if (columns.length === 0) {
              results.skipped.push({ table, reason: 'No data columns' });
              continue;
            }
            
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
            
            const insertQuery = `INSERT INTO ${table} (${columns.join(', ')}) 
                                 VALUES (${placeholders}) RETURNING id`;
            
            const insertResult = await client.query(insertQuery, values);
            restoredCount++;
            
          } catch (rowErr) {
            console.error(`Error restoring row in ${table}:`, rowErr.message);
            results.errors.push({ 
              table, 
              error: rowErr.message,
              row: JSON.stringify(row).substring(0, 100) // Truncate for readability
            });
            // Continue with next row instead of aborting entire transaction
          }
        }
        
        if (restoredCount > 0) {
          results.restored[table] = restoredCount;
        }
      }
    }
    
    // Log the restore
    try {
      await client.query(
        `INSERT INTO export_logs (lab_id, user_id, export_type, file_name, record_count) 
         VALUES ($1, $2, $3, $4, $5)`,
        [req.labId, req.userId, 'restore', 'restore_from_backup.json', 
         Object.values(results.restored).reduce((acc, count) => acc + count, 0)]
      );
    } catch (logErr) {
      console.error('Error logging restore:', logErr);
      // Don't fail the restore if logging fails
    }
    
    await client.query('COMMIT');
    
    const totalRestored = Object.values(results.restored).reduce((acc, count) => acc + count, 0);
    
    res.json({ 
      success: true, 
      message: `Restore completed. Restored ${totalRestored} records.`,
      results 
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Restore error:', err);
    res.status(500).json({ 
      error: 'Restore failed: ' + err.message,
      detail: 'The transaction has been rolled back.'
    });
  } finally {
    client.release();
  }
});
// Get export logs
app.get('/api/export-logs', authenticate, async (req, res) => {
  try {
    const logs = await pool.query(
      `SELECT el.*, u.name as user_name, u.email as user_email
       FROM export_logs el
       LEFT JOIN users u ON el.user_id = u.id
       WHERE el.lab_id = $1 
       ORDER BY el.created_at DESC 
       LIMIT 50`,
      [req.labId]
    );
    res.json(logs.rows);
  } catch (err) {
    console.error('Error fetching export logs:', err);
    res.status(500).json({ error: err.message });
  }
});
// Get single export log
app.get('/api/export-logs/:logId', authenticate, async (req, res) => {
  const { logId } = req.params;
  try {
    const log = await pool.query(
      'SELECT * FROM export_logs WHERE id = $1 AND lab_id = $2',
      [logId, req.labId]
    );
    
    if (log.rows.length === 0) {
      return res.status(404).json({ error: 'Export log not found' });
    }
    
    res.json(log.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete old export logs (optional, for cleanup)
app.delete('/api/export-logs/cleanup', authenticate, authorize(['admin']), async (req, res) => {
  const { days = 30 } = req.query; // Keep last 30 days by default
  
  try {
    const result = await pool.query(
      'DELETE FROM export_logs WHERE lab_id = $1 AND created_at < NOW() - $2::interval',
      [req.labId, `${days} days`]
    );
    
    res.json({ 
      success: true, 
      deleted: result.rowCount,
      message: `Deleted ${result.rowCount} old export logs` 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ============ POS ENDPOINTS ============

// Get all products
app.get('/api/products', authenticate, async (req, res) => {
  try {
    const products = await pool.query(
      `SELECT * FROM products 
       WHERE lab_id = $1 AND is_active = true 
       ORDER BY category, name`,
      [req.labId]
    );
    res.json(products.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get low stock products
app.get('/api/products/low-stock', authenticate, async (req, res) => {
  try {
    const products = await pool.query(
      `SELECT * FROM products 
       WHERE lab_id = $1 AND is_active = true 
       AND stock_quantity <= low_stock_threshold 
       ORDER BY stock_quantity ASC`,
      [req.labId]
    );
    res.json(products.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new product
app.post('/api/products', authenticate, async (req, res) => {
  const { name, description, sku, barcode, category, price, cost_price, tax_rate, stock_quantity, low_stock_threshold, unit } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO products (lab_id, name, description, sku, barcode, category, price, cost_price, tax_rate, stock_quantity, low_stock_threshold, unit) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
      [req.labId, name, description, sku, barcode, category, price, cost_price, tax_rate || 0, stock_quantity || 0, low_stock_threshold || 10, unit || 'piece']
    );
    
    // Log activity
    try {
      await pool.query(
        `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.labId, req.userId, 'PRODUCT_CREATED', 'product', result.rows[0].id, JSON.stringify({ name })]
      );
    } catch (logErr) {
      console.error('Error logging activity:', logErr);
    }
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update product
app.put('/api/products/:productId', authenticate, async (req, res) => {
  const { productId } = req.params;
  const { name, description, sku, barcode, category, price, cost_price, tax_rate, low_stock_threshold, unit, is_active } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE products 
       SET name = $1, description = $2, sku = $3, barcode = $4, category = $5, 
           price = $6, cost_price = $7, tax_rate = $8, low_stock_threshold = $9, 
           unit = $10, is_active = $11, updated_at = NOW()
       WHERE id = $12 AND lab_id = $13
       RETURNING *`,
      [name, description, sku, barcode, category, price, cost_price, tax_rate, low_stock_threshold, unit, is_active, productId, req.labId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update stock
app.post('/api/products/:productId/stock', authenticate, async (req, res) => {
  const { productId } = req.params;
  const { quantity, transaction_type, notes } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get current stock
    const product = await client.query(
      'SELECT stock_quantity, name FROM products WHERE id = $1 AND lab_id = $2',
      [productId, req.labId]
    );
    
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const previousStock = product.rows[0].stock_quantity;
    const newStock = previousStock + quantity;
    
    if (newStock < 0) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    // Update product stock
    await client.query(
      'UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2',
      [newStock, productId]
    );
    
    // Record inventory transaction
    await client.query(
      `INSERT INTO inventory_transactions (lab_id, product_id, user_id, transaction_type, quantity, previous_stock, new_stock, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.labId, productId, req.userId, transaction_type, quantity, previousStock, newStock, notes]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      product_id: productId,
      previous_stock: previousStock,
      new_stock: newStock,
      transaction_type
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating stock:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get active cart for current user
app.get('/api/pos/cart', authenticate, async (req, res) => {
  try {
    const cart = await pool.query(
      `SELECT * FROM pos_carts 
       WHERE lab_id = $1 AND user_id = $2 AND status = 'active' 
       ORDER BY created_at DESC LIMIT 1`,
      [req.labId, req.userId]
    );
    
    if (cart.rows.length === 0) {
      // Create new cart
      const newCart = await pool.query(
        `INSERT INTO pos_carts (lab_id, user_id) 
         VALUES ($1, $2) RETURNING *`,
        [req.labId, req.userId]
      );
      res.json(newCart.rows[0]);
    } else {
      res.json(cart.rows[0]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add item to cart
app.post('/api/pos/cart/items', authenticate, async (req, res) => {
  const { product_id, quantity } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get product details
    const product = await client.query(
      'SELECT * FROM products WHERE id = $1 AND lab_id = $2 AND is_active = true',
      [product_id, req.labId]
    );
    
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    if (product.rows[0].stock_quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    // Get active cart
    const cart = await client.query(
      'SELECT * FROM pos_carts WHERE lab_id = $1 AND user_id = $2 AND status = $3',
      [req.labId, req.userId, 'active']
    );
    
    let cartId;
    let items = [];
    
    if (cart.rows.length === 0) {
      // Create new cart
      const newCart = await client.query(
        'INSERT INTO pos_carts (lab_id, user_id) VALUES ($1, $2) RETURNING id',
        [req.labId, req.userId]
      );
      cartId = newCart.rows[0].id;
    } else {
      cartId = cart.rows[0].id;
      items = cart.rows[0].items || [];
    }
    
    // Check if item already in cart
    const existingItemIndex = items.findIndex(item => item.product_id === product_id);
    
    const itemTotal = product.rows[0].price * quantity;
    const taxAmount = itemTotal * (product.rows[0].tax_rate / 100);
    
    if (existingItemIndex >= 0) {
      // Update existing item
      items[existingItemIndex].quantity += quantity;
      items[existingItemIndex].total = items[existingItemIndex].quantity * product.rows[0].price;
    } else {
      // Add new item
      items.push({
        product_id,
        name: product.rows[0].name,
        quantity,
        unit_price: product.rows[0].price,
        tax_rate: product.rows[0].tax_rate,
        total: itemTotal
      });
    }
    
    // Recalculate cart totals
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxTotal = items.reduce((sum, item) => sum + (item.total * (item.tax_rate / 100)), 0);
    const total = subtotal + taxTotal;
    
    // Update cart
    await client.query(
      `UPDATE pos_carts 
       SET items = $1, subtotal = $2, tax_total = $3, total = $4, updated_at = NOW() 
       WHERE id = $5`,
      [JSON.stringify(items), subtotal, taxTotal, total, cartId]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      cart_id: cartId,
      items,
      subtotal,
      tax_total: taxTotal,
      total
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding to cart:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Remove item from cart
app.delete('/api/pos/cart/items/:productId', authenticate, async (req, res) => {
  const { productId } = req.params;
  
  try {
    const cart = await pool.query(
      'SELECT * FROM pos_carts WHERE lab_id = $1 AND user_id = $2 AND status = $3',
      [req.labId, req.userId, 'active']
    );
    
    if (cart.rows.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    let items = cart.rows[0].items || [];
    items = items.filter(item => item.product_id != productId);
    
    // Recalculate totals
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxTotal = items.reduce((sum, item) => sum + (item.total * (item.tax_rate / 100)), 0);
    const total = subtotal + taxTotal;
    
    await pool.query(
      `UPDATE pos_carts 
       SET items = $1, subtotal = $2, tax_total = $3, total = $4, updated_at = NOW() 
       WHERE id = $5`,
      [JSON.stringify(items), subtotal, taxTotal, total, cart.rows[0].id]
    );
    
    res.json({ 
      success: true, 
      items,
      subtotal,
      tax_total: taxTotal,
      total
    });
    
  } catch (err) {
    console.error('Error removing from cart:', err);
    res.status(500).json({ error: err.message });
  }
});

// Checkout - complete sale
app.post('/api/pos/checkout', authenticate, async (req, res) => {
  const { customer_name, customer_phone, customer_email, payment_method, mpesa_code, discount, notes } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get active cart
    const cart = await client.query(
      'SELECT * FROM pos_carts WHERE lab_id = $1 AND user_id = $2 AND status = $3',
      [req.labId, req.userId, 'active']
    );
    
    if (cart.rows.length === 0) {
      return res.status(404).json({ error: 'No active cart found' });
    }
    
    const cartData = cart.rows[0];
    let items = [];
    
    try {
      items = typeof cartData.items === 'string' ? JSON.parse(cartData.items) : cartData.items || [];
    } catch (e) {
      items = cartData.items || [];
    }
    
    if (items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    
    // Verify stock for all items
    for (const item of items) {
      const product = await client.query(
        'SELECT stock_quantity FROM products WHERE id = $1 AND lab_id = $2',
        [item.product_id, req.labId]
      );
      
      if (product.rows.length === 0 || Number(product.rows[0].stock_quantity) < Number(item.quantity)) {
        return res.status(400).json({ error: `Insufficient stock for ${item.name}` });
      }
    }
    
    // Calculate totals
    let subtotal = 0;
    let taxTotal = 0;
    
    for (const item of items) {
      const itemTotal = Number(item.unit_price) * Number(item.quantity);
      subtotal += itemTotal;
      
      const taxRate = Number(item.tax_rate) || 0;
      taxTotal += itemTotal * (taxRate / 100);
    }
    
    const discountAmount = Number(discount) || 0;
    const total = subtotal + taxTotal - discountAmount;
    
    // Create sale record
    const receiptNumber = `POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sale = await client.query(
      `INSERT INTO sales (lab_id, user_id, customer_name, customer_phone, customer_email, subtotal, tax_total, discount_total, total, payment_method, mpesa_code, receipt_number, notes, payment_status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'paid') 
       RETURNING *`,
      [req.labId, req.userId, customer_name, customer_phone, customer_email, subtotal, taxTotal, discountAmount, total, payment_method, mpesa_code, receiptNumber, notes]
    );
    
    // Create sale items and update stock
    for (const item of items) {
      // Add sale item
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, tax_rate, total) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sale.rows[0].id, item.product_id, item.name, item.quantity, item.unit_price, item.tax_rate || 0, item.total]
      );
      
      // Update stock
      const product = await client.query(
        'SELECT stock_quantity FROM products WHERE id = $1',
        [item.product_id]
      );
      
      const previousStock = Number(product.rows[0].stock_quantity);
      const newStock = previousStock - Number(item.quantity);
      
      await client.query(
        'UPDATE products SET stock_quantity = $1 WHERE id = $2',
        [newStock, item.product_id]
      );
      
      // Record inventory transaction
      await client.query(
        `INSERT INTO inventory_transactions (lab_id, product_id, user_id, transaction_type, quantity, previous_stock, new_stock, reference_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [req.labId, item.product_id, req.userId, 'sale', -item.quantity, previousStock, newStock, sale.rows[0].id]
      );
    }
    
    // Mark cart as checked out
    await client.query(
      'UPDATE pos_carts SET status = $1, updated_at = NOW() WHERE id = $2',
      ['checked_out', cartData.id]
    );
    
    await client.query('COMMIT');
    
    // Log activity
    try {
      await pool.query(
        `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.labId, req.userId, 'SALE_COMPLETED', 'sale', sale.rows[0].id, JSON.stringify({ 
          receipt: receiptNumber, 
          total: total,
          items: items.length 
        })]
      );
    } catch (logErr) {
      console.error('Error logging activity:', logErr);
    }
    
    res.json({
      success: true,
      sale: sale.rows[0],
      receipt_number: receiptNumber,
      items_count: items.length,
      total: total
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get sales history
app.get('/api/pos/sales', authenticate, async (req, res) => {
  const { limit = 50, start_date, end_date } = req.query;
  
  try {
    let query = `
      SELECT s.*, 
        (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count
      FROM sales s
      WHERE s.lab_id = $1
    `;
    const params = [req.labId];
    let paramIndex = 2;
    
    if (start_date) {
      query += ` AND s.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND s.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    query += ` ORDER BY s.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));
    
    const sales = await pool.query(query, params);
    res.json(sales.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single sale with items
app.get('/api/pos/sales/:saleId', authenticate, async (req, res) => {
  const { saleId } = req.params;
  
  try {
    const sale = await pool.query(
      'SELECT * FROM sales WHERE id = $1 AND lab_id = $2',
      [saleId, req.labId]
    );
    
    if (sale.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    const items = await pool.query(
      'SELECT * FROM sale_items WHERE sale_id = $1',
      [saleId]
    );
    
    res.json({
      ...sale.rows[0],
      items: items.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Get inventory transactions
app.get('/api/inventory/transactions', authenticate, async (req, res) => {
  const { limit = 50, product_id } = req.query;
  
  try {
    let query = `
      SELECT it.*, p.name as product_name, u.name as user_name
      FROM inventory_transactions it
      JOIN products p ON it.product_id = p.id
      LEFT JOIN users u ON it.user_id = u.id
      WHERE it.lab_id = $1
    `;
    const params = [req.labId];
    let paramIndex = 2;
    
    if (product_id) {
      query += ` AND it.product_id = $${paramIndex}`;
      params.push(product_id);
      paramIndex++;
    }
    
    query += ` ORDER BY it.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));
    
    const transactions = await pool.query(query, params);
    res.json(transactions.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const getLabLogo = async (labId) => {
  try {
    const result = await pool.query(
      'SELECT logo_data FROM lab_logos WHERE lab_id = $1',
      [labId]
    );
    return result.rows[0]?.logo_data;
  } catch (err) {
    return null;
  }
};
// Get receipt PDF
app.get('/api/receipts/:receiptId/pdf', authenticate, async (req, res) => {
  const { receiptId } = req.params;
  
  try {
    // Get receipt data
    const receipt = await pool.query(
      `SELECT r.*, p.amount, p.payment_method, p.mpesa_code, p.created_at as payment_date,
        o.id as order_id, o.total_amount,
        pt.name as patient_name, pt.phone as patient_phone,
        l.name as lab_name, l.address as lab_address, l.phone as lab_phone,
        l.kra_pin as lab_kra_pin, l.id as lab_id
       FROM receipts r
       JOIN payments p ON r.payment_id = p.id
       JOIN orders o ON p.order_id = o.id
       JOIN patients pt ON o.patient_id = pt.id
       JOIN labs l ON r.lab_id = l.id
       WHERE r.id = $1 AND r.lab_id = $2`,
      [receiptId, req.labId]
    );
    
    if (receipt.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    const data = receipt.rows[0];
    
    // Generate PDF
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${data.receipt_number}.pdf`);
    
    doc.pipe(res);
    
    // Get logo if exists (this is inside the async function, so await is valid)
    let logoBuffer = null;
    try {
      const logoResult = await pool.query(
        'SELECT logo_data FROM lab_logos WHERE lab_id = $1',
        [data.lab_id]
      );
      if (logoResult.rows.length > 0 && logoResult.rows[0].logo_data) {
        logoBuffer = Buffer.from(logoResult.rows[0].logo_data, 'base64');
      }
    } catch (logoErr) {
      console.error('Error fetching logo:', logoErr);
      // Continue without logo
    }
    
    // Add logo if available
    if (logoBuffer) {
      doc.image(logoBuffer, 50, 45, { width: 100 });
    }
    
    // Add lab header
    doc.fontSize(20).text(data.lab_name || 'Laboratory', { align: 'center' });
    
    if (data.lab_address) {
      doc.fontSize(10).text(data.lab_address, { align: 'center' });
    }
    
    if (data.lab_phone) {
      doc.fontSize(10).text(`Tel: ${data.lab_phone}`, { align: 'center' });
    }
    
    if (data.lab_kra_pin) {
      doc.fontSize(10).text(`KRA PIN: ${data.lab_kra_pin}`, { align: 'center' });
    }
    
    doc.moveDown();
    doc.fontSize(16).text('OFFICIAL RECEIPT', { align: 'center' });
    doc.moveDown();
    
    // Receipt details
    doc.fontSize(12);
    doc.text(`Receipt No: ${data.receipt_number}`);
    doc.text(`Date: ${new Date(data.payment_date || data.created_at).toLocaleString('en-KE')}`);
    doc.text(`Order No: #${data.order_id}`);
    doc.moveDown();
    
    doc.text(`Patient: ${data.patient_name || 'N/A'}`);
    doc.text(`Phone: ${data.patient_phone || 'N/A'}`);
    doc.moveDown();
    
    doc.text(`Payment Method: ${data.payment_method ? data.payment_method.toUpperCase() : 'N/A'}`);
    if (data.payment_method === 'mpesa' && data.mpesa_code) {
      doc.text(`M-PESA Code: ${data.mpesa_code}`);
    }
    doc.moveDown();
    
    // Amount
    doc.fontSize(14);
    const amount = data.amount ? parseFloat(data.amount).toLocaleString() : '0';
    const total = data.total_amount ? parseFloat(data.total_amount).toLocaleString() : '0';
    
    doc.text(`Amount Paid: KES ${amount}`);
    doc.text(`Total Order: KES ${total}`);
    
    doc.moveDown();
    doc.moveDown();
    
    // Footer
    doc.fontSize(10).text('This is a computer generated receipt', { align: 'center' });
    doc.text('Thank you for choosing ' + (data.lab_name || 'us'), { align: 'center' });
    
    doc.end();
    
  } catch (err) {
    console.error('❌ Receipt PDF error:', err);
    res.status(500).json({ error: err.message });
  }
});
// Get single sale with items
app.get('/api/pos/sales/:saleId', authenticate, async (req, res) => {
  const { saleId } = req.params;
  
  try {
    const sale = await pool.query(
      'SELECT * FROM sales WHERE id = $1 AND lab_id = $2',
      [saleId, req.labId]
    );
    
    if (sale.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    const items = await pool.query(
      'SELECT * FROM sale_items WHERE sale_id = $1',
      [saleId]
    );
    
    res.json({
      ...sale.rows[0],
      items: items.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ============ REFERRAL LABS ENDPOINTS ============

// Get reference labs
app.get('/api/reference-labs', authenticate, async (req, res) => {
  try {
    const labs = await pool.query(
      'SELECT * FROM reference_labs WHERE is_active = true ORDER BY name'
    );
    res.json(labs.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Upload lab logo
app.post('/api/labs/logo', authenticate, async (req, res) => {
  const { logo_data, logo_filename } = req.body;
  
  try {
    // Check if logo exists
    const existing = await pool.query(
      'SELECT id FROM lab_logos WHERE lab_id = $1',
      [req.labId]
    );
    
    if (existing.rows.length > 0) {
      // Update existing logo
      await pool.query(
        'UPDATE lab_logos SET logo_data = $1, logo_filename = $2, updated_at = NOW() WHERE lab_id = $3',
        [logo_data, logo_filename, req.labId]
      );
    } else {
      // Insert new logo
      await pool.query(
        'INSERT INTO lab_logos (lab_id, logo_data, logo_filename) VALUES ($1, $2, $3)',
        [req.labId, logo_data, logo_filename]
      );
    }
    
    // Also update labs table with logo_url
    await pool.query(
      'UPDATE labs SET logo_url = $1 WHERE id = $2',
      [`/api/labs/logo/${req.labId}`, req.labId]
    );
    
    res.json({ success: true, message: 'Logo uploaded successfully' });
  } catch (err) {
    console.error('Logo upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all reference labs
app.get('/api/reference-labs', authenticate, async (req, res) => {
  try {
    const labs = await pool.query(
      'SELECT * FROM reference_labs WHERE is_active = true ORDER BY name'
    );
    res.json(labs.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Get referrals
app.get('/api/referrals', authenticate, async (req, res) => {
  const { status } = req.query;
  
  try {
    let query = `
      SELECT r.*, 
        p.name as patient_name, p.phone as patient_phone,
        rl.name as reference_lab_name, rl.email as reference_lab_email
      FROM referrals r
      JOIN patients p ON r.patient_id = p.id
      JOIN reference_labs rl ON r.reference_lab_id = rl.id
      WHERE r.lab_id = $1
    `;
    const params = [req.labId];
    
    if (status) {
      query += ` AND r.status = $2`;
      params.push(status);
    }
    
    query += ` ORDER BY r.created_at DESC`;
    
    const referrals = await pool.query(query, params);
    res.json(referrals.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ============ FIXED EMAIL/SMS ============

// Configure email transporter with proper settings
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Send results to clinician with full hospital/clinical information
app.post('/api/orders/:orderId/send-to-clinician', authenticate, async (req, res) => {
  const { orderId } = req.params;
  const { 
    clinicianEmail, 
    clinicianPhone, 
    sendEmail, 
    sendSMS, 
    feedback 
  } = req.body;
  
  console.log('\n' + '='.repeat(60));
  console.log('📧 SENDING RESULTS TO CLINICIAN');
  console.log('Order ID:', orderId);
  console.log('Clinician Email:', clinicianEmail);
  console.log('='.repeat(60));
  
  if (!clinicianEmail) {
    return res.status(400).json({ error: 'Clinician email is required' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get order details with patient info
    const order = await client.query(
      `SELECT o.*, 
        p.name as patient_name, p.phone as patient_phone, p.email as patient_email,
        p.id_number, p.date_of_birth, p.gender, p.address,
        l.name as lab_name, l.phone as lab_phone, l.email as lab_email, l.address as lab_address,
        l.kra_pin as lab_kra_pin
       FROM orders o
       JOIN patients p ON o.patient_id = p.id
       JOIN labs l ON o.lab_id = l.id
       WHERE o.id = $1 AND o.lab_id = $2`,
      [orderId, req.labId]
    );
    
    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const orderData = order.rows[0];
    
    // Get test results
    const tests = await client.query(
      `SELECT t.name, t.category, ot.result_value, ot.result_unit, ot.reference_range, 
        ot.is_abnormal, ot.test_notes, ot.tested_at, ot.tested_by
       FROM order_tests ot
       JOIN tests t ON ot.test_id = t.id
       WHERE ot.order_id = $1 AND ot.result_value IS NOT NULL`,
      [orderId]
    );
    
    if (tests.rows.length === 0) {
      return res.status(400).json({ error: 'No results available for this order' });
    }
    
    const testResults = tests.rows;
    
    // Store feedback if provided
    if (feedback) {
      try {
        // You can create this table if it doesn't exist
        await client.query(
          `INSERT INTO clinical_feedback (
            order_id, lab_id, hospital_name, department, ward, bed_number,
            referring_doctor, referring_doctor_license, referring_doctor_phone, referring_doctor_email,
            attending_doctor, attending_doctor_phone, attending_doctor_email,
            clinical_diagnosis, clinical_notes, specimen_type, 
            specimen_collection_date, specimen_collection_time,
            priority, insurance_provider, insurance_number, consent_obtained
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
          [
            orderId, req.labId,
            feedback.hospitalName, feedback.department, feedback.ward, feedback.bedNumber,
            feedback.referringDoctor, feedback.referringDoctorLicense, feedback.referringDoctorPhone, feedback.referringDoctorEmail,
            feedback.attendingDoctor, feedback.attendingDoctorPhone, feedback.attendingDoctorEmail,
            feedback.clinicalDiagnosis, feedback.clinicalNotes, feedback.specimenType,
            feedback.specimenCollectionDate, feedback.specimenCollectionTime,
            feedback.priority, feedback.insuranceProvider, feedback.insuranceNumber,
            feedback.consentObtained || false
          ]
        );
      } catch (feedbackErr) {
        console.error('Error storing feedback:', feedbackErr);
        // Continue even if feedback storage fails
      }
    }
    
    // Get lab logo
    const logoResult = await client.query(
      'SELECT logo_data FROM lab_logos WHERE lab_id = $1',
      [req.labId]
    );
    
    // Create email HTML
    const abnormalCount = testResults.filter(t => t.is_abnormal).length;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #3b82f6; }
          .lab-name { font-size: 24px; font-weight: bold; color: #3b82f6; }
          .patient-info { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .test-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .test-table th { background: #3b82f6; color: white; padding: 12px; text-align: left; }
          .test-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
          .abnormal { color: #ef4444; font-weight: bold; background: #fee2e2; padding: 4px 8px; border-radius: 4px; }
          .normal { color: #10b981; background: #d1fae5; padding: 4px 8px; border-radius: 4px; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoResult.rows[0]?.logo_data ? 
            `<img src="${logoResult.rows[0].logo_data}" style="max-width: 150px; margin-bottom: 10px;" />` : 
            `<h1>${orderData.lab_name}</h1>`
          }
          <div class="lab-name">Laboratory Results Report</div>
          <p>${orderData.lab_address || ''}<br>Tel: ${orderData.lab_phone || ''}</p>
        </div>
        
        <div class="patient-info">
          <h3>Patient Information</h3>
          <p><strong>Name:</strong> ${orderData.patient_name}</p>
          <p><strong>ID Number:</strong> ${orderData.id_number || 'N/A'}</p>
          <p><strong>Date of Birth:</strong> ${orderData.date_of_birth ? new Date(orderData.date_of_birth).toLocaleDateString() : 'N/A'}</p>
          <p><strong>Gender:</strong> ${orderData.gender || 'N/A'}</p>
          <p><strong>Phone:</strong> ${orderData.patient_phone || 'N/A'}</p>
        </div>
        
        ${feedback ? `
          <div class="patient-info">
            <h3>Clinical Information</h3>
            <p><strong>Referring Doctor:</strong> ${feedback.referringDoctor || 'N/A'}</p>
            <p><strong>Hospital:</strong> ${feedback.hospitalName || 'N/A'}</p>
            <p><strong>Diagnosis:</strong> ${feedback.clinicalDiagnosis || 'N/A'}</p>
          </div>
        ` : ''}
        
        <h3>Test Results</h3>
        <table class="test-table">
          <thead>
            <tr>
              <th>Test</th>
              <th>Result</th>
              <th>Unit</th>
              <th>Reference Range</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${testResults.map(test => `
              <tr>
                <td><strong>${test.name}</strong></td>
                <td>${test.result_value || 'N/A'}</td>
                <td>${test.result_unit || ''}</td>
                <td>${test.reference_range || 'N/A'}</td>
                <td><span class="${test.is_abnormal ? 'abnormal' : 'normal'}">
                  ${test.is_abnormal ? '⚠️ ABNORMAL' : 'Normal'}
                </span></td>
              </tr>
              ${test.test_notes ? `<tr><td colspan="5" style="font-style: italic;">Note: ${test.test_notes}</td></tr>` : ''}
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>This is a computer generated report. For verification, contact the lab.</p>
          <p>Report generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;
    
    // Send email
    let emailSent = false;
    let emailError = null;
    
    if (sendEmail && clinicianEmail) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST || 'smtp.gmail.com',
          port: process.env.EMAIL_PORT || 587,
          secure: false,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        
        await transporter.sendMail({
          from: `"${orderData.lab_name}" <${process.env.EMAIL_USER}>`,
          to: clinicianEmail,
          subject: `Lab Results: ${orderData.patient_name} - ${orderData.lab_name}`,
          html: htmlContent
        });
        
        emailSent = true;
        console.log(`✅ Email sent to ${clinicianEmail}`);
        
      } catch (err) {
        console.error('Email error:', err);
        emailError = err.message;
      }
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      email: { sent: emailSent, error: emailError },
      message: emailSent ? 'Results sent successfully' : 'Results saved but email failed',
      recipient: clinicianEmail
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Send results error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// Get all reference labs
app.get('/api/reference-labs', authenticate, async (req, res) => {
  try {
    const labs = await pool.query(
      'SELECT * FROM reference_labs WHERE lab_id = $1 ORDER BY name',
      [req.labId]
    );
    res.json(labs.rows);
  } catch (err) {
    console.error('Error fetching reference labs:', err);
    res.status(500).json({ error: err.message });
  }
});
// Add reference lab
app.post('/api/reference-labs', authenticate, async (req, res) => {
  console.log('\n' + '='.repeat(60));
  console.log('📝 ADD REFERENCE LAB ENDPOINT HIT');
  console.log('Request body:', req.body);
  console.log('User ID:', req.userId);
  console.log('Lab ID from auth:', req.labId);
  console.log('User object:', req.user);
  
  const { name, contact_person, phone, email, address, turnaround_time } = req.body;
  
  if (!name || !phone) {
    console.log('❌ Missing required fields');
    return res.status(400).json({ error: 'Name and phone are required' });
  }
  
  const client = await pool.connect();
  try {
    console.log('📦 Connected to database, beginning transaction...');
    await client.query('BEGIN');
    
    // Check if lab_id is valid
    console.log('🔍 Checking if lab_id exists:', req.labId);
    const labCheck = await client.query('SELECT id FROM labs WHERE id = $1', [req.labId]);
    if (labCheck.rows.length === 0) {
      console.log('❌ Lab ID not found in labs table');
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid lab ID' });
    }
    console.log('✅ Lab ID is valid');
    
    console.log('📤 Inserting reference lab with values:', {
      lab_id: req.labId,
      name,
      contact_person,
      phone,
      email,
      address,
      turnaround_time
    });
    
    const result = await client.query(
      `INSERT INTO reference_labs 
       (lab_id, name, contact_person, phone, email, address, turnaround_time, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
       RETURNING id`,
      [req.labId, name, contact_person, phone, email, address, turnaround_time]
    );
    
    console.log('✅ Insert successful, new ID:', result.rows[0].id);
    
    // Log activity
    try {
      await client.query(
        `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [req.labId, req.userId, 'REFERENCE_LAB_ADDED', 'reference_lab', result.rows[0].id, JSON.stringify({ name })]
      );
      console.log('✅ Activity logged');
    } catch (logErr) {
      console.log('⚠️ Activity log failed (non-critical):', logErr.message);
    }
    
    await client.query('COMMIT');
    console.log('✅ Transaction committed');
    
    res.status(201).json({ 
      id: result.rows[0].id,
      message: 'Reference lab added successfully' 
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌❌❌ ERROR ADDING REFERENCE LAB ❌❌❌');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error code:', err.code);
    console.error('Error detail:', err.detail);
    console.error('Error hint:', err.hint);
    console.error('Error position:', err.position);
    console.error('Error stack:', err.stack);
    
    // Check for specific PostgreSQL error codes
    if (err.code === '23502') {
      res.status(500).json({ error: 'Missing required field: ' + err.column });
    } else if (err.code === '23503') {
      res.status(500).json({ error: 'Foreign key violation - lab_id does not exist' });
    } else if (err.code === '23505') {
      res.status(500).json({ error: 'Duplicate entry' });
    } else if (err.code === '42P01') {
      res.status(500).json({ error: 'Table does not exist' });
    } else {
      res.status(500).json({ error: err.message });
    }
  } finally {
    client.release();
    console.log('='.repeat(60) + '\n');
  }
});
// Update reference lab
app.put('/api/reference-labs/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { name, contact_person, phone, email, address, turnaround_time, is_active } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE reference_labs 
       SET name = $1, contact_person = $2, phone = $3, email = $4, 
           address = $5, turnaround_time = $6, is_active = $7, updated_at = NOW()
       WHERE id = $8 AND lab_id = $9
       RETURNING *`,
      [name, contact_person, phone, email, address, turnaround_time, is_active, id, req.labId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reference lab not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating reference lab:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete reference lab
app.delete('/api/reference-labs/:id', authenticate, authorize(['admin']), async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM reference_labs WHERE id = $1 AND lab_id = $2 RETURNING id',
      [id, req.labId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reference lab not found' });
    }
    
    res.json({ success: true, message: 'Reference lab deleted successfully' });
  } catch (err) {
    console.error('Error deleting reference lab:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============== REFERRALS ENDPOINTS ==============

// Get all referrals
app.get('/api/referrals', authenticate, async (req, res) => {
  try {
    // First get all referrals with basic info
    const referrals = await pool.query(
      `SELECT r.*, 
        p.name as patient_name, 
        p.phone as patient_phone,
        rl.name as reference_lab_name,
        rl.phone as reference_lab_phone
       FROM referrals r
       LEFT JOIN patients p ON r.patient_id = p.id
       LEFT JOIN reference_labs rl ON r.reference_lab_id = rl.id
       WHERE r.lab_id = $1
       ORDER BY r.created_at DESC`,
      [req.labId]
    );
    
    // Get tests for each referral
    for (let referral of referrals.rows) {
      const tests = await pool.query(
        `SELECT t.id, t.name, t.price, t.category, t.sample_type
         FROM tests t
         JOIN referral_tests rt ON t.id = rt.test_id
         WHERE rt.referral_id = $1`,
        [referral.id]
      );
      referral.tests = tests.rows;
    }
    
    res.json(referrals.rows);
  } catch (err) {
    console.error('Error fetching referrals:', err);
    res.status(500).json({ error: err.message });
  }
});
// Create new referral
app.post('/api/referrals', authenticate, async (req, res) => {
  const { reference_lab_id, patient_id, tests, priority, clinical_notes, expected_completion } = req.body;
  
  if (!reference_lab_id || !patient_id || !tests || tests.length === 0) {
    return res.status(400).json({ error: 'Reference lab, patient, and tests are required' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get reference lab details for email
    const labInfo = await client.query(
      'SELECT name, email FROM reference_labs WHERE id = $1',
      [reference_lab_id]
    );
    
    // Get patient details
    const patientInfo = await client.query(
      'SELECT name FROM patients WHERE id = $1',
      [patient_id]
    );
    
    // Generate referral number
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Get count for today to make unique number
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM referrals 
       WHERE lab_id = $1 AND DATE(created_at) = CURRENT_DATE`,
      [req.labId]
    );
    const todayCount = parseInt(countResult.rows[0].count) + 1;
    const seq = String(todayCount).padStart(3, '0');
    
    const referralNumber = `REF-${year}${month}${day}-${seq}`;
    
    // Insert referral
    const result = await client.query(
      `INSERT INTO referrals 
       (lab_id, referral_number, reference_lab_id, patient_id, priority, clinical_notes, expected_completion, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
       RETURNING id`,
      [req.labId, referralNumber, reference_lab_id, patient_id, priority || 'normal', clinical_notes, expected_completion]
    );
    
    const referralId = result.rows[0].id;
    
    // Insert tests
    for (let test of tests) {
      const testId = test.id || test;
      await client.query(
        'INSERT INTO referral_tests (referral_id, test_id) VALUES ($1, $2)',
        [referralId, testId]
      );
    }
    
    // Log activity
    await client.query(
      `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [req.labId, req.userId, 'REFERRAL_CREATED', 'referral', referralId, 
       JSON.stringify({ referral_number: referralNumber, patient_id, reference_lab_id })]
    );
    
    await client.query('COMMIT');
    
    // Send email notification to reference lab (after commit so it doesn't rollback on failure)
    if (labInfo.rows[0]?.email) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST || 'smtp.gmail.com',
          port: process.env.EMAIL_PORT || 587,
          secure: false,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        
        const testNames = tests.map(t => t.name || `Test #${t.id}`).join(', ');
        
        const mailOptions = {
          from: `"Lab Management" <${process.env.EMAIL_USER}>`,
          to: labInfo.rows[0].email,
          subject: `🔬 New Referral: ${patientInfo.rows[0]?.name || 'Patient'} - ${referralNumber}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
                .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { padding: 20px; }
                .info-box { background: #f8fafc; padding: 15px; border-radius: 5px; margin: 15px 0; }
                .label { font-weight: bold; color: #555; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #ddd; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2>New Referral Received</h2>
                </div>
                <div class="content">
                  <p>Hello,</p>
                  <p>A new referral has been sent to your lab.</p>
                  
                  <div class="info-box">
                    <p><span class="label">Referral #:</span> ${referralNumber}</p>
                    <p><span class="label">Patient:</span> ${patientInfo.rows[0]?.name || 'Unknown'}</p>
                    <p><span class="label">Tests Requested:</span> ${testNames}</p>
                    <p><span class="label">Priority:</span> ${priority || 'normal'}</p>
                    ${clinical_notes ? `<p><span class="label">Clinical Notes:</span> ${clinical_notes}</p>` : ''}
                    ${expected_completion ? `<p><span class="label">Expected Completion:</span> ${new Date(expected_completion).toLocaleDateString()}</p>` : ''}
                  </div>
                  
                  <p>Please log in to your dashboard to view the full details and process this referral.</p>
                </div>
                <div class="footer">
                  <p>This is an automated message from your Lab Management System.</p>
                </div>
              </div>
            </body>
            </html>
          `
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`✅ Referral email sent to ${labInfo.rows[0].email}`);
        
      } catch (emailErr) {
        console.error('❌ Failed to send referral email:', emailErr.message);
        // Don't fail the response - referral was already saved
      }
    }
    
    res.status(201).json({ 
      id: referralId,
      referral_number: referralNumber,
      message: 'Referral created successfully' 
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating referral:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get single referral
app.get('/api/referrals/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  
  try {
    const referral = await pool.query(
      `SELECT r.*, 
        p.name as patient_name, p.phone as patient_phone, p.email as patient_email,
        p.date_of_birth, p.gender, p.id_number,
        rl.name as reference_lab_name, rl.phone as reference_lab_phone, 
        rl.email as reference_lab_email, rl.contact_person
       FROM referrals r
       LEFT JOIN patients p ON r.patient_id = p.id
       LEFT JOIN reference_labs rl ON r.reference_lab_id = rl.id
       WHERE r.id = $1 AND r.lab_id = $2`,
      [id, req.labId]
    );
    
    if (referral.rows.length === 0) {
      return res.status(404).json({ error: 'Referral not found' });
    }
    
    // Get tests
    const tests = await pool.query(
      `SELECT t.*, rt.id as referral_test_id
       FROM tests t
       JOIN referral_tests rt ON t.id = rt.test_id
       WHERE rt.referral_id = $1`,
      [id]
    );
    
    const result = referral.rows[0];
    result.tests = tests.rows;
    
    res.json(result);
  } catch (err) {
    console.error('Error fetching referral:', err);
    res.status(500).json({ error: err.message });
  }
});

// Receive referral results
app.post('/api/referrals/:referralId/results', authenticate, async (req, res) => {
  const { referralId } = req.params;
  const { results, file_data, file_name } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Store file if provided
    let filePath = null;
    if (file_data && file_name) {
      // For now, store the base64 data directly in the database
      filePath = file_data;
    }
    
    await client.query(
      `UPDATE referrals 
       SET status = 'completed', 
           result_notes = $1,
           result_file_path = $2,
           completed_at = NOW()
       WHERE id = $3 AND lab_id = $4
       RETURNING *`,
      [results, filePath, referralId, req.labId]
    );
    
    // Log activity
    await client.query(
      `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [req.labId, req.userId, 'REFERRAL_COMPLETED', 'referral', referralId, 
       JSON.stringify({ results_received: true })]
    );
    
    await client.query('COMMIT');
    
    res.json({ message: 'Results received successfully' });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error receiving referral results:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// Update referral status
app.put('/api/referrals/:id/status', authenticate, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  try {
    const result = await pool.query(
      `UPDATE referrals 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND lab_id = $3
       RETURNING *`,
      [status, id, req.labId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Referral not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating referral status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get referral statistics
app.get('/api/referrals/stats/summary', authenticate, async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
       FROM referrals
       WHERE lab_id = $1`,
      [req.labId]
    );
    
    res.json(stats.rows[0]);
  } catch (err) {
    console.error('Error fetching referral stats:', err);
    res.status(500).json({ error: err.message });
  }
});
// Delete invoice
app.delete('/api/invoices/:invoiceId', authenticate, async (req, res) => {
  const { invoiceId } = req.params;
  
  // Check permissions
  if (req.userRole !== 'admin' && !req.userPermissions?.can_delete) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if invoice exists
    const invoice = await client.query(
      'SELECT * FROM invoices WHERE id = $1 AND lab_id = $2',
      [invoiceId, req.labId]
    );
    
    if (invoice.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Delete invoice
    await client.query(
      'DELETE FROM invoices WHERE id = $1 AND lab_id = $2',
      [invoiceId, req.labId]
    );
    
    // Log activity
    await client.query(
      `INSERT INTO activity_logs (lab_id, user_id, action, entity_type, entity_id, details) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.labId, req.userId, 'INVOICE_DELETED', 'invoice', invoiceId, JSON.stringify({ 
        invoice_number: invoice.rows[0].invoice_number 
      })]
    );
    
    await client.query('COMMIT');
    
    res.json({ success: true, message: 'Invoice deleted successfully' });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting invoice:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// ============ NOTIFICATION SETTINGS ENDPOINTS ============

// Get notification settings for current lab
app.get('/api/notification-settings', authenticate, async (req, res) => {
  try {
    const settings = await pool.query(
      'SELECT * FROM notification_settings WHERE lab_id = $1',
      [req.labId]
    );
    
    if (settings.rows.length === 0) {
      // Return default settings
      res.json({
        email_enabled: false,
        sms_enabled: false,
        notify_on_referral_sent: true,
        notify_on_referral_received: true,
        notify_on_results_ready: true,
        notify_on_results_sent: true,
        notify_on_payment_received: true,
        notify_on_order_created: true,
        send_to_clinician: true,
        send_to_patient: false,
        send_to_lab_admin: true,
        admin_emails: [],
        admin_phones: []
      });
    } else {
      res.json(settings.rows[0]);
    }
  } catch (err) {
    console.error('Error fetching notification settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save notification settings
app.post('/api/notification-settings', authenticate, async (req, res) => {
  const settings = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if settings exist
    const existing = await client.query(
      'SELECT id FROM notification_settings WHERE lab_id = $1',
      [req.labId]
    );
    
    if (existing.rows.length > 0) {
      // Update
      await client.query(
        `UPDATE notification_settings SET
          email_enabled = $1, email_smtp_host = $2, email_smtp_port = $3,
          email_smtp_secure = $4, email_auth_user = $5, email_auth_pass = $6,
          email_from_name = $7, email_from_address = $8,
          sms_enabled = $9, sms_provider = $10, sms_api_key = $11,
          sms_username = $12, sms_sender_id = $13,
          notify_on_referral_sent = $14, notify_on_referral_received = $15,
          notify_on_results_ready = $16, notify_on_results_sent = $17,
          notify_on_payment_received = $18, notify_on_order_created = $19,
          send_to_clinician = $20, send_to_patient = $21, send_to_lab_admin = $22,
          admin_emails = $23, admin_phones = $24,
          updated_at = NOW()
        WHERE lab_id = $25`,
        [
          settings.email_enabled, settings.email_smtp_host, settings.email_smtp_port,
          settings.email_smtp_secure, settings.email_auth_user, settings.email_auth_pass,
          settings.email_from_name, settings.email_from_address,
          settings.sms_enabled, settings.sms_provider, settings.sms_api_key,
          settings.sms_username, settings.sms_sender_id,
          settings.notify_on_referral_sent, settings.notify_on_referral_received,
          settings.notify_on_results_ready, settings.notify_on_results_sent,
          settings.notify_on_payment_received, settings.notify_on_order_created,
          settings.send_to_clinician, settings.send_to_patient, settings.send_to_lab_admin,
          JSON.stringify(settings.admin_emails || []),
          JSON.stringify(settings.admin_phones || []),
          req.labId
        ]
      );
    } else {
      // Insert
      await client.query(
        `INSERT INTO notification_settings (
          lab_id, email_enabled, email_smtp_host, email_smtp_port,
          email_smtp_secure, email_auth_user, email_auth_pass,
          email_from_name, email_from_address,
          sms_enabled, sms_provider, sms_api_key,
          sms_username, sms_sender_id,
          notify_on_referral_sent, notify_on_referral_received,
          notify_on_results_ready, notify_on_results_sent,
          notify_on_payment_received, notify_on_order_created,
          send_to_clinician, send_to_patient, send_to_lab_admin,
          admin_emails, admin_phones
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
        [
          req.labId,
          settings.email_enabled, settings.email_smtp_host, settings.email_smtp_port,
          settings.email_smtp_secure, settings.email_auth_user, settings.email_auth_pass,
          settings.email_from_name, settings.email_from_address,
          settings.sms_enabled, settings.sms_provider, settings.sms_api_key,
          settings.sms_username, settings.sms_sender_id,
          settings.notify_on_referral_sent, settings.notify_on_referral_received,
          settings.notify_on_results_ready, settings.notify_on_results_sent,
          settings.notify_on_payment_received, settings.notify_on_order_created,
          settings.send_to_clinician, settings.send_to_patient, settings.send_to_lab_admin,
          JSON.stringify(settings.admin_emails || []),
          JSON.stringify(settings.admin_phones || [])
        ]
      );
    }
    
    await client.query('COMMIT');
    
    // Log activity
    await logActivity(req.labId, req.userId, 'NOTIFICATION_SETTINGS_UPDATED', 'settings', req.labId, {});
    
    res.json({ success: true, message: 'Settings saved successfully' });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving notification settings:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Test notification
app.post('/api/notifications/test', authenticate, async (req, res) => {
  const { type, recipient, settings } = req.body;
  
  try {
    if (type === 'email') {
      // Test email
      const transporter = nodemailer.createTransport({
        host: settings.email_smtp_host,
        port: settings.email_smtp_port,
        secure: settings.email_smtp_secure,
        auth: {
          user: settings.email_auth_user,
          pass: settings.email_auth_pass
        }
      });
      
      await transporter.sendMail({
        from: `"${settings.email_from_name}" <${settings.email_from_address || settings.email_auth_user}>`,
        to: recipient,
        subject: 'Test Notification from Lab Management System',
        html: `
          <h2>Test Notification</h2>
          <p>This is a test email from your lab management system.</p>
          <p>If you received this, your email settings are configured correctly!</p>
          <p>Time: ${new Date().toLocaleString()}</p>
        `
      });
      
    } else if (type === 'sms') {
      // Test SMS with Africa's Talking
      const axios = require('axios');
      
      const atResponse = await axios.post(
        'https://api.africastalking.com/version1/messaging',
        new URLSearchParams({
          username: settings.sms_username,
          to: recipient,
          message: 'Test SMS from your Lab Management System. If you received this, SMS is working!',
          from: settings.sms_sender_id || null
        }),
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'apiKey': settings.sms_api_key
          }
        }
      );
      
      console.log('SMS test response:', atResponse.data);
    }
    
    res.json({ success: true });
    
  } catch (err) {
    console.error('Test notification error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ WORKING EMAIL CONFIGURATION ============

// Create a more robust email transporter with better error handling
const createTransporter = (settings) => {
  // If lab has custom settings, use those
  if (settings && settings.email_enabled && settings.email_auth_user && settings.email_auth_pass) {
    return nodemailer.createTransport({
      host: settings.email_smtp_host || 'smtp.gmail.com',
      port: settings.email_smtp_port || 587,
      secure: settings.email_smtp_secure || false,
      auth: {
        user: settings.email_auth_user,
        pass: settings.email_auth_pass
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });
  }
  
  // Fallback to default .env configuration
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// ============ GET LAB NOTIFICATION SETTINGS ============
const getLabNotificationSettings = async (labId) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notification_settings WHERE lab_id = $1',
      [labId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    // Return default settings
    return {
      email_enabled: false,
      sms_enabled: false,
      notify_on_referral_sent: true,
      notify_on_referral_received: true,
      notify_on_results_ready: true,
      notify_on_results_sent: true,
      send_to_clinician: true,
      send_to_patient: false,
      send_to_lab_admin: true,
      admin_emails: [],
      admin_phones: []
    };
  } catch (err) {
    console.error('Error getting notification settings:', err);
    return null;
  }
};

// ============ SEND TEST EMAIL ============
app.post('/api/notifications/test-email', authenticate, async (req, res) => {
  const { to, settings } = req.body;
  
  if (!to) {
    return res.status(400).json({ error: 'Recipient email is required' });
  }
  
  try {
    const transporter = createTransporter(settings);
    
    // Get lab info for email signature
    const labInfo = await pool.query(
      'SELECT name, phone, email FROM labs WHERE id = $1',
      [req.labId]
    );
    
    const labName = labInfo.rows[0]?.name || 'Your Lab';
    const labPhone = labInfo.rows[0]?.phone || 'N/A';
    
    const mailOptions = {
      from: `"${settings?.email_from_name || labName}" <${settings?.email_from_address || settings?.email_auth_user || process.env.EMAIL_USER}>`,
      to: to,
      subject: `✅ Test Email from ${labName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .header { background: #3b82f6; color: white; padding: 15px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; }
            .success { color: #10b981; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📧 Email Test Successful!</h2>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>This is a test email from <strong>${labName}</strong>.</p>
              <p class="success">✅ Your email configuration is working correctly!</p>
              <p><strong>Details:</strong></p>
              <ul>
                <li><strong>Lab:</strong> ${labName}</li>
                <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
                <li><strong>Server:</strong> ${settings?.email_smtp_host || 'smtp.gmail.com'}</li>
              </ul>
              <p>If you received this, you can now send real notifications to patients and clinicians.</p>
            </div>
            <div class="footer">
              <p>${labName} | ${labPhone}</p>
              <p>This is an automated test message</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Test email sent:', info.messageId);
    
    res.json({ 
      success: true, 
      message: 'Test email sent successfully',
      messageId: info.messageId 
    });
    
  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ 
      error: 'Failed to send email: ' + err.message,
      details: err.response
    });
  }
});

// ============ SEND TEST SMS (Africa's Talking) ============
app.post('/api/notifications/test-sms', authenticate, async (req, res) => {
  const { to, settings } = req.body;
  
  if (!to) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  
  // Format phone number (remove 0, add 254)
  let formattedNumber = to.replace(/\s+/g, '');
  if (formattedNumber.startsWith('0')) {
    formattedNumber = '254' + formattedNumber.substring(1);
  }
  
  try {
    // Using Africa's Talking API
    const axios = require('axios');
    
    const atResponse = await axios.post(
      'https://api.africastalking.com/version1/messaging',
      new URLSearchParams({
        username: settings?.sms_username || process.env.SMS_USERNAME || 'sandbox',
        to: formattedNumber,
        message: `Test SMS from your Lab Management System. If you received this, SMS is working! Time: ${new Date().toLocaleString()}`,
        from: settings?.sms_sender_id || null
      }),
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'apiKey': settings?.sms_api_key || process.env.SMS_API_KEY || ''
        }
      }
    );
    
    console.log('SMS test response:', atResponse.data);
    
    // For sandbox/testing, simulate success
    if (settings?.sms_username === 'sandbox' || !settings?.sms_api_key) {
      res.json({ 
        success: true, 
        message: 'Test SMS would be sent (simulated - sandbox mode)',
        simulated: true,
        to: formattedNumber
      });
    } else {
      res.json({ 
        success: true, 
        message: 'Test SMS sent successfully',
        response: atResponse.data
      });
    }
    
  } catch (err) {
    console.error('SMS test error:', err.response?.data || err.message);
    
    // For sandbox, still return success with simulation message
    if (settings?.sms_username === 'sandbox' || !settings?.sms_api_key) {
      res.json({ 
        success: true, 
        message: 'Test SMS would be sent (simulated - sandbox mode)',
        simulated: true,
        to: formattedNumber
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to send SMS: ' + (err.response?.data?.message || err.message) 
      });
    }
  }
});

// ============ SEND RESULTS EMAIL TO CLINICIAN ============
app.post('/api/notifications/send-results', authenticate, async (req, res) => {
  const { orderId, clinicianEmail, clinicianName } = req.body;
  
  if (!orderId || !clinicianEmail) {
    return res.status(400).json({ error: 'Order ID and clinician email are required' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get order details with patient info
    const order = await client.query(
      `SELECT o.*, 
        p.name as patient_name, p.id_number, p.date_of_birth, p.gender,
        l.name as lab_name, l.phone as lab_phone, l.email as lab_email,
        u.name as requested_by_name
       FROM orders o
       JOIN patients p ON o.patient_id = p.id
       JOIN labs l ON o.lab_id = l.id
       LEFT JOIN users u ON o.requested_by = u.id
       WHERE o.id = $1 AND o.lab_id = $2`,
      [orderId, req.labId]
    );
    
    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Get test results
    const tests = await client.query(
      `SELECT t.name, t.category, ot.result_value, ot.result_unit, 
        ot.reference_range, ot.is_abnormal, ot.test_notes
       FROM order_tests ot
       JOIN tests t ON ot.test_id = t.id
       WHERE ot.order_id = $1 AND ot.result_value IS NOT NULL`,
      [orderId]
    );
    
    if (tests.rows.length === 0) {
      return res.status(400).json({ error: 'No results available for this order' });
    }
    
    const orderData = order.rows[0];
    const testResults = tests.rows;
    
    // Get lab logo if exists
    const logoResult = await client.query(
      'SELECT logo_data FROM lab_logos WHERE lab_id = $1',
      [req.labId]
    );
    
    // Get notification settings
    const settings = await getLabNotificationSettings(req.labId);
    
    // Create email transporter
    const transporter = createTransporter(settings);
    
    // Build email HTML
    const abnormalCount = testResults.filter(t => t.is_abnormal).length;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .lab-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .patient-info { background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .test-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .test-table th { background: #3b82f6; color: white; padding: 10px; text-align: left; }
          .test-table td { padding: 10px; border-bottom: 1px solid #ddd; }
          .abnormal { color: #ef4444; font-weight: bold; background: #fee2e2; }
          .normal { color: #10b981; }
          .summary { background: ${abnormalCount > 0 ? '#fee2e2' : '#d1fae5'}; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #ddd; }
          .note { font-style: italic; color: #666; margin-top: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${logoResult.rows[0]?.logo_data ? 
              `<img src="${logoResult.rows[0].logo_data}" style="max-width: 150px; margin-bottom: 10px;" />` : 
              ''
            }
            <div class="lab-name">${orderData.lab_name}</div>
            <p>Laboratory Results Report</p>
          </div>
          
          <div class="patient-info">
            <h3>Patient Information</h3>
            <p><strong>Name:</strong> ${orderData.patient_name}</p>
            <p><strong>ID Number:</strong> ${orderData.id_number || 'N/A'}</p>
            <p><strong>Date of Birth:</strong> ${orderData.date_of_birth ? new Date(orderData.date_of_birth).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Gender:</strong> ${orderData.gender || 'N/A'}</p>
            <p><strong>Order Date:</strong> ${new Date(orderData.created_at).toLocaleString()}</p>
          </div>
          
          <div class="summary">
            <h3>Summary</h3>
            <p><strong>Total Tests:</strong> ${testResults.length}</p>
            <p><strong>Abnormal Results:</strong> <span style="color: ${abnormalCount > 0 ? '#ef4444' : '#10b981'}">${abnormalCount}</span></p>
          </div>
          
          <h3>Test Results</h3>
          <table class="test-table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Result</th>
                <th>Unit</th>
                <th>Reference Range</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${testResults.map(test => `
                <tr>
                  <td><strong>${test.name}</strong></td>
                  <td>${test.result_value || 'N/A'}</td>
                  <td>${test.result_unit || ''}</td>
                  <td>${test.reference_range || 'N/A'}</td>
                  <td class="${test.is_abnormal ? 'abnormal' : 'normal'}">
                    ${test.is_abnormal ? '⚠️ ABNORMAL' : 'Normal'}
                  </td>
                </tr>
                ${test.test_notes ? `<tr><td colspan="5" class="note">Note: ${test.test_notes}</td></tr>` : ''}
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p><strong>${orderData.lab_name}</strong><br>
            ${orderData.lab_phone ? `Tel: ${orderData.lab_phone}<br>` : ''}
            ${orderData.lab_email ? `Email: ${orderData.lab_email}<br>` : ''}</p>
            <p>Report generated on ${new Date().toLocaleString()}</p>
            <p><em>This is a computer generated report. No signature is required.</em></p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Send email
    const mailOptions = {
      from: `"${orderData.lab_name}" <${settings?.email_from_address || process.env.EMAIL_USER}>`,
      to: clinicianEmail,
      subject: `🔬 Lab Results: ${orderData.patient_name} - ${orderData.lab_name}`,
      html: htmlContent,
      attachments: testResults.map(test => ({
        filename: `${test.name}.txt`,
        content: `Test: ${test.name}\nResult: ${test.result_value} ${test.result_unit || ''}\nReference: ${test.reference_range || 'N/A'}\nStatus: ${test.is_abnormal ? 'Abnormal' : 'Normal'}\nNotes: ${test.test_notes || 'None'}`
      }))
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    // Log the email
    await client.query(
      `INSERT INTO email_logs (lab_id, order_id, recipient, subject, message_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.labId, orderId, clinicianEmail, `Lab Results: ${orderData.patient_name}`, info.messageId, 'sent']
    );
    
    // Update order status
    await client.query(
      'UPDATE orders SET results_sent_at = NOW(), updated_at = NOW() WHERE id = $1',
      [orderId]
    );
    
    await client.query('COMMIT');
    
    // Emit socket event
    const io = req.app.get('io');
    io.to(`lab_${req.labId}`).emit('resultsSent', { orderId, recipient: clinicianEmail });
    
    res.json({
      success: true,
      message: 'Results sent successfully',
      messageId: info.messageId,
      recipient: clinicianEmail
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Send results error:', err);
    res.status(500).json({ 
      error: 'Failed to send results: ' + err.message,
      details: err.response
    });
  } finally {
    client.release();
  }
});

// ============ SEND REFERRAL NOTIFICATION ============
app.post('/api/notifications/send-referral', authenticate, async (req, res) => {
  const { referralId, type } = req.body;
  
  try {
    const referral = await pool.query(
      `SELECT r.*, 
        p.name as patient_name, p.phone as patient_phone,
        rl.name as reference_lab_name, rl.email as reference_lab_email, rl.phone as reference_lab_phone,
        l.name as lab_name, l.email as lab_email, l.phone as lab_phone
       FROM referrals r
       JOIN patients p ON r.patient_id = p.id
       JOIN reference_labs rl ON r.reference_lab_id = rl.id
       JOIN labs l ON r.lab_id = l.id
       WHERE r.id = $1 AND r.lab_id = $2`,
      [referralId, req.labId]
    );
    
    if (referral.rows.length === 0) {
      return res.status(404).json({ error: 'Referral not found' });
    }
    
    const data = referral.rows[0];
    const settings = await getLabNotificationSettings(req.labId);
    const transporter = createTransporter(settings);
    
    let subject, html;
    
    if (type === 'sent') {
      subject = `🔄 Referral Sent: ${data.patient_name} to ${data.reference_lab_name}`;
      html = `
        <h2>Referral Sent</h2>
        <p>Patient <strong>${data.patient_name}</strong> has been referred to <strong>${data.reference_lab_name}</strong>.</p>
        <p>Referral Number: ${data.referral_number}</p>
        <p>Expected Completion: ${new Date(data.expected_completion).toLocaleDateString()}</p>
      `;
    } else {
      subject = `📥 Referral Results Received: ${data.patient_name}`;
      html = `
        <h2>Referral Results Received</h2>
        <p>Results for patient <strong>${data.patient_name}</strong> have been received from <strong>${data.reference_lab_name}</strong>.</p>
        <p>Referral Number: ${data.referral_number}</p>
        <p>Please log in to view the results.</p>
      `;
    }
    
    // Send to lab admin
    if (settings?.send_to_lab_admin && settings?.admin_emails?.length > 0) {
      for (const adminEmail of settings.admin_emails) {
        await transporter.sendMail({
          from: `"${data.lab_name}" <${settings?.email_from_address || process.env.EMAIL_USER}>`,
          to: adminEmail,
          subject: subject,
          html: html
        });
      }
    }
    
    res.json({ success: true });
    
  } catch (err) {
    console.error('Send referral notification error:', err);
    res.status(500).json({ error: err.message });
  }
});
// Get tests for a specific referral - FIXED FOR YOUR SCHEMA
app.get('/api/referrals/:id/tests', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const labId = req.labId;
    
    console.log('='.repeat(60));
    console.log('🔍 FETCHING TESTS FOR REFERRAL');
    console.log('Referral ID:', id);
    console.log('Lab ID:', labId);
    
    // First verify the referral belongs to this lab
    const referral = await pool.query(
      'SELECT * FROM referrals WHERE id = $1 AND lab_id = $2',
      [id, labId]
    );
    
    if (referral.rows.length === 0) {
      console.log('❌ Referral not found');
      return res.status(404).json({ error: 'Referral not found' });
    }
    
    console.log('✅ Referral found:', referral.rows[0].referral_number);
    
    // Get the tests for this referral - FIXED to use actual columns
    const tests = await pool.query(
      `SELECT rt.*, 
        t.id as test_id, 
        t.name, 
        t.price,
        t.category,
        t.description,
        t.sample_type,
        t.turnaround_time
       FROM referral_tests rt
       JOIN tests t ON rt.test_id = t.id
       WHERE rt.referral_id = $1`,
      [id]
    );
    
    console.log(`✅ Found ${tests.rows.length} tests`);
    console.log('='.repeat(60));
    
    res.json(tests.rows);
  } catch (err) {
    console.error('❌ Error fetching referral tests:', err);
    res.status(500).json({ 
      error: 'Failed to fetch referral tests',
      details: err.message 
    });
  }
});
// ============ DELETE POS SALE ============
app.delete('/api/pos/sales/:saleId', authenticate, async (req, res) => {
  const { saleId } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if sale exists and belongs to this lab
    const saleCheck = await client.query(
      'SELECT * FROM sales WHERE id = $1 AND lab_id = $2',
      [saleId, req.labId]
    );
    
    if (saleCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    const sale = saleCheck.rows[0];
    
    // First, get all sale items to restore stock
    const saleItems = await client.query(
      'SELECT * FROM sale_items WHERE sale_id = $1',
      [saleId]
    );
    
    // Restore stock for each product
    for (const item of saleItems.rows) {
      await client.query(
        `UPDATE products 
         SET stock_quantity = stock_quantity + $1,
             updated_at = NOW()
         WHERE id = $2 AND lab_id = $3`,
        [item.quantity, item.product_id, req.labId]
      );
      
      // Log the stock restoration
      await client.query(
        `INSERT INTO inventory_transactions 
         (lab_id, product_id, user_id, transaction_type, quantity, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [req.labId, item.product_id, req.userId, 'restock', item.quantity, `Restocked from deleted sale #${sale.receipt_number}`]
      );
    }
    
    // Delete sale items
    await client.query('DELETE FROM sale_items WHERE sale_id = $1', [saleId]);
    
    // Delete the sale
    await client.query('DELETE FROM sales WHERE id = $1', [saleId]);
    
    await client.query('COMMIT');
    
    // Log activity
    await logActivity(req.labId, req.userId, 'SALE_DELETED', 'sale', saleId, {
      receipt_number: sale.receipt_number,
      amount: sale.total,
      items_restored: saleItems.rows.length
    });
    
    res.json({ 
      success: true, 
      message: 'Sale deleted successfully',
      restored_items: saleItems.rows.length
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting sale:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// Save manual results for a referral
app.post('/api/referrals/:id/manual-results', authenticate, upload.single('result_file'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const labId = req.labId;
    const { 
      results_text, 
      result_date, 
      conducted_by, 
      notes,
      test_results 
    } = req.body;
    
    console.log('Saving manual results for referral:', id);
    
    // Verify referral belongs to this lab
    const referral = await client.query(
      'SELECT * FROM referrals WHERE id = $1 AND lab_id = $2',
      [id, labId]
    );
    
    if (referral.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Referral not found' });
    }
    
    let filePath = null;
    if (req.file) {
      filePath = `/uploads/referrals/${req.file.filename}`;
    }
    
    // Parse test_results if it's a string
    let parsedTestResults = [];
    if (test_results) {
      parsedTestResults = typeof test_results === 'string' ? JSON.parse(test_results) : test_results;
    }
    
    // Save the results
    const result = await client.query(
      `INSERT INTO referral_results 
       (referral_id, results_text, result_date, conducted_by, notes, file_path, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
       RETURNING id`,
      [id, results_text, result_date, conducted_by, notes, filePath]
    );
    
    // Save individual test results if any
    if (parsedTestResults.length > 0) {
      for (const test of parsedTestResults) {
        await client.query(
          `INSERT INTO referral_test_results 
           (referral_id, test_id, result_value, reference_range, unit, interpretation, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [id, test.test_id, test.result_value, test.reference_range, test.unit, test.interpretation, test.notes || null]
        );
      }
    }
    
    // Update referral status
    await client.query(
      'UPDATE referrals SET status = $1, updated_at = NOW() WHERE id = $2',
      [parsedTestResults.length > 0 ? 'completed' : 'in_progress', id]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      message: 'Results saved successfully',
      result_id: result.rows[0].id 
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving manual results:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get results for a referral
app.get('/api/referrals/:id/results', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const labId = req.labId;
    
    console.log('Fetching results for referral:', id);
    
    // Verify referral belongs to this lab
    const referral = await pool.query(
      `SELECT r.*, p.name as patient_name, rl.name as reference_lab_name 
       FROM referrals r
       JOIN patients p ON r.patient_id = p.id
       JOIN reference_labs rl ON r.reference_lab_id = rl.id
       WHERE r.id = $1 AND r.lab_id = $2`,
      [id, labId]
    );
    
    if (referral.rows.length === 0) {
      return res.status(404).json({ error: 'Referral not found' });
    }
    
    // Get the results summary
    const results = await pool.query(
      'SELECT * FROM referral_results WHERE referral_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    
    // Get individual test results
    const testResults = await pool.query(
      `SELECT rtr.*, t.name as test_name 
       FROM referral_test_results rtr
       JOIN tests t ON rtr.test_id = t.id
       WHERE rtr.referral_id = $1`,
      [id]
    );
    
    // Get attachments
    const attachments = await pool.query(
      'SELECT * FROM referral_attachments WHERE referral_id = $1',
      [id]
    );
    
    res.json({
      ...referral.rows[0],
      results_summary: results.rows[0] || null,
      test_results: testResults.rows,
      attachments: attachments.rows
    });
    
  } catch (err) {
    console.error('Error fetching referral results:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate PDF for referral results - FIXED
app.get('/api/referrals/:id/results/pdf', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const labId = req.labId;
    
    console.log('='.repeat(60));
    console.log('📄 GENERATING PDF FOR REFERRAL');
    console.log('Referral ID:', id);
    console.log('Lab ID:', labId);
    
    if (!id || id === 'undefined') {
      console.log('❌ Invalid referral ID');
      return res.status(400).json({ error: 'Invalid referral ID' });
    }
    
    // Fetch the referral data
    const referral = await pool.query(
      `SELECT r.*, 
        p.name as patient_name, 
        p.phone, 
        p.date_of_birth, 
        p.gender,
        rl.name as reference_lab_name, 
        rl.phone as lab_phone, 
        rl.email as lab_email
       FROM referrals r
       JOIN patients p ON r.patient_id = p.id
       JOIN reference_labs rl ON r.reference_lab_id = rl.id
       WHERE r.id = $1 AND r.lab_id = $2`,
      [id, labId]
    );
    
    if (referral.rows.length === 0) {
      console.log('❌ Referral not found');
      return res.status(404).json({ error: 'Referral not found' });
    }
    
    // Get results summary
    const results = await pool.query(
      'SELECT * FROM referral_results WHERE referral_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    
    // Get test results
    const testResults = await pool.query(
      `SELECT rtr.*, t.name as test_name 
       FROM referral_test_results rtr
       JOIN tests t ON rtr.test_id = t.id
       WHERE rtr.referral_id = $1`,
      [id]
    );
    
    console.log(`✅ Found ${testResults.rows.length} test results`);
    
    // Generate PDF
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=referral_results_${id}.pdf`);
    
    doc.pipe(res);
    
    // Add header
    doc.fontSize(20).text('REFERRAL RESULTS REPORT', { align: 'center' });
    doc.moveDown();
    
    // Referral info
    doc.fontSize(12);
    doc.text(`Referral #: ${referral.rows[0].referral_number}`);
    doc.text(`Patient: ${referral.rows[0].patient_name}`);
    doc.text(`Reference Lab: ${referral.rows[0].reference_lab_name}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    
    // Results summary
    if (results.rows[0]) {
      doc.text(`Result Date: ${new Date(results.rows[0].result_date).toLocaleDateString()}`);
      doc.text(`Conducted By: ${results.rows[0].conducted_by || 'N/A'}`);
      doc.moveDown();
    }
    
    // Test results table
    if (testResults.rows.length > 0) {
      doc.text('TEST RESULTS:', { underline: true });
      doc.moveDown();
      
      const tableTop = doc.y;
      doc.text('Test', 50, tableTop);
      doc.text('Result', 200, tableTop);
      doc.text('Reference', 300, tableTop);
      doc.text('Status', 400, tableTop);
      
      let y = tableTop + 20;
      
      testResults.rows.forEach(test => {
        doc.text(test.test_name, 50, y);
        doc.text(test.result_value || 'N/A', 200, y);
        doc.text(test.reference_range || 'N/A', 300, y);
        
        // Color-code interpretation
        if (test.interpretation === 'normal') {
          doc.fillColor('#10b981').text('Normal', 400, y);
        } else if (test.interpretation === 'abnormal') {
          doc.fillColor('#f59e0b').text('Abnormal', 400, y);
        } else if (test.interpretation === 'critical') {
          doc.fillColor('#ef4444').text('Critical', 400, y);
        } else {
          doc.fillColor('#64748b').text(test.interpretation, 400, y);
        }
        
        doc.fillColor('#000000'); // Reset color
        y += 20;
        
        // Add notes if any
        if (test.notes) {
          doc.fontSize(10).text(`Note: ${test.notes}`, 50, y);
          doc.fontSize(12);
          y += 20;
        }
      });
      
      doc.moveDown();
    } else {
      doc.text('No test results available', { align: 'center' });
      doc.moveDown();
    }
    
    // Additional notes
    if (results.rows[0] && results.rows[0].results_text) {
      doc.moveDown();
      doc.text('ADDITIONAL NOTES:', { underline: true });
      doc.text(results.rows[0].results_text);
    }
    
    // Footer
    doc.moveDown();
    doc.moveDown();
    doc.fontSize(10).text('This is a computer-generated report', { align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });
    
    doc.end();
    console.log('✅ PDF generated successfully');
    
  } catch (err) {
    console.error('❌ Error generating PDF:', err);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: err.message 
    });
  }
});

// Download endpoint - redirect to PDF
app.get('/api/referrals/:id/results/download', authenticate, async (req, res) => {
  const { id } = req.params;
  res.redirect(`/api/referrals/${id}/results/pdf`);
});

// Download referral results (alias for PDF)
app.get('/api/referrals/:id/results/download', authenticate, async (req, res) => {
  // Redirect to the PDF endpoint
  req.url = `/api/referrals/${req.params.id}/results/pdf`;
  app._router.handle(req, res);
});
// ============ LAB LOGO UPLOAD ============

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads/logos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
// Get lab logo - FIXED AND IMPROVED
app.get('/api/labs/logo/:labId', async (req, res) => {
  const { labId } = req.params;
  
  console.log(`🔍 Fetching logo for lab ID: ${labId}`);
  
  try {
    // First check lab_logos table for base64 data
    const result = await pool.query(
      'SELECT logo_data, logo_path FROM lab_logos WHERE lab_id = $1',
      [labId]
    );
    
    // If we have base64 data, serve it directly
    if (result.rows.length > 0 && result.rows[0].logo_data) {
      const logoData = result.rows[0].logo_data;
      const matches = logoData.match(/^data:(.+);base64,(.+)$/);
      
      if (matches) {
        const contentType = matches[1];
        const data = Buffer.from(matches[2], 'base64');
        
        console.log(`✅ Serving base64 logo for lab ${labId}, type: ${contentType}, size: ${data.length} bytes`);
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        res.setHeader('Content-Length', data.length);
        return res.send(data);
      }
    }
    
    // If no base64 data but we have a file path, serve from disk
    if (result.rows.length > 0 && result.rows[0].logo_path) {
      const filePath = path.join(__dirname, result.rows[0].logo_path);
      
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        // Set content type based on file extension
        const contentTypes = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.webp': 'image/webp'
        };
        
        const contentType = contentTypes[ext] || 'application/octet-stream';
        
        console.log(`✅ Serving file logo for lab ${labId}, path: ${filePath}, type: ${contentType}, size: ${stat.size} bytes`);
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Length', stat.size);
        return res.sendFile(filePath);
      }
    }
    
    // Check labs table for logo_url as fallback
    const labResult = await pool.query(
      'SELECT logo_url FROM labs WHERE id = $1',
      [labId]
    );
    
    if (labResult.rows.length > 0 && labResult.rows[0].logo_url) {
      const logoUrl = labResult.rows[0].logo_url;
      
      // If it's a file path (not the API endpoint)
      if (!logoUrl.startsWith('/api/')) {
        const filePath = path.join(__dirname, logoUrl);
        
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const contentTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif'
          };
          
          console.log(`✅ Serving fallback file logo for lab ${labId}`);
          
          res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.sendFile(filePath);
        }
      }
    }
    
    // No logo found
    console.log(`❌ No logo found for lab ${labId}`);
    res.status(404).json({ error: 'Logo not found' });
    
  } catch (err) {
    console.error('❌ Error fetching logo:', err);
    res.status(500).json({ error: err.message });
  }
});
// Debug endpoint to check logo status
app.get('/api/debug/logo-status/:labId', authenticate, async (req, res) => {
  const { labId } = req.params;
  
  try {
    // Check lab_logos table
    const logos = await pool.query(
      'SELECT id, lab_id, logo_filename, logo_path, created_at, updated_at, LENGTH(logo_data) as data_length FROM lab_logos WHERE lab_id = $1',
      [labId]
    );
    
    // Check labs table
    const labs = await pool.query(
      'SELECT id, name, logo_url FROM labs WHERE id = $1',
      [labId]
    );
    
    // Check if file exists on disk
    let fileExists = false;
    let fileSize = 0;
    let fileModified = null;
    
    if (logos.rows.length > 0 && logos.rows[0].logo_path) {
      const filePath = path.join(__dirname, logos.rows[0].logo_path);
      if (fs.existsSync(filePath)) {
        fileExists = true;
        const stat = fs.statSync(filePath);
        fileSize = stat.size;
        fileModified = stat.mtime;
      }
    }
    
    // Check if API endpoint is accessible
    const apiUrl = `/api/labs/logo/${labId}`;
    
    res.json({
      lab_id: labId,
      lab_info: {
        name: labs.rows[0]?.name,
        logo_url_in_labs: labs.rows[0]?.logo_url
      },
      lab_logos_table: logos.rows.length > 0 ? {
        id: logos.rows[0].id,
        filename: logos.rows[0].logo_filename,
        path: logos.rows[0].logo_path,
        data_length: logos.rows[0].data_length,
        has_data: logos.rows[0].data_length > 0,
        created_at: logos.rows[0].created_at,
        updated_at: logos.rows[0].updated_at
      } : null,
      file_on_disk: {
        exists: fileExists,
        size: fileSize,
        modified: fileModified
      },
      api_endpoint: apiUrl,
      recommended_logo_url: apiUrl // This is what you should use
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Direct test endpoint for logo
app.get('/api/debug/view-logo/:labId', async (req, res) => {
  const { labId } = req.params;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Logo Test for Lab ${labId}</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        .logo-container { margin: 20px 0; padding: 20px; border: 2px dashed #ccc; }
        img { max-width: 300px; max-height: 200px; border: 1px solid #ddd; }
        .success { color: green; }
        .error { color: red; }
      </style>
    </head>
    <body>
      <h1>Logo Test for Lab ${labId}</h1>
      
      <div class="logo-container">
        <h3>Logo from API:</h3>
        <img 
          src="/api/labs/logo/${labId}" 
          alt="Lab Logo"
          onload="this.classList.add('success'); document.getElementById('status').innerHTML = '✅ Logo loaded successfully'"
          onerror="this.classList.add('error'); document.getElementById('status').innerHTML = '❌ Failed to load logo'"
        />
        <p id="status">Loading...</p>
      </div>
      
      <div>
        <h3>Debug Info:</h3>
        <p>API URL: <code>/api/labs/logo/${labId}</code></p>
        <p><a href="/api/debug/logo-status/${labId}" target="_blank">Check Logo Status</a></p>
      </div>
    </body>
    </html>
  `);
});


// DEBUG ENDPOINT 1: Check what's in the database
app.get('/api/debug/logo-check/:labId', authenticate, async (req, res) => {
  const { labId } = req.params;
  
  try {
    // Check lab_logos table
    const logos = await pool.query(
      'SELECT id, lab_id, logo_filename, logo_path, LENGTH(logo_data) as data_length, created_at FROM lab_logos WHERE lab_id = $1',
      [labId]
    );
    
    // Check labs table
    const labs = await pool.query(
      'SELECT id, name, logo_url FROM labs WHERE id = $1',
      [labId]
    );
    
    res.json({
      lab_logos: logos.rows,
      labs: labs.rows,
      logo_data_preview: logos.rows[0]?.logo_data ? logos.rows[0].logo_data.substring(0, 100) + '...' : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DEBUG ENDPOINT 2: Test logo serving directly
app.get('/api/debug/logo-test/:labId', async (req, res) => {
  const { labId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT logo_data FROM lab_logos WHERE lab_id = $1',
      [labId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No logo found' });
    }
    
    const logoData = result.rows[0].logo_data;
    
    // Try to parse and return as image
    const matches = logoData.match(/^data:(.+);base64,(.+)$/);
    if (matches) {
      const contentType = matches[1];
      const data = Buffer.from(matches[2], 'base64');
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'inline');
      return res.send(data);
    }
    
    res.status(400).json({ error: 'Invalid logo format' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Start server with error handling
const PORT = process.env.PORT || 5002;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 API URL: http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`❌ Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
    server.listen(PORT + 1);
  } else {
    console.error('Server error:', err);
  }
});