import express from "express";
import mysql from "mysql2";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS || process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
  console.log("✅ Connected to MySQL database");
});

// ---------------- Signup ----------------
app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const sql =
      "INSERT INTO users (name, email, password, interviews_taken) VALUES (?, ?, ?, 0)";
    db.query(sql, [name, email, hashed], (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY")
          return res.status(400).json({ message: "Email already exists" });
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }
      res.status(201).json({ message: "User registered" });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- Login Handler ----------------
const handleLogin = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (!results.length) return res.status(404).json({ message: "User not found" });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Incorrect password" });

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at,
        interviews_taken: user.interviews_taken || 0,
      },
    });
  });
};

app.post("/api/auth/login", handleLogin);
app.post("/api/login", handleLogin);
app.post("/api/users/signin", handleLogin);

// ---------------- Dashboard ----------------
app.get("/api/dashboard/:email", (req, res) => {
  const { email } = req.params;
  if (!email) return res.status(400).json({ message: "Email required" });

  db.query("SELECT id, interviews_taken FROM users WHERE email = ?", [email], (err, users) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (!users.length) return res.status(404).json({ message: "User not found" });

    const userId = users[0].id;
    const interviewsTaken = users[0].interviews_taken || 0;

    db.query(
      "SELECT COUNT(*) AS answers_attempted FROM answers WHERE user_id = ?",
      [userId],
      (err, ansResults) => {
        if (err) return res.status(500).json({ message: "DB error" });
        const answersAttempted = ansResults[0].answers_attempted;
        const status = answersAttempted >= 1 ? "Success" : "Failed";
        res.json({
          interviews_taken: interviewsTaken,
          answers_attempted: answersAttempted,
          best_role: status,
        });
      }
    );
  });
});

// ---------------- Roles ----------------
app.get("/api/roles", (req, res) => {
  const sql = `
    SELECT DISTINCT TRIM(LOWER(role)) AS role
    FROM questions
    WHERE role IS NOT NULL AND role <> ''
    ORDER BY role ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching roles:", err);
      return res.status(500).json({ message: "Database error" });
    }

    const roles = results.map((r) =>
      r.role
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    );

    console.log(`✅ ${roles.length} roles fetched from database`);
    res.json(roles);
  });
});

// ---------------- Questions ----------------
app.get("/api/questions", (req, res) => {
  const { role, level } = req.query;
  if (!role || !level)
    return res.status(400).json({ message: "role and level required" });

  const sql = `
    SELECT id, role, level, question 
    FROM questions 
    WHERE LOWER(role)=LOWER(?) AND LOWER(level)=LOWER(?) 
    ORDER BY id ASC
  `;
  db.query(sql, [role, level], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(results);
  });
});

// ---------------- Answers + Feedback ----------------
app.post("/api/answers", async (req, res) => {
  const { email, questionId, answer } = req.body;
  if (!email || !answer || !questionId)
    return res
      .status(400)
      .json({ message: "email, answer, and questionId required" });

  db.query("SELECT id, interviews_taken FROM users WHERE email = ?", [email], async (err, ures) => {
    if (err) return res.status(500).json({ message: "DB error (user lookup)" });
    if (!ures.length) return res.status(404).json({ message: "User not found" });

    const userId = ures[0].id;
    const currentCount = ures[0].interviews_taken || 0;

    db.query("SELECT question FROM questions WHERE id = ?", [questionId], async (err, qres) => {
      if (err) return res.status(500).json({ message: "DB error (question lookup)" });
      if (!qres.length) return res.status(404).json({ message: "Question not found" });

      const questionText = qres[0].question;

      let feedback = { mistakes: "", areas_for_improvement: "", extra_points: "", score: 0 };

      try {
        const prompt = `
You are an AI interviewer. Evaluate the candidate's answer and respond only in JSON.
Return JSON with these exact keys: "mistakes", "areas_for_improvement", "extra_points", "score".
Question: ${questionText}
Answer: ${answer}
        `;

        const response = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          },
          body: JSON.stringify({
            model: "sonar-pro",
            messages: [
              {
                role: "system",
                content: "You are a strict AI interviewer giving objective feedback only in JSON.",
              },
              { role: "user", content: prompt },
            ],
          }),
        });

        const data = await response.json();
        const rawText = data?.choices?.[0]?.message?.content?.trim();

        if (rawText) {
          try {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) feedback = JSON.parse(jsonMatch[0]);
            else feedback.raw = rawText;
          } catch (e) {
            feedback.raw = rawText;
          }
        } else {
          feedback = { mistakes: "No data returned", score: 0 };
        }
      } catch (err) {
        console.error("🛑 Perplexity API error:", err);
      }

      db.query(
        "INSERT INTO answers (user_id, question_id, answer, feedback) VALUES (?, ?, ?, ?)",
        [userId, questionId, answer, JSON.stringify(feedback)],
        (err, result) => {
          if (err) return res.status(500).json({ message: "DB insert error" });

          db.query("UPDATE users SET interviews_taken=? WHERE id=?", [currentCount + 1, userId], (err) => {
            if (err) console.error(err);
            res.json({
              message: "Answer saved",
              feedback,
              answerId: result.insertId,
              interviews_taken: currentCount + 1,
            });
          });
        }
      );
    });
  });
});

// ---------------- User History ----------------
app.get("/api/history/:email", (req, res) => {
  const { email } = req.params;
  if (!email) return res.status(400).json({ message: "Email required" });

  db.query("SELECT id FROM users WHERE email = ?", [email], (err, users) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (!users.length) return res.status(404).json({ message: "User not found" });

    const userId = users[0].id;

    db.query(
      `SELECT a.answer, a.feedback, q.question, q.role, q.level
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       WHERE a.user_id = ?
       ORDER BY a.id ASC`,
      [userId],
      (err, results) => {
        if (err) return res.status(500).json({ message: "DB error fetching answers" });

        const grouped = [];
        const map = {};
        results.forEach((r) => {
          const key = r.role + "_" + r.level;
          if (!map[key]) {
            map[key] = { role: r.role, level: r.level, questions: [] };
            grouped.push(map[key]);
          }
          map[key].questions.push({
            question: r.question,
            answer: r.answer,
            feedback: JSON.parse(r.feedback || "{}"),
          });
        });

        res.json(grouped);
      }
    );
  });
});

// ---------------- Start Server (localhost:5020) ----------------
const PORT = 5020;
const HOST = "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
});
