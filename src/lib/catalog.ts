import db, { type CustomerRow, type ProductRow } from "./db";

export function listCustomers(): CustomerRow[] {
  return db
    .prepare("SELECT * FROM customers ORDER BY name ASC")
    .all() as CustomerRow[];
}

export function getCustomer(id: string): CustomerRow | undefined {
  return db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as
    | CustomerRow
    | undefined;
}

export function listProducts(catalog = "normal"): ProductRow[] {
  return db
    .prepare(
      "SELECT * FROM products WHERE active = 1 AND catalog = ? ORDER BY position ASC"
    )
    .all(catalog) as ProductRow[];
}

export type ProductGroup = {
  key: string;
  label: string;
  price_unit: string;
  products: ProductRow[];
};

export function listProductGroups(catalog = "normal"): ProductGroup[] {
  const rows = listProducts(catalog);
  const groups = new Map<string, ProductGroup>();
  for (const r of rows) {
    const key = r.category ?? "uncategorized";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: r.category_label ?? "Uncategorized",
        price_unit: r.price_unit ?? "each",
        products: [],
      });
    }
    groups.get(key)!.products.push(r);
  }
  return Array.from(groups.values());
}

export function getProduct(id: string): ProductRow | undefined {
  return db.prepare("SELECT * FROM products WHERE id = ?").get(id) as
    | ProductRow
    | undefined;
}
