import { QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

const PERMISSION = 'session-audit.view';
const ROLES = ['Manager', 'Auditor', 'SecurityAnalyst'];

export const up: MigrationFn<QueryInterface> = async ({ context }) => {
  for (const role of ROLES) {
    await context.sequelize.query(
      `
      INSERT INTO access_policies (role, permissions, "createdAt", "updatedAt")
      VALUES (:role, jsonb_build_array(:permission), NOW(), NOW())
      ON CONFLICT (role) DO NOTHING
      `,
      { replacements: { permission: PERMISSION, role } },
    );

    await context.sequelize.query(
      `
      UPDATE access_policies
      SET permissions = permissions || jsonb_build_array(:permission),
          "updatedAt" = NOW()
      WHERE role = :role
        AND NOT permissions @> jsonb_build_array(:permission)
      `,
      { replacements: { permission: PERMISSION, role } },
    );
  }
};

export const down: MigrationFn<QueryInterface> = async ({ context }) => {
  for (const role of ROLES) {
    await context.sequelize.query(
      `
      UPDATE access_policies
      SET permissions = COALESCE(
          (
            SELECT jsonb_agg(value)
            FROM jsonb_array_elements(permissions) AS value
            WHERE value <> to_jsonb(CAST(:permission AS text))
          ),
          '[]'::jsonb
        ),
        "updatedAt" = NOW()
      WHERE role = :role
      `,
      { replacements: { permission: PERMISSION, role } },
    );
  }
};
