import { format, isToday, isThisMonth, differenceInCalendarMonths } from "date-fns";
import { MAX_URL_LENGTH } from "./constants";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import LZString from "lz-string";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const compressText = (text: string): string => {
  const compressed = LZString.compressToEncodedURIComponent(text);
  return compressed.slice(0, MAX_URL_LENGTH);
};

export const decompressText = (compressed: string): string => {
  return LZString.decompressFromEncodedURIComponent(compressed) || "";
};

export const getCookie = (key: string): string | null => {
  const cookies = Object.fromEntries(
    document.cookie.split("; ").map((v) => v.split(/=(.*)/s).map(decodeURIComponent)),
  );
  return cookies?.[key] ?? null;
};

export const formatDate = (date: string) => {
  try {
    if (isToday(date)) return format(date, "h:mm a");
    if (isThisMonth(date) || differenceInCalendarMonths(new Date(), date) === 1)
      return format(date, "MMM dd");

    return format(date, "MM/dd/yy");
  } catch (error) {
    console.error("Error formatting date", error);
    return "";
  }
};

export const cleanEmailAddress = (email: string = "") => {
  return email.replace(/[<>]/g, "").trim();
};

export const truncateFileName = (name: string, maxLength = 15) => {
  if (name.length <= maxLength) return name;
  const extIndex = name.lastIndexOf(".");
  if (extIndex !== -1 && name.length - extIndex <= 5) {
    return `${name.slice(0, maxLength - 5)}...${name.slice(extIndex)}`;
  }
  return `${name.slice(0, maxLength)}...`;
};
