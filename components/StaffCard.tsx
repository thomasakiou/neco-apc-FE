import React from 'react';
import { StaffMandateAssignment } from '../types/apc';

interface StaffCardProps {
    staff: StaffMandateAssignment;
    onDragStart: (e: React.DragEvent, staff: StaffMandateAssignment) => void;
    onClick?: (staff: StaffMandateAssignment) => void;
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
}

export const StaffCard = React.memo<StaffCardProps>(({ staff, onDragStart, onClick, isSelected, onToggleSelect }) => {
    return (
        <div
            draggable={staff.assign_left !== 0}
            onDragStart={(e) => staff.assign_left !== 0 && onDragStart(e, staff)}
            onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                    onToggleSelect?.(staff.id);
                } else {
                    onClick?.(staff);
                }
            }}
            className={`p-3 rounded-lg border shadow-sm transition-all group relative ${staff.assign_left === 0
                ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-gray-800 opacity-50 grayscale cursor-not-allowed'
                : isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                    : 'bg-white dark:bg-[#121b25] border-slate-200 dark:border-gray-700 hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 cursor-grab active:cursor-grabbing'
                }`}
        >
            {/* Selection Indicator */}
            {onToggleSelect && (
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(staff.id);
                    }}
                    className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all z-20 cursor-pointer ${isSelected
                        ? 'bg-indigo-600 border-white text-white scale-110 shadow-md'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 opacity-0 group-hover:opacity-100 hover:scale-110'
                        }`}>
                    {isSelected && <span className="material-symbols-outlined text-[12px] font-black">check</span>}
                </div>
            )}

            <div className="flex justify-between items-start mb-1">
                <div className="font-bold text-slate-800 dark:text-slate-200 text-base truncate pr-2" title={staff.staff_name}>
                    {staff.staff_name}
                </div>
                <div className="text-sm font-black font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 shadow-sm">
                    {staff.staff_no}
                </div>
            </div>

            <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5" title="Rank">
                    <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
                    <span className="truncate">{staff.rank || 'No Rank'}</span>
                </div>
                <div className="flex items-center gap-1.5" title="Current Station">
                    <span className="material-symbols-outlined text-[14px] text-blue-500">location_on</span>
                    <span className="truncate">{staff.current_station || 'No Station'}</span>
                </div>
                {staff.qualification && (
                    <div className="flex items-start gap-1.5" title="Qualification">
                        <span className="material-symbols-outlined text-[14px] text-amber-500 mt-0.5">school</span>
                        <span className="italic font-medium leading-tight">{staff.qualification}</span>
                    </div>
                )}
                <div className="flex items-center justify-between mt-1">
                    {staff.conr && (
                        <div className="flex items-center gap-1.5" title="CONRAISS">
                            <span className="material-symbols-outlined text-[14px] text-purple-500">trending_up</span>
                            <span className="truncate font-bold">CONR: {staff.conr}</span>
                        </div>
                    )}
                    {(staff.assign_left !== undefined) && (
                        <div className={`px-1.5 py-0.5 rounded text-xs font-black border uppercase tracking-tighter ${staff.assign_left === 0
                            ? 'bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
                            : 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                            }`}>
                            {staff.assign_left} Slots
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
