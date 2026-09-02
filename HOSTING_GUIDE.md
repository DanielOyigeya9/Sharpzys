# 🚀 FlyNow — Easy Hosting & Deployment Guide

This repository is pre-configured for **1-click fullstack deployment**. The Express backend serves the React frontend production bundle from `client/dist`, so you only need to host **one single service**.

---

## Option 1: Render.com (Recommended — 1-Click Free Hosting)

1. Push your repository to **GitHub** or **GitLab**.
2. Log into [Render.com](https://render.com) and click **New +** → **Blueprint**.
3. Connect your repository. Render will automatically detect `render.yaml` and configure everything.
4. Click **Apply**. Render will install dependencies, build the frontend (`vite build`), and start the Node server (`npm start`).

*Manual Render Web Service Setup (Alternative):*
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Environment Variable:** `NODE_ENV = production`

---

## Option 2: Railway.app (Fast 1-Click Deployment)

1. Go to [Railway.app](https://railway.app) and create a **New Project**.
2. Select **Deploy from GitHub repo**.
3. Railway automatically detects `Procfile` and deploys your application using `npm start`.

---

## Option 3: Docker Deployment (AWS / Cloud Run / DigitalOcean / VPS)

Run locally or on any server with Docker installed:

```bash
# Build Docker image
docker build -t flynow-app .

# Run container on port 5000
docker run -d -p 5000:5000 --name flynow flynow-app
```

---

## Option 4: Deploying on your own VPS (Ubuntu / Debian / Nginx)

1. Clone your repo onto the VPS.
2. Run:
   ```bash
   npm install
   npm run build
   npm start
   ```
3. Use `pm2` to keep the process running:
   ```bash
   npm install -g pm2
   pm2 start server/app.js --name "flynow"
   pm2 save
   ```

---

## ⚡ Summary of Included Deployment Config Files

- `Procfile` → Automatic startup configuration for Heroku, Railway, Dokku, Render
- `render.yaml` → 1-click Render blueprint specification
- `Dockerfile` & `.dockerignore` → Multi-stage production container build
- `vercel.json` → Static bundle deployment routing for Vercel
