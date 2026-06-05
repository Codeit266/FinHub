const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const nodemailer = require("nodemailer");
const { exec } = require('child_process');
const PDFDocument = require('pdfkit');
const historyRoutes = require('./history.js');
const session = require('express-session');

dotenv.config();
const app = express();
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: 'SAIT@123', // 🔒 use a strong secret!
  resave: false,
  saveUninitialized: false,
  rolling:true,
  cookie: {
    secure: false, // true if you're using HTTPS
    httpOnly: true,
    sameSite: 'Strict',
  }
}));

// const pool = mysql.createPool({
//     host: 'shortline.proxy.rlwy.net',
//     user: 'root',
//     password: 'SYbiDeCcGEGswBETPEXPRHOTzeMMgyZN',
//     database: 'railway',
//     port: 53640
//   });

app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/api', historyRoutes);
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/login.html"));
  });



// 🟢 Connect to Database
const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

(async () => {
  try {
    const conn = await db.getConnection();
    console.log('✅ MySQL Connected');
    conn.release();
  } catch (err) {
    console.error('❌ MySQL Connection Failed:', err);
  }
})();


const otpStore = {};



// Email setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

app.get('/', (req, res) => {
    res.send('✅ FinHub backend is live!');
  });
  

app.get('/download-pdf-report', async (req, res) => {
    const { period } = req.query;
    let startDate, endDate;
    const today = new Date();
  
    if (period === 'monthly') {
      startDate = '2025-04-01';
      endDate = '2025-04-30';
    } else if (period === 'yearly') {
      startDate = '2025-01-01';
      endDate = '2025-12-31';
    } else {
      return res.status(400).send('Invalid period');
    }
  
    try {
      const [transactions] = await db.query(
        `SELECT * FROM transactions WHERE created_at BETWEEN ? AND ? ORDER BY created_at ASC`,
        [startDate, endDate]
      );
  
      let totalCredit = 0;
      let totalDebit = 0;
      transactions.forEach(tx => {
        if (tx.type === 'credit') totalCredit += parseFloat(tx.amount);
        else totalDebit += parseFloat(tx.amount);
      });
      const netBalance = totalCredit - totalDebit;
  
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=transaction-report.pdf');
      doc.pipe(res);
  
      // Header
      doc.fontSize(20).text('Transaction Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Period: ${period === 'monthly' ? 'April 2025' : 'Year 2025'}`, { align: 'center' });
      doc.text(`Generated on: ${today.toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(1);
  
      // Table Headers
      const tableTop = doc.y;
      const col1 = 50, col2 = 90, col3 = 300, col4 = 380, col5 = 450;
  
      doc.font('Helvetica-Bold');
      doc.fontSize(12);
      doc.text('S.No', col1, tableTop);
      doc.text('Description', col2, tableTop);
      doc.text('Amount', col3, tableTop);
      doc.text('Type', col4, tableTop);
      doc.text('Date', col5, tableTop);
      doc.moveTo(col1, tableTop + 15).lineTo(550, tableTop + 15).stroke();
      doc.moveDown(1);
      doc.font('Helvetica');
  
      // Table rows
      let y = tableTop + 25;
     
      transactions.forEach((tx, index) => {
        doc.text(index + 1, col1, y);
        doc.text(tx.description, col2, y, { width: 200 });
        doc.text(`${parseFloat(tx.amount).toFixed(2)}`, col3, y);
        doc.text(tx.type.charAt(0).toUpperCase() + tx.type.slice(1), col4, y);
        doc.text(new Date(tx.created_at).toLocaleDateString(), col5, y);
        y += 20;
      });
  
      // Summary section
      y += 30;
      doc.font('Helvetica-Bold').text('Summary', col1, y);
      doc.font('Helvetica');
      y += 20;
      doc.text(`Total Credit: ${totalCredit.toFixed(2)}`, col1, y);
      y += 15;
      doc.text(`Total Debit:  ${totalDebit.toFixed(2)}`, col1, y);
      y += 15;
      doc.text(`Net Balance:  ${netBalance.toFixed(2)}`, col1, y);
  
      doc.end();
    } catch (err) {
      console.error('Error generating PDF:', err);
      res.status(500).send('Error generating report');
    }
  });
  
app.get('/download-pdf', (req, res) => {
    const filePath = path.join(__dirname, 'transactions_report.pdf');
    let responded = false; // ✅ Flag to avoid multiple responses

    // Run export.js to generate the PDF
    exec('node export.js', (err, stdout, stderr) => {
        if (err) {
            console.error('Error executing export.js:', err);
            return res.status(500).send('Failed to generate PDF.');
        }

        const checkInterval = setInterval(() => {
            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (!err && !responded) {
                    responded = true; // ✅ Mark as responded
                    clearInterval(checkInterval);
                    return res.download(filePath, 'transactions_report.pdf');
                }
            });
        }, 200);

        // Failsafe timeout
        setTimeout(() => {
            if (!responded) {
                responded = true; // ✅ Mark as responded
                clearInterval(checkInterval);
                res.status(404).send('PDF not found.');
            }
        }, 5000);
    });
});


app.get('/download-csv', (req, res) => {
    const filePath = path.join(__dirname, 'transactions_report.csv');

    exec('node export-csv.js', (err) => {
        if (err) {
            console.error('CSV generation failed:', err);
            return res.status(500).send('Failed to generate CSV.');
        }

        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (!err) {
                res.download(filePath, 'transactions_report.csv');
            } else {
                res.status(404).send('CSV file not found.');
            }
        });
    });
});



// Login → send OTP
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM users WHERE username = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    const user = rows[0];

    // Compare plain-text password with password_hash as stored in database
    if (user.password_hash !== password) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    otpStore[email] = {
      otp,
      expires: Date.now() + 5 * 60 * 1000,
      role: user.role
    };

    try {
      await transporter.sendMail({
        from: `"FinHub" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "FinHub OTP Verification",
        text: `Hello,\n\nYour OTP for this session is ${otp}\nThank you.\n\n`
      });
      console.log(`✉️ OTP successfully sent to ${email}`);
    } catch (mailErr) {
      console.error("❌ Nodemailer failed to send email:", mailErr);
      return res.status(500).json({
        error: "Failed to send OTP to email."
      });
    }

    res.json({
      message: "OTP sent to email"
    });

  } catch (err) {
    console.error("❌ Login Error:", err);

    res.status(500).json({
      error: "An internal server error occurred during login"
    });
  }
});

// Verify OTP
app.post("/auth/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  const record = otpStore[email];

  if (!record) {
    return res.status(401).json({
      error: "OTP not found"
    });
  }

  if (Date.now() > record.expires) {
    delete otpStore[email];

    return res.status(401).json({
      error: "OTP expired"
    });
  }

  if (record.otp !== otp) {
    return res.status(401).json({
      error: "Invalid OTP"
    });
  }

  delete otpStore[email];

  res.json({
    message: "OTP verified",
    role: record.role
  });
});

// const db2 = mysql.createPool({
//     host:process.env.DB_HOST2,
//     user: process.env.DB_USER2,
//     password: process.env.DB_PASS2,
//     database: process.env.DB_NAME2

// })



console.log('✅ Connected to MySQL');

// 🟢 Fetch all transactions
app.get("/transactions", async (req, res) => {
    try {
        const [transactions] = await db.query("SELECT * FROM transactions ORDER BY created_at DESC");
        // console.log("✅ Sending Transactions:", transactions); // Debugging
        res.json(transactions); // ✅ Ensure JSON response
    } catch (error) {
        console.error("❌ Error fetching transactions:", error);
        res.status(500).json({ error: "Internal Server Error" }); // ✅ Proper error handling
    }
});

app.get('/api/finance-summary', async (req, res) => {
    const query = `
        SELECT description, SUM(amount) AS total_amount
        FROM transactions
        GROUP BY description;
    `;

    try {
        const [results] = await db.execute(query);
        res.json(results);
    } catch (err) {
        console.error('❌ Error fetching finance summary:', err.message);
        res.status(500).json({ error: err.message });
    }
});



// 🟢 Add a new transaction
app.post('/transactions', async (req, res) => {
    try {
        const { description, amount, type, created_at, event_id } = req.body;

        if (!description || !amount || !type) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        let sql, params;

        if (event_id) {
            sql = `
                INSERT INTO transactions (description, amount, type, event_id, created_at)
                VALUES (?, ?, ?, ?, ?)
            `;
            params = [description, parseFloat(amount), type, event_id, created_at || new Date()];
        } else {
            sql = `
                INSERT INTO transactions (description, amount, type, created_at)
                VALUES (?, ?, ?, ?)
            `;
            params = [description, parseFloat(amount), type, created_at || new Date()];
        }

        const [result] = await db.query(sql, params);

        res.status(201).json({ message: "Transaction added", transaction_id: result.insertId });
    } catch (err) {
        console.error("Error inserting transaction:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});


// 🟢 Fetch a single transaction by ID
app.get('/transaction/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query("SELECT * FROM transactions WHERE id = ?", [id]);

        if (result.length === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        console.log("✅ Fetching Transaction:", result[0]);
        res.json(result[0]); // Send transaction data
    } catch (err) {
        console.error("❌ Error fetching transaction:", err);
        res.status(500).json({ error: err.message });
    }
});




app.put('/transaction/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { description, amount, type, created_at } = req.body;

        console.log("🛠 Update Request Received");
        console.log("Transaction ID:", id);
        console.log("Request Body:", req.body);

        if (!description || !amount || !type || !created_at) {
            console.error("❌ Missing fields in request!");
            return res.status(400).json({ error: "All fields are required!" });
        }

        const query = "UPDATE transactions SET description = ?, amount = ?, type = ?, created_at = ? WHERE id = ?";
        const values = [description, amount, type, created_at, id];

        const [result] = await db.query(query, values);

        console.log("📝 SQL Query:", query);
        console.log("🔢 Values:", values);

        if (result.affectedRows === 0) {
            console.error("❌ No transaction found with this ID!");
            return res.status(404).json({ error: "Transaction not found" });
        }

        console.log("✅ Transaction updated successfully!");
        res.json({ success: true, message: "Transaction updated successfully" });
    } catch (err) {
        console.error("❌ Error updating transaction:", err.message);
        res.status(500).json({ error: err.message });
    }
});



// 🟢 Delete a transaction
app.delete('/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [transaction] = await db.query("SELECT event_id, amount FROM transactions WHERE id = ?", [id]);

        if (transaction.length > 0 && transaction[0].event_id) {
            await db.query(
                "UPDATE events SET allocated = allocated - ?, remaining = remaining + ? WHERE id = ?",
                [transaction[0].amount, transaction[0].amount, transaction[0].event_id]
            );
        }

        await db.query("DELETE FROM transactions WHERE id = ?", [id]);

        res.json({ message: "✅ Transaction deleted" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete transaction" });
    }
});

// 🟢 Fetch all events
app.get('/events', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM events ORDER BY created_at DESC');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch events" });
    }
});


// ✅ Add Event Route
app.post('/events', async (req, res) => {
    try {
        console.log("📥 Received Event Data:", req.body);

        const { name, budget } = req.body;

        // Validate input
        if (!name || !budget || isNaN(budget) || budget <= 0) {
            return res.status(400).json({ error: "⚠ Invalid input: Name must be provided, and budget must be a positive number." });
        }

        // Insert into database
        const [result] = await db.query(
            "INSERT INTO events (name, budget, allocated) VALUES (?, ?, ?)",
            [name, parseFloat(budget), 0]
        );

        console.log("✅ Event Inserted with ID:", result.insertId);
        res.status(201).json({ message: "✅ Event added successfully", event_id: result.insertId });

    } catch (err) {
        console.error("❌ Database Error:", err);
        res.status(500).json({ 
            error: "❌ Database error", 
            details: err.sqlMessage || err.message || "Unknown error"
        });
    }
});


app.get('/events/:id', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
        if (results.length === 0) return res.status(404).json({ error: "Event not found" });
        res.json(results[0]);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch event details" });
    }
});

// ✅ Add a transaction to an event
app.post('/events/:id/transactions', async (req, res) => {
    try {
        const { description, amount, type } = req.body;
        const eventId = req.params.id;

        if (!description || !amount || !type) {
            return res.status(400).json({ error: "⚠ Missing required fields" });
        }

        const [result] = await db.query(
            "INSERT INTO event_expenses (event_id, description, amount, type) VALUES (?, ?, ?, ?)",
            [eventId, description, parseFloat(amount), type]
        );

        res.status(201).json({ message: "Transaction added successfully!", transaction_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: "Database error", details: err.sqlMessage });
    }
});

// ✅ Fetch all transactions for a specific event
app.get('/events/:id/transactions', async (req, res) => {
    try {
        const [transactions] = await db.query(
            "SELECT * FROM event_expenses WHERE event_id = ? ORDER BY created_at DESC", 
            [req.params.id]
        );
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch event transactions" });
    }
});







// 🟢 Delete an event
app.delete('/events/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM transactions WHERE event_id = ?", [req.params.id]);
        await db.query("DELETE FROM events WHERE id = ?", [req.params.id]);

        res.json({ message: "✅ Event deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete event" });
    }
});
// app.delete('/events/:id', (req, res) => {
//     const eventId = req.params.id;
    
//     db.query("DELETE FROM events WHERE id = ?", [eventId], (err, result) => {
//         if (err) {
//             console.error("❌ Error deleting event:", err);
//             return res.status(500).json({ error: "Failed to delete event" });
//         }
        
//         res.json({ message: "Event deleted successfully" });
//     });
// });


// 🟢 Start Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
