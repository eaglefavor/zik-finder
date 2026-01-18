'use client';

export default function VersionCheck() {
  return (
    <div className="p-10 flex flex-col items-center justify-center min-h-screen bg-white text-black">
      <h1 className="text-4xl font-bold mb-4 text-purple-600">DEPLOYMENT CONFIRMED</h1>
      <p className="text-xl mb-4">Version: v4 (Purple Button Fix)</p>
      <p className="mb-4">Time: {new Date().toISOString()}</p>
      <div className="p-4 bg-gray-100 rounded">
        If you see this, the code IS live.
      </div>
    </div>
  );
}
