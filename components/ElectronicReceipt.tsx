"use client";

import { useEffect, useRef } from "react";
import type { Sale } from "@/types/pos";

type Props = { sale: Sale; storeName: string; onClose: () => void };

// 日本で一般的な58mm幅のレシートロールを基準にした電子レシート。
// 203dpi相当: 58mm ≒ 463px。
const RECEIPT_WIDTH = 464;
const PAD = 28;
const CONTENT_WIDTH = RECEIPT_WIDTH - PAD * 2;
// 金額欄を固定幅にして、長い商品名と「単価 × 数量」が絶対に重ならないようにする。
const ITEM_RIGHT_WIDTH = 150;
const ITEM_GAP = 12;
const ITEM_NAME_WIDTH = CONTENT_WIDTH - ITEM_RIGHT_WIDTH - ITEM_GAP;
const yen = (value: number) => `¥${Math.round(Number(value) || 0).toLocaleString("ja-JP")}`;
const fontFamily = "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', sans-serif";

function saleDate(sale: Sale): Date | null {
  const d = new Date(sale.date);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatDate(sale: Sale) {
  const d = saleDate(sale) ?? new Date();
  return d.toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = Array.from(text || "");
  const lines: string[] = [];
  let current = "";
  for (const char of chars) {
    const next = current + char;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawSeparator(ctx: CanvasRenderingContext2D, y: number) {
  ctx.save();
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(RECEIPT_WIDTH - PAD, y);
  ctx.stroke();
  ctx.restore();
}

export default function ElectronicReceipt({ sale, storeName, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const expired = Date.now() - (saleDate(sale)?.getTime() ?? 0) > 24 * 60 * 60 * 1000;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || expired) return;

    const itemFontSize = 18;
    const lineHeight = 25;
    const measureCanvas = document.createElement("canvas");
    const measure = measureCanvas.getContext("2d");
    if (!measure) return;
    measure.font = `400 ${itemFontSize}px ${fontFamily}`;

    // 描画時と同じ商品名幅を使う。ここが異なると高さ計算と実際の折り返しがズレる。
    const itemLineCounts = sale.items.map((item) => wrapText(measure, item.name, ITEM_NAME_WIDTH).length);
    const itemLines = itemLineCounts.reduce((sum, count) => sum + count, 0);
    const storeLines = (storeName || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const safeStoreLines = storeLines.length ? storeLines : ["9098"];

    // 上部・商品部・下部合計部に十分な余白を取り、合計をレシートの下側へ固定。
    const headerHeight = 150 + safeStoreLines.length * 22;
    const itemsHeight = Math.max(70, itemLines * lineHeight + Math.max(0, sale.items.length - 1) * 5);
    const footerHeight = 154 + (sale.tax > 0 ? 28 : 0);
    const height = headerHeight + itemsHeight + footerHeight;

    canvas.width = RECEIPT_WIDTH;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111111";
    ctx.strokeStyle = "#111111";
    ctx.textBaseline = "alphabetic";

    let y = 42;

    // 店舗設定の店舗名をそのまま使用。改行はレシートにも反映する。
    ctx.textAlign = "center";
    ctx.font = `700 21px ${fontFamily}`;
    safeStoreLines.forEach((line, index) => {
      ctx.fillText(line, RECEIPT_WIDTH / 2, y);
      y += index === 0 ? 27 : 22;
      if (index === 0) ctx.font = `600 17px ${fontFamily}`;
    });

    y += 18;
    ctx.font = `400 14px ${fontFamily}`;
    ctx.fillText(formatDate(sale), RECEIPT_WIDTH / 2, y);
    y += 21;
    ctx.fillText(`担当：${sale.staff}`, RECEIPT_WIDTH / 2, y);

    y += 24;
    drawSeparator(ctx, y);
    y += 30;

    // 商品：左に商品名、右に「単価 × 数量」。
    // 右側の金額欄を固定し、商品名はその手前だけで折り返す。
    ctx.font = `400 ${itemFontSize}px ${fontFamily}`;
    for (const item of sale.items) {
      const rightText = `${yen(item.price)} × ${item.quantity}`;
      const nameLines = wrapText(ctx, item.name, ITEM_NAME_WIDTH);
      nameLines.forEach((line, index) => {
        ctx.textAlign = "left";
        ctx.fillText(line, PAD, y);
        if (index === 0) {
          ctx.textAlign = "right";
          ctx.fillText(rightText, RECEIPT_WIDTH - PAD, y);
        }
        y += lineHeight;
      });
      y += 2;
    }

    // 商品と下部金額を分離し、下側にまとまった会計金額ブロックを配置。
    y = Math.max(y + 18, height - footerHeight + 16);
    drawSeparator(ctx, y);
    y += 32;

    const right = RECEIPT_WIDTH - PAD;
    const drawAmount = (label: string, value: string, bold = false) => {
      ctx.textAlign = "left";
      ctx.font = `${bold ? "700" : "400"} ${bold ? 20 : 16}px ${fontFamily}`;
      ctx.fillText(label, PAD, y);
      ctx.textAlign = "right";
      ctx.fillText(value, right, y);
      y += bold ? 31 : 25;
    };

    drawAmount("小計", yen(sale.subtotal));
    if (Number(sale.tax) > 0) drawAmount("税", yen(sale.tax));
    y += 3;
    drawAmount("合計", yen(sale.total), true);

    y += 17;
    drawSeparator(ctx, y);
    y += 25;

    // レシート番号：最下部中央。支払い方法・有効期間の注意書きは表示しない。
    ctx.textAlign = "center";
    ctx.font = `400 12px ${fontFamily}`;
    ctx.fillText(String(sale.id), RECEIPT_WIDTH / 2, y);
  }, [sale, storeName, expired]);

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas || expired) return;
    const link = document.createElement("a");
    link.download = `${sale.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center",
    padding: 16, background: "rgba(0,0,0,.72)",
  };
  const modalStyle: React.CSSProperties = {
    width: "min(560px, 100%)", maxHeight: "92vh", overflow: "auto", borderRadius: 18,
    padding: 16, background: "var(--panel, #171717)", boxShadow: "0 20px 70px rgba(0,0,0,.45)",
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="電子レシート">
      <div style={modalStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>電子レシート</h2>
          <button type="button" className="secondary small" onClick={onClose}>閉じる</button>
        </div>
        {expired ? (
          <div className="panel"><strong>この電子レシートは閲覧期限を過ぎています。</strong></div>
        ) : (
          <>
            <div style={{ overflowX: "auto", borderRadius: 8, background: "#d8d8d8", padding: 14, display: "flex", justifyContent: "center" }}>
              <canvas ref={canvasRef} style={{ display: "block", width: "min(100%, 464px)", height: "auto", boxShadow: "0 3px 12px rgba(0,0,0,.22)" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button type="button" className="primary" onClick={downloadPng}>PNGで保存</button>
              <button type="button" className="secondary" onClick={onClose}>閉じる</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
