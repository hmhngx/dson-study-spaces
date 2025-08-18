"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle, ChevronDown, MapPin, Globe, Star, Type, CheckCircle, XCircle, ListFilter, ArrowUpDown } from "lucide-react"

import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default gap-3 select-none items-center rounded-lg px-3 py-2.5 text-sm outline-none transition-all duration-150",
      "focus:bg-accent/80 focus:text-accent-foreground data-[state=open]:bg-accent/80 data-[state=open]:text-accent-foreground",
      "hover:bg-accent/60 hover:scale-[1.02] active:scale-[0.98]",
      "focus:ring-2 focus:ring-accent/50 focus:ring-offset-1",
      "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}>
    {children}
    <ChevronRight className="ml-auto transition-transform duration-150 group-data-[state=open]:rotate-90" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
          className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        "duration-150 ease-out",
        className
      )}
    {...props} />
))
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[12rem] overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        "duration-125 ease-out",
        className
      )}
      {...props} />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef(({ className, inset, icon, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-all duration-150",
      "focus:bg-accent/80 focus:text-accent-foreground hover:bg-accent/60 hover:scale-[1.02] active:scale-[0.98]",
      "focus:ring-2 focus:ring-accent/50 focus:ring-offset-1",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[disabled]:hover:scale-100",
      "[&>svg]:size-4 [&>svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}>
    {icon && <span className="flex items-center justify-center w-4 h-4">{icon}</span>}
    {children}
  </DropdownMenuPrimitive.Item>
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef(({ className, children, checked, icon, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-3 rounded-lg py-2.5 pl-10 pr-3 text-sm outline-none transition-all duration-150",
      "focus:bg-accent/80 focus:text-accent-foreground hover:bg-accent/60 hover:scale-[1.02] active:scale-[0.98]",
      "focus:ring-2 focus:ring-accent/50 focus:ring-offset-1",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[disabled]:hover:scale-100",
      className
    )}
    checked={checked}
    {...props}>
    <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-primary" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {icon && <span className="flex items-center justify-center w-4 h-4">{icon}</span>}
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef(({ className, children, icon, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-3 rounded-lg py-2.5 pl-10 pr-3 text-sm outline-none transition-all duration-150",
      "focus:bg-accent/80 focus:text-accent-foreground hover:bg-accent/60 hover:scale-[1.02] active:scale-[0.98]",
      "focus:ring-2 focus:ring-accent/50 focus:ring-offset-1",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[disabled]:hover:scale-100",
      className
    )}
    {...props}>
    <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2.5 w-2.5 fill-current text-primary" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {icon && <span className="flex items-center justify-center w-4 h-4">{icon}</span>}
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-3 py-2 text-sm font-semibold text-muted-foreground",
      inset && "pl-8",
      className
    )}
    {...props} />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1.5 my-1.5 h-px bg-border/50", className)}
    {...props} />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className,
  ...props
}) => {
  return (
    (<span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props} />)
  );
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

// Enhanced dropdown components with icons and better UX
const EnhancedDropdownMenuItem = React.forwardRef(({ 
  className, 
  inset, 
  icon, 
  children, 
  isActive = false,
  ...props 
}, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-all duration-125",
      "focus:bg-accent/80 focus:text-accent-foreground hover:bg-accent/60 hover:scale-[1.01] active:scale-[0.99]",
      "focus:ring-2 focus:ring-accent/50 focus:ring-offset-1",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[disabled]:hover:scale-100",
      isActive && "bg-primary/15 text-primary font-semibold shadow-sm",
      "[&>svg]:size-4 [&>svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}>
    {icon && <span className="flex items-center justify-center w-4 h-4 text-muted-foreground">{icon}</span>}
    <span className="flex-1">{children}</span>
    {isActive && <Check className="h-4 w-4 text-primary ml-auto" />}
  </DropdownMenuPrimitive.Item>
))

// Pre-configured dropdown items for common use cases
const SortDropdownItem = React.forwardRef(({ sortType, isActive, onClick, disabled, ...props }, ref) => {
  const icons = {
    "Closest": <MapPin className="h-4 w-4" />,
    "Furthest": <Globe className="h-4 w-4" />,
    "Highest Rated": <Star className="h-4 w-4" />,
    "Name": <Type className="h-4 w-4" />
  }

  return (
    <EnhancedDropdownMenuItem
      ref={ref}
      icon={icons[sortType]}
      isActive={isActive}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        isActive && "bg-primary/15 text-primary font-semibold",
        "transition-all duration-125"
      )}
      {...props}
    >
      {sortType}
    </EnhancedDropdownMenuItem>
  )
})

const FilterDropdownItem = React.forwardRef(({ filterType, isActive, onClick, ...props }, ref) => {
  const icons = {
    "All": <ListFilter className="h-4 w-4" />,
    "Open": <CheckCircle className="h-4 w-4" />,
    "Closed": <XCircle className="h-4 w-4" />
  }

  return (
    <EnhancedDropdownMenuItem
      ref={ref}
      icon={icons[filterType]}
      isActive={isActive}
      onClick={onClick}
      className={cn(
        isActive && "bg-primary/15 text-primary font-semibold",
        "transition-all duration-125"
      )}
      {...props}
    >
      {filterType}
    </EnhancedDropdownMenuItem>
  )
})

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  EnhancedDropdownMenuItem,
  SortDropdownItem,
  FilterDropdownItem,
}