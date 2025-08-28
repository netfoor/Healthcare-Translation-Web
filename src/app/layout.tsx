import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { configureAmplify } from "@/lib/amplify-config";

// Configure Amplify
configureAmplify();

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Healthcare Translation App",
  description: "Real-time multilingual translation platform for healthcare providers",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-gray-50 min-h-screen">
        <div className="flex flex-col min-h-screen">
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <h1 className="text-xl font-semibold text-gray-900">
                  Healthcare Translation
                </h1>
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
