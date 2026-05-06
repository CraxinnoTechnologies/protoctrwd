import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Vercel's filesystem is read-only except for /tmp. Locally we keep the DB
// alongside the project so data persists across runs.
const DB_DIR =
  process.env.VERCEL || process.env.NETLIFY
    ? path.join("/tmp", "rwd-data")
    : path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "leads.db");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS follow_ups (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    contact_name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    due_date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
  CREATE INDEX IF NOT EXISTS idx_follow_ups_due ON follow_ups(due_date);

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL,
    po_number TEXT,
    total_boxes INTEGER NOT NULL DEFAULT 1,
    company TEXT NOT NULL,
    customer TEXT NOT NULL,
    order_date TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'waiting_for_scheduling',
    channel TEXT NOT NULL DEFAULT 'portal',
    archived INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_archived ON orders(archived);
  CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    size TEXT,
    color_code TEXT,
    type_type TEXT,
    price REAL NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

  CREATE TABLE IF NOT EXISTS order_history (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT 'You',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_history(order_id);

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    billing_address TEXT,
    shipping_address TEXT,
    payment_term TEXT NOT NULL DEFAULT 'Credit Card',
    parent_company TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    size TEXT,
    color_code TEXT,
    type_type TEXT,
    price REAL NOT NULL DEFAULT 0,
    catalog TEXT NOT NULL DEFAULT 'normal',
    active INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_products_catalog ON products(catalog);
`);

// Migration: if products table is from old schema (no category column), drop and recreate.
{
  const cols = db.prepare("PRAGMA table_info(products)").all() as Array<{
    name: string;
  }>;
  const hasCategory = cols.some((c) => c.name === "category");
  if (!hasCategory) {
    db.exec(`
      DROP TABLE IF EXISTS products;
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        size TEXT,
        color_code TEXT,
        type_type TEXT,
        category TEXT,
        category_label TEXT,
        price_unit TEXT,
        price REAL NOT NULL DEFAULT 0,
        catalog TEXT NOT NULL DEFAULT 'normal',
        active INTEGER NOT NULL DEFAULT 1,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_products_catalog ON products(catalog);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    `);
  }
}

// Migration: add new columns to orders if they don't exist
{
  const cols = db.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>;
  const have = new Set(cols.map((c) => c.name));
  const adds: Array<[string, string]> = [
    ["payment_term", "TEXT DEFAULT 'Credit Card'"],
    ["payment_status", "TEXT NOT NULL DEFAULT 'pending'"],
    ["tax", "REAL NOT NULL DEFAULT 0"],
    ["tax_rate", "REAL NOT NULL DEFAULT 0.07"],
    ["discount", "REAL NOT NULL DEFAULT 0"],
    ["shipping_cost", "REAL NOT NULL DEFAULT 0"],
    ["add_shipping_cost", "INTEGER NOT NULL DEFAULT 0"],
    ["freight", "INTEGER NOT NULL DEFAULT 0"],
    ["plain_box", "INTEGER NOT NULL DEFAULT 0"],
    ["send_email_status", "INTEGER NOT NULL DEFAULT 0"],
    ["send_order_confirmation", "INTEGER NOT NULL DEFAULT 0"],
    ["mark_as_paid", "INTEGER NOT NULL DEFAULT 0"],
    ["bill_to_parent", "INTEGER NOT NULL DEFAULT 0"],
    ["billing_address", "TEXT"],
    ["shipping_address", "TEXT"],
    ["scheduled_production_date", "TEXT"],
    ["estimated_shipped_date", "TEXT"],
    ["actual_ship_date", "TEXT"],
    ["tracking", "TEXT"],
    ["tax_enabled", "INTEGER NOT NULL DEFAULT 1"],
    ["rush_fee", "REAL NOT NULL DEFAULT 0"],
    ["discount_type", "TEXT NOT NULL DEFAULT 'amount'"],
    ["customer_id", "TEXT"],
  ];
  for (const [name, type] of adds) {
    if (!have.has(name)) db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${type}`);
  }
}

const seedCount = db.prepare("SELECT COUNT(*) as c FROM follow_ups").get() as { c: number };
if (seedCount.c === 0) {
  const insert = db.prepare(`
    INSERT INTO follow_ups (id, title, status, contact_name, company, email, phone, due_date, notes, created_at, updated_at)
    VALUES (@id, @title, @status, @contact_name, @company, @email, @phone, @due_date, @notes, @created_at, @updated_at)
  `);

  const seeds: Array<Omit<FollowUpRow, "id" | "created_at" | "updated_at">> = [
    { title: "Send quote", status: "overdue", contact_name: "Test", company: "Windows-Lexington", email: "shreyad@yopmail.com", phone: "(831) 842-8723", due_date: "2026-03-18", notes: null },
    { title: "Follow-up call", status: "overdue", contact_name: "James Anderson", company: "Anderson Comp", email: "jamesanderson@yopmail.com", phone: "(989) 845-9546", due_date: "2026-03-14", notes: null },
    { title: "Discovery follow-up", status: "overdue", contact_name: "Sony Bravia", company: "Sony Bravia", email: "lexingtonfds@yopmail.com", phone: "0665656668", due_date: "2026-03-03", notes: null },
    { title: "Test Testing Capital T", status: "overdue", contact_name: "testing new", company: "AW Ltd", email: "tester@yopmail.com", phone: "(789) 456-1232", due_date: "2026-03-03", notes: null },
    { title: "Test for emails", status: "overdue", contact_name: "Lee martin", company: "ABC pvt ltd", email: "leel@yopmail.com", phone: "18507125620", due_date: "2026-02-20", notes: null },
    { title: "Hello", status: "overdue", contact_name: "Dwain Johnson", company: "Tech Company", email: "dwainl11@yopmail.com", phone: "(850) 712-5788", due_date: "2026-02-20", notes: null },
    { title: "Weekend Days", status: "overdue", contact_name: "Dwain Johnson", company: "Tech Company", email: "dwainl11@yopmail.com", phone: "(850) 712-5788", due_date: "2026-02-19", notes: null },
    { title: "Call to customer", status: "overdue", contact_name: "Jacob Harp", company: "Jacob Comp", email: "jacob@yopmail.com", phone: "(342) 342-3432", due_date: "2026-02-25", notes: null },
    { title: "Testimonial", status: "overdue", contact_name: "Joe Russell", company: "Window world of Somerset pa", email: "wwscpa.install@gmail.com", phone: "+18148912976", due_date: "2026-02-18", notes: null },
    { title: "Call with Client", status: "overdue", contact_name: "Joe Russell", company: "Window world of Somerset pa", email: "wwscpa.install@gmail.com", phone: "+18148912976", due_date: "2026-02-18", notes: null },
    { title: "Renewal check-in", status: "overdue", contact_name: "Ankit Gupta", company: "Windows-Lexington", email: "lexingtonn@yopmail.com", phone: "09887296522", due_date: "2026-02-19", notes: null },
    { title: "Trial expiry", status: "overdue", contact_name: "Ankit Gupta", company: "Windows-Lexington", email: "lexingtonn@yopmail.com", phone: "09887296522", due_date: "2026-02-18", notes: null },
    { title: "Quote review", status: "completed", contact_name: "Maria Chen", company: "Chen & Co", email: "maria@chenco.com", phone: "(415) 555-0182", due_date: "2026-04-14", notes: null },
    { title: "Site visit follow-up", status: "completed", contact_name: "David Park", company: "Park Windows", email: "david@parkw.com", phone: "(212) 555-0194", due_date: "2026-04-15", notes: null },
    { title: "Invoice sent", status: "completed", contact_name: "Olivia Reed", company: "Reed Builders", email: "olivia@reedb.com", phone: "(646) 555-0156", due_date: "2026-04-17", notes: null },
    { title: "Installation scheduled", status: "completed", contact_name: "Marcus Wong", company: "Wong Homes", email: "marcus@wonghomes.com", phone: "(917) 555-0173", due_date: "2026-04-18", notes: null },
    { title: "Contract signed", status: "completed", contact_name: "Priya Shah", company: "Shah & Sons", email: "priya@shahsons.com", phone: "(408) 555-0189", due_date: "2026-04-18", notes: null },
    { title: "Deposit received", status: "completed", contact_name: "Ethan Brooks", company: "Brooks Interiors", email: "ethan@brooksint.com", phone: "(310) 555-0168", due_date: "2026-04-19", notes: null },
  ];

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const insertMany = db.transaction((rows: typeof seeds) => {
    for (const r of rows) {
      insert.run({
        id: crypto.randomUUID(),
        title: r.title,
        status: r.status,
        contact_name: r.contact_name,
        company: r.company,
        email: r.email,
        phone: r.phone,
        due_date: r.due_date,
        notes: r.notes,
        created_at: now,
        updated_at: now,
      });
    }
  });
  insertMany(seeds);
}

// ----- orders seed -----
const ordersCount = db.prepare("SELECT COUNT(*) as c FROM orders").get() as { c: number };
if (ordersCount.c === 0) {
  const insert = db.prepare(`
    INSERT INTO orders (id, order_number, po_number, total_boxes, company, customer, order_date, amount, status, channel, archived, notes, created_at, updated_at)
    VALUES (@id, @order_number, @po_number, @total_boxes, @company, @customer, @order_date, @amount, @status, @channel, @archived, @notes, @created_at, @updated_at)
  `);

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  type OrderSeed = {
    order_number: string;
    po_number: string | null;
    total_boxes: number;
    company: string;
    customer: string;
    order_date: string;
    amount: number;
    status: string;
    channel: string;
    archived: number;
    notes: string | null;
  };

  const seeds: OrderSeed[] = [
    { order_number: "110616669", po_number: "051126", total_boxes: 12, company: "Window World-Tallahassee", customer: "Pam Cunningham", order_date: "2026-05-11", amount: 1571.62, status: "scheduled_for_production", channel: "portal", archived: 0, notes: null },
    { order_number: "823737862", po_number: null, total_boxes: 10, company: "Window World-Lehigh Valley", customer: "Brandon Moyer", order_date: "2026-05-06", amount: 2085.00, status: "scheduled_for_production", channel: "portal", archived: 0, notes: null },
    { order_number: "586691941", po_number: "050626", total_boxes: 4, company: "Champion Windows-VA", customer: "Mary Woodson", order_date: "2026-05-06", amount: 857.98, status: "waiting_for_scheduling", channel: "portal", archived: 0, notes: null },
    { order_number: "748418574", po_number: "Service Stock 05/05/2026", total_boxes: 4, company: "All States Home Improvement", customer: "Larry Stitt", order_date: "2026-05-06", amount: 1517.00, status: "waiting_for_scheduling", channel: "portal", archived: 0, notes: null },
    { order_number: "747724068", po_number: "J-616631-702322", total_boxes: 1, company: "WSH Winston Salem", customer: "Matt Hall", order_date: "2026-05-06", amount: 192.00, status: "scheduled_for_production", channel: "portal", archived: 0, notes: null },
    { order_number: "353931530", po_number: "3259366", total_boxes: 1, company: "Lansing - Nashville", customer: "Lansing Nashville", order_date: "2026-05-05", amount: 212.00, status: "scheduled_for_production", channel: "portal", archived: 0, notes: null },
    { order_number: "958765442", po_number: "199063", total_boxes: 2, company: "APCO Industries", customer: "Amanda Hancock", order_date: "2026-05-05", amount: 492.50, status: "scheduled_for_production", channel: "portal", archived: 0, notes: null },
    { order_number: "402766635", po_number: "J-612623-702242", total_boxes: 1, company: "WSH West Chester Township", customer: "WSH West Chester Township", order_date: "2026-05-05", amount: 192.00, status: "scheduled_for_production", channel: "portal", archived: 0, notes: null },
    { order_number: "982945113", po_number: null, total_boxes: 38, company: "Window Nation - Detroit", customer: "Tom O'Hara", order_date: "2026-05-05", amount: 7614.72, status: "scheduled_for_production", channel: "portal", archived: 0, notes: null },
    { order_number: "662426311", po_number: null, total_boxes: 50, company: "Renewal by Andersen-Greater NM", customer: "Michael Herrera", order_date: "2026-05-05", amount: 12130.50, status: "scheduled_for_production", channel: "portal", archived: 0, notes: null },
    { order_number: "659833815", po_number: null, total_boxes: 2, company: "Ecoview Windows-Hickory NC", customer: "Bryan Church", order_date: "2026-05-05", amount: 181.00, status: "scheduled_for_production", channel: "portal", archived: 0, notes: null },
    { order_number: "451239876", po_number: "PO-99812", total_boxes: 6, company: "Power Home Remodeling", customer: "Sarah Lopez", order_date: "2026-05-04", amount: 3210.40, status: "in_production", channel: "portal", archived: 0, notes: null },
    { order_number: "330055887", po_number: "PO-A4421", total_boxes: 22, company: "Andersen Renewal-Phoenix", customer: "Carlos Reyes", order_date: "2026-05-03", amount: 5440.00, status: "in_production", channel: "portal", archived: 0, notes: null },
    { order_number: "289940012", po_number: null, total_boxes: 14, company: "Champion Windows-IL", customer: "Lisa Greene", order_date: "2026-05-02", amount: 2980.00, status: "shipped", channel: "portal", archived: 0, notes: null },
    { order_number: "271144551", po_number: "INV-77410", total_boxes: 3, company: "Pella Windows-Atlanta", customer: "Daniel Kim", order_date: "2026-05-01", amount: 612.30, status: "shipped", channel: "portal", archived: 0, notes: null },
    { order_number: "188002233", po_number: null, total_boxes: 1, company: "Window World-Charleston", customer: "Holly Trent", order_date: "2026-04-30", amount: 89.00, status: "void", channel: "portal", archived: 0, notes: "Customer cancelled" },
    { order_number: "100099221", po_number: "PO-OLD-22", total_boxes: 9, company: "WSH Greensboro", customer: "Owen Patel", order_date: "2026-03-25", amount: 1844.10, status: "shipped", channel: "portal", archived: 1, notes: null },

    // Web Orders
    { order_number: "WEB-552230", po_number: null, total_boxes: 1, company: "Direct Customer", customer: "Sasha Romero", order_date: "2026-05-04", amount: 245.00, status: "scheduled_for_production", channel: "web", archived: 0, notes: null },
    { order_number: "WEB-552231", po_number: null, total_boxes: 2, company: "Direct Customer", customer: "Megan Chen", order_date: "2026-05-03", amount: 410.00, status: "in_production", channel: "web", archived: 0, notes: null },

    // Stock Orders
    { order_number: "STK-770110", po_number: null, total_boxes: 40, company: "RWD Warehouse", customer: "Internal", order_date: "2026-05-02", amount: 0, status: "waiting_for_scheduling", channel: "stock", archived: 0, notes: "Replenishment batch" },

    // Order Requests
    { order_number: "REQ-880022", po_number: null, total_boxes: 5, company: "Sunrise Builders", customer: "Owen Patel", order_date: "2026-05-05", amount: 0, status: "waiting_for_scheduling", channel: "request", archived: 0, notes: "Quote needed" },
  ];

  const insertOrders = db.transaction((rows: OrderSeed[]) => {
    for (const r of rows) {
      insert.run({
        id: crypto.randomUUID(),
        order_number: r.order_number,
        po_number: r.po_number,
        total_boxes: r.total_boxes,
        company: r.company,
        customer: r.customer,
        order_date: r.order_date,
        amount: r.amount,
        status: r.status,
        channel: r.channel,
        archived: r.archived,
        notes: r.notes,
        created_at: now,
        updated_at: now,
      });
    }
  });
  insertOrders(seeds);
}

export const FOLLOW_UP_STATUSES = ["pending", "completed", "overdue"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const ORDER_STATUSES = [
  "waiting_for_scheduling",
  "scheduled_for_production",
  "in_production",
  "shipped",
  "void",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_CHANNELS = ["portal", "web", "stock", "request"] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type OrderRow = {
  id: string;
  order_number: string;
  po_number: string | null;
  total_boxes: number;
  company: string;
  customer: string;
  order_date: string;
  amount: number;
  status: OrderStatus;
  channel: OrderChannel;
  archived: number;
  notes: string | null;
  payment_term: string | null;
  payment_status: PaymentStatus;
  tax: number;
  tax_rate: number;
  discount: number;
  shipping_cost: number;
  add_shipping_cost: number;
  freight: number;
  plain_box: number;
  send_email_status: number;
  send_order_confirmation: number;
  mark_as_paid: number;
  bill_to_parent: number;
  billing_address: string | null;
  shipping_address: string | null;
  scheduled_production_date: string | null;
  estimated_shipped_date: string | null;
  actual_ship_date: string | null;
  tracking: string | null;
  tax_enabled: number;
  rush_fee: number;
  discount_type: "amount" | "percent";
  customer_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  payment_term: string;
  parent_company: string | null;
  created_at: string;
};

export type ProductRow = {
  id: string;
  name: string;
  size: string | null;
  color_code: string | null;
  type_type: string | null;
  category: string | null;
  category_label: string | null;
  price_unit: string | null;
  price: number;
  catalog: string;
  active: number;
  position: number;
  created_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  name: string;
  size: string | null;
  color_code: string | null;
  type_type: string | null;
  price: number;
  quantity: number;
  position: number;
  created_at: string;
};

export type OrderHistoryRow = {
  id: string;
  order_id: string;
  event: string;
  actor: string;
  created_at: string;
};

export type FollowUpRow = {
  id: string;
  title: string;
  status: FollowUpStatus;
  contact_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  due_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// One-time enrichment of seed orders so the detail page has rich data.
{
  const enrichOrder = db.prepare(
    `UPDATE orders SET
       payment_term = COALESCE(payment_term, @payment_term),
       tax = CASE WHEN tax = 0 THEN @tax ELSE tax END,
       billing_address = COALESCE(billing_address, @billing_address),
       shipping_address = COALESCE(shipping_address, @shipping_address),
       scheduled_production_date = COALESCE(scheduled_production_date, @scheduled),
       estimated_shipped_date = COALESCE(estimated_shipped_date, @estimated)
     WHERE order_number = @order_number`
  );

  // Backfill addresses + payment term + tax for all seeded orders.
  const allSeeded = db
    .prepare("SELECT id, order_number, amount, billing_address FROM orders")
    .all() as Array<{ id: string; order_number: string; amount: number; billing_address: string | null }>;
  for (const o of allSeeded) {
    if (o.billing_address) continue;
    enrichOrder.run({
      order_number: o.order_number,
      payment_term: "Credit Card",
      tax: Math.round(o.amount * 0.07 * 100) / 100,
      billing_address: "1413 Maclay Commerce Dr.\nTallahassee, FL, 32312",
      shipping_address: "1413 Maclay Commerce Dr.\nTallahassee, FL, 32312",
      scheduled: null,
      estimated: null,
    });
  }

  // Demo order from the screenshot — seed items + history if missing.
  const demo = db
    .prepare("SELECT id FROM orders WHERE order_number = ?")
    .get("110616669") as { id: string } | undefined;

  if (demo) {
    const itemCount = db
      .prepare("SELECT COUNT(*) as c FROM order_items WHERE order_id = ?")
      .get(demo.id) as { c: number };
    if (itemCount.c === 0) {
      db.prepare(
        `INSERT INTO order_items (id, order_id, name, size, color_code, type_type, price, quantity, position)
         VALUES (@id, @order_id, @name, @size, @color_code, @type_type, @price, @quantity, @position)`
      ).run({
        id: crypto.randomUUID(),
        order_id: demo.id,
        name: "2\" 1301 White DE",
        size: '2"',
        color_code: "1301",
        type_type: "DE",
        price: 122.4,
        quantity: 12,
        position: 0,
      });
    }

    const histCount = db
      .prepare("SELECT COUNT(*) as c FROM order_history WHERE order_id = ?")
      .get(demo.id) as { c: number };
    if (histCount.c === 0) {
      const events = [
        { ts: "2026-05-05 20:29:00", actor: "Olivia Rosmini", event: "Order created by Olivia Rosmini" },
        { ts: "2026-05-05 20:29:30", actor: "Olivia Rosmini", event: "Status updated by Olivia Rosmini as 'Scheduled for Production'" },
        { ts: "2026-05-05 20:29:45", actor: "Olivia Rosmini", event: "Packing slip printed by Olivia Rosmini" },
        { ts: "2026-05-05 20:29:55", actor: "Olivia Rosmini", event: "Order details slip printed by Olivia Rosmini" },
        { ts: "2026-05-05 20:32:00", actor: "Olivia Rosmini", event: "Olivia Rosmini has scheduled the order to 05/13/2026" },
        { ts: "2026-05-05 20:32:30", actor: "Olivia Rosmini", event: "Olivia Rosmini has changed the order status as Scheduled for Production" },
      ];
      const insertHist = db.prepare(
        `INSERT INTO order_history (id, order_id, event, actor, created_at)
         VALUES (@id, @order_id, @event, @actor, @created_at)`
      );
      const tx = db.transaction((rows: typeof events) => {
        for (const e of rows) {
          insertHist.run({
            id: crypto.randomUUID(),
            order_id: demo.id,
            event: e.event,
            actor: e.actor,
            created_at: e.ts,
          });
        }
      });
      tx(events);

      // Update demo order with full screenshot fields
      db.prepare(
        `UPDATE orders SET
           tax = 102.82,
           amount = 1571.62,
           total_boxes = 12,
           scheduled_production_date = '2026-05-13',
           estimated_shipped_date = '2026-05-13',
           payment_term = 'Credit Card',
           payment_status = 'pending',
           status = 'scheduled_for_production'
         WHERE id = ?`
      ).run(demo.id);
    }
  }
}

// ----- customers seed -----
{
  const count = db.prepare("SELECT COUNT(*) as c FROM customers").get() as { c: number };
  if (count.c === 0) {
    const seeds = [
      { name: "A1 Windows, LLC", billing: "1009 Oak Twig Dr\nRaleigh, NC, 27603", shipping: "1009 Oak Twig Dr\nRaleigh, NC, 27603", parent: null },
      { name: "Window World-Tallahassee", billing: "1413 Maclay Commerce Dr.\nTallahassee, FL, 32312", shipping: "1413 Maclay Commerce Dr.\nTallahassee, FL, 32312", parent: "Window World" },
      { name: "Window World-Lehigh Valley", billing: "2200 Highland Ave\nBethlehem, PA, 18020", shipping: "2200 Highland Ave\nBethlehem, PA, 18020", parent: "Window World" },
      { name: "Window World-Charleston", billing: "841 St. Andrews Blvd\nCharleston, SC, 29407", shipping: "841 St. Andrews Blvd\nCharleston, SC, 29407", parent: "Window World" },
      { name: "Champion Windows-VA", billing: "905 Westwood Ct\nSterling, VA, 20166", shipping: "905 Westwood Ct\nSterling, VA, 20166", parent: "Champion Windows" },
      { name: "Champion Windows-IL", billing: "1601 Pratt Blvd\nElk Grove Village, IL, 60007", shipping: "1601 Pratt Blvd\nElk Grove Village, IL, 60007", parent: "Champion Windows" },
      { name: "All States Home Improvement", billing: "44 Industrial Dr\nNorthvale, NJ, 07647", shipping: "44 Industrial Dr\nNorthvale, NJ, 07647", parent: null },
      { name: "WSH Winston Salem", billing: "3060 Trenwest Dr\nWinston-Salem, NC, 27103", shipping: "3060 Trenwest Dr\nWinston-Salem, NC, 27103", parent: "WSH" },
      { name: "WSH West Chester Township", billing: "9285 Allen Rd\nWest Chester Township, OH, 45069", shipping: "9285 Allen Rd\nWest Chester Township, OH, 45069", parent: "WSH" },
      { name: "WSH Greensboro", billing: "200 Centreport Dr\nGreensboro, NC, 27409", shipping: "200 Centreport Dr\nGreensboro, NC, 27409", parent: "WSH" },
      { name: "Lansing - Nashville", billing: "590 Mainstream Dr\nNashville, TN, 37228", shipping: "590 Mainstream Dr\nNashville, TN, 37228", parent: null },
      { name: "APCO Industries", billing: "115 Industrial Pkwy\nFranklin, IN, 46131", shipping: "115 Industrial Pkwy\nFranklin, IN, 46131", parent: null },
      { name: "Window Nation - Detroit", billing: "33 Ladbroke Rd\nLivonia, MI, 48150", shipping: "33 Ladbroke Rd\nLivonia, MI, 48150", parent: "Window Nation" },
      { name: "Renewal by Andersen-Greater NM", billing: "5520 Wyoming Blvd NE\nAlbuquerque, NM, 87109", shipping: "5520 Wyoming Blvd NE\nAlbuquerque, NM, 87109", parent: "Renewal by Andersen" },
      { name: "Andersen Renewal-Phoenix", billing: "6101 N. Black Canyon Hwy\nPhoenix, AZ, 85015", shipping: "6101 N. Black Canyon Hwy\nPhoenix, AZ, 85015", parent: "Renewal by Andersen" },
      { name: "Ecoview Windows-Hickory NC", billing: "405 21st St SE\nHickory, NC, 28602", shipping: "405 21st St SE\nHickory, NC, 28602", parent: null },
      { name: "Pella Windows-Atlanta", billing: "5025 Highlands Pkwy SE\nSmyrna, GA, 30082", shipping: "5025 Highlands Pkwy SE\nSmyrna, GA, 30082", parent: "Pella" },
      { name: "Power Home Remodeling", billing: "2501 Seaport Dr\nChester, PA, 19013", shipping: "2501 Seaport Dr\nChester, PA, 19013", parent: null },
    ];
    const insert = db.prepare(
      `INSERT INTO customers (id, name, billing_address, shipping_address, parent_company, payment_term)
       VALUES (@id, @name, @billing, @shipping, @parent, 'Credit Card')`
    );
    const tx = db.transaction(
      (rows: typeof seeds) => {
        for (const r of rows) {
          insert.run({ id: crypto.randomUUID(), ...r });
        }
      }
    );
    tx(seeds);
  }
}

// ----- products seed -----
{
  const count = db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number };
  if (count.c === 0) {
    type ProductSeed = {
      name: string;
      size: string | null;
      color_code: string;
      type_type: string;
      price: number;
    };
    type CategorySeed = {
      key: string;
      label: string;
      price_unit: string;
      products: ProductSeed[];
    };

    const cats: CategorySeed[] = [
      {
        key: "2_de_taped",
        label: '2" Double Edge Taped Trim',
        price_unit: "200ft.",
        products: [
          { name: "1301 White", size: '2"', color_code: "1301", type_type: "DE", price: 174 },
          { name: "1287 S-White", size: '2"', color_code: "1287", type_type: "DE", price: 174 },
          { name: "1418 B-White", size: '2"', color_code: "1418", type_type: "DE", price: 174 },
          { name: "RBA White", size: '2"', color_code: "RBA", type_type: "DE", price: 174 },
          { name: "3490 Tan", size: '2"', color_code: "3490", type_type: "DE", price: 180 },
        ],
      },
      {
        key: "2_5_de_taped",
        label: '2.5" Double Edge Taped Trim',
        price_unit: "200ft.",
        products: [
          { name: "1301 White", size: '2.5"', color_code: "1301", type_type: "DE", price: 186 },
          { name: "1287 S-White", size: '2.5"', color_code: "1287", type_type: "DE", price: 186 },
          { name: "1418 B-White", size: '2.5"', color_code: "1418", type_type: "DE", price: 186 },
          { name: "1298 VE-White", size: '2.5"', color_code: "1298", type_type: "DE", price: 186 },
          { name: "RBA White", size: '2.5"', color_code: "RBA", type_type: "DE", price: 186 },
          { name: "3490 Tan", size: '2.5"', color_code: "3490", type_type: "DE", price: 190 },
          { name: "1105 MI-Tan", size: '2.5"', color_code: "1105", type_type: "DE", price: 190 },
          { name: "2201 Almond-JW", size: '2.5"', color_code: "2201", type_type: "DE", price: 190 },
          { name: "839 GL Beige", size: '2.5"', color_code: "839", type_type: "DE", price: 190 },
          { name: "RBA Canvas", size: '2.5"', color_code: "RBA", type_type: "DE", price: 190 },
          { name: "1163 Sandstone", size: '2.5"', color_code: "1163", type_type: "DE", price: 205 },
          { name: "1230 VE-Tan", size: '2.5"', color_code: "1230", type_type: "DE", price: 205 },
          { name: "1241 VE-Clay", size: '2.5"', color_code: "1241", type_type: "DE", price: 205 },
          { name: "3695 Brown", size: '2.5"', color_code: "3695", type_type: "DE", price: 205 },
          { name: "RBA Sandtone", size: '2.5"', color_code: "RBA", type_type: "DE", price: 205 },
        ],
      },
      {
        key: "2_5_de_wood_grain",
        label: '2.5" Double Edge Taped Trim — Wood Grain 16-12ft. Sticks',
        price_unit: "192ft.",
        products: [
          { name: "Natural Oak", size: '2.5"', color_code: "Natural Oak", type_type: "DE", price: 345 },
          { name: "Colonial Cherry", size: '2.5"', color_code: "Colonial Cherry", type_type: "DE", price: 345 },
          { name: "Hillside Oak", size: '2.5"', color_code: "Hillside Oak", type_type: "DE", price: 345 },
          { name: "Calvados C", size: '2.5"', color_code: "Calvados C", type_type: "DE", price: 345 },
          { name: "Calvados K", size: '2.5"', color_code: "Calvados K", type_type: "DE", price: 345 },
          { name: "Winchester PA", size: '2.5"', color_code: "Winchester PA", type_type: "DE", price: 345 },
          { name: "Winchester PD", size: '2.5"', color_code: "Winchester PD", type_type: "DE", price: 345 },
          { name: "Vintage Pecan", size: '2.5"', color_code: "Vintage Pecan", type_type: "DE", price: 345 },
          { name: "Zelda K", size: '2.5"', color_code: "Zelda K", type_type: "DE", price: 345 },
          { name: "Black Smooth 2", size: '2.5"', color_code: "Black Smooth 2", type_type: "DE", price: 345 },
          { name: "Brown #167", size: '2.5"', color_code: "Brown #167", type_type: "DE", price: 345 },
          { name: "Bronze #083", size: '2.5"', color_code: "Bronze #083", type_type: "DE", price: 345 },
          { name: "Stainable Oak", size: '2.5"', color_code: "Stainable Oak", type_type: "DE", price: 345 },
          { name: "Washington White Ash", size: '2.5"', color_code: "Washington White Ash", type_type: "DE", price: 345 },
          { name: "Muskoka Oak", size: '2.5"', color_code: "Muskoka Oak", type_type: "DE", price: 345 },
          { name: "Melrose Cherry", size: '2.5"', color_code: "Melrose Cherry", type_type: "DE", price: 345 },
        ],
      },
      {
        key: "2_se_taped",
        label: '2" Single Edge Taped Trim',
        price_unit: "200ft.",
        products: [
          { name: "1301 White", size: '2"', color_code: "1301", type_type: "SE", price: 147 },
          { name: "1287 S-White", size: '2"', color_code: "1287", type_type: "SE", price: 147 },
          { name: "1418 B-White", size: '2"', color_code: "1418", type_type: "SE", price: 147 },
          { name: "RBA White", size: '2"', color_code: "RBA", type_type: "SE", price: 147 },
          { name: "3490 Tan", size: '2"', color_code: "3490", type_type: "SE", price: 150 },
        ],
      },
      {
        key: "2_5_de_specialty",
        label: '2.5" Double Edge Taped Trim — Specialty Colors / Bronze',
        price_unit: "200ft.",
        products: [
          { name: "6670 Classic Clay", size: '2.5"', color_code: "6670", type_type: "DE", price: 243 },
          { name: "7399 Bronze", size: '2.5"', color_code: "7399", type_type: "DE", price: 340 },
          { name: "7400 Bronze", size: '2.5"', color_code: "7400", type_type: "DE", price: 340 },
          { name: "7475 Bronze", size: '2.5"', color_code: "7475", type_type: "DE", price: 340 },
          { name: "7477 Black", size: '2.5"', color_code: "7477", type_type: "DE", price: 340 },
        ],
      },
      {
        key: "tools",
        label: "Tools",
        price_unit: "each",
        products: [
          { name: "RWD Trim Roller", size: null, color_code: "—", type_type: "Tool", price: 27 },
        ],
      },
    ];

    const insert = db.prepare(
      `INSERT INTO products (id, name, size, color_code, type_type, category, category_label, price_unit, price, catalog, position)
       VALUES (@id, @name, @size, @color_code, @type_type, @category, @category_label, @price_unit, @price, 'normal', @position)`
    );
    const tx = db.transaction((groups: CategorySeed[]) => {
      let pos = 0;
      for (const cat of groups) {
        for (const p of cat.products) {
          insert.run({
            id: crypto.randomUUID(),
            name: p.name,
            size: p.size,
            color_code: p.color_code,
            type_type: p.type_type,
            category: cat.key,
            category_label: cat.label,
            price_unit: cat.price_unit,
            price: p.price,
            position: pos++,
          });
        }
      }
    });
    tx(cats);
  }
}

export default db;
