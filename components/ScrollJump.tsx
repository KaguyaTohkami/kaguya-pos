"use client";

export default function ScrollJump() {
  const scrollTo = (top: boolean) => {
    window.scrollTo({ top: top ? 0 : document.documentElement.scrollHeight, behavior: "smooth" });
  };

  return (
    <div className="scrollJump" aria-label="ページ移動">
      <button type="button" onClick={() => scrollTo(true)} aria-label="ページ上部へ移動">↑</button>
      <button type="button" onClick={() => scrollTo(false)} aria-label="ページ下部へ移動">↓</button>
    </div>
  );
}
