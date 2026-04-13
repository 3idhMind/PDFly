import { useState } from "react";
import { Check, ChevronsUpDown, Languages, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { languages } from "@/types/pdf";

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const LanguageSelector = ({ value, onChange }: LanguageSelectorProps) => {
  const [open, setOpen] = useState(false);

  const selected = languages.find((l) => l.code === value);

  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <Languages className="w-4 h-4 text-primary" />
        <label className="text-sm font-medium text-foreground">Language</label>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {selected ? selected.native : "Select language..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search languages..." />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>No language found.</CommandEmpty>
              <CommandGroup>
                {languages.map((lang) => (
                  <CommandItem
                    key={lang.code}
                    value={`${lang.name} ${lang.native} ${lang.code}`}
                    onSelect={() => {
                      onChange(lang.code);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === lang.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1">{lang.native}</span>
                    <span className="text-xs text-muted-foreground ml-2">{lang.code}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
