# Inview MVP demo

A working demo of Inview for one gallery, built as a PWA (an installable web app).
All content is mock data. Nothing is sent to a server: sign-ins, saved works and
passport stamps are stored only in each visitor's own browser.

## What's inside

| Address | What it shows |
|---|---|
| `/g/rooz-gallery` | Visitor welcome page (the QR code points here) |
| `/g/rooz-gallery/works` | Artworks with filters |
| `/g/rooz-gallery/works/<id>` | One artwork: save, ask, follow |
| `/g/rooz-gallery/prices` | Price list |
| `/g/rooz-gallery/about` | Artists, exhibition text, visit info |
| `/me` | Visitor profile and gallery passport |
| `/dashboard` | Gallery dashboard (demo password: `inview`) |

The visitor side works in English and Persian (toggle at the top right).
In the demo, any 4-digit SMS code is accepted.

## 1. Run it on your Mac

```bash
cd inview-mvp
npm install
npm run dev
```

Open the address it prints, usually http://localhost:5173.

To try it on your phone, connect the phone to the same Wi-Fi and run:

```bash
npm run dev -- --host
```

Then open the "Network" address it prints on your phone.

## 2. Change the content

Everything lives in **`src/data/gallery.ts`**: gallery name, show title and dates,
artworks, prices, statuses and the dashboard numbers. Artwork images go in
`public/artworks/`. Save the file and the page updates.

Change the dashboard password in the same file (`dashboardPassword`).

## 3. Put it on GitHub

1. On github.com, create a new empty repository named `inview-mvp`
   (no README, no .gitignore).
2. In Terminal, inside the project folder:

```bash
git init
git add .
git commit -m "Inview MVP demo"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/inview-mvp.git
git push -u origin main
```

## 4. Put it online

Pick one host and connect your GitHub repository. Every `git push` updates the site.

- **Vercel** (vercel.com): Add New Project → import `inview-mvp` → Deploy.
  It detects Vite automatically. `vercel.json` already handles page refreshes.
- **Cloudflare Pages**: Create project → connect GitHub → build command
  `npm run build`, output folder `dist`. `public/_redirects` handles page refreshes.
- **Liara or ArvanCloud** (Iranian hosts): use their static-site option with the
  same build command and `dist` folder, and turn on single-page-app mode.

Open the site from an Iranian mobile connection before showing it. If a foreign
host is slow or blocked, use an Iranian host.

## 5. Connect your domain

1. In your host's dashboard, add your domain (for example `app.yourdomain.com`).
2. The host shows a DNS record to create (usually `CNAME`).
3. Add that record at your domain registrar.
4. HTTPS is issued automatically. A PWA needs HTTPS to install.

## 6. Make the QR code

Create a QR code that opens `https://app.yourdomain.com/g/rooz-gallery`,
print it and put it at the gallery entrance.

## 7. Test before the demo

- iPhone: open in Safari → Share → Add to Home Screen.
- Android: open in Chrome → Install app.
- Chrome on desktop: DevTools → Lighthouse → check the PWA result.
- On the profile page, "Reset demo" clears everything for the next person.

## Notes

- Prices and dashboard numbers are illustrative. Get the artists' permission
  before showing their works publicly.
- This demo stores nothing on a server. Collecting real phone numbers needs a
  backend, an SMS provider and a privacy policy (next stage).
