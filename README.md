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
