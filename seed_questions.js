// backend/seed_questions.js
import fs from "fs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true,
  };

  const conn = await mysql.createConnection(config);
  console.log("✅ Connected to DB for seeding");

  // Create tables if not exists
  const createTables = `
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    interviews_taken INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role VARCHAR(255),
    level VARCHAR(50),
    question TEXT
  );

  CREATE TABLE IF NOT EXISTS answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    question_id INT,
    answer TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    feedback TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE ON UPDATE CASCADE
  );
  `;

  await conn.query(createTables);
  console.log("✅ Ensured tables exist");

  // load questions.json
  const raw = fs.readFileSync(new URL("./questions.json", import.meta.url), "utf8");
  const questions = JSON.parse(raw); // array of {role, level, question}

  // Clear questions and reset auto increment
  await conn.query("DELETE FROM questions");
  await conn.query("ALTER TABLE questions AUTO_INCREMENT = 1");

  const insertSql = "INSERT INTO questions (role, level, question) VALUES (?, ?, ?)";
  for (const q of questions) {
    // Normalize inputs
    const role = (q.role || "").trim();
    let level = (q.level || "").trim().toLowerCase();
    if (level === "easy") level = "low";
    if (level === "hard") level = "high";
    const questionText = (q.question || "").trim();
    if (!role || !level || !questionText) continue;
    await conn.execute(insertSql, [role, level, questionText]);
  }

  console.log(`✅ Inserted ${questions.length} questions (attempted).`);
  await conn.end();
  process.exit(0);
}

run().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});




