import React from 'react';
import { StaffMandateAssignment, MandateColumn as MandateColumnType } from '../types/apc';
import { StaffCard } from './StaffCard';

interface MandateColumnProps {
    columnId: string; // 'unassigned' or mandateId
    title: string;
    subtitle?: string;
    staffList: StaffMandateAssignment[];
    isDropTarget?: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, targetColumnId: string) => void;
    onCardClick?: (staff: StaffMandateAssignment) => void;
    colorTheme?: 'slate' | 'emerald' | 'blue' | 'purple' | 'amber';
}

interface MandateColumnProps {
    columnId: string; // 'unassigned' or mandateId
    title: string;
    subtitle?: string;
    staffList: StaffMandateAssignment[];
    isDropTarget?: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, targetColumnId: string) => void;
    onCardClick?: (staff: StaffMandateAssignment) => void;
    colorTheme?: 'slate' | 'emerald' | 'blue' | 'purple' | 'amber';
    selectedStaffIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
}

export const MandateColumn = React.memo<MandateColumnProps>(({
    columnId,
    title,
    subtitle,
    staffList,
    isDropTarget,
    onDragOver,
    onDrop,
    onCardClick,
    colorTheme = 'slate',
    selectedStaffIds,
    onToggleSelect
}) => {
    const getThemeStyles = () => {
        switch (colorTheme) {
            case 'emerald': return { bg: 'bg-emerald-50/50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-800 dark:text-emerald-400', headerBg: 'bg-emerald-100/50 dark:bg-emerald-900/30' };
            case 'blue': return { bg: 'bg-blue-50/50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-400', headerBg: 'bg-blue-100/50 dark:bg-blue-900/30' };
            case 'purple': return { bg: 'bg-purple-50/50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-800 dark:text-purple-400', headerBg: 'bg-purple-100/50 dark:bg-purple-900/30' };
            case 'amber': return { bg: 'bg-amber-50/50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-800 dark:text-amber-400', headerBg: 'bg-amber-100/50 dark:bg-amber-900/30' };
            default: return { bg: 'bg-slate-50 dark:bg-[#0b1015]', border: 'border-slate-200 dark:border-gray-800', text: 'text-slate-700 dark:text-slate-300', headerBg: 'bg-slate-100 dark:bg-slate-800' };
        }
    };

    const theme = getThemeStyles();

    const handleDragStart = (e: React.DragEvent, staff: StaffMandateAssignment) => {
        e.dataTransfer.setData('application/json', JSON.stringify(staff));
        e.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div
            className={`flex flex-col min-w-[300px] w-full max-w-sm rounded-xl border ${theme.border} ${theme.bg} overflow-hidden transition-all h-full group/col`}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, columnId)}
        >
            {/* Header */}
            <div className={`p-4 border-b ${theme.border} ${theme.headerBg} flex justify-between items-center sticky top-0 backdrop-blur-sm z-10 shadow-sm`}>
                <div className="flex flex-col overflow-hidden">
                    <h3 className={`font-black text-base ${theme.text} truncate uppercase tracking-tight`} title={title}>{title}</h3>
                    {subtitle && <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate opacity-70 italic">{subtitle}</span>}
                </div>
                <div className="flex items-center gap-2">
                    <span className={`flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-black rounded-lg bg-white dark:bg-gray-800 ${theme.text} shadow-sm border ${theme.border}`}>
                        {staffList.length}
                    </span>
                </div>
            </div>

            {/* Drop Zone */}
            <div className={`flex-1 min-h-0 overflow-y-auto p-3 pb-10 flex flex-col gap-2.5 custom-scrollbar ${isDropTarget ? 'bg-indigo-50/50 ring-2 ring-inset ring-indigo-500/20' : ''}`}>
                {staffList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 py-10 opacity-40 grayscale">
                        <span className="material-symbols-outlined text-4xl">inventory_2</span>
                        <span className="text-[10px] uppercase font-bold tracking-widest">Empty Workspace</span>
                    </div>
                ) : (
                    staffList.map(staff => (
                        <StaffCard
                            key={staff.id}
                            staff={staff}
                            onDragStart={handleDragStart}
                            onClick={onCardClick}
                            isSelected={selectedStaffIds?.has(staff.id)}
                            onToggleSelect={onToggleSelect}
                        />
                    ))
                )}
            </div>
        </div>
    );
});
