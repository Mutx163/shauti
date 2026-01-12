import * as SQLite from 'expo-sqlite';

// Open the database securely
const db = SQLite.openDatabaseSync('stt_app.db');

export interface QuestionBank {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

export interface Question {
  id: number;
  bank_id: number;
  type: 'single' | 'multi' | 'true_false' | 'fill' | 'short';
  content: string;
  options: string; // JSON string
  correct_answer: string;
  explanation: string;
}

export const initDatabase = () => {
  try {
    db.execSync(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS question_banks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_id INTEGER NOT NULL,
        type TEXT NOT NULL Check (type IN ('single', 'multi', 'true_false', 'fill', 'short')),
        content TEXT NOT NULL,
        options TEXT,
        correct_answer TEXT,
        explanation TEXT,
        FOREIGN KEY (bank_id) REFERENCES question_banks (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL,
        is_correct INTEGER NOT NULL,
        user_answer TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
      );
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

export const getDB = () => db;
