"use client";

import { useEffect, useState } from "react";
import type { Staff, Role } from "@/types/pos";
import { saveStaff } from "@/lib/posData";
import {
  getStaffAccessKey,
  getStaffPasswordStatus,
} from "@/lib/staffAuth";

type Props = {
  staff: Staff[];
  canManage: boolean;
  currentRole?: Role;
  form: {
    name: string;
    role: Role;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      role: Role;
    }>
  >;
  onAdd: () => void;
  onDelete: (id: number) => void;
  onRoleChange: (id: number, role: Role) => void;
  onNameChange?: (id: number, name: string) => void;
};

const roles: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "CHIEF",
  "STAFF",
  "TRIAL",
];

export const roleLabel = (role: Role) => {
  switch (role) {
    case "SUPER_ADMIN":
      return "スーパーアドミン（管理者）";

    case "ADMIN":
      return "アドミン（店長）";

    case "MANAGER":
      return "マネージャー（副店長・経理）";

    case "CHIEF":
      return "チーフ（スタッフ）";

    case "TRIAL":
      return "トライアル（体験スタッフ）";

    default:
      return "スタッフ（スタッフ）";
  }
};

function canEditRole(
  currentRole: Role | undefined,
  target: Role
) {
  if (currentRole === "SUPER_ADMIN") {
    return true;
  }

  if (currentRole === "ADMIN") {
    return (
      target !== "SUPER_ADMIN" &&
      target !== "ADMIN"
    );
  }

  return false;
}

type PasswordModalState = {
  member: Staff;
  configured: boolean;
};

export default function StaffManager({
  staff,
  canManage,
  currentRole,
  form,
  setForm,
  onAdd,
  onDelete,
  onRoleChange,
  onNameChange,
}: Props) {
  const [
    editingNameId,
    setEditingNameId,
  ] = useState<number | null>(null);

  const [
    nameDraft,
    setNameDraft,
  ] = useState("");

  const [
    nameOverrides,
    setNameOverrides,
  ] = useState<Record<number, string>>({});

  const [
    passwordModal,
    setPasswordModal,
  ] = useState<PasswordModalState | null>(
    null
  );

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    passwordConfirm,
    setPasswordConfirm,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showPasswordConfirm,
    setShowPasswordConfirm,
  ] = useState(false);

  const [
    passwordError,
    setPasswordError,
  ] = useState("");

  const [
    passwordSuccess,
    setPasswordSuccess,
  ] = useState("");

  const [
    passwordBusy,
    setPasswordBusy,
  ] = useState(false);

  const [
    passwordLoading,
    setPasswordLoading,
  ] = useState(false);

  const startNameEdit = (
    member: Staff
  ) => {
    setEditingNameId(member.id);

    setNameDraft(
      nameOverrides[member.id] ??
        member.name
    );
  };

  const saveNameEdit = async (
    member: Staff
  ) => {
    const name =
      nameDraft.trim();

    if (!name || !canManage) {
      return;
    }

    try {
      const next = {
        ...member,
        name,
      };

      if (onNameChange) {
        onNameChange(
          member.id,
          name
        );
      } else {
        await saveStaff(next);
      }

      setNameOverrides(
        current => ({
          ...current,
          [member.id]: name,
        })
      );

      setEditingNameId(null);
      setNameDraft("");
    } catch (error) {
      console.error(
        "スタッフ名の保存に失敗しました",
        error
      );
    }
  };

  /*
   * パスワード設定モーダルを開く
   */
  const openPasswordModal = async (
    member: Staff
  ) => {
    if (!canManage) {
      return;
    }

    setPasswordModal({
      member,
      configured: false,
    });

    setPassword("");
    setPasswordConfirm("");
    setShowPassword(false);
    setShowPasswordConfirm(false);
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordLoading(true);

    try {
      const status =
        await getStaffPasswordStatus(
          member.id
        );

      setPasswordModal({
        member,
        configured:
          status === "set",
      });
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "パスワード状態を取得できませんでした。"
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  /*
   * パスワードモーダルを閉じる
   */
  const closePasswordModal = () => {
    if (passwordBusy) {
      return;
    }

    setPasswordModal(null);
    setPassword("");
    setPasswordConfirm("");
    setShowPassword(false);
    setShowPasswordConfirm(false);
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordLoading(false);
  };

  /*
   * パスワード設定
   */
  const submitPassword = async () => {
    if (
      !passwordModal ||
      passwordBusy
    ) {
      return;
    }

    setPasswordError("");
    setPasswordSuccess("");

    const trimmedPassword =
      password.trim();

    const trimmedConfirm =
      passwordConfirm.trim();

    if (
      trimmedPassword.length < 4
    ) {
      setPasswordError(
        "パスワードは4文字以上で設定してください。"
      );
      return;
    }

    if (
      trimmedPassword !==
      trimmedConfirm
    ) {
      setPasswordError(
        "パスワードが一致しません。"
      );
      return;
    }

    setPasswordBusy(true);

    try {
      const accessKey =
        getStaffAccessKey();

      const headers: HeadersInit = {
        "Content-Type":
          "application/json",
      };

      if (accessKey) {
        headers.Authorization =
          `Bearer ${accessKey}`;
      }

      const response =
        await fetch(
          "/api/auth/password",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              staffId:
                passwordModal.member.id,
              password:
                trimmedPassword,
            }),
          }
        );

      const data =
        (await response
          .json()
          .catch(() => null)) as
          | {
              error?: string;
            }
          | null;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "パスワードを設定できませんでした。"
        );
      }

      setPasswordSuccess(
        "パスワードを設定しました。"
      );

      setPassword("");

      setPasswordConfirm("");

      setPasswordModal(
        current =>
          current
            ? {
                ...current,
                configured: true,
              }
            : current
      );
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "パスワード設定に失敗しました。"
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  /*
   * モーダルのEnterキー
   */
  useEffect(() => {
    if (!passwordModal) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "Escape" &&
        !passwordBusy
      ) {
        closePasswordModal();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    passwordModal,
    passwordBusy,
  ]);

  return (
    <div className="content admin">

      {/* ==================================================
          スタッフ追加
      ================================================== */}

      <section className="panel">
        <h1>スタッフ管理</h1>

        <p>
          レジ担当者と権限を管理します。
        </p>

        <div className="formGrid">
          <input
            className="input"
            placeholder="スタッフ名"
            value={form.name}
            onChange={event =>
              setForm(current => ({
                ...current,
                name: event.target.value,
              }))
            }
          />

          <select
            className="input"
            value={form.role}
            onChange={event =>
              setForm(current => ({
                ...current,
                role:
                  event.target.value as Role,
              }))
            }
          >
            {roles.map(role => (
              <option
                key={role}
                value={role}
              >
                {roleLabel(role)}
              </option>
            ))}
          </select>

          <button
            className="primary"
            disabled={!canManage}
            onClick={onAdd}
          >
            追加
          </button>
        </div>
      </section>

      {/* ==================================================
          スタッフ一覧
      ================================================== */}

      <section className="panel">
        <h2>スタッフ一覧</h2>

        <div className="adminList">
          {staff.map(member => {
            const displayName =
              nameOverrides[
                member.id
              ] ?? member.name;

            const roleEditable =
              canManage &&
              canEditRole(
                currentRole,
                member.role
              ) &&
              member.id !==
                staff.find(
                  s =>
                    s.role ===
                    "SUPER_ADMIN"
                )?.id;

            const protectedMember =
              member.role ===
                "ADMIN" &&
              currentRole !==
                "SUPER_ADMIN";

            return (
              <div
                className={`adminRow staffRow${
                  protectedMember
                    ? " protected"
                    : ""
                }`}
                key={member.id}
              >

                {/* ===============================
                    アバター
                =============================== */}

                <div className="avatar">
                  {displayName.slice(
                    0,
                    1
                  )}
                </div>

                {/* ===============================
                    スタッフ情報
                =============================== */}

                <div className="rowMain">

                  {editingNameId ===
                  member.id ? (
                    <div className="staffNameEditor">

                      <input
                        className="input"
                        value={
                          nameDraft
                        }
                        autoFocus
                        onChange={event =>
                          setNameDraft(
                            event.target
                              .value
                          )
                        }
                        onKeyDown={event => {
                          if (
                            event.key ===
                            "Enter"
                          ) {
                            void saveNameEdit(
                              member
                            );
                          }

                          if (
                            event.key ===
                            "Escape"
                          ) {
                            setEditingNameId(
                              null
                            );
                          }
                        }}
                      />

                      <button
                        className="primary small"
                        disabled={
                          !nameDraft.trim()
                        }
                        onClick={() =>
                          void saveNameEdit(
                            member
                          )
                        }
                      >
                        保存
                      </button>

                      <button
                        className="secondary small"
                        onClick={() =>
                          setEditingNameId(
                            null
                          )
                        }
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <>
                      <strong>
                        {displayName}
                      </strong>

                      <span>
                        {roleLabel(
                          member.role
                        )}
                      </span>
                    </>
                  )}

                </div>

                {/* ===============================
                    操作
                =============================== */}

                {editingNameId !==
                  member.id &&
                  !protectedMember && (
                    <div className="staffActions">

                      <button
                        className="secondary small staffNameButton"
                        disabled={
                          !canManage
                        }
                        onClick={() =>
                          startNameEdit(
                            member
                          )
                        }
                      >
                        名前変更
                      </button>

                      <button
                        className="secondary small staffPasswordButton"
                        disabled={
                          !canManage
                        }
                        onClick={() =>
                          void openPasswordModal(
                            member
                          )
                        }
                      >
                        パスワード設定
                      </button>

                    </div>
                  )}

                {/* ===============================
                    権限
                =============================== */}

                <select
                  className="input small staffRoleSelect"
                  value={
                    member.role
                  }
                  disabled={
                    !roleEditable
                  }
                  onChange={event =>
                    onRoleChange(
                      member.id,
                      event.target
                        .value as Role
                    )
                  }
                >
                  {roles.map(role => (
                    <option
                      key={role}
                      value={role}
                    >
                      {roleLabel(
                        role
                      )}
                    </option>
                  ))}
                </select>

                {/* ===============================
                    削除
                =============================== */}

                {!protectedMember && (
                  <button
                    className="danger staffDeleteButton"
                    disabled={
                      !canManage
                    }
                    onClick={() =>
                      onDelete(
                        member.id
                      )
                    }
                  >
                    削除
                  </button>
                )}

              </div>
            );
          })}
        </div>
      </section>

      {/* ==================================================
          パスワード設定モーダル
      ================================================== */}

      {passwordModal && (
        <div
          className="overlay staffPasswordOverlay"
          onClick={event => {
            if (
              event.target ===
                event.currentTarget &&
              !passwordBusy
            ) {
              closePasswordModal();
            }
          }}
        >
          <div
            className="modal staffPasswordModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-password-title"
          >

            {/* ===============================
                ヘッダー
            =============================== */}

            <div className="staffPasswordModalHeader">

              <div>
                <h2
                  id="staff-password-title"
                >
                  パスワード設定
                </h2>

                <p>
                  {passwordModal.member.name}
                </p>

                <span>
                  {roleLabel(
                    passwordModal.member.role
                  )}
                </span>
              </div>

              <button
                type="button"
                className="close"
                disabled={
                  passwordBusy
                }
                aria-label="閉じる"
                onClick={
                  closePasswordModal
                }
              >
                ×
              </button>

            </div>

            {/* ===============================
                現在の状態
            =============================== */}

            <div
              className={`passwordStatus ${
                passwordLoading
                  ? "loading"
                  : passwordModal.configured
                    ? "configured"
                    : "notConfigured"
              }`}
            >
              <span className="passwordStatusIcon">
                {passwordLoading
                  ? "…"
                  : passwordModal.configured
                    ? "✓"
                    : "!"}
              </span>

              <div>
                <strong>
                  {passwordLoading
                    ? "確認中..."
                    : passwordModal.configured
                      ? "パスワード設定済み"
                      : "パスワード未設定"}
                </strong>

                <small>
                  {passwordLoading
                    ? "現在の設定状態を確認しています。"
                    : passwordModal.configured
                      ? "新しいパスワードを設定すると現在のパスワードが変更されます。"
                      : "このスタッフにはパスワードが設定されていません。"}
                </small>
              </div>
            </div>

            {/* ===============================
                パスワード入力
            =============================== */}

            <div className="staffPasswordForm">

              <label className="staffPasswordField">
                <span>
                  新しいパスワード
                </span>

                <div className="passwordInputWrap">

                  <input
                    className="input"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoFocus
                    autoComplete="new-password"
                    value={
                      password
                    }
                    disabled={
                      passwordBusy ||
                      passwordLoading
                    }
                    placeholder="4文字以上"
                    onChange={event => {
                      setPassword(
                        event.target.value
                      );
                      setPasswordError(
                        ""
                      );
                      setPasswordSuccess(
                        ""
                      );
                    }}
                    onKeyDown={event => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        void submitPassword();
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="passwordVisibilityButton"
                    disabled={
                      passwordBusy
                    }
                    aria-label={
                      showPassword
                        ? "パスワードを隠す"
                        : "パスワードを表示"
                    }
                    onClick={() =>
                      setShowPassword(
                        current =>
                          !current
                      )
                    }
                  >
                    {showPassword
                      ? "隠す"
                      : "表示"}
                  </button>

                </div>
              </label>

              <label className="staffPasswordField">
                <span>
                  新しいパスワード（確認）
                </span>

                <div className="passwordInputWrap">

                  <input
                    className="input"
                    type={
                      showPasswordConfirm
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    value={
                      passwordConfirm
                    }
                    disabled={
                      passwordBusy ||
                      passwordLoading
                    }
                    placeholder="もう一度入力してください"
                    onChange={event => {
                      setPasswordConfirm(
                        event.target
                          .value
                      );
                      setPasswordError(
                        ""
                      );
                      setPasswordSuccess(
                        ""
                      );
                    }}
                    onKeyDown={event => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        void submitPassword();
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="passwordVisibilityButton"
                    disabled={
                      passwordBusy
                    }
                    aria-label={
                      showPasswordConfirm
                        ? "確認用パスワードを隠す"
                        : "確認用パスワードを表示"
                    }
                    onClick={() =>
                      setShowPasswordConfirm(
                        current =>
                          !current
                      )
                    }
                  >
                    {showPasswordConfirm
                      ? "隠す"
                      : "表示"}
                  </button>

                </div>
              </label>

              {/* =============================
                  エラー
              ============================= */}

              {passwordError && (
                <div className="staffPasswordMessage error">
                  {passwordError}
                </div>
              )}

              {/* =============================
                  成功
              ============================= */}

              {passwordSuccess && (
                <div className="staffPasswordMessage success">
                  {passwordSuccess}
                </div>
              )}

            </div>

            {/* ===============================
                フッター
            =============================== */}

            <div className="staffPasswordModalFooter">

              <button
                type="button"
                className="secondary"
                disabled={
                  passwordBusy
                }
                onClick={
                  closePasswordModal
                }
              >
                キャンセル
              </button>

              <button
                type="button"
                className="primary"
                disabled={
                  passwordBusy ||
                  passwordLoading
                }
                onClick={() =>
                  void submitPassword()
                }
              >
                {passwordBusy
                  ? "設定中..."
                  : passwordModal.configured
                    ? "パスワードを変更"
                    : "パスワードを設定"}
              </button>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
