import db, {
  ORDER_CHANNELS,
  ORDER_STATUSES,
  type OrderChannel,
  type OrderHistoryRow,
  type OrderItemRow,
  type OrderRow,
  type OrderStatus,
  type PaymentStatus,
} from "./db";
import crypto from "crypto";

export type OrderDetail = {
  order: OrderRow;
  items: OrderItemRow[];
  history: OrderHistoryRow[];
};

export type OrderUpdatePatch = Partial<OrderInput> & {
  archived?: boolean;
  payment_term?: string | null;
  payment_status?: PaymentStatus;
  tax?: number;
  tax_rate?: number;
  discount?: number;
  shipping_cost?: number;
  add_shipping_cost?: boolean;
  freight?: boolean;
  plain_box?: boolean;
  send_email_status?: boolean;
  send_order_confirmation?: boolean;
  mark_as_paid?: boolean;
  bill_to_parent?: boolean;
  billing_address?: string | null;
  shipping_address?: string | null;
  scheduled_production_date?: string | null;
  estimated_shipped_date?: string | null;
  actual_ship_date?: string | null;
  tracking?: string | null;
};

export type LineItemInput = {
  name: string;
  size?: string | null;
  color_code?: string | null;
  type_type?: string | null;
  price: number;
  quantity: number;
};

const BOOL_FIELDS = [
  "add_shipping_cost",
  "freight",
  "plain_box",
  "send_email_status",
  "send_order_confirmation",
  "mark_as_paid",
  "bill_to_parent",
  "tax_enabled",
] as const;

const STRING_FIELDS = [
  "order_number",
  "company",
  "customer",
  "customer_id",
  "order_date",
  "status",
  "channel",
  "notes",
  "po_number",
  "payment_term",
  "payment_status",
  "billing_address",
  "shipping_address",
  "scheduled_production_date",
  "estimated_shipped_date",
  "actual_ship_date",
  "tracking",
  "discount_type",
] as const;

const NUMBER_FIELDS = [
  "amount",
  "total_boxes",
  "tax",
  "tax_rate",
  "discount",
  "shipping_cost",
  "rush_fee",
] as const;

export type OrderInput = {
  order_number: string;
  po_number?: string | null;
  total_boxes: number;
  company: string;
  customer: string;
  customer_id?: string | null;
  order_date: string;
  amount: number;
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  channel: OrderChannel;
  notes?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  payment_term?: string | null;
  bill_to_parent?: boolean;
  add_shipping_cost?: boolean;
  shipping_cost?: number;
  send_order_confirmation?: boolean;
  mark_as_paid?: boolean;
  tax_enabled?: boolean;
  tax_rate?: number;
  rush_fee?: number;
  discount?: number;
  discount_type?: "amount" | "percent";
};

export type ListFilter = {
  channel?: OrderChannel;
  status?: OrderStatus;
  archived?: boolean;
  query?: string;
};

export function listOrders(filter: ListFilter = {}): OrderRow[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.channel) {
    where.push("channel = @channel");
    params.channel = filter.channel;
  }
  if (filter.status) {
    where.push("status = @status");
    params.status = filter.status;
  }
  if (filter.archived !== undefined) {
    where.push("archived = @archived");
    params.archived = filter.archived ? 1 : 0;
  }
  if (filter.query) {
    where.push(
      "(order_number LIKE @q OR po_number LIKE @q OR company LIKE @q OR customer LIKE @q)"
    );
    params.q = `%${filter.query}%`;
  }

  const sql = `SELECT * FROM orders ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY order_date DESC, created_at DESC`;
  return db.prepare(sql).all(params) as OrderRow[];
}

export function getOrder(id: string): OrderRow | undefined {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
}

export function createOrder(input: OrderInput): OrderRow {
  const id = crypto.randomUUID();
  const status: OrderStatus =
    input.status && ORDER_STATUSES.includes(input.status)
      ? input.status
      : "waiting_for_scheduling";
  if (!ORDER_CHANNELS.includes(input.channel)) {
    throw new Error("Invalid channel");
  }
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const payment_status: PaymentStatus = input.payment_status ?? (input.mark_as_paid ? "paid" : "pending");
  db.prepare(
    `INSERT INTO orders (
       id, order_number, po_number, total_boxes, company, customer, customer_id,
       order_date, amount, status, payment_status, channel, archived, notes,
       billing_address, shipping_address, payment_term, bill_to_parent,
       add_shipping_cost, shipping_cost, send_order_confirmation, mark_as_paid,
       tax_enabled, tax_rate, rush_fee, discount, discount_type,
       created_at, updated_at
     ) VALUES (
       @id, @order_number, @po_number, @total_boxes, @company, @customer, @customer_id,
       @order_date, @amount, @status, @payment_status, @channel, 0, @notes,
       @billing_address, @shipping_address, @payment_term, @bill_to_parent,
       @add_shipping_cost, @shipping_cost, @send_order_confirmation, @mark_as_paid,
       @tax_enabled, @tax_rate, @rush_fee, @discount, @discount_type,
       @created_at, @updated_at
     )`
  ).run({
    id,
    order_number: input.order_number,
    po_number: input.po_number ?? null,
    total_boxes: input.total_boxes,
    company: input.company,
    customer: input.customer,
    customer_id: input.customer_id ?? null,
    order_date: input.order_date,
    amount: input.amount,
    status,
    payment_status,
    channel: input.channel,
    notes: input.notes ?? null,
    billing_address: input.billing_address ?? null,
    shipping_address: input.shipping_address ?? null,
    payment_term: input.payment_term ?? "Credit Card",
    bill_to_parent: input.bill_to_parent ? 1 : 0,
    add_shipping_cost: input.add_shipping_cost ? 1 : 0,
    shipping_cost: input.shipping_cost ?? 0,
    send_order_confirmation: input.send_order_confirmation ? 1 : 0,
    mark_as_paid: input.mark_as_paid ? 1 : 0,
    tax_enabled: input.tax_enabled === false ? 0 : 1,
    tax_rate: input.tax_rate ?? 0.07,
    rush_fee: input.rush_fee ?? 0,
    discount: input.discount ?? 0,
    discount_type: input.discount_type ?? "amount",
    created_at: now,
    updated_at: now,
  });
  addOrderHistory(id, "Order created");
  return getOrder(id)!;
}

export function createOrderWithItems(
  input: OrderInput,
  items: LineItemInput[]
): OrderRow {
  const order = createOrder(input);
  for (const it of items) {
    addOrderItem(order.id, it);
  }
  recomputeOrderTotals(order.id);
  if (items.length > 0) {
    addOrderHistory(order.id, `Added ${items.length} line item${items.length === 1 ? "" : "s"}`);
  }
  return getOrder(order.id)!;
}

export function updateOrder(
  id: string,
  patch: OrderUpdatePatch
): OrderRow | undefined {
  const existing = getOrder(id);
  if (!existing) return undefined;

  const next: OrderRow = { ...existing };

  for (const key of STRING_FIELDS) {
    const val = (patch as Record<string, unknown>)[key];
    if (val !== undefined) (next as Record<string, unknown>)[key] = val;
  }
  for (const key of NUMBER_FIELDS) {
    const val = (patch as Record<string, unknown>)[key];
    if (val !== undefined && val !== null)
      (next as Record<string, unknown>)[key] = Number(val);
  }
  for (const key of BOOL_FIELDS) {
    const val = (patch as Record<string, unknown>)[key];
    if (typeof val === "boolean") (next as Record<string, unknown>)[key] = val ? 1 : 0;
  }
  if (patch.archived !== undefined) next.archived = patch.archived ? 1 : 0;

  db.prepare(
    `UPDATE orders SET
       order_number = @order_number,
       po_number = @po_number,
       total_boxes = @total_boxes,
       company = @company,
       customer = @customer,
       customer_id = @customer_id,
       order_date = @order_date,
       amount = @amount,
       status = @status,
       channel = @channel,
       archived = @archived,
       notes = @notes,
       payment_term = @payment_term,
       payment_status = @payment_status,
       tax = @tax,
       tax_rate = @tax_rate,
       tax_enabled = @tax_enabled,
       discount = @discount,
       discount_type = @discount_type,
       shipping_cost = @shipping_cost,
       add_shipping_cost = @add_shipping_cost,
       freight = @freight,
       plain_box = @plain_box,
       rush_fee = @rush_fee,
       send_email_status = @send_email_status,
       send_order_confirmation = @send_order_confirmation,
       mark_as_paid = @mark_as_paid,
       bill_to_parent = @bill_to_parent,
       billing_address = @billing_address,
       shipping_address = @shipping_address,
       scheduled_production_date = @scheduled_production_date,
       estimated_shipped_date = @estimated_shipped_date,
       actual_ship_date = @actual_ship_date,
       tracking = @tracking,
       updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    order_number: next.order_number,
    po_number: next.po_number,
    total_boxes: next.total_boxes,
    company: next.company,
    customer: next.customer,
    customer_id: next.customer_id,
    order_date: next.order_date,
    amount: next.amount,
    status: next.status,
    channel: next.channel,
    archived: next.archived,
    notes: next.notes,
    payment_term: next.payment_term,
    payment_status: next.payment_status,
    tax: next.tax,
    tax_rate: next.tax_rate,
    tax_enabled: next.tax_enabled,
    discount: next.discount,
    discount_type: next.discount_type,
    shipping_cost: next.shipping_cost,
    add_shipping_cost: next.add_shipping_cost,
    freight: next.freight,
    plain_box: next.plain_box,
    rush_fee: next.rush_fee,
    send_email_status: next.send_email_status,
    send_order_confirmation: next.send_order_confirmation,
    mark_as_paid: next.mark_as_paid,
    bill_to_parent: next.bill_to_parent,
    billing_address: next.billing_address,
    shipping_address: next.shipping_address,
    scheduled_production_date: next.scheduled_production_date,
    estimated_shipped_date: next.estimated_shipped_date,
    actual_ship_date: next.actual_ship_date,
    tracking: next.tracking,
  });
  return getOrder(id);
}

// ----- Items -----
export function listOrderItems(orderId: string): OrderItemRow[] {
  return db
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY position ASC, created_at ASC")
    .all(orderId) as OrderItemRow[];
}

export function addOrderItem(orderId: string, item: LineItemInput): OrderItemRow {
  const last = db
    .prepare("SELECT MAX(position) as p FROM order_items WHERE order_id = ?")
    .get(orderId) as { p: number | null };
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO order_items (id, order_id, name, size, color_code, type_type, price, quantity, position)
     VALUES (@id, @order_id, @name, @size, @color_code, @type_type, @price, @quantity, @position)`
  ).run({
    id,
    order_id: orderId,
    name: item.name,
    size: item.size ?? null,
    color_code: item.color_code ?? null,
    type_type: item.type_type ?? null,
    price: item.price,
    quantity: item.quantity,
    position: (last.p ?? -1) + 1,
  });
  return db.prepare("SELECT * FROM order_items WHERE id = ?").get(id) as OrderItemRow;
}

export function updateOrderItem(
  itemId: string,
  patch: Partial<LineItemInput>
): OrderItemRow | undefined {
  const existing = db
    .prepare("SELECT * FROM order_items WHERE id = ?")
    .get(itemId) as OrderItemRow | undefined;
  if (!existing) return undefined;
  const next = { ...existing, ...patch };
  db.prepare(
    `UPDATE order_items SET
       name = @name, size = @size, color_code = @color_code, type_type = @type_type,
       price = @price, quantity = @quantity
     WHERE id = @id`
  ).run({
    id: itemId,
    name: next.name,
    size: next.size,
    color_code: next.color_code,
    type_type: next.type_type,
    price: next.price,
    quantity: next.quantity,
  });
  return db.prepare("SELECT * FROM order_items WHERE id = ?").get(itemId) as OrderItemRow;
}

export function deleteOrderItem(itemId: string): boolean {
  return db.prepare("DELETE FROM order_items WHERE id = ?").run(itemId).changes > 0;
}

// ----- History -----
export function listOrderHistory(orderId: string): OrderHistoryRow[] {
  return db
    .prepare("SELECT * FROM order_history WHERE order_id = ? ORDER BY created_at DESC")
    .all(orderId) as OrderHistoryRow[];
}

export function addOrderHistory(
  orderId: string,
  event: string,
  actor = "You"
): OrderHistoryRow {
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO order_history (id, order_id, event, actor) VALUES (?, ?, ?, ?)"
  ).run(id, orderId, event, actor);
  return db
    .prepare("SELECT * FROM order_history WHERE id = ?")
    .get(id) as OrderHistoryRow;
}

// ----- Detail -----
export function getOrderDetail(id: string): OrderDetail | undefined {
  const order = getOrder(id);
  if (!order) return undefined;
  return {
    order,
    items: listOrderItems(id),
    history: listOrderHistory(id),
  };
}

// Recompute amount from items + tax + shipping + rush fee + discount
export function recomputeOrderTotals(orderId: string): OrderRow | undefined {
  const order = getOrder(orderId);
  if (!order) return undefined;
  const items = listOrderItems(orderId);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax =
    order.tax_enabled === 0 ? 0 : Math.round(subtotal * order.tax_rate * 100) / 100;
  const shipping = order.add_shipping_cost ? order.shipping_cost : 0;
  const discountAmount =
    order.discount_type === "percent"
      ? Math.round(subtotal * (order.discount / 100) * 100) / 100
      : order.discount;
  const amount =
    Math.round(
      (subtotal - discountAmount + tax + shipping + (order.rush_fee ?? 0)) * 100
    ) / 100;
  const total_boxes = items.reduce((s, i) => s + i.quantity, 0);
  db.prepare(
    "UPDATE orders SET amount = ?, tax = ?, total_boxes = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(amount, tax, total_boxes, orderId);
  return getOrder(orderId);
}

export function deleteOrder(id: string): boolean {
  const r = db.prepare("DELETE FROM orders WHERE id = ?").run(id);
  return r.changes > 0;
}

export function orderCounts(channel: OrderChannel) {
  const rows = db
    .prepare(
      `SELECT status, archived, COUNT(*) as c FROM orders WHERE channel = ? GROUP BY status, archived`
    )
    .all(channel) as Array<{ status: OrderStatus; archived: number; c: number }>;

  const counts: Record<OrderStatus | "all" | "archived", number> = {
    all: 0,
    archived: 0,
    waiting_for_scheduling: 0,
    scheduled_for_production: 0,
    in_production: 0,
    shipped: 0,
    void: 0,
  };
  for (const r of rows) {
    if (r.archived === 1) {
      counts.archived += r.c;
    } else {
      counts[r.status] += r.c;
      counts.all += r.c;
    }
  }
  return counts;
}
