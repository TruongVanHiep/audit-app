/**
 * lib.mjs — Lớp helper mỏng bọc quanh Directus REST API.
 *
 * Vì sao viết tay bằng fetch thay vì dùng @directus/sdk?
 * - Không cần cài dependency (Node 18+ đã có sẵn fetch toàn cục).
 * - Bạn nhìn thẳng vào HTTP request thật -> hiểu Directus API làm gì,
 *   thay vì bị SDK che mất. Khi lên dự án thật, phần app mobile sẽ dùng SDK,
 *   nhưng phần quản trị schema như thế này thì REST trực tiếp rõ ràng hơn.
 *
 * Mọi hàm create* ở đây đều IDEMPOTENT: chạy lại lần 2, 3, n lần đều an toàn,
 * cái gì đã tồn tại thì bỏ qua. Đây là tính chất bắt buộc của script migration.
 */

export const DIRECTUS_URL =
  process.env.DIRECTUS_URL ?? 'http://localhost:8055';
export const ADMIN_EMAIL =
  process.env.DIRECTUS_ADMIN_EMAIL ?? 'admin@example.com';
export const ADMIN_PASSWORD =
  process.env.DIRECTUS_ADMIN_PASSWORD ?? 'Password123!';

let accessToken = null;

/** Đăng nhập bằng tài khoản admin, lấy access token và nhớ lại cho các call sau. */
export async function login() {
  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(
      `Đăng nhập thất bại (${res.status}). Directus đã chạy chưa? ` +
        `Thử: docker compose up -d`,
    );
  }
  const body = await res.json();
  accessToken = body.data.access_token;
  return accessToken;
}

/**
 * Gọi Directus API.
 * @param {string} path   ví dụ '/collections'
 * @param {object} init   { method, body, ... } — body là object thường, sẽ tự JSON.stringify
 * @returns {Promise<any>} phần `data` của response, hoặc null nếu 204 No Content
 */
export async function api(path, init = {}) {
  const { body, headers, ...rest } = init;
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return null;

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status}\n${text}`);
  }

  if (!res.ok) {
    const msg = parsed?.errors?.map((e) => e.message).join('; ') ?? text;
    const err = new Error(`${init.method ?? 'GET'} ${path} -> ${res.status}: ${msg}`);
    err.status = res.status;
    err.errors = parsed?.errors;
    throw err;
  }
  return parsed?.data ?? null;
}

/* ------------------------------------------------------------------ */
/* Helper in log cho dễ nhìn                                           */
/* ------------------------------------------------------------------ */

export const log = {
  step: (m) => console.log(`\n\x1b[1m\x1b[36m${m}\x1b[0m`),
  ok: (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`),
  skip: (m) => console.log(`  \x1b[90m•\x1b[0m ${m} \x1b[90m(đã có, bỏ qua)\x1b[0m`),
  warn: (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`),
  info: (m) => console.log(`  \x1b[90m${m}\x1b[0m`),
};

/* ------------------------------------------------------------------ */
/* Collections / Fields / Relations                                    */
/* ------------------------------------------------------------------ */

/** Trả về Set tên tất cả collection đang có. */
export async function listCollections() {
  const data = await api('/collections?limit=-1');
  return new Set(data.map((c) => c.collection));
}

/** Trả về Set tên các field của một collection. */
export async function listFields(collection) {
  try {
    const data = await api(`/fields/${collection}`);
    return new Set(data.map((f) => f.field));
  } catch (e) {
    if (e.status === 403 || e.status === 404) return new Set();
    throw e;
  }
}

/** Trả về Set khoá "collection.field" của tất cả relation đang có. */
export async function listRelations() {
  const data = await api('/relations?limit=-1');
  return new Set(data.map((r) => `${r.collection}.${r.field}`));
}

/**
 * Tạo collection với khoá chính UUID.
 * Dùng UUID thay vì số tự tăng vì app mobile cần tạo được bản ghi khi offline
 * (sinh id ngay trên máy) rồi mới đồng bộ lên server sau.
 */
export async function createCollection(collection, meta = {}, existing) {
  if (existing?.has(collection)) {
    log.skip(`collection ${collection}`);
    return;
  }
  await api('/collections', {
    method: 'POST',
    body: {
      collection,
      schema: { name: collection },
      meta: {
        singleton: false,
        archive_field: null,
        sort_field: null,
        ...meta,
      },
      fields: [
        {
          field: 'id',
          type: 'uuid',
          meta: {
            hidden: true,
            readonly: true,
            interface: 'input',
            special: ['uuid'],
          },
          schema: { is_primary_key: true, length: 36, has_auto_increment: false },
        },
      ],
    },
  });
  existing?.add(collection);
  log.ok(`collection ${collection}`);
}

/**
 * Tạo một field thường (không phải quan hệ).
 * @param {string} collection
 * @param {string} field
 * @param {string} type    'string' | 'text' | 'integer' | 'float' | 'boolean' | 'date' | 'timestamp' | 'json' ...
 * @param {object} opts    { meta, schema }
 */
export async function createField(collection, field, type, opts = {}, existingFields) {
  if (existingFields?.has(field)) {
    log.skip(`${collection}.${field}`);
    return;
  }
  await api(`/fields/${collection}`, {
    method: 'POST',
    body: {
      field,
      type,
      meta: { interface: 'input', ...opts.meta },
      schema: { ...opts.schema },
    },
  });
  existingFields?.add(field);
  log.ok(`${collection}.${field} (${type})`);
}

/**
 * Tạo quan hệ Many-to-One: nhiều bản ghi `collection` trỏ tới 1 bản ghi `related`.
 * Ví dụ: nhiều `audits` thuộc về 1 `stores`.
 *
 * Directus cần 2 bước:
 *   1) tạo field khoá ngoại trên bảng "many" (ở đây là cột uuid)
 *   2) khai báo relation để Directus biết cột đó trỏ đi đâu
 *
 * @param {object} o
 * @param {string} o.collection   bảng "many"  (vd 'audits')
 * @param {string} o.field        tên cột FK   (vd 'store')
 * @param {string} o.related      bảng "one"   (vd 'stores')
 * @param {string} [o.oneField]   nếu đặt, tạo luôn field ngược O2M bên bảng "one"
 * @param {string} [o.onDelete]   'SET NULL' | 'CASCADE' | 'NO ACTION'
 * @param {string} [o.relatedPkType] 'uuid' (mặc định) hoặc 'integer'
 */
export async function createM2O(o, existingFields, existingRelations) {
  const {
    collection,
    field,
    related,
    oneField = null,
    onDelete = 'SET NULL',
    relatedPkType = 'uuid',
    required = false,
    note = null,
    width = 'half',
  } = o;

  // Bước 1: cột khoá ngoại
  if (existingFields?.has(field)) {
    log.skip(`${collection}.${field}`);
  } else {
    await api(`/fields/${collection}`, {
      method: 'POST',
      body: {
        field,
        type: relatedPkType,
        meta: {
          interface: 'select-dropdown-m2o',
          special: ['m2o'],
          required,
          note,
          width,
          options: { enableCreate: false },
        },
        schema: { is_nullable: !required },
      },
    });
    existingFields?.add(field);
    log.ok(`${collection}.${field} -> ${related} (M2O)`);
  }

  // Bước 1b: field ảo phía "one" để xem danh sách ngược lại
  if (oneField) {
    const relatedFields = await listFields(related);
    if (!relatedFields.has(oneField)) {
      await api(`/fields/${related}`, {
        method: 'POST',
        body: {
          field: oneField,
          type: 'alias',
          meta: { interface: 'list-o2m', special: ['o2m'] },
        },
      });
      log.ok(`${related}.${oneField} <- ${collection} (O2M ngược)`);
    }
  }

  // Bước 2: khai báo relation
  const relKey = `${collection}.${field}`;
  if (existingRelations?.has(relKey)) {
    log.skip(`relation ${relKey}`);
    return;
  }
  await api('/relations', {
    method: 'POST',
    body: {
      collection,
      field,
      related_collection: related,
      meta: { one_field: oneField, sort_field: null, one_deselect_action: 'nullify' },
      schema: { on_delete: onDelete },
    },
  });
  existingRelations?.add(relKey);
  log.ok(`relation ${relKey} -> ${related}`);
}

/**
 * Tạo quan hệ Many-to-Many tới directus_files (tức là "một danh sách ảnh").
 * Directus lưu M2M bằng một bảng trung gian (junction). Ví dụ:
 *
 *   audit_answers  ──<  audit_answers_files  >──  directus_files
 *
 * @param {string} collection  bảng gốc, vd 'audit_answers'
 * @param {string} field       tên field ảnh, vd 'photos'
 */
export async function createFilesM2M(collection, field, existingCollections, existingRelations) {
  const junction = `${collection}_${field}`;

  // 1. Bảng trung gian (id tự tăng cho gọn, không cần uuid)
  if (existingCollections?.has(junction)) {
    log.skip(`junction ${junction}`);
  } else {
    await api('/collections', {
      method: 'POST',
      body: {
        collection: junction,
        schema: { name: junction },
        meta: { hidden: true, icon: 'import_export' },
        fields: [
          {
            field: 'id',
            type: 'integer',
            meta: { hidden: true, interface: 'input' },
            schema: { is_primary_key: true, has_auto_increment: true },
          },
        ],
      },
    });
    existingCollections?.add(junction);
    log.ok(`junction ${junction}`);
  }

  const junctionFields = await listFields(junction);

  // 2. Hai cột khoá ngoại trên bảng trung gian
  if (!junctionFields.has(`${collection}_id`)) {
    await api(`/fields/${junction}`, {
      method: 'POST',
      body: {
        field: `${collection}_id`,
        type: 'uuid',
        meta: { hidden: true, special: ['m2o'] },
        schema: { is_nullable: true },
      },
    });
  }
  if (!junctionFields.has('directus_files_id')) {
    await api(`/fields/${junction}`, {
      method: 'POST',
      body: {
        field: 'directus_files_id',
        type: 'uuid',
        meta: { hidden: true, special: ['m2o'] },
        schema: { is_nullable: true },
      },
    });
  }

  // 3. Field ảo trên bảng gốc — cái mà người dùng thực sự nhìn thấy
  const baseFields = await listFields(collection);
  if (!baseFields.has(field)) {
    await api(`/fields/${collection}`, {
      method: 'POST',
      body: {
        field,
        type: 'alias',
        meta: {
          interface: 'files',
          special: ['files'],
          note: 'Ảnh bằng chứng',
        },
      },
    });
    log.ok(`${collection}.${field} (danh sách ảnh)`);
  }

  // 4. Hai relation nối bảng trung gian với 2 đầu
  if (!existingRelations?.has(`${junction}.${collection}_id`)) {
    await api('/relations', {
      method: 'POST',
      body: {
        collection: junction,
        field: `${collection}_id`,
        related_collection: collection,
        meta: { one_field: field, junction_field: 'directus_files_id', sort_field: null },
        schema: { on_delete: 'CASCADE' },
      },
    });
    existingRelations?.add(`${junction}.${collection}_id`);
  }
  if (!existingRelations?.has(`${junction}.directus_files_id`)) {
    await api('/relations', {
      method: 'POST',
      body: {
        collection: junction,
        field: 'directus_files_id',
        related_collection: 'directus_files',
        meta: { one_field: null, junction_field: `${collection}_id`, sort_field: null },
        schema: { on_delete: 'CASCADE' },
      },
    });
    existingRelations?.add(`${junction}.directus_files_id`);
  }
  log.ok(`M2M ${collection}.${field} <-> directus_files`);
}

/* ------------------------------------------------------------------ */
/* Shorthand cho các kiểu field hay dùng                               */
/* ------------------------------------------------------------------ */

/** Dropdown chọn 1 giá trị từ danh sách cố định. */
export const dropdown = (choices, { defaultValue = null, required = false, width = 'half', note = null } = {}) => ({
  meta: {
    interface: 'select-dropdown',
    options: { choices: choices.map(([value, text]) => ({ value, text })) },
    required,
    width,
    note,
  },
  schema: { default_value: defaultValue, is_nullable: !required },
});

/** Ô nhập chữ 1 dòng. */
export const text1 = ({ required = false, width = 'half', note = null, unique = false, placeholder = null } = {}) => ({
  meta: { interface: 'input', required, width, note, options: placeholder ? { placeholder } : {} },
  schema: { is_nullable: !required, is_unique: unique },
});

/** Ô nhập nhiều dòng. */
export const textMulti = ({ note = null, width = 'full' } = {}) => ({
  meta: { interface: 'input-multiline', width, note },
  schema: { is_nullable: true },
});

/** Số. */
export const num = ({ defaultValue = null, note = null, width = 'half', required = false } = {}) => ({
  meta: { interface: 'input', required, width, note },
  schema: { default_value: defaultValue, is_nullable: !required },
});

/** Công tắc bật/tắt. */
export const toggle = ({ defaultValue = false, note = null, width = 'half' } = {}) => ({
  meta: { interface: 'boolean', width, note },
  schema: { default_value: defaultValue, is_nullable: false },
});

/** Mốc thời gian do hệ thống hoặc app ghi. */
export const timestamp = ({ note = null, width = 'half', readonly = false } = {}) => ({
  meta: { interface: 'datetime', width, note, readonly },
  schema: { is_nullable: true },
});
