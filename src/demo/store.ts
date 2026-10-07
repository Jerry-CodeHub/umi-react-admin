/**
 * 演示数据库：生成数据 + 用户改动（补丁）。
 *
 * 持久化只存「补丁」（新建 / 修改 / 删除），不存整份数据：每次打开都按今天重新生成，
 * 数据永远新鲜；用户做过的改动按记录 ID 叠加回去，带着它们真实发生的时间。
 * 补丁存储键带版本号：生成规则或数据结构变化时升级 STORE_VERSION，旧补丁整体作废，
 * 老访客不会带着过期结构的缓存看到错乱数据。
 */
import { generateDataset, type Dataset, type DemoLocale } from './generate';

export const STORE_VERSION = 2;
export const STORE_KEY = `umi-react-admin:demo-store:v${STORE_VERSION}`;
/** 历史版本遗留的存储键（加载时顺手清理） */
const LEGACY_KEYS = ['umi-react-admin-demo-users', 'umi-react-admin:demo-store:v1'];

export type CollectionName = 'users' | 'roles' | 'tickets' | 'alarms' | 'logs' | 'events';
const COLLECTIONS: CollectionName[] = ['users', 'roles', 'tickets', 'alarms', 'logs', 'events'];
type Entity = { id: string };

type CollectionPatch = {
  created: Entity[];
  updated: Record<string, Record<string, unknown>>;
  deleted: string[];
};
type Patches = Partial<Record<CollectionName, CollectionPatch>>;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const emptyPatch = (): CollectionPatch => ({ created: [], updated: {}, deleted: [] });

/**
 * 字段为 undefined 表示「清除该字段」（如工单退回处理中要清掉完成时间）。
 * JSON 会丢掉 undefined，所以补丁里记成 null，应用补丁时 null 同样视为删除。
 */
const applyChanges = (target: Record<string, unknown>, changes: Record<string, unknown>) => {
  Object.entries(changes).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      delete target[key];
    } else {
      target[key] = value;
    }
  });
};
const toPatchValues = (changes: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value === undefined ? null : value]));

export class DemoStore {
  private data!: Dataset;
  private patches: Patches = {};

  constructor(private readonly options: { storage?: StorageLike; now?: () => Date; locale: DemoLocale }) {
    this.patches = this.readPatches();
    this.rebuild();
  }

  get dataset(): Dataset {
    return this.data;
  }

  now(): Date {
    return this.options.now?.() ?? new Date();
  }

  /** 新建记录（放在集合最前面，与列表默认的倒序一致） */
  create<K extends CollectionName>(name: K, record: Dataset[K][number]) {
    this.list(name).unshift(record as never);
    this.patchOf(name).created.unshift(record as Entity);
    this.persist();
    return record;
  }

  update<K extends CollectionName>(
    name: K,
    id: string,
    changes: Partial<Dataset[K][number]>,
  ): Dataset[K][number] | undefined {
    const record = this.list(name).find((item) => item.id === id) as Dataset[K][number] | undefined;
    if (!record) {
      return undefined;
    }
    const values = changes as Record<string, unknown>;
    applyChanges(record as Record<string, unknown>, values);
    const patch = this.patchOf(name);
    const created = patch.created.find((item) => item.id === id);
    if (created) {
      applyChanges(created as Record<string, unknown>, values);
    } else {
      patch.updated[id] = { ...patch.updated[id], ...toPatchValues(values) };
    }
    this.persist();
    return record;
  }

  remove(name: CollectionName, id: string) {
    const list = this.list(name);
    const index = list.findIndex((item) => item.id === id);
    if (index < 0) {
      return false;
    }
    list.splice(index, 1);
    const patch = this.patchOf(name);
    const createdIndex = patch.created.findIndex((item) => item.id === id);
    if (createdIndex >= 0) {
      patch.created.splice(createdIndex, 1);
    } else {
      delete patch.updated[id];
      patch.deleted.push(id);
    }
    this.persist();
    return true;
  }

  /** 清空改动，回到初始演示数据 */
  reset() {
    this.patches = {};
    try {
      this.options.storage?.removeItem(STORE_KEY);
    } catch {
      // 存储不可用时只重置内存
    }
    this.rebuild();
  }

  private list(name: CollectionName): Entity[] {
    return this.data[name] as unknown as Entity[];
  }

  private patchOf(name: CollectionName) {
    this.patches[name] ??= emptyPatch();
    return this.patches[name]!;
  }

  private rebuild() {
    this.data = generateDataset({ now: this.now(), locale: this.options.locale });
    (Object.keys(this.patches) as CollectionName[]).forEach((name) => {
      const patch = this.patches[name]!;
      const deleted = new Set(patch.deleted);
      const list = this.list(name).filter((item) => !deleted.has(item.id));
      list.forEach((item) => {
        if (patch.updated[item.id]) {
          applyChanges(item as Record<string, unknown>, patch.updated[item.id]);
        }
      });
      const existing = new Set(list.map((item) => item.id));
      // 新建记录按原样放回（结构化克隆，避免补丁与内存记录共享引用）
      const created = patch.created.filter((item) => !existing.has(item.id)).map((item) => structuredClone(item));
      (this.data[name] as unknown as Entity[]) = [...created, ...list];
    });
  }

  private readPatches(): Patches {
    const storage = this.options.storage;
    if (!storage) {
      return {};
    }
    try {
      LEGACY_KEYS.forEach((key) => storage.removeItem(key));
      const raw = storage.getItem(STORE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, Partial<CollectionPatch>>) : {};
      // 逐个集合校验形状，不对的（手改、损坏）直接丢弃，回落到干净的演示数据
      const patches: Patches = {};
      COLLECTIONS.forEach((name) => {
        const patch = parsed?.[name];
        if (
          patch &&
          Array.isArray(patch.created) &&
          patch.created.every((item) => typeof item?.id === 'string') &&
          Array.isArray(patch.deleted) &&
          patch.updated &&
          typeof patch.updated === 'object'
        ) {
          patches[name] = patch as CollectionPatch;
        }
      });
      return patches;
    } catch {
      return {};
    }
  }

  private persist() {
    try {
      this.options.storage?.setItem(STORE_KEY, JSON.stringify(this.patches));
    } catch {
      // 配额满 / 隐私模式：改动只在本次会话内有效
    }
  }
}
