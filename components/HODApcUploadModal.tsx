
import React, { useState, useRef } from 'react';
import { uploadHODApc } from '../services/hodApc';

interface HODApcUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const HODApcUploadModal: React.FC<HODApcUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [dragging, setDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Template Headers based on HODApcCreate and typical matching columns
    // Case-insensitive matching on backend, but good to provide standard ones.
    const TEMPLATE_HEADERS = [
        "file_no",
        "name",
        "conraiss",
        "station",
        "qualification",
        "sex",
        "tt",
        "mar_accr",
        "ncee",
        "gifted",
        "becep",
        "bece_mrkp",
        "ssce_int",
        "swapping",
        "ssce_int_mrk",
        "oct_accr",
        "ssce_ext",
        "ssce_ext_mrk",
        "pur_samp",
        "int_audit",
        "stock_tk",
        "count",
        "remark",
        "year",
        "active"
    ];

    if (!isOpen) return null;

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(true);
    };

    const handleDragLeave = () => {
        setDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
            setFile(droppedFile);
            setError(null);
            setSuccessMsg(null);
        } else {
            setError('Please upload a valid CSV file');
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            setSuccessMsg(null);
        }
    };

    const handleDownloadTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8," + TEMPLATE_HEADERS.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "hod_apc_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const result = await uploadHODApc(file);
            setSuccessMsg(`Success! ${result.message || 'Records uploaded.'}`);
            setTimeout(() => {
                onSuccess();
                onClose();
                setFile(null);
                setSuccessMsg(null);
            }, 1500);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Upload failed. Please check the file format.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4 transition-colors">
            <div className="bg-white dark:bg-[#121b25] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border dark:border-gray-800">
                <div className="p-6 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-[#121b25]">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Upload HOD APC Data</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">close</span>
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Upload a CSV file to update HOD records.</p>
                        <button
                            onClick={handleDownloadTemplate}
                            className="text-xs font-bold text-primary hover:text-primary-dark underline"
                        >
                            Download Template
                        </button>
                    </div>

                    {!file ? (
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${dragging ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-slate-300 dark:border-gray-700 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept=".csv"
                                className="hidden"
                            />
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-3xl">upload_file</span>
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-slate-700 dark:text-slate-200">Click to upload or drag and drop</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">CSV files only</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#0b1015] rounded-lg border border-slate-200 dark:border-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                        <span className="material-symbols-outlined">description</span>
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{file.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>
                                {!uploading && !successMsg && (
                                    <button
                                        onClick={() => { setFile(null); setError(null); }}
                                        className="text-slate-400 hover:text-rose-500 transition-colors"
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                )}
                            </div>

                            {uploading && (
                                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm font-medium justify-center">
                                    <span className="material-symbols-outlined animate-spin">sync</span>
                                    Uploading data...
                                </div>
                            )}

                            {error && (
                                <div className="p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800 rounded-lg text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">error</span>
                                    {error}
                                </div>
                            )}

                            {successMsg && (
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 rounded-lg text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">check_circle</span>
                                    {successMsg}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-[#0b1015] border-t border-slate-100 dark:border-gray-800 flex justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        disabled={uploading}
                        className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#121b25] hover:shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-gray-700 rounded-lg transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading || !!successMsg}
                        className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-lg shadow-sm hover:shadow hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                    >
                        {uploading ? 'Uploading...' : 'Upload CSV'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HODApcUploadModal;
