import { Database } from '../db/database.js';

interface ConfigScope {
  enterpriseId: string;
  propertyId?: string;
  rvcId?: string;
  workstationId?: string;
}

interface OptionFlagRow {
  id: string;
  enterprise_id: string;
  entity_type: string;
  entity_id: string;
  option_key: string;
  value_text: string | null;
  scope_level: string;
  scope_id: string;
}

const SCOPE_PRIORITY: Record<string, number> = {
  workstation: 4,
  rvc: 3,
  property: 2,
  enterprise: 1,
};

export class LocalEffectiveConfig {
  private db: Database;
  private scope: ConfigScope;
  private cache: Map<string, OptionFlagRow[]> = new Map();
  private loaded = false;

  constructor(db: Database, scope: ConfigScope) {
    this.db = db;
    this.scope = scope;
  }

  private loadFlags(): void {
    if (this.loaded) return;

    const scopeIds: string[] = [this.scope.enterpriseId];
    if (this.scope.propertyId) scopeIds.push(this.scope.propertyId);
    if (this.scope.rvcId) scopeIds.push(this.scope.rvcId);
    if (this.scope.workstationId) scopeIds.push(this.scope.workstationId);

    const placeholders = scopeIds.map(() => '?').join(',');
    const rows = this.db.all<OptionFlagRow>(
      `SELECT * FROM emc_option_flags 
       WHERE enterprise_id = ? AND scope_id IN (${placeholders})`,
      [this.scope.enterpriseId, ...scopeIds]
    );

    for (const row of rows) {
      const cacheKey = `${row.entity_type}:${row.entity_id}:${row.option_key}`;
      if (!this.cache.has(cacheKey)) {
        this.cache.set(cacheKey, []);
      }
      this.cache.get(cacheKey)!.push(row);
    }

    this.loaded = true;
  }

  private resolve(entityType: string, entityId: string, key: string): string | null {
    this.loadFlags();

    const cacheKey = `${entityType}:${entityId}:${key}`;
    const rows = this.cache.get(cacheKey);
    if (!rows || rows.length === 0) return null;

    let best: OptionFlagRow | null = null;
    let bestPriority = -1;

    for (const row of rows) {
      const priority = SCOPE_PRIORITY[row.scope_level] ?? 0;
      if (priority > bestPriority) {
        if (this.scopeMatches(row.scope_level, row.scope_id)) {
          best = row;
          bestPriority = priority;
        }
      }
    }

    return best?.value_text ?? null;
  }

  private scopeMatches(scopeLevel: string, scopeId: string): boolean {
    switch (scopeLevel) {
      case 'enterprise':
        return scopeId === this.scope.enterpriseId;
      case 'property':
        return scopeId === this.scope.propertyId;
      case 'rvc':
        return scopeId === this.scope.rvcId;
      case 'workstation':
        return scopeId === this.scope.workstationId;
      default:
        return false;
    }
  }

  getBool(entityType: string, entityId: string, key: string, fallback: boolean = false): boolean {
    const val = this.resolve(entityType, entityId, key);
    if (val === null) return fallback;
    return val === 'true' || val === '1';
  }

  getText(entityType: string, entityId: string, key: string, fallback: string = ''): string {
    const val = this.resolve(entityType, entityId, key);
    return val ?? fallback;
  }

  getInt(entityType: string, entityId: string, key: string, fallback: number = 0): number {
    const val = this.resolve(entityType, entityId, key);
    if (val === null) return fallback;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? fallback : parsed;
  }

  getAllForEntity(entityType: string, entityId: string): Record<string, string> {
    this.loadFlags();

    const result: Record<string, string> = {};
    const resolved: Record<string, { value: string; priority: number }> = {};

    for (const [cacheKey, rows] of this.cache.entries()) {
      const prefix = `${entityType}:${entityId}:`;
      if (!cacheKey.startsWith(prefix)) continue;

      const optionKey = cacheKey.slice(prefix.length);
      for (const row of rows) {
        const priority = SCOPE_PRIORITY[row.scope_level] ?? 0;
        if (this.scopeMatches(row.scope_level, row.scope_id)) {
          if (!resolved[optionKey] || priority > resolved[optionKey].priority) {
            resolved[optionKey] = { value: row.value_text ?? '', priority };
          }
        }
      }
    }

    for (const [key, entry] of Object.entries(resolved)) {
      result[key] = entry.value;
    }

    return result;
  }

  invalidateCache(): void {
    this.cache.clear();
    this.loaded = false;
  }
}

export type { ConfigScope };
