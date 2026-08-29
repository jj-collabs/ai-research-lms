/**
 * Creates the first admin account and sample content (four quizzes: Python,
 * C#, and Java coding quizzes, plus a general-concepts quiz) so you have
 * something to test against.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=changeme npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const email = process.env.ADMIN_EMAIL || 'admin@example.com';
const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const name = process.env.ADMIN_NAME || 'Administrator';

function run() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  let adminId;
  if (existing) {
    console.log(`Admin ${email} already exists (id ${existing.id}).`);
    adminId = existing.id;
  } else {
    const hash = bcrypt.hashSync(password, 12);
    const info = db
      .prepare(
        `INSERT INTO users (name, email, password_hash, role, consent_given)
         VALUES (?, ?, ?, 'admin', 1)`
      )
      .run(name, email, hash);
    adminId = info.lastInsertRowid;
    console.log(`Created admin account: ${email} / ${password}`);
    console.log('IMPORTANT: log in and this password immediately if this is a real deployment.');
  }

  const insertQ = db.prepare(`
    INSERT INTO quiz_questions
      (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, points, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);

  function seedQuiz(title, description, timeLimitSeconds, questions) {
    const already = db.prepare('SELECT id FROM quizzes WHERE title = ?').get(title);
    if (already) {
      console.log(`Quiz "${title}" already exists, skipping.`);
      return;
    }
    const q = db
      .prepare(
        `INSERT INTO quizzes (title, description, time_limit_seconds, created_by)
         VALUES (?, ?, ?, ?)`
      )
      .run(title, description, timeLimitSeconds, adminId);
    const quizId = q.lastInsertRowid;
    questions.forEach((question, idx) => {
      insertQ.run(
        quizId,
        question.text,
        question.a,
        question.b,
        question.c,
        question.d,
        question.correct,
        1,
        idx + 1
      );
    });
    console.log(`Seeded quiz "${title}" (id ${quizId}) with ${questions.length} questions.`);
  }

  seedQuiz(
    'Python Coding Quiz',
    'Predict the output, spot the bug.',
    600,
    [
      {
        text: 'What does this print?\n\n```python\nx = 3\nprint(x * 2)\n```',
        a: '3', b: '6', c: '9', d: 'Error',
        correct: 'b',
      },
      {
        text: 'Why does this code raise an error?\n\n```python\ndef greet(name)\n    print(f"Hello, {name}")\n\ngreet("Sam")\n```',
        a: 'Missing colon after the function definition',
        b: '`print` is misspelled',
        c: '`name` isn\'t a valid variable name',
        d: 'Missing `return` statement',
        correct: 'a',
      },
      {
        text: 'How many times does "Hi" print?\n\n```python\nfor i in range(1, 5):\n    print("Hi")\n```',
        a: '3', b: '4', c: '5', d: '6',
        correct: 'b',
      },
    ]
  );

  seedQuiz(
    'C# Coding Quiz',
    'Predict the output, spot the bug.',
    600,
    [
      {
        text: 'What is printed?\n\n```csharp\nint x = 10;\nint y = 3;\nConsole.WriteLine(x % y);\n```',
        a: '3', b: '3.33', c: '1', d: '30',
        correct: 'c',
      },
      {
        text: 'What\'s wrong with this code?\n\n```csharp\npublic class Dog {\n    public string Name;\n    public void Bark() {\n        Console.WriteLine(Name + " says Woof!")\n    }\n}\n```',
        a: '`Bark()` should be static',
        b: 'Missing semicolon after the `Console.WriteLine` line',
        c: '`Name` should be lowercase',
        d: 'The class needs a constructor',
        correct: 'b',
      },
      {
        text: 'What does this print?\n\n```csharp\nstring a = "hello";\nstring b = "hello";\nConsole.WriteLine(a == b);\n```',
        a: 'true', b: 'false', c: 'Compile error', d: 'Runtime error',
        correct: 'a',
      },
    ]
  );

  seedQuiz(
    'Java Coding Quiz',
    'Predict the output, spot the bug.',
    600,
    [
      {
        text: 'What is the output?\n\n```java\nint a = 5;\nint b = 2;\nSystem.out.println(a / b);\n```',
        a: '2.5', b: '2', c: '3', d: 'Compile error',
        correct: 'b',
      },
      {
        text: 'Why won\'t this compile?\n\n```java\npublic class Main {\n    public static void main(String[] args) {\n        int total = 0\n        total = total + 5;\n        System.out.println(total);\n    }\n}\n```',
        a: '`total` should be a String',
        b: 'Missing semicolon after `int total = 0`',
        c: '`main` should return `int`',
        d: '`System.out.println` is spelled wrong',
        correct: 'b',
      },
      {
        text: 'What happens when this runs?\n\n```java\nint[] nums = {1, 2, 3};\nSystem.out.println(nums[3]);\n```',
        a: 'Prints 3', b: 'Prints 0', c: 'ArrayIndexOutOfBoundsException', d: 'Compile error',
        correct: 'c',
      },
    ]
  );

  seedQuiz(
    'General Programming Concepts',
    'A short warm-up quiz on general concepts (no single language required).',
    300,
    [
      {
        text: 'In most languages, what does `7 % 3` evaluate to?',
        a: '2.33', b: '1', c: '2', d: '0',
        correct: 'b',
      },
      {
        text: 'What does "LMS" stand for?',
        a: 'Learning Management System', b: 'Local Machine Server',
        c: 'Language Model Service', d: 'Learner Metrics Suite',
        correct: 'a',
      },
      {
        text: 'Which data type stores true/false values?',
        a: 'String', b: 'Boolean', c: 'Integer', d: 'Float',
        correct: 'b',
      },
    ]
  );
}

run();
