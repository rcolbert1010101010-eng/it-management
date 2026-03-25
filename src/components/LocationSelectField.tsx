import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  findMatchingLocation,
  trimLocationName,
  type Location,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type LocationSelectFieldProps = {
  id?: string;
  value: string;
  options: Location[];
  onValueChange: (value: string) => void;
  onCreateOption: (value: string) => Promise<void>;
  disabled?: boolean;
  isCreating?: boolean;
};

export function LocationSelectField({
  id,
  value,
  options,
  onValueChange,
  onCreateOption,
  disabled = false,
  isCreating = false,
}: LocationSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const selectedLocation = useMemo(
    () => findMatchingLocation(value, options),
    [options, value],
  );
  const trimmedSearchValue = trimLocationName(searchValue);
  const matchingSearchLocation = useMemo(
    () => findMatchingLocation(trimmedSearchValue, options),
    [options, trimmedSearchValue],
  );
  const canCreate = Boolean(trimmedSearchValue) && !matchingSearchLocation;

  const handleSelect = (nextValue: string) => {
    onValueChange(nextValue);
    setSearchValue(nextValue);
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    await onCreateOption(trimmedSearchValue);
    setSearchValue(trimmedSearchValue);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setSearchValue(selectedLocation?.name ?? trimLocationName(value));
          return;
        }
        setSearchValue("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || isCreating}
        >
          <span className="truncate text-left">
            {selectedLocation?.name || trimLocationName(value) || "Select or add a location"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Search locations..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>No matching locations.</CommandEmpty>
            {canCreate && (
              <CommandGroup heading="Create">
                <CommandItem value={`add ${trimmedSearchValue}`} onSelect={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add "{trimmedSearchValue}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Locations">
              {options.map((option) => {
                const isSelected = selectedLocation?.id === option.id;
                return (
                  <CommandItem key={option.id} value={option.name} onSelect={() => handleSelect(option.name)}>
                    <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    {option.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
