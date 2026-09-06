"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Product, EffectValue, GachaItem } from "@/types/pos";
import { getThumbnailUrl } from "@/lib/imageUrl";
import { DEFAULT_CATEGORIES, DEFAULT_EFFECTS } from "@/constants/defaultData";

type GachaFormItem = GachaItem & { categories?: string[]; effects?: EffectValue[] };
type ProductForm = {
  name: string;
  price: string;
  image: string;
  detailImage: string;
  description: string;
  categories: string[];
  effects: EffectValue[];
  inventoryQuantity: string;
  gachaItems?: GachaFormItem[];
};
type Props = {
  products: Product[];
  columns?: number;
  mobileColumns?: number;
  categories: string[];
  effects: string[];
  canDelete: boolean;
  inventoryEnabled: boolean;
  editingId: number | null;
  form: ProductForm;
  setForm: React.Dispatch<React.SetStateAction<ProductForm>>;
  onSave: () => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onToggleActive: (p: Product) => void;
  onCancelEdit?: () => void;
};

export default function ProductManager({
  products,
  columns = 3,
  mobileColumns = 2,
  categories,
  effects,
  canDelete,
  inventoryEnabled,
  editingId,
  form,
  setForm,
  onSave,
  onEdit,
  onDelete,
  onToggleActive,
  onCancelEdit,
}: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [effect, setEffect] = useState("");
  const [status, setStatus] = useState("active");
  const [gachaSearch, setGachaSearch] = useState("");
  const [editingView, setEditingView] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);
  const [picker, setPicker] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  const cats = categories.length ? categories : DEFAULT_CATEGORIES;
  const effs = effects.length ? effects : DEFAULT_EFFECTS;
  const gacha = form.gachaItems ?? [];
  const isGacha = form.categories.includes("ガチャ");

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const values = [p.name, p.description, ...p.categories, ...p.effects.map((e) => e.type)];
      return (
        (!q || values.some((v) => v.toLowerCase().includes(q))) &&
        (!category || p.categories.includes(category)) &&
        (!effect || p.effects.some((e) => e.type === effect)) &&
        (status === "all" || (status === "active" ? p.isActive : !p.isActive))
      );
    });
  }, [products, search, category, effect, status]);

  const gachaCandidates = useMemo(() => {
    const q = gachaSearch.trim().toLowerCase();
    return products.filter((p) => {
      const values = [p.name, p.description, ...p.categories, ...p.effects.map((e) => e.type)];
      return p.isActive && !p.categories.includes("ガチャ") && (!q || values.some((v) => v.toLowerCase().includes(q)));
    });
  }, [products, gachaSearch]);

  const setGacha = (items: GachaFormItem[]) => setForm((current) => ({ ...current, gachaItems: items }));

  const addExisting = (p: Product, rarity: string) => {
    const item: GachaFormItem = {
      id: `PRODUCT-${p.dbId ?? p.id}`,
      name: p.name,
      effect: p.effects.map((e) => `${e.type} ${e.value}`).join(" / "),
      category: p.categories[0] ?? "",
      categories: [...p.categories],
      effects: p.effects.map((e) => ({ ...e })),
      imageUrl: p.image,
      detailImageUrl: p.detailImage || p.image,
      rarity,
    };
    if (!gacha.some((x) => x.id === item.id)) setGacha([...gacha, item]);
  };

  const updateGacha = (id: string, patch: Partial<GachaFormItem>) => setGacha(gacha.map((item) => item.id === id ? { ...item, ...patch } : item));

  const toggleGachaCategory = (id: string, value: string) => {
    const item = gacha.find((x) => x.id === id);
    if (!item) return;
    const selected = item.categories ?? [];
    const next = selected.includes(value) ? selected.filter((x) => x !== value) : [...selected, value];
    updateGacha(id, { categories: next, category: next.join(" / ") });
  };

  const toggleGachaEffect = (id: string, type: string) => {
    const item = gacha.find((x) => x.id === id);
    if (!item) return;
    const current = item.effects ?? [];
    const next = current.some((e) => e.type === type) ? current.filter((e) => e.type !== type) : [...current, { type, value: 0 }];
    updateGacha(id, { effects: next, effect: next.map((e) => `${e.type} ${e.value}`).join(" / ") });
  };

  const changeGachaEffect = (id: string, type: string, value: number) => {
    const item = gacha.find((x) => x.id === id);
    if (!item) return;
    const next = (item.effects ?? []).map((e) => e.type === type ? { ...e, value } : e);
    updateGacha(id, { effects: next, effect: next.map((e) => `${e.type} ${e.value}`).join(" / ") });
  };

  useEffect(() => {
    if (!editingView && !showAddForm) return;
    const frame = requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [editingView, showAddForm]);

  const selected = { background: "var(--primary)", color: "#fff", boxShadow: "none", borderRadius: 999 } as CSSProperties;
  const unselected = { borderRadius: 999 } as CSSProperties;
  const toggleCat = (x: string) => setForm((c) => ({ ...c, categories: c.categories.includes(x) ? c.categories.filter((v) => v !== x) : [...c.categories, x] }));
  const toggleEff = (x: string) => setForm((c) => ({ ...c, effects: c.effects.some((e) => e.type === x) ? c.effects.filter((e) => e.type !== x) : [...c.effects, { type: x, value: 0 }] }));
  const changeEff = (x: string, n: number) => setForm((c) => ({ ...c, effects: c.effects.map((e) => e.type === x ? { ...e, value: n } : e) }));
  const openEditor = (p: Product) => { setDetail(null); setEditingView(true); setShowAddForm(false); onEdit(p); };
  const openDetail = (p: Product) => setDetail(p);
  const editing = editingId !== null ? products.find((p) => p.id === editingId) : null;

  const fields = (
    <>
      <div className="productFormGrid">
        <label>商品名<input className="input" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} /></label>
        <label>価格<input className="input" type="number" min="0" value={form.price} onChange={(e) => setForm((c) => ({ ...c, price: e.target.value }))} /></label>
        <label>商品画像URL<input className="input" value={form.image} onChange={(e) => setForm((c) => ({ ...c, image: e.target.value }))} /></label>
        <label>詳細画像URL<input className="input" value={form.detailImage} onChange={(e) => setForm((c) => ({ ...c, detailImage: e.target.value }))} /></label>
        {inventoryEnabled && <label>在庫数<input className="input" type="number" min="0" value={form.inventoryQuantity} onChange={(e) => setForm((c) => ({ ...c, inventoryQuantity: e.target.value }))} /></label>}
      </div>
      <label>説明<textarea className="input textarea" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} /></label>
      <div className="settingBlock"><h3>カテゴリー設定</h3><div className="chips">{cats.map((x) => <button type="button" key={x} className="chip" style={form.categories.includes(x) ? selected : unselected} onClick={() => toggleCat(x)}>{x}</button>)}</div></div>
      <div className="settingBlock"><h3>効果設定</h3><div className="productEffectFormList">{effs.map((x) => { const e = form.effects.find((v) => v.type === x); return <div className="effectRow" key={x}><button type="button" className="chip" style={e ? selected : unselected} onClick={() => toggleEff(x)}>{x}</button><input className="input effectNumber" type="number" disabled={!e} value={e?.value ?? ""} onChange={(v) => changeEff(x, Number(v.target.value))} /></div>; })}</div></div>
      {isGacha && <section className="gachaContentManager"><div className="sectionTitle"><div><h3>ガチャの中身</h3><p>登録済みの商品をガチャの中身として設定できます。内容はここで変更できます。</p></div><span>{gacha.length} 件</span></div><div className="gachaContentActions"><button type="button" className="secondary" onClick={() => { setPicker(!picker); if (picker) setGachaSearch(""); }}>既存の商品から選択</button></div>{picker && <div className="gachaPicker"><input className="input gachaPickerSearch" placeholder="既存の商品を検索..." value={gachaSearch} onChange={(e) => setGachaSearch(e.target.value)} />{gachaCandidates.map((p) => <div className="gachaPickerItem" key={p.dbId ?? p.id}><b className="gachaPickerName">{p.name}</b><span className="gachaPickerMeta">{p.categories.join(" / ")}</span><select className="input gachaPickerRarity" defaultValue="C" aria-label={`${p.name}のレアリティ`}><option value="C">C</option><option value="R">R</option><option value="SR">SR</option><option value="SSR">SSR</option></select><button type="button" className="secondary small gachaPickerAdd" onClick={(e) => { const select = e.currentTarget.parentElement?.querySelector("select") as HTMLSelectElement | null; addExisting(p, select?.value ?? "C"); }}>追加</button></div>)}{gachaCandidates.length === 0 && <p className="settingHint">条件に一致する商品がありません。</p>}</div>}<div className="gachaItemList">{gacha.map((i) => <div className="gachaItemEditor" key={i.id}><div className="gachaItemHeader"><strong className="gachaItemName">{i.name || "新しい景品"}</strong><button type="button" className="danger small gachaDeleteButton" onClick={() => setGacha(gacha.filter((x) => x.id !== i.id))}>削除</button></div><label>中身の名前<input className="input" value={i.name ?? ""} onChange={(e) => updateGacha(i.id, { name: e.target.value })} /></label><div className="settingBlock gachaSettingBlock"><h4>カテゴリー設定</h4><div className="chips gachaChips">{cats.map((x) => <button type="button" key={x} className="chip" style={(i.categories ?? []).includes(x) ? selected : unselected} onClick={() => toggleGachaCategory(i.id, x)}>{x}</button>)}</div></div><div className="settingBlock gachaSettingBlock"><h4>効果設定</h4><div className="productEffectFormList">{effs.map((x) => { const e = (i.effects ?? []).find((v) => v.type === x); return <div className="effectRow" key={x}><button type="button" className="chip" style={e ? selected : unselected} onClick={() => toggleGachaEffect(i.id, x)}>{x}</button><input className="input effectNumber" type="number" disabled={!e} value={e?.value ?? ""} onChange={(v) => changeGachaEffect(i.id, x, Number(v.target.value))} /></div>; })}</div></div><div className="gachaItemGrid"><label>レアリティ<select className="input" value={i.rarity ?? "C"} onChange={(e) => updateGacha(i.id, { rarity: e.target.value })}><option>C</option><option>R</option><option>SR</option><option>SSR</option></select></label><label>商品画像URL<input className="input" value={i.imageUrl ?? ""} onChange={(e) => updateGacha(i.id, { imageUrl: e.target.value })} /></label><label>詳細画像URL<input className="input" value={i.detailImageUrl ?? ""} onChange={(e) => updateGacha(i.id, { detailImageUrl: e.target.value })} /></label></div></div>)}</div></section>}
    </>
  );

  return (
    <main className="content admin">
      <style jsx global>{`
        .gachaContentManager{margin-top:20px;padding:18px;border:1px solid var(--border);border-radius:16px;background:var(--panel2)}
        .gachaContentActions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
        .gachaPicker{display:grid;gap:7px;max-height:320px;overflow:auto;padding:8px;border:1px solid var(--border);border-radius:12px}
        .gachaPickerSearch{position:sticky;top:0;z-index:1}
        .gachaPickerItem{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;text-align:left;border:1px solid var(--border);background:var(--panel);color:var(--text);border-radius:10px;padding:10px 12px}
        .gachaPickerName,.gachaItemName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
        .gachaPickerMeta{max-width:30%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--sub);font-size:.85em}
        .gachaPickerAdd{width:52px;min-width:52px;text-align:center;flex:none}.gachaPickerRarity{width:78px;min-width:78px;padding:7px 8px}
        .gachaItemList{display:grid;gap:10px}.gachaItemEditor{padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--panel)}
        .gachaItemHeader{display:flex;align-items:center;gap:12px;margin-bottom:14px;min-width:0}.gachaDeleteButton{width:64px;min-width:64px;max-width:64px;height:36px;flex:none;padding:0!important;display:inline-flex;align-items:center;justify-content:center}
        .gachaItemEditor>label{display:grid;gap:5px}.gachaSettingBlock{margin-top:14px}.gachaSettingBlock h4{margin:0 0 8px}.gachaChips{row-gap:8px}
        .gachaItemGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.gachaItemGrid label{display:grid;gap:5px}
        .productAddTrigger{display:flex;justify-content:center;margin-bottom:14px}.productAddTrigger button{min-width:180px}
        .productListGrid{display:grid;grid-template-columns:repeat(var(--product-columns),minmax(0,1fr));gap:10px}
        .productCardUnified{min-width:0;display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--border);border-radius:14px;background:var(--panel);overflow:hidden}
        .productCardPreview{display:block;width:100%;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}
        .productCardImage{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;background:var(--panel2)}
        .productCardName{font-weight:700;line-height:1.35;min-height:2.7em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
        .productCardPrice{font-weight:700;color:var(--primary);font-size:1.05em}
        .productCardMeta{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.82em;color:var(--sub);min-height:20px}
        .productCardActions{display:grid;grid-template-columns:1fr ${canDelete ? "1fr" : "1fr"};gap:8px;margin-top:auto}
        .productCardActions button{width:100%;min-width:0;height:40px;padding:0!important;display:inline-flex;align-items:center;justify-content:center;border-radius:999px}
        .productCardActions .deleteButton{background:#ff4d5e;color:#fff;border:0}
        .productDetailModal{width:min(720px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto}
        .productDetailImage{width:100%;max-height:360px;object-fit:contain;border-radius:12px;margin:12px 0;background:var(--panel2)}
        .productDetailMeta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}.productDetailMetaItem{padding:10px 12px;border:1px solid var(--border);border-radius:10px}.productDetailMetaItem small{display:block;color:var(--sub);margin-bottom:4px}.productDetailDescription{white-space:pre-wrap;margin:14px 0;padding:12px;border-radius:10px;background:var(--panel2)}
        .productDetailTags{display:flex;flex-wrap:wrap;gap:6px}.productDetailTag{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:var(--panel2);border:1px solid var(--border);font-size:.85em}.productDetailGacha{margin-top:18px}.productDetailGachaList{display:grid;gap:8px}.productDetailGachaItem{display:grid;grid-template-columns:56px 1fr auto;gap:10px;align-items:center;padding:10px;border:1px solid var(--border);border-radius:10px}.productDetailGachaImage{width:56px;height:56px;object-fit:cover;border-radius:8px}.productDetailGachaInfo{min-width:0}.productDetailGachaName{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.productDetailGachaMeta{font-size:.82em;color:var(--sub);margin-top:3px}.productDetailRarity{font-weight:700;min-width:36px;text-align:center}
        @media(max-width:900px){.productListGrid{grid-template-columns:repeat(${mobileColumns},minmax(0,1fr))}}
        @media(max-width:700px){.gachaPickerRarity{width:72px;min-width:72px}.gachaItemGrid,.productDetailMeta{grid-template-columns:1fr}.gachaPickerMeta{display:none}.gachaItemHeader{gap:10px}.productDetailGachaItem{grid-template-columns:48px 1fr auto}.productDetailGachaImage{width:48px;height:48px}}
      `}</style>

      {editingView && editingId !== null ? (
        <section ref={ref} className="panel productManagerForm">
          <h1>商品編集</h1>
          {editing && <div className={editing.isActive ? "productStatusEditor is-active" : "productStatusEditor is-inactive"}><strong>{editing.isActive ? "現在：販売中" : "現在：販売停止"}</strong><button type="button" className={editing.isActive ? "secondary" : "primary"} onClick={() => onToggleActive(editing)}>{editing.isActive ? "販売停止にする" : "販売を再開する"}</button></div>}
          {fields}
          <div className="formActions"><button className="secondary" type="button" onClick={() => { onCancelEdit?.(); setEditingView(false); }}>商品一覧に戻る</button><button className="primary" type="button" onClick={onSave}>変更を保存</button></div>
        </section>
      ) : (
        <>
          {!showAddForm && <div className="productAddTrigger"><button type="button" className="primary" onClick={() => setShowAddForm(true)}>商品追加</button></div>}
          {showAddForm && <section ref={ref} className="panel productManagerForm"><div className="sectionTitle"><div><h1>商品追加</h1><p>新しい商品を登録します。</p></div><button type="button" className="secondary" onClick={() => setShowAddForm(false)}>閉じる</button></div>{fields}<div className="formActions"><button className="secondary" type="button" onClick={() => setShowAddForm(false)}>キャンセル</button><button className="primary" type="button" onClick={onSave}>商品を追加</button></div></section>}

          <section className="panel productListPanel">
            <div className="sectionTitle"><div><h2>商品一覧</h2><p>画像または商品名を押すと、レジと同じ方式で詳細を表示します。</p></div><strong>{list.length} 商品</strong></div>
            <div className="productFilters"><input className="input" placeholder="商品名・説明を検索..." value={search} onChange={(e) => setSearch(e.target.value)} /><select className="input" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">全カテゴリー</option>{cats.map((x) => <option key={x} value={x}>{x}</option>)}</select><select className="input" value={effect} onChange={(e) => setEffect(e.target.value)}><option value="">全ての効果</option>{effs.map((x) => <option key={x} value={x}>{x}</option>)}</select><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">販売中</option><option value="all">全て</option><option value="inactive">販売停止</option></select></div>
            <div className="productListGrid" style={{ "--product-columns": columns } as CSSProperties}>
              {list.map((p) => {
                const thumbnail = getThumbnailUrl(p.image || p.detailImage);
                return <article className="productCardUnified" key={p.dbId ?? p.id}>
                  <button type="button" className="productCardPreview" onClick={() => openDetail(p)} aria-label={`${p.name}の商品詳細を開く`}>
                    {thumbnail ? <img className="productCardImage" src={thumbnail} alt="" loading="lazy" /> : <div className="productCardImage" aria-hidden="true" />}
                    <div className="productCardName">{p.name}</div>
                    <div className="productCardPrice">¥{p.price.toLocaleString()}</div>
                  </button>
                  <div className="productCardMeta"><span>{p.categories[0] ?? "未分類"}</span><span>{p.isActive ? "● 販売中" : "● 販売停止"}</span></div>
                  {inventoryEnabled && <div className="productCardMeta"><span>在庫</span><strong>{p.inventoryQuantity}</strong></div>}
                  <div className="productCardActions">
                    <button type="button" className="primary" onClick={() => openEditor(p)}>編集</button>
                    {canDelete && <button type="button" className="deleteButton" onClick={() => onDelete(p)}>削除</button>}
                  </div>
                </article>;
              })}
              {list.length === 0 && <div className="emptyState">条件に一致する商品がありません。</div>}
            </div>
          </section>
        </>
      )}

      {detail && <div className="overlay" role="presentation" onClick={() => setDetail(null)}><div className="modal productDetailModal" role="dialog" aria-modal="true" aria-label="商品詳細" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close" onClick={() => setDetail(null)} aria-label="閉じる">×</button>
        <h2>{detail.name}</h2>
        {(detail.detailImage || detail.image) ? <img className="productDetailImage" src={detail.detailImage || detail.image || undefined} alt="" /> : null}
        <div className="productDetailMeta"><div className="productDetailMetaItem"><small>価格</small><strong>¥{detail.price.toLocaleString()}</strong></div><div className="productDetailMetaItem"><small>販売状態</small><strong>{detail.isActive ? "販売中" : "販売停止"}</strong></div>{inventoryEnabled && <div className="productDetailMetaItem"><small>在庫</small><strong>{detail.inventoryQuantity}</strong></div>}</div>
        <div><small>カテゴリー</small><div className="productDetailTags">{detail.categories.length ? detail.categories.map((x) => <span className="productDetailTag" key={x}>{x}</span>) : <span className="productDetailTag">未分類</span>}</div></div>
        <div style={{ marginTop: 12 }}><small>効果</small><div className="productDetailTags">{detail.effects.length ? detail.effects.map((x) => <span className="productDetailTag" key={x.type}>{x.type}: {x.value}</span>) : <span className="productDetailTag">なし</span>}</div></div>
        {detail.description && <div className="productDetailDescription">{detail.description}</div>}
        {detail.gachaItems?.length ? <section className="productDetailGacha"><h3>ガチャの中身</h3><div className="productDetailGachaList">{detail.gachaItems.map((item) => <div className="productDetailGachaItem" key={item.id}>{(item.imageUrl || item.detailImageUrl) ? <img className="productDetailGachaImage" src={item.imageUrl || item.detailImageUrl || undefined} alt="" /> : <div className="productDetailGachaImage" /> }<div className="productDetailGachaInfo"><div className="productDetailGachaName">{item.name}</div><div className="productDetailGachaMeta">{item.category}{item.effect ? ` / ${item.effect}` : ""}</div></div><span className="productDetailRarity">{item.rarity}</span></div>)}</div></section> : null}
        <div className="formActions" style={{ marginTop: 18 }}><button type="button" className="secondary" onClick={() => setDetail(null)}>閉じる</button><button type="button" className="primary" onClick={() => openEditor(detail)}>編集</button></div>
      </div></div>}
    </main>
  );
}
