const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

async function seed() {
    let conn;
    try {
        conn = await db.getConnection();
        console.log('🔄 Connected to database. Starting seed process...');

        // 1. Disable Foreign Key checks to clear tables safely
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        await conn.query('TRUNCATE TABLE transactions');
        await conn.query('TRUNCATE TABLE event_expenses');
        await conn.query('TRUNCATE TABLE events');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('🗑️ Existing events and transactions cleared.');

        // 2. Insert Events
        const events = [
            { id: 1, name: 'SAIT Techfusion 2025', budget: 100000.00, allocated: 36000.00 },
            { id: 2, name: 'Alumni Meet 2025', budget: 40000.00, allocated: 15500.00 },
            { id: 3, name: 'SAIT CodeStorm Hackathon', budget: 30000.00, allocated: 9500.00 },
            { id: 4, name: 'WebDev Seminar & Workshop', budget: 15000.00, allocated: 6000.00 },
            { id: 5, name: 'SAIT Sports Meet', budget: 20000.00, allocated: 7500.00 }
        ];

        for (const e of events) {
            await conn.query(
                'INSERT INTO events (id, name, budget, allocated) VALUES (?, ?, ?, ?)',
                [e.id, e.name, e.budget, e.allocated]
            );
        }
        console.log('📅 5 Events inserted successfully.');

        // 3. Define Event Transactions
        const transactions = [
            // Event 1: SAIT Techfusion 2025 (debit sum = 36000)
            { event_id: 1, description: 'Techfusion Sponsorship from Tech Corp', amount: 25000.00, type: 'credit' },
            { event_id: 1, description: 'Techfusion Student Registration Fees', amount: 15000.00, type: 'credit' },
            { event_id: 1, description: 'Techfusion Printing & Posters', amount: 3000.00, type: 'debit' },
            { event_id: 1, description: 'Techfusion Stationery & Certificates', amount: 2000.00, type: 'debit' },
            { event_id: 1, description: 'Techfusion Lunch & Refreshments', amount: 15000.00, type: 'debit' },
            { event_id: 1, description: 'Techfusion Sound & Stage Rental', amount: 10000.00, type: 'debit' },
            { event_id: 1, description: 'Techfusion Winner Trophies', amount: 6000.00, type: 'debit' },

            // Event 2: Alumni Meet 2025 (debit sum = 15500)
            { event_id: 2, description: 'Alumni Association Funds Contribution', amount: 10000.00, type: 'credit' },
            { event_id: 2, description: 'Alumni High Tea & Catering', amount: 8000.00, type: 'debit' },
            { event_id: 2, description: 'Guest Bouquets & Flowers', amount: 1500.00, type: 'debit' },
            { event_id: 2, description: 'Alumni Mementos & Gifts', amount: 4500.00, type: 'debit' },
            { event_id: 2, description: 'Event Photographer Fee', amount: 1500.00, type: 'debit' },

            // Event 3: SAIT CodeStorm Hackathon (debit sum = 9500)
            { event_id: 3, description: 'CodeStorm Team Registration Fees', amount: 4500.00, type: 'credit' },
            { event_id: 3, description: 'Hackathon Flex Banner Design', amount: 1500.00, type: 'debit' },
            { event_id: 3, description: 'Hackathon Winner Cash Prizes', amount: 5000.00, type: 'debit' },
            { event_id: 3, description: 'Late Night Snacks & Energy Drinks', amount: 3000.00, type: 'debit' },

            // Event 4: WebDev Seminar & Workshop (debit sum = 6000)
            { event_id: 4, description: 'Workshop Expert Speaker Remuneration', amount: 4000.00, type: 'debit' },
            { event_id: 4, description: 'Seminar Tea & Coffee Refreshments', amount: 1200.00, type: 'debit' },
            { event_id: 4, description: 'Workshop Notepads & Pens', amount: 800.00, type: 'debit' },

            // Event 5: SAIT Sports Meet (debit sum = 7500)
            { event_id: 5, description: 'Sports Equipment (Balls & Whistles)', amount: 3500.00, type: 'debit' },
            { event_id: 5, description: 'Sports Medals & Trophies', amount: 2500.00, type: 'debit' },
            { event_id: 5, description: 'Sports Energy Drinks & Glucose', amount: 1500.00, type: 'debit' }
        ];

        // 4. Insert into both transactions and event_expenses tables
        for (const t of transactions) {
            // General transactions table
            await conn.query(
                'INSERT INTO transactions (description, amount, type, event_id) VALUES (?, ?, ?, ?)',
                [t.description, t.amount, t.type, t.event_id]
            );

            // Event expenses table
            await conn.query(
                'INSERT INTO event_expenses (event_id, description, amount, type) VALUES (?, ?, ?, ?)',
                [t.event_id, t.description, t.amount, t.type]
            );
        }

        // 5. Insert some general global transactions (not tied to any specific event)
        const generalTransactions = [
            { description: 'Initial Bank Account Balance Credit', amount: 150000.00, type: 'credit' },
            { description: 'Monthly SAIT Office Domain Hosting Renewal', amount: 1200.00, type: 'debit' },
            { description: 'SAIT General Club Membership Fee Collections', amount: 8500.00, type: 'credit' }
        ];

        for (const gt of generalTransactions) {
            await conn.query(
                'INSERT INTO transactions (description, amount, type, event_id) VALUES (?, ?, ?, NULL)',
                [gt.description, gt.amount, gt.type]
            );
        }

        console.log('💰 Event transactions and General transactions inserted successfully.');
        console.log('✅ Seeding completed successfully!');
        process.exit(0);

    } catch (err) {
        console.error('❌ Seeding failed with error:', err);
        process.exit(1);
    } finally {
        if (conn) conn.release();
    }
}

seed();
