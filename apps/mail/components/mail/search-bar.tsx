import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, SlidersHorizontal, CalendarIcon, Trash2 } from "lucide-react";
import { useSearchValue } from "@/hooks/use-search-value";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { type DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useDebounce } from "react-use";
import { Toggle } from "../ui/toggle";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const inboxes = ["inbox", "spam", "trash", "unread", "starred", "important", "sent", "draft"];

function DateFilter({ date, setDate }: { date: DateRange; setDate: (date: DateRange) => void }) {
  return (
    <div className="grid gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "justify-start text-left font-normal",
              !date && "text-muted-foreground",
              "h-10 rounded-xl bg-muted/50",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date or a range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-xl p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={(range) => range && setDate(range)}
            numberOfMonths={2}
            disabled={(date) => date > new Date()}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

type SearchForm = {
  subject: string;
  from: string;
  to: string;
  q: string;
  dateRange: DateRange;
  category: string;
  folder: string;
};

export function SearchBar() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [, setSearchValue] = useSearchValue();
  const [value, setValue] = useState<SearchForm>({
    folder: "",
    subject: "",
    from: "",
    to: "",
    q: "",
    dateRange: {
      from: undefined,
      to: undefined,
    },
    category: "",
  });

  const form = useForm<SearchForm>({
    defaultValues: value,
  });

  useEffect(() => {
    const subscription = form.watch((data) => {
      setValue(data as SearchForm);
    });
    return () => subscription.unsubscribe();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [form.watch]);

  useDebounce(
    () => {
      submitSearch(value);
    },
    250,
    [value],
  );

  const submitSearch = (data: SearchForm) => {
    const from = data.from ? `from:(${data.from})` : "";
    const to = data.to ? `to:(${data.to})` : "";
    const subject = data.subject ? `subject:(${data.subject})` : "";
    const dateAfter = data.dateRange.from
      ? `after:${format(data.dateRange.from, "MM/dd/yyyy")}`
      : "";
    const dateBefore = data.dateRange.to ? `before:${format(data.dateRange.to, "MM/dd/yyyy")}` : "";
    const category = data.category ? `category:(${data.category})` : "";
    const searchQuery = `${data.q} ${from} ${to} ${subject} ${dateAfter} ${dateBefore} ${category}`;
    const folder = data.folder ? data.folder.toUpperCase() : "";

    setSearchValue({
      value: searchQuery,
      highlight: data.q,
      folder: folder,
    });
  };

  const resetSearch = () => {
    form.reset();
    setSearchValue({
      value: "",
      highlight: "",
      folder: "",
    });
  };

  // might be bad but the alternatives are less readable and intuitive,
  // maybe to something else if we have to add more filters/search options
  const filtering =
    value.q.length > 0 ||
    value.from.length > 0 ||
    value.to.length > 0 ||
    value.dateRange.from ||
    value.dateRange.to ||
    value.category ||
    value.folder;

  return (
    <div className="relative flex-1 md:max-w-[600px]">
      <form className="relative flex items-center" onSubmit={form.handleSubmit(submitSearch)}>
        <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search"
          autoFocus
          className="h-8 w-full rounded-[8px] border-none bg-muted/50 pl-9 pr-14 text-muted-foreground shadow-none ring-1 ring-muted transition-colors placeholder:text-muted-foreground/70 hover:bg-muted focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring"
          {...form.register("q")}
        />
        <div className="absolute right-2 flex items-center gap-1.5">
          {filtering && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-lg p-0 text-muted-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground"
              onClick={resetSearch}
            >
              <Trash2 className="h-4 w-4 text-inherit" aria-hidden="true" />
            </Button>
          )}
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 rounded-lg p-0 text-muted-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <SlidersHorizontal
                  className="h-4 w-4 text-inherit transition-colors"
                  aria-hidden="true"
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(calc(100vw-2rem),400px)] rounded-xl border bg-card/95 p-4 shadow-lg sm:w-[500px] md:w-[600px]"
              side="bottom"
              sideOffset={15}
              alignOffset={-8}
              align="end"
            >
              <div className="space-y-5">
                <div>
                  <h2 className="mb-3 text-xs font-semibold">Quick Filters</h2>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-xl bg-muted/50 text-xs hover:bg-muted"
                      onClick={() => form.setValue("q", "is:unread")}
                    >
                      Unread
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-xl bg-muted/50 text-xs hover:bg-muted"
                      onClick={() => form.setValue("q", "has:attachment")}
                    >
                      Has Attachment
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-xl bg-muted/50 text-xs hover:bg-muted"
                      onClick={() => form.setValue("q", "is:starred")}
                    >
                      Starred
                    </Button>
                  </div>
                </div>

                <Separator className="bg-border/50" />

                <div className="grid gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Search in</label>
                    <Select
                      onValueChange={(value) => form.setValue("folder", value)}
                      value={form.watch("folder")}
                    >
                      <SelectTrigger className="h-8 rounded-xl bg-muted/50 capitalize">
                        <SelectValue placeholder="All Mail" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {inboxes.map((inbox) => (
                          <SelectItem key={inbox} value={inbox} className="capitalize">
                            {inbox}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Subject</label>
                    <Input
                      placeholder="Email subject"
                      {...form.register("subject")}
                      className="h-8 rounded-xl bg-muted/50"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold">From</label>
                      <Input
                        placeholder="Sender"
                        {...form.register("from")}
                        className="h-8 rounded-xl bg-muted/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold">To</label>
                      <Input
                        placeholder="Recipient"
                        {...form.register("to")}
                        className="h-8 rounded-xl bg-muted/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Date Range</label>
                    <DateFilter
                      date={value.dateRange}
                      setDate={(range) => form.setValue("dateRange", range)}
                    />
                  </div>
                </div>

                <Separator className="bg-border/50" />

                <div>
                  <h2 className="mb-3 text-xs font-semibold">Category</h2>
                  <div className="flex flex-wrap gap-2">
                    <Toggle
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-xl bg-muted/50 text-xs transition-colors data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:ring-1 data-[state=on]:ring-primary/20"
                      pressed={form.watch("category") === "primary"}
                      onPressedChange={(pressed) =>
                        form.setValue("category", pressed ? "primary" : "")
                      }
                    >
                      Primary
                    </Toggle>
                    <Toggle
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-xl bg-muted/50 text-xs transition-colors data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:ring-1 data-[state=on]:ring-primary/20"
                      pressed={form.watch("category") === "updates"}
                      onPressedChange={(pressed) =>
                        form.setValue("category", pressed ? "updates" : "")
                      }
                    >
                      Updates
                    </Toggle>
                    <Toggle
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-xl bg-muted/50 text-xs transition-colors data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:ring-1 data-[state=on]:ring-primary/20"
                      pressed={form.watch("category") === "promotions"}
                      onPressedChange={(pressed) =>
                        form.setValue("category", pressed ? "promotions" : "")
                      }
                    >
                      Promotions
                    </Toggle>
                    <Toggle
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-xl bg-muted/50 text-xs transition-colors data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:ring-1 data-[state=on]:ring-primary/20"
                      pressed={form.watch("category") === "social"}
                      onPressedChange={(pressed) =>
                        form.setValue("category", pressed ? "social" : "")
                      }
                    >
                      Social
                    </Toggle>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    onClick={resetSearch}
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-xl text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 rounded-xl bg-primary text-xs text-primary-foreground shadow-none transition-colors hover:bg-primary/90"
                    type="submit"
                    onClick={() => setPopoverOpen(false)}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </form>
    </div>
  );
}
