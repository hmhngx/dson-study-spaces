import React from "react";
import { Button } from "@/ui/button";

const FontExample = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground font-heading">
            Google Fonts Example
          </h1>
          <p className="text-lg text-muted-foreground font-body">
            This page demonstrates how Google Fonts are applied throughout the application.
            The heading uses the heading font (Poppins) while body text uses the body font (Inter).
          </p>
        </div>

        {/* Typography Examples */}
        <div className="bg-card/80 backdrop-blur-md rounded-2xl p-6 border border-border/50 shadow-xl">
          <h2 className="text-2xl font-bold text-foreground mb-6 font-heading">
            Typography Hierarchy
          </h2>
          
          <div className="space-y-6">
            {/* Headings */}
            <div className="space-y-4">
              <h1 className="text-3xl font-bold text-foreground font-heading">Heading 1 - Poppins Bold</h1>
              <h2 className="text-2xl font-semibold text-foreground font-heading">Heading 2 - Poppins Semibold</h2>
              <h3 className="text-xl font-medium text-foreground font-heading">Heading 3 - Poppins Medium</h3>
              <h4 className="text-lg font-medium text-foreground font-heading">Heading 4 - Poppins Medium</h4>
            </div>

            {/* Body Text */}
            <div className="space-y-4">
              <p className="text-base text-foreground font-body leading-relaxed">
                This is body text using Inter font. It is designed for optimal readability at all sizes. 
                The font is clean, modern, and highly legible for extended reading.
              </p>
              
              <p className="text-sm text-muted-foreground font-body leading-relaxed">
                This is smaller body text, also using Inter. It maintains excellent readability 
                even at smaller sizes and is perfect for secondary information and captions.
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground font-heading">Buttons</h3>
              <div className="flex gap-4 flex-wrap">
                <Button className="font-heading">Primary Button</Button>
                <Button variant="outline" className="font-heading">Secondary Button</Button>
                <Button variant="ghost" className="font-heading">Ghost Button</Button>
              </div>
            </div>
          </div>
        </div>

        {/* Font Information */}
        <div className="bg-card/80 backdrop-blur-md rounded-2xl p-6 border border-border/50 shadow-xl">
          <h2 className="text-2xl font-bold text-foreground mb-6 font-heading">
            Current Font Configuration
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground font-heading">Body Font: Inter</h3>
              <ul className="space-y-2 text-sm text-muted-foreground font-body">
                <li>• Used for paragraphs and body text</li>
                <li>• Clean and highly readable</li>
                <li>• Optimized for screen display</li>
                <li>• Available weights: 300, 400, 500, 600, 700</li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground font-heading">Heading Font: Poppins</h3>
              <ul className="space-y-2 text-sm text-muted-foreground font-body">
                <li>• Used for titles and headings</li>
                <li>• Modern geometric design</li>
                <li>• Great for UI elements</li>
                <li>• Available weights: 300, 400, 500, 600, 700, 800</li>
              </ul>
            </div>
          </div>
        </div>

        {/* How to Change Fonts */}
        <div className="bg-card/80 backdrop-blur-md rounded-2xl p-6 border border-border/50 shadow-xl">
          <h2 className="text-2xl font-bold text-foreground mb-6 font-heading">
            How to Change Fonts
          </h2>
          
          <div className="space-y-4">
            <p className="text-foreground font-body">
              To change fonts for the entire application, edit the <code className="bg-muted px-2 py-1 rounded text-sm">FONT_CONFIG</code> in <code className="bg-muted px-2 py-1 rounded text-sm">src/lib/fonts.js</code>:
            </p>
            
            <div className="bg-muted/50 p-4 rounded-lg">
              <pre className="text-sm font-mono text-foreground overflow-x-auto">
{`export const FONT_CONFIG = {
  // Body font (for regular text, paragraphs, etc.)
  body: inter, // Change this to any body font
  
  // Heading font (for titles, headings, buttons, etc.)
  heading: poppins, // Change this to any heading font
  
  // Font family names for CSS
  bodyFamily: "Inter", // Update this to match
  headingFamily: "Poppins", // Update this to match
};`}
              </pre>
            </div>
            
            <p className="text-sm text-muted-foreground font-body">
              Available fonts include: Inter, Roboto, Open Sans, Lato, Nunito, Source Sans 3, Poppins, and Montserrat. 
              See the <code className="bg-muted px-1 py-0.5 rounded text-xs">FONT_GUIDE.md</code> for complete instructions.
            </p>
          </div>
        </div>

        {/* Font Classes Usage */}
        <div className="bg-card/80 backdrop-blur-md rounded-2xl p-6 border border-border/50 shadow-xl">
          <h2 className="text-2xl font-bold text-foreground mb-6 font-heading">
            Using Font Classes
          </h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground font-heading">Body Text Classes</h3>
                <p className="text-sm text-muted-foreground font-body">• <code className="bg-muted px-1 py-0.5 rounded text-xs">font-body</code> - Explicit body font</p>
                <p className="text-sm text-muted-foreground font-body">• <code className="bg-muted px-1 py-0.5 rounded text-xs">font-sans</code> - Default sans-serif (body)</p>
                <p className="text-sm text-muted-foreground font-body">• <code className="bg-muted px-1 py-0.5 rounded text-xs">text-base</code> - Default text size</p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground font-heading">Heading Classes</h3>
                <p className="text-sm text-muted-foreground font-body">• <code className="bg-muted px-1 py-0.5 rounded text-xs">font-heading</code> - Explicit heading font</p>
                <p className="text-sm text-muted-foreground font-body">• <code className="bg-muted px-1 py-0.5 rounded text-xs">font-bold</code> - Bold weight</p>
                <p className="text-sm text-muted-foreground font-body">• <code className="bg-muted px-1 py-0.5 rounded text-xs">font-semibold</code> - Semibold weight</p>
              </div>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-lg">
              <pre className="text-sm font-mono text-foreground overflow-x-auto">
{`// Examples
<h1 className="font-heading font-bold">Heading with Poppins</h1>
<p className="font-body">Body text with Inter</p>
<Button className="font-heading">Button with Poppins</Button>`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FontExample;
