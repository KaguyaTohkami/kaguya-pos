"use client";

import { useEffect, useState } from "react";
import type { CartItem } from "@/types";
import { formatYen } from "@/lib/format";

type Props = {
  cart: CartItem[];
  total: number;
  quantity: number;
  onQty: (id: number, amount: number) => void;
  onClear: () => void;
  onCheckout: () => void;
  mobile?: boolean;
  onClose?: () => void;
  editing?: boolean;
  onCancelEdit?: () => void;
};

export default function Cart({ cart, total, quantity, onQty, onClear, onCheckout, mobile = false, editing = false, onCancelEdit }: Props) {
  const [draftQuantities, setDraftQuantities] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(mobile);

  useEffect(() => {
    setDraftQuantities(
      Object.fromEntries(
        cart.map(item => [
          item.id,
          String(item.quantity),
        ])
      )
    );
  }, [cart]);

  useEffect(() => {
    if (mobile) {
      setIsMobileViewport(true);
      return;
    }
    const media = window.matchMedia("(max-width: 1100px)");
    const update = () => setIsMobileViewport(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [mobile]);

  const commitQuantity = (item: CartItem) => {
    const raw = draftQuantities[item.id] ?? String(item.quantity);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setDraftQuantities(current => ({ ...current, [item.id]: String(item.quantity) }));
      return;
    }
    const nextQuantity = Math.floor(parsed);
    onQty(item.id, nextQuantity - item.quantity);
    setDraftQuantities(current => ({ ...current, [item.id]: String(nextQuantity) }));
  };

  const toggleExpanded = () => {
    if (isMobileViewport) setExpanded(current => !current);
  };

  const mobileSectionStyle = isMobileViewport
    ? {
        position: "fixed" as const,
        top: "auto",
        left: 10,
        right: 10,
        bottom: "calc(10px + env(safe-area-inset-bottom))",
        width: "auto",
        margin: 0,
        zIndex: 1000,
        borderRadius: expanded ? "18px 18px 12px 12px" : 18,
        boxShadow: "0 -8px 30px rgba(0, 0, 0, 0.35)",
        overflow: "hidden" as const,
        maxWidth: "none",
      }
    : undefined;

  const mobileHeadStyle = isMobileViewport
    ? { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px 14px", borderBottom: expanded ? "1px solid var(--border)" : "0", cursor: "pointer" }
    : undefined;

  const mobileTitleStyle = isMobileViewport
    ? { display: "flex", alignItems: "baseline", gap: 9, minWidth: 0 }
    : undefined;

  const mobileTitleTextStyle = isMobileViewport
    ? { margin: 0, fontSize: 20, lineHeight: 1.2 }
    : undefined;

  const mobileQuantityStyle = isMobileViewport
    ? { color: "var(--sub)", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" as const }
    : undefined;

  const mobileHintStyle = isMobileViewport
    ? { color: "var(--text)", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" as const }
    : undefined;

  const mobileBodyStyle = isMobileViewport && expanded
    ? { maxHeight: "52vh", overflowY: "auto" as const, WebkitOverflowScrolling: "touch" as const }
    : undefined;

  return (
    <section className={isMobileViewport ? `cart mobile ${expanded ? "is-expanded" : "is-collapsed"}` : "cart"} style={mobileSectionStyle}>
      <div className="cartHead" style={mobileHeadStyle} onClick={toggleExpanded} role={isMobileViewport ? "button" : undefined} tabIndex={isMobileViewport ? 0 : undefined} onKeyDown={isMobileViewport ? event => { if (event.key === "Enter" || event.key === " ") toggleExpanded(); } : undefined}>
        <div className="cartHeadTitle" style={mobileTitleStyle}>
          <h2 style={mobileTitleTextStyle}>{editing ? "会計内容の変更" : "カート"}</h2>
          <span style={mobileQuantityStyle}>{quantity}点</span>
        </div>
        {isMobileViewport && <span className="cartSheetHint" style={mobileHintStyle}>{expanded ? "閉じる" : "詳細を見る"}</span>}
      </div>

      {(!isMobileViewport || expanded) && (
        <>
          <div className="cartBody" style={mobileBodyStyle}>
            {cart.length === 0 ? (
              <div className="empty">商品が入っていません</div>
            ) : (
              cart.map(item => (
                <div className="cartItem" key={item.id}>
                  <div className="cartItemMain">
                    <strong>{item.name}</strong>
                    <small>{formatYen(item.price)}</small>
                  </div>
                  <strong>{formatYen(item.price * item.quantity)}</strong>
                  <div className="qty">
                    <button type="button" onClick={() => onQty(item.id, -1)} aria-label={`${item.name}の数量を1減らす`}>−</button>
                    <input className="qtyInput" type="text" inputMode="numeric" pattern="[0-9]*" value={draftQuantities[item.id] ?? String(item.quantity)} aria-label={`${item.name}の数量`} onChange={event => { const value = event.target.value.replace(/[^0-9]/g, ""); setDraftQuantities(current => ({ ...current, [item.id]: value })); }} onBlur={() => commitQuantity(item)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />
                    <button type="button" onClick={() => onQty(item.id, 1)} aria-label={`${item.name}の数量を1増やす`}>＋</button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="cartFoot">
            <div className="totalRow"><span>合計（税込）</span><strong>{formatYen(total)}</strong></div>
            <div className="cartButtons">
              {editing ? (
                <>
                  <button className="secondary" type="button" onClick={onCancelEdit} disabled={!onCancelEdit}>変更をキャンセル</button>
                  <button className="primary" type="button" onClick={onCheckout} disabled={cart.length === 0}>変更を保存</button>
                </>
              ) : (
                <>
                  <button className="secondary" type="button" onClick={onClear} disabled={cart.length === 0}>クリア</button>
                  <button className="primary" type="button" onClick={onCheckout} disabled={cart.length === 0}>会計へ進む</button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
