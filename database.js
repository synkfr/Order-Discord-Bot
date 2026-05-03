const Database = require('better-sqlite3');
const db = new Database('orderbot.db');

// Initialize Tables
db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
        short_id TEXT PRIMARY KEY,
        staff_id TEXT,
        freelancer_id TEXT,
        status TEXT,
        price TEXT,
        service TEXT,
        description TEXT,
        attachment_url TEXT,
        forum_post_id TEXT,
        ticket_channel_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT,
        customer_id TEXT,
        employee_id TEXT,
        rating INTEGER,
        feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

module.exports = {
    // Orders
    createOrder: (data) => {
        const stmt = db.prepare('INSERT INTO orders (short_id, staff_id, status, price, service, description, attachment_url, forum_post_id, ticket_channel_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        return stmt.run(data.shortId, data.staffId, 'AVAILABLE', data.price, data.service, data.description, data.attachmentUrl, data.forumPostId, data.ticketChannelId);
    },
    updateOrderClaim: (shortId, freelancerId) => {
        const stmt = db.prepare('UPDATE orders SET freelancer_id = ?, status = ? WHERE short_id = ?');
        return stmt.run(freelancerId, 'CLAIMED', shortId);
    },
    updateOrderStatus: (shortId, status) => {
        const stmt = db.prepare('UPDATE orders SET status = ? WHERE short_id = ?');
        return stmt.run(status, shortId);
    },
    getOrder: (shortId) => {
        return db.prepare('SELECT * FROM orders WHERE short_id = ?').get(shortId);
    },
    getOrderByMsgId: (msgId) => {
        return db.prepare('SELECT * FROM orders WHERE forum_post_id = ?').get(msgId);
    },
    getOrderByTicketId: (ticketId) => {
        return db.prepare('SELECT * FROM orders WHERE ticket_channel_id = ?').get(ticketId);
    },
    getActiveOrdersCount: (freelancerId) => {
        return db.prepare('SELECT COUNT(*) as count FROM orders WHERE freelancer_id = ? AND status = ?').get(freelancerId, 'CLAIMED').count;
    },

    // Reviews
    createReview: (data) => {
        const stmt = db.prepare('INSERT INTO reviews (order_id, customer_id, employee_id, rating, feedback) VALUES (?, ?, ?, ?, ?)');
        return stmt.run(data.orderId || null, data.customerId, data.employeeId, data.rating, data.feedback);
    }
};
