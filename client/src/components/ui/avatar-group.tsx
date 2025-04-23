import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  items: {
    name: string;
    image?: string;
  }[];
  max?: number;
}

export function AvatarGroup({
  items,
  max = 4,
  className,
  ...props
}: AvatarGroupProps) {
  const displayItems = max ? items.slice(0, max) : items;
  const overflowCount = items.length - displayItems.length;

  return (
    <div
      className={cn("flex -space-x-2 overflow-hidden", className)}
      {...props}
    >
      {displayItems.map((item, index) => (
        <Avatar
          key={index}
          className="border-2 border-background inline-block ring-0"
        >
          {item.image && <AvatarImage src={item.image} alt={item.name} />}
          <AvatarFallback className="bg-primary text-primary-foreground">
            {item.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflowCount > 0 && (
        <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-muted text-sm text-muted-foreground">
          +{overflowCount}
        </div>
      )}
    </div>
  );
}
