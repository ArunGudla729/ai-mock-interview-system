const video = document.getElementById("webcam");

const signInBtn = document.getElementById("signInBtn");
const interviewsTakenEl = document.getElementById("interviewsTaken");
const averageScoreEl = document.getElementById("averageScore");
const bestRoleEl = document.getElementById("bestRole");

const roleSelect = document.getElementById("roleSelect");
const levelSelect = document.getElementById("levelSelect");
const startInterviewBtn = document.getElementById("startInterviewBtn");

const questionText = document.getElementById("questionText");
const answerBox = document.getElementById("answerBox");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");

const recordBtn = document.getElementById("recordBtn");
const recordStatus = document.getElementById("recordStatus");

const roleDisplay = document.getElementById("roleDisplay");
const levelDisplay = document.getElementById("levelDisplay");
const modeDisplay = document.getElementById("modeDisplay");

const confidenceValue = document.getElementById("confidenceValue");
const confidenceBar = document.getElementById("confidenceBar");
const feedbackContainer = document.getElementById("feedbackContainer");

let questions = [];
let qIndex = 0;
let recognition = null;
let sessionTimer = null;
let sessionStart = null;
const SESSION_MS = 20 * 60 * 1000; // 20 minutes

const BASE_URL = "http://localhost:5020"; // Updated port

// ---------------- Navbar & Dashboard ----------------
function updateNavbarAndDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (!user) return;

  signInBtn.textContent = user.name || "Sign In";
  interviewsTakenEl.textContent = user.interviews_taken || 0;
  averageScoreEl.textContent = user.answers_attempted || 0;
  bestRoleEl.textContent = user.last_interview_status || "-";
}
updateNavbarAndDashboard();

// ---------------- Webcam ----------------
if (navigator.mediaDevices?.getUserMedia) {
  navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
    video.srcObject = stream;
  });
}

// ---------------- Voice Recognition ----------------
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onstart = () => (recordStatus.textContent = "🎙️ Recording...");
  recognition.onend = () => {
    recordStatus.textContent = "Stopped";
  };
  recognition.onerror = (e) => {
    recordStatus.textContent = "❌ " + (e.error || "Error");
  };

  recognition.onresult = (ev) => {
    const text = Array.from(ev.results)
      .map((r) => r[0].transcript)
      .join(" ")
      .trim();
    answerBox.value = (answerBox.value ? answerBox.value + " " : "") + text;
    recordStatus.textContent = "✅ Voice added to text box!";
  };

  let isRecording = false;
  recordBtn.onclick = () => {
    if (!isRecording) {
      recognition.start();
      isRecording = true;
      recordBtn.textContent = "⏹ Stop Recording";
    } else {
      recognition.stop();
      isRecording = false;
      recordBtn.textContent = "🎙️ Start Recording";
    }
  };
} else {
  recordBtn.disabled = true;
  recordStatus.textContent = "Speech recognition not supported";
}
const authModal = document.getElementById("authModal");
const authMessage = document.getElementById("authMessage");
const closeAuthModal = document.getElementById("closeAuthModal");

signInBtn.addEventListener("click", () => {
  authModal.classList.remove("hidden");
});

closeAuthModal.addEventListener("click", () => {
  authModal.classList.add("hidden");
});

// Signup
document.getElementById("signupForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  if (!name || !email || !password) return;

  try {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    authMessage.style.color = "green";
    authMessage.textContent = "Signup successful! You can now login.";
  } catch (err) {
    authMessage.style.color = "red";
    authMessage.textContent = err.message;
  }
});

// Login
document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) return;

  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    localStorage.setItem("user", JSON.stringify(data.user));
    authModal.classList.add("hidden");
    signInBtn.textContent = data.user.name;
  } catch (err) {
    authMessage.style.color = "red";
    authMessage.textContent = err.message;
  }
});

// ---------------- Load Roles ----------------
async function loadRoles() {
  try {
    const res = await fetch(`${BASE_URL}/api/roles`);
    const roles = await res.json();
    if (Array.isArray(roles)) {
      roleSelect.innerHTML =
        `<option value="">Select Role</option>` +
        roles.map((r) => `<option>${r}</option>`).join("");
    }
  } catch (e) {
    console.warn("Could not load roles:", e);
  }
}
loadRoles();

// ---------------- Generate Random Confidence ----------------
function generateConfidence() {
  const percent = Math.floor(Math.random() * 101); // 0–100
  confidenceValue.textContent = percent + "%";
  if (percent > 80) {
    confidenceBar.style.width = percent + "%";
    confidenceBar.style.backgroundColor = "red";
  } else if (percent > 50) {
    confidenceBar.style.width = percent + "%";
    confidenceBar.style.backgroundColor = "orange";
  } else {
    confidenceBar.style.width = percent + "%";
    confidenceBar.style.backgroundColor = "green";
  }
}

// ---------------- Start Interview ----------------
startInterviewBtn.onclick = async () => {
  const role = roleSelect.value;
  const level = levelSelect.value;
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!user?.email) return alert("Please sign in first");
  if (!role || !level) return alert("Select role and level");

  try {
    const res = await fetch(
      `${BASE_URL}/api/questions?role=${encodeURIComponent(role)}&level=${encodeURIComponent(level)}`
    );
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return alert("No questions found.");

    questions = data;
    qIndex = 0;
    roleDisplay.textContent = role;
    levelDisplay.textContent = level;
    modeDisplay.textContent = "Text/Voice Answer";
    showQuestion();
    submitBtn.disabled = false;

    if (sessionTimer) clearTimeout(sessionTimer);
    sessionStart = Date.now();
    sessionTimer = setTimeout(autoSubmitDueToTimeout, SESSION_MS);
  } catch (err) {
    console.error(err);
    alert("Failed to load questions.");
  }
};

// ---------------- Show Question ----------------
function showQuestion() {
  questionText.textContent = questions[qIndex].question;
  answerBox.value = "";
  feedbackContainer.innerHTML = "";
  generateConfidence();
}

// ---------------- Submit Answer ----------------
submitBtn.onclick = async () => {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (!user?.email) return alert("Sign in first.");
  if (!questions.length) return alert("Start interview first.");
  const answer = answerBox.value.trim();
  if (!answer) return alert("Please enter your answer.");

  try {
    const res = await fetch(`${BASE_URL}/api/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        questionId: questions[qIndex].id,
        questionText: questions[qIndex].question,
        answer,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    // Update stats
    user.answers_attempted = (user.answers_attempted || 0) + 1;
    localStorage.setItem("user", JSON.stringify(user));
    updateNavbarAndDashboard();

    // Display AI feedback
    feedbackContainer.innerHTML = "";
    const fb = data.feedback || {};
    const feedbackBox = document.createElement("div");
    feedbackBox.className =
      "mt-3 p-3 bg-indigo-50 border-l-4 border-indigo-500 rounded text-gray-800";
    feedbackBox.innerHTML = `
      <strong>AI Feedback:</strong><br><br>
      <b style="color:red;">Mistakes:</b> ${fb.mistakes || "None"}<br>
      <b style="color:orange;">Areas for Improvement:</b> ${fb.areas_for_improvement || "None"}<br>
      <b style="color:green;">Extra Points:</b> ${fb.extra_points || "None"}<br>
      <b style="color:blue;">Score:</b> ${fb.score !== undefined ? fb.score + "/10" : "N/A"}<br>
      ${fb.raw ? `<hr><pre>${fb.raw}</pre>` : ""}
    `;
    feedbackContainer.appendChild(feedbackBox);

    // Disable submit until next question
    submitBtn.disabled = true;
    nextQuestionBtn.disabled = false;
  } catch (err) {
    console.error(err);
    alert("Error submitting answer.");
  }
};

// ---------------- Next Question ----------------
nextQuestionBtn.onclick = () => {
  qIndex++;
  if (qIndex < questions.length) {
    showQuestion();
    submitBtn.disabled = false;
  } else {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    user.interviews_taken = (user.interviews_taken || 0) + 1;
    user.last_interview_status = "Success";
    localStorage.setItem("user", JSON.stringify(user));
    updateNavbarAndDashboard();
    alert("✅ Interview completed successfully!");
    submitBtn.disabled = true;
    nextQuestionBtn.disabled = true;
    feedbackContainer.innerHTML = "";
  }
};

// ---------------- Reset ----------------
resetBtn.onclick = () => {
  questionText.textContent = "";
  answerBox.value = "";
  questions = [];
  qIndex = 0;
  if (sessionTimer) clearTimeout(sessionTimer);
  submitBtn.disabled = false;
  nextQuestionBtn.disabled = true;
  feedbackContainer.innerHTML = "";
  confidenceValue.textContent = "0%";
  confidenceBar.style.width = "0%";
  confidenceBar.style.backgroundColor = "gray";
};

// ---------------- Auto-submit After Timeout ----------------
function autoSubmitDueToTimeout() {
  if (!questions.length) return;
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (!user?.email) return;

  const answer = answerBox.value.trim();
  if (!answer) return alert("20 minutes elapsed — no answer to submit.");

  user.answers_attempted = (user.answers_attempted || 0) + 1;
  localStorage.setItem("user", JSON.stringify(user));
  updateNavbarAndDashboard();
  // keep question static until next click
}
const historyContainer = document.getElementById("historyContainer");

async function loadHistory() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (!user?.email) return alert("Please sign in first");

  try {
    const res = await fetch(`http://localhost:5020/api/history/${encodeURIComponent(user.email)}`);
    const data = await res.json();

    if (!Array.isArray(data) || !data.length) {
      historyContainer.innerHTML = "<p>No interview history found.</p>";
      return;
    }

    historyContainer.innerHTML = "";

    data.forEach((interview, idx) => {
      const interviewBox = document.createElement("div");
      interviewBox.className = "p-4 border rounded-lg shadow-sm bg-gray-50 cursor-pointer transition hover:bg-gray-100";
      
      interviewBox.innerHTML = `
        <div class="flex justify-between items-center">
          <div><strong>Role:</strong> ${interview.role} | <strong>Level:</strong> ${interview.level}</div>
          <div>Interview ${idx + 1} ▼</div>
        </div>
        <div class="mt-3 hidden flex-col gap-3" id="interviewDetails">
          ${interview.questions.map(q => `
            <div class="p-3 bg-white border rounded">
              <div><b>Q:</b> ${q.question}</div>
              <div><b>Answer:</b> ${q.answer}</div>
              <div class="mt-2 p-2 bg-indigo-50 border-l-4 border-indigo-500 rounded text-gray-800">
                <b>Mistakes:</b> ${q.feedback.mistakes || "None"}<br>
                <b>Areas for Improvement:</b> ${q.feedback.areas_for_improvement || "None"}<br>
                <b>Extra Points:</b> ${q.feedback.extra_points || "None"}<br>
                <b>Score:</b> ${q.feedback.score !== undefined ? q.feedback.score + "/10" : "N/A"}
              </div>
            </div>
          `).join("")}
        </div>
      `;

      interviewBox.addEventListener("click", () => {
        const details = interviewBox.querySelector("#interviewDetails");
        details.classList.toggle("hidden");
      });

      historyContainer.appendChild(interviewBox);
    });
  } catch (err) {
    console.error(err);
    historyContainer.innerHTML = "<p>Error loading history.</p>";
  }
}
// ---------------- Load History on History Link Click ----------------
document.querySelector('a[href="#history"]').addEventListener("click", loadHistory);






