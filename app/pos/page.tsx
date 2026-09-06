"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Header from "@/components/Header";
import Register from "@/components/Register";
import History from "@/components/History";
import ProductManager from "@/components/ProductManager";
import StaffManager from "@/components/StaffManager";
import Settings from "@/components/Settings";
import { DEFAULT_STAFF_DISPLAY_SETTINGS, DEFAULT_SETTINGS, DEFAULT_STAFF } from "@/constants/defaultData";
import { deleteProduct, deleteSale, loadPosData, saveProduct, saveSettings, saveStaff, saveStaffDisplaySettings, saveInventoryEnabled } from "@/lib/posData";
import type { EffectValue, GachaItem, Product, Role, Sale, Settings as PosSettings, Staff, StaffDisplaySettings, StaffDisplaySettingsMap, Theme } from "@/types/pos";

type Page = "register" | "history" | "products" | "staff" | "settings";
type ThemeByStaff = Record<string, Theme>;
type ProductForm = { name: string; price: string; image: string; detailImage: string; description: string; categories: string[]; effects: EffectValue[]; inventoryQuantity: string; gachaItems?: GachaItem[] };
const emptyForm: ProductForm = { name: "", price: "", image: "", detailImage: "", description: "", categories: [], effects: [], inventoryQuantity: "0", gachaItems: [] };
const POS_CACHE_KEY = "pos-system-data-cache-v1";

function getDeviceTheme(): Theme { if (typeof window === "undefined") return "dark"; return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark"; }

export default function POSPage() {
  const [page, setPage] = useState<Page>("register");
  const [staff, setStaff] = useState<Staff[]>(DEFAULT_STAFF);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<PosSettings>(DEFAULT_SETTINGS);
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentStaff, setCurrentStaff] = useState<Staff>(DEFAULT_STAFF[0]);
  const [themeByStaff, setThemeByStaff] = useState<ThemeByStaff>({});
  const [staffDisplaySettings, setStaffDisplaySettings] = useState<StaffDisplaySettingsMap>(DEFAULT_STAFF_DISPLAY_SETTINGS);
  const [deviceTheme, setDeviceTheme] = useState<Theme>("dark");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [staffForm, setStaffForm] = useState<{ name: string; role: Role }>({ name: "", role: "STAFF" });
  const [newCategory, setNewCategory] = useState("");
  const [newEffect, setNewEffect] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [historySort, setHistorySort] = useState<"newest" | "oldest">("newest");
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  useEffect(() => { setDeviceTheme(getDeviceTheme()); }, []);
  useEffect(() => {
    let cancelled = false; let hasCache = false;
    try {
      const raw = window.localStorage.getItem(POS_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { products?: Product[]; staff?: Staff[]; settings?: PosSettings; sales?: Sale[]; themeByStaff?: ThemeByStaff; staffDisplaySettings?: StaffDisplaySettingsMap };
        if (cached && Array.isArray(cached.sales) && cached.settings) {
          // キャッシュは初期表示専用。
          // D1の最新設定を取得する前に dataLoading=false にすると、
          // 古い inventoryEnabled=false が自動保存されてしまうため、
          // D1読み込み完了までは「読み込み中」を維持する。
          hasCache = true;
          setProducts(Array.isArray(cached.products) ? cached.products : []);
          setStaff(Array.isArray(cached.staff) && cached.staff.length ? cached.staff : DEFAULT_STAFF);
          setSettings(cached.settings);
          setSales(cached.sales);
          setThemeByStaff(cached.themeByStaff ?? {});
          setStaffDisplaySettings(cached.staffDisplaySettings ?? DEFAULT_STAFF_DISPLAY_SETTINGS);
          setCurrentStaff(current => cached.staff?.find(member => member.id === current.id) ?? cached.staff?.[0] ?? DEFAULT_STAFF[0]);
        }
      }
    } catch (error) { console.warn("POS cache load failed", error); }
    setDataLoading(true);
    setDataError("");
    loadPosData().then(data => {
      if (cancelled) return;
      // D1を常に正として採用する。特にinventoryEnabledは
      // リロード・再ログイン時にデフォルト値へ戻さない。
      setProducts(data.products);
      setStaff(data.staff.length ? data.staff : DEFAULT_STAFF);
      setSettings(data.settings);
      setSales(data.sales);
      setThemeByStaff(data.themeByStaff);
      setStaffDisplaySettings(data.staffDisplaySettings);
      setCurrentStaff(current => data.staff.find(member => member.id === current.id) ?? data.staff[0] ?? DEFAULT_STAFF[0]);
      try {
        window.localStorage.setItem(POS_CACHE_KEY, JSON.stringify(data));
      } catch (error) {
        console.warn("POS cache save failed", error);
      }
    }).catch(error => {
      if (!cancelled) {
        console.error("POS data load failed", error);
        setDataError(error instanceof Error ? error.message : "データの読み込みに失敗しました。");
      }
    }).finally(() => {
      if (!cancelled) setDataLoading(false);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { try { window.localStorage.setItem("pos-current-staff-id", String(currentStaff.id)); } catch {} }, [currentStaff.id]);
  const effectiveTheme = useMemo<Theme>(() => themeByStaff[String(currentStaff.id)] ?? settings.theme ?? deviceTheme, [themeByStaff, currentStaff.id, settings.theme, deviceTheme]);
  useEffect(() => { document.documentElement.dataset.theme = effectiveTheme; document.documentElement.style.colorScheme = effectiveTheme; }, [effectiveTheme]);

  const role = currentStaff.role;
  const currentDisplay = staffDisplaySettings[String(currentStaff.id)] ?? { registerColumns: settings.columns, registerMobileColumns: 2, productColumns: settings.columns, productMobileColumns: 2 };
  const canManage = role === "ADMIN" || role === "MANAGER" || role === "SUPER_ADMIN";
  const permissions = { products: canManage, staff: role === "ADMIN" || role === "SUPER_ADMIN", settings: role === "ADMIN" || role === "SUPER_ADMIN" };
  const changeTheme = (nextTheme: Theme) => { setThemeByStaff(current => ({ ...current, [String(currentStaff.id)]: nextTheme })); setSettings(current => ({ ...current, theme: nextTheme })); };
  const toggleTheme = () => changeTheme(effectiveTheme === "dark" ? "light" : "dark");

  const saveProductForm = async () => {
    const name = form.name.trim(); const price = Number(form.price); const inventoryQuantity = Math.max(0, Math.floor(Number(form.inventoryQuantity) || 0));
    if (!name || !Number.isFinite(price) || price < 0) { setDataError("商品名と正しい価格を入力してください。"); return; }
    const existing = editingId === null ? null : products.find(product => product.id === editingId) ?? null; const id = existing?.id ?? Math.max(0, ...products.map(product => product.id)) + 1;
    const product: Product = { id, dbId: existing?.dbId, name, price: Math.round(price), image: form.image.trim(), detailImage: form.detailImage.trim(), description: form.description.trim(), categories: form.categories.length ? form.categories : ["その他"], effects: form.effects, isActive: existing?.isActive ?? true, inventoryQuantity, gachaItems: form.gachaItems ?? existing?.gachaItems ?? [] };
    try { await saveProduct(product); setProducts(current => existing ? current.map(item => item.id === id ? product : item) : [...current, product]); setForm(emptyForm); setEditingId(null); setDataError(""); try { const raw = window.localStorage.getItem(POS_CACHE_KEY); if (raw) { const cached = JSON.parse(raw); cached.products = existing ? (cached.products ?? []).map((item: Product) => item.id === id ? product : item) : [...(cached.products ?? []), product]; window.localStorage.setItem(POS_CACHE_KEY, JSON.stringify(cached)); } } catch {} } catch (error) { setDataError(error instanceof Error ? error.message : "商品を保存できませんでした。"); }
  };
  const editProduct = (product: Product) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      price: String(product.price),
      image: product.image,
      detailImage: product.detailImage,
      description: product.description,
      categories: [...product.categories],
      effects: product.effects.map(effect => ({ ...effect })),
      inventoryQuantity: String(product.inventoryQuantity ?? 0),
      gachaItems: (product.gachaItems ?? []).map(item => ({ ...item, categories: Array.isArray(item.categories) ? [...item.categories] : (item.category ? String(item.category).split(" / ").filter(Boolean) : []), effects: Array.isArray(item.effects) ? item.effects.map(effect => ({ ...effect })) : [] })),
    });
    setDataError("");
  };
  const removeProduct = async (product: Product) => { try { await deleteProduct(product); setProducts(current => current.map(item => item.id === product.id ? { ...item, isActive: false } : item)); if (editingId === product.id) { setEditingId(null); setForm(emptyForm); } setDataError(""); } catch (error) { setDataError(error instanceof Error ? error.message : "商品を削除できませんでした。"); } };
  const toggleProductActive = async (product: Product) => {
    const next: Product = { ...product, isActive: !product.isActive };
    try {
      await saveProduct(next);
      setProducts(current => {
        const updated = current.map(item => item.id === product.id ? next : item);
        try {
          const raw = window.localStorage.getItem(POS_CACHE_KEY);
          const cached = raw ? JSON.parse(raw) : {};
          cached.products = updated;
          window.localStorage.setItem(POS_CACHE_KEY, JSON.stringify(cached));
        } catch {}
        return updated;
      });
      if (editingId === product.id) setDataError("");
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "販売状態を変更できませんでした。");
    }
  };
  const addStaff = async () => { if (!staffForm.name.trim()) return; const member: Staff = { id: Math.max(0, ...staff.map(s => s.id)) + 1, name: staffForm.name.trim(), role: staffForm.role, active: true }; await saveStaff(member); setStaff(current => [...current, member]); const display = { registerColumns: 4, registerMobileColumns: 2, productColumns: 3, productMobileColumns: 2 }; setStaffDisplaySettings(current => ({ ...current, [String(member.id)]: display })); await saveStaffDisplaySettings(member.id, display); setStaffForm({ name: "", role: "STAFF" }); };
  const updateStaffName = async (id: number, name: string) => { const member = staff.find(s => s.id === id); if (!member) return; const next = { ...member, name }; await saveStaff(next); setStaff(current => current.map(s => s.id === id ? next : s)); setCurrentStaff(current => current.id === id ? next : current); };
  const addCategory = () => { const v = newCategory.trim(); if (v && !settings.categories.includes(v)) setSettings(s => ({ ...s, categories: [...s.categories, v] })); setNewCategory(""); };
  const addEffect = () => { const v = newEffect.trim(); if (v && !settings.effects.includes(v)) setSettings(s => ({ ...s, effects: [...s.effects, v] })); setNewEffect(""); };
  const removeCategory = (v: string) => setSettings(s => ({ ...s, categories: s.categories.filter(x => x !== v) }));
  const removeEffect = (v: string) => setSettings(s => ({ ...s, effects: s.effects.filter(x => x !== v) }));
  const handleInventoryChange = async (value: boolean) => {
    const previous = settings.inventoryEnabled;
    setSettings(current => ({ ...current, inventoryEnabled: value }));
    setDataError("");

    try {
      await saveInventoryEnabled(value);

      try {
        const raw = window.localStorage.getItem(POS_CACHE_KEY);
        const cached = raw ? JSON.parse(raw) : {};
        cached.settings = {
          ...(cached.settings ?? settings),
          inventoryEnabled: value,
        };
        window.localStorage.setItem(POS_CACHE_KEY, JSON.stringify(cached));
      } catch {
        // D1保存成功後のキャッシュ保存失敗は無視する。
      }
    } catch (error) {
      setSettings(current => ({ ...current, inventoryEnabled: previous }));
      setDataError(
        error instanceof Error
          ? error.message
          : "在庫設定を保存できませんでした。"
      );
    }
  };

  const reset = () => { setProducts([]); setSettings(DEFAULT_SETTINGS); setSales([]); setCurrentStaff(DEFAULT_STAFF[0]); setThemeByStaff({}); setStaffDisplaySettings(DEFAULT_STAFF_DISPLAY_SETTINGS); setPage("register"); try { window.localStorage.removeItem(POS_CACHE_KEY); } catch {} };
  useEffect(() => { if (dataLoading) return; const timer = window.setTimeout(() => { saveSettings(settings, themeByStaff).catch(error => console.error("Settings save failed", error)); }, 350); return () => window.clearTimeout(timer); }, [settings, themeByStaff, dataLoading]);
  const handleDeleteSale = async (id: string) => { await deleteSale(id, settings.inventoryEnabled); setSales(current => current.filter(sale => (sale.dbId ?? sale.id) !== id)); try { const raw = window.localStorage.getItem(POS_CACHE_KEY); if (raw) { const cached = JSON.parse(raw); cached.sales = (cached.sales ?? []).filter((sale: Sale) => (sale.dbId ?? sale.id) !== id); window.localStorage.setItem(POS_CACHE_KEY, JSON.stringify(cached)); } } catch {} };
  const staffDisplayChange = (staffId: number, value: StaffDisplaySettings) => { setStaffDisplaySettings(current => ({ ...current, [String(staffId)]: value })); void saveStaffDisplaySettings(staffId, value).then(() => { setDataError(""); try { window.localStorage.setItem(POS_CACHE_KEY, JSON.stringify({ products, staff, settings, sales, themeByStaff, staffDisplaySettings: { ...staffDisplaySettings, [String(staffId)]: value } })); } catch {} }).catch(error => setDataError(error instanceof Error ? error.message : "スタッフ個人の表示設定を保存できませんでした")); };
  const handlePersonalDisplayChange = (value: StaffDisplaySettings) => staffDisplayChange(currentStaff.id, value);
  const appStyle = { "--staff-register-columns": String(currentDisplay.registerColumns), "--staff-register-mobile-columns": String(currentDisplay.registerMobileColumns) } as CSSProperties;

  return <div className="app" style={appStyle}>
    <Header storeName={settings.storeName} theme={effectiveTheme} staff={currentStaff} displaySettings={currentDisplay} onDisplaySettingsChange={handlePersonalDisplayChange} onThemeChange={toggleTheme} page={page} setPage={setPage} permissions={permissions} />
    {dataError && <div className="content"><div className="panel" role="alert">{dataError}</div></div>}
    {dataLoading && <div className="content"><div className="panel" style={{ textAlign: "center" }}>データを読み込んでいます…</div></div>}
    {!dataLoading && page === "register" && <Register staffId={currentStaff.id} />}
    {!dataLoading && page === "history" && <History sales={sales} staffList={staff} canManage={canManage} filterStaff={filterStaff} filterMonth={filterMonth} sort={historySort} storeName={settings.storeName} onFilterStaff={setFilterStaff} onFilterMonth={setFilterMonth} onSortChange={setHistorySort} onEdit={() => {}} onDelete={handleDeleteSale} />}
    {!dataLoading && page === "products" && permissions.products && <ProductManager products={products} columns={currentDisplay.productColumns} mobileColumns={currentDisplay.productMobileColumns} categories={settings.categories} effects={settings.effects} canDelete={role === "ADMIN" || role === "SUPER_ADMIN"} inventoryEnabled={settings.inventoryEnabled} editingId={editingId} form={form} setForm={setForm} onSave={saveProductForm} onEdit={editProduct} onDelete={removeProduct} onToggleActive={toggleProductActive} onCancelEdit={() => { setEditingId(null); setForm(emptyForm); }} />}
    {!dataLoading && page === "staff" && permissions.staff && <StaffManager staff={staff} canManage={permissions.staff} currentRole={role} form={staffForm} setForm={setStaffForm} onAdd={addStaff} onDelete={id => setStaff(s => s.filter(x => x.id !== id))} onRoleChange={(id, nextRole) => setStaff(s => s.map(x => x.id === id ? { ...x, role: nextRole } : x))} onNameChange={updateStaffName} />}
    {!dataLoading && page === "settings" && permissions.settings && <Settings storeName={settings.storeName} taxRate={settings.taxRate} theme={effectiveTheme} categories={settings.categories} effects={settings.effects} newCategory={newCategory} newEffect={newEffect} inventoryEnabled={settings.inventoryEnabled} currentRole={role} onStoreNameChange={v => setSettings(s => ({ ...s, storeName: v }))} onTaxChange={v => setSettings(s => ({ ...s, taxRate: v / 100 }))} onThemeChange={changeTheme} onNewCategoryChange={setNewCategory} onNewEffectChange={setNewEffect} onAddCategory={addCategory} onRemoveCategory={removeCategory} onAddEffect={addEffect} onRemoveEffect={removeEffect} onInventoryChange={handleInventoryChange} onReset={reset} />}
  </div>;
}
