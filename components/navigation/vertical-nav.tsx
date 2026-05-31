'use client';

import { useState } from 'react';
import {
  SquareTerminal,
  Bot,
  BookOpen,
  Settings2,
  LifeBuoy,
  Send,
  Frame,
  PieChart,
  Map,
  Command,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/css';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useTheme } from 'next-themes';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';

// Define types for our navigation items
type NavItem = {
  title: string;
  url: string;
  icon?: React.ElementType;
  isActive?: boolean;
  items?: { title: string; url: string }[];
};

type ProjectItem = {
  name: string;
  url: string;
  icon?: React.ElementType;
};

type UserData = {
  name: string;
  email: string;
  avatar: string;
};

interface VerticalNavProps {
  navMain: NavItem[];
  navSecondary: NavItem[];
  projects: ProjectItem[];
  user: UserData;
  className?: string;
}

export function VerticalNav({
  navMain,
  navSecondary,
  projects,
  user,
  className,
}: VerticalNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme } = useTheme();

  return (
    <header className={cn('bg-background border-b', className)}>
      <nav aria-label="Global" className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8">
        <div className="flex lg:flex-1">
          <Link href="#" className="-m-1.5 p-1.5">
            <span className="sr-only">Gimme Job</span>
            <div className="flex items-center">
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Command className="size-4" />
              </div>
              <span className="ml-3 text-xl font-semibold text-foreground">Gimme Job</span>
            </div>
          </Link>
        </div>
        
        <div className="flex lg:hidden">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5"
          >
            <span className="sr-only">Open main menu</span>
            <Menu className="size-6" />
          </Button>
        </div>
        
        <div className="hidden lg:flex lg:gap-x-12">
          {navMain.map((item) => (
            item.items && item.items.length > 0 ? (
              <Popover key={item.title}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-x-1 text-sm/6 font-semibold text-foreground hover:text-primary p-0 h-auto">
                    {item.title}
                    <ChevronDown className="size-4 flex-none text-muted-foreground" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent 
                  className="w-screen max-w-md overflow-hidden rounded-xl bg-popover p-0 shadow-lg" 
                  align="center"
                  sideOffset={8}
                >
                  <div className="p-4">
                    {item.items.map((subItem) => (
                      <div
                        key={subItem.title}
                        className="group relative flex gap-x-6 rounded-lg p-4 text-sm/6 hover:bg-muted"
                      >
                        <div className="flex-auto">
                          <Link href={subItem.url} className="block font-semibold text-foreground">
                            {subItem.title}
                            <span className="absolute inset-0" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Link
                key={item.title}
                href={item.url}
                className="text-sm/6 font-semibold text-foreground hover:text-primary"
              >
                {item.title}
              </Link>
            )
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-x-1 text-sm/6 font-semibold text-foreground hover:text-primary p-0 h-auto">
                Projects
                <ChevronDown className="size-4 flex-none text-muted-foreground" aria-hidden="true" />
              </Button>
            </PopoverTrigger>

            <PopoverContent 
              className="w-96 rounded-xl p-4 shadow-lg" 
              align="center"
              sideOffset={8}
            >
              {projects.map((item) => (
                <div key={item.name} className="relative rounded-lg p-4 hover:bg-muted">
                  <Link href={item.url} className="block text-sm/6 font-semibold text-foreground">
                    {item.name}
                    <span className="absolute inset-0" />
                  </Link>
                </div>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="hidden lg:flex lg:flex-1 lg:justify-end">
          <div className="flex items-center gap-x-4">
            {navSecondary.map((item) => (
              <Link
                key={item.title}
                href={item.url}
                className="text-sm/6 font-semibold text-foreground hover:text-primary"
              >
                {item.title}
              </Link>
            ))}
            <Link
              href="#"
              className="flex items-center gap-2 text-sm/6 font-semibold text-foreground hover:text-primary"
            >
              <span>{user.name}</span>
              <img
                src={user.avatar || "https://avatar.vercel.sh/user"}
                alt={user.name}
                className="size-8 rounded-full"
              />
            </Link>
          </div>
        </div>
      </nav>
      
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm p-0 overflow-y-auto">
          <div className="flex items-center justify-between">
            <Link href="#" className="-m-1.5 p-1.5">
              <span className="sr-only">Gimme Job</span>
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Command className="size-4" />
              </div>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
              <span className="sr-only">Close menu</span>
              <X className="size-6" aria-hidden="true" />
            </Button>
          </div>
          <div className="mt-6 flow-root">
            <div className="-my-6 divide-y divide-border">
              <div className="space-y-2 py-6">
                {navMain.map((item) => (
                  <div key={item.title}>
                    <Link
                      href={item.url}
                      className="group -mx-3 flex items-center gap-x-6 rounded-lg p-3 text-base/7 font-semibold text-foreground hover:bg-muted"
                    >
                      {item.icon && (
                        <div className="flex size-10 flex-none items-center justify-center rounded-lg bg-muted group-hover:bg-background">
                          <item.icon className="size-5 text-muted-foreground group-hover:text-primary" />
                        </div>
                      )}
                      {item.title}
                    </Link>
                    {item.items && item.items.length > 0 && (
                      <div className="mt-2 pl-12 space-y-2">
                        {item.items.map((subItem) => (
                          <Link
                            key={subItem.title}
                            href={subItem.url}
                            className="-mx-3 block rounded-lg px-3 py-2 text-sm/6 font-semibold text-foreground hover:bg-muted"
                          >
                            {subItem.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="space-y-2 py-6">
                {projects.length > 0 && (
                  <>
                    <div className="px-3 text-sm font-medium text-muted-foreground">Projects</div>
                    {projects.map((item) => (
                      <Link
                        key={item.name}
                        href={item.url}
                        className="-mx-3 block rounded-lg px-3 py-2 text-base/7 font-semibold text-foreground hover:bg-muted"
                      >
                        {item.name}
                      </Link>
                    ))}
                  </>
                )}
              </div>
              
              <div className="py-6">
                {navSecondary.map((item) => (
                  <Link
                    key={item.title}
                    href={item.url}
                    className="-mx-3 flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-base/7 font-semibold text-foreground hover:bg-muted"
                  >
                    {item.icon && <item.icon className="size-5 text-muted-foreground" />}
                    {item.title}
                  </Link>
                ))}
                
                <div className="mt-6 border-t border-border pt-6">
                  <Link
                    href="#"
                    className="-mx-3 flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-base/7 font-semibold text-foreground hover:bg-muted"
                  >
                    <img
                      src={user.avatar || "https://avatar.vercel.sh/user"}
                      alt={user.name}
                      className="size-8 rounded-full"
                    />
                    <div className="flex flex-col">
                      <span>{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
