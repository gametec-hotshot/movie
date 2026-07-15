# PRISM - Premium Streaming Interface

PRISM is a high-performance, single-page streaming interface built with vanilla JavaScript, HTML5, and CSS3. This project is designed as a **UI/UX showcase** to demonstrate modern web development principles, including glassmorphism, dynamic animations, and complex state management without external frameworks.

## ⚠️ Educational Showcase & Disclaimer

**PRISM is strictly an educational project and UI/UX showcase.**

- **DO NOT CONTACT ME**: I hold absolutely no control, liability, or connection to the media displayed. There is zero point in contacting me regarding copyright takedowns.
- **Direct All Claims to Providers**: If you have an issue with the content, your **ONLY option** is to contact the third-party server providers directly (the servers embedding the video). I cannot remove content from the internet.
- **Zero Hosting**: I do not host, store, or distribute any media files. The app merely aggregates publicly available APIs and iframe links found on the internet.
- **Freedom of Code**: This repository exists simply to demonstrate my developing skills. Coding is a free language. You are free to fork this, learn from it, and use it however you want.

## 🚀 Features

- **State-of-the-Art UI**: Glassmorphic navigation, custom Netflix-style scrollbars, pulsing skeleton loaders, and an auto-rotating hero banner.
- **Movies & TV Shows**: Infinite scroll discovery, multi-provider filtering (Netflix, Disney+, etc.), and genre-based sorting.
- **Dedicated Anime Hub**: Seamless integration of Top Rated, Trending, and Popular anime series.
- **Live Sports & Global IPTV Ecosystem**:
  - **Global IPTV Directory**: Browse thousands of live TV channels worldwide, categorized by genre (Sports, Global News, Entertainment) and by country.
  - **Live Match Hubs**: Dedicated schedules for live sports matches spanning all major categories (Football/Soccer, Basketball, NFL, Baseball, Motorsport, Fight, Hockey, Rugby, Cricket).
  - **Real-Time Interactive Tracking**: Live dynamic countdowns to upcoming kickoffs that automatically transition to "LIVE NOW" indicators.
  - **Smart Broadcaster Matching**: Automatically links live matches to their respective 24/7 TV channels, prioritizing Ad-Free direct streams.
  - **Stream Selector & Embeds**: Multi-server selection allowing users to choose specific servers, languages, and qualities (HD/SD). Includes iframe generation for embedding streams.
  - **Smart Fallback Content**: Automatically recovers missing team logos and match posters to ensure a consistent, beautiful UI.
- **Advanced Player Engine**:
  - Unified modal player supporting third-party iframes and direct `.m3u8` video streaming.
  - **Expansive Server Selection**: Over 40+ streaming servers categorized by quality (Ad-Free, 4K, Fallbacks).
  - **Popup & Ad Protection**: Built-in protections that actively block malicious ad-popups from third-party streaming sites, alongside a dedicated AdBlocker detection system to ensure a smooth UI experience.
  - **Smart Autoplay**: Configurable auto-play for next TV episodes with global toggle settings.
- **Universal Watch Tracker**: Automated, persistent progress tracking that remembers exactly which season and episode you are on for any TV show or Anime.
- **Cloud Sync**: Watchlist and Continue Watching automatically sync across all your devices in real-time.
- **Account System**: Sign Up / Sign In with email. Your personal data follows you everywhere.
- **Trakt.tv Integration**: Two-way sync with Trakt.tv for automated watch tracking.
- **Cache Management**: Local storage dashboard allowing users to Export, Import, and safely clear their watch history and application cache. Old user data is seamlessly upgraded automatically.
- **Smart Poster Recovery**: Missing posters automatically fallback and fetch directly from TMDB on any device.
- **Mobile & Offline Ready (PWA)**: Fully responsive design with a sleek mobile hamburger menu, ready for home-screen installation on iOS and Android. Works seamlessly offline and loads quickly.
- **Interactive Details**: Deep-dive pages featuring cast credits with actor search, "More Like This" recommendations, comprehensive season/episode browsers, and direct YouTube trailer links.
- **Watchlist**: Persistent "My List" queue to save titles for later, synced across your devices.

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3.
- **Architecture**: Multi-Page routing system (`index.html`, `details.html`, and `iptv.html`) that maintains smooth SPA-like transitions while providing robust native browser history support. Modularity achieved via dedicated feature files (`main.js`, `iptv.js`, `esportex.js`, `style.css`).
- **Backend/Auth**: Supabase (PostgreSQL, Auth, Realtime).
- **External Integrations**: Trakt.tv API (OAuth2).
- **APIs Used**: 
  - TMDb API (The Movie Database) for Metadata.
  - CDNLivetv API & Esportex API for Live Sports streaming.
  - IPTV-org API for global 24/7 live TV channels data.
- **Persistence**: Supabase Cloud DB, Browser LocalStorage & IndexedDB (Cache Storage API via Service Workers).
- **Optimization**: Intersection Observer API for animations/lazy loading, Network-first Service Worker caching.

## 📦 Setup & Installation

1. Clone the repository.
2. Open `index.html` in any modern web browser.
3. *Note*: To use your own API key, replace the `TMDB_API_KEY` constant at the top of the script.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
