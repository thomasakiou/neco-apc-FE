import React, { useState, useRef, useEffect } from 'react';

interface Option {
    id: string;
    name: string;
    display_name?: string;
    type?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    className = '',
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.id === value);

    const filteredOptions = options.filter(option =>
        option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (option.display_name && option.display_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset search when opening
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    const handleSelect = (optionId: string) => {
        onChange(optionId);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
                    w-full h-10 px-3 rounded-lg border bg-white dark:bg-[#0b1015] text-sm text-slate-700 dark:text-slate-200 
                    flex items-center justify-between cursor-pointer transition-all
                    ${disabled ? 'opacity-50 cursor-not-allowed border-slate-300 dark:border-gray-700' : 'hover:border-emerald-400 focus:border-emerald-500 border-slate-300 dark:border-gray-700'}
                    ${isOpen ? 'ring-2 ring-emerald-500/20 border-emerald-500' : ''}
                `}
            >
                <span className={`block truncate ${!selectedOption ? 'text-slate-400' : ''}`}>
                    {selectedOption ? (selectedOption.display_name || selectedOption.name) : placeholder}
                </span>
                <span className="material-symbols-outlined text-slate-400 text-xl">
                    {isOpen ? 'expand_less' : 'expand_more'}
                </span>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-slate-900/50 sticky top-0">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search..."
                            className="w-full h-8 px-2 rounded border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            autoFocus
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking input
                        />
                    </div>

                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.id}
                                    onClick={() => handleSelect(option.id)}
                                    className={`
                                        px-3 py-2 text-sm rounded cursor-pointer transition-colors
                                        ${value === option.id
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-medium'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800'}
                                    `}
                                >
                                    {option.display_name || option.name}
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-xs text-slate-400">
                                No options found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
