import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ApiMenu } from "@/lib/api/services/auth";
import { resolveMenuIcon } from "@/lib/menu-icons";
import { toAppPath } from "@/lib/authorization";
import { isMenuContainer, isMenuTreeActive, isPathActive } from "@/lib/menu-tree";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

const FLYOUT_OPEN_DELAY = 80;
const FLYOUT_CLOSE_DELAY = 120;

export function NavSidebarMenu({
  menus,
  pathname,
  onNavigate,
}: {
  menus: ApiMenu[];
  pathname: string;
  onNavigate: () => void;
}) {
  if (menus.length === 0) {
    return (
      <SidebarMenu>
        <li className="px-3 py-2 text-xs text-sidebar-foreground/50">No menus assigned</li>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      {menus.map((menu) => (
        <NavSidebarMenuNode
          key={menu.id}
          menu={menu}
          pathname={pathname}
          onNavigate={onNavigate}
          depth={0}
        />
      ))}
    </SidebarMenu>
  );
}

function NavSidebarMenuNode({
  menu,
  pathname,
  onNavigate,
  depth,
}: {
  menu: ApiMenu;
  pathname: string;
  onNavigate: () => void;
  depth: number;
}) {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const children = menu.children ?? [];
  const hasChildren = isMenuContainer(menu);
  const to = toAppPath(menu.route);
  const Icon = resolveMenuIcon(menu.icon);
  const active = !hasChildren && isPathActive(pathname, to);
  const branchActive = isMenuTreeActive(pathname, menu);
  const [open, setOpen] = useState(branchActive);

  useEffect(() => {
    if (branchActive) setOpen(true);
  }, [branchActive]);

  if (hasChildren) {
    /** Collapsed desktop: icon → floating flyout with child links. */
    if (collapsed && depth === 0) {
      return (
        <SidebarMenuItem>
          <HoverCard openDelay={FLYOUT_OPEN_DELAY} closeDelay={FLYOUT_CLOSE_DELAY}>
            <HoverCardTrigger asChild>
              <SidebarMenuButton
                type="button"
                isActive={branchActive}
                aria-haspopup="menu"
                aria-label={menu.name}
                className={cn(
                  "text-sidebar-foreground/75 hover:text-sidebar-foreground",
                  branchActive && "font-medium text-sidebar-foreground",
                )}
              >
                {Icon ? <Icon /> : null}
                <span className="sr-only">{menu.name}</span>
              </SidebarMenuButton>
            </HoverCardTrigger>
            <NavFlyoutPanel
              title={menu.name}
              menus={children}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          </HoverCard>
        </SidebarMenuItem>
      );
    }

    const triggerClassName = cn(
      "text-sidebar-foreground/75 hover:text-sidebar-foreground",
      branchActive && "font-medium text-sidebar-foreground",
    );

    const triggerContent = (
      <>
        {Icon ? <Icon /> : null}
        <span>{menu.name}</span>
        <ChevronRight
          className={cn(
            "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </>
    );

    const collapsible = (
      <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible w-full">
        <CollapsibleTrigger asChild>
          {depth === 0 ? (
            <SidebarMenuButton
              isActive={false}
              tooltip={menu.name}
              className={triggerClassName}
            >
              {triggerContent}
            </SidebarMenuButton>
          ) : (
            <SidebarMenuSubButton isActive={false} className={triggerClassName}>
              {triggerContent}
            </SidebarMenuSubButton>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {children.map((child) => (
              <NavSidebarMenuNode
                key={child.id}
                menu={child}
                pathname={pathname}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    );

    if (depth === 0) {
      return <SidebarMenuItem>{collapsible}</SidebarMenuItem>;
    }

    return <SidebarMenuSubItem>{collapsible}</SidebarMenuSubItem>;
  }

  if (depth === 0) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={menu.name}
          className={cn(
            "text-sidebar-foreground/75 hover:text-sidebar-foreground",
            active && "font-medium",
          )}
        >
          <Link to={to} onClick={onNavigate}>
            {Icon ? <Icon /> : null}
            <span>{menu.name}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={active}>
        <Link to={to} onClick={onNavigate}>
          {Icon ? <Icon /> : null}
          <span>{menu.name}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function NavFlyoutPanel({
  title,
  menus,
  pathname,
  onNavigate,
}: {
  title: string;
  menus: ApiMenu[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <HoverCardContent
      side="right"
      align="start"
      sideOffset={10}
      collisionPadding={12}
      className={cn(
        "w-56 border-sidebar-border bg-sidebar p-1.5 text-sidebar-foreground shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=right]:slide-in-from-left-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=top]:slide-in-from-bottom-2 data-[side=bottom]:slide-in-from-top-2",
      )}
    >
      <div className="truncate px-2.5 py-1.5 text-xs font-semibold tracking-wide text-sidebar-foreground/70">
        {title}
      </div>
      <div className="mx-1 mb-1 border-t border-sidebar-border" />
      <NavFlyoutList menus={menus} pathname={pathname} onNavigate={onNavigate} />
    </HoverCardContent>
  );
}

function NavFlyoutList({
  menus,
  pathname,
  onNavigate,
}: {
  menus: ApiMenu[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5" role="menu">
      {menus.map((menu) => (
        <li key={menu.id} role="none">
          <NavFlyoutItem menu={menu} pathname={pathname} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>
  );
}

function NavFlyoutItem({
  menu,
  pathname,
  onNavigate,
}: {
  menu: ApiMenu;
  pathname: string;
  onNavigate: () => void;
}) {
  const children = menu.children ?? [];
  const hasChildren = isMenuContainer(menu);
  const to = toAppPath(menu.route);
  const Icon = resolveMenuIcon(menu.icon);
  const active = !hasChildren && isPathActive(pathname, to);
  const branchActive = isMenuTreeActive(pathname, menu);

  const itemClassName = cn(
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors",
    "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    "focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground",
    (active || branchActive) &&
      "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
  );

  if (hasChildren) {
    return (
      <div className="space-y-0.5">
        <div
          className={cn(
            "flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground/60",
            branchActive && "text-sidebar-foreground/80",
          )}
        >
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
          <span className="min-w-0 flex-1 truncate">{menu.name}</span>
        </div>
        <div className="ml-2 border-l border-sidebar-border pl-1">
          <NavFlyoutList menus={children} pathname={pathname} onNavigate={onNavigate} />
        </div>
      </div>
    );
  }

  return (
    <Link to={to} role="menuitem" onClick={onNavigate} className={itemClassName}>
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      <span className="min-w-0 flex-1 truncate">{menu.name}</span>
    </Link>
  );
}
