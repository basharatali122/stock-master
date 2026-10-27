# Project rules
- Keep the supplied document logo in the shared print utility so every print path, including each individual invoice header, receives it (top-left full-size plus a small ~56px brand/agency mark top-right) without adding it to application screens.
- Resolve the CDN print-logo pointer against the app's published Lovable origin so print windows also load it in localhost and Vercel deployments.
- Keep source price-sheet imports as explicit per-box catalog fixtures with source pack sizes and zero initial stock; this preserves auditability without inventing inventory.