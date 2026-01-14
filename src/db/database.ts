import * as SQLite from 'expo-sqlite';

export interface QuestionBank {
  id: number;
  name: string;
  description?: string;
  subscription_id?: number;
  remote_id?: string;
  remark?: string;
  created_at?: string;
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
let initPromise: Promise<void> | null = null;

export const initDatabase = async () => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[DB] 初始化开始...');
    let _db: any = null;
    try {
      _db = await SQLite.openDatabaseAsync('stt.db');
      console.log('[DB] 数据库已开启');

      // 心跳测试
      await _db.execAsync('SELECT 1');
      console.log('[DB] 心跳检测成功');

      // 逐步建表
      const tables = [
        `CREATE TABLE IF NOT EXISTS question_banks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS questions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bank_id INTEGER,
          type TEXT,
          content TEXT,
          options TEXT,
          correct_answer TEXT,
          explanation TEXT,
          FOREIGN KEY (bank_id) REFERENCES question_banks (id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS user_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          question_id INTEGER,
          is_correct INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS question_mastery (
          question_id INTEGER PRIMARY KEY,
          mastery_level INTEGER DEFAULT 0,
          next_review_time DATETIME,
          last_review_time DATETIME,
          FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS quiz_sessions (
          bank_id INTEGER,
          quiz_mode TEXT,
          current_index INTEGER DEFAULT 0,
          answer_history TEXT,
          question_order TEXT,
          PRIMARY KEY (bank_id, quiz_mode)
        )`
      ];

      for (const sql of tables) {
        await _db.execAsync(sql);
      }
      console.log('[DB] 核心表创建完成');

      await _db.execAsync(`CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        name TEXT,
        last_updated DATETIME,
        auto_update INTEGER DEFAULT 1,
        format TEXT DEFAULT 'stt',
        is_official INTEGER DEFAULT 0
      )`);
      console.log('[DB] subscriptions 表就绪');

      // 基础迁移 (不报错即可)
      try { await _db.execAsync('ALTER TABLE quiz_sessions ADD COLUMN question_order TEXT'); } catch (e) { }
      try { await _db.execAsync('ALTER TABLE question_banks ADD COLUMN subscription_id INTEGER'); } catch (e) { }
      try { await _db.execAsync('ALTER TABLE question_banks ADD COLUMN remote_id TEXT'); } catch (e) { }
      try { await _db.execAsync('ALTER TABLE question_banks ADD COLUMN remark TEXT'); } catch (e) { }
      try { await _db.execAsync('ALTER TABLE subscriptions ADD COLUMN is_official INTEGER DEFAULT 0'); } catch (e) { }
      console.log('[DB] 迁移检查完成');

      // 启用外键 (放在最后，确保表结构已稳定)
      try { await _db.execAsync('PRAGMA foreign_keys = ON'); } catch (e) { }

      db = _db;
      console.log('[DB] 初始化圆满完成');
    } catch (err) {
      console.error('[DB] 初始化崩溃:', err);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
};

export const getDB = () => {
  if (!db) throw new Error("Database not initialized or busy");
  return db;
};
