import {
  type ScopeChain,
  type OptionRow,
  loadOptionBitsBatch,
  resolveOption,
  resolveOptionBool,
  resolveOptionInt,
  resolveOptionText,
} from "./optionBits";

export class EffectiveConfig {
  private rows: OptionRow[];
  private scope: ScopeChain;

  private constructor(rows: OptionRow[], scope: ScopeChain) {
    this.rows = rows;
    this.scope = scope;
  }

  static async load(scope: ScopeChain): Promise<EffectiveConfig> {
    const rows = await loadOptionBitsBatch(scope);
    return new EffectiveConfig(rows, scope);
  }

  getBool(entityType: string, entityId: string, key: string, fallback?: boolean): boolean | undefined {
    return resolveOptionBool(this.rows, entityType, entityId, key, fallback);
  }

  getText(entityType: string, entityId: string, key: string, fallback?: string): string | undefined {
    return resolveOptionText(this.rows, entityType, entityId, key, fallback);
  }

  getInt(entityType: string, entityId: string, key: string, fallback?: number): number | undefined {
    return resolveOptionInt(this.rows, entityType, entityId, key, fallback);
  }

  getRaw(entityType: string, entityId: string, key: string): string | null {
    return resolveOption(this.rows, entityType, entityId, key);
  }

  getAllForEntity(entityType: string, entityId: string): Record<string, string | null> {
    const result: Record<string, string | null> = {};
    const entityRows = this.rows.filter(
      (r) => r.entityType === entityType && r.entityId === entityId
    );
    const resolved = new Map<string, { value: string | null; precedence: number }>();
    for (const row of entityRows) {
      const p = ({ workstation: 4, rvc: 3, property: 2, enterprise: 1 } as Record<string, number>)[row.scopeLevel] || 0;
      const existing = resolved.get(row.optionKey);
      if (!existing || p > existing.precedence) {
        resolved.set(row.optionKey, { value: row.valueText, precedence: p });
      }
    }
    resolved.forEach(({ value }, key) => {
      result[key] = value;
    });
    return result;
  }

  getScope(): ScopeChain {
    return this.scope;
  }

  getRawRows(): OptionRow[] {
    return this.rows;
  }
}
