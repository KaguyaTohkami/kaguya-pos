/* =========================================================
   K-POS
   Default Data
========================================================= */

import type { Product, Staff, Settings, EffectType, StaffDisplaySettingsMap, RoleDisplaySettingsMap, GachaRaritySettings } from "@/types/pos";

export const DEFAULT_CATEGORIES: string[] = ["フード", "ドリンク", "アルコール", "ジョイント", "グッズ", "ガチャ", "その他"];
export const DEFAULT_EFFECTS: EffectType[] = ["フード", "ドリンク", "アルコール", "ジョイント"];
export const DEFAULT_GACHA_RARITY: GachaRaritySettings = {
  enabled: true,
  showOnList: true,
  labels: { C: "C", R: "R", SR: "SR", SSR: "SSR" },
  order: ["C", "R", "SR", "SSR"],
};

export const DEFAULT_PRODUCTS: Product[] = [
  { id: 1, name: "コーヒー", price: 500, image: "", detailImage: "", categories: ["ドリンク"], effects: [{ type: "ドリンク", value: 10 }], description: "香り豊かな定番コーヒーです。", isActive: true, inventoryQuantity: 0 },
  { id: 2, name: "紅茶", price: 500, image: "", detailImage: "", categories: ["ドリンク"], effects: [{ type: "ドリンク", value: 10 }], description: "落ち着いた香りを楽しめる紅茶です。", isActive: true, inventoryQuantity: 0 },
  { id: 3, name: "カフェラテ", price: 650, image: "", detailImage: "", categories: ["ドリンク"], effects: [{ type: "ドリンク", value: 10 }, { type: "フード", value: 5 }], description: "ミルクのまろやかさを楽しめるカフェラテです。", isActive: true, inventoryQuantity: 0 },
  { id: 4, name: "スパイスチャイ", price: 700, image: "", detailImage: "", categories: ["ドリンク"], effects: [{ type: "ドリンク", value: 15 }, { type: "フード", value: 5 }], description: "紅茶とスパイスを組み合わせた香り豊かなチャイです。", isActive: true, inventoryQuantity: 0 },
];

export const DEFAULT_STAFF: Staff[] = [
  { id: 1, name: "サーバー管理者", role: "SUPER_ADMIN", active: true },
  { id: 2, name: "アドミン", role: "ADMIN", active: true },
  { id: 3, name: "マネージャー", role: "MANAGER", active: true },
  { id: 4, name: "チーフ", role: "CHIEF", active: true },
  { id: 5, name: "スタッフ", role: "STAFF", active: true },
  { id: 6, name: "トライアル", role: "TRIAL", active: true },
];

export const DEFAULT_SETTINGS: Settings = {
  storeName: "K-POS",
  taxRate: 0.1,
  theme: "dark",
  columns: 4,
  categories: DEFAULT_CATEGORIES,
  effects: DEFAULT_EFFECTS,
  inventoryEnabled: false,
  gachaRarity: DEFAULT_GACHA_RARITY,
};

export const DEFAULT_STAFF_DISPLAY_SETTINGS: StaffDisplaySettingsMap = Object.fromEntries(
  DEFAULT_STAFF.map(staff => [String(staff.id), { registerColumns: 4, registerMobileColumns: 3, productColumns: 3, productMobileColumns: 3 }])
);
