import React from 'react';

const AssignmentHistory: React.FC = () => {
    return (
        <div className="p-8 max-w-7xl mx-auto flex flex-col gap-6 bg-slate-50 dark:bg-[#101922] transition-colors duration-200 min-h-screen">
            <div className="flex justify-between items-center">
                <h1 className="text-4xl font-black text-slate-900 dark:text-slate-200">Mandate Assignment History</h1>
                <button className="btn-primary h-10 px-4 text-sm font-bold flex items-center gap-2"><span className="material-symbols-outlined">download</span> Export History</button>
            </div>

            <div className="bg-white dark:bg-[#121b25] p-4 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm transition-colors">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="lg:col-span-2">
                        <label className="text-sm font-medium text-gray-500 dark:text-slate-400 block mb-1">Search</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400">search</span>
                            <input className="form-input w-full pl-10 h-10 rounded-lg bg-gray-50 dark:bg-[#0b1015] border-gray-200 dark:border-gray-700 text-sm text-slate-900 dark:text-slate-200" placeholder="Search by Mandate ID, Staff Name..." />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-slate-400 block mb-1">Date Range</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400">calendar_today</span>
                            <input className="form-input w-full pl-10 h-10 rounded-lg bg-gray-50 dark:bg-[#0b1015] border-gray-200 dark:border-gray-700 text-sm text-slate-900 dark:text-slate-200" placeholder="Select Date Range" />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-slate-400 block mb-1">Assignment Status</label>
                        <select className="form-select w-full h-10 rounded-lg bg-gray-50 dark:bg-[#0b1015] border-gray-200 dark:border-gray-700 text-sm text-slate-900 dark:text-slate-200"><option>All Statuses</option></select>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button className="btn-secondary h-9 px-4 text-sm font-bold">Reset</button>
                    <button className="btn-primary h-9 px-4 text-sm font-bold">Apply Filters</button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#121b25] border border-gray-200 dark:border-gray-800 rounded-xl overflow-x-auto shadow-sm transition-colors">
                <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                    <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs text-gray-500 dark:text-slate-400 uppercase">
                        <tr>
                            <th className="px-6 py-3">Mandate ID</th>
                            <th className="px-6 py-3">Mandate Title</th>
                            <th className="px-6 py-3">Assigned To</th>
                            <th className="px-6 py-3">Assigned By</th>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        <HRow id="M-2023-087" title="Verification Officer - Lagos" to="John Doe (S-12345)" by="Admin User" date="2023-08-15 10:30 AM" status="Active" color="green" />
                        <HRow id="M-2023-086" title="Data Entry Clerk - Abuja HQ" to="Jane Smith (S-67890)" by="Admin User" date="2023-08-14 02:45 PM" status="Revoked" color="red" />
                        <HRow id="M-2023-085" title="IT Support Staff - Enugu" to="Peter Jones (S-54321)" by="System" date="2023-08-12 09:00 AM" status="Completed" color="gray" />
                        <HRow id="M-2023-084" title="Field Inspector - PH" to="Chioma Nwosu" by="Admin User" date="2023-08-11 11:00 AM" status="Pending" color="yellow" />
                    </tbody>
                </table>
                <div className="p-4 flex justify-between items-center text-sm text-gray-500 dark:text-slate-400">
                    <span>Showing 1 to 4 of 57 results</span>
                    <div className="flex gap-1">
                        <button className="p-1 border dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-slate-800"><span className="material-symbols-outlined text-sm">chevron_left</span></button>
                        <button className="w-8 h-8 bg-primary text-white font-bold rounded">1</button>
                        <button className="w-8 h-8 border dark:border-gray-700 bg-white dark:bg-[#0b1015] rounded hover:bg-gray-100 dark:hover:bg-slate-800">2</button>
                        <button className="p-1 border dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-slate-800"><span className="material-symbols-outlined text-sm">chevron_right</span></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const HRow = ({ id, title, to, by, date, status, color }: any) => {
    const map: any = {
        green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
        red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
        gray: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
        yellow: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
    };
    return (
        <tr className="hover:bg-gray-50 dark:hover:bg-slate-800/50 border-b dark:border-gray-800 last:border-0 transition-colors">
            <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">{id}</td>
            <td className="px-6 py-4">{title}</td>
            <td className="px-6 py-4">{to}</td>
            <td className="px-6 py-4">{by}</td>
            <td className="px-6 py-4">{date}</td>
            <td className="px-6 py-4"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[color]}`}>{status}</span></td>
            <td className="px-6 py-4 text-center"><button className="text-primary hover:text-primary-hover"><span className="material-symbols-outlined">visibility</span></button></td>
        </tr>
    );
};

export default AssignmentHistory;