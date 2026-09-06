"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Cart from "@/components/Cart";
import ProductGrid from "@/components/ProductGrid";
import ProductManager from "@/components/ProductManager";
import StaffManager from "@/components/StaffManager";
import SettingsPanel from "@/components/Settings";
import History from "@/components/History";
import { DEFAULT_CATEGORIES, DEFAULT_EFFECTS, DEFAULT_STAFF_DISPLAY_SETTINGS, DEFAULT_SETTINGS, DEFAULT_STAFF } from "@/constants/defaultData";
import type { CartItem, EffectValue, GachaItem, Product, Role, Sale, Staff, StaffDisplaySettings, StaffDisplaySettingsMap, Theme } from "@/types/pos";
import { ensureDefaults, loadPosData, saveProduct as saveProductDb, setProductActive, deleteProduct as deleteProductDb, saveStaff as saveStaffDb, deleteStaff as deleteStaffDb, saveSettings, saveInventoryEnabled, saveSale, deleteSale } from "@/lib/posData";

type Props = { staffId: number };
type Page = "register" | "history" | "products" | "staff" | "settings";
type ProductFormState = { name: string; price: string; image: string; detailImage: string; description: string; categories: string[]; effects: EffectValue[]; inventoryQuantity: string; gachaItems?: GachaItem[] };
type ThemeByStaff = Record<string, Theme>;
type CachedPosData = { products: Product[]; staff: Staff[]; settings: typeof DEFAULT_SETTINGS; sales: Sale[]; themeByStaff: ThemeByStaff; staffDisplaySettings: StaffDisplaySettingsMap };

const emptyProductForm: ProductFormState = { name: "", price: "", image: "", detailImage: "", description: "", categories: [], effects: [], inventoryQuantity: "0", gachaItems: [] };
const emptyStaffForm = { name: "", role: "STAFF" as Role };
const POS_CACHE_KEY = "pos-system-data-cache-v1";

function getDeviceTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function normalizeStaffDisplaySettings(value?: StaffDisplaySettingsMap): StaffDisplaySettingsMap {
  return { ...DEFAULT_STAFF_DISPLAY_SETTINGS, ...(value ?? {}) };
}

function readCachedPosData(): CachedPosData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(POS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPosData;
    if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.staff) || !Array.isArray(parsed.sales) || !parsed.settings) return null;
    return { ...parsed, staffDisplaySettings: normalizeStaffDisplaySettings(parsed.staffDisplaySettings) };
  } catch { return null; }
}

function writeCachedPosData(data: CachedPosData): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(POS_CACHE_KEY, JSON.stringify(data)); } catch { /* キャッシュ失敗は本体処理に影響させない */ }
}

function normalizeFilterValue(value: string | null | undefined): string {
  return String(value ?? "").trim().normalize("NFKC").toLocaleLowerCase("ja-JP");
}

function hasCategory(product: Product, selected: string): boolean {
  const target = normalizeFilterValue(selected);
  if (!target) return true;
  return Array.isArray(product.categories) && product.categories.some(value => normalizeFilterValue(value) === target);
}

function hasEffect(product: Product, selected: string): boolean {
  const target = normalizeFilterValue(selected);
  if (!target) return true;
  return Array.isArray(product.effects) && product.effects.some(effect => normalizeFilterValue(effect?.type) === target);
}

export default function Register({ staffId }: Props) {
  const cached = useMemo(() => readCachedPosData(), []);
  const [page, setPage] = useState<Page>("register");
  const [products, setProducts] = useState<Product[]>(cached?.products ?? []);
  const [staff, setStaff] = useState<Staff[]>(cached?.staff ?? DEFAULT_STAFF);
  const [sales, setSales] = useState<Sale[]>(cached?.sales ?? []);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [settings, setSettings] = useState(cached?.settings ?? DEFAULT_SETTINGS);
  const [themeByStaff, setThemeByStaff] = useState<ThemeByStaff>(cached?.themeByStaff ?? {});
  const [staffDisplaySettings, setStaffDisplaySettings] = useState<StaffDisplaySettingsMap>(normalizeStaffDisplaySettings(cached?.staffDisplaySettings));
  const [deviceTheme, setDeviceTheme] = useState<Theme>("dark");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [productEditingId, setProductEditingId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [newCategory, setNewCategory] = useState("");
  const [newEffect, setNewEffect] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [historySort, setHistorySort] = useState<"newest" | "oldest">("newest");
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productEffect, setProductEffect] = useState("");
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const selectedStaff = staff.find(item => item.id === staffId) ?? null;
  const effectiveTheme = useMemo<Theme>(() => selectedStaff ? (themeByStaff[String(selectedStaff.id)] ?? deviceTheme) : deviceTheme, [selectedStaff, themeByStaff, deviceTheme]);
  const currentDisplay = selectedStaff ? (staffDisplaySettings[String(selectedStaff.id)] ?? { registerColumns: 4, registerMobileColumns: 2, productColumns: 3, productMobileColumns: 2 }) : { registerColumns: 4, registerMobileColumns: 2, productColumns: 3, productMobileColumns: 2 };

  useEffect(() => {
    setDeviceTheme(getDeviceTheme());
    let cancelled = false;
    (async () => {
      try {
        await ensureDefaults();
        const data = await loadPosData();
        if (cancelled) return;
        setProducts(data.products); setStaff(data.staff); setSettings(data.settings); setSales(data.sales); setThemeByStaff(data.themeByStaff); setStaffDisplaySettings(normalizeStaffDisplaySettings(data.staffDisplaySettings));
        writeCachedPosData(data); setError("");
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "D1からデータを取得できませんでした"); }
      finally { if (!cancelled) setLoaded(true); }
    })();
    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    const onDeviceThemeChange = (event: MediaQueryListEvent) => setDeviceTheme(event.matches ? "light" : "dark");
    const onDisplaySettingsChange = (event: Event) => {
      const detail = (event as CustomEvent<{ staffId: number; settings: StaffDisplaySettings }>).detail;
      if (!detail || detail.staffId !== staffId) return;
      setStaffDisplaySettings(current => ({ ...current, [String(staffId)]: detail.settings }));
    };
    window.addEventListener("pos-display-settings-changed", onDisplaySettingsChange); media?.addEventListener?.("change", onDeviceThemeChange);
    return () => { cancelled = true; media?.removeEventListener?.("change", onDeviceThemeChange); window.removeEventListener("pos-display-settings-changed", onDisplaySettingsChange); };
  }, [staffId]);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.style.colorScheme = effectiveTheme;
    if (!loaded) return;

    void saveSettings(
      { ...settings, theme: effectiveTheme },
      themeByStaff
    ).catch(e =>
      setError(
        e instanceof Error
          ? e.message
          : "設定を保存できませんでした"
      )
    );
  }, [
    effectiveTheme,
    settings.storeName,
    settings.taxRate,
    settings.columns,
    settings.categories,
    settings.effects,
    themeByStaff,
    loaded,
  ]);

  if (!selectedStaff) return <main className="content"><section className="panel"><h1>スタッフ情報を読み込めません</h1><p>{error || "このスタッフは存在しないか無効になっています。"}</p></section></main>;

  const canManageProducts = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(selectedStaff.role);
  const canManageStaff = selectedStaff.role === "SUPER_ADMIN" || selectedStaff.role === "ADMIN";
  const canManageSettings = selectedStaff.role === "SUPER_ADMIN" || selectedStaff.role === "ADMIN";
  const canManageHistory = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(selectedStaff.role);

  const registerCategories = useMemo(() => {
    const configured = settings.categories.length ? settings.categories : DEFAULT_CATEGORIES;
    const fromProducts = products.flatMap(product => Array.isArray(product.categories) ? product.categories : []).filter(Boolean);
    return Array.from(new Set([...configured, ...fromProducts]));
  }, [settings.categories, products]);
  const registerEffects = useMemo(() => {
    const configured = settings.effects.length ? settings.effects : DEFAULT_EFFECTS;
    const fromProducts = products.flatMap(product => Array.isArray(product.effects) ? product.effects.map(effect => effect.type) : []).filter(Boolean);
    return Array.from(new Set([...configured, ...fromProducts]));
  }, [settings.effects, products]);

  const search = productSearch.trim().toLowerCase();
  const filteredProducts = products.filter(product => product.isActive && (!search || product.name.toLowerCase().includes(search)) && hasCategory(product, productCategory) && hasEffect(product, productEffect));
  const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const goPage = (next: Page) => { if (editingSale && next !== "register") { setEditingSale(null); setCart([]); } setPage(next); setDetailProduct(null); };
  const setStaffTheme = (nextTheme: Theme) => setThemeByStaff(current => ({ ...current, [String(selectedStaff.id)]: nextTheme }));
  const toggleTheme = () => setStaffTheme(effectiveTheme === "dark" ? "light" : "dark");

  const handleDisplaySettingsChange = async (value: StaffDisplaySettings) => {
    setStaffDisplaySettings(current => ({ ...current, [String(selectedStaff.id)]: value }));
    writeCachedPosData({ products, staff, settings, sales, themeByStaff, staffDisplaySettings: { ...staffDisplaySettings, [String(selectedStaff.id)]: value } });
  };

  const getReservedQuantityForEdit = (product: Product) => editingSale?.items.filter(item => item.name === product.name && item.price === product.price).reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const getMaxCartQuantity = (product: Product) => settings.inventoryEnabled ? product.inventoryQuantity + getReservedQuantityForEdit(product) : Number.POSITIVE_INFINITY;

  const addCart = (product: Product) => {
    setCart(current => {
      const exists = current.find(item => item.id === product.id);
      const currentQuantity = exists?.quantity ?? 0;
      const max = getMaxCartQuantity(product);
      if (settings.inventoryEnabled && currentQuantity >= max) { setError(`「${product.name}」の在庫が不足しています。`); return current; }
      setError("");
      return exists ? current.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }];
    });
  };
  const changeQuantity = (id: number, amount: number) => setCart(current => current.map(item => {
    if (item.id !== id) return item;
    const product = products.find(candidate => candidate.id === id) ?? item;
    const next = item.quantity + amount;
    const max = getMaxCartQuantity(product);
    if (settings.inventoryEnabled && next > max) { setError(`「${item.name}」の在庫が不足しています。`); return item; }
    setError("");
    return { ...item, quantity: next };
  }).filter(item => item.quantity > 0));

  const checkout = async () => {
    if (!cart.length) return;
    const subtotal = cartTotal; const tax = Math.floor(subtotal * settings.taxRate);
    const sale: Sale = editingSale
      ? { ...editingSale, items: cart.map(item => ({ name: item.name, price: item.price, quantity: item.quantity, category: item.categories[0] ?? "その他" })), subtotal, tax, total: subtotal + tax }
      : { id: `SALE-${Date.now()}`, date: new Date().toISOString(), staff: selectedStaff.name, items: cart.map(item => ({ name: item.name, price: item.price, quantity: item.quantity, category: item.categories[0] ?? "その他" })), subtotal, tax, total: subtotal + tax };
    try {
      const inventoryEnabledAtCheckout = Boolean(
        settings.inventoryEnabled
      );

      await saveSale(
        sale,
        products,
        staff,
        inventoryEnabledAtCheckout
      );

      const fresh = await loadPosData();

      /*
       * 会計後の再読み込みで、古い設定や競合した保存処理によって
       * inventory_enabled がOFFへ戻らないようにする。
       *
       * 会計開始時にONだった場合は、D1にもONを明示的に維持する。
       */
      if (
        fresh.settings.inventoryEnabled !==
        inventoryEnabledAtCheckout
      ) {
        await saveInventoryEnabled(
          inventoryEnabledAtCheckout
        );
        fresh.settings = {
          ...fresh.settings,
          inventoryEnabled:
            inventoryEnabledAtCheckout,
        };
      }

      setProducts(fresh.products);
      setStaff(fresh.staff);
      setSettings(fresh.settings);
      setSales(fresh.sales);
      setThemeByStaff(fresh.themeByStaff);
      setStaffDisplaySettings(
        normalizeStaffDisplaySettings(
          fresh.staffDisplaySettings
        )
      );

      writeCachedPosData(fresh);
      setCart([]);
      setEditingSale(null);
      setPage("history");
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "会計を保存できませんでした"); }
  };

  const editSale = (sale: Sale) => {
    const restored = sale.items.map((item, index) => {
      const match = products.find(product => product.name === item.name && product.price === item.price);
      return match ? { ...match, quantity: item.quantity } : ({ id: -(index + 1), name: item.name, price: item.price, image: "", detailImage: "", categories: [item.category], effects: [], description: "", isActive: false, inventoryQuantity: 0, quantity: item.quantity } as CartItem);
    });
    setEditingSale(sale); setCart(restored); setPage("register"); setError("");
  };
  const cancelSaleEdit = () => { setEditingSale(null); setCart([]); setPage("history"); setError(""); };

  const saveProduct = async () => {
    if (!canManageProducts || !productForm.name.trim()) return;
    const price = Number(productForm.price); const inventoryQuantity = Math.max(0, Math.floor(Number(productForm.inventoryQuantity) || 0));
    if (!Number.isFinite(price) || price < 0) return;
    const product: Product = productEditingId !== null
      ? { ...(products.find(p => p.id === productEditingId) as Product), ...productForm, name: productForm.name.trim(), price, inventoryQuantity }
      : { id: Math.max(0, ...products.map(p => p.id)) + 1, ...productForm, name: productForm.name.trim(), price, inventoryQuantity, isActive: true };
    try { await saveProductDb(product); setProducts(current => productEditingId !== null ? current.map(p => p.id === product.id ? product : p) : [...current, product]); setProductEditingId(null); setProductForm(emptyProductForm); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "商品を保存できませんでした"); }
  };
  const editProduct = (product: Product) => { setProductEditingId(product.id); setProductForm({ name: product.name, price: String(product.price), image: product.image, detailImage: product.detailImage, description: product.description, categories: [...product.categories], effects: product.effects.map(effect => ({ ...effect })), inventoryQuantity: String(product.inventoryQuantity ?? 0) , gachaItems: (product.gachaItems ?? []).map(item => ({ ...item, categories: (item as any).categories ? [...(item as any).categories] : (item.category ? item.category.split(" / ").filter(Boolean) : []), effects: (item as any).effects ? (item as any).effects.map((e: any) => ({ ...e })) : [] }))}); setPage("products"); };
  const cancelProductEdit = () => { setProductEditingId(null); setProductForm(emptyProductForm); };
  const deleteProduct = async (product: Product) => {
    if (!canManageProducts) return;
    try { await deleteProductDb(product); setProducts(current => current.filter(p => (p.dbId ?? String(p.id)) !== (product.dbId ?? String(product.id)))); setCart(current => current.filter(item => (item.dbId ?? String(item.id)) !== (product.dbId ?? String(product.id)))); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "商品を削除できませんでした"); }
  };
  const toggleProduct = async (product: Product) => {
    if (!canManageProducts) return;
    try {
      const next = await setProductActive(product, !product.isActive);
      setProducts(current => current.map(p => (p.dbId ?? String(p.id)) === (product.dbId ?? String(product.id)) ? next : p));
      writeCachedPosData({ products: products.map(p => (p.dbId ?? String(p.id)) === (product.dbId ?? String(product.id)) ? next : p), staff, settings, sales, themeByStaff, staffDisplaySettings });
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "商品状態を保存できませんでした"); }
  };

  const addStaff = async () => {
    if (!canManageStaff || !staffForm.name.trim()) return;

    if (
      staffForm.role === "SUPER_ADMIN" &&
      selectedStaff.role !== "SUPER_ADMIN"
    ) {
      return;
    }

    const member: Staff = {
      id: Math.max(0, ...staff.map((s) => s.id)) + 1,
      name: staffForm.name.trim(),
      role: staffForm.role,
      active: true,
    };

    try {
      await saveStaffDb(member);
      setStaff((current) => [...current, member]);
      setStaffForm(emptyStaffForm);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "スタッフを保存できませんでした"
      );
    }
  };

  const removeStaff = async (id: number) => {
    if (!canManageStaff) return;

    const member = staff.find((s) => s.id === id);

    if (
      !member ||
      member.role === "SUPER_ADMIN" ||
      (member.role === "ADMIN" && selectedStaff.role !== "SUPER_ADMIN")
    ) {
      return;
    }

    try {
      await deleteStaffDb(id);
      setStaff((current) => current.filter((item) => item.id !== id));
      setError("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "スタッフを削除できませんでした"
      );
    }
  };

  const changeStaffRole = async (id: number, role: Role) => {
    if (!canManageStaff) return;

    const member = staff.find((s) => s.id === id);

    if (!member || member.role === "SUPER_ADMIN") return;

    if (
      selectedStaff.role !== "SUPER_ADMIN" &&
      (member.role === "ADMIN" || role === "SUPER_ADMIN" || role === "ADMIN")
    ) {
      return;
    }

    const next = { ...member, role };

    try {
      await saveStaffDb(next);
      setStaff((current) =>
        current.map((s) => (s.id === id ? next : s))
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "スタッフ権限を保存できませんでした"
      );
    }
  };

  const resetSystem = () => {
    if (!canManageSettings || !window.confirm("初期状態の設定を読み込みますか？\n商品・会計履歴・スタッフは変更せず、設定だけを初期値に戻します。")) return;
    setCart([]); setEditingSale(null); setSettings(DEFAULT_SETTINGS); setThemeByStaff({}); setStaffDisplaySettings(DEFAULT_STAFF_DISPLAY_SETTINGS); setPage("register"); setProductEditingId(null); setProductForm(emptyProductForm); setError("");
  };

  const nav = <Header storeName={settings.storeName} theme={effectiveTheme} staff={selectedStaff} displaySettings={currentDisplay} onDisplaySettingsChange={handleDisplaySettingsChange} onThemeChange={toggleTheme} page={page} setPage={goPage} permissions={{ products: canManageProducts, staff: canManageStaff, settings: canManageSettings }} />;
  const errorBanner = error ? <div className="content" style={{ paddingBottom: 0 }}><div className="panel" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{error}</div></div> : null;

  if (page === "products") return <>{nav}{errorBanner}<ProductManager products={products} columns={currentDisplay.productColumns} mobileColumns={currentDisplay.productMobileColumns} categories={settings.categories} effects={settings.effects} canDelete={canManageProducts} inventoryEnabled={settings.inventoryEnabled} editingId={productEditingId} form={productForm} setForm={setProductForm} onSave={saveProduct} onEdit={editProduct} onDelete={deleteProduct} onToggleActive={toggleProduct} onCancelEdit={cancelProductEdit} />;</>;
  if (page === "staff") return <>{nav}{errorBanner}<StaffManager staff={staff} canManage={canManageStaff} currentRole={selectedStaff.role} form={staffForm} setForm={setStaffForm} onAdd={addStaff} onDelete={removeStaff} onRoleChange={changeStaffRole} />;</>;
  if (page === "settings") return <>{nav}{errorBanner}<SettingsPanel currentRole={selectedStaff.role} storeName={settings.storeName} taxRate={settings.taxRate} columns={settings.columns} theme={effectiveTheme} categories={settings.categories} effects={settings.effects} newCategory={newCategory} newEffect={newEffect} inventoryEnabled={settings.inventoryEnabled} onStoreNameChange={value => setSettings(current => ({ ...current, storeName: value }))} onTaxChange={value => setSettings(current => ({ ...current, taxRate: value / 100 }))} onColumnsChange={value => setSettings(current => ({ ...current, columns: value }))} onThemeChange={setStaffTheme} onNewCategoryChange={setNewCategory} onNewEffectChange={setNewEffect} onAddCategory={() => { const value = newCategory.trim(); if (value && !settings.categories.includes(value)) setSettings(current => ({ ...current, categories: [...current.categories, value] })); setNewCategory(""); }} onRemoveCategory={value => setSettings(current => ({ ...current, categories: current.categories.filter(item => item !== value) }))} onAddEffect={() => { const value = newEffect.trim(); if (value && !settings.effects.includes(value)) setSettings(current => ({ ...current, effects: [...current.effects, value] })); setNewEffect(""); }} onRemoveEffect={value => setSettings(current => ({ ...current, effects: current.effects.filter(item => item !== value) }))} onInventoryChange={value => {
          setSettings(current => ({
            ...current,
            inventoryEnabled: value,
          }));
          void saveInventoryEnabled(value).catch(e =>
            setError(
              e instanceof Error
                ? e.message
                : "在庫設定を保存できませんでした"
            )
          );
        }} onReset={resetSystem} />;</>;
  if (page === "history") return <>{nav}{errorBanner}<main className="content admin"><History sales={sales} staffList={staff} canManage={canManageHistory} filterStaff={filterStaff} filterMonth={filterMonth} sort={historySort} storeName={settings.storeName} onFilterStaff={setFilterStaff} onFilterMonth={setFilterMonth} onSortChange={setHistorySort} onEdit={editSale} onDelete={async id => { if (!canManageHistory) return; try { await deleteSale(id, settings.inventoryEnabled); const fresh = await loadPosData(); setProducts(fresh.products); setSales(fresh.sales); writeCachedPosData(fresh); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "会計を削除できませんでした"); } }} /></main></>;

  return <>{nav}{errorBanner}<main className="content"><div className="register"><section className="registerMain"><div className="sectionTitle"><div><h1>商品</h1><p>{editingSale ? "会計内容を変更しています" : "商品を選択してカートへ追加"}</p></div><span>{filteredProducts.length} 商品</span></div><div className="searchArea"><input className="input" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="商品名を検索..." /><select className="input" value={productCategory} onChange={e => setProductCategory(e.target.value)}><option value="">全カテゴリー</option>{registerCategories.map(category => <option key={category} value={category}>{category}</option>)}</select><select className="input" value={productEffect} onChange={e => setProductEffect(e.target.value)}><option value="">全ての効果</option>{registerEffects.map(effect => <option key={effect} value={effect}>{effect}</option>)}</select></div><ProductGrid products={filteredProducts} columns={currentDisplay.registerColumns} mobileColumns={currentDisplay.registerMobileColumns} inventoryEnabled={settings.inventoryEnabled} onSelect={setDetailProduct} onAddCart={addCart} /></section><Cart cart={cart} total={cartTotal + Math.floor(cartTotal * settings.taxRate)} quantity={cartQuantity} onQty={changeQuantity} onClear={() => setCart([])} onCheckout={checkout} editing={Boolean(editingSale)} onCancelEdit={cancelSaleEdit} /></div></main>{detailProduct && <div className="overlay" onClick={() => setDetailProduct(null)}><div className="modal productDetailModal" onClick={e => e.stopPropagation()}><button type="button" className="close" onClick={() => setDetailProduct(null)}>×</button><h2>{detailProduct.name}</h2>{detailProduct.detailImage || detailProduct.image ? <img className="detailImage" src={detailProduct.detailImage || detailProduct.image} alt={detailProduct.name} /> : null}<strong className="detailPrice">¥{detailProduct.price.toLocaleString("ja-JP")}</strong><p>{detailProduct.description || "商品説明はありません"}</p>{settings.inventoryEnabled && <p className={detailProduct.inventoryQuantity > 0 ? "inventoryDetail" : "inventoryDetail is-empty"}>{detailProduct.inventoryQuantity > 0 ? `在庫：${detailProduct.inventoryQuantity}` : "在庫：売り切れ"}</p>}<div className="effectSummary">{detailProduct.effects.map(effect => <span key={`${detailProduct.dbId ?? detailProduct.id}-${effect.type}`}>{effect.type} {effect.value}</span>)}</div><button type="button" className={settings.inventoryEnabled && getMaxCartQuantity(detailProduct) <= (cart.find(item => item.id === detailProduct.id)?.quantity ?? 0) ? "secondary full" : "primary full"} disabled={settings.inventoryEnabled && getMaxCartQuantity(detailProduct) <= (cart.find(item => item.id === detailProduct.id)?.quantity ?? 0)} onClick={() => { addCart(detailProduct); setDetailProduct(null); }}>{settings.inventoryEnabled && getMaxCartQuantity(detailProduct) <= (cart.find(item => item.id === detailProduct.id)?.quantity ?? 0) ? "売り切れ" : "カートに追加"}</button></div></div>}</>;
}
