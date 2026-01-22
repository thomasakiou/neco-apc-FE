import React, { useState } from 'react';

interface StationTypeSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: string) => void;
}

const StationTypeSelectionModal: React.FC<StationTypeSelectionModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [selectedType, setSelectedType] = useState<string>('');

    if (!isOpen) return null;

    const options = [
        { id: 'state', label: 'State', icon: 'map' },
        { id: 'school', label: 'School', icon: 'school' },
        { id: 'bece_custodian', label: 'BECE Custodian', icon: 'security' },
        { id: 'ssce_custodian', label: 'SSCE INT Custodian', icon: 'verified_user' },
        { id: 'ssce_ext_custodian', label: 'SSCE EXT Custodian', icon: 'verified_user' },
        { id: 'ncee_center', label: 'NCEE Exam Center', icon: 'location_city' },
        { id: 'gifted_center', label: 'Gifted Center', icon: 'auto_awesome' },
        { id: 'tt_center', label: 'TT Center', icon: 'science' },
        { id: 'marking_venue', label: 'SSCE INT Marking Venue', icon: 'edit_note' },
        { id: 'ssce_ext_marking_venue', label: 'SSCE EXT Marking Venue', icon: 'edit_location' },
        { id: 'bece_marking_venue', label: 'BECE Marking Venue', icon: 'edit_location' },
        { id: 'printing_point', label: 'Printing Point', icon: 'print' },
    ];

    const handleConfirm = () => {
        if (selectedType) {
            onSelect(selectedType);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#121b25] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-gray-800">
                <div className="p-6 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Select Station Type</h3>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Choose the type of station to load for assignment.
                    </p>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-3">
                        {options.map((option) => (
                            <label
                                key={option.id}
                                className={`
                                    flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group
                                    ${selectedType === option.id
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                        : 'border-slate-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-slate-50 dark:hover:bg-gray-800'}
                                `}
                            >
                                <input
                                    type="radio"
                                    name="stationType"
                                    value={option.id}
                                    checked={selectedType === option.id}
                                    onChange={() => setSelectedType(option.id)}
                                    className="hidden"
                                />
                                <div className={`
                                    w-10 h-10 rounded-full flex items-center justify-center mr-4 transition-colors
                                    ${selectedType === option.id
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 group-hover:text-emerald-600'}
                                `}>
                                    <span className="material-symbols-outlined">{option.icon}</span>
                                </div>
                                <div className="flex-1">
                                    <span className={`
                                        font-bold block text-lg
                                        ${selectedType === option.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-gray-300'}
                                    `}>
                                        {option.label}
                                    </span>
                                </div>
                                <div className={`
                                    w-5 h-5 rounded-full border-2 flex items-center justify-center
                                    ${selectedType === option.id ? 'border-emerald-500' : 'border-slate-300 dark:border-gray-600'}
                                `}>
                                    {selectedType === option.id && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                    )}
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-slate-900/20 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedType}
                        className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:shadow-none transition-all"
                    >
                        Load Stations
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StationTypeSelectionModal;
