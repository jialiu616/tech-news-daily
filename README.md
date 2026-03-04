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

### Automated Deployment
1. Run the deployment script: `./deploy.sh`
2. Follow the prompted instructions to create a GitHub repository
3. Enable GitHub Pages in your repository settings

### Manual Deployment Steps
1. Create a new repository on GitHub named `tech-news-daily`
2. Add the remote: `git remote add origin https://github.com/YOUR_USERNAME/tech-news-daily.git`
3. Push to GitHub: `git push -u origin main`
4. Enable GitHub Pages:
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: main, Folder: / (root)
   - Save

Your site will be live at: `https://YOUR_USERNAME.github.io/tech-news-daily`

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