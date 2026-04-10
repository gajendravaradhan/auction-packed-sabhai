auctionpacked v19
Clean rewrite done. All fixes are correctly applied in one coherent file:

- No syntax errors — single script block, all braces matched
- VC uses Math.floor, Captain uses Math.round
- Economy bands: <4=+40, 4-5=+35, 5-6=+25, 6-9=+20, 9-11=+5, 11-13=-10, 13+=-20
- SR condition: balls >= 8 OR runs >= 15 (with balls > 0 guard)
- Economy condition: overs >= 2 (= 12 balls, correct since overs stored as true decimal)
- AbortSignal.timeout polyfill at top
- initMatchDayWatcher() called on load
- Collapse/Expand/Refresh All buttons render correctly
- C/VC deadline enforced
- williamgeorgejacks alias present
- POTM correctly excluded from C/VC bonus base in breakdown