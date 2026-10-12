import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar,
  Download,
  Printer,
  Search,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info,
  DollarSign,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { EmployeeService } from '../../services/employeeService';
import { AttendanceService } from '../../services/attendanceService';
import {
  getSalaryRecordsForMonth,
  saveSalaryRecord,
  saveSalaryRecordsBatch
} from './services/salarySheetService';
import type { EmployeeMaster } from '../../types/employee';
import type { AttendanceRecord } from '../../types/attendance';
import type { SalaryRecord } from './types/salarySheet';
import { MonthlySalaryTable, SalaryTableRef } from './components/MonthlySalaryTable';
import { FifteenDaysSalaryTable } from './components/FifteenDaysSalaryTable';

export const SalarySheetPage: React.FC = () => {
  const { user } = useAuth();
  const currentUserEmail = user?.email || 'user@perlatextiles.com';

  const tableRef = useRef<SalaryTableRef>(null);

  const now = new Date();
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth()); // 0-indexed

  const [activeTab, setActiveTab] = useState<number>(0); // 0 = Monthly Salary, 1 = 15 Days Wages
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [employees, setEmployees] = useState<EmployeeMaster[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [noticeMessage, setNoticeMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);

  const monthYearStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const showNotice = (type: 'error' | 'success' | 'info', text: string) => {
    setNoticeMessage({ type, text });
    setTimeout(() => setNoticeMessage(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [emps, atts, sals] = await Promise.all([
        EmployeeService.getEmployees(),
        AttendanceService.getAttendanceForMonth(monthYearStr),
        getSalaryRecordsForMonth(monthYearStr)
      ]);

      const hasSalaryRecordIds = new Set(sals.map((s) => s.employeeId));
      const hasAttendanceIds = new Set(atts.map((a) => a.employeeId));

      const filteredEmps = emps.filter(
        (e) =>
          e.employmentStatus === 'Active' ||
          hasSalaryRecordIds.has(e.employeeId) ||
          hasAttendanceIds.has(e.employeeId)
      );

      setEmployees(filteredEmps);
      setAttendanceRecords(atts);
      setSalaryRecords(sals);
    } catch (error) {
      console.error('Failed to load salary sheet data:', error);
      showNotice('error', 'Failed to load employee, attendance or salary records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [monthYearStr]);

  const handleSaveRecord = async (record: Omit<SalaryRecord, 'id' | 'updatedAt'>) => {
    try {
      await saveSalaryRecord(record, currentUserEmail);
      setSalaryRecords((prev) => {
        const existingIdx = prev.findIndex(
          (r) =>
            r.employeeId === record.employeeId &&
            r.monthYear === record.monthYear &&
            (r.period || 'monthly') === (record.period || 'monthly')
        );
        const newRecord: SalaryRecord = { ...record, updatedAt: new Date() as any };
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = { ...copy[existingIdx], ...newRecord };
          return copy;
        }
        return [...prev, newRecord];
      });
      showNotice('success', 'Salary record saved successfully to Firestore!');
    } catch (error) {
      console.error('Failed to save salary record:', error);
      showNotice('error', 'Failed to save salary record.');
      throw error;
    }
  };

  const handleSaveAllRecords = async (records: Omit<SalaryRecord, 'id' | 'updatedAt'>[]) => {
    try {
      await saveSalaryRecordsBatch(records, currentUserEmail);
      setSalaryRecords((prev) => {
        const newArr = [...prev];
        records.forEach((record) => {
          const existingIdx = newArr.findIndex(
            (r) =>
              r.employeeId === record.employeeId &&
              r.monthYear === record.monthYear &&
              (r.period || 'monthly') === (record.period || 'monthly')
          );
          const newRecord: SalaryRecord = { ...record, updatedAt: new Date() as any };
          if (existingIdx >= 0) {
            newArr[existingIdx] = { ...newArr[existingIdx], ...newRecord };
          } else {
            newArr.push(newRecord);
          }
        });
        return newArr;
      });
      showNotice('success', `All ${records.length} wage records saved successfully!`);
    } catch (error) {
      console.error('Failed to save wage records in batch:', error);
      showNotice('error', 'Failed to save all wage records.');
      throw error;
    }
  };

  const handleExportExcel = () => {
    if (tableRef.current) {
      tableRef.current.exportExcel();
      showNotice('info', 'Downloading Excel salary spreadsheet...');
    }
  };

  const handleExportPdf = () => {
    if (tableRef.current) {
      tableRef.current.exportPdf();
      showNotice('info', 'Generating PDF salary sheet document...');
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Filtered employees by search
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(
      (emp) =>
        (emp.fullName || '').toLowerCase().includes(q) ||
        (emp.employeeId || '').toLowerCase().includes(q) ||
        (emp.department || '').toLowerCase().includes(q) ||
        (emp.designation || '').toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  const monthlyEmployees = useMemo(
    () => filteredEmployees.filter((e) => e.employeeType === 'Monthly Salary'),
    [filteredEmployees]
  );

  const labourEmployees = useMemo(
    () => filteredEmployees.filter((e) => e.employeeType === 'Labour'),
    [filteredEmployees]
  );

  return (
    <div className="space-y-5">
      {/* Toast Notice */}
      {noticeMessage && (
        <div
          className={`fixed top-5 right-5 z-60 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium animate-in slide-in-from-top-3 duration-150 ${
            noticeMessage.type === 'success'
              ? 'bg-slate-900 border-slate-800 text-white'
              : noticeMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          {noticeMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : noticeMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
          )}
          <span>{noticeMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Salary Sheet</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <DollarSign className="w-3 h-3" />
              <span>Payroll Master</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Monthly workforce payroll calculations, daily labour wages, PF/ESI deductions, and holding register
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Month/Year Filter & Search Strip */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {monthNames.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={fetchData}
            title="Refresh Salary and Attendance Data"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-800 transition"
          />
        </div>
      </div>

      {/* Main Tab Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Tab Headers */}
        <div className="flex items-center border-b border-slate-100 bg-slate-50/50 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab(0)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 0
                ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <span>Monthly Salary</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
              {monthlyEmployees.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(1)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 1
                ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <span>15 Days Wages (Labour)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
              {labourEmployees.length}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
              <span>Loading employee master and attendance records from Firestore...</span>
            </div>
          ) : activeTab === 0 ? (
            <MonthlySalaryTable
              ref={tableRef}
              employees={monthlyEmployees}
              attendanceRecords={attendanceRecords}
              salaryRecords={salaryRecords}
              currentYear={currentYear}
              currentMonth={currentMonth}
              monthYearStr={monthYearStr}
              onSaveRecord={handleSaveRecord}
            />
          ) : (
            <FifteenDaysSalaryTable
              ref={tableRef}
              employees={labourEmployees}
              attendanceRecords={attendanceRecords}
              salaryRecords={salaryRecords}
              currentYear={currentYear}
              currentMonth={currentMonth}
              monthYearStr={monthYearStr}
              onSaveRecord={handleSaveRecord}
              onSaveAllRecords={handleSaveAllRecords}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SalarySheetPage;
