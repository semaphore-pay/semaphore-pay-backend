<!-- prettier-ignore -->
<div align="center">

<img src="./public/logo.png" alt="Semaphore Pay" align="center" height="96" />

# Semaphore Pay Backend

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js->=20-3c873a?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Hono](https://img.shields.io/badge/Hono-black?style=flat-square)](https://hono.dev)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com)

[Overview](#overview) • [Features](#features) • [Architecture](#architecture) • [Getting Started](#getting-started) • [API Reference](#api-reference) • [Deployment](#deployment)

</div>

## Overview

Backend API for **Semaphore Pay** — a subscription and billing platform built for the Nigerian market. Handles payment collection, subscription lifecycle, plan/product management, customer entitlements, and analytics.

Built on Cloudflare Workers (edge) with Hono, Drizzle ORM, and [Nomba](https://nomba.com) as the payment processor.

**Live API:** [api.semaphorepay.tech](https://api.semaphorepay.tech)
**Dashboard:** [dash.semaphorepay.tech](https://dash.semaphorepay.tech)
**Demo App:** [semaphorepay-demo.pages.dev](https://semaphorepay-demo.pages.dev)

## Features

- **Subscription Billing** — Create plans, manage subscriptions, handle renewals and cancellations
- **Payment Processing** — Nomba checkout integration with HMAC-verified webhooks
- **Product & Feature Management** — Define products with boolean/limit-based features
- **Entitlements** — Per-customer feature access with usage tracking and reporting
- **Analytics** — MRR, ARR, subscriber counts, plan breakdown, metric snapshots
- **API Key Management** — Public/secret key pairs per collection, sandbox/production environments
- **Balance & Payouts** — Earnings tracking with configurable platform fee (1.35%)
- **Magic Link Auth** — Passwordless email authentication via Better Auth
- **Multi-tenant** — Collections isolate billing data per user

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                     │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │   Hono    │  │ Better   │  │ @semaphore-pay/server│  │
│  │  Routes   │  │   Auth   │  │   Billing Engine     │  │
│  └─────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
│        │              │                   │              │
│  ┌─────┴──────────────┴───────────────────┴───────────┐  │
│  │              Cloudflare D1 (SQLite)                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Nomba     │  │   Email     │  │   Cron (*/5m)   │  │
│  │  Payments   │  │  Workers    │  │  Subscriptions  │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Cloudflare Workers |
| Framework | Hono |
| Language | TypeScript (ESNext) |
| Database | Cloudflare D1 via Drizzle ORM |
| Auth | Better Auth (magic link) |
| Payments | Nomba via `@semaphore-pay/server` |
| Validation | Zod |
| Build | Wrangler |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) >= 20
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm i -g wrangler`)
- Cloudflare account
- Nomba developer account ([sandbox](https://sandbox.nomba.com) + [production](https://nomba.com))

### Installation

```bash
git clone https://github.com/your-org/semaphore-pay-backend.git
cd semaphore-pay-backend
npm install
```

### Environment Setup

Create `.dev.vars` in the project root:

```bash
# Better Auth
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=http://localhost:8787

# Nomba (Sandbox)
NOMBA_SANDBOX_CLIENT_ID=your-sandbox-client-id
NOMBA_SANDBOX_CLIENT_SECRET=your-sandbox-client-secret
NOMBA_SANDBOX_ACCOUNT_ID=your-sandbox-account-id

# Nomba (Production)
NOMBA_LIVE_CLIENT_ID=your-live-client-id
NOMBA_LIVE_CLIENT_SECRET=your-live-client-secret
NOMBA_LIVE_ACCOUNT_ID=your-live-account-id

# Webhook
NOMBA_WEBHOOK_SECRET=your-webhook-secret
NOMBA_CHECKOUT_CALLBACK_URL=http://localhost:8787/webhook
```

### Development

```bash
npm run dev
```

API runs at `http://localhost:8787`.

### Type Generation

```bash
npm run cf-typegen
```

Generates/synchronizes types based on Worker configuration.

## API Reference

All billing endpoints require authentication. Pass session token via `Authorization` header or `token` query parameter.

### Authentication

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/*` | Better Auth handler (magic link login) |

### Collections

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/billing/collections` | Create collection |
| `GET` | `/api/v1/billing/collections` | List collections |
| `GET` | `/api/v1/billing/collections/:id` | Get collection |
| `PUT` | `/api/v1/billing/collections/:id` | Update collection |
| `DELETE` | `/api/v1/billing/collections/:id` | Delete collection |
| `GET` | `/api/v1/billing/collections/:id/analytics` | Collection analytics |
| `GET` | `/api/v1/billing/collections/:id/balance` | Get balance |

### Plans

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/billing/collections/:id/plans` | Create plan |
| `GET` | `/api/v1/billing/collections/:id/plans` | List plans |
| `GET` | `/api/v1/billing/collections/:id/plans/:planId` | Get plan |
| `POST` | `/api/v1/billing/collections/:id/plans/:planId/deactivate` | Deactivate |
| `POST` | `/api/v1/billing/collections/:id/plans/:planId/reactivate` | Reactivate |
| `DELETE` | `/api/v1/billing/collections/:id/plans/:planId` | Delete plan |

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/billing/collections/:id/products` | Create product |
| `GET` | `/api/v1/billing/collections/:id/products` | List products |
| `GET` | `/api/v1/billing/collections/:id/products/:productId` | Get product |
| `PUT` | `/api/v1/billing/collections/:id/products/:productId` | Update product |
| `DELETE` | `/api/v1/billing/collections/:id/products/:productId` | Delete product |

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/billing/collections/:id/customers` | Upsert customer |
| `GET` | `/api/v1/billing/collections/:id/customers` | List customers |
| `GET` | `/api/v1/billing/collections/:id/customers/:customerId` | Get customer |

### Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/billing/collections/:id/subscriptions/subscribe` | Subscribe customer |
| `GET` | `/api/v1/billing/collections/:id/subscriptions` | List subscriptions |
| `GET` | `/api/v1/billing/collections/:id/subscriptions/:subId` | Get subscription |
| `POST` | `/api/v1/billing/collections/:id/subscriptions/:subId/cancel` | Cancel |
| `POST` | `/api/v1/billing/collections/:id/subscriptions/:subId/pause` | Pause |
| `POST` | `/api/v1/billing/collections/:id/subscriptions/:subId/resume` | Resume |
| `POST` | `/api/v1/billing/collections/:id/subscriptions/:subId/reactivate` | Reactivate |

### Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/billing/collections/:id/features` | Create feature |
| `GET` | `/api/v1/billing/collections/:id/features` | List features |
| `DELETE` | `/api/v1/billing/collections/:id/features/:featureId` | Delete feature |
| `POST` | `/api/v1/billing/collections/:id/features/attach-plan` | Attach to plan |
| `POST` | `/api/v1/billing/collections/:id/features/detach-plan` | Detach from plan |
| `POST` | `/api/v1/billing/collections/:id/features/attach-product` | Attach to product |
| `POST` | `/api/v1/billing/collections/:id/features/detach-product` | Detach from product |

### Entitlements

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/billing/collections/:id/entitlements/check` | Check access |
| `POST` | `/api/v1/billing/collections/:id/entitlements/report` | Report usage |

### Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/billing/collections/:id/metrics/trend` | Current vs previous |
| `GET` | `/api/v1/billing/collections/:id/metrics/history` | Historical snapshots |
| `POST` | `/api/v1/billing/collections/:id/metrics/refresh` | Force refresh |

### SDK Routes

| Endpoint | Description |
|----------|-------------|
| `/client/*` | Pre-built SDK router (end-user facing, API key auth) |

## Quotas

| Resource | Limit |
|----------|-------|
| Collections per user | 10 |
| Plans per collection | 5 |
| Products per collection | Unlimited |
| Entitlements | 100 |

## Deployment

```bash
npm run deploy
```

### Production Configuration

Update `wrangler.jsonc` bindings with your Cloudflare D1 database ID and custom domain.

### Cron Jobs

The worker runs on a 5-minute schedule (`*/5 * * * *`) that:
1. Processes subscription renewals and retries
2. Captures metric snapshots for all collections

## Related Projects

- [Semaphore Pay Dashboard](https://github.com/your-org/semaphore-pay-dashboard) — Admin dashboard at [dash.semaphorepay.tech](https://dash.semaphorepay.tech)
- [Semaphore Pay Demo](https://semaphorepay-demo.pages.dev) — Demo application
- [@semaphore/pay server](https://www.npmjs.com/package/@semaphore-pay/server) — Core billing engine SDK
