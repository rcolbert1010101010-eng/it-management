import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [newLocationInput, setNewLocationInput] = useState("");
  const [localOptions, setLocalOptions] = useState(() => mergeLocations(options));
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  useEffect(() => {
    setLocalOptions(mergeLocations(options));
  }, [options]);

  const selectedLocation = useMemo(
    () => findMatchingLocation(value, localOptions),
    [localOptions, value],
  );
  const trimmedNewLocationInput = trimLocationName(newLocationInput);
  const normalizedInput = normalizeLocationName(searchValue);
  const filteredOptions = useMemo(() => {
    if (!normalizedInput) {
      return localOptions;
    }

    return localOptions.filter((option) =>
      normalizeLocationName(option.name).includes(normalizedInput),
    );
  }, [localOptions, normalizedInput]);

  const handleSelect = (nextValue: string) => {
    const resolvedLocation = findMatchingLocation(nextValue, localOptions);
    const resolvedValue = resolvedLocation?.name ?? trimLocationName(nextValue);
    onValueChange(resolvedValue);
    setSearchValue("");
    setOpen(false);
  };

  const handleAddLocation = async () => {
    setIsSavingLocation(true);
    try {
      const location = await createLocation(newLocationInput);
      const nextOptions = mergeLocations([...localOptions, location]);
      setLocalOptions(nextOptions);
      onOptionsChange?.(nextOptions);
      onValueChange(location.name);
      setNewLocationInput("");
      setIsAddingLocation(false);
      setOpen(false);
      toast.success(`Location "${location.name}" ready to use.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create location.";
      toast.error(message);
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleCancelAdd = () => {
    setNewLocationInput("");
    setIsAddingLocation(false);
  };

  return (
    <>
      <div className="flex gap-2">
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
              disabled={disabled || isSavingLocation}
            >
              <span className="truncate text-left">
                {selectedLocation?.name || trimLocationName(value) || "Select a location"}
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search locations..."
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandList>
                {filteredOptions.length > 0 ? (
                  <CommandGroup heading="Locations">
                    {filteredOptions.map((option) => {
                      const isSelected = selectedLocation?.id === option.id;
                      return (
                        <CommandItem key={option.id} value={option.name} onSelect={() => handleSelect(option.name)}>
                          <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                          {option.name}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ) : null}
                {filteredOptions.length === 0 ? (
                  <CommandEmpty>No matching locations.</CommandEmpty>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {!isAddingLocation ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsAddingLocation(true)}
            disabled={disabled || isSavingLocation}
          >
            Add
          </Button>
        ) : null}
      </div>
      {isAddingLocation ? (
        <div className="mt-2 space-y-2 rounded-md border border-dashed p-3">
          <Label htmlFor={id ? `${id}-new-location` : undefined}>New Location</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={id ? `${id}-new-location` : undefined}
              value={newLocationInput}
              onChange={(event) => setNewLocationInput(event.target.value)}
              placeholder="Add new location"
              disabled={disabled || isSavingLocation}
              className="min-w-[220px] flex-1"
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void handleAddLocation();
              }}
            />
            <Button
              type="button"
              onClick={() => void handleAddLocation()}
              disabled={disabled || isSavingLocation || !trimmedNewLocationInput}
            >
              {isSavingLocation ? "Saving..." : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelAdd}
              disabled={disabled || isSavingLocation}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
