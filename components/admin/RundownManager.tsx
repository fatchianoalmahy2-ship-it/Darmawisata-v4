'use client';

import React, { useState } from 'react';
import { RundownItem } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Clock, 
  MapPin, 
  Compass, 
  Sparkles,
  FileSpreadsheet,
  Upload,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useTableQuery } from '@/hooks/useTableQuery';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { PaginationControls } from '@/components/ui/PaginationControls';

interface RundownManagerProps {
  rundowns: RundownItem[];
  onSaveRundown: (item: RundownItem) => Promise<void>;
  onDeleteRundown: (id: string) => Promise<void>;
  onResetRundowns: () => Promise<void>;
}

export const RundownManager: React.FC<RundownManagerProps> = ({
  rundowns,
  onSaveRundown,
  onDeleteRundown,
  onResetRundowns,
}) => {
  const [selectedTour, setSelectedTour] = useState<'BALI' | 'YOGYAKARTA'>('BALI');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RundownItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<RundownItem | null>(null);

  // Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importStatus, setImportStatus] = useState({ type: '', msg: '' });

  // Form State
  const [day, setDay] = useState(1);
  const [time, setTime] = useState('08:00');
  const [activity, setActivity] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const filteredItems = rundowns
    .filter((r) => {
      if (selectedTour === 'BALI') return r.id?.startsWith('bali') || r.location.toLowerCase().includes('bali') || r.day <= 5;
      return r.id?.startsWith('yogya') || r.location.toLowerCase().includes('yogya') || r.location.toLowerCase().includes('merapi');
    })
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));

  const uniqueDays = Array.from(new Set(filteredItems.map(item => item.day))).sort((a, b) => a - b);

  // Unified Table Query for rundown items
  const {
    search,
    setSearch,
    filters,
    setFilters,
    handleClearFilters,
    pagination,
    processedData: queryRundowns,
    paginatedData,
    totalPages,
    handlePageChange,
  } = useTableQuery<RundownItem>(filteredItems, {
    searchFields: ['activity', 'location', 'notes'],
    initialPageSize: 6,
    filterFn: (item, activeFilters) => {
      const { day: filterDay } = activeFilters;
      if (filterDay && item.day !== parseInt(filterDay)) return false;
      return true;
    },
  });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setDay(1);
    setTime('08:00');
    setActivity('');
    setLocation('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: RundownItem) => {
    setEditingItem(item);
    setDay(item.day);
    setTime(item.time);
    setActivity(item.activity);
    setLocation(item.location);
    setNotes(item.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activity || !location) return;

    const itemToSave: RundownItem = {
      id: editingItem?.id || `${selectedTour.toLowerCase()}_${Date.now()}`,
      day,
      time,
      activity,
      location,
      notes,
    };

    await onSaveRundown(itemToSave);
    setIsModalOpen(false);
  };

  const handleExportExcel = () => {
    const exportData = queryRundowns.map((item, idx) => ({
      No: idx + 1,
      'Hari Ke': item.day,
      Waktu: `${item.time} WIB`,
      'Nama Kegiatan / Destinasi': item.activity,
      'Lokasi / Tempat': item.location,
      Catatan: item.notes || '-',
    }));

    import('@/services/excelService').then(({ ExcelService }) => {
      ExcelService.exportToExcel(exportData, `Itinerary_Darmawisata_${selectedTour}`, 'Rundown Itinerary');
    });
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus({ type: 'info', msg: 'Membaca file...' });

    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '' });

          if (jsonData.length === 0) {
            setImportStatus({ type: 'error', msg: 'File Excel kosong atau tidak valid.' });
            return;
          }

          let loadedCount = 0;
          for (let idx = 0; idx < jsonData.length; idx++) {
            const row = jsonData[idx];
            const keys = Object.keys(row);
            const findKeyVal = (searchTerms: string[]) => {
              const matchedKey = keys.find(k => searchTerms.some(term => k.toLowerCase().includes(term)));
              return matchedKey ? String(row[matchedKey]).trim() : '';
            };

            const itemDayRaw = findKeyVal(['hari', 'hari ke', 'day']);
            const itemDay = parseInt(itemDayRaw) || 1;
            const itemTime = findKeyVal(['waktu', 'jam', 'pukul', 'time']) || '08:00';
            const itemActivity = findKeyVal(['kegiatan', 'aktivitas', 'activity', 'destinasi']);
            const itemLocation = findKeyVal(['lokasi', 'tempat', 'location']) || 'Destinasi';
            const itemNotes = findKeyVal(['catatan', 'keterangan', 'notes']);

            if (!itemActivity) continue;

            const itemToSave: RundownItem = {
              id: `${selectedTour.toLowerCase()}_import_${Date.now()}_${idx}`,
              day: itemDay,
              time: itemTime,
              activity: itemActivity,
              location: itemLocation,
              notes: itemNotes,
            };

            await onSaveRundown(itemToSave);
            loadedCount++;
          }

          setImportStatus({
            type: 'success',
            msg: `Berhasil mengimpor ${loadedCount} agenda rundown baru ke dalam Firebase!`
          });
        } catch (err: any) {
          setImportStatus({ type: 'error', msg: `Gagal membaca Excel: ${err.message}` });
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      setImportStatus({ type: 'error', msg: `Gagal memuat modul excel: ${err.message}` });
    }
  };

  return (
    <div className="space-y-6" id="rundown-manager-section">
      {/* Top Controller */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 mb-1">
            <Compass className="w-3.5 h-3.5" /> Management Destinasi & Jadwal Perjalanan
          </div>
          <h2 className="text-lg font-black text-slate-900">Kelola Itinerary & Objek Wisata</h2>
          <p className="text-xs text-slate-500">
            Atur urutan acara, lokasi kunjungan, dan waktu kegiatan yang tersinkronisasi otomatis ke Firebase. Anda juga dapat mengimpor file Excel rundown secara massal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tour Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 no-print">
            <button
              onClick={() => setSelectedTour('BALI')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedTour === 'BALI' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              🌴 Bali
            </button>
            <button
              onClick={() => setSelectedTour('YOGYAKARTA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedTour === 'YOGYAKARTA' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              🏛️ Yogyakarta
            </button>
          </div>

          <button
            onClick={() => {
              setImportStatus({ type: '', msg: '' });
              setIsImportOpen(true);
            }}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs no-print"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Import Excel
          </button>

          <button
            onClick={() => {
              if (confirm('Apakah Anda yakin ingin mengembalikan jadwal ke default awal?')) {
                onResetRundowns();
              }
            }}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer no-print"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Default
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer no-print"
          >
            <Plus className="w-4 h-4" /> Tambah Jadwal/Destinasi
          </button>
        </div>
      </div>

      {/* Print only Header */}
      <div className="p-4 border-b border-slate-100 hidden print:block">
        <h3 className="font-extrabold text-lg text-slate-900">JADWAL PERJALANAN (ITINERARY) DARMAWISATA {selectedTour}</h3>
        <p className="text-xs text-slate-600">TOTAL DATA: {queryRundowns.length} AGENDA</p>
      </div>

      {/* Standardized Search & Filter Bar */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari agenda kegiatan, tempat, atau catatan..."
        activeFilters={filters}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
        onPrint={handlePrint}
        onExportExcel={handleExportExcel}
        filters={[
          {
            key: 'day',
            label: 'Hari Perjalanan',
            placeholder: 'Semua Hari',
            options: uniqueDays.map((d) => ({ value: String(d), label: `Hari Ke-${d}` })),
          },
        ]}
      />

      {/* Items List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3" id="rundown-itinerary-list">
        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
          Daftar Jadwal {selectedTour === 'BALI' ? 'Darmawisata Bali' : 'Darmawisata Yogyakarta'} ({queryRundowns.length} Kegiatan)
        </h3>

        <div className="divide-y divide-slate-100">
          {paginatedData.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm italic">
              Tidak ada agenda rundown yang cocok dengan kriteria pencarian Anda.
            </div>
          ) : (
            paginatedData.map((item, idx) => (
              <div key={item.id || idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 p-2 rounded-xl transition-colors">
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-900 text-white font-black text-[10px] rounded uppercase">
                      HARI KE-{item.day}
                    </span>
                    <span className="font-mono text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {item.time} WIB
                    </span>
                    <span className="text-xs text-slate-500 font-bold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {item.location}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">{item.activity}</h4>
                  {item.notes && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                      <span>{item.notes}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 self-end sm:self-center no-print">
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                    title="Edit Jadwal"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingItem(item)}
                    className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Hapus Kegiatan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pt-2 no-print">
          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={totalPages}
            totalItems={filteredItems.length}
            pageSize={pagination.pageSize}
            onPageChange={handlePageChange}
            itemName="jadwal"
          />
        </div>
      )}

      {/* Modal Add / Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Destinasi & Jadwal' : 'Tambah Jadwal / Destinasi Baru'}
        subtitle="Sistemik sinkronisasi ke database Firestore"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Hari Ke-</label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Jam (WIB)</label>
              <input
                type="text"
                required
                placeholder="misal: 08:30"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Nama Kegiatan / Destinasi Wisata *</label>
            <input
              type="text"
              required
              placeholder="misal: Kunjungan Wisata GWK Cultural Park"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Lokasi / Tempat *</label>
            <input
              type="text"
              required
              placeholder="misal: Ungasan, Badung, Bali"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
            <input
              type="text"
              placeholder="misal: Foto bersama per kelas & Makan Siang"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
            >
              Simpan Ke Firebase
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Import Excel */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Import Rundown Itinerary dari Excel"
        subtitle="Unduh/unggah format Excel rundown acara perjalanan Anda"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-extrabold">Ketentuan Format Excel:</p>
              <p className="font-medium leading-relaxed font-sans">
                Spreadsheet harus memuat header baris pertama dengan kolom:
                <strong> Hari </strong> / <strong> Hari Ke </strong>, 
                <strong> Waktu </strong> / <strong> Jam </strong>, 
                <strong> Kegiatan </strong> / <strong> Aktivitas </strong>, 
                <strong> Lokasi </strong> / <strong> Tempat </strong>, 
                <strong> Catatan </strong> (opsional).
                <br />
                Sistem akan menambahkan agenda perjalanan baru ke dalam database Firebase secara berurutan.
              </p>
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-200 hover:border-purple-500 rounded-2xl p-6 transition-colors relative flex flex-col items-center justify-center text-center cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls,.ods"
              onChange={handleImportExcel}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="p-3 bg-purple-50 rounded-2xl text-purple-600 mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-xs font-extrabold text-slate-800">Seret file Excel rundown Anda di sini</p>
            <p className="text-[10px] text-slate-400 mt-1">XLSX, XLS, ODS up to 10MB</p>
          </div>

          {importStatus.type && (
            <div className={`p-3.5 rounded-xl text-xs font-bold border ${
              importStatus.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
              importStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              'bg-blue-50 text-blue-800 border-blue-200'
            }`}>
              {importStatus.msg}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              onClick={() => setIsImportOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-800">Hapus Kegiatan Jadwal</h3>
                <p className="text-xs text-slate-500 font-medium">Konfirmasi Hapus Rundown</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
              Apakah Anda yakin ingin menghapus kegiatan <strong className="text-slate-900 font-black">{deletingItem.activity}</strong> pada Hari ke-{deletingItem.day}?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deletingItem.id) {
                    onDeleteRundown(deletingItem.id);
                  }
                  setDeletingItem(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Kegiatan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
