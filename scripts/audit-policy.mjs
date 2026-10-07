const MODERATE_OR_HIGHER = new Set(['moderate', 'high', 'critical']);

const ALLOWED_CHAIN = [
  'umzug',
  '@rushstack/ts-command-line',
  'argparse',
  'sprintf-js',
];

const EXPECTED_LINKS = new Map([
  ['umzug', '@rushstack/ts-command-line'],
  ['@rushstack/ts-command-line', 'argparse'],
  ['argparse', 'sprintf-js'],
]);

const ACCEPTED_ADVISORY = 'https://github.com/advisories/GHSA-hp3w-g68c-fv3c';
const REVIEW_BY = '2026-11-07';

function stringDependencies(vulnerability) {
  if (!Array.isArray(vulnerability?.via)) {
    return [];
  }
  return vulnerability.via.filter((entry) => typeof entry === 'string');
}

export function assessProductionAudit(report) {
  if (
    !report ||
    typeof report !== 'object' ||
    !report.vulnerabilities ||
    typeof report.vulnerabilities !== 'object' ||
    Array.isArray(report.vulnerabilities)
  ) {
    return {
      ok: false,
      errors: ['npm audit report is missing a vulnerabilities object'],
    };
  }

  const relevant = Object.entries(report.vulnerabilities).filter(([, value]) =>
    MODERATE_OR_HIGHER.has(value?.severity),
  );

  if (relevant.length === 0) {
    return { ok: true, errors: [] };
  }

  const errors = [];
  const relevantNames = new Set(relevant.map(([name]) => name));

  for (const [name, vulnerability] of relevant) {
    if (!ALLOWED_CHAIN.includes(name)) {
      errors.push(
        `unexpected ${vulnerability.severity} vulnerability: ${name}`,
      );
      continue;
    }
    if (vulnerability.severity !== 'moderate') {
      errors.push(
        `accepted vulnerability ${name} changed severity to ${vulnerability.severity}`,
      );
    }
  }

  for (const name of ALLOWED_CHAIN) {
    if (!relevantNames.has(name)) {
      errors.push(
        `accepted Umzug vulnerability chain is incomplete: missing ${name}`,
      );
    }
  }

  for (const [name, dependency] of EXPECTED_LINKS) {
    const vulnerability = report.vulnerabilities[name];
    if (
      vulnerability &&
      !stringDependencies(vulnerability).includes(dependency)
    ) {
      errors.push(
        `accepted vulnerability ${name} is no longer linked to ${dependency}`,
      );
    }
  }

  const sprintfAdvisories = report.vulnerabilities['sprintf-js']?.via;
  const hasAcceptedAdvisory =
    Array.isArray(sprintfAdvisories) &&
    sprintfAdvisories.some(
      (entry) =>
        entry && typeof entry === 'object' && entry.url === ACCEPTED_ADVISORY,
    );
  if (!hasAcceptedAdvisory) {
    errors.push(`sprintf-js is not rooted in ${ACCEPTED_ADVISORY}`);
  }

  return { ok: errors.length === 0, errors };
}

export function createPublishedAuditReport(report) {
  const published = structuredClone(report);
  const suppressedPackages = ALLOWED_CHAIN.filter(
    (name) => published.vulnerabilities[name]?.severity === 'moderate',
  );

  if (suppressedPackages.length === 0) {
    return published;
  }

  for (const name of suppressedPackages) {
    delete published.vulnerabilities[name];
  }

  const counts = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  };
  for (const vulnerability of Object.values(published.vulnerabilities)) {
    if (vulnerability?.severity in counts) {
      counts[vulnerability.severity] += 1;
      counts.total += 1;
    }
  }
  published.metadata = {
    ...published.metadata,
    vulnerabilities: counts,
  };
  published.auditPolicy = {
    suppressedVulnerabilities: [
      {
        advisory: ACCEPTED_ADVISORY,
        packages: suppressedPackages,
        reason: 'Umzug CLI dependency chain is not exposed by the backend',
        reviewBy: REVIEW_BY,
      },
    ],
  };

  return published;
}
