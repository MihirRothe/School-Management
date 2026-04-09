const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
};

let pool;

async function initDB() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        await connection.query('CREATE DATABASE IF NOT EXISTS school_management');
        console.log('Database school_management checked/created');
        await connection.end();

        pool = mysql.createPool({ ...dbConfig, database: 'school_management' });

        await pool.query(`
            CREATE TABLE IF NOT EXISTS students (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                roll_no VARCHAR(50) NOT NULL,
                class VARCHAR(100) NOT NULL,
                contact VARCHAR(50),
                address TEXT
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS teachers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                subject VARCHAR(100) NOT NULL,
                experience INT,
                email VARCHAR(255)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                date DATE NOT NULL,
                status ENUM('Present', 'Absent') DEFAULT 'Present',
                FOREIGN KEY (student_id) REFERENCES students(id)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS schedule (
                id INT AUTO_INCREMENT PRIMARY KEY,
                day VARCHAR(50) NOT NULL,
                time VARCHAR(50) NOT NULL,
                subject VARCHAR(100) NOT NULL,
                teacher VARCHAR(255) NOT NULL
            )
        `);

        console.log('Tables checked/created');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

app.post('/api/students', async (req, res) => {
    const { name, roll_no, class: studentClass, contact, address } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO students (name, roll_no, class, contact, address) VALUES (?, ?, ?, ?, ?)',
            [name, roll_no, studentClass, contact, address]
        );
        res.status(201).json({ id: result.insertId, message: 'Student added successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM students ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/teachers', async (req, res) => {
    const { name, subject, experience, email } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO teachers (name, subject, experience, email) VALUES (?, ?, ?, ?)',
            [name, subject, experience, email]
        );
        res.status(201).json({ id: result.insertId, message: 'Teacher added successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/teachers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM teachers ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Schedule API
app.post('/api/schedule', async (req, res) => {
    const { day, time, subject, teacher } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO schedule (day, time, subject, teacher) VALUES (?, ?, ?, ?)',
            [day, time, subject, teacher]
        );
        res.status(201).json({ id: result.insertId, message: 'Class scheduled successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/schedule', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM schedule ORDER BY FIELD(day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'), time");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/schedule/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM schedule WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Attendance API
app.post('/api/attendance', async (req, res) => {
    const { student_id, date, status } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM attendance WHERE student_id = ? AND date = ?', [student_id, date]);
        if (existing.length > 0) {
            await pool.query('UPDATE attendance SET status = ? WHERE id = ?', [status, existing[0].id]);
        } else {
            await pool.query('INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)', [student_id, date, status]);
        }
        res.json({ message: 'Attendance marked successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/attendance', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM attendance ORDER BY date DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const [students] = await pool.query('SELECT count(*) as count FROM students');
        const [teachers] = await pool.query('SELECT count(*) as count FROM teachers');
        const [classes] = await pool.query('SELECT count(DISTINCT class) as count FROM students');
        
        let targetDate = new Date().toISOString().split('T')[0];
        const [attendance] = await pool.query('SELECT count(*) as present FROM attendance WHERE status="Present" AND date LIKE ?', [`${targetDate}%`]);
        
        let totalStudents = students[0].count;
        let presentCount = attendance[0].present;
        
        let attendanceRate = 0; 
        if (totalStudents > 0) {
            attendanceRate = Math.round((presentCount / totalStudents) * 100);
        } else {
            attendanceRate = 100; // Default when no students
        }

        res.json({
            students: totalStudents,
            teachers: teachers[0].count,
            classes: classes[0].count,
            attendanceRate: attendanceRate
        });
    } catch (err) {
        console.error("Stats API error:", err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3000;
app.listen(PORT, async () => {
    await initDB();
    console.log(`Server running on port ${PORT}`);
});
