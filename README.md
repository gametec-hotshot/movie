# PRISM - Premium Streaming Interface

PRISM is a high-performance, single-page streaming interface built with vanilla JavaScript, HTML5, and CSS3. This project is designed as a **UI/UX showcase** to demonstrate modern web development principles, including glassmorphism, dynamic animations, and complex state management without external frameworks.

## ⚠️ Legal Disclaimer

**PRISM is an educational project.** 
- **No Hosting**: This application does not host, store, or distribute any media files. 
- **Third-Party Content**: All movie metadata is retrieved in real-time from the TMDb API. All video playback is handled by third-party external providers.
- **Copyright**: If you are a copyright holder, please contact the respective content providers directly. PRISM acts solely as a user interface layer and has no control over external media.
- **Privacy**: No user data is collected. All personalization features (Watchlist, History) are stored locally in the user's browser.

## 🚀 Features

- **State-of-the-Art UI**: Glassmorphic navigation, custom Netflix-style scrollbars, and pulsing skeleton loaders.
- **Dynamic Discovery**: Infinite scroll, multi-provider filtering (Netflix, Disney+, etc.), and genre-based sorting.
- **Native Experience**: Fully PWA-ready for home-screen installation on iOS and Android. Includes safe-area/notch support.
- **Smart Hero**: An auto-rotating hero banner featuring the week's top trending titles.
- **Interactive Details**: Cast credits with actor search, "More Like This" recommendations, and direct YouTube trailer links.
- **Watchlist & Progress**: Locally persistent "My List" and "Continue Watching" queues.

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3.
- **API**: TMDb API (The Movie Database).
- **Persistence**: Browser LocalStorage.
- **Optimization**: Intersection Observer API for animations and lazy loading.

## 📦 Setup & Installation

1. Clone the repository.
2. Open `index.html` in any modern web browser.
3. *Note*: To use your own API key, replace the `TMDB_API_KEY` constant at the top of the script.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
