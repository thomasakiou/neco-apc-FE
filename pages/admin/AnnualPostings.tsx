import React from 'react';

const AnnualPostings: React.FC = () => {
  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-6 bg-slate-50 dark:bg-[#101922] transition-colors duration-200 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-gray-800">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-700 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-500 tracking-tight">
            Annual Postings 2024
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Manage and view all staff postings for the current year.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#121b25] rounded-lg border border-gray-200 dark:border-gray-800 p-4 transition-colors">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
          <div className="relative w-full sm:max-w-xs">
            <span className="absolute inset-y-0 left-3 flex items-center material-symbols-outlined text-gray-400">search</span>
            <input className="form-input w-full pl-10 h-10 rounded-lg bg-gray-50 dark:bg-[#0b1015] border-gray-300 dark:border-gray-700 focus:ring-primary focus:border-primary text-sm text-slate-700 dark:text-slate-300" placeholder="Search by Staff Name or ID" />
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary h-10 px-4 flex items-center gap-2 text-sm"><span className="material-symbols-outlined text-lg">filter_list</span> Filter</button>
            <button className="btn-secondary h-10 px-4 flex items-center gap-2 text-sm"><span className="material-symbols-outlined text-lg">picture_as_pdf</span> Export PDF</button>
            <button className="btn-primary h-10 px-4 flex items-center gap-2 text-sm font-bold"><span className="material-symbols-outlined text-lg">print</span> Print Layout</button>
          </div>
        </div>

        <div className="flex gap-3 pb-3">
          <button className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-sm font-medium">All</button>
          <button className="bg-gray-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700">Pending</button>
          <button className="bg-gray-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700">Confirmed</button>
          <button className="bg-gray-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700">Acknowledged</button>
        </div>

        <div className="overflow-x-auto border rounded-lg border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="bg-gray-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 font-semibold">
              <tr>
                <th className="p-4"><input type="checkbox" className="rounded text-primary focus:ring-primary" /></th>
                <th className="p-4">Staff Name</th>
                <th className="p-4">Staff ID</th>
                <th className="p-4">Current Location</th>
                <th className="p-4">Posting Location</th>
                <th className="p-4">Period</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-[#121b25]">
              <Row name="Abubakar Sadiq" id="NECO/001" cur="Headquarters, Minna" post="State Office, Lagos" status="Confirmed" color="green" />
              <Row name="Chidinma Okoro" id="NECO/002" cur="State Office, Kano" post="Zonal Office, Enugu" status="Pending" color="yellow" />
              <Row name="Tunde Adebayo" id="NECO/003" cur="State Office, Rivers" post="Headquarters, Minna" status="Confirmed" color="green" />
              <Row name="Fatima Bello" id="NECO/004" cur="Zonal Office, Kaduna" post="State Office, Oyo" status="Acknowledged" color="blue" />
              <Row name="Emeka Nwosu" id="NECO/005" cur="State Office, Abuja" post="State Office, Delta" status="Pending" color="yellow" />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Row = ({ name, id, cur, post, status, color }: any) => {
  const badgeMap: any = {
    green: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
    yellow: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
  };
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="p-4"><input type="checkbox" className="rounded text-primary focus:ring-primary" /></td>
      <td className="p-4 font-medium text-slate-900 dark:text-slate-200">{name}</td>
      <td className="p-4">{id}</td>
      <td className="p-4">{cur}</td>
      <td className="p-4">{post}</td>
      <td className="p-4">Jan 2024 - Dec 2024</td>
      <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${badgeMap[color]}`}>{status}</span></td>
      <td className="p-4"><button className="text-primary hover:underline font-medium">View Details</button></td>
    </tr>
  );
};

export default AnnualPostings;