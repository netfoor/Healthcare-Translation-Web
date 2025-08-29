export default function AuthCallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <h2 className="mt-4 text-xl font-semibold text-gray-900">
          Completing Sign In...
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Please wait while we complete your authentication.
        </p>
      </div>
    </div>
  );
}