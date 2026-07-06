import { DEFAULT_POLICY_MATRIX } from './auth.constants';

describe('auth constants', () => {
  it('grants session audit view to manager, auditor, security analyst, and admin roles', () => {
    for (const role of ['Manager', 'Auditor', 'SecurityAnalyst', 'Admin'] as const) {
      expect(DEFAULT_POLICY_MATRIX[role]).toContain('session-audit.view');
    }
  });

  it('does not grant session audit view to employee or technical staff roles', () => {
    expect(DEFAULT_POLICY_MATRIX.Employee).not.toContain('session-audit.view');
    expect(DEFAULT_POLICY_MATRIX.TechnicalStaff).not.toContain('session-audit.view');
  });
});
