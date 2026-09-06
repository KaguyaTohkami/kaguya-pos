import type { Staff } from "@/types/pos";

export type PasswordStatus = "unset" | "set";

const SESSION_KEY = "betelgeuse_staff_session";

/**
 * パスワードハッシュ
 */
const hashPassword = async (
  staffId: number,
  password: string
): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `${staffId}:POS-SYSTEM:${password.trim()}`
    )
  );

  return Array.from(new Uint8Array(digest))
    .map(value =>
      value.toString(16).padStart(2, "0")
    )
    .join("");
};

export type StaffSession = {
  staffId: string;
  localId: number;
  name: string;
  role: string;
  accessKey: string;
};

type ApiError = {
  error?: string;
};

/**
 * JSON取得
 */
async function readJson<T>(
  response: Response
): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * 認証ヘッダー
 */
function authHeaders(): HeadersInit {
  const accessKey = getStaffAccessKey();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (accessKey) {
    headers.Authorization = `Bearer ${accessKey}`;
  }

  return headers;
}

/**
 * APIエラー
 */
async function getApiError(
  response: Response,
  fallback: string
): Promise<Error> {
  const data = await readJson<ApiError>(response);

  return new Error(
    data?.error || fallback
  );
}

/**
 * ロール正規化
 */
function normalizeRole(
  role: string | null | undefined
): Staff["role"] {
  const value = String(role ?? "").trim();

  switch (value) {
    case "SUPER_ADMIN":
    case "スーパーアドミン":
    case "スーパーアドミン（管理者）":
    case "スーパーアドミン(管理者)":
    case "管理者":
      return "SUPER_ADMIN";

    case "ADMIN":
    case "アドミン":
    case "アドミン（店長）":
    case "アドミン(店長)":
    case "店長":
      return "ADMIN";

    case "MANAGER":
    case "マネージャー":
    case "マネージャー（副店長・経理）":
    case "マネージャー(副店長・経理)":
    case "副店長":
      return "MANAGER";

    case "CHIEF":
    case "チーフ":
    case "チーフ（スタッフ）":
    case "チーフ(スタッフ)":
      return "CHIEF";

    case "TRIAL":
    case "トライアル":
    case "トライアル（体験スタッフ）":
    case "トライアル(体験スタッフ)":
      return "TRIAL";

    case "STAFF":
    case "スタッフ":
    case "スタッフ（スタッフ）":
    case "スタッフ(スタッフ)":
      return "STAFF";

    default:
      return "STAFF";
  }
}

/**
 * パスワード状態
 */
export async function getStaffPasswordStatus(
  staffId: number
): Promise<PasswordStatus> {
  if (
    !Number.isInteger(staffId) ||
    staffId < 1
  ) {
    throw new Error(
      "スタッフIDが不正です。"
    );
  }

  const response = await fetch(
    `/api/auth/status?staff=${encodeURIComponent(
      staffId
    )}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw await getApiError(
      response,
      "パスワード状態を取得できませんでした。"
    );
  }

  const data = await readJson<{
    configured?: boolean;
  }>(response);

  return data?.configured ? "set" : "unset";
}

/**
 * パスワード確認
 */
export async function verifyStaffPassword(
  _staffId: number,
  _password: string
): Promise<boolean> {
  return false;
}

/**
 * パスワード設定
 */
export async function setStaffPassword(
  staffId: number,
  password: string
): Promise<void> {
  if (
    !Number.isInteger(staffId) ||
    staffId < 1
  ) {
    throw new Error(
      "スタッフIDが不正です。"
    );
  }

  const trimmedPassword = password.trim();

  if (trimmedPassword.length < 4) {
    throw new Error(
      "パスワードは4文字以上で設定してください。"
    );
  }

  const response = await fetch(
    "/api/auth/password",
    {
      method: "POST",
      // 初回設定は未認証で許可する。既に設定済みならWorker側が認証を要求する。
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        staffId,
        password: trimmedPassword,
      }),
    }
  );

  if (!response.ok) {
    throw await getApiError(
      response,
      "パスワードを設定できませんでした。"
    );
  }
}

/**
 * パスワード変更
 */
export async function changeStaffPassword(
  staffId: number,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (
    !Number.isInteger(staffId) ||
    staffId < 1
  ) {
    throw new Error(
      "スタッフIDが不正です。"
    );
  }

  const current = currentPassword.trim();
  const next = newPassword.trim();

  if (current.length < 4) {
    throw new Error(
      "現在のパスワードが不正です。"
    );
  }

  if (next.length < 4) {
    throw new Error(
      "新しいパスワードは4文字以上で設定してください。"
    );
  }

  if (current === next) {
    throw new Error(
      "現在と同じパスワードは設定できません。"
    );
  }

  const response = await fetch(
    "/api/auth/password",
    {
      method: "POST",
      headers: authHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        staffId,
        password: next,
        currentPassword: current,
      }),
    }
  );

  if (!response.ok) {
    throw await getApiError(
      response,
      "パスワードを変更できませんでした。"
    );
  }
}

/**
 * ログイン
 */
export async function loginStaff(
  staffId: number,
  password: string
) {
  if (
    !Number.isInteger(staffId) ||
    staffId < 1
  ) {
    throw new Error(
      "スタッフIDが不正です。"
    );
  }

  const trimmedPassword = password.trim();

  if (trimmedPassword.length < 4) {
    throw new Error(
      "パスワードは4文字以上で入力してください。"
    );
  }

  const response = await fetch(
    "/api/auth/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        staffId,
        password: trimmedPassword,
      }),
    }
  );

  const data = await readJson<{
    error?: string;
    accessKey?: string;
    staffId?: number;
    id?: string;
    name?: string;
    role?: string;
  }>(response);

  if (
    !response.ok ||
    !data?.accessKey
  ) {
    throw new Error(
      data?.error ||
        "ログインに失敗しました。"
    );
  }

  const localId = Number(data.staffId);

  if (
    !Number.isInteger(localId) ||
    localId < 1
  ) {
    throw new Error(
      "ログイン情報のスタッフIDが不正です。"
    );
  }

  const staff: Staff = {
    id: localId,
    name: data.name || "",
    role: normalizeRole(data.role),
    active: true,
  };

  saveStaffSession(
    staff,
    data.accessKey
  );

  return {
    ...data,
    staffId: localId,
    role: normalizeRole(data.role),
  };
}

/**
 * セッション保存
 */
export function saveStaffSession(
  staff: Staff,
  accessKey = ""
): void {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  const session: StaffSession = {
    staffId: String(staff.id),
    localId: Number(staff.id),
    name: staff.name,
    role: normalizeRole(staff.role),
    accessKey: String(accessKey || ""),
  };

  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify(session)
    );
  } catch (error) {
    console.error(
      "スタッフセッションの保存に失敗しました",
      error
    );
  }
}

/**
 * セッション取得
 */
export function getStaffSession():
  | StaffSession
  | null {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  try {
    const raw =
      sessionStorage.getItem(
        SESSION_KEY
      );

    if (!raw) {
      return null;
    }

    const session =
      JSON.parse(raw) as Partial<StaffSession>;

    if (
      !session ||
      typeof session !== "object"
    ) {
      sessionStorage.removeItem(
        SESSION_KEY
      );

      return null;
    }

    const localId = Number(
      session.localId ??
        session.staffId
    );

    if (
      !Number.isInteger(localId) ||
      localId < 1
    ) {
      sessionStorage.removeItem(
        SESSION_KEY
      );

      return null;
    }

    if (
      typeof session.accessKey !==
      "string"
    ) {
      sessionStorage.removeItem(
        SESSION_KEY
      );

      return null;
    }

    return {
      staffId: String(
        session.staffId ?? localId
      ),
      localId,
      name:
        typeof session.name ===
        "string"
          ? session.name
          : "",
      role: normalizeRole(
        typeof session.role ===
          "string"
          ? session.role
          : "STAFF"
      ),
      accessKey: session.accessKey,
    };
  } catch (error) {
    console.error(
      "スタッフセッションの読み込みに失敗しました",
      error
    );

    try {
      sessionStorage.removeItem(
        SESSION_KEY
      );
    } catch {
      // ignore
    }

    return null;
  }
}

/**
 * セッション削除
 */
export function clearStaffSession(): void {
  if (
    typeof window !== "undefined"
  ) {
    try {
      sessionStorage.removeItem(
        SESSION_KEY
      );
    } catch {
      // ignore
    }
  }
}

/**
 * アクセスキー取得
 */
export function getStaffAccessKey():
  | string
  | null {
  return (
    getStaffSession()?.accessKey ||
    null
  );
}

/**
 * 認証ヘッダー取得
 */
export function getStaffAuthHeaders():
  HeadersInit {
  const accessKey =
    getStaffAccessKey();

  if (!accessKey) {
    return {
      "Content-Type":
        "application/json",
    };
  }

  return {
    "Content-Type":
      "application/json",
    Authorization:
      `Bearer ${accessKey}`,
  };
}

/**
 * セッション確認
 */
export function hasStaffSession(): boolean {
  const session =
    getStaffSession();

  return Boolean(
    session?.accessKey
  );
}

export {
  hashPassword,
};
