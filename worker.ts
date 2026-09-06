interface D1Result<T> {
  results: T[];
}

interface D1RunResult {
  success: boolean;
  meta?: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<D1RunResult>;
  first<T>(): Promise<T | null>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  DB: D1Database;
}

type DbRow = Record<string, unknown>;

const TABLE_COLUMNS: Record<string, Set<string>> = {
  settings: new Set([
    "id",
    "store_name",
    "tax_rate",
    "theme",
    "columns",
    "categories",
    "effects",
    "theme_by_staff",
    "gacha_rarity",
    "inventory_enabled",
  ]),

  staff: new Set([
    "id",
    "local_id",
    "name",
    "role",
    "active",
    "password_hash",
    "access_key",
  ]),

  products: new Set([
    "id",
    "local_id",
    "name",
    "price",
    "image_url",
    "detail_image_url",
    "description",
    "category",
    "effects",
    "is_active",
    "inventory_quantity",
  ]),

  sales: new Set([
    "id",
    "local_id",
    "staff_id",
    "subtotal",
    "tax",
    "total",
    "created_at",
  ]),

  sale_items: new Set([
    "id",
    "sale_id",
    "product_id",
    "name",
    "price",
    "quantity",
  ]),

  role_display_settings: new Set([
    "role",
    "register_columns",
    "register_mobile_columns",
    "product_columns",
    "product_mobile_columns",
  ]),
};

const TABLES = new Set(Object.keys(TABLE_COLUMNS));

const JSON_COLUMNS = new Set([
  "categories",
  "effects",
  "theme_by_staff",
  "gacha_rarity",
]);

const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "CHIEF",
  "STAFF",
  "TRIAL",
] as const;

const ADMIN_ID =
  "00000000-0000-0000-0000-000000000001";

const GACHA = JSON.stringify({
  enabled: true,
  showOnList: true,
  labels: {
    C: "C",
    R: "R",
    SR: "SR",
    SSR: "SSR",
  },
  order: ["C", "R", "SR", "SSR"],
});

let schemaReady: Promise<void> | null = null;

const run = (
  db: D1Database,
  sql: string,
  ...values: unknown[]
): Promise<D1RunResult> =>
  db.prepare(sql).bind(...values).run();

/* =========================================================
 * Role normalization
 * ========================================================= */

function normalizeRole(
  role: string | null | undefined
): string {
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

/* =========================================================
 * Role permissions
 * ========================================================= */

const ROLE_RANK: Record<string, number> = {
  TRIAL: 0,
  STAFF: 1,
  CHIEF: 2,
  MANAGER: 3,
  ADMIN: 4,
  SUPER_ADMIN: 5,
};

const MANAGEMENT_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
]);

const PRODUCT_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
]);

const HISTORY_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
]);

const publicReadTables = new Set([
  "staff",
  "settings",
  "role_display_settings",
]);

function rank(role: string) {
  return ROLE_RANK[normalizeRole(role)] ?? -1;
}

function hasRole(
  ctx: AuthContext,
  roles: Set<string>
) {
  return roles.has(normalizeRole(ctx.role));
}

/* =========================================================
 * Schema
 * ========================================================= */

async function ensureSchema(db: D1Database) {
  if (schemaReady) {
    return schemaReady;
  }

  schemaReady = (async () => {
    await run(
      db,
      `CREATE TABLE IF NOT EXISTS settings(
        id TEXT PRIMARY KEY,
        store_name TEXT NOT NULL,
        tax_rate REAL NOT NULL DEFAULT 0,
        theme TEXT NOT NULL DEFAULT 'dark',
        columns INTEGER NOT NULL DEFAULT 4,
        categories TEXT NOT NULL DEFAULT '[]',
        effects TEXT NOT NULL DEFAULT '[]',
        theme_by_staff TEXT NOT NULL DEFAULT '{}',
        gacha_rarity TEXT NOT NULL DEFAULT '${GACHA.replaceAll(
          "'",
          "''"
        )}',
        inventory_enabled INTEGER NOT NULL DEFAULT 0
      )`
    );

    await run(
      db,
      `CREATE TABLE IF NOT EXISTS staff(
        id TEXT PRIMARY KEY,
        local_id INTEGER UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
          CHECK(active IN(0,1)),
        password_hash TEXT,
        access_key TEXT
      )`
    );

    await run(
      db,
      `CREATE TABLE IF NOT EXISTS products(
        id TEXT PRIMARY KEY,
        local_id INTEGER UNIQUE,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        image_url TEXT,
        detail_image_url TEXT,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'その他',
        effects TEXT NOT NULL DEFAULT '[]',
        is_active INTEGER NOT NULL DEFAULT 1
          CHECK(is_active IN(0,1)),
        inventory_quantity INTEGER NOT NULL DEFAULT 0
          CHECK(inventory_quantity>=0),
        low_stock_notified INTEGER NOT NULL DEFAULT 0
          CHECK(low_stock_notified IN(0,1))
      )`
    );

    await run(
      db,
      `CREATE TABLE IF NOT EXISTS sales(
        id TEXT PRIMARY KEY,
        local_id TEXT UNIQUE,
        staff_id TEXT,
        subtotal INTEGER NOT NULL DEFAULT 0,
        tax INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL DEFAULT 0,
        created_at TEXT,
        FOREIGN KEY(staff_id)
          REFERENCES staff(id)
          ON DELETE SET NULL
      )`
    );

    await run(
      db,
      `CREATE TABLE IF NOT EXISTS sale_items(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id TEXT NOT NULL,
        product_id TEXT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY(sale_id)
          REFERENCES sales(id)
          ON DELETE CASCADE,
        FOREIGN KEY(product_id)
          REFERENCES products(id)
          ON DELETE SET NULL
      )`
    );

    await run(
      db,
      `CREATE TABLE IF NOT EXISTS role_display_settings(
        role TEXT PRIMARY KEY,
        register_columns INTEGER NOT NULL DEFAULT 4,
        register_mobile_columns INTEGER NOT NULL DEFAULT 2,
        product_columns INTEGER NOT NULL DEFAULT 3,
        product_mobile_columns INTEGER NOT NULL DEFAULT 2
      )`
    );

    await run(
      db,
      `CREATE TABLE IF NOT EXISTS inventory_notification_settings(
        id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),
        threshold INTEGER NOT NULL DEFAULT 5 CHECK(threshold>=0),
        webhook_url TEXT NOT NULL DEFAULT ''
      )`
    );

    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_staff_local_id ON staff(local_id)",
      "CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(active)",
      "CREATE INDEX IF NOT EXISTS idx_staff_access_key ON staff(access_key)",
      "CREATE INDEX IF NOT EXISTS idx_products_local_id ON products(local_id)",
      "CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)",
      "CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_sales_staff_id ON sales(staff_id)",
      "CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)",
    ];

    for (const sql of indexes) {
      await run(db, sql);
    }

    const migrations = [
      "ALTER TABLE staff ADD COLUMN password_hash TEXT",
      "ALTER TABLE staff ADD COLUMN access_key TEXT",
      `ALTER TABLE settings ADD COLUMN gacha_rarity TEXT NOT NULL DEFAULT '${GACHA.replaceAll(
        "'",
        "''"
      )}'`,
      "ALTER TABLE settings ADD COLUMN inventory_enabled INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE products ADD COLUMN inventory_quantity INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE products ADD COLUMN low_stock_notified INTEGER NOT NULL DEFAULT 0",
    ];

    for (const sql of migrations) {
      try {
        await run(db, sql);
      } catch {
        // 既に存在する場合は無視
      }
    }

    await run(
      db,
      `INSERT OR IGNORE INTO settings(
        id,
        store_name,
        tax_rate,
        theme,
        columns,
        categories,
        effects,
        theme_by_staff,
        gacha_rarity,
        inventory_enabled
      )
      VALUES(
        'default',
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
      )`,
      "K-POS",
      0,
      "dark",
      4,
      "[]",
      "[]",
      "{}",
      GACHA,
      0
    );

    for (const role of ROLES) {
      await run(
        db,
        `INSERT OR IGNORE INTO role_display_settings(
          role,
          register_columns,
          register_mobile_columns,
          product_columns,
          product_mobile_columns
        )
        VALUES(?,4,2,3,2)`,
        role
      );
    }

    await run(
      db,
      `INSERT OR IGNORE INTO staff(
        id,
        local_id,
        name,
        role,
        active,
        password_hash,
        access_key
      )
      VALUES(?,?,?,?,?,?,?)`,
      ADMIN_ID,
      1,
      "サーバー管理者",
      "SUPER_ADMIN",
      1,
      null,
      null
    );

    await run(
      db,
      `INSERT OR IGNORE INTO inventory_notification_settings(
        id, enabled, threshold, webhook_url
      ) VALUES('default',0,5,'')`
    );

    await run(
      db,
      `UPDATE settings
       SET gacha_rarity=?
       WHERE gacha_rarity IS NULL
       OR gacha_rarity=''`,
      GACHA
    );

    await run(
      db,
      `UPDATE settings
       SET inventory_enabled=0
       WHERE inventory_enabled IS NULL`
    );

    await run(
      db,
      `UPDATE products
       SET inventory_quantity=0
       WHERE inventory_quantity IS NULL
       OR inventory_quantity<0`
    );
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });

  return schemaReady;
}

/* =========================================================
 * Database helpers
 * ========================================================= */

function hydrate(row: DbRow) {
  const output = { ...row };

  for (const column of JSON_COLUMNS) {
    if (column in output) {
      try {
        output[column] = JSON.parse(
          String(output[column])
        );
      } catch {
        // 無効なJSONはそのまま
      }
    }
  }

  if ("active" in output) {
    output.active = Boolean(output.active);
  }

  if ("is_active" in output) {
    output.is_active = Boolean(output.is_active);
  }

  if ("inventory_enabled" in output) {
    output.inventory_enabled =
      Boolean(output.inventory_enabled);
  }

  if ("inventory_quantity" in output) {
    output.inventory_quantity = Math.max(
      0,
      Number(output.inventory_quantity) || 0
    );
  }

  if ("low_stock_notified" in output) {
    output.low_stock_notified = Boolean(
      output.low_stock_notified
    );
  }

  return output;
}

function dbValue(
  column: string,
  value: unknown
) {
  if (JSON_COLUMNS.has(column)) {
    return JSON.stringify(
      value ??
        (column === "theme_by_staff"
          ? {}
          : column === "gacha_rarity"
            ? JSON.parse(GACHA)
            : [])
    );
  }

  if (
    [
      "active",
      "is_active",
      "inventory_enabled",
    ].includes(column)
  ) {
    if (typeof value === "string") {
      return [
        "1",
        "true",
        "TRUE",
        "on",
      ].includes(value)
        ? 1
        : 0;
    }

    return value ? 1 : 0;
  }

  if (column === "inventory_quantity") {
    return Math.max(
      0,
      Math.floor(Number(value) || 0)
    );
  }

  return value;
}

function response(
  data: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json;charset=utf-8",
        "Cache-Control":
          "no-store, max-age=0, must-revalidate",
        "CDN-Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    }
  );
}

/* =========================================================
 * Filters / Select
 * ========================================================= */

function filters(
  table: string,
  params: URLSearchParams
) {
  const where: string[] = [];
  const binds: unknown[] = [];

  for (const [key, raw] of params.entries()) {
    if (
      ["select", "order", "limit"].includes(key)
    ) {
      continue;
    }

    if (
      key === "password_hash" ||
      key === "access_key"
    ) {
      throw new Error(
        "Secret columns cannot be used as filters"
      );
    }

    if (!TABLE_COLUMNS[table]?.has(key)) {
      throw new Error(
        `Unsupported filter column: ${key}`
      );
    }

    const match = raw.match(
      /^(eq|neq|gt|gte|lt|lte|is)\.(.*)$/
    );

    if (!match) {
      if (
        raw.startsWith("in.(") &&
        raw.endsWith(")")
      ) {
        const values = raw
          .slice(4, -1)
          .split(",")
          .filter(Boolean);

        if (!values.length) {
          where.push("1=0");
        } else {
          where.push(
            `${key} IN(${values
              .map(() => "?")
              .join(",")})`
          );

          binds.push(
            ...values.map((value) =>
              dbValue(key, value)
            )
          );
        }

        continue;
      }

      throw new Error(
        `Unsupported filter: ${key}=${raw}`
      );
    }

    const operator = match[1];
    const value = match[2];

    if (operator === "is") {
      if (value === "null") {
        where.push(`${key} IS NULL`);
      } else if (value === "not.null") {
        where.push(`${key} IS NOT NULL`);
      } else {
        throw new Error(
          `Unsupported IS filter: ${raw}`
        );
      }
    } else {
      const operators: Record<string, string> = {
        eq: "=",
        neq: "!=",
        gt: ">",
        gte: ">=",
        lt: "<",
        lte: "<=",
      };

      where.push(
        `${key} ${operators[operator]} ?`
      );

      binds.push(
        dbValue(key, value)
      );
    }
  }

  return {
    sql: where.length
      ? ` WHERE ${where.join(" AND ")}`
      : "",
    binds,
  };
}

function selectCols(
  table: string,
  select: string | null
) {
  const safeStaff = [
    "id",
    "local_id",
    "name",
    "role",
    "active",
  ];

  const requested =
    !select || select === "*"
      ? table === "staff"
        ? safeStaff
        : [...TABLE_COLUMNS[table]]
      : select
          .split(",")
          .map((column) => column.trim())
          .filter(Boolean);

  return requested
    .map((column) => {
      if (
        !TABLE_COLUMNS[table].has(column) ||
        column === "password_hash" ||
        column === "access_key"
      ) {
        throw new Error(
          `Unsupported select column: ${column}`
        );
      }

      return column;
    })
    .join(",");
}

/* =========================================================
 * Authentication
 * ========================================================= */

type AuthContext = {
  id: string;
  localId: number;
  name: string;
  role: string;
  active: boolean;
  accessKey: string;
};

function bearer(req: Request) {
  const header =
    req.headers.get("Authorization") || "";

  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header
    .slice(7)
    .trim();
}

async function auth(
  req: Request,
  env: Env
): Promise<AuthContext | null> {
  const key = bearer(req);

  if (!key || key.length < 32) {
    return null;
  }

  const row =
    await env.DB
      .prepare(
        `SELECT
          id,
          local_id,
          name,
          role,
          active
        FROM staff
        WHERE TRIM(access_key)=TRIM(?)
        LIMIT 1`
      )
      .bind(key)
      .first<{
        id: string;
        local_id: number;
        name: string;
        role: string;
        active: number;
      }>();

  if (!row || !Boolean(row.active)) {
    return null;
  }

  return {
    id: row.id,
    localId: Number(row.local_id),
    name: row.name,
    role: normalizeRole(row.role),
    active: Boolean(row.active),
    accessKey: key,
  };
}

function unauthorized() {
  return response(
    {
      error:
        "認証が必要です。ログインし直してください。",
    },
    401
  );
}

function forbidden() {
  return response(
    {
      error:
        "この操作を実行する権限がありません。",
    },
    403
  );
}

/* =========================================================
 * Database authorization
 * ========================================================= */

async function canDb(
  req: Request,
  env: Env,
  table: string,
  method: string
): Promise<{
  ctx: AuthContext | null;
  error: Response | null;
}> {
  const ctx = await auth(req, env);

  /*
   * ログイン前に必要な読み取りのみ許可。
   * staffはselectCols()によって秘密情報を除外。
   */
  if (
    method === "GET" &&
    publicReadTables.has(table)
  ) {
    return {
      ctx,
      error: null,
    };
  }

  if (!ctx) {
    return {
      ctx: null,
      error: unauthorized(),
    };
  }

  /*
   * 読み取りはログイン後すべて許可。
   */
  if (method === "GET") {
    return {
      ctx,
      error: null,
    };
  }

  /*
   * 商品管理
   */
  if (table === "products") {
    return {
      ctx,
      error: hasRole(
        ctx,
        PRODUCT_ROLES
      )
        ? null
        : forbidden(),
    };
  }

  /*
   * 店舗設定
   *
   * POST / DELETE は管理者のみ。
   * PATCH は一般スタッフからも到達可能にするが、
   * 実際に保存できる項目は handleDb() 側で
   * theme_by_staff のみに制限する。
   *
   * これによりレジ側が設定全体をPATCHしても403にせず、
   * inventory_enabled / tax_rate / categories などの店舗設定を
   * 一般スタッフが変更することも防止する。
   */
  if (table === "settings") {
    if (method === "PATCH") {
      return {
        ctx,
        error: null,
      };
    }

    return {
      ctx,
      error: hasRole(
        ctx,
        MANAGEMENT_ROLES
      )
        ? null
        : forbidden(),
    };
  }

  /*
   * ロール別表示設定
   */
  if (
    table === "role_display_settings"
  ) {
    return {
      ctx,
      error: null,
    };
  }

  /*
   * スタッフ管理
   */
  if (table === "staff") {
    return {
      ctx,
      error: hasRole(
        ctx,
        MANAGEMENT_ROLES
      )
        ? null
        : forbidden(),
    };
  }

  /*
   * 会計
   */
  if (table === "sales") {
    if (
      (method === "PATCH" ||
        method === "DELETE") &&
      !hasRole(ctx, HISTORY_ROLES)
    ) {
      return {
        ctx,
        error: forbidden(),
      };
    }

    return {
      ctx,
      error: null,
    };
  }

  /*
   * 会計明細
   */
  if (table === "sale_items") {
    if (
      (method === "PATCH" ||
        method === "DELETE") &&
      !hasRole(ctx, HISTORY_ROLES)
    ) {
      return {
        ctx,
        error: forbidden(),
      };
    }

    return {
      ctx,
      error: null,
    };
  }

  return {
    ctx,
    error: forbidden(),
  };
}

/* =========================================================
 * Body authorization
 * ========================================================= */

function enforceBody(
  table: string,
  method: string,
  ctx: AuthContext,
  body: Record<string, unknown>
) {
  const role = normalizeRole(ctx.role);

  /*
   * スタッフ
   */
  if (table === "staff") {
    const targetRole = normalizeRole(
      String(body.role || "")
    );

    if (
      method === "POST" &&
      role !== "SUPER_ADMIN" &&
      rank(targetRole) >= rank("ADMIN")
    ) {
      throw new Error(
        "ADMIN以上のスタッフはSUPER_ADMINのみ作成できます。"
      );
    }

    if (
      role !== "SUPER_ADMIN" &&
      targetRole === "SUPER_ADMIN"
    ) {
      throw new Error(
        "SUPER_ADMINは変更できません。"
      );
    }
  }

  /*
   * 会計
   */
  if (
    table === "sales" &&
    (method === "POST" ||
      method === "PATCH") &&
    role !== "SUPER_ADMIN" &&
    role !== "ADMIN" &&
    body.staff_id !== undefined &&
    String(body.staff_id) !== ctx.id
  ) {
    throw new Error(
      "自分以外のスタッフとして会計を登録できません。"
    );
  }

  /*
   * ロール別表示設定
   */
  if (
    table === "role_display_settings" &&
    body.role !== undefined
  ) {
    const targetRole = normalizeRole(
      String(body.role)
    );

    if (
      !MANAGEMENT_ROLES.has(role) &&
      targetRole !== role
    ) {
      throw new Error(
        "他スタッフの表示設定は変更できません。"
      );
    }
  }
}

/* =========================================================
 * Database API
 * ========================================================= */

async function handleDb(
  req: Request,
  env: Env
) {
  await ensureSchema(env.DB);

  const url = new URL(req.url);

  const table = url.pathname
    .slice("/api/db/".length)
    .replace(/^\/+/, "");

  if (!TABLES.has(table)) {
    return response(
      {
        error: "Unknown table",
      },
      404
    );
  }

  const gate = await canDb(
    req,
    env,
    table,
    req.method
  );

  if (gate.error) {
    return gate.error;
  }

  const ctx = gate.ctx;

  const filter = filters(
    table,
    url.searchParams
  );

  const select = selectCols(
    table,
    url.searchParams.get("select")
  );

  /* GET */
  if (req.method === "GET") {
    let sql =
      `SELECT ${select} FROM ${table}` +
      filter.sql;

    const order =
      url.searchParams.get("order");

    if (order) {
      const [column, direction = "asc"] =
        order.split(".");

      if (
        !TABLE_COLUMNS[table].has(
          column
        ) ||
        !["asc", "desc"].includes(
          direction.toLowerCase()
        )
      ) {
        throw new Error(
          "Invalid order"
        );
      }

      sql +=
        ` ORDER BY ${column} ` +
        direction.toUpperCase();
    }

    const limit =
      url.searchParams.get("limit");

    if (limit) {
      sql +=
        ` LIMIT ${Math.max(
          1,
          Math.min(
            10000,
            Number(limit) || 1
          )
        )}`;
    }

    const result =
      await env.DB
        .prepare(sql)
        .bind(...filter.binds)
        .all<DbRow>();

    return response(
      result.results.map(hydrate)
    );
  }

  if (!ctx) {
    return unauthorized();
  }

  /* POST */
  if (req.method === "POST") {
    const body =
      (await req.json()) as Record<
        string,
        unknown
      >;

    enforceBody(
      table,
      "POST",
      ctx,
      body
    );

    const entries =
      Object.entries(body).filter(
        ([column]) =>
          TABLE_COLUMNS[table].has(
            column
          ) &&
          column !== "password_hash" &&
          column !== "access_key"
      );

    if (!entries.length) {
      return response(
        {
          error:
            "No writable columns",
        },
        400
      );
    }

    const names =
      entries.map(
        ([column]) => column
      );

    const values =
      entries.map(
        ([column, value]) =>
          dbValue(column, value)
      );

    const result =
      await env.DB
        .prepare(
          `INSERT INTO ${table}(
            ${names.join(",")}
          )
          VALUES(
            ${names
              .map(() => "?")
              .join(",")}
          )
          RETURNING *`
        )
        .bind(...values)
        .all<DbRow>();

    return response(
      result.results.map(hydrate),
      201
    );
  }

  /* PATCH */
  if (req.method === "PATCH") {
    const body =
      (await req.json()) as Record<
        string,
        unknown
      >;

    /*
     * 一般スタッフのsettings PATCHは、レジ画面から
     * 設定状態が自動保存されるケースを考慮して受け付ける。
     * ただし店舗全体に影響する項目は絶対にD1へ書き込ませない。
     *
     * 管理者以外:
     *   許可 = theme_by_staff のみ
     *   禁止 = inventory_enabled / tax_rate / categories / effects / theme / columns / store_name
     */
    if (table === "settings" && !hasRole(ctx, MANAGEMENT_ROLES)) {
      const safeBody: Record<string, unknown> = {};

      if (Object.prototype.hasOwnProperty.call(body, "theme_by_staff")) {
        safeBody.theme_by_staff = body.theme_by_staff;
      }

      if (!Object.keys(safeBody).length) {
        const current = await env.DB
          .prepare(`SELECT * FROM settings${filter.sql} LIMIT 1`)
          .bind(...filter.binds)
          .first<DbRow>();

        return response(current ? [hydrate(current)] : []);
      }

      Object.keys(body).forEach((key) => delete body[key]);
      Object.assign(body, safeBody);
    }

    enforceBody(
      table,
      "PATCH",
      ctx,
      body
    );

    /*
     * ADMIN以下はSUPER_ADMIN / ADMINを
     * 編集できない。
     */
    if (
      table === "staff" &&
      normalizeRole(ctx.role) !==
        "SUPER_ADMIN"
    ) {
      const target =
        await env.DB
          .prepare(
            `SELECT role
             FROM staff
             ${filter.sql}
             LIMIT 1`
          )
          .bind(...filter.binds)
          .first<{ role: string }>();

      if (
        target &&
        ["SUPER_ADMIN", "ADMIN"].includes(
          normalizeRole(target.role)
        )
      ) {
        return forbidden();
      }
    }

    const entries =
      Object.entries(body).filter(
        ([column]) =>
          TABLE_COLUMNS[table].has(
            column
          ) &&
          column !== "password_hash" &&
          column !== "access_key"
      );

    if (!entries.length) {
      return response(
        {
          error:
            "No writable columns",
        },
        400
      );
    }

    const values =
      entries.map(
        ([column, value]) =>
          dbValue(column, value)
      );

    const set =
      entries
        .map(
          ([column]) =>
            `${column}=?`
        )
        .join(",");

    const result =
      await env.DB
        .prepare(
          `UPDATE ${table}
           SET ${set}
           ${filter.sql}
           RETURNING *`
        )
        .bind(
          ...values,
          ...filter.binds
        )
        .all<DbRow>();

    return response(
      result.results.map(hydrate)
    );
  }

  /* DELETE */
  if (req.method === "DELETE") {
    if (
      table === "staff" &&
      normalizeRole(ctx.role) !==
        "SUPER_ADMIN"
    ) {
      const target =
        await env.DB
          .prepare(
            `SELECT role
             FROM staff
             ${filter.sql}
             LIMIT 1`
          )
          .bind(...filter.binds)
          .first<{ role: string }>();

      if (
        target &&
        ["SUPER_ADMIN", "ADMIN"].includes(
          normalizeRole(target.role)
        )
      ) {
        return forbidden();
      }
    }

    const result =
      await env.DB
        .prepare(
          `DELETE FROM ${table}
           ${filter.sql}
           RETURNING *`
        )
        .bind(...filter.binds)
        .all<DbRow>();

    return response(
      result.results.map(hydrate)
    );
  }

  return response(
    {
      error: "Method not allowed",
    },
    405
  );
}

/* =========================================================
 * Authentication utilities
 * ========================================================= */

function createAccessKey() {
  const bytes = new Uint8Array(32);

  crypto.getRandomValues(bytes);

  return Array.from(
    bytes,
    (value) =>
      value
        .toString(16)
        .padStart(2, "0")
  ).join("");
}

async function sha256(text: string) {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text)
    );

  return Array.from(
    new Uint8Array(digest),
    (value) =>
      value
        .toString(16)
        .padStart(2, "0")
  ).join("");
}

/* =========================================================
 * Password status
 * ========================================================= */

async function staffPasswordStatus(
  req: Request,
  env: Env
) {
  await ensureSchema(env.DB);

  const id = Number(
    new URL(req.url)
      .searchParams
      .get("staff")
  );

  if (
    !Number.isInteger(id) ||
    id < 1
  ) {
    return response(
      {
        error:
          "staff is required",
      },
      400
    );
  }

  const row =
    await env.DB
      .prepare(
        `SELECT password_hash
         FROM staff
         WHERE local_id=?
         AND active=1
         LIMIT 1`
      )
      .bind(id)
      .first<{
        password_hash:
          | string
          | null;
        access_key:
          | string
          | null;
      }>();

  if (!row) {
    return response(
      {
        error:
          "スタッフが見つかりません。",
      },
      404
    );
  }

  return response({
    configured:
      Boolean(row.password_hash),
  });
}

/* =========================================================
 * Password setting
 * ========================================================= */

async function setPassword(
  req: Request,
  env: Env
) {
  await ensureSchema(env.DB);

  const body =
    (await req.json()) as {
      staffId?: number;
      password?: string;
      currentPassword?: string;
    };

  const staffId = Number(
    body.staffId
  );

  const password = String(
    body.password || ""
  ).trim();

  if (
    !Number.isInteger(staffId) ||
    staffId < 1 ||
    password.length < 4
  ) {
    return response(
      {
        error:
          "スタッフIDまたはパスワードが不正です。",
      },
      400
    );
  }

  const target =
    await env.DB
      .prepare(
        `SELECT
          id,
          local_id,
          password_hash,
          role,
          active
        FROM staff
        WHERE local_id=?
        LIMIT 1`
      )
      .bind(staffId)
      .first<{
        id: string;
        local_id: number;
        password_hash:
          | string
          | null;
        role: string;
        active: number;
      }>();

  if (
    !target ||
    !target.active
  ) {
    return response(
      {
        error:
          "スタッフが見つかりません。",
      },
      404
    );
  }

  const ctx = await auth(
    req,
    env
  );

  const targetRole =
    normalizeRole(target.role);

  /*
   * 初回設定は、パスワード未設定の本人が行う。
   * 未認証で許可するのは password_hash が空の対象だけ。
   * 一度設定済みのスタッフは必ず通常認証が必要。
   */
  if (!ctx) {
    if (target.password_hash) {
      return response(
        {
          error:
            "このスタッフは既にパスワードが設定されています。ログインしてください。",
        },
        401
      );
    }
  } else if (ctx.id !== target.id && Number(ctx.localId) !== Number(target.local_id)) {
    const currentRole =
      normalizeRole(ctx.role);

    if (
      !MANAGEMENT_ROLES.has(
        currentRole
      )
    ) {
      return forbidden();
    }

    if (
      currentRole !== "SUPER_ADMIN" &&
      rank(targetRole) >=
        rank("ADMIN")
    ) {
      return forbidden();
    }
  } else if (target.password_hash) {
    if (!body.currentPassword) {
      return response(
        {
          error:
            "現在のパスワードが必要です。",
        },
        400
      );
    }

    const currentHash =
      await sha256(
        `${staffId}:POS-SYSTEM:${String(
          body.currentPassword
        ).trim()}`
      );

    if (
      currentHash !==
      target.password_hash
    ) {
      return response(
        {
          error:
            "現在のパスワードが正しくありません。",
        },
        403
      );
    }
  }

  const hash =
    await sha256(
      `${staffId}:POS-SYSTEM:${password}`
    );

  // パスワード更新は対象のDB idを基準に行い、更新直後に必ず再取得して確認する。
  // D1/SQLiteの型差や既存データの揺れを考慮し、保存確認に失敗した場合だけ
  // local_idでも再試行する。
  await env.DB
    .prepare(
      `UPDATE staff
       SET password_hash=?
       WHERE id=?`
    )
    .bind(hash, target.id)
    .run();

  let saved = await env.DB
    .prepare(
      `SELECT password_hash
       FROM staff
       WHERE id=?
       LIMIT 1`
    )
    .bind(target.id)
    .first<{ password_hash: string | null }>();

  if (saved?.password_hash !== hash) {
    await env.DB
      .prepare(
        `UPDATE staff
         SET password_hash=?
         WHERE local_id=?`
      )
      .bind(hash, staffId)
      .run();

    saved = await env.DB
      .prepare(
        `SELECT password_hash
         FROM staff
         WHERE local_id=?
         LIMIT 1`
      )
      .bind(staffId)
      .first<{ password_hash: string | null }>();
  }

  if (saved?.password_hash !== hash) {
    return response(
      {
        error: "パスワードをD1へ保存できませんでした。"
      },
      500
    );
  }

  return response({ ok: true });
}

/* =========================================================
 * Login
 * ========================================================= */

async function login(
  req: Request,
  env: Env
) {
  await ensureSchema(env.DB);

  const body =
    (await req.json()) as {
      staffId?: number;
      password?: string;
    };

  const staffId = Number(
    body.staffId
  );

  const password = String(
    body.password || ""
  ).trim();

  if (
    !Number.isInteger(staffId) ||
    staffId < 1 ||
    password.length < 4
  ) {
    return response(
      {
        error:
          "ログイン情報が不正です。",
      },
      400
    );
  }

  const row =
    await env.DB
      .prepare(
        `SELECT
          id,
          local_id,
          name,
          role,
          active,
          password_hash,
          access_key
        FROM staff
        WHERE local_id=?
        LIMIT 1`
      )
      .bind(staffId)
      .first<{
        id: string;
        local_id: number;
        name: string;
        role: string;
        active: number;
        password_hash:
          | string
          | null;
        access_key:
          | string
          | null;
      }>();

  if (
    !row ||
    !row.active
  ) {
    return response(
      {
        error:
          "スタッフが見つからないか無効になっています。",
      },
      401
    );
  }

  const hash =
    await sha256(
      `${staffId}:POS-SYSTEM:${password}`
    );

  /*
   * 初回ログイン:
   * password_hash が未設定なら、選択した本人が入力した
   * パスワードを初期パスワードとしてD1へ保存する。
   *
   * 既に設定済みなら通常のパスワード照合を行う。
   * これにより、初回設定時に「管理者に設定を依頼してください」
   * が表示される経路をなくす。
   */
  if (!row.password_hash) {
    /*
     * D1/SQLite側の型差異を避けるため、初回保存は id ではなく
     * ログインに使用した local_id をキーにする。
     * RETURNING には依存せず、UPDATE後にSELECTで保存結果を確認する。
     */
    await env.DB
      .prepare(
        `UPDATE staff
         SET password_hash=?
         WHERE local_id=?
           AND (password_hash IS NULL OR TRIM(password_hash)='')`
      )
      .bind(hash, staffId)
      .run();

    const saved = await env.DB
      .prepare(
        `SELECT password_hash
         FROM staff
         WHERE local_id=?
         LIMIT 1`
      )
      .bind(staffId)
      .first<{ password_hash: string | null }>();

    if (saved?.password_hash !== hash) {
      return response(
        {
          error:
            "初回パスワードを保存できませんでした。",
        },
        500
      );
    }
  } else if (
    hash !==
    row.password_hash
  ) {
    return response(
      {
        error:
          "パスワードが正しくありません。",
      },
      401
    );
  }

  // ログイン後に使用するスタッフURLキーは、必ずD1に存在する値を返す。
  // 保存前の生成値をそのまま返すと、D1への更新失敗時に
  // `/register/?key=...` 側だけが存在する「無効なURL」になるため、
  // 保存→再取得まで完了した場合のみキーを確定する。
  let accessKey = String(row.access_key ?? "").trim();

  if (accessKey.length < 32) {
    accessKey = createAccessKey();

    await env.DB
      .prepare(
        `UPDATE staff
         SET access_key=?
         WHERE id=?
           AND (access_key IS NULL OR TRIM(access_key)='')`
      )
      .bind(accessKey, row.id)
      .run();

    const savedKey = await env.DB
      .prepare(
        `SELECT access_key
         FROM staff
         WHERE id=?
         LIMIT 1`
      )
      .bind(row.id)
      .first<{ access_key: string | null }>();

    accessKey = String(savedKey?.access_key ?? "").trim();

    // 競合や旧DBデータで1回目のUPDATEが反映されなかった場合は、
    // local_idを使ってもう一度保存する。
    if (accessKey.length < 32) {
      const retryKey = createAccessKey();
      await env.DB
        .prepare(
          `UPDATE staff
           SET access_key=?
           WHERE local_id=?`
        )
        .bind(retryKey, row.local_id)
        .run();

      const retrySaved = await env.DB
        .prepare(
          `SELECT access_key
           FROM staff
           WHERE local_id=?
           LIMIT 1`
        )
        .bind(row.local_id)
        .first<{ access_key: string | null }>();

      accessKey = String(retrySaved?.access_key ?? "").trim();
    }
  }

  if (accessKey.length < 32) {
    return response(
      { error: "スタッフURLを保存できませんでした。もう一度ログインしてください。" },
      500
    );
  }

  return response({
    accessKey,
    staffId: row.local_id,
    id: row.id,
    name: row.name,
    role: normalizeRole(row.role),
  });
}

/* =========================================================
 * Staff access key
 * ========================================================= */

async function staffAccess(
  req: Request,
  env: Env
) {
  await ensureSchema(env.DB);

  const ctx =
    await auth(req, env);

  if (!ctx) {
    return unauthorized();
  }

  const role =
    normalizeRole(ctx.role);

  if (req.method === "GET") {
    const staff =
      new URL(req.url)
        .searchParams
        .get("staff") || "";

    const target =
      await env.DB
        .prepare(
          `SELECT
            id,
            local_id,
            access_key,
            role
          FROM staff
          WHERE id=?
             OR local_id=?
          LIMIT 1`
        )
        .bind(
          staff,
          Number(staff) || -1
        )
        .first<{
          id: string;
          local_id: number;
          access_key:
            | string
            | null;
          role: string;
        }>();

    if (!target) {
      return response(
        {
          error:
            "スタッフが見つかりません。",
        },
        404
      );
    }

    if (
      target.id !== ctx.id &&
      !MANAGEMENT_ROLES.has(role)
    ) {
      return forbidden();
    }

    const key =
      target.access_key ||
      createAccessKey();

    if (!target.access_key) {
      await env.DB
        .prepare(
          `UPDATE staff
           SET access_key=?
           WHERE id=?`
        )
        .bind(
          key,
          target.id
        )
        .run();
    }

    return response({
      accessKey: key,
    });
  }

  if (req.method === "POST") {
    const body =
      (await req.json()) as {
        action?: string;
        staffId?: string;
      };

    if (
      body.action !==
        "regenerate" ||
      !body.staffId
    ) {
      return response(
        {
          error:
            "Invalid request",
        },
        400
      );
    }

    const target =
      await env.DB
        .prepare(
          `SELECT
            id,
            role
          FROM staff
          WHERE id=?
             OR local_id=?
          LIMIT 1`
        )
        .bind(
          body.staffId,
          Number(body.staffId) ||
            -1
        )
        .first<{
          id: string;
          role: string;
        }>();

    if (!target) {
      return response(
        {
          error:
            "スタッフが見つかりません。",
        },
        404
      );
    }

    if (
      target.id !== ctx.id &&
      !MANAGEMENT_ROLES.has(role)
    ) {
      return forbidden();
    }

    const key =
      createAccessKey();

    await env.DB
      .prepare(
        `UPDATE staff
         SET access_key=?
         WHERE id=?`
      )
      .bind(
        key,
        target.id
      )
      .run();

    return response({
      accessKey: key,
    });
  }

  return response(
    {
      error:
        "Method not allowed",
    },
    405
  );
}

/* =========================================================
 * Staff by access key
 * ========================================================= */

async function staffByKey(
  req: Request,
  env: Env
) {
  await ensureSchema(env.DB);

  const key =
    (new URL(req.url)
      .searchParams
      .get("key") || "")
      .trim();

  if (key.length < 32) {
    return response(
      {
        error:
          "スタッフURLが無効です。",
      },
      400
    );
  }

  const row =
    await env.DB
      .prepare(
        `SELECT
          local_id,
          id,
          name,
          role,
          active
        FROM staff
        WHERE TRIM(access_key)=TRIM(?)
        LIMIT 1`
      )
      .bind(key)
      .first<{
        local_id: number;
        id: string;
        name: string;
        role: string;
        active: number | string | boolean;
      }>();

  if (!row || !Boolean(row.active)) {
    return response(
      {
        error:
          "スタッフURLが無効です。",
      },
      404
    );
  }

  return response({
    staffId: row.local_id,
    id: row.id,
    name: row.name,
    role: normalizeRole(row.role),
  });
}

/* =========================================================
 * Inventory
 * ========================================================= */


type InventoryNotificationSettings = {
  id: string;
  enabled: boolean;
  threshold: number;
  webhook_url: string;
};

async function getInventoryNotificationSettings(
  env: Env
): Promise<InventoryNotificationSettings> {
  const row = await env.DB.prepare(
    `SELECT id, enabled, threshold, webhook_url
     FROM inventory_notification_settings
     WHERE id='default'
     LIMIT 1`
  ).first<{
    id: string;
    enabled: number;
    threshold: number;
    webhook_url: string;
  }>();

  return {
    id: row?.id ?? "default",
    enabled: Boolean(row?.enabled),
    threshold: Math.max(0, Math.floor(Number(row?.threshold ?? 5))),
    webhook_url: String(row?.webhook_url ?? ""),
  };
}

function validWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

async function inventoryNotificationSettings(
  req: Request,
  env: Env
) {
  await ensureSchema(env.DB);

  const ctx = await auth(req, env);
  if (!ctx) return unauthorized();

  const role = normalizeRole(ctx.role);

  // GET: ログイン済みスタッフは読み取り可能。
  // POST/DELETE: 低在庫通知の変更はADMIN以上のみ。
  if (req.method !== "GET" && !MANAGEMENT_ROLES.has(role)) {
    return forbidden();
  }

  const current = await getInventoryNotificationSettings(env);

  if (req.method === "GET") {
    return response({
      enabled: current.enabled,
      threshold: current.threshold,
      webhookUrl: current.webhook_url,
      webhookConfigured: Boolean(current.webhook_url),
    });
  }

  if (req.method === "POST") {
    const body = await req.json() as {
      enabled?: unknown;
      threshold?: unknown;
      webhookUrl?: unknown;
    };

    const enabled = Boolean(body.enabled);
    const threshold = Math.max(
      0,
      Math.min(
        1000000,
        Math.floor(Number(body.threshold ?? current.threshold))
      )
    );
    const webhookUrl = String(
      body.webhookUrl ?? current.webhook_url
    ).trim();

    if (enabled && !validWebhookUrl(webhookUrl)) {
      return response(
        { error: "有効なHTTPSのWebhook URLを入力してください。" },
        400
      );
    }

    await env.DB.prepare(
      `INSERT INTO inventory_notification_settings(
        id, enabled, threshold, webhook_url
      ) VALUES('default',?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        enabled=excluded.enabled,
        threshold=excluded.threshold,
        webhook_url=excluded.webhook_url`
    ).bind(
      enabled ? 1 : 0,
      threshold,
      webhookUrl
    ).run();

    return response({
      ok: true,
      enabled,
      threshold,
      webhookUrl,
      webhookConfigured: Boolean(webhookUrl),
    });
  }

  if (req.method === "DELETE") {
    await env.DB.prepare(
      `UPDATE inventory_notification_settings
       SET enabled=0, webhook_url=''
       WHERE id='default'`
    ).run();

    return response({ ok: true });
  }

  return response(
    { error: "Method not allowed" },
    405
  );
}

async function inventoryWebhookTest(
  req: Request,
  env: Env
) {
  await ensureSchema(env.DB);

  const ctx = await auth(req, env);
  if (!ctx) return unauthorized();
  if (!MANAGEMENT_ROLES.has(normalizeRole(ctx.role))) {
    return forbidden();
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  const body = await req.json().catch(() => ({})) as {
    webhookUrl?: unknown;
  };
  const webhookUrl = String(
    body.webhookUrl ?? ""
  ).trim();

  if (!validWebhookUrl(webhookUrl)) {
    return response(
      { error: "有効なHTTPSのWebhook URLを入力してください。" },
      400
    );
  }

  const webhookResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: "K-POSのWebhook接続テストです。",
    }),
  });

  if (!webhookResponse.ok) {
    return response(
      {
        error: `Webhookへの接続に失敗しました。(${webhookResponse.status})`,
      },
      502
    );
  }

  return response({ ok: true });
}

async function sendLowStockWebhook(
  env: Env,
  productName: string,
  quantity: number
) {
  const config =
    await getInventoryNotificationSettings(env);

  if (
    !config.enabled ||
    !config.webhook_url ||
    !validWebhookUrl(config.webhook_url)
  ) {
    return false;
  }

  const webhookResponse = await fetch(
    config.webhook_url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content:
          `${productName}が残り${quantity}個になりました。`,
      }),
    }
  );

  return webhookResponse.ok;
}

async function inventory(
  req: Request,
  env: Env
) {
  await ensureSchema(env.DB);

  const ctx = await auth(req, env);
  if (!ctx) return unauthorized();

  if (req.method !== "POST") {
    return response(
      { error: "Method not allowed" },
      405
    );
  }

  const body = await req.json() as {
    action?: string;
    items?: Array<{
      productId?: unknown;
      quantity?: unknown;
    }>;
  };

  const action =
    body.action === "restore" ||
    body.action === "consume"
      ? body.action
      : null;

  if (
    !action ||
    !Array.isArray(body.items) ||
    !body.items.length
  ) {
    return response(
      { error: "在庫更新データが不正です。" },
      400
    );
  }

  // レジ会計の変更・取消・失敗時のロールバックでも
  // restore が発生するため、ログイン済みスタッフには許可する。
  // 会計履歴そのものの削除・変更権限は HISTORY_ROLES で別途管理する。

  const quantities = new Map<string, number>();

  for (const item of body.items) {
    const id = String(item.productId ?? "");
    const quantity = Math.floor(
      Number(item.quantity)
    );

    if (
      !id ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      return response(
        { error: "在庫数量が不正です。" },
        400
      );
    }

    quantities.set(
      id,
      (quantities.get(id) ?? 0) + quantity
    );
  }

  const items = [...quantities.entries()].map(
    ([productId, quantity]) => ({
      productId,
      quantity,
    })
  );

  const beforeRows = await env.DB.prepare(
    `SELECT
      id,
      name,
      inventory_quantity,
      low_stock_notified
     FROM products
     WHERE id IN(${items.map(() => "?").join(",")})`
  ).bind(
    ...items.map(item => item.productId)
  ).all<{
    id: string;
    name: string;
    inventory_quantity: number;
    low_stock_notified: number;
  }>();

  const before = new Map(
    beforeRows.results.map(row => [
      row.id,
      {
        name: row.name,
        quantity: Math.max(
          0,
          Number(row.inventory_quantity) || 0
        ),
        notified: Boolean(row.low_stock_notified),
      },
    ])
  );

  const placeholders = items
    .map(() => "(?,?)")
    .join(",");

  const values = items.flatMap(item => [
    item.productId,
    item.quantity,
  ]);

  if (action === "restore") {
    const result = await env.DB.prepare(
      `WITH requested(product_id,qty) AS(
        VALUES ${placeholders}
      ),
      totals AS(
        SELECT product_id,SUM(qty) qty
        FROM requested
        GROUP BY product_id
      )
      UPDATE products
      SET
        inventory_quantity=
          inventory_quantity+
          (SELECT qty FROM totals
           WHERE totals.product_id=products.id),
        low_stock_notified=CASE
          WHEN inventory_quantity+
            (SELECT qty FROM totals
             WHERE totals.product_id=products.id)
            > (SELECT threshold
               FROM inventory_notification_settings
               WHERE id='default')
          THEN 0
          ELSE low_stock_notified
        END
      WHERE id IN(SELECT product_id FROM totals)
      RETURNING id`
    ).bind(...values).all<{ id: string }>();

    if (result.results.length !== items.length) {
      return response(
        { error: "一部商品の在庫を復元できませんでした。" },
        409
      );
    }

    return response({ ok: true });
  }

  const result = await env.DB.prepare(
    `WITH requested(product_id,qty) AS(
      VALUES ${placeholders}
    ),
    valid AS(
      SELECT
        COUNT(*) requested_count,
        SUM(
          CASE
            WHEN p.id IS NOT NULL
              AND p.is_active=1
              AND p.inventory_quantity>=r.qty
            THEN 1
            ELSE 0
          END
        ) valid_count
      FROM requested r
      LEFT JOIN products p
        ON p.id=r.product_id
    )
    UPDATE products
    SET inventory_quantity=
      inventory_quantity-
      (SELECT qty FROM requested
       WHERE requested.product_id=products.id)
    WHERE id IN(SELECT product_id FROM requested)
    AND(SELECT requested_count=valid_count FROM valid)
    RETURNING id`
  ).bind(...values).all<{ id: string }>();

  if (result.results.length !== items.length) {
    return response(
      {
        error: "在庫が不足している商品があります。",
        failed: items.map(item => item.productId),
      },
      409
    );
  }

  const config =
    await getInventoryNotificationSettings(env);

  if (config.enabled && config.webhook_url) {
    for (const item of items) {
      const previous = before.get(item.productId);
      if (!previous) continue;

      const currentRow =
        await env.DB.prepare(
          `SELECT name, inventory_quantity, low_stock_notified
           FROM products
           WHERE id=?
           LIMIT 1`
        ).bind(item.productId).first<{
          name: string;
          inventory_quantity: number;
          low_stock_notified: number;
        }>();

      if (!currentRow) continue;

      const currentQuantity = Math.max(
        0,
        Number(currentRow.inventory_quantity) || 0
      );

      if (
        previous.quantity > config.threshold &&
        currentQuantity <= config.threshold &&
        !Boolean(currentRow.low_stock_notified)
      ) {
        try {
          const sent = await sendLowStockWebhook(
            env,
            currentRow.name,
            currentQuantity
          );

          if (sent) {
            await env.DB.prepare(
              `UPDATE products
               SET low_stock_notified=1
               WHERE id=?
                 AND inventory_quantity<=?
                 AND low_stock_notified=0`
            ).bind(
              item.productId,
              config.threshold
            ).run();
          }
        } catch (error) {
          console.error(
            "低在庫Webhookの送信に失敗しました",
            error
          );
        }
      }
    }
  }

  return response({ ok: true });
}

/* =========================================================
 * Asset routing
 * ========================================================= */

function rewrite(
  req: Request
) {
  const url = new URL(req.url);

  const match =
    url.pathname.match(
      /^\/register\/([^/]+)\/?$/
    );

  if (
    req.method === "GET" &&
    match &&
    !match[1].includes(".")
  ) {
    url.pathname =
      "/register/";

    url.searchParams.set(
      "key",
      match[1]
    );

    return new Request(
      url.toString(),
      req
    );
  }

  if (
    req.method === "GET" &&
    !url.pathname.startsWith(
      "/_next/"
    ) &&
    !url.pathname.startsWith(
      "/api/"
    ) &&
    !url.pathname.includes(".") &&
    url.pathname !== "/" &&
    !url.pathname.endsWith("/")
  ) {
    url.pathname += "/";
    return new Request(
      url.toString(),
      req
    );
  }

  return req;
}

function asset(
  responseObject: Response,
  req: Request
) {
  const headers =
    new Headers(
      responseObject.headers
    );

  const pathname =
    new URL(req.url).pathname;

  if (
    pathname === "/" ||
    pathname.endsWith("/") ||
    pathname.endsWith(".html")
  ) {
    headers.set(
      "Cache-Control",
      "no-store, max-age=0, must-revalidate"
    );

    headers.set(
      "CDN-Cache-Control",
      "no-store"
    );

    headers.set(
      "Pragma",
      "no-cache"
    );
  }

  if (
    pathname.startsWith(
      "/_next/static/"
    )
  ) {
    headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable"
    );
  }

  return new Response(
    responseObject.body,
    {
      status:
        responseObject.status,
      statusText:
        responseObject.statusText,
      headers,
    }
  );
}

/* =========================================================
 * Worker entry
 * ========================================================= */

export default {
  async fetch(
    req: Request,
    env: Env
  ) {
    try {
      const pathname =
        new URL(req.url).pathname;

      if (
        pathname.startsWith(
          "/api/db/"
        )
      ) {
        return handleDb(
          req,
          env
        );
      }

      if (
        pathname ===
        "/api/inventory"
      ) {
        return inventory(
          req,
          env
        );
      }

      if (
        pathname ===
        "/api/inventory/settings"
      ) {
        return inventoryNotificationSettings(
          req,
          env
        );
      }

      if (
        pathname ===
        "/api/inventory/webhook-test"
      ) {
        return inventoryWebhookTest(
          req,
          env
        );
      }

      if (
        pathname ===
          "/api/auth/login" &&
        req.method === "POST"
      ) {
        return login(
          req,
          env
        );
      }

      if (
        pathname ===
          "/api/auth/status" &&
        req.method === "GET"
      ) {
        return staffPasswordStatus(
          req,
          env
        );
      }

      if (
        pathname ===
          "/api/auth/password" &&
        req.method === "POST"
      ) {
        return setPassword(
          req,
          env
        );
      }

      if (
        pathname ===
        "/api/staff/access-key"
      ) {
        return staffAccess(
          req,
          env
        );
      }

      if (
        pathname ===
        "/api/staff/by-key"
      ) {
        return staffByKey(
          req,
          env
        );
      }

      return asset(
        await env.ASSETS.fetch(
          rewrite(req)
        ),
        req
      );
    } catch (error) {
      console.error(
        "K-POS worker error",
        error
      );

      return response(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unknown error",
        },
        500
      );
    }
  },
};
