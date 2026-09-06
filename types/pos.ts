export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "CHIEF"
  | "STAFF"
  | "TRIAL";

export type Theme = "light" | "dark";
export type StaffDisplaySettings = { registerColumns: number; registerMobileColumns: number; productColumns: number; productMobileColumns: number };
export type StaffDisplaySettingsMap = Record<string, StaffDisplaySettings>;
/** @deprecated StaffDisplaySettingsを使用してください。 */
export type RoleDisplaySettings = StaffDisplaySettings;
/** @deprecated StaffDisplaySettingsMapを使用してください。 */
export type RoleDisplaySettingsMap = StaffDisplaySettingsMap;

export type EffectType = string;
export type EffectValue = { type: EffectType; value: number };
export type GachaRarity = string;
export type GachaRaritySettings = {
  enabled: boolean;
  showOnList: boolean;
  labels: Record<string, string>;
  order: string[];
};
export type GachaItem = {
  id: string;
  name: string;
  effect: string;
  category: string;
  imageUrl: string;
  detailImageUrl: string;
  rarity: string;
  /** 表示・設定用の複数カテゴリ。category は互換用の文字列として保持します。 */
  categories?: string[];
  /** 表示・設定用の複数効果。effect は互換用の文字列として保持します。 */
  effects?: EffectValue[];
};
export type Product = {
  id: number;
  dbId?: string;
  name: string;
  price: number;
  image: string;
  detailImage: string;
  categories: string[];
  effects: EffectValue[];
  description: string;
  isActive: boolean;
  inventoryQuantity: number;
  gachaItems?: GachaItem[];
};
export type CartItem = Product & { quantity: number };
export type Staff = { id: number; name: string; role: Role; active: boolean };
export type Settings = { storeName: string; taxRate: number; theme: Theme; columns: number; categories: string[]; effects: string[]; inventoryEnabled: boolean; gachaRarity?: GachaRaritySettings };
export type SaleItem = { name: string; price: number; quantity: number; category: string };
export type Sale = { id: string; dbId?: string; date: string; staff: string; role?: string; items: SaleItem[]; subtotal: number; tax: number; total: number };
export type PageType = "register" | "history" | "products" | "staff" | "settings";
export type ProductForm = { name: string; price: string; image: string; detailImage: string; description: string; categories: string[]; effects: EffectValue[]; inventoryQuantity: string; gachaItems?: GachaItem[] };
export type StaffForm = { name: string; role: Role };
