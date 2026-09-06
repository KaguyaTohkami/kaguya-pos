const API_BASE = "/api/db/";
const SESSION_KEY = "betelgeuse_staff_session";

type StaffSession = {
  accessKey?: string;
};

function getSession(): StaffSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    return JSON.parse(raw) as StaffSession;
  } catch {
    return null;
  }
}

export function getStaffAccessKey(): string | null {
  return getSession()?.accessKey || null;
}

export function getStaffAuthHeaders(): HeadersInit {
  const accessKey = getStaffAccessKey();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessKey) {
    headers.Authorization = `Bearer ${accessKey}`;
  }

  return headers;
}

function authHeader(): Record<string, string> {
  const accessKey = getStaffAccessKey();

  if (!accessKey) return {};

  return {
    Authorization: `Bearer ${accessKey}`,
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();

    let message = text;

    try {
      const data = JSON.parse(text) as {
        error?: string;
      };

      if (data?.error) {
        message = data.error;
      }
    } catch {
      // JSONでない場合はそのまま使用
    }

    throw new Error(
      `D1 ${response.status}: ${message}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const d1 = {
  get: <T>(path: string) =>
    request<T>(path),

  post: <T>(
    path: string,
    body: unknown
  ) =>
    request<T>(path, {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    }),

  patch: <T>(
    path: string,
    body: unknown
  ) =>
    request<T>(path, {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string) =>
    request<T>(path, {
      method: "DELETE",
      headers: {
        Prefer: "return=representation",
      },
    }),
};

export function toD1Role(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return "スーパーアドミン";

    case "ADMIN":
      return "アドミン";

    case "MANAGER":
      return "マネージャー";

    case "CHIEF":
      return "チーフ";

    case "TRIAL":
      return "トライアル";

    default:
      return "スタッフ";
  }
}

export function fromD1Role(
  role: string | null | undefined
) {
  if (
    role === "スーパーアドミン" ||
    role === "SUPER_ADMIN" ||
    role === "管理者"
  ) {
    return "SUPER_ADMIN" as const;
  }

  if (
    role === "アドミン" ||
    role === "ADMIN" ||
    role === "ADMIN_STORE_MANAGER" ||
    role === "店長"
  ) {
    return "ADMIN" as const;
  }

  if (
    role === "マネージャー" ||
    role === "副店長・経理" ||
    role === "MANAGER"
  ) {
    return "MANAGER" as const;
  }

  if (
    role === "チーフ" ||
    role === "CHIEF"
  ) {
    return "CHIEF" as const;
  }

  if (
    role === "トライアル" ||
    role === "TRIAL"
  ) {
    return "TRIAL" as const;
  }

  return "STAFF" as const;
}
