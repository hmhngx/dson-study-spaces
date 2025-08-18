import React, { useState } from "react";
import { Button } from "@/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuRadioGroup,
  EnhancedDropdownMenuItem,
  SortDropdownItem,
  FilterDropdownItem,
} from "@/ui/dropdown-menu";
import {
  ChevronDown,
  Settings,
  User,
  Mail,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Languages,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";

const DropdownExamples = () => {
  const [sortOption, setSortOption] = useState("Closest");
  const [filterOption, setFilterOption] = useState("All");
  const [theme, setTheme] = useState("light");
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    sms: true,
  });
  const [sound, setSound] = useState("on");

  return (
    <div className="p-6 space-y-8 bg-background">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Modern Dropdown Examples</h2>
        <p className="text-muted-foreground">
          Showcasing the redesigned dropdown menus with Material 3 design principles, 
          smooth animations, and enhanced accessibility.
        </p>
      </div>

      {/* Sort Dropdown Example */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Sort Dropdown</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="
                bg-secondary/80 text-foreground hover:bg-secondary/60 
                backdrop-blur-md shadow-lg rounded-xl 
                transition-all duration-300 border-none
                font-semibold
                hover:shadow-xl focus:ring-2 focus:ring-secondary/50 focus:outline-none
                min-w-[160px] justify-between
              "
            >
              <ChevronDown size="14px" className="mr-2" /> {sortOption}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="
              bg-popover text-popover-foreground 
              border shadow-xl rounded-xl
              p-2
            "
          >
            <DropdownMenuLabel className="font-bold text-foreground">Sort By:</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <SortDropdownItem
              sortType="Closest"
              isActive={sortOption === "Closest"}
              onClick={() => setSortOption("Closest")}
            />
            <SortDropdownItem
              sortType="Furthest"
              isActive={sortOption === "Furthest"}
              onClick={() => setSortOption("Furthest")}
            />
            <SortDropdownItem
              sortType="Highest Rated"
              isActive={sortOption === "Highest Rated"}
              onClick={() => setSortOption("Highest Rated")}
            />
            <SortDropdownItem
              sortType="Name"
              isActive={sortOption === "Name"}
              onClick={() => setSortOption("Name")}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter Dropdown Example */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Filter Dropdown</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="
                bg-secondary/80 text-foreground hover:bg-secondary/60 
                backdrop-blur-md shadow-lg rounded-xl 
                transition-all duration-300 border-none
                font-semibold
                hover:shadow-xl focus:ring-2 focus:ring-secondary/50 focus:outline-none
                min-w-[160px] justify-between
              "
            >
              <ChevronDown size="14px" className="mr-2" /> {filterOption}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="
              bg-popover text-popover-foreground 
              border shadow-xl rounded-xl
              p-2
            "
          >
            <DropdownMenuLabel className="font-bold text-foreground">Filter By:</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <FilterDropdownItem
              filterType="All"
              isActive={filterOption === "All"}
              onClick={() => setFilterOption("All")}
            />
            <FilterDropdownItem
              filterType="Open"
              isActive={filterOption === "Open"}
              onClick={() => setFilterOption("Open")}
            />
            <FilterDropdownItem
              filterType="Closed"
              isActive={filterOption === "Closed"}
              onClick={() => setFilterOption("Closed")}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Settings Dropdown Example */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Settings Dropdown</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="
                bg-secondary/80 text-foreground hover:bg-secondary/60 
                backdrop-blur-md shadow-lg rounded-xl 
                transition-all duration-300 border-none
                font-semibold
                hover:shadow-xl focus:ring-2 focus:ring-secondary/50 focus:outline-none
                min-w-[160px] justify-between
              "
            >
              <Settings size="14px" className="mr-2" /> Settings
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="
              bg-popover text-popover-foreground 
              border shadow-xl rounded-xl
              p-2
            "
          >
            <DropdownMenuLabel className="font-bold text-foreground">Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <EnhancedDropdownMenuItem icon={<User className="h-4 w-4" />}>
              Profile
            </EnhancedDropdownMenuItem>
            
            <EnhancedDropdownMenuItem icon={<Mail className="h-4 w-4" />}>
              Messages
            </EnhancedDropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuLabel className="font-bold text-foreground">Preferences</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light" icon={<Sun className="h-4 w-4" />}>
                Light Theme
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" icon={<Moon className="h-4 w-4" />}>
                Dark Theme
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system" icon={<Monitor className="h-4 w-4" />}>
                System Theme
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuCheckboxItem
              checked={notifications.email}
              onCheckedChange={(checked) => 
                setNotifications(prev => ({ ...prev, email: checked }))
              }
              icon={<Mail className="h-4 w-4" />}
            >
              Email Notifications
            </DropdownMenuCheckboxItem>
            
            <DropdownMenuCheckboxItem
              checked={notifications.push}
              onCheckedChange={(checked) => 
                setNotifications(prev => ({ ...prev, push: checked }))
              }
              icon={<Bell className="h-4 w-4" />}
            >
              Push Notifications
            </DropdownMenuCheckboxItem>
            
            <DropdownMenuCheckboxItem
              checked={notifications.sms}
              onCheckedChange={(checked) => 
                setNotifications(prev => ({ ...prev, sms: checked }))
              }
              icon={<Shield className="h-4 w-4" />}
            >
              SMS Notifications
            </DropdownMenuCheckboxItem>
            
            <DropdownMenuSeparator />
            
            <EnhancedDropdownMenuItem icon={<HelpCircle className="h-4 w-4" />}>
              Help & Support
            </EnhancedDropdownMenuItem>
            
            <EnhancedDropdownMenuItem icon={<LogOut className="h-4 w-4" />}>
              Sign Out
            </EnhancedDropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sound Settings Example */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Sound Settings</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="
                bg-secondary/80 text-foreground hover:bg-secondary/60 
                backdrop-blur-md shadow-lg rounded-xl 
                transition-all duration-300 border-none
                font-semibold
                hover:shadow-xl focus:ring-2 focus:ring-secondary/50 focus:outline-none
                min-w-[160px] justify-between
              "
            >
              {sound === "on" ? (
                <Volume2 size="14px" className="mr-2" />
              ) : (
                <VolumeX size="14px" className="mr-2" />
              )}
              Sound {sound === "on" ? "On" : "Off"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="
              bg-popover text-popover-foreground 
              border shadow-xl rounded-xl
              p-2
            "
          >
            <DropdownMenuLabel className="font-bold text-foreground">Sound Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuRadioGroup value={sound} onValueChange={setSound}>
              <DropdownMenuRadioItem value="on" icon={<Volume2 className="h-4 w-4" />}>
                Sound On
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="off" icon={<VolumeX className="h-4 w-4" />}>
                Sound Off
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            
            <DropdownMenuSeparator />
            
            <EnhancedDropdownMenuItem icon={<Wifi className="h-4 w-4" />}>
              Network Connected
            </EnhancedDropdownMenuItem>
            
            <EnhancedDropdownMenuItem icon={<Languages className="h-4 w-4" />}>
              Language Settings
            </EnhancedDropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Feature Highlights */}
      <div className="mt-8 p-6 bg-card/20 backdrop-blur-md rounded-xl border border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-4">Design Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Material 3 rounded corners (12px)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Soft shadows with backdrop blur</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Smooth 150ms animations</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Hover micro-interactions</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Clear active states with checkmarks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Relevant icons for each option</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>WCAG compliant contrast ratios</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Keyboard navigation support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DropdownExamples;
