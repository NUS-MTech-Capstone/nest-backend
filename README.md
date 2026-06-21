# DenDenMushi Nest Backend

NestJS APIs for change requests, inventory, access policy, memberships, and
Cognito user administration.

All application APIs use the `/ddm` prefix. Kubernetes probes are intentionally
outside that prefix:

```http
GET /healthz
GET /readyz
```

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
six default access policies and creates SSH session tracking and alert event
history tables. Apply migrations before starting the app in any shared or
production environment.

## Container

The Docker image uses Node.js 22, compiles the application and migrations in a
builder stage, installs production dependencies only, and runs as a non-root
user on port `3000`.

The container entrypoint runs database migrations before starting the API.
Set `SKIP_MIGRATIONS=true` to bypass migration on startup when a separate
migration job already ran.

## SSH gateway

Terminal sessions proxy to an SSH gateway service. In production (`AUTH_MODE=alb`)
the backend forwards the logged-in user's ALB OIDC headers
(`x-amzn-oidc-data`, `x-amzn-oidc-accesstoken`, `x-amzn-oidc-identity`) to the
gateway — **not** an `Authorization: Bearer` header. That matches how the ALB
authenticates traffic on the public `/sessions` Ingress route.

Configure the in-cluster gateway URL on the API deployment (Service
`proxy-controlplane`, port `8080`, namespace `dendenmushi`):

```bash
SSH_GATEWAY_URL=http://proxy-controlplane:8080
```

If the API pod runs in another namespace, use the cluster DNS name:

```bash
SSH_GATEWAY_URL=http://proxy-controlplane.dendenmushi.svc.cluster.local:8080
```

Do not point `SSH_GATEWAY_URL` at the public ALB URL (`https://api.ddm.keiyam.me/sessions`).
The backend calls `/sessions/start` itself and should reach the gateway pod directly.
The Ingress Cognito auth on `/sessions` is for external clients only.

Local development (`AUTH_MODE=dev`) does not receive ALB access tokens, so
configure a Cognito service account instead:

```bash
SSH_GATEWAY_URL=http://localhost:8080
SSH_GATEWAY_EMAIL=service-account@example.com
SSH_GATEWAY_PASSWORD=...
# Optional override; falls back to COGNITO_CLIENT_ID
SSH_GATEWAY_COGNITO_CLIENT_ID=
```

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
