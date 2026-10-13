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

export function assessProductionAudit(report, now = new Date()) {
  if (
    !report ||
    report.auditReportVersion !== 2 ||
    report.error ||
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
  if (now >= new Date(`${REVIEW_BY}T00:00:00Z`)) {
    errors.push(`accepted advisory requires a new review after ${REVIEW_BY}`);
  }
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

  for (const [name, vulnerability] of relevant) {
    if (!Array.isArray(vulnerability.via)) {
      errors.push(`missing advisory chain for ${name}`);
      continue;
    }
    for (const entry of vulnerability.via) {
      const expected = typeof entry === 'string'
        ? entry === EXPECTED_LINKS.get(name)
        : name === 'sprintf-js' && entry?.url === ACCEPTED_ADVISORY;
      if (!expected) errors.push(`unreviewed advisory or dependency in ${name}`);
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
  // Retain every native finding and its original counts in the uploaded report.
  const published = structuredClone(report);
  const assessment = assessProductionAudit(report);
  published.auditPolicy = {
    passed: assessment.ok,
    errors: assessment.errors,
    acceptedAdvisories: Object.keys(report.vulnerabilities ?? {}).some(name => ALLOWED_CHAIN.includes(name))
      ? [{ advisory: ACCEPTED_ADVISORY, packages: ALLOWED_CHAIN,
          reason: 'Umzug CLI dependency chain is not exposed by the backend', reviewBy: REVIEW_BY }]
      : [],
  };
  return published;
}
