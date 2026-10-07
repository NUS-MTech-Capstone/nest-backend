import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assessProductionAudit,
  createPublishedAuditReport,
} from './audit-policy.mjs';

const outputPath = resolve(process.cwd(), process.argv[2] ?? 'npm-audit.json');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCommand, ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

if (result.error) {
  console.error(`Unable to run npm audit: ${result.error.message}`);
  process.exit(1);
}

writeFileSync(outputPath, result.stdout ?? '', 'utf8');

if (result.status !== 0 && result.status !== 1) {
  if (result.stderr) {
    console.error(result.stderr.trim());
  }
  console.error(`npm audit failed with exit code ${result.status}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('npm audit returned malformed JSON');
  process.exit(1);
}

const assessment = assessProductionAudit(report);
if (!assessment.ok) {
  for (const error of assessment.errors) {
    console.error(`Production audit policy violation: ${error}`);
  }
  process.exit(1);
}

const moderate = report.metadata?.vulnerabilities?.moderate ?? 0;
const publishedReport = createPublishedAuditReport(report);
writeFileSync(
  outputPath,
  `${JSON.stringify(publishedReport, null, 2)}\n`,
  'utf8',
);
console.log(
  moderate === 0
    ? 'Production audit passed with no moderate-or-higher findings.'
    : `Production audit passed; ${moderate} approved Umzug CLI-chain findings were suppressed from the published report.`,
);
