"use client";

import { useCallback, useEffect, useState } from "react";
import type { Staff } from "@/types/pos";
import { DEFAULT_SETTINGS } from "@/constants/defaultData";
import { d1, fromD1Role } from "@/lib/d1";
import {
  getStaffPasswordStatus,
  loginStaff,
} from "@/lib/staffAuth";

type Props = {
  staff?: Staff[];
};

type DbStaff = {
  local_id: number | null;
  name: string;
  role: string;
  active: boolean;
};

type DbSetting = {
  store_name: string;
};

const ROLE_ORDER: Record<Staff["role"], number> = {
  SUPER_ADMIN: 0,
  ADMIN: 1,
  MANAGER: 2,
  CHIEF: 3,
  STAFF: 4,
  TRIAL: 5,
};

const roleLabel = (role: Staff["role"]) =>
  ({
    SUPER_ADMIN: "スーパーアドミン（管理者）",
    ADMIN: "アドミン（店長）",
    MANAGER: "マネージャー（副店長・経理）",
    CHIEF: "チーフ（スタッフ）",
    STAFF: "スタッフ（スタッフ）",
    TRIAL: "トライアル（体験スタッフ）",
  })[role];

export default function StaffSelect({
  staff: initialStaff = [],
}: Props) {
  const [storeName, setStoreName] = useState(
    DEFAULT_SETTINGS.storeName
  );

  const [staff, setStaff] = useState<Staff[]>(initialStaff);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [passwordStaff, setPasswordStaff] = useState<Staff | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [firstSetup, setFirstSetup] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const [dbStaff, settings] = await Promise.all([
        d1.get<DbStaff[]>(
          "staff?select=local_id,name,role,active&order=local_id.asc"
        ),
        d1.get<DbSetting[]>(
          "settings?select=store_name&limit=1"
        ),
      ]);

      const mapped: Staff[] = dbStaff.map((item, index) => ({
        id:
          item.local_id !== null && Number.isFinite(item.local_id)
            ? Number(item.local_id)
            : index + 1,
        name: item.name,
        role: fromD1Role(item.role),
        active: Boolean(item.active),
      }));

      setStaff(mapped);

      if (settings[0]?.store_name) {
        setStoreName(settings[0].store_name);
      }
    } catch (error) {
      setStaff([]);
      setLoadError(
        error instanceof Error
          ? error.message
          : "スタッフ情報を読み込めませんでした。"
      );

      console.error(
        "スタッフ一覧の読み込みに失敗しました",
        error
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const activeStaff = staff
    .filter((item) => item.active)
    .sort(
      (a, b) =>
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        a.id - b.id
    );

  const openStaff = async (member: Staff) => {
    setPasswordStaff(member);
    setPassword("");
    setPasswordConfirm("");
    setPasswordError("");
    setFirstSetup(false);

    try {
      const status = await getStaffPasswordStatus(member.id);
      setFirstSetup(status === "unset");
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "パスワード情報を取得できませんでした。"
      );
      setFirstSetup(false);
    }
  };

  const close = () => {
    if (busy) {
      return;
    }

    setPasswordStaff(null);
    setPassword("");
    setPasswordConfirm("");
    setPasswordError("");
    setFirstSetup(false);
  };

  const login = async () => {
    if (!passwordStaff || busy) {
      return;
    }

    setPasswordError("");

    if (password.trim().length < 4) {
      setPasswordError(
        "パスワードは4文字以上で設定してください。"
      );
      return;
    }

    if (firstSetup && password !== passwordConfirm) {
      setPasswordError("パスワードが一致しません。");
      return;
    }

    setBusy(true);

    try {
      // 初回設定もログインAPIで本人のパスワードをD1へ保存する。
      // 別のパスワード設定APIを先に呼ばないことで、旧「管理者設定」フローを完全に回避する。
      const data = await loginStaff(
        passwordStaff.id,
        password
      );

      /*
       * accessKeyが存在しない状態で
       * encodeURIComponent(undefined) を実行すると
       * TypeScriptエラーになるため、ここで明示的に確認する。
       */
      if (!data.accessKey) {
        setPasswordError(
          "ログインキーを取得できませんでした。もう一度お試しください。"
        );
        return;
      }

      try {
        sessionStorage.setItem(
          "pos-current-staff-id",
          String(passwordStaff.id)
        );
      } catch (storageError) {
        console.warn(
          "セッション情報の保存に失敗しました",
          storageError
        );
      }

      const accessKey = encodeURIComponent(data.accessKey);

      window.location.href = `/register/?key=${accessKey}`;
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "パスワード処理に失敗しました。"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app">
      <section
        className="panel staffSelectPanel"
        style={{
          maxWidth: "540px",
          margin: "80px auto",
        }}
      >
        <h1>
          {storeName || DEFAULT_SETTINGS.storeName}
        </h1>

        <p>
          {loading
            ? "スタッフ情報を読み込んでいます…"
            : loadError
              ? "スタッフ情報を読み込めませんでした。"
              : ""}
        </p>

        {loadError && (
          <button
            type="button"
            className="primary full"
            onClick={() => void loadStaff()}
          >
            再読み込み
          </button>
        )}

        {!loading && !loadError && (
          <>
            <p>
              {activeStaff.length
                ? "担当スタッフを選択してください"
                : "有効なスタッフが登録されていません"}
            </p>

            <div className="staffSelectList">
              {activeStaff.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className="primary staffSelectButton"
                  onClick={() => void openStaff(member)}
                >
                  <span>{member.name}</span>
                  <small>{roleLabel(member.role)}</small>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {passwordStaff && (
        <div
          className="overlay"
          onClick={close}
        >
          <div
            className="modal staffPasswordModal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="close"
              onClick={close}
              disabled={busy}
              aria-label="閉じる"
            >
              ×
            </button>

            <h2>
              {firstSetup
                ? "初回パスワード設定"
                : "ログイン"}
            </h2>

            <p>
              {passwordStaff.name} のパスワードを
              {firstSetup
                ? "設定してください。"
                : "入力してください。"}
            </p>

            <label className="staffPasswordField">
              {firstSetup
                ? "新しいパスワード"
                : "パスワード"}

              <input
                className="input"
                type="password"
                autoFocus
                value={password}
                disabled={busy}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void login();
                  }
                }}
              />
            </label>

            {firstSetup && (
              <label className="staffPasswordField">
                新しいパスワード（確認）

                <input
                  className="input"
                  type="password"
                  value={passwordConfirm}
                  disabled={busy}
                  onChange={(event) => {
                    setPasswordConfirm(
                      event.target.value
                    );
                    setPasswordError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void login();
                    }
                  }}
                />
              </label>
            )}

            {passwordError && (
              <p className="staffPasswordError">
                {passwordError}
              </p>
            )}

            <button
              type="button"
              className="primary full"
              disabled={busy}
              onClick={() => void login()}
            >
              {busy
                ? "処理中…"
                : firstSetup
                  ? "パスワードを設定してログイン"
                  : "ログイン"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
