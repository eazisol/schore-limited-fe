import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ApiMenu } from "@/lib/api/services/auth";
import { resolveMenuIcon } from "@/lib/menu-icons";
import { toAppPath } from "@/lib/authorization";
import { isMenuContainer, isMenuTreeActive, isPathActive } from "@/lib/menu-tree";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

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
    const triggerClassName = cn(
      "text-sidebar-foreground/75 hover:text-sidebar-foreground",
      branchActive && "font-medium",
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
              isActive={branchActive}
              tooltip={menu.name}
              className={triggerClassName}
            >
              {triggerContent}
            </SidebarMenuButton>
          ) : (
            <SidebarMenuSubButton isActive={branchActive} className={triggerClassName}>
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
