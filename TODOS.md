# TODOs

## P2: Re-enable dormant scraper sources
- **What:** Test and add working scrapers for United Country, FarmFlip, Mossy Oak, Whitetail, LandSearch, Realtor.com
- **Why:** More sources = more listings = better farm coverage. Currently only 4 of 10 sources are active.
- **Context:** Each site needs URL verification, HTML analysis, and possibly a custom parser. With the scheduled CI scrape, there's no time pressure. Test one at a time.
- **Effort:** S per source (CC: ~10 min each), M total
- **Depends on:** Scheduled scrape CI pipeline being set up
- **Added:** 2026-04-05 via /plan-eng-review

## P3: Persistent database (Neon Postgres)
- **What:** Replace in-memory cache / static JSON with Postgres for real persistence
- **Why:** Enables real price history across days, saved searches, and the foundation for alerts
- **Context:** Static JSON approach works for current usage (1 person, few days/week). DB is the upgrade path if this grows or if you want richer features like price tracking over time.
- **Effort:** L (human) / M (CC: ~30 min)
- **Depends on:** Static JSON proving the concept first
- **Added:** 2026-04-05 via /plan-eng-review
