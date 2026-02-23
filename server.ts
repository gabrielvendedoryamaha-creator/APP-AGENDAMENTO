import express from "express";
console.log(">>> SERVER.TS IS BEING EXECUTED <<<");
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Initializing database...");
async function startServer() {
  console.log("Starting server setup...");
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  let db: any;
  try {
    console.log("Initializing database...");
    db = new Database("database.db");
    
    // Initialize Database
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'seller',
        active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        description TEXT,
        whatsapp_message TEXT,
        scheduled_at TEXT, -- ISO string or NULL for 'Falar Agora'
        status TEXT DEFAULT 'pending', -- 'pending', 'completed'
        concluded_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users(id)
      );
    `);

    // Insert default admin if not exists
    const adminEmails = ["gabriielsoar@gmail.com", "gabrielsoar@gmail.com"];
    adminEmails.forEach(email => {
      const existingAdmin = db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(email.toLowerCase()) as any;
      if (!existingAdmin) {
        db.prepare("INSERT INTO users (name, email, role, active) VALUES (?, ?, ?, ?)").run(
          "Administrador",
          email.toLowerCase(),
          "admin",
          1
        );
      } else if (existingAdmin.role === 'admin' && !existingAdmin.active) {
        db.prepare("UPDATE users SET active = 1 WHERE id = ?").run(existingAdmin.id);
      }
    });
  } catch (dbErr) {
    console.error("DATABASE INITIALIZATION FAILED:", dbErr);
    // Fallback to in-memory mock or just fail
  }

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // WebSocket broadcast helper
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // API Routes
  app.post("/api/login", (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    console.log(`Login attempt for: ${email}`);

    const masterEmails = ["gabriielsoar@gmail.com", "gabrielsoar@gmail.com"];
    if (masterEmails.includes(email)) {
      let user = db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(email) as any;
      if (!user) {
        db.prepare("INSERT INTO users (name, email, role, active) VALUES (?, ?, ?, ?)").run(
          "Administrador",
          email,
          "admin",
          1
        );
        user = db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(email);
      } else if (!user.active || user.role !== 'admin') {
        db.prepare("UPDATE users SET active = 1, role = 'admin' WHERE id = ?").run(user.id);
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
      }
      return res.json(user);
    }

    const user = db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(email) as any;
    if (!user) return res.status(401).json({ error: "Usuário não encontrado." });
    if (!user.active) return res.status(403).json({ error: "Seu acesso está desativado." });
    res.json(user);
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  app.post("/api/users", (req, res) => {
    const { name, email, role } = req.body;
    try {
      const result = db.prepare("INSERT INTO users (name, email, role) VALUES (?, ?, ?)").run(name, email, role || 'seller');
      broadcast({ type: "USER_UPDATED" });
      res.json(db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid));
    } catch (e) {
      res.status(400).json({ error: "E-mail já cadastrado." });
    }
  });

  app.patch("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const { active } = req.body;
    db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
    broadcast({ type: "USER_UPDATED" });
    res.json({ success: true });
  });

  app.get("/api/clients", (req, res) => {
    const { seller_id, role } = req.query;
    let clients;
    if (role === 'admin') {
      clients = db.prepare(`
        SELECT clients.*, users.name as seller_name 
        FROM clients 
        JOIN users ON clients.seller_id = users.id
        ORDER BY scheduled_at ASC, created_at DESC
      `).all();
    } else {
      clients = db.prepare("SELECT * FROM clients WHERE seller_id = ? ORDER BY scheduled_at ASC, created_at DESC").all(seller_id);
    }
    res.json(clients);
  });

  app.post("/api/clients", (req, res) => {
    const { seller_id, name, phone, description, scheduled_at, whatsapp_message } = req.body;
    const result = db.prepare(`
      INSERT INTO clients (seller_id, name, phone, description, scheduled_at, whatsapp_message) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(seller_id, name, phone, description, scheduled_at, whatsapp_message);
    broadcast({ type: "CLIENT_UPDATED", seller_id });
    res.json(db.prepare("SELECT * FROM clients WHERE id = ?").get(result.lastInsertRowid));
  });

  app.put("/api/clients/:id", (req, res) => {
    const { id } = req.params;
    const { name, phone, description, scheduled_at, status, whatsapp_message } = req.body;
    let concluded_at = status === 'completed' ? new Date().toISOString() : null;
    db.prepare(`
      UPDATE clients 
      SET name = ?, phone = ?, description = ?, scheduled_at = ?, status = ?, concluded_at = COALESCE(?, concluded_at), whatsapp_message = ?
      WHERE id = ?
    `).run(name, phone, description, scheduled_at, status, concluded_at, whatsapp_message, id);
    const updatedClient = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as any;
    broadcast({ type: "CLIENT_UPDATED", seller_id: updatedClient.seller_id });
    res.json(updatedClient);
  });

  app.delete("/api/clients/:id", (req, res) => {
    const { id } = req.params;
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as any;
    db.prepare("DELETE FROM clients WHERE id = ?").run(id);
    broadcast({ type: "CLIENT_UPDATED", seller_id: client.seller_id });
    res.json({ success: true });
  });

  // Vite integration
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    console.log("Using Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static files from dist...");
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVER IS RUNNING ON PORT ${PORT} <<<`);
  });
  
  return app;
}

// Start server for local dev
const appPromise = startServer().catch(err => {
  console.error("FAILED TO START SERVER:", err);
  process.exit(1);
});

// Export for Vercel
export default async (req: any, res: any) => {
  const app = await appPromise;
  if (!app) throw new Error("App failed to initialize");
  return app(req, res);
};
