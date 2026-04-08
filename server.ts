import express from 'express';
import cors from 'cors';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Initialize SQLite database
  const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      tags TEXT,
      timeSpent INTEGER DEFAULT 0,
      isTiming BOOLEAN DEFAULT 0,
      lastStartedAt INTEGER,
      completedAt INTEGER,
      createdAt INTEGER NOT NULL
    )
  `);

  // API Routes
  app.get('/api/tickets', async (req, res) => {
    try {
      const tickets = await db.all('SELECT * FROM tickets');
      // Convert boolean values back
      const formattedTickets = tickets.map(t => ({
        ...t,
        isTiming: Boolean(t.isTiming)
      }));
      res.json(formattedTickets);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tickets' });
    }
  });

  app.post('/api/tickets', async (req, res) => {
    const t = req.body;
    try {
      await db.run(
        `INSERT INTO tickets (id, title, description, status, priority, dueDate, tags, timeSpent, isTiming, lastStartedAt, completedAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.title, t.description, t.status, t.priority, t.dueDate, t.tags, t.timeSpent, t.isTiming ? 1 : 0, t.lastStartedAt, t.completedAt, t.createdAt]
      );
      res.status(201).json(t);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create ticket' });
    }
  });

  app.put('/api/tickets/:id', async (req, res) => {
    const t = req.body;
    try {
      await db.run(
        `UPDATE tickets SET 
          title = ?, description = ?, status = ?, priority = ?, dueDate = ?, tags = ?, 
          timeSpent = ?, isTiming = ?, lastStartedAt = ?, completedAt = ?
         WHERE id = ?`,
        [t.title, t.description, t.status, t.priority, t.dueDate, t.tags, t.timeSpent, t.isTiming ? 1 : 0, t.lastStartedAt, t.completedAt, req.params.id]
      );
      res.json(t);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update ticket' });
    }
  });

  app.delete('/api/tickets/:id', async (req, res) => {
    try {
      await db.run('DELETE FROM tickets WHERE id = ?', [req.params.id]);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete ticket' });
    }
  });

  app.post('/api/sync', async (req, res) => {
    const tickets = req.body;
    try {
      await db.run('BEGIN TRANSACTION');
      await db.run('DELETE FROM tickets');
      const stmt = await db.prepare(
        `INSERT INTO tickets (id, title, description, status, priority, dueDate, tags, timeSpent, isTiming, lastStartedAt, completedAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const t of tickets) {
        await stmt.run([t.id, t.title, t.description, t.status, t.priority, t.dueDate, t.tags, t.timeSpent, t.isTiming ? 1 : 0, t.lastStartedAt, t.completedAt, t.createdAt]);
      }
      await stmt.finalize();
      await db.run('COMMIT');
      res.status(200).json({ success: true });
    } catch (error) {
      await db.run('ROLLBACK');
      res.status(500).json({ error: 'Failed to sync tickets' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}

startServer().catch(console.error);
