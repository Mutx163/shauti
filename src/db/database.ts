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

    // Question Banks Table
    await db.execAsync(`
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
  `);
};

export const getDB = () => {
    if (!db) throw new Error("Database not initialized");
    return db;
};
