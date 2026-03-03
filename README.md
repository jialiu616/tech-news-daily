# Tech News Daily

A modern web application that aggregates and displays the latest technology news from multiple sources including Hacker News, TechCrunch, Reddit's r/technology, and Ars Technica.

## Features

- 📰 Real-time tech news aggregation from multiple sources
- 🔄 Automatic daily updates
- 📱 Fully responsive design
- ⚡ Fast loading with caching
- 🔍 Clean, modern interface
- 🌐 Hosted on GitHub Pages

## Sources

- Hacker News
- TechCrunch
- Reddit r/technology
- Ars Technica

## How It Works

The application fetches news from multiple RSS feeds and APIs, combines them, sorts by publication date, and displays the 30 most recent articles. News is automatically refreshed every hour and cached locally for better performance.

## Deployment

This site is automatically deployed to GitHub Pages. Updates happen daily through the built-in refresh mechanism.

## Local Development

1. Clone the repository
2. Open `index.html` in a web browser
3. Or serve with a local server:
   ```bash
   python -m http.server 8000
   ```

## Technologies Used

- HTML5
- CSS3 (Flexbox/Grid)
- Vanilla JavaScript (ES6+)
- Fetch API
- Local Storage
- Responsive Design

## License

MIT License - Feel free to fork and modify!