import * as SQLite from 'expo-sqlite';

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

let db: SQLite.SQLiteDatabase | null = null;

export const initDatabase = async () => {
  db = await SQLite.openDatabaseAsync('stt.db');

  // Enable Foreign Keys
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Question Banks Table
  await db.execAsync(`
    -- Cleanup orphan questions if FK was disabled previously
    DELETE FROM questions WHERE bank_id NOT IN (SELECT id FROM question_banks);
    DELETE FROM question_mastery WHERE question_id NOT IN (SELECT id FROM questions);
    DELETE FROM user_progress WHERE question_id NOT IN (SELECT id FROM questions);

    CREATE TABLE IF NOT EXISTS question_banks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_id INTEGER,
      type TEXT,
      content TEXT,
      options TEXT,
      correct_answer TEXT,
      explanation TEXT,
      FOREIGN KEY (bank_id) REFERENCES question_banks (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER,
      is_correct INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
    );

    -- SRS Mastery Table
    CREATE TABLE IF NOT EXISTS question_mastery (
      question_id INTEGER PRIMARY KEY,
      mastery_level INTEGER DEFAULT 0,
      next_review_time DATETIME,
      last_review_time DATETIME,
      FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
    );

    -- Quiz Session Persistence
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      bank_id INTEGER,
      quiz_mode TEXT,
      current_index INTEGER DEFAULT 0,
      answer_history TEXT,
      question_order TEXT,
      PRIMARY KEY (bank_id, quiz_mode)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      name TEXT,
      last_updated DATETIME,
      auto_update INTEGER DEFAULT 1,
      format TEXT DEFAULT 'stt' 
    );
  `);

  // Migration: Add question_order column if table was created earlier without it
  try {
    await db.execAsync('ALTER TABLE quiz_sessions ADD COLUMN question_order TEXT;');
    console.log('Migrated quiz_sessions: added question_order column');
  } catch (e) {
    // If column already exists, this will fail silently, which is fine
  }

  // Migration: Add subscription columns to question_banks
  try {
    await db.execAsync('ALTER TABLE question_banks ADD COLUMN subscription_id INTEGER;');
    console.log('Migrated question_banks: added subscription_id');
  } catch (e) { }

  try {
    await db.execAsync('ALTER TABLE question_banks ADD COLUMN remote_id TEXT;');
    console.log('Migrated question_banks: added remote_id');
  } catch (e) { }
};

export const getDB = () => {
  if (!db) throw new Error("Database not initialized");
  return db;
};
