const Views = {};

// ---------- Auth views ----------

Views.login = (root) => {
  root.innerHTML = `
    <div class="card" style="max-width:420px;margin:40px auto;">
      <h1>Log in</h1>
      <form id="loginForm">
        <label>Email</label>
        <input type="email" name="email" required />
        <label>Password</label>
        <input type="password" name="password" required />
        <button class="btn" type="submit">Log in</button>
        <div class="error" id="err"></div>
      </form>
      <p class="muted" style="margin-top:16px;">
        No account? <a href="#/register">Register as a student</a> ·
        <a href="#/register-admin">Register as admin</a>
      </p>
    </div>
  `;
  root.querySelector('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { user } = await api.post('/api/auth/login', {
        email: fd.get('email'),
        password: fd.get('password'),
      });
      App.setUser(user);
      location.hash = user.role === 'admin' ? '#/admin' : '#/dashboard';
    } catch (err) {
      root.querySelector('#err').textContent = err.message;
    }
  });
};

Views.register = (root) => {
  root.innerHTML = `
    <div class="card" style="max-width:480px;margin:40px auto;">
      <h1>Student Registration</h1>
      <div class="consent-box">
        <strong>Research consent.</strong> This platform is part of a research study on
        how students use AI assistance when completing academic tasks. By registering you
        consent to your quiz activity, AI assistant conversations, and window
        focus events being logged and used for research analysis. Data is used for the
        study only. You may withdraw by contacting the study administrator.
      </div>
      <form id="regForm">
        <label>Full name</label>
        <input type="text" name="name" required />
        <label>Student number (optional)</label>
        <input type="text" name="studentNumber" />
        <label>Email</label>
        <input type="email" name="email" required />
        <label>Password (min 8 characters)</label>
        <input type="password" name="password" minlength="8" required />
        <div class="option-row">
          <input type="checkbox" id="consent" name="consent" required />
          <label for="consent" style="margin:0;">I have read and agree to the above.</label>
        </div>
        <button class="btn" type="submit">Register</button>
        <div class="error" id="err"></div>
      </form>
    </div>
  `;
  root.querySelector('#regForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { user } = await api.post('/api/auth/register', {
        name: fd.get('name'),
        studentNumber: fd.get('studentNumber'),
        email: fd.get('email'),
        password: fd.get('password'),
        consent: fd.get('consent') === 'on',
      });
      App.setUser(user);
      location.hash = '#/dashboard';
    } catch (err) {
      root.querySelector('#err').textContent = err.message;
    }
  });
};

Views['register-admin'] = (root) => {
  root.innerHTML = `
    <div class="card" style="max-width:420px;margin:40px auto;">
      <h1>Administrator Registration</h1>
      <p class="muted">Requires an invite code from the study lead.</p>
      <form id="regAdminForm">
        <label>Full name</label>
        <input type="text" name="name" required />
        <label>Email</label>
        <input type="email" name="email" required />
        <label>Password (min 8 characters)</label>
        <input type="password" name="password" minlength="8" required />
        <label>Invite code</label>
        <input type="text" name="inviteCode" required />
        <button class="btn" type="submit">Register</button>
        <div class="error" id="err"></div>
      </form>
    </div>
  `;
  root.querySelector('#regAdminForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { user } = await api.post('/api/auth/register-admin', {
        name: fd.get('name'),
        email: fd.get('email'),
        password: fd.get('password'),
        inviteCode: fd.get('inviteCode'),
      });
      App.setUser(user);
      location.hash = '#/admin';
    } catch (err) {
      root.querySelector('#err').textContent = err.message;
    }
  });
};

// ---------- Student dashboard ----------

Views.dashboard = async (root) => {
  root.innerHTML = `<p class="muted">Loading...</p>`;
  const { quizzes } = await api.get('/api/quizzes');
  root.innerHTML = `
    <h1>Welcome, ${App.user.name}</h1>
    <div class="card">
      <h2>Quizzes</h2>
      ${quizzes.map((q) => `
        <div class="list-item">
          <div>
            <div><strong>${escapeHtml(q.title)}</strong></div>
            <div class="muted">${escapeHtml(q.description || '')}</div>
          </div>
          <a class="btn" href="#/quiz/${q.id}">Start</a>
        </div>
      `).join('') || '<p class="muted">No quizzes yet.</p>'}
    </div>
  `;
};

// ---------- Quiz taking ----------

Views.quiz = async (root, params) => {
  const quizId = params[0];
  root.innerHTML = `<p class="muted">Loading quiz...</p>`;
  const { quiz, questions } = await api.get(`/api/quizzes/${quizId}`);
  const { attemptId } = await api.post(`/api/quizzes/${quizId}/start`);
  Proctoring.start('quiz', attemptId);

  root.innerHTML = `
    <div class="grid-2">
      <div>
        <h1>${escapeHtml(quiz.title)}</h1>
        <p class="muted">${escapeHtml(quiz.description || '')}</p>
        <form id="quizForm">
          ${questions.map((q, idx) => `
            <div class="question-block">
              <div class="question-text"><strong>${idx + 1}.</strong> ${renderRichText(q.question_text)}</div>
              ${['a', 'b', 'c', 'd'].map((opt) => `
                <div class="option-row">
                  <input type="radio" name="q_${q.id}" value="${opt}" id="q_${q.id}_${opt}" />
                  <label for="q_${q.id}_${opt}" style="margin:0;font-weight:400;">
                    ${renderRichText(q['option_' + opt])}
                  </label>
                </div>
              `).join('')}
            </div>
          `).join('')}
          <button class="btn" type="submit">Submit Quiz</button>
        </form>
        <div id="result"></div>
      </div>
      <div class="card" id="chatContainer"></div>
    </div>
  `;

  mountChatPanel(root.querySelector('#chatContainer'), { contextType: 'quiz', contextId: attemptId });

  root.querySelector('#quizForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const answers = {};
    questions.forEach((q) => { answers[q.id] = fd.get(`q_${q.id}`) || null; });
    try {
      const result = await api.post(`/api/quizzes/attempts/${attemptId}/submit`, { answers });
      Proctoring.stop();
      root.querySelector('#result').innerHTML =
        `<div class="success">Submitted! Score: ${result.score} / ${result.maxScore}</div>`;
      e.target.querySelectorAll('input, button').forEach((el) => (el.disabled = true));
    } catch (err) {
      root.querySelector('#result').innerHTML = `<div class="error">${err.message}</div>`;
    }
  });
};

// ---------- Admin ----------

Views.admin = async (root) => {
  root.innerHTML = `<p class="muted">Loading dashboard...</p>`;
  const { students } = await api.get('/api/admin/stats/ai-usage');

  const totals = students.reduce(
    (acc, s) => {
      acc.messages += s.aiMessagesSent;
      acc.quiz += s.totalQuizAttempts;
      return acc;
    },
    { messages: 0, quiz: 0 }
  );

  root.innerHTML = `
    <h1>Admin Dashboard</h1>
    <div class="stat-cards">
      <div class="stat-card"><div class="num">${students.length}</div><div class="label">Students</div></div>
      <div class="stat-card"><div class="num">${totals.messages}</div><div class="label">AI messages sent</div></div>
      <div class="stat-card"><div class="num">${totals.quiz}</div><div class="label">Quiz attempts submitted</div></div>
    </div>

    <div class="card">
      <h2>AI Usage vs Non-Usage per Student</h2>
      <table>
        <thead><tr>
          <th>Student</th><th>AI msgs</th>
          <th>Quiz w/ AI</th><th>Quiz w/o AI</th>
          <th>Last AI use</th>
        </tr></thead>
        <tbody>
          ${students.map((s) => `
            <tr>
              <td>${escapeHtml(s.name)}<br/><span class="muted">${escapeHtml(s.email)}</span></td>
              <td>${s.aiMessagesSent}</td>
              <td>${s.quizAttemptsWithAiUse}</td>
              <td>${s.quizAttemptsWithoutAi}</td>
              <td>${s.lastAiUse ? new Date(s.lastAiUse + 'Z').toLocaleString() : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Export data (CSV)</h2>
      <div class="export-links">
        <a href="/api/admin/export/ai-interactions.csv" target="_blank">AI interactions</a>
        <a href="/api/admin/export/activity-log.csv" target="_blank">Activity / focus-loss log</a>
        <a href="/api/admin/export/quiz-attempts.csv" target="_blank">Quiz attempts</a>
      </div>
    </div>

    <div class="card">
      <h2>Manage content</h2>
      <a class="btn secondary" href="#/admin/new-quiz">+ New Quiz</a>
    </div>
  `;
};

Views['admin/new-quiz'] = (root) => {
  root.innerHTML = `
    <h1>New Quiz</h1>
    <div class="card">
      <form id="quizForm">
        <label>Title</label>
        <input type="text" name="title" required />
        <label>Description</label>
        <textarea name="description"></textarea>
        <label>Time limit (seconds, optional)</label>
        <input type="number" name="timeLimitSeconds" />
        <p class="muted" style="margin-top:14px;">
          Tip: wrap code snippets in triple backticks for a formatted code block, e.g.
          <code class="inline-code">\`\`\`python\nx = 1\nprint(x)\n\`\`\`</code>,
          or use single backticks for a short inline snippet like <code class="inline-code">\`x + 1\`</code>.
          Works in both the question text and the answer options.
        </p>
        <div id="questions"></div>
        <button type="button" class="btn secondary" id="addQ">+ Add Question</button>
        <button type="submit" class="btn">Create Quiz</button>
        <div class="error" id="err"></div>
      </form>
    </div>
  `;
  const questionsEl = root.querySelector('#questions');
  let qCount = 0;

  function addQuestion() {
    qCount++;
    const div = document.createElement('div');
    div.className = 'question-block';
    div.innerHTML = `
      <label>Question ${qCount} (supports \`\`\`code blocks\`\`\` and \`inline code\`)</label>
      <textarea class="qtext code-input" required placeholder="e.g. What does this print?\n\n\`\`\`python\nx = 3\nprint(x * 2)\n\`\`\`"></textarea>
      <label>Option A</label><input type="text" class="oa" required />
      <label>Option B</label><input type="text" class="ob" required />
      <label>Option C</label><input type="text" class="oc" required />
      <label>Option D</label><input type="text" class="od" required />
      <label>Correct option</label>
      <select class="correct">
        <option value="a">A</option><option value="b">B</option>
        <option value="c">C</option><option value="d">D</option>
      </select>
    `;
    questionsEl.appendChild(div);
  }
  addQuestion();
  root.querySelector('#addQ').addEventListener('click', addQuestion);

  root.querySelector('#quizForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const questions = [...questionsEl.querySelectorAll('.question-block')].map((block) => ({
      questionText: block.querySelector('.qtext').value,
      optionA: block.querySelector('.oa').value,
      optionB: block.querySelector('.ob').value,
      optionC: block.querySelector('.oc').value,
      optionD: block.querySelector('.od').value,
      correctOption: block.querySelector('.correct').value,
    }));
    try {
      await api.post('/api/quizzes', {
        title: fd.get('title'),
        description: fd.get('description'),
        timeLimitSeconds: fd.get('timeLimitSeconds') ? Number(fd.get('timeLimitSeconds')) : null,
        questions,
      });
      location.hash = '#/admin';
    } catch (err) {
      root.querySelector('#err').textContent = err.message;
    }
  });
};

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Renders text that may contain fenced code blocks (```...``` or ```lang ... ```)
// and inline code spans (`...`), escaping everything else as plain text with
// line breaks preserved. Used for quiz question/option text so admins can write
// "coding quiz" questions with readable code snippets instead of plain-text
// code execution.
function renderRichText(str) {
  const text = String(str ?? '');
  const fenceRe = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let html = '';
  let match;

  function renderPlain(segment) {
    // Handle inline `code` spans, then escape+preserve line breaks for the rest.
    const inlineParts = segment.split(/(`[^`\n]+`)/g);
    return inlineParts
      .map((part) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
          return `<code class="inline-code">${escapeHtml(part.slice(1, -1))}</code>`;
        }
        return escapeHtml(part).replace(/\n/g, '<br>');
      })
      .join('');
  }

  while ((match = fenceRe.exec(text)) !== null) {
    html += renderPlain(text.slice(lastIndex, match.index));
    const code = match[2].replace(/\n$/, '');
    html += `<pre class="code-block"><code>${escapeHtml(code)}</code></pre>`;
    lastIndex = fenceRe.lastIndex;
  }
  html += renderPlain(text.slice(lastIndex));
  return html;
}
