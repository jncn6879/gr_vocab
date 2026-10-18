# Lexi

Lexi is a clean, personal Greek vocabulary practice app. Add your own Greek words and English meanings, then practise with flip cards in either direction.

## Features

- Add a single word or enter several words at once
- Study today, yesterday, favourites, difficult cards, or everything
- Greek-to-English and English-to-Greek recall
- Correct and missed-answer tracking
- Browser storage that remembers your collection on the current device
- Responsive desktop and mobile design

## Publish with GitHub Pages

1. Upload all files to a GitHub repository with `main` as its default branch.
2. Open the repository’s **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open the repository’s **Actions** tab and allow the “Deploy Lexi to GitHub Pages” workflow to finish.

The live URL will appear in the completed workflow and on the repository’s Pages settings screen. Every later push to `main` republishes the site automatically.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## Storage note

GitHub Pages is static hosting, so vocabulary is stored in the browser rather than a cloud database. Words remain after closing the site, but collections do not automatically sync between devices or browsers.
