import { useState, useEffect, useRef } from "react";
import { MapPin, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface SavedLocation {
  id: string;
  address: string;
  usage_count: number;
}

interface LocationComboboxProps {
  value: string;
  onChange: (value: string) => void;
  locationType: "origin" | "destination";
  placeholder?: string;
}

export function LocationCombobox({
  value,
  onChange,
  locationType,
  placeholder = "住所を入力",
}: LocationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SavedLocation[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("saved_locations")
      .select("id, address, usage_count")
      .eq("location_type", locationType)
      .order("usage_count", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setSuggestions(data);
      });
  }, [locationType]);

  const filtered = suggestions.filter((s) =>
    value ? s.address.includes(value) : true
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex min-h-[44px] w-full items-center rounded-md border border-input bg-background px-3 py-2 text-left text-base ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!open) setOpen(true);
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandList>
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                よく使う住所が追加されると、ここに表示されます
              </p>
            ) : (
              <CommandGroup heading="よく使う住所">
                {filtered.map((loc) => (
                  <CommandItem
                    key={loc.id}
                    value={loc.address}
                    onSelect={() => {
                      onChange(loc.address);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 py-3 text-base"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1">{loc.address}</span>
                    <span className="text-xs text-muted-foreground">
                      {loc.usage_count}回
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
