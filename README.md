# PRISM - Premium Streaming Interface

PRISM is a high-performance, single-page streaming interface built with vanilla JavaScript, HTML5, and CSS3. This project is designed as a **UI/UX showcase** to demonstrate modern web development principles, including glassmorphism, dynamic animations, and complex state management without external frameworks.

## ⚠️ Legal Disclaimer

**PRISM is an educational project.** 
- **No Hosting**: This application does not host, store, or distribute any media files. 
- **Third-Party Content**: All movie metadata is retrieved in real-time from the TMDb API. All video playback is handled by third-party external providers.
- **Copyright**: If you are a copyright holder, please contact the respective content providers directly. PRISM acts solely as a user interface layer and has no control over external media.
- **Privacy**: No user data is collected. All personalization features (Watchlist, History) are stored locally in the user's browser.

## 🚀 Features

- **State-of-the-Art UI**: Glassmorphic navigation, custom Netflix-style scrollbars, pulsing skeleton loaders, and an auto-rotating hero banner.
- **Movies & TV Shows**: Infinite scroll discovery, multi-provider filtering (Netflix, Disney+, etc.), and genre-based sorting.
- **Dedicated Anime Hub**: Seamless integration of Top Rated, Trending, and Popular anime series.
- **Live Sports Ecosystem**:
  - **24/7 Channels**: Real-time sorted grid of live TV channels ordered by active viewer count.
  - **Live Matches**: Detailed match schedules (Football, Cricket, etc.) with real-time "LIVE" or "UPCOMING" badges.
  - **Stream Selector Modal**: Advanced multi-server selection allowing users to choose specific streaming servers, languages, and quality (HD/SD) to bypass network congestion.
- **Advanced Player Engine**:
  - Unified modal player supporting third-party iframes and direct `.m3u8` video streaming.
  - **Smart Autoplay**: Configurable auto-play for next TV episodes with global toggle settings.
  - **Auto-Close Ad Detection**: Intelligent background detection to automatically close ad-popups triggered by third-party streaming sites.
- **Universal Watch Tracker**: Automated, persistent progress tracking that remembers exactly which season and episode you are on for any TV show or Anime.
- **Cache Management**: Powerful local storage dashboard allowing users to completely control their data by Exporting, Importing, and safely clearing their watch history and application cache.
- **Mobile & Native Experience**: Fully responsive design with a sleek mobile hamburger menu, PWA-ready for home-screen installation on iOS and Android, and safe-area/notch support.
- **Interactive Details**: Deep-dive modals featuring cast credits with actor search, "More Like This" recommendations, comprehensive season/episode browsers, and direct YouTube trailer links.
- **Watchlist**: Locally persistent "My List" queue to save titles for later.

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3.
- **APIs Used**: 
  - TMDb API (The Movie Database) for Metadata.
  - Streamed.pk API & CDNLivetv API for Live Sports.
- **Persistence**: Browser LocalStorage & IndexedDB (Cache Storage API via Service Workers).
- **Optimization**: Intersection Observer API for animations/lazy loading, Network-first Service Worker caching.

## 📦 Setup & Installation

1. Clone the repository.
2. Open `index.html` in any modern web browser.
3. *Note*: To use your own API key, replace the `TMDB_API_KEY` constant at the top of the script.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
