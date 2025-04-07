"use client";

export default function Error({ error, reset }) {
  return (
    <div className="min-h-screen bg-zinc-900 flex justify-center items-center">
      <div className="flex flex-col gap-4 items-center justify-center">
        <p className="font-medium text-lg text-red-500">
          An error occurred: {error.message}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}