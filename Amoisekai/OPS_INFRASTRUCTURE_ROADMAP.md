# Amoisekai — Operations & Infrastructure Roadmap

**Version:** 1.0
**Date:** 2026-02
**Scope:** Hệ thống vận hành cần xây dựng để public và scale, quản lý bởi 1 người
**Mục tiêu:** Tự động hóa tối đa bằng AI, giảm thiểu manual intervention

---

## Trạng thái hiện tại

```
✅ amo-stories-engine     — FastAPI backend, LangGraph pipeline
✅ amo-lofi-web           — React frontend
✅ amo-lofi-extension     — Chrome extension
✅ Amo Guardian           — Security layer (auth, ownership, prompt guard, security headers)
✅ Amo Test Pilot         — AI test generator (unit, e2e, narrative quality review)
```

**Gaps trước khi public:**
- Không biết khi nào server down
- Không kiểm soát được chi phí LLM
- Không có backup data
- Deploy = SSH + restart thủ công

---

## Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PUBLIC INTERNET                              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   CDN / Proxy   │  Cloudflare (free tier)
                   │  (DDoS, cache)  │
                   └────────┬────────┘
                            │
          ┌─────────────────┼──────────────────┐
          │                 │                  │
   ┌──────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
   │  amo-lofi   │  │  amoisekai   │  │  amo-lofi    │
   │    web      │  │   engine     │  │  extension   │
   │  (Vercel)   │  │  (Railway)   │  │  (Chrome     │
   └─────────────┘  └──────┬───────┘  │   Store)     │
                           │          └──────────────-┘
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼─────┐ ┌────▼────┐ ┌────▼──────┐
       │  SQLite DB │ │ Google  │ │ Supabase  │
       │  (→ Supa-  │ │   AI    │ │  Auth     │
       │   base)    │ │  API    │ │           │
       └────────────┘ └─────────┘ └───────────┘
              │
   ┌──────────┼────────────────────────┐
   │          │                        │
   ▼          ▼                        ▼
[Amo Ops] [Amo Sentinel]          [Amo Vault]
(monitor)  (cost guard)           (backup)
```

---

## Tier 1 — Critical (Phải có trước public)

### 1.1 Amo Vault — Backup & Recovery

**Mục đích:** Bảo vệ data người dùng (stories, player identity) khỏi mất mát do disk failure, bug, hoặc human error.

**Rủi ro nếu thiếu:** SQLite file bị corrupt khi server crash mid-write → mất toàn bộ stories và player data của tất cả users.

**Components:**

```
scripts/
├── backup.py           # chạy mỗi giờ qua cron
├── restore.py          # restore từ backup file
└── verify_backup.py    # kiểm tra backup file hợp lệ (không bị corrupt)
```

**Logic backup.py:**
```python
def run_backup():
    # 1. VACUUM → WAL checkpoint (SQLite đặc thù)
    db.conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    # 2. Copy atomic
    shutil.copy2("data/stories.db", f"backups/stories_{timestamp}.db")
    # 3. Verify backup hợp lệ
    verify_integrity(backup_path)
    # 4. Upload to Cloudflare R2 (hoặc B2) — $0.015/GB/month
    upload_to_r2(backup_path)
    # 5. Cleanup local — giữ 24 bản (1 ngày × mỗi giờ)
    cleanup_old_backups(keep=24)
```

**Cron schedule (Railway built-in):**
```
0 * * * *   python scripts/backup.py          # mỗi giờ
0 0 * * *   python scripts/backup.py --daily  # daily → giữ 30 ngày
```

**Recovery SLA:** Tối đa mất 1 giờ data (RPO = 1h). Restore thủ công dưới 10 phút.

**Dependencies:** Cloudflare R2 hoặc Backblaze B2 account ($0-$1/tháng cho <1GB).

**Effort:** 1 ngày
**Priority:** 🔴 Must-have trước launch

---

### 1.2 Amo Ops — Observability Stack

**Mục đích:** Biết server có đang hoạt động không, LLM có đang slow không, và story nào đang fail.

**Rủi ro nếu thiếu:** Users gặp lỗi → không ai biết → churn. 30% requests timeout vì Gemini slow → không phát hiện được.

**Components:**

#### 1.2.1 Error Tracking (Sentry)
```python
# app/main.py — thêm 3 dòng
import sentry_sdk
sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.env)
```
- Free tier: 5,000 errors/tháng
- Tự động capture: stack trace, request context, user_id
- Alert: email/Slack khi có error mới

#### 1.2.2 Uptime Monitoring (UptimeRobot)
- Ping `GET /api/health` mỗi 5 phút
- SMS + email khi down > 2 phút
- Free tier đủ dùng

#### 1.2.3 Custom Metrics (Prometheus + Grafana Cloud)
```python
# app/observability/metrics.py

# Metrics quan trọng nhất:
chapter_generation_duration = Histogram(
    "chapter_generation_seconds",
    "LLM pipeline duration",
    buckets=[5, 10, 20, 30, 60, 120],
)
critic_score_gauge = Gauge(
    "critic_score_rolling_avg",
    "Rolling average critic score (7 ngày)",
)
rewrite_rate = Counter(
    "pipeline_rewrites_total",
    "Số lần critic reject và trigger rewrite",
)
chapter_error_rate = Counter(
    "chapter_errors_total",
    "Chapter generation failures",
    labelnames=["error_type"],
)
```

#### 1.2.4 Deep Health Check
```python
# GET /api/health/deep — internal monitoring only, không public
@app.get("/api/health/deep", include_in_schema=False)
async def health_deep(x_internal_key: str = Header()):
    if x_internal_key != settings.internal_health_key:
        raise HTTPException(403)

    # Check DB write
    # Check Gemini API reachable (model ping, không charge)
    # Check disk space > 20%
    # Check memory < 80%
    return {
        "db": "ok",
        "llm": "ok",
        "disk_free_pct": 45,
        "memory_used_pct": 62,
        "last_successful_chapter": "2026-02-28T10:30:00Z",
    }
```

**Alerting rules (Grafana):**
| Condition | Alert |
|-----------|-------|
| `chapter_generation_p95 > 45s` | Warning — LLM đang chậm |
| `chapter_error_rate > 5%` trong 5 phút | Critical — pipeline đang break |
| `critic_score_rolling_avg < 6.0` | Warning — chất lượng narrative đang giảm |
| `rewrite_rate/chapter_rate > 40%` | Warning — AI đang generate nhiều junk |

**Effort:** 2 ngày
**Priority:** 🔴 Must-have trước launch

---

### 1.3 Amo Sentinel — Cost & Abuse Guard

**Mục đích:** Ngăn một user (hoặc bot) gây ra chi phí LLM không kiểm soát, và track chi phí tổng để biết breakeven.

**Rủi ro nếu thiếu:** 1 user tạo 500 chapters/ngày × $0.02/chapter = $10/ngày/user. Với 50 user bị abuse = $500/ngày = $15,000/tháng.

**Chi phí ước tính (Gemini 2.5 Flash):**
```
Chapter generation:
  - Input:  ~3,000 tokens × $0.075/1M = $0.000225
  - Output: ~800 tokens  × $0.30/1M  = $0.00024
  - Total:  ~$0.0005/chapter (rất rẻ, nhưng cộng dồn)

Với 1,000 active users × 5 chapters/ngày = 5,000 chapters
Daily cost: ~$2.50/ngày = ~$75/tháng ← manageable

Với 10,000 users × 10 chapters/ngày = 100,000 chapters
Daily cost: ~$50/ngày = ~$1,500/tháng ← cần tối ưu
```

**Components:**

```
app/billing/
├── cost_tracker.py     # log tokens và cost per request
├── budget_guard.py     # FastAPI dependency kiểm tra limit
└── cost_reporter.py    # weekly cost report tự động
```

**cost_tracker.py:**
```python
# Intercept sau mỗi LLM call
def track_llm_cost(user_id: str, model: str, input_tokens: int, output_tokens: int):
    # Gemini 2.5 Flash pricing
    cost_usd = (input_tokens * 0.075 + output_tokens * 0.30) / 1_000_000
    db.log_cost(user_id=user_id, cost_usd=cost_usd, date=today())
```

**budget_guard.py:**
```python
async def check_budget(current_user: str = Depends(get_current_user)):
    # Tier-based limits
    daily_chapters = db.get_chapters_today(current_user)
    user_tier = db.get_user_tier(current_user)  # "free" | "pro"

    limits = {"free": 5, "pro": 50}
    if daily_chapters >= limits.get(user_tier, 5):
        raise HTTPException(
            status_code=429,
            detail=f"Daily story limit reached ({limits[user_tier]} chapters/day). Upgrade to Pro for more."
        )
```

**Anomaly detection (chạy mỗi 15 phút):**
```python
def detect_abuse():
    # User tạo > 3× average trong 1 giờ
    # Nhiều requests từ cùng IP với user_id khác nhau (account sharing)
    # Cost spike > 200% so với hôm qua → alert Telegram
```

**Effort:** 3 ngày
**Priority:** 🔴 Must-have trước launch (hoặc tuần 1 ngay sau launch)

---

## Tier 2 — Stability (Tháng 1-3)

### 2.1 Amo Deploy — CI/CD Pipeline

**Mục đích:** Deploy code mới không cần SSH, không có downtime, có thể rollback trong 1 phút.

**Rủi ro nếu thiếu:** Mỗi deploy = 30s-2 phút downtime. Bug deploy = khó rollback. "Sợ deploy" → push code ít hơn → iteration chậm.

**Stack:**
```
Code → GitHub → GitHub Actions → Docker → Railway (blue-green)
```

**Dockerfile:**
```dockerfile
FROM python:3.12-slim AS base
WORKDIR /app

# Dependencies layer (cached nếu pyproject.toml không đổi)
COPY amo-stories-engine/pyproject.toml .
RUN pip install --no-cache-dir -e ".[prod]"

# App layer
COPY amo-stories-engine/ .

# Security: non-root user
RUN useradd -m -u 1000 amouser
USER amouser

HEALTHCHECK --interval=30s --timeout=10s \
    CMD curl -f http://localhost:8001/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
```

**GitHub Actions (.github/workflows/deploy.yml):**
```yaml
name: Deploy Amoisekai Engine

on:
  push:
    branches: [main]
    paths: ["amo-stories-engine/**"]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Amo Test Pilot
        run: |
          cd amo-test-pilot
          npm install
          # Chạy E2E tests trước khi deploy
          node pilot.js e2e ../amo-stories-engine/app/routers/story.py
          python -m pytest output/e2e/ -v --tb=short
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

**Rollback procedure:**
```bash
# 1 lệnh rollback về commit trước
railway rollback --deployment-id <previous>
```

**Deployment targets:**
| Environment | Trigger | URL |
|-------------|---------|-----|
| `development` | local | localhost:8001 |
| `staging` | push to `dev` branch | staging.amoisekai.com |
| `production` | push to `main` (after tests pass) | api.amoisekai.com |

**Effort:** 2 ngày
**Priority:** 🟡 Important — trước khi có team hoặc > 100 users

---

### 2.2 Amo Lens — Player Analytics

**Mục đích:** Hiểu player behavior để cải thiện game design — chapter nào bị bỏ, choice nào phổ biến, archetype nào tạo story tốt nhất.

**Stack:** PostHog (open-source, free tier 1M events/tháng, self-host được)

**Events cần track:**

```python
# app/analytics/events.py

class AmoEvent(str, Enum):
    # Onboarding funnel
    SOUL_FORGE_STARTED    = "soul_forge_started"
    SOUL_FORGE_COMPLETED  = "soul_forge_completed"
    SOUL_FORGE_ABANDONED  = "soul_forge_abandoned"   # session timeout

    # Story lifecycle
    STORY_STARTED         = "story_started"
    CHAPTER_COMPLETED     = "chapter_completed"
    STORY_ABANDONED       = "story_abandoned"        # > 7 ngày không tiếp tục
    STORY_DELETED         = "story_deleted"

    # Engagement
    FREE_INPUT_USED       = "free_input_used"        # vs. predefined choice
    CHOICE_SELECTED       = "choice_selected"        # index 0/1/2/3, risk_level
    SKILL_UNLOCKED        = "skill_unlocked"
    SKILL_EVOLUTION       = "skill_evolution_triggered"

    # Quality signals
    CHAPTER_REWRITTEN     = "chapter_rewritten"      # critic rejected
    LOW_QUALITY_DETECTED  = "low_quality_detected"   # critic_score < 6

def track(event: AmoEvent, properties: dict, user_hash: str):
    """
    user_hash = sha256(user_id) — anonymized, GDPR compliant.
    Không bao giờ log raw user_id trong analytics.
    """
    posthog.capture(user_hash, event.value, properties)
```

**Dashboards cần thiết:**

```
Dashboard 1: Onboarding Funnel
  soul_forge_started → soul_forge_completed → story_started → chapter_5
  → Conversion rate ở mỗi bước
  → Drop-off points

Dashboard 2: Engagement
  avg_chapters_per_story (by archetype)
  free_input_rate (% users dùng free text)
  daily_active_stories
  7-day retention

Dashboard 3: AI Quality Monitor
  critic_score_avg (rolling 7 ngày)
  rewrite_rate_pct
  chapter_error_rate
  pipeline_latency_p95

Dashboard 4: Cost
  cost_per_user_day (avg, p95)
  total_daily_cost_usd
  chapters_per_dollar
```

**Key insights để optimize:**
- Nếu `free_input_rate < 20%` → predefined choices quá tốt, hoặc UI không khuyến khích free input
- Nếu `chapter_5_conversion < 40%` → story bắt đầu không đủ engaging
- Nếu `critic_score_avg < 7.0` trong 3 ngày liên tiếp → model drift, cần điều chỉnh prompt

**Effort:** 1 tuần
**Priority:** 🟡 Important — tháng đầu sau launch

---

## Tier 3 — Scale (Khi có > 500 users)

### 3.1 Migrate SQLite → Supabase Postgres

**Tại sao đây là milestone quan trọng nhất:**
Một lần migrate giải quyết đồng thời 4 vấn đề:

| Vấn đề hiện tại | Sau migrate |
|-----------------|-------------|
| Backup thủ công | Supabase auto-backup mỗi giờ |
| Single SQLite writer | Postgres multi-connection |
| Soul Forge sessions in-memory | Persist vào DB, survive restarts |
| Không có admin UI | Supabase Studio (table editor, SQL editor) |

**Migration plan:**
```
Phase 1: Schema migration
  - Viết Alembic migration scripts
  - Map SQLite tables → Postgres schemas
  - Test với production data snapshot

Phase 2: Dual-write
  - Write vào cả SQLite và Postgres trong 1 tuần
  - Verify data consistency

Phase 3: Cutover
  - Switch reads sang Postgres
  - Disable SQLite writes
  - Monitor 24h
  - Archive SQLite file
```

**Row Level Security (Postgres native):**
```sql
-- Users chỉ có thể read story của mình — enforced ở DB level
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their stories"
    ON stories FOR ALL
    USING (user_id = auth.uid());
```

**Effort:** 1 tuần
**Priority:** 🔵 Plan khi tiếp cận 500 users

---

### 3.2 Amo Admin — Management Console

**Mục đích:** Vận hành hằng ngày không cần viết SQL hoặc SSH vào server.

**Capabilities cần thiết:**

```
Content moderation:
  - Xem chapters được generate gần đây (paginated)
  - Flag/xóa content vi phạm
  - Xem prompt injection attempts bị block

User management:
  - Xem user profile + story count + cost
  - Reset player (nếu bug)
  - Manually set user tier (free/pro/banned)

System health:
  - Live dashboard: cost/day, error rate, latency
  - Xem Soul Forge sessions đang active
  - Trigger manual backup

Story quality:
  - List stories với critic_score thấp nhất
  - Xem rewrite history của một chapter
```

**Build approach:** Không cần frontend riêng.

**Option A — Supabase Studio (sau migration):**
Free, đầy đủ, zero maintenance. Chỉ cần thêm custom views.

**Option B — Simple FastAPI + HTMX (nếu muốn custom):**
```python
# app/admin/router.py — protected bằng X-Admin-Key header
@admin_router.get("/admin/stories", response_class=HTMLResponse)
async def admin_stories(x_admin_key: str = Header()):
    verify_admin_key(x_admin_key)
    stories = db.get_recent_stories(limit=50, include_critic_score=True)
    return templates.TemplateResponse("admin/stories.html", {"stories": stories})
```

**Effort:** 3-5 ngày (nếu dùng Option B)
**Priority:** 🔵 Plan khi tiếp cận 200+ users

---

### 3.3 Amo Forge Lab — AI Quality & Eval

**Mục đích:** Phát hiện model drift sớm, đánh giá prompt changes trước khi ship, build dataset để fine-tune.

**Components:**

```
amo-forge-lab/
├── eval/
│   ├── benchmark_suite.py    # chạy 20 fixed prompts → compare scores
│   ├── regression_test.py    # đảm bảo changes không làm giảm chất lượng
│   └── model_compare.py      # flash vs pro vs experimental
├── dataset/
│   ├── curate.py             # export chapters với critic_score >= 8.5
│   └── annotate.py           # AI-assisted annotation cho fine-tuning
└── reports/
    └── weekly_quality.py     # auto-generate weekly quality report
```

**Integration với Amo Test Pilot:**
```bash
# weekly_quality.py chạy mỗi Chủ nhật
node pilot.js ux --api https://api.amoisekai.com --story-id <sample> --chapter latest
# → output: ux_review_weekly_YYYY-MM-DD.json
# → nếu overall_score < 7.0 → gửi alert
```

**Nightly regression (GitHub Actions):**
```yaml
# Chạy mỗi đêm lúc 2 AM
- name: Story Quality Regression
  run: |
    python amo-forge-lab/eval/benchmark_suite.py \
      --env production \
      --output reports/nightly_$(date +%Y%m%d).json
    python amo-forge-lab/eval/check_regression.py \
      --threshold 7.0 \
      --alert-webhook $SLACK_WEBHOOK
```

**Fine-tuning pipeline (khi có đủ data ~1,000 high-quality chapters):**
```
Curate (critic_score >= 8.5) → Format → Upload to Vertex AI → Fine-tune Gemini Flash
→ A/B test: 50% users new model, 50% base model
→ Evaluate critic scores after 1 tuần
→ Promote nếu tốt hơn
```

**Effort:** 1-2 tuần
**Priority:** 🔵 Plan khi có 6 tháng data

---

## Timeline tổng hợp

```
TRƯỚC LAUNCH (2-4 tuần):
┌─────────────────────────────────────────────────────────┐
│  Tuần 1                                                 │
│  ├── Amo Vault: backup script + R2 upload (1 ngày)      │
│  ├── Sentry integration (4 giờ)                         │
│  └── UptimeRobot setup (30 phút)                        │
│                                                         │
│  Tuần 2                                                 │
│  ├── Amo Ops: custom metrics + Grafana dashboard (2 ngày)│
│  └── Amo Deploy: Dockerfile + Railway + CI (2 ngày)     │
└─────────────────────────────────────────────────────────┘

THÁNG 1 (sau launch):
┌─────────────────────────────────────────────────────────┐
│  Amo Sentinel: cost tracking + budget guard (3 ngày)    │
│  Amo Lens: PostHog events + dashboard (1 tuần)          │
└─────────────────────────────────────────────────────────┘

THÁNG 2-3:
┌─────────────────────────────────────────────────────────┐
│  Optimize dựa trên Amo Lens data                        │
│  Cải thiện Amo Ops alerting rules                       │
│  Plan Supabase migration                                │
└─────────────────────────────────────────────────────────┘

THÁNG 4-6 (khi có > 500 users):
┌─────────────────────────────────────────────────────────┐
│  Supabase migration (1 tuần)                            │
│  Amo Admin console (3-5 ngày)                           │
│  Amo Forge Lab setup (1-2 tuần)                         │
└─────────────────────────────────────────────────────────┘

6 THÁNG+ (khi có > 1,000 users):
┌─────────────────────────────────────────────────────────┐
│  Fine-tuning pipeline                                   │
│  Multi-region deployment (Fly.io)                       │
│  PvP / realtime features (nếu trong GDD)               │
└─────────────────────────────────────────────────────────┘
```

---

## Budget ước tính (Monthly)

| Component | Free tier | Paid tier | Notes |
|-----------|-----------|-----------|-------|
| Railway (hosting) | $5 free credit | $20/mo | 1 service, 1 GB RAM |
| Cloudflare R2 (backup) | 10 GB free | ~$0.50/mo | Backups < 5 GB |
| Sentry (errors) | 5K errors/mo | $26/mo | Free tier đủ cho beta |
| UptimeRobot | Free | Free | 50 monitors |
| PostHog (analytics) | 1M events/mo | $0 | Self-host option |
| Grafana Cloud | Free | Free | 10K metrics/month |
| **Total** | **~$5/mo** | **~$50/mo** | Tăng theo users |

**Cost drivers thực sự:**
```
Google AI API (Gemini):
  Beta (100 users × 5 chaps/day):   ~$2.50/ngày = $75/tháng
  Growth (1K users × 5 chaps/day):  ~$25/ngày = $750/tháng
  Scale (10K users × 5 chaps/day):  ~$250/ngày → cần optimize/tier

→ Đây là lý do Amo Sentinel là critical: LLM cost >> infrastructure cost
```

---

## Success Metrics — Hệ thống vận hành

| Metric | Target | Đo bằng |
|--------|--------|---------|
| Uptime | > 99.5% | UptimeRobot |
| Chapter generation P95 | < 30s | Amo Ops |
| Error rate | < 2% | Sentry |
| Critic score avg | > 7.5/10 | Custom metrics |
| Time to detect incident | < 5 phút | Alerts |
| Time to deploy | < 10 phút | GitHub Actions |
| Recovery time (disaster) | < 30 phút | Amo Vault |
| Cost per chapter | < $0.001 | Amo Sentinel |

---

## Hệ thống đã có — Không cần xây thêm

| Hệ thống | Đã có | Ghi chú |
|----------|-------|---------|
| Authentication | ✅ Amo Guardian | Supabase JWT, ownership checks |
| Security headers | ✅ Amo Guardian | CSP, HSTS, X-Frame |
| Prompt injection defense | ✅ Amo Guardian | 18 patterns, length cap |
| Unit test generation | ✅ Amo Test Pilot | JS + Python |
| E2E test generation | ✅ Amo Test Pilot | FastAPI integration tests |
| Narrative quality review | ✅ Amo Test Pilot | Multi-dimension AI scoring |
| Input validation | ✅ Amo Guardian | Per-router sanitization |
| Production startup guard | ✅ Amo Guardian | ENV=production check |

---

*File này là living document — cập nhật khi priorities thay đổi hoặc hệ thống được xây xong.*
