import type { Product, Sale, Settings, Staff, Theme, Role, StaffDisplaySettings, StaffDisplaySettingsMap } from "@/types/pos";
import { DEFAULT_SETTINGS, DEFAULT_STAFF_DISPLAY_SETTINGS } from "@/constants/defaultData";
import { fromD1Role, d1, toD1Role, getStaffAuthHeaders } from "@/lib/d1";

type DbProduct = { id: string; local_id: number | null; name: string; price: number; image_url: string | null; detail_image_url: string | null; description: string | null; category: string; effects: unknown; is_active: boolean | number | string; inventory_quantity: number; gacha_items?: unknown };
type DbStaff = { id: string; local_id: number | null; name: string; role: string; active: boolean };
type DbSetting = { id: string; store_name: string; tax_rate: number; theme: string; columns: number; categories: unknown; effects: unknown; theme_by_staff: unknown; inventory_enabled: boolean };
type DbStaffDisplay = { role: string; register_columns: number; register_mobile_columns: number; product_columns: number; product_mobile_columns: number };
type DbSale = { id: string; local_id: string | null; staff_id: string | null; subtotal: number; tax: number; total: number; created_at: string | null };
type DbSaleItem = { sale_id: string; product_id: string | null; name: string; price: number; quantity: number };
type InventoryItem = { productId: string; quantity: number };

const arr = <T,>(value: unknown, fallback: T[]): T[] => Array.isArray(value) ? value as T[] : fallback;
const numberId = (value: number | null | undefined, fallback: number) => Number.isFinite(value) ? Number(value) : fallback;
const clampColumns = (value: number, min: number, max: number, fallback: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
const DEFAULT_DISPLAY: StaffDisplaySettings = { registerColumns: 4, registerMobileColumns: 2, productColumns: 3, productMobileColumns: 2 };

function normalizeBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "on";
  }
  return false;
}

export type PosData = { products: Product[]; staff: Staff[]; settings: Settings; sales: Sale[]; themeByStaff: Record<string, Theme>; staffDisplaySettings: StaffDisplaySettingsMap; roleDisplaySettings: StaffDisplaySettingsMap };

function buildStaffDisplaySettings(rows: DbStaffDisplay[], staff: Staff[]): StaffDisplaySettingsMap {
  const result: StaffDisplaySettingsMap = { ...DEFAULT_STAFF_DISPLAY_SETTINGS };
  const legacyByRole = new Map<Role, StaffDisplaySettings>();
  for (const row of rows) {
    const key = String(row.role);
    const values: StaffDisplaySettings = {
      registerColumns: clampColumns(Number(row.register_columns), 2, 6, DEFAULT_DISPLAY.registerColumns),
      registerMobileColumns: clampColumns(Number(row.register_mobile_columns), 1, 4, DEFAULT_DISPLAY.registerMobileColumns),
      productColumns: clampColumns(Number(row.product_columns), 2, 6, DEFAULT_DISPLAY.productColumns),
      productMobileColumns: clampColumns(Number(row.product_mobile_columns), 1, 4, DEFAULT_DISPLAY.productMobileColumns),
    };
    if (/^\d+$/.test(key)) result[key] = values;
    else {
      try { legacyByRole.set(fromD1Role(key), values); } catch { /* Ignore obsolete legacy rows. */ }
    }
  }
  for (const member of staff) {
    const key = String(member.id);
    if (!result[key] && legacyByRole.has(member.role)) result[key] = legacyByRole.get(member.role)!;
    if (!result[key]) result[key] = { ...DEFAULT_DISPLAY };
  }
  return result;
}

function getCurrentStaffId(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem("pos-current-staff-id"); } catch { return null; }
}

function buildCurrentStaffRoleMap(staff: Staff[], staffDisplaySettings: StaffDisplaySettingsMap): StaffDisplaySettingsMap {
  const currentId = getCurrentStaffId();
  const current = currentId ? staffDisplaySettings[currentId] : null;
  const fallback = staffDisplaySettings[String(staff[0]?.id)] ?? DEFAULT_DISPLAY;
  const value = current ?? fallback;
  return Object.fromEntries(staff.map(member => [member.role, value]));
}

function toBool(value: unknown): boolean { return value === true || value === 1 || value === "1"; }

async function changeInventory(action: "consume" | "restore", items: InventoryItem[]): Promise<void> {
  const normalized = items.filter(item => item.quantity > 0 && item.productId);
  if (!normalized.length) return;
  const response = await fetch("/api/inventory", {
    method: "POST",
    headers: {
      ...getStaffAuthHeaders(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ action, items: normalized }),
  });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "在庫を更新できませんでした。");
}

function mergeInventory(items: InventoryItem[]): InventoryItem[] {
  const map = new Map<string, number>();
  for (const item of items) map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
  return [...map.entries()].filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId, quantity }));
}

export async function loadStaffSelectData(): Promise<Pick<PosData, "staff" | "settings" | "staffDisplaySettings">> {
  const [dbStaff, dbSettings, dbDisplay] = await Promise.all([
    d1.get<DbStaff[]>("staff?select=*&order=local_id.asc"),
    d1.get<DbSetting[]>("settings?select=*&id=eq.default&limit=1"),
    d1.get<DbStaffDisplay[]>("role_display_settings?select=*&order=role.asc"),
  ]);
  const staff = dbStaff.map((s, index) => ({ id: numberId(s.local_id, index + 1), name: s.name, role: fromD1Role(s.role), active: s.active }));
  const row = dbSettings[0];
  const settings: Settings = row ? { storeName: row.store_name || DEFAULT_SETTINGS.storeName, taxRate: Number(row.tax_rate || 0) / 100, theme: row.theme === "light" ? "light" : "dark", columns: Number(row.columns) || DEFAULT_SETTINGS.columns, categories: arr(row.categories, DEFAULT_SETTINGS.categories), effects: arr(row.effects, DEFAULT_SETTINGS.effects), inventoryEnabled: toBool(row.inventory_enabled) } : DEFAULT_SETTINGS;
  const staffDisplaySettings = buildStaffDisplaySettings(dbDisplay, staff);
  return { staff, settings, staffDisplaySettings };
}

export async function loadPosData(): Promise<PosData> {
  const [dbProducts, dbStaff, dbSettings, dbSales, dbDisplay] = await Promise.all([
    d1.get<DbProduct[]>("products?select=*&order=local_id.asc"),
    d1.get<DbStaff[]>("staff?select=*&order=local_id.asc"),
    d1.get<DbSetting[]>("settings?select=*&id=eq.default&limit=1"),
    d1.get<DbSale[]>("sales?select=*&order=created_at.desc"),
    d1.get<DbStaffDisplay[]>("role_display_settings?select=*&order=role.asc"),
  ]);
  const maxLocalId = dbProducts.reduce((max, product) => Math.max(max, numberId(product.local_id, 0)), 0); let syntheticId = maxLocalId;
  const products = dbProducts.length ? dbProducts.map((p, index) => {
    const id = p.local_id !== null && Number.isFinite(p.local_id) ? Number(p.local_id) : ++syntheticId;
    return { id: numberId(id, index + 1), dbId: p.id, name: p.name, price: p.price, image: p.image_url ?? "", detailImage: p.detail_image_url ?? "", categories: p.category ? [p.category] : ["その他"], effects: arr<{ type: string; value: number }>(p.effects, []).map(e => ({ type: e.type, value: Number(e.value) || 0 })), description: p.description ?? "", isActive: normalizeBool(p.is_active), inventoryQuantity: Math.max(0, Number(p.inventory_quantity) || 0), gachaItems: arr<any>(p.gacha_items, []).map((item) => ({ ...item, categories: Array.isArray(item.categories) ? item.categories : (item.category ? String(item.category).split(" / ").filter(Boolean) : []), effects: Array.isArray(item.effects) ? item.effects : [] })) };
  }) : [];
  const staff = dbStaff.map((s, index) => ({ id: numberId(s.local_id, index + 1), name: s.name, role: fromD1Role(s.role), active: s.active }));
  const row = dbSettings[0];
  const settings: Settings = row ? { storeName: row.store_name || DEFAULT_SETTINGS.storeName, taxRate: Number(row.tax_rate || 0) / 100, theme: row.theme === "light" ? "light" : "dark", columns: Number(row.columns) || DEFAULT_SETTINGS.columns, categories: arr(row.categories, DEFAULT_SETTINGS.categories), effects: arr(row.effects, DEFAULT_SETTINGS.effects), inventoryEnabled: toBool(row.inventory_enabled) } : DEFAULT_SETTINGS;
  const themeByStaff = row && row.theme_by_staff && typeof row.theme_by_staff === "object" ? row.theme_by_staff as Record<string, Theme> : {};
  const staffDisplaySettings = buildStaffDisplaySettings(dbDisplay, staff);
  const roleDisplaySettings = buildCurrentStaffRoleMap(staff, staffDisplaySettings);
  const saleItems = dbSales.length ? await d1.get<DbSaleItem[]>(`sale_items?select=*&sale_id=in.(${dbSales.map(s => encodeURIComponent(s.id)).join(",")})`) : [];
  const staffMap = new Map(dbStaff.map(s => [s.id, s.name])); const productMap = new Map(dbProducts.map(p => [p.id, p]));
  const sales: Sale[] = dbSales.map((sale, index) => ({ id: sale.local_id || `SALE-${index + 1}`, dbId: sale.id, date: sale.created_at ?? "", staff: staffMap.get(sale.staff_id ?? "") ?? "不明", items: saleItems.filter(item => item.sale_id === sale.id).map(item => { const product = productMap.get(item.product_id ?? ""); return { name: item.name, price: item.price, quantity: item.quantity, category: product?.category || "その他" }; }), subtotal: sale.subtotal, tax: sale.tax, total: sale.total }));
  return { products, staff, settings, sales, themeByStaff, staffDisplaySettings, roleDisplaySettings };
}

export async function ensureDefaults(): Promise<void> {
  const [settings, staffRows, displayRows] = await Promise.all([
    d1.get<DbSetting[]>("settings?select=id&id=eq.default&limit=1"),
    d1.get<DbStaff[]>("staff?select=local_id,role&order=local_id.asc"),
    d1.get<DbStaffDisplay[]>("role_display_settings?select=role&limit=100"),
  ]);
  if (!settings.length) await d1.post("settings", { store_name: DEFAULT_SETTINGS.storeName, tax_rate: Math.round(DEFAULT_SETTINGS.taxRate * 100), theme: DEFAULT_SETTINGS.theme, columns: DEFAULT_SETTINGS.columns, categories: DEFAULT_SETTINGS.categories, effects: DEFAULT_SETTINGS.effects, theme_by_staff: {}, inventory_enabled: DEFAULT_SETTINGS.inventoryEnabled });
  const existing = new Set(displayRows.map(row => String(row.role)));
  for (const member of staffRows) {
    const id = String(member.local_id);
    if (!existing.has(id)) await d1.post("role_display_settings", { role: id, register_columns: DEFAULT_DISPLAY.registerColumns, register_mobile_columns: DEFAULT_DISPLAY.registerMobileColumns, product_columns: DEFAULT_DISPLAY.productColumns, product_mobile_columns: DEFAULT_DISPLAY.productMobileColumns });
  }
}

let settingsSaveQueue: Promise<void> = Promise.resolve();

export function saveSettings(
  settings: Settings,
  themeByStaff: Record<string, Theme>
): Promise<void> {
  /*
   * 設定保存を直列化します。
   *
   * 設定画面では複数の変更が短時間に発生することがあり、
   * 古い状態を保存するリクエストが新しい状態より後に完了すると、
   * inventory_enabled が ON → OFF のように巻き戻る可能性があります。
   *
   * 在庫ON/OFFは saveInventoryEnabled() が専用で保存するため、
   * この汎用保存では inventory_enabled を一切更新しません。
   * これにより、ログイン直後などの古いstateが在庫設定をOFFへ
   * 巻き戻すことを防ぎます。
   */
  const snapshot: Settings = {
    ...settings,
    storeName: settings.storeName,
    categories: [...settings.categories],
    effects: [...settings.effects],
    inventoryEnabled: Boolean(settings.inventoryEnabled),
  };

  const themeSnapshot = {
    ...themeByStaff,
  };

  settingsSaveQueue = settingsSaveQueue
    .catch(() => {
      // 前回の保存失敗で次回保存まで止めない
    })
    .then(async () => {
      const rows = await d1.get<DbSetting[]>(
        "settings?select=id&id=eq.default&limit=1"
      );

      const body = {
        store_name:
          snapshot.storeName.trim() ||
          DEFAULT_SETTINGS.storeName,
        tax_rate: Math.round(
          snapshot.taxRate * 100
        ),
        theme: snapshot.theme,
        columns: snapshot.columns,
        categories: snapshot.categories,
        effects: snapshot.effects,
        theme_by_staff: themeSnapshot,
        // inventory_enabled is intentionally NOT written here.
        // It has a dedicated saveInventoryEnabled() path so that
        // the generic settings autosave can never overwrite the
        // inventory switch with a stale value after reload/login.
      };

      if (rows[0]) {
        await d1.patch(
          `settings?id=eq.${rows[0].id}`,
          body
        );
      } else {
        await d1.post("settings", body);
      }
    });

  return settingsSaveQueue;
}

export async function saveStaffDisplaySettings(staffId: number, values: StaffDisplaySettings): Promise<void> {
  const key = String(staffId);
  const body = { role: key, register_columns: clampColumns(values.registerColumns, 2, 6, 4), register_mobile_columns: clampColumns(values.registerMobileColumns, 1, 4, 2), product_columns: clampColumns(values.productColumns, 2, 6, 3), product_mobile_columns: clampColumns(values.productMobileColumns, 1, 4, 2) };
  const rows = await d1.get<DbStaffDisplay[]>(`role_display_settings?select=role&role=eq.${encodeURIComponent(key)}&limit=1`);
  if (rows[0]) await d1.patch(`role_display_settings?role=eq.${encodeURIComponent(key)}`, body); else await d1.post("role_display_settings", body);
}

/** @deprecated StaffDisplaySettingsを使用する新UIではsaveStaffDisplaySettingsを利用します。 */
export async function saveRoleDisplaySettings(_role: Role, _values: StaffDisplaySettings): Promise<void> { return; }

export async function saveProduct(product: Product): Promise<void> {
  const body = {
    local_id: product.id,
    name: product.name,
    price: Number(product.price) || 0,
    image_url: product.image || null,
    detail_image_url: product.detailImage || null,
    description: product.description || "",
    category: product.categories[0] ?? "その他",
    effects: product.effects ?? [],
    gacha_items: product.gachaItems ?? [],
    is_active: normalizeBool(product.isActive),
    inventory_quantity: Math.max(0, Math.floor(Number(product.inventoryQuantity) || 0)),
  };

  const same = (row: Partial<DbProduct> | undefined) => {
    if (!row) return false;
    return Number(row.local_id) === product.id
      && String(row.name ?? "") === String(body.name)
      && Number(row.price) === Number(body.price)
      && normalizeBool(row.is_active) === body.is_active
      && Number(row.inventory_quantity ?? 0) === Number(body.inventory_quantity)
      && String(row.category ?? "") === String(body.category)
      && String(row.description ?? "") === String(body.description)
      && String(row.image_url ?? "") === String(body.image_url ?? "")
      && String(row.detail_image_url ?? "") === String(body.detail_image_url ?? "")
      && JSON.stringify(row.effects ?? []) === JSON.stringify(body.effects ?? [])
      && JSON.stringify(row.gacha_items ?? []) === JSON.stringify(body.gacha_items ?? []);
  };

  const readByLocalId = async () => d1.get<DbProduct[]>(
    `products?select=*&local_id=eq.${encodeURIComponent(product.id)}&limit=1`
  );

  const readByDbId = async () => product.dbId
    ? d1.get<DbProduct[]>(`products?select=*&id=eq.${encodeURIComponent(product.dbId)}&limit=1`)
    : [];

  // まずD1のlocal_idで既存商品を特定する。local_idは商品の公開IDとして一意。
  let rows = await readByLocalId();

  if (rows[0]) {
    const dbId = String(rows[0].id);
    await d1.patch(`products?id=eq.${encodeURIComponent(dbId)}`, body);
    rows = await readByLocalId();
    if (same(rows[0])) return;

    // 念のためlocal_id条件でも再試行。
    await d1.patch(`products?local_id=eq.${encodeURIComponent(product.id)}`, body);
    rows = await readByLocalId();
    if (same(rows[0])) return;

    throw new Error("商品データをD1へ保存できませんでした。更新後のD1データが一致しません。");
  }

  // local_idが存在しない旧データはdbIdで更新する。
  rows = await readByDbId();
  if (rows[0]) {
    await d1.patch(`products?id=eq.${encodeURIComponent(rows[0].id)}`, body);
    rows = await readByDbId();
    if (same(rows[0])) return;

    rows = await readByLocalId();
    if (same(rows[0])) return;

    throw new Error("商品データをD1へ保存できませんでした。更新後のD1データが一致しません。");
  }

  // D1に存在しない場合だけ新規登録。
  await d1.post("products", body);
  rows = await readByLocalId();
  if (!same(rows[0])) {
    throw new Error("商品データをD1へ登録できませんでした。保存後のD1データが確認できません。");
  }
}

export async function setProductActive(product: Product, isActive: boolean): Promise<Product> {
  const next: Product = { ...product, isActive };
  await saveProduct(next);
  return next;
}

export async function deleteProduct(product: Product): Promise<void> {
  const body = { is_active: false };

  if (product.dbId) {
    const updated = await d1.patch<Pick<DbProduct, "id">[]>(
      `products?id=eq.${encodeURIComponent(product.dbId)}&select=id`,
      body
    );
    if (updated.length) return;
  }

  const rows = await d1.get<Pick<DbProduct, "id">[]>(
    `products?select=id&local_id=eq.${encodeURIComponent(product.id)}&limit=1`
  );
  if (!rows[0]) throw new Error("商品を削除できませんでした。D1の商品データを確認してください。");

  const updated = await d1.patch<Pick<DbProduct, "id">[]>(
    `products?id=eq.${encodeURIComponent(rows[0].id)}&select=id`,
    body
  );
  if (!updated.length) throw new Error("商品を削除できませんでした。D1の商品データを確認してください。");
}
export async function saveStaff(member: Staff): Promise<void> { const rows = await d1.get<DbStaff[]>(`staff?select=id&local_id=eq.${member.id}&limit=1`); const body = { local_id: member.id, name: member.name, role: toD1Role(member.role), active: member.active }; if (rows[0]) await d1.patch(`staff?id=eq.${rows[0].id}`, body); else await d1.post("staff", body); }
export async function deleteStaff(staffId: number): Promise<void> { const deleted = await d1.delete<DbStaff[]>(`staff?local_id=eq.${staffId}`); if (!deleted.length) throw new Error("スタッフを削除できませんでした。"); }

function productDbId(product: Product | undefined, dbProducts: DbProduct[]): string | null {
  if (!product) return null;
  if (product.dbId) return product.dbId;
  return dbProducts.find(row => Number(row.local_id) === product.id)?.id ?? null;
}

async function adjustSaleInventory(action: "consume" | "restore", items: InventoryItem[]): Promise<void> { await changeInventory(action, mergeInventory(items)); }

export async function saveSale(sale: Sale, products: Product[], staff: Staff[], inventoryEnabled = false): Promise<void> {
  const staffMember = staff.find(s => s.name === sale.staff);
  const staffRows = staffMember ? await d1.get<DbStaff[]>(`staff?select=id&local_id=eq.${staffMember.id}&limit=1`) : [];
  const existing = await d1.get<DbSale[]>(`sales?select=id,local_id&local_id=eq.${encodeURIComponent(sale.id)}&limit=1`);
  const saleDbId = existing[0]?.id ? String(existing[0].id) : null;
  let oldItems: DbSaleItem[] = [];
  if (inventoryEnabled && saleDbId) oldItems = await d1.get<DbSaleItem[]>(`sale_items?select=*&sale_id=eq.${encodeURIComponent(saleDbId)}`);

  const deltaConsume: InventoryItem[] = [];
  const deltaRestore: InventoryItem[] = [];
  if (inventoryEnabled) {
    const oldMap = new Map<string, number>();
    const newMap = new Map<string, number>();
    for (const item of oldItems) oldMap.set(`${item.name}\u0000${item.price}`, (oldMap.get(`${item.name}\u0000${item.price}`) ?? 0) + item.quantity);
    for (const item of sale.items) newMap.set(`${item.name}\u0000${item.price}`, (newMap.get(`${item.name}\u0000${item.price}`) ?? 0) + item.quantity);
    const keys = new Set([...oldMap.keys(), ...newMap.keys()]);
    const dbProducts = await d1.get<DbProduct[]>("products?select=id,local_id,name,price,inventory_quantity,is_active&order=local_id.asc");
    for (const key of keys) {
      const delta = (newMap.get(key) ?? 0) - (oldMap.get(key) ?? 0);
      if (!delta) continue;
      const [name, priceText] = key.split("\u0000");
      const product = products.find(p => p.name === name && p.price === Number(priceText));
      const dbId = productDbId(product, dbProducts);
      if (!dbId) continue;
      if (delta > 0) deltaConsume.push({ productId: dbId, quantity: delta });
      else deltaRestore.push({ productId: dbId, quantity: Math.abs(delta) });
    }
  }

  let consumed = false;
  try {
    await adjustSaleInventory("consume", deltaConsume);
    consumed = deltaConsume.length > 0;
    await adjustSaleInventory("restore", deltaRestore);

    const body = { local_id: sale.id, staff_id: staffRows[0]?.id ?? null, subtotal: sale.subtotal, tax: sale.tax, total: sale.total, created_at: sale.date };
    let saleId: string;
    if (saleDbId) { saleId = saleDbId; await d1.patch(`sales?id=eq.${encodeURIComponent(saleId)}`, body); await d1.delete(`sale_items?sale_id=eq.${encodeURIComponent(saleId)}`); }
    else { saleId = crypto.randomUUID(); await d1.post("sales", { id: saleId, ...body }); const verify = await d1.get<DbSale[]>(`sales?select=id&id=eq.${encodeURIComponent(saleId)}&limit=1`); if (!verify[0]?.id) throw new Error("会計データの作成確認に失敗しました。D1のsalesテーブルを確認してください。"); }
    if (!saleId) throw new Error("会計IDを生成できませんでした。");
    for (const item of sale.items) {
      const product = products.find(p => p.name === item.name && p.price === item.price);
      const productRows = product ? (product.dbId ? await d1.get<DbProduct[]>(`products?select=id&id=eq.${encodeURIComponent(product.dbId)}&limit=1`) : await d1.get<DbProduct[]>(`products?select=id&local_id=eq.${product.id}&limit=1`)) : [];
      await d1.post("sale_items", { sale_id: saleId, product_id: productRows[0]?.id ?? null, name: item.name, price: item.price, quantity: item.quantity });
    }
  } catch (error) {
    if (inventoryEnabled && consumed) {
      try { await adjustSaleInventory("restore", deltaConsume); } catch { /* preserve the original checkout error */ }
    }
    throw error;
  }
}

export async function deleteSale(saleIdOrDbId: string, inventoryEnabled = false): Promise<void> {
  const encoded = encodeURIComponent(saleIdOrDbId);
  const byDbId = await d1.get<DbSale[]>(`sales?select=id,local_id&id=eq.${encoded}&limit=1`);
  const rows = byDbId.length ? byDbId : await d1.get<DbSale[]>(`sales?select=id,local_id&local_id=eq.${encoded}&limit=1`);
  if (!rows[0]) return;
  const dbId = rows[0].id;
  if (inventoryEnabled) {
    const saleItems = await d1.get<DbSaleItem[]>(`sale_items?select=*&sale_id=eq.${encodeURIComponent(dbId)}`);
    await adjustSaleInventory("restore", saleItems.filter(item => item.product_id).map(item => ({ productId: item.product_id as string, quantity: item.quantity })));
  }
  await d1.delete(`sale_items?sale_id=eq.${encodeURIComponent(dbId)}`);
  await d1.delete(`sales?id=eq.${encodeURIComponent(dbId)}`);
  const remaining = await d1.get<DbSale[]>(`sales?select=id&id=eq.${encodeURIComponent(dbId)}&limit=1`);
  if (remaining.length) throw new Error("会計履歴を削除できませんでした。D1への書き込み権限を確認してください。");
}

/**
 * 在庫機能ON/OFF専用保存。
 * 通常の店舗設定保存とは分離し、inventory_enabledだけを変更する。
 */
export async function saveInventoryEnabled(
  enabled: boolean
): Promise<void> {
  const rows = await d1.get<DbSetting[]>(
    "settings?select=id&id=eq.default&limit=1"
  );

  const value = Boolean(enabled);

  if (rows[0]?.id) {
    await d1.patch(
      `settings?id=eq.${rows[0].id}`,
      {
        inventory_enabled: value,
      }
    );
    return;
  }

  await d1.post("settings", {
    store_name: DEFAULT_SETTINGS.storeName,
    tax_rate: Math.round(DEFAULT_SETTINGS.taxRate * 100),
    theme: DEFAULT_SETTINGS.theme,
    columns: DEFAULT_SETTINGS.columns,
    categories: DEFAULT_SETTINGS.categories,
    effects: DEFAULT_SETTINGS.effects,
    theme_by_staff: {},
    inventory_enabled: value,
  });
}
