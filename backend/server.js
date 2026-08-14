const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'glowar_luxury_session_secret_key_2026_spec';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend'))); // Serve static frontend from frontend folder

// Middleware to authenticate JWT tokens
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required. Please sign in.' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Session expired or invalid. Please sign in again.' });
        }
        req.user = decoded;
        next();
    });
}

// ==========================================================================
// Authentication Routes
// ==========================================================================

// User Register / Signup
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Please enter all details.' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    
    try {
        // Check if user exists
        const existingUser = await db.query.get('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ error: 'Account with this email already exists.' });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // Save user
        const result = await db.query.run(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            [name, email, passwordHash]
        );
        
        const userId = result.id;
        
        // Sign JWT
        const token = jwt.sign({ id: userId, name, email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({
            token,
            user: { id: userId, name, email }
        });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Database error occurred during signup.' });
    }
});

// User Sign In / Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    
    try {
        // Get user
        const user = await db.query.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }
        
        // Validate password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }
        
        // Sign JWT
        const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Database error occurred during login.' });
    }
});

// Token session status check
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await db.query.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return res.status(404).json({ error: 'User profile not found.' });
        }
        res.json({ user });
    } catch (err) {
        console.error('Profile fetch error:', err);
        res.status(500).json({ error: 'Failed to retrieve profile.' });
    }
});

// ==========================================================================
// Catalog Product Routes
// ==========================================================================
app.get('/api/products', async (req, res) => {
    try {
        const items = await db.query.all(`
            SELECT *, 
                   color AS shade_color, 
                   (opacity * 100) AS opacity_pct, 
                   (CASE WHEN badge = 'BESTSELLER' THEN 1 ELSE 0 END) AS is_bestseller 
            FROM products
        `);
        res.json(items);
    } catch (err) {
        console.error('Catalog fetch error:', err);
        res.status(500).json({ error: 'Failed to retrieve luxury product catalog.' });
    }
});

// ==========================================================================
// User Cart Syncing Routes
// ==========================================================================
app.get('/api/cart', authenticateToken, async (req, res) => {
    try {
        const items = await db.query.all(
            'SELECT item_id as id, name, price FROM cart WHERE user_id = ? ORDER BY id ASC',
            [req.user.id]
        );
        res.json({ cart: items });
    } catch (err) {
        console.error('Cart fetch error:', err);
        res.status(500).json({ error: 'Failed to sync bag contents.' });
    }
});

// Replace / Sync whole cart
app.post('/api/cart', authenticateToken, async (req, res) => {
    const { items } = req.body; // Expects array [{ id, name, price }]
    
    if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Invalid payload structure. Expected items array.' });
    }
    
    try {
        // Clear all previous items for that user
        await db.query.run('DELETE FROM cart WHERE user_id = ?', [req.user.id]);
        
        // Bulk insert items if any
        if (items.length > 0) {
            const insertStmt = 'INSERT INTO cart (item_id, user_id, name, price) VALUES (?, ?, ?, ?)';
            for (const item of items) {
                await db.query.run(insertStmt, [item.id, req.user.id, item.name, item.price]);
            }
        }
        
        res.json({ message: 'Shopping bag synced successfully.', count: items.length });
    } catch (err) {
        console.error('Cart sync error:', err);
        res.status(500).json({ error: 'Failed to sync shopping bag.' });
    }
});

// ==========================================================================
// Skin Diagnostics Assessment Routes
// ==========================================================================
app.post('/api/diagnostics', authenticateToken, async (req, res) => {
    const { score, hydration, uniformity, redness, spots } = req.body;
    
    if (score === undefined || hydration === undefined || uniformity === undefined || redness === undefined || spots === undefined) {
        return res.status(400).json({ error: 'Missing health metric score details.' });
    }
    
    try {
        const result = await db.query.run(
            'INSERT INTO diagnostics (user_id, score, hydration, uniformity, redness, spots) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, score, hydration, uniformity, redness, spots]
        );
        
        const newRecord = await db.query.get('SELECT * FROM diagnostics WHERE id = ?', [result.id]);
        res.status(251).json({
            message: 'Diagnosis report logged successfully.',
            report: newRecord
        });
    } catch (err) {
        console.error('Save diagnostic error:', err);
        res.status(500).json({ error: 'Failed to save skin health report.' });
    }
});

app.get('/api/diagnostics', authenticateToken, async (req, res) => {
    try {
        const history = await db.query.all(
            'SELECT * FROM diagnostics WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(history);
    } catch (err) {
        console.error('Diagnostics history fetch error:', err);
        res.status(500).json({ error: 'Failed to retrieve assessment history.' });
    }
});

// ==========================================================================
// Order Completion (Checkout) Routes
// ==========================================================================
app.post('/api/orders', authenticateToken, async (req, res) => {
    const { items, subtotal } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Order must contain items.' });
    }
    
    try {
        const itemsJson = JSON.stringify(items);
        
        // Save order
        const result = await db.query.run(
            'INSERT INTO orders (user_id, items_json, subtotal) VALUES (?, ?, ?)',
            [req.user.id, itemsJson, subtotal]
        );
        
        // Clear cart for the user
        await db.query.run('DELETE FROM cart WHERE user_id = ?', [req.user.id]);
        
        res.status(201).json({
            message: 'Order created successfully.',
            orderId: result.id,
            transactionId: 'GLW-' + Math.floor(Math.random() * 900000 + 100000),
            date: new Date(),
            items: items
        });
    } catch (err) {
        console.error('Order checkout error:', err);
        res.status(500).json({ error: 'Failed to process checkout transaction.' });
    }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const history = await db.query.all(
            'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        
        // Parse items_json on return
        const formattedHistory = history.map(order => ({
            ...order,
            items: JSON.parse(order.items_json)
        }));
        
        res.json(formattedHistory);
    } catch (err) {
        console.error('Order history fetch error:', err);
        res.status(500).json({ error: 'Failed to retrieve purchase orders.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`GLOW AR Server running locally at http://localhost:${PORT}`);
});
