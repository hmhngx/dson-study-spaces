"use client"
import { useState, useEffect } from 'react'
import { MapPin } from 'lucide-react'

export default function Loader() {
  const [progress, setProgress] = useState(0)
  const [loadingText, setLoadingText] = useState('Initializing...')
  const [titleVisible, setTitleVisible] = useState(false)
  const [subtitleVisible, setSubtitleVisible] = useState(false)

  useEffect(() => {
    // Staggered animations for title and subtitle
    const titleTimer = setTimeout(() => setTitleVisible(true), 300)
    const subtitleTimer = setTimeout(() => setSubtitleVisible(true), 800)

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        
        // Update loading text based on progress
        if (prev < 25) {
          setLoadingText('Loading study spaces...')
        } else if (prev < 50) {
          setLoadingText('Fetching building data...')
        } else if (prev < 75) {
          setLoadingText('Preparing map...')
        } else {
          setLoadingText('Almost ready...')
        }
        
        return prev + Math.random() * 12 + 3
      })
    }, 150)

    return () => {
      clearInterval(interval)
      clearTimeout(titleTimer)
      clearTimeout(subtitleTimer)
    }
  }, [])

  return (
    <div className="fixed inset-0 w-full h-full flex items-center justify-center overflow-hidden">
      {/* Premium Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
        {/* Subtle gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/5"></div>
        
        {/* Abstract geometric patterns */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-tl from-purple-400 to-indigo-400 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-indigo-300 to-purple-300 rounded-full blur-2xl"></div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col items-center justify-center space-y-12 p-8 max-w-2xl mx-auto">
        {/* Pulsing Location Pin */}
        <div className="relative">
          {/* Multiple pulse rings */}
          <div className="absolute inset-0 w-32 h-32 bg-indigo-400/20 rounded-full animate-ping"></div>
          <div className="absolute inset-0 w-32 h-32 bg-purple-400/15 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
          <div className="absolute inset-0 w-32 h-32 bg-indigo-300/10 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
          
          {/* Glassmorphism pin container */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl flex items-center justify-center">
              <MapPin 
                className="w-10 h-10 text-white drop-shadow-lg" 
                fill="currentColor"
              />
            </div>
          </div>
        </div>

        {/* Text Content with Staggered Animations */}
        <div className="text-center space-y-4">
          <h1 
            className={`text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight drop-shadow-2xl transition-all duration-1000 ease-out ${
              titleVisible 
                ? 'opacity-100 scale-100' 
                : 'opacity-0 scale-95'
            }`}
          >
            Dickinson Study Spaces
          </h1>
          
          <p 
            className={`text-xl md:text-2xl text-white/80 font-medium tracking-wide transition-all duration-1000 ease-out delay-300 ${
              subtitleVisible 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-4'
            }`}
          >
            Find your perfect spot to study.
          </p>
        </div>

        {/* Glassmorphism Progress Bar */}
        <div className="w-96 max-w-full">
          <div className="bg-white/5 backdrop-blur-xl rounded-full p-1.5 border border-white/10 shadow-2xl">
            <div 
              className="h-4 bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-500 rounded-full transition-all duration-500 ease-out shadow-lg relative overflow-hidden"
              style={{ width: `${Math.min(progress, 100)}%` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
            </div>
          </div>
          
          {/* Progress Text */}
          <div className="mt-4 text-center">
            <p className="text-white/70 font-medium text-sm">
              {loadingText}
            </p>
            <p className="text-white/50 text-xs mt-1">
              {Math.round(progress)}% complete
            </p>
          </div>
        </div>
      </div>

      {/* Subtle floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/6 w-1 h-1 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '3s' }}></div>
        <div className="absolute top-2/3 right-1/5 w-0.5 h-0.5 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: '1.5s', animationDuration: '4s' }}></div>
        <div className="absolute bottom-1/3 left-1/3 w-1.5 h-1.5 bg-white/25 rounded-full animate-bounce" style={{ animationDelay: '3s', animationDuration: '3.5s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-0.5 h-0.5 bg-white/15 rounded-full animate-bounce" style={{ animationDelay: '2s', animationDuration: '4.5s' }}></div>
      </div>
    </div>
  )
}