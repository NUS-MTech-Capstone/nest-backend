# DenDenMushi Nest Backend

NestJS APIs for change requests, inventory, access policy, memberships, and
Cognito user administration.

In the Phase 1 baseline, this backend owns authenticated web application data
APIs, STS inventory/change-request lookups, Cognito administration, readiness,
and CloudWatch monitoring views. It does not proxy terminal streams or issue
session tokens.

All application APIs use the `/ddm` prefix. Kubernetes probes are intentionally
outside that prefix:

```http
GET /healthz
GET /readyz
```

Business endpoints require `x-api-version: 1`. `GET /healthz`, `GET /readyz`,
`GET /openapi.yaml`, `/`, `/ddm/auth/login`, `/ddm/auth/logout`, and
`/ddm/monitoring/alerts/webhook` are exempt so probes, browser redirects, and
SNS delivery do not need custom headers.

`/healthz` only reports that the process is running. `/readyz` executes
`SELECT 1` and returns `503` while PostgreSQL is unavailable.

## Authentication

`AUTH_MODE=dev` enables the local JWT login flow for development.

Production requires `AUTH_MODE=alb`. The backend verifies both AWS ALB
authentication headers:

- `x-amzn-oidc-data`: signature, expiry, signer ALB ARN, issuer, and client ID.
- `x-amzn-oidc-accesstoken`: signature, expiry, issuer, client ID, and token use.

The verified `sub` values must match. Cognito groups are taken from the access
token and mapped to application roles. Requester, approver, and audit actor
fields are always derived from this authenticated identity.

```http
GET /ddm/auth/login
GET /ddm/auth/logout
```

Login is an ALB authentication entry point. Logout clears the ALB session
cookie and redirects through the Cognito logout endpoint.

## Development

```bash
npm ci
npm run start:dev
npm test -- --runInBand
npm run build
```

Use `.env.example` as the configuration reference. Local development may use
the individual `DB_*` settings. Production must use `DATABASE_URL`.

Apply migrations before starting the backend locally or in production:

```bash
npm run migrate
```

## Database Migrations

Sequelize model synchronization is disabled. Apply versioned migrations before
rolling out a new backend image:

```bash
npm run migrate
```

`premigrate` runs `npm run build` automatically so compiled migration files exist.

Versioned migrations create all domain tables. The initial migration seeds the
six default access policies and creates alert event history tables. Apply
migrations before starting the app in any shared or production environment.

## Container

The Docker image uses Node.js 22, compiles the application and migrations in a
builder stage, installs production dependencies only, and runs as a non-root
user on port `3000`.

The container entrypoint runs database migrations before starting the API.
Set `SKIP_MIGRATIONS=true` to bypass migration on startup when a separate
migration job already ran.

## STS inventory integration

Terminal session control is handled by Proxy Control Plane and Session Manager,
not by this backend. The Angular client calls the public `/sessions` gateway
routes directly after ALB authentication.

The backend also exposes the STS server-inventory contract:

```http
GET /servers/{hostId}
GET /sts/change-requests/{crId}
```

STS should configure `SERVER_INVENTORY_URL=http://nest-backend:3000`.
The endpoint resolves `{hostId}` by VM UUID or hostname, returns address data
from `virtual_machines`, and enriches SSH-only metadata from
`SERVER_INVENTORY_STATIC_JSON` or the `SERVER_INVENTORY_DEFAULT_*` env vars.
STS should configure `CHANGE_REQUEST_URL=http://nest-backend:3000/sts`.
The change-request endpoint returns the approval status and gateway host IDs
derived from the CR's scoped VM IDs.

## Session audit facade

Managers, auditors, security analysts, and admins can read retained SSH
command/output audit through:

```http
GET /ddm/session-audit/sessions
GET /ddm/session-audit/records
GET /ddm/session-audit/sessions/{sessionId}/records
GET /ddm/audit/events
```

The backend is only an authenticated facade. It does not proxy terminal
traffic, capture command output, store audit bodies, or persist lifecycle events
in the webapp database.
Configure it with:

```bash
SESSION_AUDIT_URL=http://audit-service:8085
```

`GET /ddm/audit/events` forwards metadata timeline filters to Audit Service
`GET /events`, including `eventType`, `source`, `userId`, `sessionId`, `hostId`,
`crId`, `incidentId`, `runId`, `from`, `to`, `limit`, and `cursor`. The response
contains sanitized metadata only.

The `session-audit.view` permission is granted to `Manager`, `Auditor`,
`SecurityAnalyst`, and `Admin` by default.

## CloudWatch monitoring

The monitoring API reads CloudWatch metrics, alarms, and log groups using the
**nest-backend pod IAM role** (IRSA). Set these env vars on the deployment:

```bash
CLOUDWATCH_REGION=ap-southeast-1
CLOUDWATCH_LOG_GROUP=/aws/containerinsights/dendenmushi-cluster-dev/application
CLOUDWATCH_SESSION_LOG_GROUP=/aws/containerinsights/dendenmushi-cluster-dev/application
CLOUDWATCH_NAMESPACE=DenDenMushi
```

Attach a read-only policy to the nest-backend role (for example
`dendenmushi-nest-backend-dev`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchReadMetricsAndAlarms",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:DescribeAlarms",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogsRead",
      "Effect": "Allow",
      "Action": [
        "logs:FilterLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "arn:aws:logs:ap-southeast-1:891377133321:log-group:/aws/containerinsights/dendenmushi-cluster-dev/application",
        "arn:aws:logs:ap-southeast-1:891377133321:log-group:/aws/containerinsights/dendenmushi-cluster-dev/application:*"
      ]
    }
  ]
}
```

Adjust the account ID, region, and log group ARNs to match your cluster. Without
these permissions the monitoring page loads but metrics/logs/alarms stay empty
and the API reports `awsAuthorized: false`.

## API Specification

The OpenAPI contract is checked in at `api/openapi.yaml` and is served
unauthenticated outside the `/ddm` prefix at:

```http
GET /openapi.yaml
```
