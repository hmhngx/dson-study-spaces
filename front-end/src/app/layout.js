import { FONT_CONFIG, getFontVariables, getFontClasses } from "@/lib/fonts";
import "./styles/globals.css";

export const metadata = {
  title: "Dson Study Spaces",
  description: "A study spaces atlas for Dickinson College students",
  icons: {
    icon: "/images/newlogo.png", 
    apple: "/images/newlogo.png", 
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${getFontVariables()} ${getFontClasses()}`}>{children}</body>
    </html>
  );
}