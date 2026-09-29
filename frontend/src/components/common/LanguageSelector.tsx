import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown, Search } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface LanguageSelectorProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className = '',
  variant = 'full'
}) => {
  const { currentLanguage, supportedLanguages, setLanguage, languageConfig } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Close dropdown on Escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  const filteredLanguages = supportedLanguages.filter(
    (lang) =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select application language"
        className="inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-sky/40 transition-all shadow-2xs cursor-pointer"
      >
        <Globe className="w-4 h-4 text-sky shrink-0" />
        <span className="truncate">
          {variant === 'compact' ? languageConfig.code.toUpperCase() : languageConfig.nativeName}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          aria-label="Languages"
          className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 py-2 overflow-hidden animate-fade-in"
        >
          {/* Search Box */}
          <div className="px-3 pb-2 border-b border-slate-100">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search languages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky/40 text-navy font-medium"
              />
            </div>
          </div>

          {/* Language Options List */}
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredLanguages.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-400 text-center">No languages found</div>
            ) : (
              filteredLanguages.map((lang) => {
                const isSelected = lang.code === currentLanguage;
                return (
                  <button
                    key={lang.code}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setLanguage(lang.code);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-paleblue text-navy font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-navy'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{lang.nativeName}</span>
                      <span className="text-[10px] text-text-secondary">{lang.name}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-sky shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
