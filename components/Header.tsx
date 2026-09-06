"use client";

import { useEffect, useState } from "react";
import type { Staff, StaffDisplaySettings, Theme } from "@/types/pos";
import { changeStaffPassword } from "@/lib/staffAuth";
import { loadStaffSelectData, saveStaffDisplaySettings } from "@/lib/posData";
import { roleLabel } from "@/components/StaffManager";

type Page = "register" | "history" | "products" | "staff" | "settings";

type Props = {
  storeName?: string;
  theme: Theme;
  staff: Staff | null;
  displaySettings?: StaffDisplaySettings | null;
  onDisplaySettingsChange?: (value: StaffDisplaySettings) => Promise<void> | void;
  onThemeChange: () => void;
  page: Page;
  setPage: (page: Page) => void;
  permissions: { products: boolean; staff: boolean; settings: boolean };
};

const DEFAULT_DISPLAY: StaffDisplaySettings = { registerColumns: 4, registerMobileColumns: 3, productColumns: 3, productMobileColumns: 3 };
const normalizeDisplay = (value: StaffDisplaySettings): StaffDisplaySettings => ({ ...value, registerMobileColumns: 3, productMobileColumns: 3 });

export default function Header({ storeName, theme, staff, displaySettings, onDisplaySettingsChange, onThemeChange, page, setPage, permissions }: Props) {
  const [personalOpen, setPersonalOpen] = useState(false);
  const [resolvedDisplaySettings, setResolvedDisplaySettings] = useState<StaffDisplaySettings>(normalizeDisplay(displaySettings ?? DEFAULT_DISPLAY));
  const [draftDisplay, setDraftDisplay] = useState<StaffDisplaySettings>(normalizeDisplay(displaySettings ?? DEFAULT_DISPLAY));
  const [displayDirty, setDisplayDirty] = useState(false);
  const [displayBusy, setDisplayBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const values = displayDirty ? draftDisplay : resolvedDisplaySettings;

  useEffect(() => {
    let cancelled = false;
    if (!staff) return;
    (async () => {
      try {
        const data = await loadStaffSelectData();
        if (cancelled) return;
        const loaded = normalizeDisplay(data.staffDisplaySettings[String(staff.id)] ?? DEFAULT_DISPLAY);
        setResolvedDisplaySettings(loaded);
        if (!displayDirty) setDraftDisplay(loaded);
      } catch {
        const fallback = normalizeDisplay(displaySettings ?? DEFAULT_DISPLAY);
        if (!cancelled) {
          setResolvedDisplaySettings(fallback);
          if (!displayDirty) setDraftDisplay(fallback);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [staff?.id, displaySettings]);

  useEffect(() => {
    if (!displayDirty && displaySettings) {
      const normalized = normalizeDisplay(displaySettings);
      setResolvedDisplaySettings(normalized);
      setDraftDisplay(normalized);
    }
  }, [displaySettings, displayDirty]);

  const openPersonalSettings = () => {
    setDraftDisplay(normalizeDisplay(resolvedDisplaySettings));
    setDisplayDirty(false);
    setCurrentPassword(""); setNewPassword(""); setNewPasswordConfirm("");
    setMessage(""); setError(""); setPersonalOpen(true);
  };
  const closePersonalSettings = () => { if (!busy && !displayBusy) setPersonalOpen(false); };
  const updateDisplay = (key: "registerColumns" | "productColumns", value: number) => {
    setDraftDisplay(current => ({ ...current, [key]: value, registerMobileColumns: 3, productMobileColumns: 3 }));
    setDisplayDirty(true);
    setMessage(""); setError("");
  };

  const savePersonalDisplay = async () => {
    if (!staff || !displayDirty || displayBusy) return;
    setDisplayBusy(true); setMessage(""); setError("");
    try {
      const value = normalizeDisplay(draftDisplay);
      await saveStaffDisplaySettings(staff.id, value);
      await onDisplaySettingsChange?.(value);
      setResolvedDisplaySettings(value);
      setDraftDisplay(value);
      setDisplayDirty(false);
      try { window.localStorage.setItem(`pos-display-settings-${staff.id}`, JSON.stringify(value)); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent("pos-display-settings-changed", { detail: { staffId: staff.id, settings: value } }));
      setMessage("表示設定を保存しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "表示設定を保存できませんでした。");
    } finally { setDisplayBusy(false); }
  };

  const savePersonalPassword = async () => {
    if (!staff || busy) return;
    setMessage(""); setError("");
    if (newPassword !== newPasswordConfirm) { setError("新しいパスワードが一致しません。"); return; }
    if (newPassword.trim().length < 4) { setError("新しいパスワードは4文字以上で設定してください。"); return; }
    setBusy(true);
    try {
      await changeStaffPassword(staff.id, currentPassword, newPassword);
      setMessage("パスワードを変更しました。"); setCurrentPassword(""); setNewPassword(""); setNewPasswordConfirm("");
    } catch (error) { setError(error instanceof Error ? error.message : "パスワードを変更できませんでした。"); }
    finally { setBusy(false); }
  };

  const brandLines = (storeName?.trim() || "POS-SYSTEM").split(/\r?\n/);

  return (
    <>
      <header className="header">
        <style jsx global>{`
          html, body { max-width: 100%; overflow-x: hidden; }
          .header { width: 100%; max-width: 100vw; overflow: hidden; }
          .nav { min-width: 0; max-width: 100%; overflow-x: auto; overscroll-behavior-x: contain; }
          .nav button { flex: 0 0 auto; }
          .brand { display:flex; align-items:center; gap:10px; min-width:0; max-width:100%; }
          .brandStoreName { white-space:pre-line; line-height:1.15; overflow:hidden; text-overflow:ellipsis; }
          @media (max-width: 720px) {
            .header { grid-template-columns: minmax(0,1fr) auto; grid-template-rows: auto auto; }
            .brand, .headerRight, .nav { min-width: 0; }
            .brand { max-width: 100%; overflow: hidden; }
            .headerRight { max-width: 100%; }
            .staffBadge { max-width: min(46vw, 210px); overflow: hidden; text-overflow: ellipsis; }
            .nav { grid-column: 1 / -1; width: 100%; }
            .productGrid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          }
          .personalSettingsModal { max-width: 560px; }
          .personalDisplayGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
          .personalDisplayField { display: grid; gap: 6px; font-size: 13px; color: var(--sub); }
          .personalDisplayField .input { width: 100%; }
          .personalSettingsSection { padding-top: 18px; margin-top: 18px; border-top: 1px solid var(--border); }
          .personalSettingsSection h3 { margin: 0 0 8px; font-size: 18px; }
          .personalDisplayActions { display:flex; align-items:center; gap:10px; margin-top:14px; }
          .personalDisplayActions .primary { min-width:150px; }
          @media (max-width: 560px) { .personalDisplayGrid { grid-template-columns: 1fr; } .personalDisplayActions { flex-direction:column; align-items:stretch; } .personalDisplayActions .primary { width:100%; } }
        `}</style>
        <button type="button" className="brand" onClick={() => setPage("register")} aria-label="店舗ホーム">
          <strong className="brandStoreName">{brandLines.map((line, index) => <span key={index}>{line}{index < brandLines.length - 1 && <br />}</span>)}</strong>
        </button>
        <nav className="nav" aria-label="POS navigation">
          <NavButton active={page === "register"} onClick={() => setPage("register")}>レジ</NavButton>
          <NavButton active={page === "history"} onClick={() => setPage("history")}>会計履歴</NavButton>
          {permissions.products && <NavButton active={page === "products"} onClick={() => setPage("products")}>商品マスタ</NavButton>}
          {permissions.staff && <NavButton active={page === "staff"} onClick={() => setPage("staff")}>スタッフ</NavButton>}
          {permissions.settings && <NavButton active={page === "settings"} onClick={() => setPage("settings")}>店舗設定</NavButton>}
        </nav>
        <div className="headerRight">
          <button type="button" className="themeButton" onClick={onThemeChange} title="テーマ変更" aria-label="テーマ変更">{theme === "dark" ? "☀" : "☾"}</button>
          {staff && <button type="button" className="staffBadge personalSettingsButton" onClick={openPersonalSettings} title="個人設定を開く"><strong>{staff.name}</strong><span>{roleLabel(staff.role)}</span></button>}
        </div>
      </header>

      {personalOpen && staff && (
        <div className="overlay" onClick={closePersonalSettings}>
          <div className="modal personalSettingsModal" onClick={event => event.stopPropagation()}>
            <button type="button" className="close" onClick={closePersonalSettings}>×</button>
            <h2>個人設定</h2>
            <p>{staff.name} の設定です。この設定はこのスタッフ本人にだけ適用されます。</p>
            <div className="personalSettingsInfo"><strong>権限</strong><span>{roleLabel(staff.role)}</span></div>
            <section className="personalSettingsSection">
              <h3>表示列</h3>
              <p>スタッフ本人のPC表示列を個別に設定できます。スマホは常に3列です。</p>
              <div className="personalDisplayGrid">
                <DisplaySelect label="レジ（PC）" value={values.registerColumns} options={[2,3,4,5,6]} onChange={v => updateDisplay("registerColumns", v)} />
                <DisplaySelect label="商品マスタ（PC）" value={values.productColumns} options={[2,3,4,5,6]} onChange={v => updateDisplay("productColumns", v)} />
              </div>
              <div className="personalDisplayActions">
                <button type="button" className="primary" disabled={!displayDirty || displayBusy} onClick={() => void savePersonalDisplay()}>{displayBusy ? "保存中…" : "設定を保存"}</button>
                {displayDirty && <span className="personalSettingsHint">未保存の変更があります</span>}
              </div>
            </section>
            <section className="personalSettingsSection">
              <h3>パスワード</h3>
              <label className="staffPasswordField">現在のパスワード<input className="input" type="password" autoFocus value={currentPassword} onChange={event => { setCurrentPassword(event.target.value); setError(""); setMessage(""); }} /></label>
              <label className="staffPasswordField">新しいパスワード<input className="input" type="password" value={newPassword} onChange={event => { setNewPassword(event.target.value); setError(""); setMessage(""); }} /></label>
              <label className="staffPasswordField">新しいパスワード（確認）<input className="input" type="password" value={newPasswordConfirm} onChange={event => { setNewPasswordConfirm(event.target.value); setError(""); setMessage(""); }} onKeyDown={event => { if (event.key === "Enter") void savePersonalPassword(); }} /></label>
              <small className="personalSettingsHint">パスワードはD1へハッシュ化して保存します。平文のパスワードは保存しません。</small>
              {error && <p className="staffPasswordError">{error}</p>}{message && <p className="personalSettingsSaved">{message}</p>}
              <button type="button" className="primary full" disabled={busy} onClick={() => void savePersonalPassword()}>{busy ? "変更中…" : "パスワードを変更"}</button>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function DisplaySelect({ label, value, options, onChange }: { label: string; value: number; options: number[]; onChange: (value: number) => void }) {
  return <label className="personalDisplayField">{label}<select className="input" value={value} onChange={e => onChange(Number(e.target.value))}>{options.map(option => <option key={option} value={option}>{option}列</option>)}</select></label>;
}

function NavButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" className={active ? "active" : ""} onClick={onClick}>{children}</button>;
}
