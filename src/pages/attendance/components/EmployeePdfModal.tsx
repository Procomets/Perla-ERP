import React from 'react';
import { X, Download, Printer } from 'lucide-react';
import { EmployeeMaster } from '../../../types/employee';
import { MonthlyStatsItem, exportEmployeeReportToPdf } from '../utils/employeePdfExport';

interface EmployeePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeMaster | undefined;
  selectedYear: number;
  monthlyStats: MonthlyStatsItem[];
  totals: {
    totalWorking: number;
    totalPresent: number;
    totalAbsent: number;
    percent: number;
  };
}

export const EmployeePdfModal: React.FC<EmployeePdfModalProps> = ({
  isOpen,
  onClose,
  employee,
  selectedYear,
  monthlyStats,
  totals
}) => {
  if (!isOpen || !employee) return null;

  const isLabour = employee.employeeType === 'Labour';

  const handleDownloadPdf = async () => {
    await exportEmployeeReportToPdf({
      employee,
      selectedYear,
      monthlyStats,
      totals
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity print:hidden" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4 print:p-0">
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 print:my-0 print:border-none print:shadow-none print:rounded-none">
          
          {/* Header Action Bar (Hidden during print) */}
          <div className="flex items-center justify-between px-8 sm:px-10 py-4 bg-white border-b border-slate-200 print:hidden">
            <div>
              <h3 className="text-base font-bold text-slate-900">Employee Attendance & Profile Report Preview</h3>
              <p className="text-xs text-slate-500 mt-0.5">{employee.fullName} • Year {selectedYear}</p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>

              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Print Document</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Document Body */}
          <div className="p-8 sm:p-10 space-y-6 printable-area bg-white text-slate-900 text-xs">
            
            {/* Document Header */}
            <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">PERLA TEXTILES PROCESSOR</h1>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Textile Processing & Fabric Finishing Division • Workforce Muster Roll</p>
              </div>

              <div className="text-right sm:border-l sm:border-slate-200 sm:pl-6">
                <span className="inline-block px-3 py-1 rounded-md bg-slate-100 font-bold text-slate-800 text-xs uppercase tracking-wide">
                  Annual Report {selectedYear}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">
                  Generated: {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Section 1: Employee Master Details */}
            <div className="space-y-3">
              <div className="text-slate-900 font-bold text-xs uppercase tracking-wider pb-1 border-b border-slate-200">
                Employee Master Profile
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Full Name</span>
                  <span className="font-bold text-slate-900 text-sm block mt-0.5">{employee.fullName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Employee ID</span>
                  <span className="font-mono font-semibold text-slate-800 block mt-0.5">{employee.employeeId}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Category / Type</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">{employee.employeeType}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Employment Status</span>
                  <span className="font-semibold text-emerald-700 block mt-0.5">{employee.employmentStatus || 'Active'}</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                  <span className="text-slate-800 block mt-0.5">{employee.department || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Designation</span>
                  <span className="text-slate-800 block mt-0.5">{employee.designation || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Date of Joining</span>
                  <span className="text-slate-800 block mt-0.5">{employee.dateOfJoining || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Shift Schedule</span>
                  <span className="text-slate-800 block mt-0.5">{employee.shift || '-'}</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Mobile Number</span>
                  <span className="text-slate-800 font-mono block mt-0.5">{employee.mobileNumber || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Aadhar Number</span>
                  <span className="text-slate-800 font-mono block mt-0.5">{employee.aadharNumber || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Blood Group</span>
                  <span className="text-slate-800 font-semibold block mt-0.5">{employee.bloodGroup || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Wages / Salary</span>
                  <span className="font-bold text-slate-900 block mt-0.5">
                    {employee.dailyWages && employee.dailyWages.trim() && employee.dailyWages !== '0' && employee.dailyWages !== '0000'
                      ? `INR ${Number(employee.dailyWages.replace(/,/g, '')).toLocaleString('en-IN')} / Day`
                      : employee.monthlyIncome && employee.monthlyIncome.trim() && employee.monthlyIncome !== '0'
                      ? `INR ${Number(employee.monthlyIncome.replace(/,/g, '')).toLocaleString('en-IN')} / Month`
                      : '-'}
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Residential Address</span>
                  <span className="text-slate-700 block mt-0.5">
                    {employee.address ? `${employee.address}${employee.state ? `, ${employee.state}` : ''}${employee.pincode ? ` - ${employee.pincode}` : ''}` : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Annual Overall Attendance Summary */}
            <div className="space-y-3">
              <div className="text-slate-900 font-bold text-xs uppercase tracking-wider pb-1 border-b border-slate-200">
                Overall Attendance Performance ({selectedYear})
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Working Days</span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block">{totals.totalWorking}</span>
                </div>

                <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Days Present</span>
                  <span className="text-2xl font-black text-emerald-700 mt-1 block">{totals.totalPresent}</span>
                </div>

                <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-rose-800 block">Days Absent</span>
                  <span className="text-2xl font-black text-rose-700 mt-1 block">{totals.totalAbsent}</span>
                </div>

                <div className="p-3.5 bg-sky-50/70 rounded-xl border border-sky-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-sky-800 block">Attendance Rate</span>
                  <span className="text-2xl font-black text-sky-700 mt-1 block">{totals.percent}%</span>
                </div>
              </div>
            </div>

            {/* Section 3: Month-by-Month Muster Roll */}
            <div className="space-y-3">
              <div className="text-slate-900 font-bold text-xs uppercase tracking-wider pb-1 border-b border-slate-200">
                Month-by-Month Attendance Breakdown
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                      <th className="py-2.5 px-3">Month</th>
                      <th className="py-2.5 px-3 text-center">Calendar Days</th>
                      <th className="py-2.5 px-3 text-center">Working Days</th>
                      <th className="py-2.5 px-3 text-center text-emerald-700">Present (P)</th>
                      {isLabour ? (
                        <th className="py-2.5 px-3 text-center text-sky-700">Double Duty (P/N)</th>
                      ) : (
                        <th className="py-2.5 px-3 text-center text-purple-700">Night Shift (N)</th>
                      )}
                      <th className="py-2.5 px-3 text-center text-rose-700">Absent (AB)</th>
                      <th className="py-2.5 px-3 text-center text-slate-800">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyStats.map((stat) => {
                      const effectivePresent = stat.presentDays + (isLabour ? stat.pnDays * 2 : 0);
                      const rate = stat.workingDays > 0 ? Math.round((effectivePresent / stat.workingDays) * 100) : 0;

                      return (
                        <tr key={stat.monthName} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-semibold text-slate-800">{stat.monthName}</td>
                          <td className="py-2 px-3 text-center text-slate-500">{stat.totalDays}</td>
                          <td className="py-2 px-3 text-center text-slate-700 font-medium">{stat.workingDays}</td>
                          <td className="py-2 px-3 text-center font-bold text-emerald-700">{stat.presentDays}</td>
                          <td className="py-2 px-3 text-center font-bold text-sky-700">{stat.pnDays}</td>
                          <td className="py-2 px-3 text-center font-bold text-rose-700">{stat.absentDays}</td>
                          <td className="py-2 px-3 text-center font-bold text-slate-800">{rate}%</td>
                        </tr>
                      );
                    })}
                    {/* Full Year Total Row */}
                    <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td className="py-2.5 px-3 uppercase tracking-wider">Full Year Total</td>
                      <td className="py-2.5 px-3 text-center text-slate-500">-</td>
                      <td className="py-2.5 px-3 text-center">{totals.totalWorking}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-700">{totals.totalPresent}</td>
                      <td className="py-2.5 px-3 text-center text-sky-700">-</td>
                      <td className="py-2.5 px-3 text-center text-rose-700">{totals.totalAbsent}</td>
                      <td className="py-2.5 px-3 text-center">{totals.percent}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signatures Section */}
            <div className="pt-8 grid grid-cols-3 gap-8 text-center text-xs text-slate-500">
              <div className="border-t border-slate-300 pt-2">
                <span className="font-semibold block text-slate-700">Prepared By</span>
                <span className="text-[10px] text-slate-400">Attendance Officer</span>
              </div>
              <div className="border-t border-slate-300 pt-2">
                <span className="font-semibold block text-slate-700">Employee Signature</span>
                <span className="text-[10px] text-slate-400">{employee.fullName}</span>
              </div>
              <div className="border-t border-slate-300 pt-2">
                <span className="font-semibold block text-slate-700">Authorized Signatory</span>
                <span className="text-[10px] text-slate-400">HR / General Manager</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
