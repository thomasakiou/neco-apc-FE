import React from 'react';

const ExamCenters: React.FC = () => {
    return (
        <div className="flex-1 p-8 max-w-7xl mx-auto flex flex-col gap-6 bg-slate-50 dark:bg-[#101922] transition-colors duration-200 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-slate-200">Exam Centers Management</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage, add, and import exam centers.</p>
                </div>
                <div className="flex gap-3">
                    <button className="btn-primary h-10 px-4 flex items-center gap-2 text-sm"><span className="material-symbols-outlined text-lg">add</span> Add New Center</button>
                    <button className="btn-secondary h-10 px-4 flex items-center gap-2 text-sm"><span className="material-symbols-outlined text-lg">upload_file</span> Import from CSV</button>
                </div>
            </div>

            <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                    <span className="material-symbols-outlined absolute left-3 top-3 text-gray-400">search</span>
                    <input className="form-input w-full pl-10 h-12 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-slate-900 dark:text-slate-200 focus:ring-primary focus:border-primary" placeholder="Search by Center Name, Code, or Address..." />
                </div>
                <div className="flex gap-3">
                    <FilterBtn label="State" />
                    <FilterBtn label="LGA" />
                    <FilterBtn label="Center Type" />
                </div>
            </div>

            <div className="bg-white dark:bg-[#121b25] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm transition-colors">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                    <thead className="bg-gray-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Center Code</th>
                            <th className="px-6 py-3">Center Name</th>
                            <th className="px-6 py-3">State</th>
                            <th className="px-6 py-3">LGA</th>
                            <th className="px-6 py-3">Capacity</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        <CenterRow code="NG-ABJ-001" name="Model Secondary School, Maitama" state="FCT" lga="AMAC" cap="500" status="Active" />
                        <CenterRow code="NG-LAG-015" name="King's College, Lagos" state="Lagos" lga="Lagos Island" cap="1200" status="Active" />
                        <CenterRow code="NG-KAN-003" name="Government Girls College, Dala" state="Kano" lga="Dala" cap="850" status="Inactive" color="yellow" />
                        <CenterRow code="NG-RIV-007" name="Federal Government College" state="Rivers" lga="Obio/Akpor" cap="900" status="Active" />
                        <CenterRow code="NG-ENU-002" name="College of Immaculate Conception" state="Enugu" lga="Enugu North" cap="750" status="Active" />
                    </tbody>
                </table>
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Showing 1 to 5 of 97 entries</span>
                    <div className="flex border dark:border-gray-700 rounded-lg overflow-hidden">
                        <button className="px-3 py-1 bg-white dark:bg-[#0b1015] hover:bg-gray-50 dark:hover:bg-slate-800 border-r dark:border-gray-700 text-slate-600 dark:text-slate-300">Previous</button>
                        <button className="px-3 py-1 bg-white dark:bg-[#0b1015] hover:bg-gray-50 dark:hover:bg-slate-800 border-r dark:border-gray-700 text-slate-600 dark:text-slate-300">1</button>
                        <button className="px-3 py-1 bg-white dark:bg-[#0b1015] hover:bg-gray-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FilterBtn = ({ label }: any) => (
    <button className="h-12 px-4 bg-white dark:bg-[#0b1015] border border-gray-200 dark:border-gray-700 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200">
        {label} <span className="material-symbols-outlined text-gray-400">expand_more</span>
    </button>
);

const CenterRow = ({ code, name, state, lga, cap, status, color = 'green' }: any) => {
    const badgeColor = color === 'green' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400';
    return (
        <tr className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
            <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">{code}</td>
            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{name}</td>
            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{state}</td>
            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{lga}</td>
            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{cap}</td>
            <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${badgeColor}`}>{status}</span></td>
            <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-3">
                    <button className="text-primary hover:text-primary-hover dark:text-emerald-400 dark:hover:text-emerald-300"><span className="material-symbols-outlined text-lg">edit</span></button>
                    <button className="text-red-500 hover:text-red-600 dark:text-rose-400 dark:hover:text-rose-300"><span className="material-symbols-outlined text-lg">delete</span></button>
                </div>
            </td>
        </tr>
    );
}

export default ExamCenters;