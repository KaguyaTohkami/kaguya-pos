"use client";

import { useMemo, useState } from "react";
import type { Sale, Staff } from "@/types/pos";
import ElectronicReceipt from "@/components/ElectronicReceipt";

type Props = {
  sales: Sale[];
  staffList: Staff[];
  canManage: boolean;
  filterStaff: string;
  filterMonth: string;
  sort: "newest" | "oldest";
  storeName: string;
  onFilterStaff: (value: string) => void;
  onFilterMonth: (value: string) => void;
  onSortChange: (value: "newest" | "oldest") => void;
  onEdit: (sale: Sale) => void;
  onDelete: (id: string) => void;
};

const yen = (value: number) => `¥${Math.round(Number(value) || 0).toLocaleString("ja-JP")}`;

function parseSaleDate(sale: Sale): Date | null {
  const raw = sale?.date;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = new Date(raw);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const milliseconds = raw < 1_000_000_000_000 ? raw * 1000 : raw;
    const parsed = new Date(milliseconds);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  const idMatch = String(sale?.id ?? "").match(/^SALE-(\d{12,})$/);
  if (idMatch) {
    const parsed = new Date(Number(idMatch[1]));
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return null;
}

function saleTime(sale: Sale): number { return parseSaleDate(sale)?.getTime() ?? 0; }
function formatSaleDate(sale: Sale): string {
  const date = parseSaleDate(sale);
  if (!date) return "日時不明";
  return date.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function saleMatchesMonth(sale: Sale, month: string): boolean {
  if (!month) return true;
  const date = parseSaleDate(sale);
  if (!date) return false;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === month;
}
function monthLabel(month: string): string { const [year, value] = month.split("-"); return `${year}年${Number(value)}月`; }

export default function History({ sales, staffList, canManage, filterStaff, filterMonth, sort, storeName, onFilterStaff, onFilterMonth, onSortChange, onEdit, onDelete }: Props) {
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const sortedSales = useMemo(() => [...sales].sort((a, b) => saleTime(b) - saleTime(a)), [sales]);
  const filtered = useMemo(() => sortedSales.filter((sale) => {
    if (filterStaff && sale.staff !== filterStaff) return false;
    if (!saleMatchesMonth(sale, filterMonth)) return false;
    return true;
  }).sort((a, b) => sort === "newest" ? saleTime(b) - saleTime(a) : saleTime(a) - saleTime(b)), [sortedSales, filterStaff, filterMonth, sort]);

  const months = useMemo(() => {
    const values = new Set<string>();
    sortedSales.forEach((sale) => { const date = parseSaleDate(sale); if (date) values.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`); });
    const now = new Date();
    for (let i = 0; i < 12; i += 1) { const date = new Date(now.getFullYear(), now.getMonth() - i, 1); values.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`); }
    return [...values].sort().reverse();
  }, [sortedSales]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayStart = new Date(currentYear, currentMonth, now.getDate()).getTime();
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
  const totalSales = sales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const monthSales = sales.reduce((sum, sale) => { const time = saleTime(sale); return time && new Date(time).getFullYear() === currentYear && new Date(time).getMonth() === currentMonth ? sum + (Number(sale.total) || 0) : sum; }, 0);
  const todaySales = sales.reduce((sum, sale) => { const time = saleTime(sale); return time >= todayStart && time < tomorrowStart ? sum + (Number(sale.total) || 0) : sum; }, 0);

  return (
    <>
      <section className="panel historyPanel">
        <div className="sectionTitle historyTitle"><div><h1>会計履歴</h1><p>過去の会計と売上状況を確認できます</p></div><span>{filtered.length}件</span></div>
        <div className="salesSummary" aria-label="売上サマリー">
          <div className="salesSummaryCard"><span>総売上</span><strong>{yen(totalSales)}</strong><small>全期間</small></div>
          <div className="salesSummaryCard"><span>今月の売上</span><strong>{yen(monthSales)}</strong><small>{currentYear}年{currentMonth + 1}月</small></div>
          <div className="salesSummaryCard"><span>今日の売上</span><strong>{yen(todaySales)}</strong><small>{currentMonth + 1}月{now.getDate()}日</small></div>
        </div>
        <div className="historyFilters">
          <select className="input" value={filterStaff} onChange={(e) => onFilterStaff(e.target.value)}><option value="">全スタッフ</option>{staffList.map((staff) => <option key={staff.id} value={staff.name}>{staff.name}</option>)}</select>
          <select className="input" value={filterMonth} onChange={(e) => onFilterMonth(e.target.value)}><option value="">すべての期間</option>{months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</select>
          <select className="input" value={sort} onChange={(e) => onSortChange(e.target.value as "newest" | "oldest")}><option value="newest">新しい順</option><option value="oldest">古い順</option></select>
        </div>
        <div className="historyList">
          {filtered.length === 0 ? <div className="empty">会計履歴がありません</div> : filtered.map((sale) => {
            const quantity = sale.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            const available = Date.now() - saleTime(sale) <= 24 * 60 * 60 * 1000;
            return (
              <article className="saleHistoryCard" key={sale.dbId ?? sale.id}>
                <header className="saleHistoryHeader"><div className="saleHistoryId"><strong>{sale.id}</strong><span className="saleHistoryDate">{formatSaleDate(sale)}</span></div><div className="saleGrandTotal"><small>合計（税込）</small><strong>{yen(sale.total)}</strong></div></header>
                <div className="saleHistoryMeta"><span>スタッフ <b>{sale.staff}</b></span><span>商品数 <b>{quantity}点</b></span></div>
                <div className="saleHistoryItems"><div className="saleItemTableHead"><span>商品名</span><span>単価</span><span>数量</span><span>小計</span></div>{sale.items.map((item, index) => <div className="saleHistoryItem" key={`${sale.dbId ?? sale.id}-${index}`}><span>{item.name}</span><span>{yen(item.price)}</span><span>× {item.quantity}</span><strong>{yen(item.price * item.quantity)}</strong></div>)}</div>
                <div className="saleSummary"><div><span>小計</span><strong>{yen(sale.subtotal)}</strong></div>{sale.tax > 0 && <div><span>税</span><strong>{yen(sale.tax)}</strong></div>}<div className="saleTotalRow"><span>合計</span><strong>{yen(sale.total)}</strong></div></div>
                <div className="saleHistoryActions">
                  <button type="button" className="secondary small" disabled={!available} onClick={() => setReceipt(sale)}>{available ? "電子レシート" : "レシート期限切れ"}</button>
                  {canManage && <><button type="button" className="secondary small" onClick={() => onEdit(sale)}>変更</button><button type="button" className="danger small" onClick={() => { const confirmed = window.confirm(`この会計履歴を削除しますか？\n\n会計番号：${sale.id}\n合計：${yen(sale.total)}\n\n削除した履歴は元に戻せません。`); if (confirmed) onDelete(sale.dbId ?? sale.id); }}>削除</button></>}
                </div>
              </article>
            );
          })}
        </div>
      </section>
      {receipt && <ElectronicReceipt sale={receipt} storeName={storeName} onClose={() => setReceipt(null)} />}
    </>
  );
}
