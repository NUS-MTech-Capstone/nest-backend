import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessProductionAudit,
  createPublishedAuditReport,
} from './audit-policy.mjs';

function acceptedReport() {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      umzug: { severity: 'moderate', via: ['@rushstack/ts-command-line'] },
      '@rushstack/ts-command-line': {
        severity: 'moderate',
        via: ['argparse'],
      },
      argparse: { severity: 'moderate', via: ['sprintf-js'] },
      'sprintf-js': {
        severity: 'moderate',
        via: [
          {
            url: 'https://github.com/advisories/GHSA-hp3w-g68c-fv3c',
          },
        ],
      },
    },
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 4,
        high: 0,
        critical: 0,
        total: 4,
      },
      dependencies: { prod: 233 },
    },
  };
}

test('accepts the exact Umzug moderate vulnerability chain', () => {
  assert.deepEqual(assessProductionAudit(acceptedReport(), new Date('2026-10-13')), {
    ok: true,
    errors: [],
  });
});

test('accepts a clean production audit report', () => {
  assert.deepEqual(assessProductionAudit({ auditReportVersion: 2, vulnerabilities: {} }), {
    ok: true,
    errors: [],
  });
});

test('retains native findings and counts in the published report', () => {
  const report = acceptedReport();
  const published = createPublishedAuditReport(report);
  assert.deepEqual(published.vulnerabilities, report.vulnerabilities);
  assert.deepEqual(published.metadata, report.metadata);
  assert.equal(published.auditPolicy.acceptedAdvisories[0].reviewBy, '2026-11-07');
});

test('rejects expired exception and an additional advisory on the accepted package', () => {
  assert.equal(assessProductionAudit(acceptedReport(), new Date('2026-11-07')).ok, false);
  const report = acceptedReport();
  report.vulnerabilities['sprintf-js'].via.push({ url: 'https://example.invalid/unreviewed' });
  assert.equal(assessProductionAudit(report, new Date('2026-10-13')).ok, false);
});

test('rejects scanner-error and unsupported report formats', () => {
  assert.equal(assessProductionAudit({ ...acceptedReport(), error: { code: 'ENETUNREACH' } }).ok, false);
  assert.equal(assessProductionAudit({ ...acceptedReport(), auditReportVersion: 1 }).ok, false);
});

test('rejects an unexpected moderate vulnerability', () => {
  const report = acceptedReport();
  report.vulnerabilities.other = { severity: 'moderate', via: [] };

  const assessment = assessProductionAudit(report, new Date('2026-10-13'));

  assert.equal(assessment.ok, false);
  assert.match(
    assessment.errors.join('\n'),
    /unexpected moderate vulnerability: other/,
  );
});

test('rejects a high vulnerability in the accepted chain', () => {
  const report = acceptedReport();
  report.vulnerabilities.umzug.severity = 'high';

  const assessment = assessProductionAudit(report, new Date('2026-10-13'));

  assert.equal(assessment.ok, false);
  assert.match(assessment.errors.join('\n'), /changed severity to high/);
});

test('rejects malformed audit output', () => {
  const assessment = assessProductionAudit({ metadata: {} });

  assert.equal(assessment.ok, false);
  assert.match(
    assessment.errors.join('\n'),
    /missing a vulnerabilities object/,
  );
});
