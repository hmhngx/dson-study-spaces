import { Urbanist } from "next/font/google";
import Image from "next/image";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/tooltip";

const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-urbanist",
});

export default function Logo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href="https://www.dickinson.edu/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit Dickinson College website"
            className="flex items-center gap-2 min-w-0 max-w-full transition-all duration-300 shadow-md hover:scale-105 active:scale-100 hover:shadow-lg rounded-lg p-2 min-h-11"
          >
            <Image
              src="/images/newlogo.png"
              alt="App Icon"
              width={50}
              height={50}
              className="w-10 h-10 sm:w-[50px] sm:h-[50px] shrink-0"
            />
            <h1
              className={`text-lg sm:text-2xl font-bold tracking-tight text-white shadow-text truncate ${urbanist.variable}`}
            >
              dson-study-spaces
            </h1>
          </a>
        </TooltipTrigger>
        <TooltipContent>
          <p>Visit Dickinson College website</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}