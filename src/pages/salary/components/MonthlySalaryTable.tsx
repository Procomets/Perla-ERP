import React, { useState, useEffect, useImperativeHandle } from 'react';
import { Save } from 'lucide-react';
import type { EmployeeMaster } from '../../../types/employee';
import type { AttendanceRecord } from '../../../types/attendance';
import type { SalaryRecord } from '../types/salarySheet';
import { exportMonthlySalaryToExcel } from '../utils/salarySheetExport';
import { exportMonthlySalaryToPdf } from '../utils/salarySheetPdfExport';
import { getDaysInMonth, getSundaysCount, getMonthName } from '../utils/salaryDateUtils';

export interface SalaryTableRef {
  exportExcel: () => void;
  exportPdf: () => void;
}

interface MonthlySalaryTableProps {
  employees: EmployeeMaster[];
  attendanceRecords: AttendanceRecord[];
  salaryRecords: SalaryRecord[];
  currentYear: number;
  currentMonth: number; // 0-indexed
  monthYearStr: string; // YYYY-MM
  onSaveRecord: (record: Omit<SalaryRecord, 'id' | 'updatedAt'>) => Promise<void>;
}

export const MonthlySalaryTable = React.forwardRef<SalaryTableRef, MonthlySalaryTableProps>(({
  employees,
  attendanceRecords,
  salaryRecords,
  currentYear,
  currentMonth,
  monthYearStr,
  onSaveRecord
}, ref) => {
  // Local editable rows state
  const [editableRows, setEditableRows] = useState<Record<string, Partial<SalaryRecord>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const stateMap: Record<string, Partial<SalaryRecord>> = {};
    employees.forEach((emp) => {
      const record = salaryRecords.find(
        (r) => r.employeeId === emp.employeeId && (r.period === 'monthly' || !r.period)
      );
      stateMap[emp.employeeId] = {
        asOnDateSalary: record?.asOnDateSalary || 0,
        hike: record?.hike || 0,
        pf: record?.pf || 0,
        esi: record?.esi || 0,
        salaryAdvance: record?.salaryAdvance || 0,
        lop: record?.lop || 0,
        remark: record?.remark || ''
      };
    });
    setEditableRows(stateMap);
  }, [employees, salaryRecords]);

  useImperativeHandle(ref, () => ({
    exportExcel: () => {
      exportMonthlySalaryToExcel(employees, attendanceRecords, currentYear, currentMonth, editableRows);
    },
    exportPdf: () => {
      exportMonthlySalaryToPdf(employees, attendanceRecords, currentYear, currentMonth, editableRows);
    }
  }), [employees, attendanceRecords, currentYear, currentMonth, editableRows]);

  const handleInputChange = (employeeId: string, field: keyof SalaryRecord, value: string) => {
    setEditableRows((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: field === 'remark' ? value : (parseFloat(value) || 0)
      }
    }));
  };

  const handleSave = async (employeeId: string) => {
    const data = editableRows[employeeId] || {};
    setSavingId(employeeId);
    try {
      await onSaveRecord({
        employeeId,
        monthYear: monthYearStr,
        period: 'monthly',
        asOnDateSalary: data.asOnDateSalary || 0,
        hike: data.hike || 0,
        pf: data.pf || 0,
        esi: data.esi || 0,
        salaryAdvance: data.salaryAdvance || 0,
        lop: data.lop || 0,
        remark: data.remark || '',
        updatedBy: ''
      });
    } finally {
      setSavingId(null);
    }
  };

  // Calculations
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const sundaysCount = getSundaysCount(currentYear, currentMonth);
  const noOfDays = daysInMonth - sundaysCount;
  const monthName = getMonthName(currentMonth);

  let totalSalary = 0;
  let totalGross = 0;
  let totalBasic = 0;
  let totalHRA = 0;
  let totalSA = 0;
  let totalMA = 0;
  let totalCA = 0;
  let totalPF = 0;
  let totalESI = 0;
  let totalAdvance = 0;
  let totalLOP = 0;
  let totalNet = 0;

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs max-h-[75vh]">
      <table className="w-full text-xs text-left border-collapse select-none">
        <thead className="sticky top-0 z-20">
          {/* Main Title Row */}
          <tr>
            <th
              colSpan={26}
              className="py-2.5 px-4 text-center font-bold text-sm text-slate-800 tracking-wider bg-white border-b border-slate-200"
            >
              PERLA TEXTILES PROCESSOR
            </th>
          </tr>
          {/* Subtitle Row */}
          <tr>
            <th
              colSpan={26}
              className="py-1.5 px-4 text-center font-semibold text-xs text-slate-500 bg-slate-50 border-b border-slate-200"
            >
              Salary Sheet For The Month Of {monthName} {currentYear} • (Total Working Days: {noOfDays})
            </th>
          </tr>
          {/* Column Header Row */}
          <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold tracking-tight border-b border-slate-200">
            <th className="py-2 px-2 text-center border-r border-slate-200 min-w-[40px] bg-slate-50">S NO</th>
            <th className="py-2 px-3 text-left border-r border-slate-200 min-w-[170px] bg-slate-50">Name</th>
            <th className="py-2 px-2 text-left border-r border-slate-200 min-w-[120px] bg-slate-50">Designation</th>
            <th className="py-2 px-2 text-center border-r border-slate-200 min-w-[85px] bg-slate-50">DOJ</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[65px] bg-slate-50">Hike</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[75px] bg-emerald-50/50 text-emerald-900">Salary</th>
            <th className="py-2 px-1 text-center border-r border-slate-200 min-w-[50px] bg-slate-50">No Of<br />Days</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[65px] bg-slate-50">Per day<br />Pay</th>
            <th className="py-2 px-1 text-center border-r border-slate-200 min-w-[50px] bg-slate-50">No Of<br />Present</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[75px] bg-emerald-50/50 text-emerald-900">Gross<br />Salary</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[65px] bg-slate-50">Basic<br />50%</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[60px] bg-slate-50">HRA<br />20%</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[60px] bg-slate-50">SA<br />20%</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[55px] bg-slate-50">MA<br />4%</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[55px] bg-slate-50">CA<br />6%</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[60px] bg-slate-50">PF</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[60px] bg-slate-50">ESI</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[65px] bg-slate-50">Salary<br />Advance</th>
            <th className="py-2 px-1 text-center border-r border-slate-200 min-w-[50px] bg-slate-50">No Of<br />Leave</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[60px] bg-slate-50">LOP</th>
            <th className="py-2 px-2 text-right border-r border-slate-200 min-w-[80px] bg-blue-50/60 text-blue-900">Net<br />Salary</th>
            <th className="py-2 px-2 text-left border-r border-slate-200 min-w-[130px] bg-slate-50">A/c No</th>
            <th className="py-2 px-2 text-left border-r border-slate-200 min-w-[100px] bg-slate-50">IFSC Code</th>
            <th className="py-2 px-2 text-left border-r border-slate-200 min-w-[110px] bg-slate-50">Branch</th>
            <th className="py-2 px-2 text-left border-r border-slate-200 min-w-[130px] bg-slate-50">Remark</th>
            <th className="py-2 px-2 text-center min-w-[60px] bg-slate-50">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {employees.length === 0 ? (
            <tr>
              <td colSpan={26} className="py-12 text-center text-slate-400 text-sm">
                No active monthly salary employees found.
              </td>
            </tr>
          ) : (
            employees.map((emp, index) => {
              const rowState = editableRows[emp.employeeId] || {};
              const salary = (parseFloat(String(emp.monthlyIncome || 0)) || 0) + (rowState.hike || 0);
              const perDayPay = noOfDays > 0 ? salary / noOfDays : 0;

              // Attendance & Leave calculations (Matching exact formula)
              const empAtt = attendanceRecords.filter((r) => r.employeeId === emp.employeeId);
              const noOfPresent = empAtt.filter((r) => r.status === 'Present' || r.status === 'N').length;
              const noOfLeave = Math.max(0, noOfDays - noOfPresent);
              const paidLeave = Math.min(noOfLeave, 2);
              const paidDays = Math.min(noOfDays, noOfPresent + paidLeave);

              const grossSalary = paidDays === noOfDays ? salary : perDayPay * paidDays;
              const basic = grossSalary * 0.5;
              const hra = grossSalary * 0.2;
              const sa = grossSalary * 0.2;
              const ma = grossSalary * 0.04;
              const ca = grossSalary * 0.06;

              const pf = rowState.pf || 0;
              const esi = rowState.esi || 0;
              const advance = rowState.salaryAdvance || 0;
              const lop = rowState.lop || 0;

              const netSalary = grossSalary - pf - esi - advance - lop;

              // Accumulate totals
              totalSalary += salary;
              totalGross += grossSalary;
              totalBasic += basic;
              totalHRA += hra;
              totalSA += sa;
              totalMA += ma;
              totalCA += ca;
              totalPF += pf;
              totalESI += esi;
              totalAdvance += advance;
              totalLOP += lop;
              totalNet += netSalary;

              return (
                <tr key={emp.employeeId} className="hover:bg-slate-50/70 transition-colors">
                  {/* S NO */}
                  <td className="py-1.5 px-2 text-center font-mono text-slate-500 border-r border-slate-200">
                    {index + 1}
                  </td>
                  {/* Name */}
                  <td className="py-1.5 px-3 border-r border-slate-200">
                    <div className="font-semibold text-slate-900">{emp.fullName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{emp.employeeId}</div>
                  </td>
                  {/* Designation */}
                  <td className="py-1.5 px-2 text-slate-700 border-r border-slate-200">
                    {emp.designation || '-'}
                  </td>
                  {/* DOJ */}
                  <td className="py-1.5 px-2 text-center text-slate-600 font-mono text-[11px] border-r border-slate-200">
                    {emp.dateOfJoining || '-'}
                  </td>
                  {/* Hike */}
                  <td className="py-1.5 px-1 text-right border-r border-slate-200">
                    <input
                      type="number"
                      value={rowState.hike === 0 || rowState.hike === undefined ? '' : rowState.hike}
                      placeholder="0"
                      onChange={(e) => handleInputChange(emp.employeeId, 'hike', e.target.value)}
                      className="w-16 px-1.5 py-0.5 text-right border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-600"
                    />
                  </td>
                  {/* Salary */}
                  <td className="py-1.5 px-2 text-right font-bold text-emerald-800 bg-emerald-50/30 border-r border-slate-200">
                    {Math.round(salary).toLocaleString('en-IN')}
                  </td>
                  {/* No Of Days */}
                  <td className="py-1.5 px-1 text-center font-semibold text-slate-700 border-r border-slate-200">
                    {noOfDays}
                  </td>
                  {/* Per day Pay */}
                  <td className="py-1.5 px-2 text-right text-slate-700 font-mono border-r border-slate-200">
                    {Math.round(perDayPay).toLocaleString('en-IN')}
                  </td>
                  {/* No Of Present */}
                  <td className="py-1.5 px-1 text-center font-bold text-emerald-700 border-r border-slate-200">
                    {noOfPresent}
                  </td>
                  {/* Gross Salary */}
                  <td className="py-1.5 px-2 text-right font-bold text-emerald-800 bg-emerald-50/30 border-r border-slate-200">
                    {Math.round(grossSalary).toLocaleString('en-IN')}
                  </td>
                  {/* Basic */}
                  <td className="py-1.5 px-2 text-right text-slate-700 font-mono border-r border-slate-200">
                    {Math.round(basic).toLocaleString('en-IN')}
                  </td>
                  {/* HRA */}
                  <td className="py-1.5 px-2 text-right text-slate-700 font-mono border-r border-slate-200">
                    {Math.round(hra).toLocaleString('en-IN')}
                  </td>
                  {/* SA */}
                  <td className="py-1.5 px-2 text-right text-slate-700 font-mono border-r border-slate-200">
                    {Math.round(sa).toLocaleString('en-IN')}
                  </td>
                  {/* MA */}
                  <td className="py-1.5 px-2 text-right text-slate-700 font-mono border-r border-slate-200">
                    {Math.round(ma).toLocaleString('en-IN')}
                  </td>
                  {/* CA */}
                  <td className="py-1.5 px-2 text-right text-slate-700 font-mono border-r border-slate-200">
                    {Math.round(ca).toLocaleString('en-IN')}
                  </td>
                  {/* PF */}
                  <td className="py-1.5 px-1 text-right border-r border-slate-200">
                    <input
                      type="number"
                      value={rowState.pf === 0 || rowState.pf === undefined ? '' : rowState.pf}
                      placeholder="0"
                      onChange={(e) => handleInputChange(emp.employeeId, 'pf', e.target.value)}
                      className="w-16 px-1.5 py-0.5 text-right border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-600"
                    />
                  </td>
                  {/* ESI */}
                  <td className="py-1.5 px-1 text-right border-r border-slate-200">
                    <input
                      type="number"
                      value={rowState.esi === 0 || rowState.esi === undefined ? '' : rowState.esi}
                      placeholder="0"
                      onChange={(e) => handleInputChange(emp.employeeId, 'esi', e.target.value)}
                      className="w-16 px-1.5 py-0.5 text-right border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-600"
                    />
                  </td>
                  {/* Salary Advance */}
                  <td className="py-1.5 px-1 text-right border-r border-slate-200">
                    <input
                      type="number"
                      value={rowState.salaryAdvance === 0 || rowState.salaryAdvance === undefined ? '' : rowState.salaryAdvance}
                      placeholder="0"
                      onChange={(e) => handleInputChange(emp.employeeId, 'salaryAdvance', e.target.value)}
                      className="w-16 px-1.5 py-0.5 text-right border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-600"
                    />
                  </td>
                  {/* No Of Leave */}
                  <td className="py-1.5 px-1 text-center font-semibold text-rose-600 border-r border-slate-200">
                    {noOfLeave}
                  </td>
                  {/* LOP */}
                  <td className="py-1.5 px-1 text-right border-r border-slate-200">
                    <input
                      type="number"
                      value={rowState.lop === 0 || rowState.lop === undefined ? '' : rowState.lop}
                      placeholder="0"
                      onChange={(e) => handleInputChange(emp.employeeId, 'lop', e.target.value)}
                      className="w-16 px-1.5 py-0.5 text-right border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-600"
                    />
                  </td>
                  {/* Net Salary */}
                  <td className="py-1.5 px-2 text-right font-bold text-blue-900 bg-blue-50/40 border-r border-slate-200">
                    {Math.round(netSalary).toLocaleString('en-IN')}
                  </td>
                  {/* A/c No */}
                  <td className="py-1.5 px-2 text-slate-600 font-mono text-[11px] border-r border-slate-200">
                    {emp.accountNumber || '-'}
                  </td>
                  {/* IFSC */}
                  <td className="py-1.5 px-2 text-slate-600 font-mono text-[11px] border-r border-slate-200">
                    {emp.ifscCode || '-'}
                  </td>
                  {/* Branch */}
                  <td className="py-1.5 px-2 text-slate-600 border-r border-slate-200">
                    {emp.bankBranch || '-'}
                  </td>
                  {/* Remark */}
                  <td className="py-1.5 px-1 border-r border-slate-200">
                    <input
                      type="text"
                      value={rowState.remark || ''}
                      placeholder="Remarks..."
                      onChange={(e) => handleInputChange(emp.employeeId, 'remark', e.target.value)}
                      className="w-28 px-1.5 py-0.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-600"
                    />
                  </td>
                  {/* Action */}
                  <td className="py-1.5 px-2 text-center">
                    <button
                      type="button"
                      disabled={savingId === emp.employeeId}
                      onClick={() => handleSave(emp.employeeId)}
                      title="Save Salary Record to Database"
                      className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })
          )}

          {/* TOTALS FOOTER ROW */}
          {employees.length > 0 && (
            <tr className="bg-slate-50 text-slate-800 font-bold text-xs sticky bottom-0 border-t-2 border-slate-300 shadow-xs">
              <td colSpan={5} className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-700">
                TOTAL
              </td>
              <td className="py-2.5 px-2 text-right border-r border-slate-200 text-emerald-800 bg-emerald-50/40 font-mono">
                {Math.round(totalSalary).toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-1 text-center border-r border-slate-200"></td>
              <td className="py-2.5 px-2 text-right border-r border-slate-200"></td>
              <td className="py-2.5 px-1 text-center border-r border-slate-200"></td>
              <td className="py-2.5 px-2 text-right border-r border-slate-200 text-emerald-800 bg-emerald-50/40 font-mono">
                {Math.round(totalGross).toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2 text-right border-r border-slate-200 text-slate-700 font-mono">
                {Math.round(totalBasic).toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2 text-right border-r border-slate-200 text-slate-700 font-mono">
                {Math.round(totalHRA).toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2 text-right border-r border-slate-200 text-slate-700 font-mono">
                {Math.round(totalSA).toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2 text-right border-r border-slate-200 text-slate-700 font-mono">
                {Math.round(totalMA).toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2 text-right border-r border-slate-200 text-slate-700 font-mono">
                {Math.round(totalCA).toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2 text-right border-r border-slate-200 text-slate-700 font-mono">
                {Math.round(totalPF).toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2 text-right border-r border-slate-200 text-slate-700 font-mono">
                {Math.round(totalESI).toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2 text-right border-r border-slate-200 text-slate-700 font-mono">
                {Math.round(totalAdvance).toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-1 text-center border-r border-slate-200"></td>
              <td className="py-2.5 px-2 text-right border-r border-slate-200 text-slate-700 font-mono">
                {Math.round(totalLOP).toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2 text-right border-r border-slate-200 text-blue-900 bg-blue-50/50 font-mono">
                {Math.round(totalNet).toLocaleString('en-IN')}
              </td>
              <td colSpan={5} className="bg-slate-50"></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
});
