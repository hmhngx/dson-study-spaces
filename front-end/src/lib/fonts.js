import {
  DM_Sans,
  Inter,
  Lato,
  Montserrat,
  Nunito,
  Open_Sans,
  Poppins,
  Roboto,
  Source_Sans_3,
  Space_Grotesk,
} from "next/font/google";

// Primary Font Options - Choose one for body text
export const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

export const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
});

export const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-open-sans",
});

export const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-lato",
});

export const nunito = Nunito({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-nunito",
});

export const sourceSans3 = Source_Sans_3({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-source-sans-3",
});

export const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

// Heading Font Options - Choose one for headings
export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

export const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

// Font Configuration - Change these to switch fonts
export const FONT_CONFIG = {
  // Body font (for regular text, paragraphs, etc.)
  body: dmSans, // Options: dmSans, inter, roboto, openSans, lato, nunito, sourceSans3
  
  // Heading font (for titles, headings, buttons, etc.)
  heading: spaceGrotesk, // Options: spaceGrotesk, poppins, montserrat
  
  // Font family names for CSS
  bodyFamily: "DM Sans",
  headingFamily: "Space Grotesk",
};

// Helper function to get all font variables
export const getFontVariables = () => {
  return `${FONT_CONFIG.body.variable} ${FONT_CONFIG.heading.variable}`;
};

// Helper function to get font classes
export const getFontClasses = () => {
  return "font-sans";
};

// Popular Google Font Combinations
export const FONT_PRESETS = {
  atlas: {
    body: dmSans,
    heading: spaceGrotesk,
    bodyFamily: "DM Sans",
    headingFamily: "Space Grotesk",
  },
  modern: {
    body: inter,
    heading: poppins,
    bodyFamily: "Inter",
    headingFamily: "Poppins",
  },
  clean: {
    body: roboto,
    heading: montserrat,
    bodyFamily: "Roboto",
    headingFamily: "Montserrat",
  },
  friendly: {
    body: nunito,
    heading: poppins,
    bodyFamily: "Nunito",
    headingFamily: "Poppins",
  },
  professional: {
    body: sourceSans3,
    heading: montserrat,
    bodyFamily: "Source Sans 3",
    headingFamily: "Montserrat",
  },
  readable: {
    body: openSans,
    heading: poppins,
    bodyFamily: "Open Sans",
    headingFamily: "Poppins",
  },
};
