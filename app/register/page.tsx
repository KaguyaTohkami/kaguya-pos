"use client";

import { useEffect, useState } from "react";
import Register from "@/components/Register";
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS, DEFAULT_STAFF_DISPLAY_SETTINGS } from "@/constants/defaultData";
import { fromD1Role } from "@/lib/d1";
import { saveStaffSession } from "@/lib/staffAuth";
import type { Staff } from "@/types/pos";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const POS_CACHE_KEY = "pos-system-data-cache-v1";

type RegisterBootstrapCache = {
  products: typeof DEFAULT_PRODUCTS;
  staff: Staff[];
  settings: typeof DEFAULT_SETTINGS;
  sales: unknown[];
  themeByStaff: Record<string, "light" | "dark">;
  staffDisplaySettings: typeof DEFAULT_STAFF_DISPLAY_SETTINGS;
};

function seedRegisterStaff(staff: Staff): void {
  if (typeof window === "undefined") return;
  try {
    let current: Partial<RegisterBootstrapCache> | null = null;
    const raw = sessionStorage.getItem(POS_CACHE_KEY);
    if (raw) {
      try { current = JSON.parse(raw) as Partial<RegisterBootstrapCache>; } catch { current = null; }
    }

    const cache: RegisterBootstrapCache = {
      products: Array.isArray(current?.products) ? current.products as typeof DEFAULT_PRODUCTS : DEFAULT_PRODUCTS,
      staff: [staff],
      settings: current?.settings && typeof current.settings === "object" ? current.settings as typeof DEFAULT_SETTINGS : DEFAULT_SETTINGS,
      sales: Array.isArray(current?.sales) ? current.sales : [],
      themeByStaff: current?.themeByStaff && typeof current.themeByStaff === "object" ? current.themeByStaff as Record<string, "light" | "dark"> : {},
      staffDisplaySettings: current?.staffDisplaySettings && typeof current.staffDisplaySettings === "object"
        ? current.staffDisplaySettings as typeof DEFAULT_STAFF_DISPLAY_SETTINGS
        : DEFAULT_STAFF_DISPLAY_SETTINGS,
    };

    sessionStorage.setItem(POS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Bootstrap cache failure must not block the real D1 load.
  }
}

export default function RegisterPage() {
  const [staffId, setStaffId] = useState(0);
  const [status, setStatus] = useState("スタッフURLを確認しています…");

  useEffect(() => {
    let cancelled = false;
    const url = new URL(window.location.href);
    const queryKey = url.searchParams.get("key") || "";
    const pathKey = url.pathname.match(/^\/register\/([^/]+)\/?$/)?.[1] || "";
    const key = queryKey || pathKey;

    if (!key || /^\d+$/.test(key)) {
      setStatus("このスタッフURLは無効です。スタッフ選択画面からアクセスしてください。");
      return;
    }

    (async () => {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 4 && !cancelled; attempt += 1) {
        try {
          const response = await fetch(`/api/staff/by-key?key=${encodeURIComponent(key)}&t=${Date.now()}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" },
          });
          if (!response.ok) {
            const body = await response.json().catch(() => null) as { error?: string } | null;
            throw new Error(body?.error || `スタッフURLの確認に失敗しました (${response.status})`);
          }

          const data = await response.json() as { staffId?: number; id?: string; name?: string; role?: string };
          if (!data.staffId) throw new Error("スタッフ情報を取得できませんでした。");
          if (cancelled) return;

          // Register.tsx uses D1 data after mount, but it must also see the current
          // staff on its very first render. Without this bootstrap, an uncached
          // first login can render selectedStaff=null and then add hooks on the
          // next render, which triggers React error #310.
          saveStaffSession({
            id: data.staffId,
            name: data.name || "",
            role: fromD1Role(data.role),
            active: true,
          }, key);
          seedRegisterStaff({
            id: data.staffId,
            name: data.name || "",
            role: fromD1Role(data.role),
            active: true,
          });

          setStaffId(data.staffId);
          try { window.sessionStorage.setItem("pos-current-staff-id", String(data.staffId)); } catch {}
          return;
        } catch (error) {
          lastError = error;
          if (attempt < 3) await sleep(350 * (attempt + 1));
        }
      }
      if (!cancelled) setStatus(lastError instanceof Error ? lastError.message : "スタッフ情報を確認できませんでした。");
    })();

    return () => { cancelled = true; };
  }, []);

  if (!staffId) {
    return (
      <main className="app">
        <section className="panel" style={{ maxWidth: "540px", margin: "80px auto", textAlign: "center" }}>
          <h1>POS-SYSTEM</h1>
          <p>{status}</p>
        </section>
      </main>
    );
  }

  return <Register staffId={staffId} />;
}
