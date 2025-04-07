export default function NotFound() {
    return (
      <div className="min-h-screen bg-zinc-900 flex justify-center items-center">
        <div className="flex flex-col gap-4 items-center justify-center">
          <h1 className="text-4xl font-bold text-white">404 - Page Not Found</h1>
          <p className="text-gray-400">The page you’re looking for doesn’t exist.</p>
          <a href="/" className="text-blue-500 hover:underline">
            Go back to Home
          </a>
        </div>
      </div>
    );
  }