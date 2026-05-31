'use client';

import { ChevronRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/css/index';

export function NavMain({
  items,
}: {
  items: {
    icon?: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
    title: string;
    url: string;
  }[];
}) {
  const { setOpenMobile } = useSidebar();
  const [subMenuOpen, setSubMenuOpen] = useState<string | null>(null);
  const pathname = usePathname();

  function openSubMenu(url: string) {
    setSubMenuOpen(subMenuOpen === url ? null : url);
  }

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map(item => {
          return (
            <Collapsible
              asChild
              open={item.isActive || subMenuOpen === item.url}
              key={item.title}
              // open={item.isActive}
            >
              <SidebarMenuItem className="sidebar-menu-item-btn-offset">
                <SidebarMenuButton asChild tooltip={item.title}>
                  <Link
                    className={cn(
                      'h-9 px-2.5 font-semibold tracking-tight transition-colors duration-150',
                      item.isActive
                        ? 'bg-primary/15 !text-primary hover:!bg-primary/15'
                        : 'text-foreground/60 hover:bg-foreground/[0.06]',
                    )}
                    href={item.url}
                    onClick={() => setOpenMobile(false)}
                  >
                    {item.icon ? <item.icon className="size-[12px]" /> : null}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>

                {item.items?.length ? (
                  <>
                    <CollapsibleTrigger asChild className="">
                      <SidebarMenuAction
                        className={cn(
                          '!right-2 !top-2 !size-5 rounded-full transition-all duration-150 data-[state=open]:rotate-90',
                          item.isActive
                            ? 'rotate-90 !text-primary hover:!bg-primary/70 hover:!text-primary-foreground'
                            : 'text-foreground/50 hover:bg-foreground/20 hover:text-foreground',
                          pathname === item.url
                            ? 'rotate-90 !text-primary hover:!bg-primary/70 hover:!text-primary-foreground'
                            : 'rotate-0',
                        )}
                        onClick={() => openSubMenu(item.url)}
                      >
                        <ChevronRight />
                        <span className="sr-only">Toggle</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent
                      // className={cn(
                      //   '',
                      //   item.isActive || subMenuOpen === item.url
                      //     ? 'flex'
                      //     : 'hidden',
                      // )}
                      className="py-1.5"
                      data-state={
                        item.isActive || subMenuOpen === item.url
                          ? 'open'
                          : 'closed'
                      }
                      hidden={!(item.isActive || subMenuOpen === item.url)}
                    >
                      <SidebarMenuSub
                        className="mx-4 px-2.5"
                        data-state={
                          item.isActive || subMenuOpen === item.url
                            ? 'open'
                            : 'closed'
                        }
                      >
                        {item.items?.map(subItem => {
                          const isActive = subItem.url === pathname;

                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild>
                                <Link
                                  className={cn(
                                    'transition-all duration-150',
                                    isActive
                                      ? '!hover:text-primary/75 !font-semibold !text-foreground/75 hover:bg-foreground/0'
                                      : 'font-medium !text-foreground/60 hover:bg-foreground/0 hover:!text-foreground/70',
                                  )}
                                  href={subItem.url}
                                  onClick={() => setOpenMobile(false)}
                                >
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
