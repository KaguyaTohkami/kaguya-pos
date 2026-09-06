/* =========================================================
   Kaguya POS
   Format Utilities
========================================================= */

/**
 * 日本円表示
 */
export function formatYen(value: number): string {
  return `¥${Math.round(Number(value) || 0).toLocaleString("ja-JP")}`;
}

/**
 * 数値安全変換
 */
export function toNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * 日付表示
 * 不正な値でも画面をクラッシュさせず、日時不明として扱う。
 */
export function formatDate(date: string | number | Date | null | undefined): string {
  const target = parseDate(date);
  if (!target) return "日時不明";

  return target.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 安全な Date 変換
 */
export function parseDate(date: string | number | Date | null | undefined): Date | null {
  if (date instanceof Date) {
    return Number.isFinite(date.getTime()) ? date : null;
  }

  if (typeof date === "number" && Number.isFinite(date)) {
    const milliseconds = date < 1_000_000_000_000 ? date * 1000 : date;
    const target = new Date(milliseconds);
    return Number.isFinite(target.getTime()) ? target : null;
  }

  if (typeof date !== "string" || !date.trim()) return null;

  const target = new Date(date);
  return Number.isFinite(target.getTime()) ? target : null;
}

/**
 * 短縮日時
 */
export function formatShortDate(date: string | number | Date | null | undefined): string {
  const target = parseDate(date);
  return target ? target.toLocaleDateString("ja-JP") : "日時不明";
}

/**
 * 税込み計算
 */
export function calculateTax(subtotal: number, taxRate: number): number {
  return Math.floor((Number(subtotal) || 0) * (Number(taxRate) || 0));
}

/**
 * 合計金額計算
 */
export function calculateTotal(subtotal: number, taxRate: number): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const safeSubtotal = Number(subtotal) || 0;
  const tax = calculateTax(safeSubtotal, taxRate);
  return {
    subtotal: safeSubtotal,
    tax,
    total: safeSubtotal + tax,
  };
}

/**
 * ID生成
 */
export function generateId(prefix = "ID"): string {
  return `${prefix}-${Date.now()}`;
}

/**
 * 空文字チェック
 */
export function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}
