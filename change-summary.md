# Auction PAcked v3.0

Release Date: April 11, 2026
Tag: v3.0

## Summary

1. Added automatic invalidation and reload for Insights batting-position cache when completed matches change.
2. Added safe in-flight reload request handling to avoid stale role-efficiency views.
3. Preserved scoring integrity by keeping all points logic unchanged.
4. Validated behavior with a browser-only, in-memory simulation that restored state and did not write to Firebase.

## Files Updated

- index.html
- LEARNINGS.md
- changes_summary.md
