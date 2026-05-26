import { FONT_CONFIG, getFontVariables, getFontClasses } from "@/lib/fonts";
import "./styles/globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Dson Study Spaces",
  description: "A study spaces atlas for Dickinson College students",
  icons: {
    icon: "/images/newlogo.png",
    apple: "/images/newlogo.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${getFontVariables()} ${getFontClasses()}`}
        suppressHydrationWarning
      >
        {/* Providers is a client component that wraps children in QueryClientProvider for React Query */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}