import { db } from "../db";
import { emcOptionFlags } from "@shared/schema";
import { and, eq, or, sql } from "drizzle-orm";

export interface ScopeChain {
  enterpriseId: string;
  propertyId?: string;
  rvcId?: string;
  workstationId?: string;
}

export interface OptionRow {
  entityType: string;
  entityId: string;
  optionKey: string;
  valueText: string | null;
  scopeLevel: string;
  scopeId: string;
}

const SCOPE_PRECEDENCE: Record<string, number> = {
  workstation: 4,
  rvc: 3,
  property: 2,
  enterprise: 1,
};

const cache = new Map<string, { rows: OptionRow[]; loadedAt: number }>();
const CACHE_TTL_MS = 60_000;

function cacheKey(scope: ScopeChain): string {
  return `${scope.enterpriseId}|${scope.propertyId || ""}|${scope.rvcId || ""}|${scope.workstationId || ""}`;
}

export function bustOptionBitsCache(scope?: ScopeChain): void {
  if (scope) {
    cache.delete(cacheKey(scope));
  } else {
    cache.clear();
  }
}

export async function loadOptionBitsBatch(scope: ScopeChain): Promise<OptionRow[]> {
  const key = cacheKey(scope);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.rows;
  }

  const scopeConditions = [
    and(
      eq(emcOptionFlags.scopeLevel, "enterprise"),
      eq(emcOptionFlags.scopeId, scope.enterpriseId)
    ),
  ];

  if (scope.propertyId) {
    scopeConditions.push(
      and(
        eq(emcOptionFlags.scopeLevel, "property"),
        eq(emcOptionFlags.scopeId, scope.propertyId)
      )
    );
  }

  if (scope.rvcId) {
    scopeConditions.push(
      and(
        eq(emcOptionFlags.scopeLevel, "rvc"),
        eq(emcOptionFlags.scopeId, scope.rvcId)
      )
    );
  }

  if (scope.workstationId) {
    scopeConditions.push(
      and(
        eq(emcOptionFlags.scopeLevel, "workstation"),
        eq(emcOptionFlags.scopeId, scope.workstationId)
      )
    );
  }

  const rows = await db
    .select({
      entityType: emcOptionFlags.entityType,
      entityId: emcOptionFlags.entityId,
      optionKey: emcOptionFlags.optionKey,
      valueText: emcOptionFlags.valueText,
      scopeLevel: emcOptionFlags.scopeLevel,
      scopeId: emcOptionFlags.scopeId,
    })
    .from(emcOptionFlags)
    .where(
      and(
        eq(emcOptionFlags.enterpriseId, scope.enterpriseId),
        or(...scopeConditions)
      )
    );

  cache.set(key, { rows, loadedAt: Date.now() });
  return rows;
}

export function resolveOption(
  rows: OptionRow[],
  entityType: string,
  entityId: string,
  optionKey: string
): string | null {
  const matches = rows.filter(
    (r) =>
      r.entityType === entityType &&
      r.entityId === entityId &&
      r.optionKey === optionKey
  );

  if (matches.length === 0) return null;

  matches.sort(
    (a, b) =>
      (SCOPE_PRECEDENCE[b.scopeLevel] || 0) -
      (SCOPE_PRECEDENCE[a.scopeLevel] || 0)
  );

  return matches[0].valueText;
}

export function resolveOptionBool(
  rows: OptionRow[],
  entityType: string,
  entityId: string,
  optionKey: string,
  fallback?: boolean
): boolean | undefined {
  const val = resolveOption(rows, entityType, entityId, optionKey);
  if (val === null) return fallback;
  return val === "true" || val === "1";
}

export function resolveOptionInt(
  rows: OptionRow[],
  entityType: string,
  entityId: string,
  optionKey: string,
  fallback?: number
): number | undefined {
  const val = resolveOption(rows, entityType, entityId, optionKey);
  if (val === null) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

export function resolveOptionText(
  rows: OptionRow[],
  entityType: string,
  entityId: string,
  optionKey: string,
  fallback?: string
): string | undefined {
  const val = resolveOption(rows, entityType, entityId, optionKey);
  return val ?? fallback;
}
