import { SchoolClass, Student, AppSettings } from '@/types';

export interface WaliAllocationItem {
  classId: string;
  className: string;
  department: string;
  homeroomTeacher: string;
  teacherPhone?: string;
  totalStudents: number;
  registeredCount: number;
  baliCount: number;
  yogyaCount: number;
  baliPercentage: number;
  rank: number;
  autoStatus: 'BALI_GEL_1' | 'BALI_GEL_2' | 'YOGYAKARTA';
  finalStatus: 'BALI_GEL_1' | 'BALI_GEL_2' | 'YOGYAKARTA' | 'NOT_PARTICIPATING';
  statusLabel: string;
  isOverride: boolean;
  manualWaliDestination?: string;
  manualWaliNotes?: string;
}

export interface WaliAllocationResult {
  totalBaliStudents: number;
  totalYogyaStudents: number;
  busCapacity: number;
  totalGelombang: number;
  totalBusesNeeded: number;
  totalQuotaWaliBali: number;
  quotaGel1: number;
  quotaGel2: number;
  items: WaliAllocationItem[];
  itemsByClassName: Record<string, WaliAllocationItem>;
}

export function calculateWaliAllocation(
  classes: SchoolClass[],
  students: Student[],
  settings?: AppSettings,
  sortBy: 'PERCENTAGE' | 'COUNT' | 'CLASS_NAME' | 'DEPARTMENT' = 'PERCENTAGE'
): WaliAllocationResult {
  const busCapacity = settings?.defaultBusCapacity || 50;
  const totalGelombang = settings?.totalGelombangBali || 2;

  // 1. Calculate student totals across all classes
  let totalBaliStudents = 0;
  let totalYogyaStudents = 0;

  // Prepare raw class stats
  const rawStats = classes.map((cls) => {
    const classStudents = students.filter((s) => s.className === cls.name);
    const registeredCount = classStudents.filter((s) => s.isRegistered).length;
    const totalStudents = cls.totalStudents || classStudents.length || 1;

    const baliCount = classStudents.filter(
      (s) => s.isRegistered && s.destination === 'BALI'
    ).length;
    const yogyaCount = classStudents.filter(
      (s) => s.isRegistered && s.destination === 'YOGYAKARTA'
    ).length;

    totalBaliStudents += baliCount;
    totalYogyaStudents += yogyaCount;

    const baliPercentage = parseFloat(((baliCount / totalStudents) * 100).toFixed(1));

    return {
      cls,
      totalStudents,
      registeredCount,
      baliCount,
      yogyaCount,
      baliPercentage,
    };
  });

  // 2. Bus & Quota Calculations
  // Total buses required for Bali = Math.ceil(totalBaliStudents / busCapacity)
  const totalBusesNeeded = Math.ceil(totalBaliStudents / busCapacity) || 0;
  const totalQuotaWaliBali = totalBusesNeeded;

  // Quota split across Gelombang
  let quotaGel1 = 0;
  let quotaGel2 = 0;

  if (totalGelombang <= 1) {
    quotaGel1 = totalQuotaWaliBali;
    quotaGel2 = 0;
  } else {
    // Divides totalQuotaWaliBali across totalGelombang.
    // E.g., if 20 buses total and 2 gelombang: gel1 = 10, gel2 = 10.
    // If 21 buses: gel1 = 11, gel2 = 10.
    quotaGel1 = Math.ceil(totalQuotaWaliBali / totalGelombang);
    quotaGel2 = Math.max(0, totalQuotaWaliBali - quotaGel1);
  }

  // 3. Sort classes dynamically by:
  //    PERCENTAGE: baliPercentage DESC, baliCount DESC, className ASC
  //    COUNT: baliCount DESC, baliPercentage DESC, className ASC
  //    CLASS_NAME: className ASC
  //    DEPARTMENT: department ASC, className ASC
  const sortedStats = [...rawStats].sort((a, b) => {
    if (sortBy === 'COUNT') {
      if (b.baliCount !== a.baliCount) return b.baliCount - a.baliCount;
      if (b.baliPercentage !== a.baliPercentage) return b.baliPercentage - a.baliPercentage;
      return a.cls.name.localeCompare(b.cls.name, undefined, { numeric: true, sensitivity: 'base' });
    }
    if (sortBy === 'CLASS_NAME') {
      return a.cls.name.localeCompare(b.cls.name, undefined, { numeric: true, sensitivity: 'base' });
    }
    if (sortBy === 'DEPARTMENT') {
      const deptCompare = (a.cls.department || '').localeCompare(b.cls.department || '', undefined, { sensitivity: 'base' });
      if (deptCompare !== 0) return deptCompare;
      return a.cls.name.localeCompare(b.cls.name, undefined, { numeric: true, sensitivity: 'base' });
    }
    
    // Default: PERCENTAGE
    if (b.baliPercentage !== a.baliPercentage) {
      return b.baliPercentage - a.baliPercentage;
    }
    if (b.baliCount !== a.baliCount) {
      return b.baliCount - a.baliCount;
    }
    return a.cls.name.localeCompare(b.cls.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  // 4. Assign Rank and Status
  const itemsByClassName: Record<string, WaliAllocationItem> = {};

  const items: WaliAllocationItem[] = sortedStats.map((stat, idx) => {
    const rank = idx + 1;

    let autoStatus: 'BALI_GEL_1' | 'BALI_GEL_2' | 'YOGYAKARTA' = 'YOGYAKARTA';
    if (rank <= quotaGel1) {
      autoStatus = 'BALI_GEL_1';
    } else if (rank <= quotaGel1 + quotaGel2) {
      autoStatus = 'BALI_GEL_2';
    } else {
      autoStatus = 'YOGYAKARTA';
    }

    const manualDest = stat.cls.manualWaliDestination;
    const isOverride = Boolean(manualDest && manualDest !== 'AUTO');

    let finalStatus: 'BALI_GEL_1' | 'BALI_GEL_2' | 'YOGYAKARTA' | 'NOT_PARTICIPATING' = autoStatus;
    if (isOverride) {
      if (manualDest === 'BALI_GEL_1') finalStatus = 'BALI_GEL_1';
      else if (manualDest === 'BALI_GEL_2') finalStatus = 'BALI_GEL_2';
      else if (manualDest === 'YOGYAKARTA') finalStatus = 'YOGYAKARTA';
      else if (manualDest === 'NOT_PARTICIPATING') finalStatus = 'NOT_PARTICIPATING';
    }

    let statusLabel = 'Ke Jogja / Standby';
    if (finalStatus === 'BALI_GEL_1') {
      statusLabel = 'Lolos Ke Bali (Gelombang 1)';
    } else if (finalStatus === 'BALI_GEL_2') {
      statusLabel = 'Lolos Ke Bali (Gelombang 2)';
    } else if (finalStatus === 'NOT_PARTICIPATING') {
      statusLabel = 'Tidak Ikut';
    }

    const item: WaliAllocationItem = {
      classId: stat.cls.id,
      className: stat.cls.name,
      department: stat.cls.department,
      homeroomTeacher: stat.cls.homeroomTeacher,
      teacherPhone: stat.cls.teacherPhone,
      totalStudents: stat.totalStudents,
      registeredCount: stat.registeredCount,
      baliCount: stat.baliCount,
      yogyaCount: stat.yogyaCount,
      baliPercentage: stat.baliPercentage,
      rank,
      autoStatus,
      finalStatus,
      statusLabel,
      isOverride,
      manualWaliDestination: stat.cls.manualWaliDestination,
      manualWaliNotes: stat.cls.manualWaliNotes,
    };

    itemsByClassName[stat.cls.name] = item;
    return item;
  });

  return {
    totalBaliStudents,
    totalYogyaStudents,
    busCapacity,
    totalGelombang,
    totalBusesNeeded,
    totalQuotaWaliBali,
    quotaGel1,
    quotaGel2,
    items,
    itemsByClassName,
  };
}
