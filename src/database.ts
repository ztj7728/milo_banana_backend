import sqlite3 from 'sqlite3';

export interface User {
  id: number;
  username: string;
  password: string;
  points: number;
  wechat_openid?: string;
  wechat_unionid?: string;
  avatar_url?: string;
  nickname?: string;
  created_at?: string;
}

export interface Config {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface PromptStore {
  id?: number;
  prompt: string;
  category: string;
  title: string;
  description?: string;
  cover_image?: string;
  image_required?: number;
  variable_required?: boolean;
  created_at?: string;
  updated_at?: string;
}

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = './data/database.sqlite') {
    this.db = new sqlite3.Database(dbPath);
    this.init();
  }

  private async init(): Promise<void> {
    // Create users table
    await this.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        points INTEGER DEFAULT 100,
        wechat_openid TEXT UNIQUE,
        wechat_unionid TEXT,
        avatar_url TEXT,
        nickname TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add WeChat fields to existing users table if they don't exist
    try {
      await this.run(`ALTER TABLE users ADD COLUMN wechat_openid TEXT UNIQUE`);
    } catch (err) {
      // Column already exists, ignore
    }
    try {
      await this.run(`ALTER TABLE users ADD COLUMN wechat_unionid TEXT`);
    } catch (err) {
      // Column already exists, ignore
    }
    try {
      await this.run(`ALTER TABLE users ADD COLUMN avatar_url TEXT`);
    } catch (err) {
      // Column already exists, ignore
    }
    try {
      await this.run(`ALTER TABLE users ADD COLUMN nickname TEXT`);
    } catch (err) {
      // Column already exists, ignore
    }

    // Create config table
    await this.run(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create prompt_store table
    await this.run(`
      CREATE TABLE IF NOT EXISTS prompt_store (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        cover_image TEXT,
        image_required INTEGER DEFAULT 0,
        variable_required INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Initialize default config values
    const configExists = await this.get("SELECT COUNT(*) as count FROM config") as { count: number };
    
    if (configExists.count === 0) {
      await this.run("INSERT INTO config (key, value) VALUES (?, ?)", "baseUrl", "https://api.joyzhi.com");
      await this.run("INSERT INTO config (key, value) VALUES (?, ?)", "apiKey", "sk-xxx");
      await this.run("INSERT INTO config (key, value) VALUES (?, ?)", "model", "gemini-2.5-flash-image-preview");
    }

    // Import initial prompt store data if empty
    await this.importInitialPrompts();
  }

  private run(sql: string, ...params: any[]): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  private get(sql: string, ...params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  private all(sql: string, ...params: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async createUser(username: string, password: string, nickname?: string): Promise<number> {
    const result = await this.run(
      "INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)",
      username, password, nickname
    );
    return result.lastID as number;
  }

  async createWeChatUser(wechatOpenid: string, wechatUnionid?: string, avatarUrl?: string, nickname?: string): Promise<number> {
    // Generate a unique username for WeChat users
    const username = `wechat_${wechatOpenid.substring(0, 12)}_${Date.now()}`;
    const defaultPassword = 'wechat_auth'; // WeChat users don't use password login

    const result = await this.run(
      "INSERT INTO users (username, password, wechat_openid, wechat_unionid, avatar_url, nickname) VALUES (?, ?, ?, ?, ?, ?)",
      username, defaultPassword, wechatOpenid, wechatUnionid || null, avatarUrl || null, nickname || null
    );
    return result.lastID as number;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const user = await this.get(
      "SELECT * FROM users WHERE username = ?",
      username
    );
    return user as User || null;
  }

  async getUserByWeChatOpenid(openid: string): Promise<User | null> {
    const user = await this.get(
      "SELECT * FROM users WHERE wechat_openid = ?",
      openid
    );
    return user as User || null;
  }

  async getUserById(id: number): Promise<User | null> {
    const user = await this.get("SELECT * FROM users WHERE id = ?", id);
    return user as User || null;
  }

  async getAllUsers(): Promise<User[]> {
    const users = await this.all("SELECT id, username, points, created_at FROM users ORDER BY created_at DESC");
    return users as User[];
  }

  async updateUserPoints(userId: number, points: number): Promise<void> {
    await this.run("UPDATE users SET points = ? WHERE id = ?", points, userId);
  }

  async addUserPoints(userId: number, pointsToAdd: number): Promise<number> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const newPoints = user.points + pointsToAdd;
    await this.updateUserPoints(userId, newPoints);
    return newPoints;
  }

  async subtractUserPoints(userId: number, pointsToSubtract: number): Promise<number> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const newPoints = Math.max(0, user.points - pointsToSubtract); // Don't allow negative points
    await this.updateUserPoints(userId, newPoints);
    return newPoints;
  }

  async getConfig(): Promise<Config> {
    const rows = await this.all("SELECT key, value FROM config") as Array<{ key: string; value: string }>;
    
    const config: any = {};
    rows.forEach((row: any) => {
      config[row.key] = row.value;
    });

    return {
      baseUrl: config.baseUrl || 'https://api.joyzhi.com',
      apiKey: config.apiKey || '',
      model: config.model || 'gemini-2.5-flash-image-preview'
    };
  }

  async updateConfig(config: Partial<Config>): Promise<void> {
    for (const [key, value] of Object.entries(config)) {
      await this.run(
        "INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
        key, value
      );
    }
  }

  // Prompt Store operations
  async getAllPrompts(): Promise<PromptStore[]> {
    const prompts = await this.all("SELECT * FROM prompt_store ORDER BY created_at DESC") as any[];
    return prompts.map(prompt => ({
      ...prompt,
      variable_required: Boolean(prompt.variable_required)
    }));
  }

  async getPromptById(id: number): Promise<PromptStore | null> {
    const prompt = await this.get("SELECT * FROM prompt_store WHERE id = ?", id) as any;
    if (!prompt) return null;
    return {
      ...prompt,
      variable_required: Boolean(prompt.variable_required)
    };
  }

  async createPrompt(prompt: Omit<PromptStore, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const result = await this.run(
      "INSERT INTO prompt_store (prompt, category, title, description, cover_image, image_required, variable_required) VALUES (?, ?, ?, ?, ?, ?, ?)",
      prompt.prompt,
      prompt.category,
      prompt.title,
      prompt.description || null,
      prompt.cover_image || null,
      prompt.image_required || 0,
      prompt.variable_required ? 1 : 0
    );
    return result.lastID as number;
  }

  async updatePrompt(id: number, prompt: Partial<Omit<PromptStore, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(prompt)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'variable_required') {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      }
    }
    
    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      await this.run(
        `UPDATE prompt_store SET ${fields.join(', ')} WHERE id = ?`,
        ...values
      );
    }
  }

  async deletePrompt(id: number): Promise<void> {
    await this.run("DELETE FROM prompt_store WHERE id = ?", id);
  }

  async importPrompts(prompts: Omit<PromptStore, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> {
    for (const prompt of prompts) {
      await this.createPrompt(prompt);
    }
  }

  private async importInitialPrompts(): Promise<void> {
    const promptCount = await this.get("SELECT COUNT(*) as count FROM prompt_store") as { count: number };
    
    if (promptCount.count === 0) {
      try {
        const fs = require('fs');
        const path = require('path');
        const promptStoreFile = path.join(__dirname, '../prompt_store.json');
        
        if (fs.existsSync(promptStoreFile)) {
          const data = fs.readFileSync(promptStoreFile, 'utf8');
          const prompts = JSON.parse(data);
          
          for (const prompt of prompts) {
            await this.createPrompt({
              prompt: prompt.prompt,
              category: prompt.category,
              title: prompt.tittle || prompt.title, // Handle typo in original data
              description: prompt.description || '',
              cover_image: prompt.cover_image || '',
              image_required: typeof prompt.image_required === 'number' ? prompt.image_required : (prompt.image_required ? 1 : 0),
              variable_required: typeof prompt.variable_required === 'boolean' ? prompt.variable_required : Boolean(prompt.variable_required)
            });
          }
          console.log(`Imported ${prompts.length} initial prompts from prompt_store.json`);
        }
      } catch (error) {
        console.error('Failed to import initial prompts:', error);
      }
    }
  }

  close(): void {
    this.db.close();
  }
}

export const database = new Database();