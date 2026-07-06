"use client";
import { Search } from "lucide-react";

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search
        size={15}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-64 rounded-md border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-teal/15"
      />
    </div>
  );
}
