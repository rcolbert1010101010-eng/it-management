import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

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
  createLocation,
  findMatchingLocation,
  mergeLocations,
  normalizeLocationName,
  trimLocationName,
  type Location,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type LocationSelectFieldProps = {
  id?: string;
  value: string;
  options: Location[];
  onValueChange: (value: string) => void;
  onOptionsChange?: (options: Location[]) => void;
  disabled?: boolean;
};

export function LocationSelectField({
  id,
  value,
  options,
  onValueChange,
  onOptionsChange,
  disabled = false,
}: LocationSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [localOptions, setLocalOptions] = useState(() => mergeLocations(options));
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setLocalOptions(mergeLocations(options));
  }, [options]);

  const selectedLocation = useMemo(
    () => findMatchingLocation(value, localOptions),
    [localOptions, value],
  );
  const trimmedSearchValue = trimLocationName(searchValue);
  const matchingSearchLocation = useMemo(
    () => findMatchingLocation(trimmedSearchValue, localOptions),
    [localOptions, trimmedSearchValue],
  );
  const canCreate = Boolean(trimmedSearchValue) && !matchingSearchLocation;

  const handleSelect = (nextValue: string) => {
    const resolvedLocation = findMatchingLocation(nextValue, localOptions);
    const resolvedValue = resolvedLocation?.name ?? trimLocationName(nextValue);
    onValueChange(resolvedValue);
    setSearchValue(resolvedValue);
    setOpen(false);
  };

  const handleCreate = async () => {
    if (matchingSearchLocation) {
      handleSelect(matchingSearchLocation.name);
      return;
    }
    if (!canCreate) return;

    setIsCreating(true);
    try {
      const location = await createLocation(trimmedSearchValue);
      const nextOptions = mergeLocations([...localOptions, location]);
      setLocalOptions(nextOptions);
      onOptionsChange?.(nextOptions);
      onValueChange(location.name);
      setSearchValue(location.name);
      setOpen(false);
      toast.success(`Location "${location.name}" ready to use.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create location.";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
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
        <Command
          shouldFilter
          filter={(itemValue, search) => {
            const normalizedItem = normalizeLocationName(itemValue);
            const normalizedSearch = normalizeLocationName(search);
            if (!normalizedSearch) return 1;
            return normalizedItem.includes(normalizedSearch) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder="Search locations..."
            value={searchValue}
            onValueChange={setSearchValue}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (matchingSearchLocation) {
                handleSelect(matchingSearchLocation.name);
                return;
              }
              if (canCreate) {
                void handleCreate();
              }
            }}
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
              {localOptions.map((option) => {
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
