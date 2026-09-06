"use client";

import { useEffect, useState } from "react";
import type {
  Theme,
  StaffDisplaySettings,
  StaffDisplaySettingsMap,
  Role,
  GachaRaritySettings,
} from "@/types/pos";
import { DEFAULT_GACHA_RARITY } from "@/constants/defaultData";
import { saveInventoryEnabled } from "@/lib/posData";
import { getStaffAuthHeaders } from "@/lib/d1";

type Props = {
  storeName: string;
  taxRate: number;
  theme: Theme;
  categories: string[];
  effects: string[];
  newCategory: string;
  newEffect: string;
  inventoryEnabled: boolean;
  currentRole: Role;
  gachaRarity?: GachaRaritySettings;

  onStoreNameChange: (value: string) => void;
  onTaxChange: (value: number) => void;
  onThemeChange: (value: Theme) => void;
  onNewCategoryChange: (value: string) => void;
  onNewEffectChange: (value: string) => void;
  onAddCategory: () => void;
  onRemoveCategory: (value: string) => void;
  onAddEffect: () => void;
  onRemoveEffect: (value: string) => void;
  onInventoryChange: (value: boolean) => void;
  onGachaRarityChange?: (value: GachaRaritySettings) => void;
  onReset: () => void;

  columns?: number;
  roleDisplaySettings?: StaffDisplaySettingsMap;
  canEditRoleDisplay?: boolean;
  onColumnsChange?: (value: number) => void;
  onRoleDisplayChange?: (
    role: Role,
    value: StaffDisplaySettings
  ) => void;
};

const cloneDefaultRarity = (): GachaRaritySettings => ({
  enabled: DEFAULT_GACHA_RARITY.enabled,
  showOnList: DEFAULT_GACHA_RARITY.showOnList,
  labels: { ...DEFAULT_GACHA_RARITY.labels },
  order: [...DEFAULT_GACHA_RARITY.order],
});

function canEditStoreSettings(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

function OnOffToggle({ enabled, disabled, onChange }: { enabled: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="inventoryToggle" role="group" aria-label="ON/OFF">
      <button type="button" className={enabled ? "inventoryToggleButton active" : "inventoryToggleButton"} aria-pressed={enabled} disabled={disabled} onClick={() => onChange(true)}>ON</button>
      <button type="button" className={!enabled ? "inventoryToggleButton active" : "inventoryToggleButton"} aria-pressed={!enabled} disabled={disabled} onClick={() => onChange(false)}>OFF</button>
    </div>
  );
}

export default function Settings({
  storeName,
  taxRate,
  theme,
  categories,
  effects,
  newCategory,
  newEffect,
  inventoryEnabled,
  currentRole,
  gachaRarity,
  onStoreNameChange,
  onTaxChange,
  onThemeChange,
  onNewCategoryChange,
  onNewEffectChange,
  onAddCategory,
  onRemoveCategory,
  onAddEffect,
  onRemoveEffect,
  onInventoryChange,
  onGachaRarityChange,
  onReset,
}: Props) {
  const [localRarity, setLocalRarity] =
    useState<GachaRaritySettings>(
      () =>
        gachaRarity
          ? {
              ...gachaRarity,
              labels: { ...gachaRarity.labels },
              order: [...gachaRarity.order],
            }
          : cloneDefaultRarity()
    );

  const [newRarity, setNewRarity] = useState("");
  const canEditSettings = canEditStoreSettings(currentRole);
  const canEditInventoryNotification = canEditSettings;
  const [lowStockEnabled, setLowStockEnabled] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState("");

  useEffect(() => {
    if (!inventoryEnabled) return;
    let cancelled = false;
    fetch("/api/inventory/settings", {
      method: "GET",
      cache: "no-store",
      headers: {
        ...getStaffAuthHeaders(),
        Accept: "application/json",
      },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null) as {
          enabled?: boolean; threshold?: number; webhookUrl?: string; error?: string;
        } | null;
        if (!response.ok) throw new Error(data?.error || "低在庫通知設定を取得できませんでした。");
        if (cancelled) return;
        setLowStockEnabled(Boolean(data?.enabled));
        setLowStockThreshold(Math.max(0, Math.floor(Number(data?.threshold ?? 5))));
        setWebhookUrl(String(data?.webhookUrl ?? ""));
      })
      .catch((error) => {
        if (!cancelled) setWebhookMessage(error instanceof Error ? error.message : "低在庫通知設定を取得できませんでした。");
      });
    return () => { cancelled = true; };
  }, [inventoryEnabled]);

  const saveLowStockSettings = async () => {
    if (!canEditInventoryNotification) return;
    setWebhookMessage("");
    const threshold = Math.max(0, Math.floor(Number(lowStockThreshold) || 0));
    if (lowStockEnabled && !webhookUrl.trim()) {
      setWebhookMessage("低在庫通知をONにする場合はWebhook URLを入力してください。");
      return;
    }
    setWebhookSaving(true);
    try {
      const response = await fetch("/api/inventory/settings", {
        method: "POST",
        headers: {
          ...getStaffAuthHeaders(),
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ enabled: lowStockEnabled, threshold, webhookUrl: webhookUrl.trim() }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "低在庫通知設定を保存できませんでした。");
      setLowStockThreshold(threshold);
      setWebhookMessage("保存しました。");
    } catch (error) {
      setWebhookMessage(error instanceof Error ? error.message : "低在庫通知設定を保存できませんでした。");
    } finally {
      setWebhookSaving(false);
    }
  };

  const testWebhook = async () => {
    if (!canEditInventoryNotification || !webhookUrl.trim()) {
      setWebhookMessage("Webhook URLを入力してください。");
      return;
    }
    setWebhookMessage("");
    setWebhookTesting(true);
    try {
      const response = await fetch("/api/inventory/webhook-test", {
        method: "POST",
        headers: {
          ...getStaffAuthHeaders(),
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ webhookUrl: webhookUrl.trim() }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Webhook接続に失敗しました。");
      setWebhookMessage("Webhook接続テストに成功しました。");
    } catch (error) {
      setWebhookMessage(error instanceof Error ? error.message : "Webhook接続に失敗しました。");
    } finally {
      setWebhookTesting(false);
    }
  };

  useEffect(() => {
    if (!gachaRarity) return;

    setLocalRarity({
      ...gachaRarity,
      labels: { ...gachaRarity.labels },
      order: [...gachaRarity.order],
    });
  }, [gachaRarity]);

  /**
   * ガチャ設定保存。
   *
   * 店舗設定APIの権限はWorker側が最終的に管理する。
   * フロント側でも管理者以外から不要なPATCHを送らない。
   */
  const persistRarity = (value: GachaRaritySettings) => {
    if (!canEditSettings) return;

    setLocalRarity(value);
    onGachaRarityChange?.(value);

    void fetch(
      "/api/db/settings?select=id&limit=1",
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      }
    )
      .then((response) =>
        response.ok
          ? (response.json() as Promise<Array<{ id?: string }>>)
          : []
      )
      .then((rows) => {
        const id = rows[0]?.id;
        if (!id) return;

        return fetch(
          `/api/db/settings?id=eq.${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              gacha_rarity: value,
            }),
          }
        );
      })
      .catch((error) => {
        console.error(
          "ガチャレアリティ設定の保存に失敗しました",
          error
        );
      });
  };

  const updateRarity = (
    rarity: string,
    label: string
  ) => {
    persistRarity({
      ...localRarity,
      labels: {
        ...localRarity.labels,
        [rarity]: label,
      },
    });
  };

  const moveRarity = (
    rarity: string,
    direction: -1 | 1
  ) => {
    const order = [...localRarity.order];
    const index = order.indexOf(rarity);
    const next = index + direction;

    if (
      index < 0 ||
      next < 0 ||
      next >= order.length
    ) {
      return;
    }

    [order[index], order[next]] = [
      order[next],
      order[index],
    ];

    persistRarity({
      ...localRarity,
      order,
    });
  };

  const addRarity = () => {
    const code = newRarity.trim();

    if (
      !canEditSettings ||
      !code ||
      localRarity.order.includes(code)
    ) {
      return;
    }

    persistRarity({
      ...localRarity,
      labels: {
        ...localRarity.labels,
        [code]: code,
      },
      order: [
        ...localRarity.order,
        code,
      ],
    });

    setNewRarity("");
  };

  const removeRarity = (rarity: string) => {
    if (
      !canEditSettings ||
      localRarity.order.length <= 1
    ) {
      return;
    }

    const labels = {
      ...localRarity.labels,
    };

    delete labels[rarity];

    persistRarity({
      ...localRarity,
      labels,
      order: localRarity.order.filter(
        (item) => item !== rarity
      ),
    });
  };

  /**
   * 在庫ON/OFF専用保存。
   *
   * 通常の saveSettings() とは分離しているため、
   * 店名・税率・テーマ等の保存で inventory_enabled が
   * 上書きされることはありません。
   */
  const handleInventoryChange = async (
    value: boolean
  ) => {
    if (!canEditSettings) return;

    const previous = inventoryEnabled;

    // UIを先に更新
    onInventoryChange(value);

    try {
      // D1へ在庫設定だけを保存
      await saveInventoryEnabled(value);
    } catch (error) {
      // 保存失敗時は元へ戻す
      onInventoryChange(previous);

      console.error(
        "在庫機能設定の保存に失敗しました",
        error
      );
    }
  };

  return (
    <main className="content admin settingsPage">
      <style jsx global>{`
        .settingsPage {
          width: min(100%, 900px);
          margin: 0 auto;
        }


        .inventoryToggle { display: inline-flex; gap: 4px; padding: 3px; border-radius: 999px; background: var(--panel-muted, rgba(127,127,127,.14)); }
        .inventoryToggleButton { min-width: 52px; height: 32px; padding: 0 12px; border: 0; border-radius: 999px; background: transparent; color: inherit; font-weight: 700; cursor: pointer; }
        .inventoryToggleButton.active { background: var(--accent, #2563eb); color: #fff; }
        .inventoryToggleButton:disabled { opacity: .5; cursor: not-allowed; }
        .settingsPage .panel,
        .settingsPage .dangerBox {
          width: 100%;
        }

        .settingsPage h1 {
          margin: 0 0 28px;
          font-size: 34px;
        }

        .settingsPage h2 {
          margin: 0 0 24px;
          font-size: 28px;
        }

        .settingsForm {
          display: grid;
          gap: 16px;
        }

        .settingsField {
          display: grid;
          gap: 7px;
        }

        .settingsField > span {
          font-weight: 700;
        }

        .storeNameInput {
          min-height: 92px;
          resize: vertical;
          line-height: 1.6;
          font-family: inherit;
        }

        .themeChoices {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 14px;
        }

        .themeChoice {
          min-height: 42px;
          border: 0;
          border-radius: 999px;
          background: var(--panel2);
          color: var(--text);
          font-weight: 800;
        }

        .themeChoice.selected {
          background: var(--accent);
          color: #fff;
        }

        .inlineAdd {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr) 88px;
          gap: 8px;
          align-items: center;
          margin-bottom: 14px;
        }

        .inlineAdd .primary {
          width: 88px;
          min-height: 44px;
        }

        .managementList {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .managementItem {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr) 82px;
          gap: 12px;
          align-items: center;
          min-height: 44px;
        }

        .managementItem > span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .managementDelete {
          width: 82px;
          min-height: 42px;
          padding: 8px 10px;
        }

        .raritySettings {
          display: grid;
          gap: 14px;
        }

        .rarityToggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--panel2);
        }

        .rarityRows {
          display: grid;
          gap: 8px;
        }

        .rarityRow {
          display: grid;
          grid-template-columns:
            64px minmax(0, 1fr) 150px;
          gap: 8px;
          align-items: center;
        }

        .rarityCode {
          font-weight: 800;
          text-align: center;
        }

        .rarityActions {
          display: grid;
          grid-template-columns:
            1fr 1fr 1fr;
          gap: 4px;
        }

        .rarityActions button {
          min-height: 38px;
        }

        .settingHint {
          margin: 0 0 12px;
          color: var(--sub);
        }

        .selectionButton {
          border: 1px solid var(--border);
          background: var(--panel2);
          color: var(--text);
          transition:
            background .15s,
            border-color .15s,
            color .15s,
            transform .1s;
        }

        .selectionButton:hover {
          border-color: var(--accent);
        }

        .selectionButton.selected {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
          box-shadow:
            0 0 0 2px
            color-mix(
              in srgb,
              var(--accent) 18%,
              transparent
            );
        }

        .productCategorySetting
          .chip.selected,
        .productEffectSetting
          .chip.selected {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }

        .effectRow.selected
          .effectNumber {
          border-color: var(--accent);
          box-shadow:
            0 0 0 2px
            color-mix(
              in srgb,
              var(--accent) 14%,
              transparent
            );
        }

        .settingsLocked {
          margin: 0 0 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: var(--panel2);
          color: var(--sub);
        }

        @media (max-width: 720px) {
          .settingsPage {
            width: 100%;
            padding-left: 10px;
            padding-right: 10px;
          }

          .settingsPage h1 {
            font-size: 30px;
            margin-bottom: 22px;
          }

          .settingsPage h2 {
            font-size: 25px;
            margin-bottom: 20px;
          }

          .inlineAdd {
            grid-template-columns:
              minmax(0, 1fr) 76px;
          }

          .inlineAdd .primary {
            width: 76px;
          }

          .managementItem {
            grid-template-columns:
              minmax(0, 1fr) 76px;
            gap: 10px;
          }

          .managementDelete {
            width: 76px;
          }

          .rarityRow {
            grid-template-columns:
              54px minmax(0, 1fr) 1fr;
          }

          .rarityActions {
            grid-template-columns:
              repeat(3, 1fr);
          }
        }
      `}</style>

      <section className="panel settingsPanel">
        <h1>店舗設定</h1>

        {!canEditSettings && (
          <p className="settingsLocked">
            店舗設定を変更できる権限がありません。
          </p>
        )}

        <div className="settingsForm">
          <label className="settingsField">
            <span>店舗名</span>
            <textarea
              className="input storeNameInput"
              value={storeName}
              rows={3}
              disabled={!canEditSettings}
              onChange={(e) =>
                onStoreNameChange(e.target.value)
              }
            />
          </label>

          <label className="settingsField">
            <span>消費税率(%)</span>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={taxRate * 100}
              disabled={!canEditSettings}
              onChange={(e) =>
                onTaxChange(
                  Number(e.target.value)
                )
              }
            />
          </label>
        </div>

        <div
          className="themeChoices"
          aria-label="表示テーマ"
        >
          <button
            type="button"
            className={
              theme === "light"
                ? "themeChoice selected"
                : "themeChoice"
            }
            disabled={!canEditSettings}
            onClick={() =>
              onThemeChange("light")
            }
          >
            ライト
          </button>

          <button
            type="button"
            className={
              theme === "dark"
                ? "themeChoice selected"
                : "themeChoice"
            }
            disabled={!canEditSettings}
            onClick={() =>
              onThemeChange("dark")
            }
          >
            ダーク
          </button>
        </div>
      </section>

      <section className="panel managementPanel">
        <h2>在庫設定</h2>

        <p className="settingHint">
          在庫機能を有効にすると、商品ごとの在庫数を管理し、
          会計時に在庫を自動で減らします。
          在庫が0の商品はレジで売り切れになります。
        </p>

        <div className="rarityToggle">
          <span>在庫機能を使用する</span>
          <OnOffToggle enabled={inventoryEnabled} disabled={!canEditSettings} onChange={(value) => void handleInventoryChange(value)} />
        </div>

        {inventoryEnabled && (
          <div className="managementPanel" style={{ marginTop: 16, padding: 16 }}>
            <h3>低在庫通知</h3>
            <p className="settingHint">指定個数以下になった最初の1回だけWebhookで通知します。在庫が指定個数を上回ると通知状態をリセットします。</p>
            <div className="rarityToggle">
              <span>低在庫通知を使用する</span>
              <OnOffToggle enabled={lowStockEnabled} disabled={!canEditInventoryNotification} onChange={setLowStockEnabled} />
            </div>
            {lowStockEnabled && (
              <>
                <label className="staffPasswordField" style={{ display: "block", marginTop: 12 }}>通知個数
                  <input className="input" type="number" min={0} step={1} value={lowStockThreshold} disabled={!canEditInventoryNotification} onChange={(e) => setLowStockThreshold(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
                </label>
                <label className="staffPasswordField" style={{ display: "block", marginTop: 12 }}>Webhook URL
                  <input className="input" type="url" placeholder="https://..." value={webhookUrl} disabled={!canEditInventoryNotification} onChange={(e) => setWebhookUrl(e.target.value)} autoComplete="off" />
                </label>
                <div className="inlineAdd" style={{ marginTop: 12 }}>
                  <button type="button" className="secondary" disabled={!canEditInventoryNotification || webhookTesting} onClick={() => void testWebhook()}>{webhookTesting ? "確認中…" : "接続テスト"}</button>
                  <button type="button" className="primary" disabled={!canEditInventoryNotification || webhookSaving} onClick={() => void saveLowStockSettings()}>{webhookSaving ? "保存中…" : "保存"}</button>
                </div>
              </>
            )}
            {webhookMessage && <p className="settingHint" role="status">{webhookMessage}</p>}
            {!canEditInventoryNotification && <p className="settingHint" style={{ marginTop: 12 }}>低在庫通知の変更はアドミン以上のみ可能です。</p>}
          </div>
        )}
      </section>

      <section className="panel managementPanel">
        <h2>ガチャ レアリティ設定</h2>

        <p className="settingHint">
          ガチャの中身に使用するレアリティを自由に追加・削除できます。
          表示順も変更できます。
        </p>

        <div className="raritySettings">
          <label className="rarityToggle">
            <span>レアリティ機能を使用</span>

            <input
              type="checkbox"
              checked={localRarity.enabled}
              disabled={!canEditSettings}
              onChange={(e) =>
                persistRarity({
                  ...localRarity,
                  enabled: e.target.checked,
                })
              }
            />
          </label>

          <label className="rarityToggle">
            <span>
              ガチャ詳細一覧にレアリティを表示
            </span>

            <input
              type="checkbox"
              checked={localRarity.showOnList}
              disabled={
                !canEditSettings ||
                !localRarity.enabled
              }
              onChange={(e) =>
                persistRarity({
                  ...localRarity,
                  showOnList: e.target.checked,
                })
              }
            />
          </label>

          <div className="inlineAdd">
            <input
              className="input"
              placeholder="新しいレアリティ（例：UR）"
              value={newRarity}
              disabled={!canEditSettings}
              onChange={(e) =>
                setNewRarity(e.target.value)
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter"
                ) {
                  e.preventDefault();
                  addRarity();
                }
              }}
            />

            <button
              type="button"
              className="primary"
              disabled={!canEditSettings}
              onClick={addRarity}
            >
              追加
            </button>
          </div>

          <div className="rarityRows">
            {localRarity.order.map(
              (rarity) => (
                <div
                  className="rarityRow"
                  key={rarity}
                >
                  <span className="rarityCode">
                    {rarity}
                  </span>

                  <input
                    className="input"
                    value={
                      localRarity.labels[
                        rarity
                      ] ?? rarity
                    }
                    disabled={
                      !canEditSettings ||
                      !localRarity.enabled
                    }
                    onChange={(e) =>
                      updateRarity(
                        rarity,
                        e.target.value
                      )
                    }
                    aria-label={`${rarity}の表示名`}
                  />

                  <div className="rarityActions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={
                        !canEditSettings ||
                        !localRarity.enabled ||
                        localRarity.order.indexOf(
                          rarity
                        ) <= 0
                      }
                      onClick={() =>
                        moveRarity(
                          rarity,
                          -1
                        )
                      }
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      className="secondary"
                      disabled={
                        !canEditSettings ||
                        !localRarity.enabled ||
                        localRarity.order.indexOf(
                          rarity
                        ) >=
                          localRarity.order
                            .length -
                            1
                      }
                      onClick={() =>
                        moveRarity(
                          rarity,
                          1
                        )
                      }
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      className="danger small"
                      disabled={
                        !canEditSettings ||
                        localRarity.order
                          .length <= 1
                      }
                      onClick={() =>
                        removeRarity(
                          rarity
                        )
                      }
                    >
                      削除
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <section className="panel managementPanel">
        <h2>カテゴリー管理</h2>

        <div className="inlineAdd">
          <input
            className="input"
            placeholder="新しいカテゴリー"
            value={newCategory}
            disabled={!canEditSettings}
            onChange={(e) =>
              onNewCategoryChange(
                e.target.value
              )
            }
          />

          <button
            type="button"
            className="primary"
            disabled={!canEditSettings}
            onClick={onAddCategory}
          >
            追加
          </button>
        </div>

        <div className="managementList">
          {categories.map((category) => (
            <div
              className="managementItem"
              key={category}
            >
              <span>{category}</span>

              <button
                type="button"
                className="danger small managementDelete"
                disabled={!canEditSettings}
                onClick={() =>
                  onRemoveCategory(
                    category
                  )
                }
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel managementPanel">
        <h2>効果管理</h2>

        <div className="inlineAdd">
          <input
            className="input"
            placeholder="新しい効果"
            value={newEffect}
            disabled={!canEditSettings}
            onChange={(e) =>
              onNewEffectChange(
                e.target.value
              )
            }
          />

          <button
            type="button"
            className="primary"
            disabled={!canEditSettings}
            onClick={onAddEffect}
          >
            追加
          </button>
        </div>

        <div className="managementList">
          {effects.map((effect) => (
            <div
              className="managementItem"
              key={effect}
            >
              <span>{effect}</span>

              <button
                type="button"
                className="danger small managementDelete"
                disabled={!canEditSettings}
                onClick={() =>
                  onRemoveEffect(
                    effect
                  )
                }
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="dangerBox">
        <h2>システム初期化</h2>
        <p>
          商品・スタッフ・設定・履歴を初期状態へ戻します。
        </p>

        <button
          type="button"
          className="danger"
          disabled={!canEditSettings}
          onClick={onReset}
        >
          初期化する
        </button>
      </section>
    </main>
  );
}
