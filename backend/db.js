const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'glowar.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to the SQLite database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

// Promise-based wrappers for cleaner async/await usage
const query = {
    run: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    },
    get: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    all: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
};

async function initDb() {
    try {
        // 1. Users Table
        await query.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Products Catalog Table
        await query.run(`
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                color TEXT NOT NULL,
                opacity REAL NOT NULL,
                finish TEXT NOT NULL,
                price REAL NOT NULL,
                description TEXT,
                image TEXT,
                badge TEXT
            )
        `);

        // 3. Cart Table (associated with product details and user ID)
        await query.run(`
            CREATE TABLE IF NOT EXISTS cart (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 4. diagnostics History Table
        await query.run(`
            CREATE TABLE IF NOT EXISTS diagnostics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                score INTEGER NOT NULL,
                hydration INTEGER NOT NULL,
                uniformity INTEGER NOT NULL,
                redness INTEGER NOT NULL,
                spots INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 5. Orders Table
        await query.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                items_json TEXT NOT NULL,
                subtotal REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Database tables verified/created successfully.');
        await seedProducts();

    } catch (err) {
        console.error('Failed to initialize database tables:', err.message);
    }
}

async function seedProducts() {
    try {
        const countRow = await query.get('SELECT COUNT(*) as count FROM products');
        if (countRow.count > 0) {
            console.log('Product catalog database is already seeded.');
            return;
        }

        const initialProducts = [
            {
                id: 'p1',
                name: 'Crimson Satin Lipstick',
                category: 'lips',
                color: '#e63946',
                opacity: 0.7,
                finish: 'matte',
                price: 34.00,
                description: 'Ultra-pigmented cushion matte, formulated with micro-dispersed seed oils and pure red botanical pigments.',
                image: 'lipstick',
                badge: 'BESTSELLER'
            },
            {
                id: 'p2',
                name: 'Mulberry Wine Polish',
                category: 'lips',
                color: '#560bad',
                opacity: 0.6,
                finish: 'glossy',
                price: 36.00,
                description: 'High-luster lip lacquer offering glass-like reflection with comfortable ceramide barrier protection.',
                image: 'lipstick',
                badge: ''
            },
            {
                id: 'p3',
                name: 'Atelier Soft Tulip Blush',
                category: 'cheeks',
                color: '#ff87ab',
                opacity: 0.4,
                finish: 'matte',
                price: 28.00,
                description: 'Cashmere cream-to-powder blush that diffuses skin pores and provides a soft candlelit rose glow.',
                image: 'blush',
                badge: ''
            },
            {
                id: 'p4',
                name: 'Gold Dust Celestial Shadow',
                category: 'eyes',
                color: '#ffb703',
                opacity: 0.5,
                finish: 'shimmer',
                price: 32.00,
                description: 'Fine-milled mineral powder that captures the light. Builds easily from a sheer shimmer to rich liquid gold.',
                image: 'eyeshadow',
                badge: 'NEW RELEASE'
            },
            // Additional Premium Products
            {
                id: 'p5',
                name: 'Velvet Muse Red Lipstick',
                category: 'lips',
                color: '#d90429',
                opacity: 0.75,
                finish: 'matte',
                price: 34.00,
                description: 'A true iconic red with intense hydration and a velvety, light-as-air matte overlay finish.',
                image: 'lipstick',
                badge: 'LIMITED'
            },
            {
                id: 'p6',
                name: 'Sunset Kiss Orange Lacquer',
                category: 'lips',
                color: '#ff5400',
                opacity: 0.7,
                finish: 'glossy',
                price: 36.00,
                description: 'Vibrant sunrise-orange lacquer gloss infused with citrus botanicals and high-density gloss molecules.',
                image: 'lipstick',
                badge: ''
            },
            {
                id: 'p7',
                name: 'Desert Sun Matte Bronzer',
                category: 'cheeks',
                color: '#dda15e',
                opacity: 0.35,
                finish: 'matte',
                price: 30.00,
                description: 'A sun-kissed matte warmth that sculpts facial contours and diffuses pores dynamically.',
                image: 'blush',
                badge: 'TRENDING'
            },
            {
                id: 'p8',
                name: 'Cosmopolitan Lavender Eye Dust',
                category: 'eyes',
                color: '#8338ec',
                opacity: 0.4,
                finish: 'shimmer',
                price: 32.00,
                description: 'A stellar violet-indigo shadow dust with micro-reflective duo-chrome pearls for digital sparkle.',
                image: 'eyeshadow',
                badge: ''
            }
        ];

        const insertStmt = 'INSERT INTO products (id, name, category, color, opacity, finish, price, description, image, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        for (const prod of initialProducts) {
            await query.run(insertStmt, [
                prod.id,
                prod.name,
                prod.category,
                prod.color,
                prod.opacity,
                prod.finish,
                prod.price,
                prod.description,
                prod.image,
                prod.badge
            ]);
        }

        console.log('Seeded SQLite product catalog successfully: seeded 8 products.');

    } catch (err) {
        console.error('Failed to seed products database:', err.message);
    }
}

module.exports = {
    query,
    db
};
