import React from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const dataBar = [
  { name: 'HQ', value: 20 },
  { name: 'Lagos', value: 100 },
  { name: 'Kano', value: 90 },
  { name: 'Enugu', value: 80 },
  { name: 'Kaduna', value: 30 },
  { name: 'Oyo', value: 90 },
  { name: 'Rivers', value: 10 },
];

const dataPie = [
  { name: 'Completed', value: 60, color: '#43a047' }, // success/primary
  { name: 'Pending', value: 25, color: '#FFC107' }, // warning
  { name: 'Approved', value: 15, color: '#17A2B8' }, // info
];

const AdminDashboard: React.FC = () => {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Top Header */}
      <header className="sticky top-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-8 py-3 bg-white/80 dark:bg-[#121b25]/80 backdrop-blur-sm z-10 transition-colors">
        <h2 className="text-slate-900 dark:text-slate-200 text-lg font-bold">Dashboard Overview</h2>
        <div className="flex items-center gap-4">
          <label className="relative hidden sm:flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-slate-400">search</span>
            <input className="form-input w-full min-w-40 max-w-64 rounded-lg bg-slate-100 dark:bg-[#0b1015] text-slate-900 dark:text-slate-200 pl-10 border-transparent focus:border-primary focus:ring-primary text-sm h-10 placeholder:text-slate-400" placeholder="Search..." type="search" />
          </label>
          <button className="flex items-center justify-center rounded-full size-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <div className="bg-primary/20 rounded-full size-10 flex items-center justify-center text-primary font-bold">AD</div>
        </div>
      </header>

      <div className="flex-1 p-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Staff" value="12,450" change="+1.5% this month" isPositive={true} />
          <StatCard title="APCs Generated" value="8" change="+12% this year" isPositive={true} />
          <StatCard title="Postings Completed" value="1,120" change="+5.2% this year" isPositive={true} />
          <StatCard title="Locations Managed" value="215" change="-0.5% last month" isPositive={false} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-white dark:bg-[#121b25] border border-gray-200 dark:border-gray-800 rounded-lg p-6 transition-colors">
            <h3 className="text-slate-800 dark:text-slate-200 text-base font-semibold mb-6">Posting Distribution by Location</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataBar}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {dataBar.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#43a047" fillOpacity={0.2 + (index % 5) * 0.15} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-[#121b25] border border-gray-200 dark:border-gray-800 rounded-lg p-6 flex flex-col items-center justify-center transition-colors">
            <h3 className="text-slate-800 dark:text-slate-200 text-base font-semibold mb-4 w-full text-left">Posting Status Overview</h3>
            <div className="h-[250px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {dataPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-slate-900 dark:text-slate-200">1,450</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">Total Postings</span>
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <LegendItem color="bg-success" label="Completed (60%)" />
              <LegendItem color="bg-warning" label="Pending (25%)" />
              <LegendItem color="bg-info" label="Approved (15%)" />
            </div>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="bg-white dark:bg-[#121b25] border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden transition-colors">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-slate-900 dark:text-slate-200 text-lg font-bold">Recent Posting Activities</h2>
            <div className="flex gap-2">
              <button className="btn-secondary">Create Posting</button>
              <button className="btn-primary">Generate New APC</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
              <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-gray-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3">Staff Name</th>
                  <th className="px-6 py-3">New Location</th>
                  <th className="px-6 py-3">Posting Date</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                <TableRow name="Adebayo Adewale" location="Lagos State Office" date="2023-10-26" status="Completed" statusColor="success" />
                <TableRow name="Ngozi Okoro" location="Kano State Office" date="2023-10-25" status="Pending" statusColor="warning" />
                <TableRow name="Musa Ibrahim" location="Headquarters, Abuja" date="2023-10-24" status="Approved" statusColor="info" />
                <TableRow name="Chidinma Eze" location="Enugu State Office" date="2023-10-23" status="Completed" statusColor="success" />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, change, isPositive }: any) => (
  <div className="flex flex-col gap-2 rounded-lg p-6 bg-white dark:bg-[#121b25] border border-gray-200 dark:border-gray-800 transition-colors">
    <p className="text-slate-600 dark:text-slate-400 text-base font-medium">{title}</p>
    <p className="text-slate-900 dark:text-slate-200 text-3xl font-bold">{value}</p>
    <p className={`${isPositive ? 'text-green-600' : 'text-red-600'} text-sm font-medium flex items-center gap-1`}>
      <span className="material-symbols-outlined text-base">{isPositive ? 'arrow_upward' : 'arrow_downward'}</span>
      {change}
    </p>
  </div>
);

const LegendItem = ({ color, label }: any) => (
  <div className="flex items-center gap-2 text-sm">
    <span className={`size-3 rounded-full ${color}`}></span>
    <span className="text-slate-600 dark:text-slate-400">{label}</span>
  </div>
);

const TableRow = ({ name, location, date, status, statusColor }: any) => {
  const colors: any = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-sky-100 text-sky-700'
  };
  return (
    <tr className="bg-white dark:bg-[#121b25] border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">{name}</td>
      <td className="px-6 py-4">{location}</td>
      <td className="px-6 py-4">{date}</td>
      <td className="px-6 py-4">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[statusColor]}`}>{status}</span>
      </td>
    </tr>
  );
};

export default AdminDashboard;