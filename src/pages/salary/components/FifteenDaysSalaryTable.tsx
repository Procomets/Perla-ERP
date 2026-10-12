import React, { useState, useEffect, useImperativeHandle } from 'react';
import { Save } from 'lucide-react';
import type { EmployeeMaster } from '../../../types/employee';
import type { AttendanceRecord } from '../../../types/attendance';
import type { SalaryRecord, Period } from '../types/salarySheet';
import { exportFifteenDaysSalaryToExcel } from '../utils/salarySheetExport';
import { exportFifteenDaysSalaryToPdf } from '../utils/salarySheetPdfExport';
import {
  getDaysInMonth,
  isSunday,
  formatDateDDMMYY,
  formatDateDDMMYYYY,
  formatDateYYYYMMDD
} from '../utils/salaryDateUtils';

export interface SalaryTableRef {
  exportExcel: () => void;
  exportPdf: () => void;
}

interface FifteenDaysSalaryTableProps {
  employees: EmployeeMaster[];
  attendanceRecords: AttendanceRecord[];
  salaryRecords: SalaryRecord[];
  currentYear: number;
  currentMonth: number; // 0-indexed
  monthYearStr: string;
  onSaveRecord: (record: Omit<SalaryRecord, 'id' | 'updatedAt'>) => Promise<void>;
  onSaveAllRecords: (records: Omit<SalaryRecord, 'id' | 'updatedAt'>[]) => Promise<void>;
}

export const FifteenDaysSalaryTable = React.forwardRef<SalaryTableRef, FifteenDaysSalaryTableProps>(({
  employees,
  attendanceRecords,
  salaryRecords,
  currentYear,
  currentMonth,
  monthYearStr,
  onSaveRecord,
  onSaveAllRecords
}, ref) => {
  const [period, setPeriod] = useState<Period>('first15');
  const [editableRows, setEditableRows] = useState<Record<string, { previousHolding: number; holdingAmount: number }>>({});
  const [commissionRate, setCommissionRate] = useState<number>(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState<boolean>(false);

  useEffect(() => {
    const stateMap: Record<string, { previousHolding: number; holdingAmount: number }> = {};
    let initialCommissionRate = 0;

    employees.forEach((emp) => {
      const record = salaryRecords.find(
        (r) => r.employeeId === emp.employeeId && r.period === period
      );

      if (record && record.commissionRate !== undefined && record.commissionRate !== null && initialCommissionRate === 0) {
        const parsedRate = parseFloat(String(record.commissionRate));
        if (!isNaN(parsedRate) && parsedRate > 0) {
          initialCommissionRate = parsedRate;
        }
      }

      stateMap[emp.employeeId] = {
        previousHolding: record?.previousHolding || 0,
        holdingAmount: record?.holdingAmount || 0
      };
    });

    setEditableRows(stateMap);
    setCommissionRate(initialCommissionRate);
  }, [employees, salaryRecords, period]);

  useImperativeHandle(ref, () => ({
    exportExcel: () => {
      exportFifteenDaysSalaryToExcel(employees, attendanceRecords, currentYear, currentMonth, period, editableRows, commissionRate);
    },
    exportPdf: () => {
      exportFifteenDaysSalaryToPdf(employees, attendanceRecords, currentYear, currentMonth, period, editableRows, commissionRate);
    }
  }), [employees, attendanceRecords, currentYear, currentMonth, period, editableRows, commissionRate]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const startDay = period === 'first15' ? 1 : 16;
  const endDay = period === 'first15' ? 15 : daysInMonth;

  const dates: number[] = [];
  for (let d = startDay; d <= endDay; d++) {
    dates.push(d);
  }

  const startDateStr = formatDateDDMMYYYY(currentYear, currentMonth, startDay);
  const endDateStr = formatDateDDMMYYYY(currentYear, currentMonth, endDay);

  const handleInputChange = (employeeId: string, field: 'previousHolding' | 'holdingAmount', value: string) => {
    setEditableRows((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: parseFloat(value) || 0
      }
    }));
  };

  const handleSave = async (employeeId: string) => {
    const data = editableRows[employeeId] || { previousHolding: 0, holdingAmount: 0 };
    let presentCount = 0;

    for (let i = startDay; i <= endDay; i++) {
      const dateStr = formatDateYYYYMMDD(currentYear, currentMonth, i);
      const attRecord = attendanceRecords.find((r) => r.employeeId === employeeId && r.date === dateStr);
      if (attRecord?.status === 'Present') {
        presentCount++;
      } else if (attRecord?.status === 'P/N') {
        presentCount += 2;
      }
    }

    setSavingId(employeeId);
    try {
      await onSaveRecord({
        employeeId,
        monthYear: monthYearStr,
        period,
        asOnDateSalary: 0,
        hike: 0,
        pf: 0,
        esi: 0,
        salaryAdvance: 0,
        lop: 0,
        remark: '',
        previousHolding: data.previousHolding || 0,
        holdingAmount: data.holdingAmount || 0,
        commissionRate,
        commissionAmount: presentCount * commissionRate,
        updatedBy: ''
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    try {
      const recordsToSave = employees.map((emp) => {
        const data = editableRows[emp.employeeId] || { previousHolding: 0, holdingAmount: 0 };
        let presentCount = 0;

        for (let i = startDay; i <= endDay; i++) {
          const dateStr = formatDateYYYYMMDD(currentYear, currentMonth, i);
          const attRecord = attendanceRecords.find((r) => r.employeeId === emp.employeeId && r.date === dateStr);
          if (attRecord?.status === 'Present') {
            presentCount++;
          } else if (attRecord?.status === 'P/N') {
            presentCount += 2;
          }
        }

        return {
          employeeId: emp.employeeId,
          monthYear: monthYearStr,
          period,
          asOnDateSalary: 0,
          hike: 0,
          pf: 0,
          esi: 0,
          salaryAdvance: 0,
          lop: 0,
          remark: '',
          previousHolding: data.previousHolding || 0,
          holdingAmount: data.holdingAmount || 0,
          commissionRate,
          commissionAmount: presentCount * commissionRate,
          updatedBy: ''
        };
      });

      await onSaveAllRecords(recordsToSave);
    } finally {
      setSavingAll(false);
    }
  };

  let totalNetAmount = 0;
  let totalPayableAmount = 0;
  let totalOverallPresent = 0;
  const dailyPresentCount = new Array(dates.length).fill(0);

  return (
    <div className="space-y-3">
      {/* Top Filter and Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
        {/* Period Selector Tabs */}
        <div className="inline-flex rounded-lg bg-slate-200/70 p-1">
          <button
            type="button"
            onClick={() => setPeriod('first15')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
              period === 'first15'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            First 15 Days (1-15)
          </button>
          <button
            type="button"
            onClick={() => setPeriod('next15')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
              period === 'next15'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Next 15 Days (16-End)
          </button>
        </div>

        {/* Commission Rate & Save All */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-700">Commission Rate (₹/day):</span>
            <input
              type="number"
              value={commissionRate === 0 ? '' : commissionRate}
              placeholder="0"
              onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
              className="w-20 px-2 py-1 text-xs border border-slate-300 rounded-lg text-right font-mono focus:outline-none focus:border-blue-600 bg-white"
            />
          </div>

          <button
            type="button"
            disabled={savingAll || employees.length === 0}
            onClick={handleSaveAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingAll ? 'Saving All...' : 'Save All'}</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs max-h-[75vh]">
        <table className="w-full text-xs text-left border-collapse select-none">
          <thead className="sticky top-0 z-20">
            {/* Header Banner */}
            <tr>
              <th
                colSpan={dates.length + 7}
                className="py-2.5 px-4 text-center font-bold text-sm text-slate-800 tracking-wider bg-white border-b border-slate-200"
              >
                LABOUR WAGES {startDateStr} To {endDateStr}
              </th>
            </tr>
            {/* Column Headers */}
            <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold tracking-tight border-b border-slate-200">
              <th className="py-2.5 px-2 text-center border-r border-slate-200 min-w-[45px] bg-slate-50">S.NO.</th>
              <th className="py-2.5 px-3 text-left border-r border-slate-200 min-w-[170px] bg-slate-50">NAME</th>
              {dates.map((day) => (
                <th
                  key={day}
                  className="py-2.5 px-1 text-center border-r border-slate-200 min-w-[50px] bg-slate-50"
                >
                  {formatDateDDMMYY(currentYear, currentMonth, day)}
                </th>
              ))}
              <th className="py-2.5 px-2 text-right border-r border-slate-200 min-w-[70px] bg-slate-50">WAGES<br />PER</th>
              <th className="py-2.5 px-1 text-center border-r border-slate-200 min-w-[65px] bg-slate-50">WORKING<br />DAYS</th>
              <th className="py-2.5 px-2 text-right border-r border-slate-200 min-w-[85px] bg-emerald-50/50 text-emerald-900">NET<br />AMOUNT</th>
              <th className="py-2.5 px-2 text-right border-r border-slate-200 min-w-[75px] bg-slate-50">HOLDING<br />AMOUNT</th>
              <th className="py-2.5 px-2 text-right border-r border-slate-200 min-w-[90px] bg-blue-50/60 text-blue-900">PAYABLE<br />AMOUNT</th>
              <th className="py-2.5 px-2 text-center min-w-[60px] bg-slate-50">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={dates.length + 7} className="py-12 text-center text-slate-400 text-sm">
                  No active labour employees found.
                </td>
              </tr>
            ) : (
              employees.map((emp, index) => {
                const rowState = editableRows[emp.employeeId] || { previousHolding: 0, holdingAmount: 0 };
                const wagesPer = parseFloat(String(emp.dailyWages || 0)) || 0;
                let presentCount = 0;

                const dateCells = dates.map((day, dIndex) => {
                  const dateStr = formatDateYYYYMMDD(currentYear, currentMonth, day);
                  const isSun = isSunday(currentYear, currentMonth, day);
                  const attRecord = attendanceRecords.find((r) => r.employeeId === emp.employeeId && r.date === dateStr);

                  let cellValue = '';
                  let cellStyle: React.CSSProperties = {};

                  if (attRecord?.status === 'Present') {
                    cellValue = 'P';
                    presentCount++;
                    dailyPresentCount[dIndex]++;
                    cellStyle = { color: '#166534', fontWeight: 'bold' };
                  } else if (attRecord?.status === 'P/N') {
                    cellValue = 'P/N';
                    presentCount += 2;
                    dailyPresentCount[dIndex] += 2;
                    cellStyle = { backgroundColor: '#e3f2fd', color: '#1565c0', fontWeight: 'bold' };
                  } else if (isSun) {
                    cellValue = 'Sunday';
                    cellStyle = { backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: 'bold', fontSize: '10px' };
                  } else if (attRecord?.status === 'Absent') {
                    cellValue = 'A';
                    cellStyle = { color: '#dc2626', fontWeight: 'bold' };
                  }

                  return (
                    <td
                      key={day}
                      style={cellStyle}
                      className="py-1 px-1 text-center font-mono border-r border-slate-200"
                    >
                      {cellValue}
                    </td>
                  );
                });

                const netAmount = wagesPer * presentCount;
                const payableAmount = netAmount + (rowState.previousHolding || 0) - (rowState.holdingAmount || 0);

                totalNetAmount += netAmount;
                totalPayableAmount += payableAmount;
                totalOverallPresent += presentCount;

                return (
                  <tr key={emp.employeeId} className="hover:bg-slate-50/60 transition-colors">
                    {/* S.NO. */}
                    <td className="py-1.5 px-2 text-center font-mono text-slate-500 border-r border-slate-200">
                      {index + 1}
                    </td>
                    {/* NAME */}
                    <td className="py-1.5 px-3 font-semibold text-slate-900 border-r border-slate-200">
                      {emp.fullName}
                    </td>
                    {/* Day Cells */}
                    {dateCells}
                    {/* WAGES PER */}
                    <td className="py-1.5 px-2 text-right font-mono text-slate-800 border-r border-slate-200">
                      {wagesPer.toFixed(2)}
                    </td>
                    {/* WORKING DAYS */}
                    <td className="py-1.5 px-1 text-center font-bold text-slate-900 border-r border-slate-200">
                      {presentCount}
                    </td>
                    {/* NET AMOUNT */}
                    <td className="py-1.5 px-2 text-right font-bold text-emerald-800 bg-emerald-50/30 border-r border-slate-200 font-mono">
                      {netAmount.toFixed(2)}
                    </td>
                    {/* HOLDING AMOUNT */}
                    <td className="py-1.5 px-1 text-right border-r border-slate-200">
                      <input
                        type="number"
                        value={rowState.holdingAmount === 0 || rowState.holdingAmount === undefined ? '' : rowState.holdingAmount}
                        placeholder="0"
                        onChange={(e) => handleInputChange(emp.employeeId, 'holdingAmount', e.target.value)}
                        className="w-16 px-1.5 py-0.5 text-right border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-600 bg-white"
                      />
                    </td>
                    {/* PAYABLE AMOUNT */}
                    <td className="py-1.5 px-2 text-right font-bold text-blue-900 bg-blue-50/40 border-r border-slate-200 font-mono">
                      {payableAmount.toFixed(2)}
                    </td>
                    {/* ACTION */}
                    <td className="py-1.5 px-2 text-center">
                      <button
                        type="button"
                        disabled={savingId === emp.employeeId}
                        onClick={() => handleSave(emp.employeeId)}
                        title="Save Labour Wage Record"
                        className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}

            {/* Footer Row 1: NO.OF.P */}
            {employees.length > 0 && (
              <>
                <tr className="bg-slate-50 text-slate-800 font-bold text-xs sticky bottom-0 border-t-2 border-slate-300 shadow-xs">
                  <td
                    colSpan={2}
                    className="py-2.5 px-3 text-center text-slate-700 border-r border-slate-200"
                  >
                    NO.OF.P
                  </td>
                  {dailyPresentCount.map((count, i) => (
                    <td
                      key={i}
                      className="py-2.5 px-1 text-center text-slate-700 border-r border-slate-200 font-mono"
                    >
                      {count > 0 ? count : ''}
                    </td>
                  ))}
                  <td className="py-2.5 px-2 border-r border-slate-200"></td>
                  <td
                    className="py-2.5 px-1 text-center text-slate-900 border-r border-slate-200 font-mono text-sm"
                  >
                    {totalOverallPresent}
                  </td>
                  <td
                    className="py-2.5 px-2 text-right font-bold text-emerald-800 bg-emerald-50/40 border-r border-slate-200 font-mono text-sm"
                  >
                    {totalNetAmount.toFixed(2)}
                  </td>
                  <td
                    className="py-2.5 px-2 text-center text-slate-700 border-r border-slate-200"
                  >
                    TOTAL
                  </td>
                  <td
                    className="py-2.5 px-2 text-right text-blue-900 bg-blue-50/40 font-mono text-sm border-r border-slate-200"
                  >
                    {totalPayableAmount.toFixed(2)}
                  </td>
                  <td className="bg-slate-50"></td>
                </tr>

                {/* Footer Row 2: Commission */}
                <tr className="bg-slate-50 font-bold text-xs border-t border-slate-200">
                  <td colSpan={dates.length + 5} className="py-2 px-4 text-right text-slate-700">
                    Commission (@ ₹{commissionRate}/day)
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-900 border-l border-slate-200">
                    {(totalOverallPresent * commissionRate).toFixed(2)}
                  </td>
                  <td></td>
                </tr>

                {/* Footer Row 3: Grand Total Payable */}
                <tr className="font-bold text-sm border-t-2 border-slate-300">
                  <td colSpan={dates.length + 5} className="py-2.5 px-4 text-right text-slate-900 font-black">
                    TOTAL PAYABLE
                  </td>
                  <td
                    style={{ backgroundColor: '#f4b084' }}
                    className="py-2.5 px-2 text-right font-black text-slate-900 border-l border-slate-300 font-mono text-base"
                  >
                    {(totalPayableAmount + totalOverallPresent * commissionRate).toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
