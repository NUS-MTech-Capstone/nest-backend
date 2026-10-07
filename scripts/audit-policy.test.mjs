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
  assert.deepEqual(assessProductionAudit(acceptedReport()), {
    ok: true,
    errors: [],
  });
});

test('accepts a clean production audit report', () => {
  assert.deepEqual(assessProductionAudit({ vulnerabilities: {} }), {
    ok: true,
    errors: [],
  });
});

test('suppresses the accepted chain from the published report', () => {
  const published = createPublishedAuditReport(acceptedReport());

  assert.deepEqual(published.vulnerabilities, {});
  assert.deepEqual(published.metadata.vulnerabilities, {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  });
  assert.equal(published.metadata.dependencies.prod, 233);
  assert.deepEqual(
    published.auditPolicy.suppressedVulnerabilities[0].packages,
    ['umzug', '@rushstack/ts-command-line', 'argparse', 'sprintf-js'],
  );
  assert.equal(
    published.auditPolicy.suppressedVulnerabilities[0].reviewBy,
    '2026-11-07',
  );
});

test('does not add suppression metadata to a clean report', () => {
  const report = { vulnerabilities: {}, metadata: { dependencies: {} } };

  assert.deepEqual(createPublishedAuditReport(report), report);
});

test('rejects an unexpected moderate vulnerability', () => {
  const report = acceptedReport();
  report.vulnerabilities.other = { severity: 'moderate', via: [] };

  const assessment = assessProductionAudit(report);

  assert.equal(assessment.ok, false);
  assert.match(
    assessment.errors.join('\n'),
    /unexpected moderate vulnerability: other/,
  );
});

test('rejects a high vulnerability in the accepted chain', () => {
  const report = acceptedReport();
  report.vulnerabilities.umzug.severity = 'high';

  const assessment = assessProductionAudit(report);

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
