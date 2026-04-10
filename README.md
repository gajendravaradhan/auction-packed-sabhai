# Auction Packed · Live

**Version:** 1.0  
**Status:** Production Ready  
**Last Updated:** April 10, 2026

A comprehensive fantasy cricket scoring platform for the IPL 2026 season. Real-time match tracking, live fantasy points calculation, and team management all in one beautifully designed application.

---

## 🎯 Key Features

### 📊 **Leaderboard & Scoring**
- **Live Fantasy Points Leaderboard**: Real-time ranking of all participating teams with instant point updates
- **Team Roster View**: Expandable squad display showing individual player contributions
- **Captain/Vice-Captain Multipliers**: 2x for Captain, 1.5x for Vice-Captain (applied to all innings including current match)
- **BPL Indicator**: Automatic marking of bottom-performing teams for better visibility
- **Dynamic Sorting**: Auto-sorting by total points with consistent ranking display

### 🏏 **Live Match Tracking**
- **Real-time Match Status**: Live, Done, Today, and Upcoming match indicators
- **Match Card Display**: Quick view of match details - teams, venue, date, and time
- **Expandable Match Details**: View team-wise fantasy point breakdowns for any match
- **Scroll-to-Current**: Auto-scroll to today's or next upcoming match on demand
- **Comprehensive Schedule**: Full IPL 2026 schedule (74 matches including playoffs)

### 👥 **Player Statistics**
- **Complete Player Database**: All 10 IPL teams with complete squad rosters
- **Role-Based Filtering**: Filter by roles (Batter, Bowler, All-rounder, Wicket-keeper)
- **Live Performance Tracking**: Real-time points calculation with per-role scoring rules
- **Player Detailed Modal**: Click any player to view full statistics and performance breakdown
- **Sortable Rankings**: Players ranked by total fantasy points

### 🎙️ **Live Match Commentary**
- **Ball-by-Ball Updates**: Real-time commentary during live matches
- **Live Scoring Panel**: Current match scoring and team performance
- **Performance Tracking**: Real-time fantasy points for players in the current match
- **Multi-Source Integration**: Data from CricAPI and ESPN RapidAPI for comprehensive coverage

### 🏆 **Captain/Vice-Captain Selection**
- **Per-Team Selection**: Each team picks one Captain and one Vice-Captain
- **Permanent Lock-In**: Selections are locked permanently once confirmed
- **Multiplier Display**: Clear indication of multiplier application (C: 2x, VC: 1.5x)
- **Competitive Assignment**: Visual identification of C/VC across all teams in leaderboard

### 🔐 **Admin Dashboard**
- **Password-Protected Access**: Secure admin panel for data management
- **Match Import Control**: 
  - Import all scheduled matches from CricAPI
  - Manual import by specific match UUIDs
  - Real-time import progress tracking with status panel
- **Score Management**:
  - Manual score updates for matches
  - Performance data entry and editing
  - Captain/Vice-Captain override capability
- **Data Synchronization**:
  - ESPN CricInfo data fetch and integration
  - Bowler dot data parsing from ESPN
  - Player of the Match (POTM) data import
  - Admin verification modal for data integrity checking
- **Import Status Panel**: Live feedback showing:
  - Current import state (RUNNING/LAST RUN/FAILED)
  - Progress counters (Imported/Refreshed/Failed/Missing ID)
  - Timestamps and detailed summary messages

---

## 📱 User Interface

### Screens
1. **Landing Screen**: Choose between Viewer, CV Picker, or Admin access
2. **Main App Screen**: Tabbed interface with all viewing options
3. **Admin Login**: Password-protected entry to admin features
4. **Player Modal**: Detailed stats popup for individual players
5. **ESPN Verification Modal**: Admin tool to verify imported data

### Navigation Tabs
- **Board**: Fantasy points leaderboard with team rosters
- **Matches**: Full schedule with match details and scores
- **Players**: Searchable player statistics by role
- **Live**: Real-time commentary and ball-by-ball updates
- **C/VC**: Captain and Vice-Captain selection interface
- **Admin**: (Visible only when logged in) Management tools

---

## 🎮 Gameplay Mechanics

### Fantasy Points Calculation

**Batting:**
- Runs: +1 point per run
- Boundary (4): +1 point
- Six: +2 points
- Dismissal: -2 points
- 30-49 runs: +4 bonus points
- 50+ runs: +8 bonus points

**Bowling:**
- Wicket: +25 points
- Maiden over: +12 points
- Dot ball: +1 point
- Economy rate <5: +4 bonus points
- Economy rate 5-8: +0 bonus points
- Economy rate >8: -4 penalty points
- Bonus for 3-4 wickets: +4 bonus points
- Bonus for 5 wickets: +8 bonus points

**Fielding:**
- Catch: +8 points
- Stumping: +10 points
- Run out (direct): +12 points

**Multipliers:**
- Captain: 2x points (applies to all innings)
- Vice-Captain: 1.5x points (applies to all innings)

---

## 🚀 Getting Started

### For Users
1. Open the application in a modern web browser
2. Click **"View Leaderboard"** to see current standings
3. Click **"Pick C/VC"** to select your team's captain and vice-captain
4. Select a team from the dropdown
5. Click on players to mark them as Captain or Vice-Captain
6. Review and click **"Lock In Picks"** to confirm (permanent selection)
7. Monitor **Matches** tab for match schedules and team performances
8. Check **Players** tab for individual player statistics

### For Admins
1. Click **"Admin"** on the landing page
2. Enter the admin password
3. Use the Admin Dashboard to:
   - **Import All Scheduled Matches**: Fetch data from CricAPI for all scheduled matches up to today
   - **Reset ESPN Checkpoint**: Clear ESPN data for re-import
   - **Fetch ESPN Data**: Pull and integrate ESPN CricInfo data
   - **Manual Import by UUID**: Import specific matches by their CricAPI UUID
   - **Verify Data**: Check imported bowler dot data and POTM assignments
   - **C/VC Override**: Modify team Captain/Vice-Captain selections

---

## 🔗 Data Sources

### CricAPI
- **Primary source** for match schedules, scores, and detailed performance data
- **IPL 2026 Series ID**: 87c62aac-bc3c-4738-ab93-19da0690488f
- **Data includes**: Match details, player performances, wickets, runs, extras

### ESPN RapidAPI (CricInfo)
- **Secondary source** for bowler dot data and Player of the Match
- **Integration**: Arrows (dots) for bowlers taken from ESPN responses
- **Player of the Match**: Auto-populated from ESPN match results

### Firebase Realtime Database
- **Data Persistence**: All match data, scores, and captain selections
- **Live Synchronization**: Real-time updates across all devices
- **Backup Storage**: ID mapping for CricAPI match UUIDs

---

## 🛠 Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Database**: Firebase Realtime Database
- **APIs**: 
  - CricAPI (cricket data)
  - ESPN RapidAPI (CricInfo)
- **Hosting**: GitHub Pages
- **Fonts**: Google Fonts (Barlow Condensed, Rajdhani)
- **Design**: Custom CSS with responsive layout

---

## 📊 Data Management

### Import Pipeline
1. **Schedule Import**: Fetch all IPL 2026 matches from CricAPI series data
2. **Match Resolution**: Match schedule entries to CricAPI UUIDs via team + date lookup
3. **Scorecard Import**: Fetch detailed match scorecards for performance data
4. **ESPN Enhancement**: Overlay bowler dots and POTM from ESPN
5. **Firebase Persistence**: Save all data for durability and sync

### Import Status Tracking
- Real-time progress panel shows import state
- Live counters: matches imported, refreshed, failed, or missing CricAPI ID
- Detailed timestamps and summary messages
- Automatic retry logic for failed imports

---

## ⚙️ Configuration

### Admin Password
Configure the admin access password in `index.html` (line ~2800):
```javascript
const adminPassword = 'your_password_here';
```

### Firebase Database
Update Firebase configuration in `index.html` (approx line 15-22):
```javascript
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN.firebaseapp.com",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});
```

### CricAPI Integration
- API Key is already configured for IPL 2026 data
- Daily request limit: 2000 calls
- Endpoints: `/currentMatches`, `/series_info`, `/match_scorecard`

---

## 🐛 Known Limitations

- **Live Score Updates**: Require admin to manually trigger ESPN fetch for latest data
- **Historical Data**: Older matches require full schedule import to populate
- **Timezone**: All times displayed in match schedule timezone
- **Browser Support**: Requires modern browser (Chrome, Firefox, Safari, Edge)

---

## 📈 Version History

### v1.0 (April 10, 2026)
- ✅ Full fantasy cricket scoring system
- ✅ Real-time leaderboard with live updates
- ✅ Complete player database and filtering
- ✅ Captain/Vice-Captain selection with permanent lock-in
- ✅ CricAPI integration for match data
- ✅ ESPN data import for bowler dots and POTM
- ✅ Admin dashboard with import management
- ✅ Import status panel with real-time progress tracking
- ✅ Firebase persistence and sync
- ✅ Responsive design for mobile and desktop
- ✅ Hard-coded CricAPI UUIDs for completed matches (1-15)
- ✅ Historical match backfill capability
- ✅ Complete IPL 2026 schedule (74 matches)

---

## 🤝 Support & Contributions

For bug reports, feature requests, or issues, please check the logs and admin verification modals for detailed error information.

---

## 📄 License

Private project. All rights reserved.

**Built with ❤️ for IPL Fantasy Cricket Season 2026**
