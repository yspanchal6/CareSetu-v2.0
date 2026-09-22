import { InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from "react";
import { Search } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className = "", id, ...rest }, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold text-navy mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky/30 focus:border-sky outline-none transition-colors ${
          error ? "border-emergency" : "border-slate-200"
        } ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-emergency mt-1">{error}</p>}
    </div>
  );
});
Input.displayName = "Input";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, className = "", children, id, ...rest }, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold text-navy mb-1.5">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-sky/30 focus:border-sky outline-none transition-colors ${className}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
});
Select.displayName = "Select";

export function SearchInput({ placeholder = "Search...", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative w-full">
      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
      <input
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky/30 focus:border-sky outline-none transition-colors"
        {...rest}
      />
    </div>
  );
}
