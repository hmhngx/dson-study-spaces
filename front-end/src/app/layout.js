import { Urbanist } from "next/font/google";
import "./styles/globals.css";

const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-urbanist",
});

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
      <body className={`${urbanist.variable} font-urbanist`}>{children}</body>
    </html>
  );
}