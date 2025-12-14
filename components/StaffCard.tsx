import React from 'react';
import { StaffMandateAssignment } from '../types/apc';

interface StaffCardProps {
    staff: StaffMandateAssignment;
    onDragStart: (e: React.DragEvent, staff: StaffMandateAssignment) => void;
    onClick?: (staff: StaffMandateAssignment) => void;
}

export const StaffCard: React.FC<StaffCardProps> = ({ staff, onDragStart, onClick }) => {
    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, staff)}
            onClick={() => onClick && onClick(staff)}
            className="bg-white dark:bg-[#121b25] p-3 rounded-lg border border-slate-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 cursor-grab active:cursor-grabbing transition-all group"
        >
            <div className="flex justify-between items-start mb-1">
                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate pr-2" title={staff.staff_name}>
                    {staff.staff_name}
                </div>
                <div className="text-sm font-black font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-600 shadow-sm">
                    {staff.staff_no}
                </div>
            </div>

            <div className="flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5" title="Rank">
                    <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
                    <span className="truncate">{staff.rank || 'No Rank'}</span>
                </div>
                <div className="flex items-center gap-1.5" title="Current Station">
                    <span className="material-symbols-outlined text-[14px] text-blue-500">location_on</span>
                    <span className="truncate">{staff.current_station || 'No Station'}</span>
                </div>
                {staff.conr && (
                    <div className="flex items-center gap-1.5" title="CONRAISS">
                        <span className="material-symbols-outlined text-[14px] text-purple-500">trending_up</span>
                        <span className="truncate">CONR: {staff.conr}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
