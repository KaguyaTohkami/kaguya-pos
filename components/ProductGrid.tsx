"use client";

import type { CSSProperties } from "react";
import ProductCard from "./ProductCard";
import ScrollJump from "./ScrollJump";
import type { Product } from "@/types/pos";

type Props = {
  products: Product[];
  columns: number;
  mobileColumns?: number;
  onSelect: (product: Product) => void;
  onAddCart: (product: Product) => void;
  inventoryEnabled?: boolean;
};

export default function ProductGrid({ products, columns, mobileColumns = 2, onSelect, onAddCart, inventoryEnabled = false }: Props) {
  return (
    <section className="productArea">
      <div
        className="productGrid"
        style={{
          "--product-columns": `var(--staff-register-columns, ${columns})`,
          "--mobile-product-columns": String(mobileColumns),
        } as CSSProperties}
      >
        {products.map((product) => (
          <ProductCard key={product.dbId ?? product.id} product={product} inventoryEnabled={inventoryEnabled} onDetail={onSelect} onAdd={onAddCart} />
        ))}
      </div>

      {products.length === 0 && <div className="emptyState">該当する商品がありません</div>}
      <ScrollJump />
    </section>
  );
}
