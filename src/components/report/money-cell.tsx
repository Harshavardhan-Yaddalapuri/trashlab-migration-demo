import { centsFromString, centsToDisplay } from "@/lib/money";

export function MoneyCell({ value }: { value: string }) {
  const cents = centsFromString(value);
  return <span className="font-mono text-sm text-zinc-100">{centsToDisplay(cents)}</span>;
}
