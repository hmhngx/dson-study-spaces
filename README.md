# 🏫 Dickinson Study Spaces

A full-stack web application to help Dickinson College students find and explore study spaces on campus, with interactive maps and building details.

> **ℹ️ Note:** When using the website, please allow location permissions in your browser for the best experience. This enables features like sorting study spaces by distance from your current location.

## 🚀 Features
- 🗺️ Interactive map with study space locations using Mapbox
- 📍 View building details, including addresses, hours, and status
- 📏 Sort study spaces by distance from your location
- 🎨 Modern design system with Material 3 principles
- 🎭 Glassmorphic UI components for content presentation
- 🔧 Enhanced dropdown system with icons and animations
- 📝 Google Fonts integration (Inter & Poppins)
- 📱 Responsive and user-friendly interface

## 🛠️ Tech Stack
- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Node.js, Express
- **Mapping**: Mapbox, Google Maps API (for geocoding)
- **Design System**: Custom UI components with Material 3 design
- **Typography**: Google Fonts (Inter, Poppins)
- **Deployment**: Vercel

## 🎨 Design System

### Components
- **DesignSystemExample**: Showcase of utility controls and content presentation patterns
- **DropdownExamples**: Enhanced dropdown menus with Material 3 design
- **FontExample**: Typography demonstration and font configuration guide

### Design Principles
- **Utility Components**: Solid backgrounds for maximum readability and accessibility
- **Content Components**: Glassmorphic cards for modern, polished visual appeal
- **Typography**: Inter for body text, Poppins for headings and UI elements
- **Animations**: Smooth 150ms transitions with hover micro-interactions

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
The backend is a simple Node.js server and doesn't require a separate build step for production. Deploy it directly to Vercel (see Deployment section below).

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

## 🎨 Customization

### Fonts
The application uses Google Fonts with a flexible configuration system. To change fonts:

1. Edit `front-end/src/lib/fonts.js`
2. Update the `FONT_CONFIG` object
3. Available fonts: Inter, Roboto, Open Sans, Lato, Nunito, Source Sans 3, Poppins, Montserrat

### Design System
- Utility components use solid backgrounds for maximum accessibility
- Content components use glassmorphism for modern visual appeal
- All components follow Material 3 design principles
- Smooth animations and hover effects throughout

## 🤝 Contributing
Contributions are welcome! Please follow these steps:

- Fork the repository
- Create a new branch (git checkout -b feature-branch)
- Commit your changes (git commit -m "Add new feature")
- Push to your fork (git push origin feature-branch)
- Submit a Pull Request

## 📝 Recent Updates
- ✨ Added comprehensive design system with Material 3 principles
- 🎭 Implemented glassmorphic UI components for content presentation
- 🔧 Enhanced dropdown system with icons and smooth animations
- 📝 Integrated Google Fonts (Inter & Poppins) with flexible configuration
- 🎨 Updated component styling with modern design patterns
- 📱 Improved responsive design and accessibility