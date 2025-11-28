import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const PLATFORMS = [
  { id: 'telegram', name: 'Telegram', color: 'bg-blue-500' },
  { id: 'youtube', name: 'YouTube', color: 'bg-red-600' },
  { id: 'tiktok', name: 'TikTok', color: 'bg-black' },
] as const;
