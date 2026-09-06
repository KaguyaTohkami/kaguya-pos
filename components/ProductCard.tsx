"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/types/pos";
import { formatYen } from "@/lib/format";
import { getThumbnailUrl } from "@/lib/imageUrl";

type Props = {
  product: Product;
  onAdd: (product: Product) => void;
  onDetail: (product: Product) => void;
  inventoryEnabled?: boolean;
};

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().normalize("NFKC").toLocaleLowerCase("ja-JP");
}

function matchesFilters(product: Product, category: string, effect: string): boolean {
  const categoryKey = normalize(category);
  const effectKey = normalize(effect);
  const categoryMatch = !categoryKey || product.categories.some(value => normalize(value) === categoryKey);
  const effectMatch = !effectKey || product.effects.some(value => normalize(value?.type) === effectKey);
  return categoryMatch && effectMatch;
}

export default function ProductCard({ product, onAdd, onDetail, inventoryEnabled = false }: Props) {
  const thumbnail = getThumbnailUrl(product.image || product.detailImage, 240);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const searchArea = document.querySelector<HTMLElement>(".searchArea");
    const selects = searchArea?.querySelectorAll<HTMLSelectElement>("select.input");
    if (!selects || selects.length < 2) return;

    const update = () => {
      setVisible(matchesFilters(product, selects[0].value, selects[1].value));
    };

    update();
    selects.forEach(select => select.addEventListener("change", update));
    return () => selects.forEach(select => select.removeEventListener("change", update));
  }, [product]);

  if (!visible) return null;

  return (
    <article className="productCard productCard--masterStyle">
      <button
        type="button"
        className="productImage productImage--masterStyle"
        onClick={() => onDetail(product)}
        aria-label={`${product.name}の商品詳細`}
      >
        {thumbnail ? (
          <img src={thumbnail} alt="" loading="lazy" decoding="async" width={240} height={240} />
        ) : (
          <span aria-hidden="true">▧</span>
        )}
      </button>

      <button
        type="button"
        className="productInfo productInfo--masterStyle"
        onClick={() => onDetail(product)}
        aria-label={`${product.name}の商品詳細`}
      >
        <div className="productNamePrice">
          <h3>{product.name}</h3>
          <strong>{formatYen(product.price)}</strong>
        </div>
        <div className="productCardMeta">
          <span>{product.categories[0] ?? "未分類"}</span>
          {product.effects.length > 0 && (
            <span>
              {product.effects.map(effect => `${effect.type} ${effect.value}`).join(" / ")}
            </span>
          )}
        </div>

        {inventoryEnabled && (
          <div
            className={
              product.inventoryQuantity > 0
                ? "productInventory"
                : "productInventory is-empty"
            }
          >
            {product.inventoryQuantity > 0
              ? `在庫：${product.inventoryQuantity}`
              : "在庫：売り切れ"}
          </div>
        )}
      </button>

      <button
        type="button"
        className={
          product.inventoryQuantity > 0 || !inventoryEnabled
            ? "addButton primary productCardAddButton"
            : "addButton secondary productCardAddButton"
        }
        disabled={inventoryEnabled && product.inventoryQuantity <= 0}
        onClick={() => onAdd(product)}
      >
        {inventoryEnabled && product.inventoryQuantity <= 0
          ? "売り切れ"
          : "カートに追加"}
      </button>

      <style jsx global>{`
        .productCard--masterStyle {
          background: var(--panel2);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
          height: 100%;
          overflow: hidden;
        }
        .productImage--masterStyle {
          width: 100%;
          aspect-ratio: 1 / 1;
          height: auto;
          border: 0;
          padding: 0;
          background: var(--panel);
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: none;
        }
        .productImage--masterStyle img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .productInfo--masterStyle {
          width: 100%;
          min-width: 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--text);
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 7px;
          cursor: pointer;
        }
        .productNamePrice {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .productNamePrice h3 {
          margin: 0;
          font-size: 17px;
          line-height: 1.35;
          min-height: 2.7em;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .productNamePrice strong {
          font-size: 18px;
          color: var(--primary);
        }
        .productCard--masterStyle .productCardMeta {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 6px;
          min-height: 20px;
          color: var(--sub);
          font-size: 11px;
          line-height: 1.3;
        }
        .productCard--masterStyle .productCardMeta span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .productInventory {
          width: 100%;
          padding: 5px 8px;
          border-radius: 7px;
          background: var(--panel);
          color: var(--text);
          font-size: 12px;
          font-weight: 700;
          text-align: center;
          box-sizing: border-box;
        }
        .productInventory.is-empty {
          color: var(--danger);
        }
        .productCardAddButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .productCardAddButton {
          width: 100%;
          min-height: 44px;
          height: 44px;
          margin-top: auto;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-size: 14px;
        }
        @media (max-width: 720px) {
          .productCard--masterStyle { padding: 9px; gap: 8px; }
          .productNamePrice h3 { font-size: 16px; }
          .productNamePrice strong { font-size: 17px; }
          .productCardAddButton { min-height: 42px; height: 42px; font-size: 13px; }
        }
      `}</style>
    </article>
  );
}
