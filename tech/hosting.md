# Sovga — Hosting & Infrastructure Research

Comprehensive analysis of hosting options for a Telegram Mini App (Next.js + PostgreSQL + image storage) serving users in Tashkent, Uzbekistan.

---

## 1. Hosting Platforms Comparison

### 1.1 Vercel

**Nearest regions to Uzbekistan:**
- `dxb1` — Dubai, UAE — **best compute region for UZ**
- `bom1` — Mumbai, India
- `fra1` — Frankfurt, Germany

Dubai was specifically launched to improve latency for Central Asia.

**Pricing:**

| Plan | Cost | Bandwidth | Function Timeout | Function Invocations |
|------|------|-----------|-----------------|---------------------|
| Hobby (Free) | $0 | 100 GB | 10 seconds | 150,000/mo |
| Pro | $20/user/mo | 1 TB | 60 seconds | Higher limits |
| Enterprise | ~$20-25K/year | Custom | Up to 900s | Custom |

**Payment webhook concern:** Hobby's 10-second timeout is risky for payment webhooks. Pro's 60-second timeout is adequate. Use `waitUntil()` to process after responding 200 OK.

**Monorepo:** Vercel handles Turborepo natively. Each app (`user-app`, `merchant-app`, `admin-app`) is a separate Vercel Project pointing to the same Git repo with different root directories.

**Vercel Postgres:** Transitioned to Neon's native integration. Hobby users get Neon Free; Pro users get enhanced Neon limits.

**Vercel Blob (images):** $0.023/GB-month storage, $0.05/GB transfer. 1 GB free on Hobby, 10 GB on Pro.

---

### 1.2 Hetzner

**Nearest datacenter:** Helsinki, Finland (~3,500 km from Tashkent). Also Nuremberg/Falkenstein, Germany.

**VPS pricing (extremely competitive):**

| Plan | vCPU | RAM | Storage | Price |
|------|------|-----|---------|-------|
| CX22 | 2 | 4 GB | 40 GB | EUR 3.49/mo |
| CX32 | 4 | 8 GB | 80 GB | EUR 6.99/mo |
| CX42 | 8 | 16 GB | 160 GB | EUR 14.99/mo |

All include 20 TB traffic, DDoS protection, NVMe SSD, hourly billing.

**PostgreSQL:** Self-managed only (install/maintain yourself).

**Object Storage:** S3-compatible. EUR 4.99/mo for 1 TB storage + 1 TB egress. Much cheaper than AWS S3.

**Trade-off:** Best price-to-performance but requires DevOps work (no managed services, manual CI/CD).

---

### 1.3 DigitalOcean

**Nearest region:** Bangalore, India (BLR1) — ~2,500 km from Tashkent.

- **App Platform:** from $5/mo per container
- **Managed PostgreSQL:** from $15/mo
- **Spaces (S3-compatible):** $5/mo flat for 250 GB + 1 TB transfer, built-in CDN

Good middle ground between Hetzner (cheapest) and Vercel (easiest).

---

### 1.4 Fly.io

**Nearest region:** `bom` — Mumbai, India.

- Runs Next.js as Docker container, full SSR
- Self-managed Postgres: ~$2/month (dev) to ~$82-164/month (production HA)
- Free allowances: 3 shared VMs, 160 GB bandwidth
- No object storage (need external solution)

---

### 1.5 Local Uzbekistan Hosting

| Provider | Starter VPS | Specs | Notes |
|----------|------------|-------|-------|
| **Airnet.uz** | ~$15/mo | 2 CPU, 4 GB RAM, 50 GB SSD | Tier III DC, 1 Gbps |
| **Servercore.uz** | ~$9/mo | 1 CPU, 1 GB RAM, 5 GB SSD | OpenStack/KVM, AMD EPYC |
| **Uztelecom** | ~$5/mo | Basic VPS | State telecom |

**Performance:** ~5ms local latency, excellent TAS-IX speeds (900+ Mbps), but international bandwidth bottleneck (~100ms to Europe).

---

### 1.6 AWS / GCP / Azure

**Nearest regions:**

| Provider | Region | Location | Distance |
|----------|--------|----------|----------|
| AWS | me-central-1 | Dubai | ~2,800 km |
| AWS | ap-south-1 | Mumbai | ~2,500 km |
| GCP | asia-south1 | Mumbai | ~2,500 km |
| Azure | UAE Central | Dubai | ~2,800 km |

**Pricing for 2 vCPU, 4 GB RAM:** $25-50/mo — significantly more expensive than Hetzner (EUR 3.49) or local (~$5-15). Overkill for MVP unless you get startup credits (AWS Activate: $1K-$100K).

---

## 2. Latency Analysis

### Estimated latency from Tashkent:

| Destination | Latency | Cloud Providers |
|-------------|---------|-----------------|
| **Tashkent (local)** | **~5 ms** | Airnet, Servercore |
| **Moscow** | ~50-65 ms | Russian providers |
| **Dubai** | ~60-80 ms | AWS, Vercel, Azure |
| **Mumbai** | ~70-90 ms | AWS, GCP, Fly.io, Vercel |
| **Istanbul** | ~70-85 ms | Various |
| **Helsinki** | ~80-100 ms | Hetzner |
| **Frankfurt** | ~85-110 ms | AWS, Hetzner, Vercel, Neon |
| **Singapore** | ~120-150 ms | DO, Railway |
| **US East** | ~170-200 ms | Most US-defaulting services |

### Does latency matter for a TMA?

**Initial page load matters most.** Static assets can be cached at Cloudflare edge (Tashkent PoP). Only API calls add server round-trip latency.

- 60-80ms (Dubai) per API call — feels instant
- 170ms (US East) per API call — feels sluggish
- For 3 sequential API calls: 240ms (Dubai) vs 510ms (US East) — significant

**Recommendation:** Target Dubai or Mumbai for compute. Supplement with Cloudflare CDN for static assets.

---

## 3. PostgreSQL Hosting

| Service | Free Tier | Paid Starting | Nearest Region | Key Feature |
|---------|-----------|--------------|----------------|-------------|
| **Neon** | 0.5 GB | $5/mo | Frankfurt | Scale-to-zero, branching |
| **Supabase** | 500 MB | $25/mo | **Mumbai** | Auth + Storage + Realtime |
| **Railway** | Trial only | ~$1/mo | EU-West | Simple, co-located |
| **Self-hosted (Hetzner)** | N/A | EUR 3.49/mo | Helsinki | Full control, cheapest |
| **Self-hosted (Tashkent)** | N/A | ~$9-15/mo | **Tashkent** | Data residency compliant |

**Best option for Sovga:**
- **MVP:** Neon Free (Frankfurt) — scale-to-zero means $0 when idle
- **Production:** Supabase Pro ($25/mo, Mumbai) — closest managed DB region to Uzbekistan + built-in auth/storage
- **If data residency required:** Self-hosted in Tashkent (Servercore or Airnet)

**Rule:** Always co-locate database with compute server to avoid cross-region latency.

---

## 4. Image/Asset Storage

| Service | Storage | Egress | Free Tier | CDN |
|---------|---------|--------|-----------|-----|
| **Cloudflare R2** | $0.015/GB-mo | **$0 (free!)** | 10 GB storage | Yes |
| **Hetzner Object Storage** | ~$0.005/GB-mo | ~$1/TB | 1 TB for EUR 4.99/mo | No |
| **DigitalOcean Spaces** | $0.02/GB-mo | $0.01/GB | 250 GB for $5/mo | Yes |
| **Vercel Blob** | $0.023/GB-mo | $0.05/GB | 1 GB | Yes |
| **Supabase Storage** | Included | Included | 1 GB (free) | Yes |
| **AWS S3** | $0.023/GB-mo | $0.09/GB | 5 GB (12 months) | Via CloudFront |

**Winner: Cloudflare R2.** Zero egress fees are decisive — product images are served repeatedly to many users. S3-compatible API. Pair with Cloudflare custom domain for CDN delivery through the **Tashkent PoP**.

**Cost at scale:**

| Scale | Images | Storage | R2 Cost |
|-------|--------|---------|---------|
| 1,000 images | ~500 MB | ~$0.01/mo |
| 10,000 images | ~5 GB | ~$0.08/mo |
| 50,000 images | ~25 GB | ~$0.38/mo |

*Assuming ~500 KB per optimized product image.*

---

## 5. CDN

### Cloudflare — Clear Winner

**Cloudflare has a PoP in Tashkent, Uzbekistan** (added mid-2022). Also PoPs in Almaty (Kazakhstan) and Moscow.

This is a major advantage — static assets served through Cloudflare have single-digit millisecond latency to Tashkent users.

- Free tier: Unlimited bandwidth, DDoS protection, CDN caching, DNS
- Pro ($20/mo): Adds WAF, image optimization
- For MVP, free tier is more than sufficient

### Telegram WebView Caching

The TMA WebView caches static assets using standard HTTP headers. Next.js default behavior (content-hashed filenames for JS/CSS) is ideal — these cache indefinitely. Disable caching on HTML files (`Cache-Control: no-store`) for fresh data.

---

## 6. Cost Projections

### Option A: Vercel + Neon + Cloudflare R2 (Recommended for MVP)

| Milestone | Users | Txns/mo | Vercel | Neon | R2 | CDN | **Total** |
|-----------|-------|---------|--------|------|-----|-----|-----------|
| MVP | 500 | 150 | $0 | $0 | $0 | $0 | **$0/mo** |
| Early | 2,000 | 1,000 | $20 | $5 | $0 | $0 | **~$25/mo** |
| Business | 10,000 | 7,500 | $30 | $15 | $1 | $0 | **~$46/mo** |
| Growth | 30,000 | 27,000 | $60 | $30 | $2 | $0 | **~$92/mo** |
| Scale | 100,000 | 90,000 | $170 | $80 | $5 | $0 | **~$255/mo** |

### Option B: Hetzner VPS + Self-managed PG + R2 (Cheapest)

| Milestone | Users | Txns/mo | Hetzner | DB | R2 | CDN | **Total** |
|-----------|-------|---------|---------|-----|-----|-----|-----------|
| MVP | 500 | 150 | EUR 3.49 | $0 | $0 | $0 | **~$4/mo** |
| Early | 2,000 | 1,000 | EUR 3.49 | $0 | $0 | $0 | **~$4/mo** |
| Business | 10,000 | 7,500 | EUR 6.99 | $0 | $1 | $0 | **~$8/mo** |
| Growth | 30,000 | 27,000 | EUR 14.99 | $0 | $2 | $0 | **~$18/mo** |
| Scale | 100,000 | 90,000 | EUR 45 | $0 | $5 | $0 | **~$50/mo** |

### Option C: Vercel + Supabase (Mumbai) + R2

| Milestone | Users | Txns/mo | Vercel | Supabase | R2 | **Total** |
|-----------|-------|---------|--------|----------|-----|-----------|
| MVP | 500 | 150 | $0 | $0 | $0 | **$0/mo** |
| Early | 2,000 | 1,000 | $20 | $25 | $0 | **~$45/mo** |
| Business | 10,000 | 7,500 | $30 | $25 | $1 | **~$56/mo** |
| Growth | 30,000 | 27,000 | $60 | $35 | $2 | **~$97/mo** |
| Scale | 100,000 | 90,000 | $170 | $80 | $5 | **~$255/mo** |

---

## 7. Recommended Architecture

### Phase 1 — MVP ($0/month)

```
Users in Tashkent
    ↓
Cloudflare CDN (Tashkent PoP) — caches static assets
    ↓
Vercel (Dubai dxb1) — 3 Next.js apps
    ↓
Neon PostgreSQL (Frankfurt) — serverless, scale-to-zero
    +
Cloudflare R2 — product images
```

- **Cost: $0/month** (plus ~$10/year for domain)
- Neon scales to zero when idle
- Vercel Hobby handles 150K function invocations/month
- Cloudflare R2 free tier: 10 GB storage

**Limitation:** Vercel Hobby 10-second timeout. Keep webhook handlers lean or upgrade to Pro ($20/mo) before enabling payments.

### Phase 2 — Production with Payments (~$25/month)

Upgrade to Vercel Pro ($20/mo) + Neon Launch ($5/mo). Pro gives 60-second function timeout needed for payment webhooks.

### Phase 3 — Growth (~$50-100/month)

Options:
- Stay on Vercel + Neon (simpler, more expensive at scale)
- Migrate to Hetzner Docker (cheaper, more operational work)
- Add local Uzbek DB instance if data residency required

### When to Leave Vercel

Consider migrating when:
- Costs exceed ~$150-200/month consistently
- You need long-running background jobs
- You need WebSocket connections
- You want more infrastructure control

Migration path: Next.js supports `output: 'standalone'` for Docker deployments → Hetzner or Fly.io.

---

## 8. Data Residency & Compliance

### Personal Data Law (ZRU-547, 2019, as amended January 2026)

**Before January 2026:** All personal data of Uzbek citizens had to be stored on servers physically in Uzbekistan.

**After January 2026 amendments:** Only biometric, genetic, and telecommunications-related data must be stored locally. Other personal data can be transferred abroad if security requirements are met and the destination country is on the approved list.

**For Sovga:** You process names, Telegram IDs, and payment transaction data. Under the new amendments, this data likely can be stored abroad — but the approved country list has not been published yet by the Cabinet of Ministers. **Consult a local lawyer before choosing to store data outside Uzbekistan.**

### E-Commerce (Resolution 885, effective July 2025)

- E-commerce operators must be legal entities in Uzbekistan
- Must use individual bank accounts for payments
- Notification procedure required
- Must integrate with Tax Committee

### IT Park Residency

- Tax exemptions until 2040 (0% corporate tax, 0% VAT)
- Does not exempt from data localization requirements
- Does not provide hosting — you choose your own

### Database Registration

You must register your personal data database with the State Register of Personal Data Databases at the State Personalization Center (15-day process).

### Practical Approach

1. **MVP:** Use international hosting (Vercel + Neon). Process minimal personal data. Risk is low during validation phase.
2. **Pre-launch:** Confirm approved country list with lawyer. If hosting country qualifies, continue.
3. **Scale:** If required, add a local PostgreSQL instance in Tashkent for personal data while keeping compute and CDN international.

---

## Domain: sovga.uz

**Action needed:** Check availability and register `sovga.uz` through a local Uzbek registrar. `.uz` domains are managed by UZINFOCOM. Registration typically requires a local legal entity.

Alternative: Use `sovga.com` or `sovga.app` initially (no local entity required), redirect to TMA via `t.me/sovgabot` links.

---

**Sources:**
- [Vercel Regions & Dubai dxb1](https://vercel.com/docs/regions)
- [Hetzner Cloud Pricing](https://www.hetzner.com/cloud)
- [Hetzner Object Storage](https://www.hetzner.com/storage/object-storage)
- [DigitalOcean Regions](https://docs.digitalocean.com/platform/regional-availability/)
- [Fly.io Regions](https://fly.io/docs/reference/regions/)
- [Airnet.uz VPS](https://airnet.uz/en/vds)
- [Servercore.uz](https://servercore.uz)
- [Neon Pricing & Regions](https://neon.com/pricing)
- [Supabase Pricing & Regions](https://supabase.com/pricing)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Tashkent PoP](https://blog.cloudflare.com/mid-2022-new-cities/)
- [Uzbekistan Data Law Reform 2026](https://caspianpost.com/uzbekistan/how-uzbekistan-s-data-law-reform-enables-apple-pay-google-pay-and-paypal)
- [E-Commerce Resolution 885](https://settleadvisory.com/news-en/new-regulations-for-e-commerce-in-uzbekistan-from-july-1-2025/)
- [IT Park Uzbekistan](https://tax-legal.uz/en/it-park/)
- [Tashkent Internet Latency](https://www.speedgeo.net/statistics/uzbekistan/tashkent)

**Last Updated:** 2026-02-21
