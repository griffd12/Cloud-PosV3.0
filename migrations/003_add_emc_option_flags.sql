-- Migration: Add emc_option_flags table for generic OptionBits system
-- Purpose: Configuration-driven behavioral flags with scope-based inheritance
-- Date: 2026-02-23
-- Phase: OptionBits infrastructure

CREATE TABLE IF NOT EXISTS emc_option_flags (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id varchar NOT NULL REFERENCES enterprises(id),
  entity_type text NOT NULL,
  entity_id varchar NOT NULL,
  option_key text NOT NULL,
  value_text text,
  scope_level text NOT NULL CHECK (scope_level IN ('enterprise', 'property', 'rvc', 'workstation')),
  scope_id varchar NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_emc_option_flags_unique
  ON emc_option_flags (enterprise_id, entity_type, entity_id, option_key, scope_level, scope_id);

CREATE INDEX IF NOT EXISTS idx_emc_option_flags_entity
  ON emc_option_flags (enterprise_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_emc_option_flags_key
  ON emc_option_flags (enterprise_id, option_key);
