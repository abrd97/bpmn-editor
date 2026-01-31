import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BPMN Editor",
  description: "A real-time, multi-user BPMN Editor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <main>{children}</main>
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              error: "bg-red-500 text-white",
              success: "bg-green-500 text-white",
              warning: "bg-yellow-500 text-white",
              info: "bg-blue-500 text-white",
            },
          }}
        />
      </body>
    </html>
  );
}
