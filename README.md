# 🏫 Dickinson Study Spaces

A full-stack web application to help Dickinson College students find and explore study spaces on campus, with interactive maps and building details.

## 🚀 Features
- 🗺️ Interactive map with study space locations using Mapbox
- 📍 View building details, including addresses, hours, and status
- 📏 Sort study spaces by distance from your location
- 🎨 Responsive and user-friendly UI

## 🛠️ Tech Stack
- **Frontend**: Next.js, React, CSS
- **Backend**: Node.js, Express
- **Mapping**: Mapbox, Google Maps API (for geocoding)
- **Deployment**: Vercel

## 📦 Installation

### Clone the repository:
```sh
git clone https://github.com/yourusername/dickinson-study-spaces.git
cd dickinson-study-spaces

```
### Install dependencies for both frontend and backend:
## Frontend:
```sh
cd front-end
npm install

```
## Backend:
```sh
cd ../back-end
npm install

```
### Start the development servers:
## Backend:
``` sh
cd back-end
npm run start

```
The backend should be running on http://localhost:3002.

## Frontend:
``` sh
cd front-end
npm run dev

```
Open http://localhost:3000 in your browser to view the app.

## 🏗️ Build for Production
### Frontend:
``` sh
cd front-end
npm run build

```
### Backend:
The backend is a simple Node.js server and doesn’t require a separate build step for production. Deploy it directly to Vercel (see Deployment section below).

## 🌐 Deployment
The app is deployed on Vercel with a single-domain setup for simplicity:
- Public URL: https://dson-study-spaces.vercel.app/home

### Deploy to Vercel:
### Frontend:
``` sh
cd front-end
vercel --prod

```
### Backend:
``` sh
cd back-end
vercel --prod

```

## 🤝 Contributing
Contributions are welcome! Please follow these steps:

- Fork the repository
- Create a new branch (git checkout -b feature-branch)
- Commit your changes (git commit -m "Add new feature")
- Push to your fork (git push origin feature-branch)
- Submit a Pull Request