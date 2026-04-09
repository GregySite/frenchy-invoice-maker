import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { SmartBeeClient } from "@/hooks/useSmartBeeData";

interface ClientSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (client: SmartBeeClient) => void;
  clients: SmartBeeClient[];
  placeholder?: string;
}

export default function ClientSearch({
  value,
  onChange,
  onSelect,
  clients,
  placeholder = "Nom du client",
}: ClientSearchProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value.length >= 2
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 8)
    : [];

  // Ferme la liste si on clique en dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((client) => (
            <li key={client.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(client);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{client.name}</span>
                {client.address && (
                  <span className="block text-xs text-muted-foreground truncate">
                    {client.address}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
