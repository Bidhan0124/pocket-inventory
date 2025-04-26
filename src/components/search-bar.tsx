
"use client";

import type { ViewMode } from '@/lib/types'; // Import ViewMode
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  offlineQueueCount: number;
  viewMode: ViewMode; // Add viewMode prop
  onViewChange: (mode: ViewMode) => void; // Add handler prop
}

export function SearchBar({
  searchTerm,
  onSearchChange,
  offlineQueueCount,
  viewMode,
  onViewChange
}: SearchBarProps) {
  return (
     <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 border-b">
        <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products by name or company..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 w-full"
              />
               {offlineQueueCount > 0 && (
                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                   {offlineQueueCount} pending sync
                 </span>
               )}
            </div>
            {/* View Toggle Buttons */}
            <div className="flex items-center border rounded-md p-0.5">
                <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => onViewChange('grid')}
                    className={cn(
                        "h-8 w-8 rounded-sm",
                        viewMode === 'grid' ? 'bg-accent text-accent-foreground shadow-sm' : ''
                    )}
                    aria-label="Grid view"
                >
                    <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => onViewChange('list')}
                    className={cn(
                        "h-8 w-8 rounded-sm",
                        viewMode === 'list' ? 'bg-accent text-accent-foreground shadow-sm' : ''
                    )}
                    aria-label="List view"
                >
                    <List className="h-4 w-4" />
                </Button>
            </div>
        </div>
      </div>
  );
}

