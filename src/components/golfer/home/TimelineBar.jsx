import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaLock } from "react-icons/fa";
import bookingService from "../../../service/bookingService";


const HOLE_DURATION_HOURS = Object.freeze({ 9: 2.5, 18: 4.5 });
const LOCKED_STATUSES = Object.freeze(["booked", "confirmed", "paid"]);

function calcFinish(startTime, holesCount) {
  const ok = /^\d{2}:\d{2}$/.test(startTime);
  if (!ok) return "--:--";
  const [h, m] = startTime.split(":").map(Number);
  const minutes = Math.round((HOLE_DURATION_HOURS[holesCount] ?? 4.5) * 60);
  const end = new Date(2000, 0, 1, h, m + minutes);
  return `${String(end.getHours()).padStart(2, "0")}:${String(
    end.getMinutes()
  ).padStart(2, "0")}`;
}

function extractBookings(resOrData) {
  const p = resOrData?.data ?? resOrData;
  if (!p) return [];
  if (Array.isArray(p)) return p;
  if (Array.isArray(p.bookings)) return p.bookings;
  if (Array.isArray(p.data)) return p.data;
  return [];
}

function isLocked(b) {
  const s = String(b?.status || "").toLowerCase();
  return b?.isPaid || LOCKED_STATUSES.includes(s);
}

// export default function TimelineBar({ date, className = "" }) {
//   // ถ้า parent ไม่ส่ง date มา → ใช้ today-mode และอัปเดตอัตโนมัติที่เที่ยงคืน
//   const [todayStr, setTodayStr] = useState(() =>
//     new Date().toISOString().slice(0, 10)
//   );

const localYMD = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;   // YYYY-MM-DD (เขตเวลาเครื่องผู้ใช้)
};

export default function TimelineBar({ date, className = "" }) {
  // ถ้า parent ไม่ส่ง date มา → ใช้ today-mode (local) และอัปเดตอัตโนมัติที่เที่ยงคืน
  const [todayStr, setTodayStr] = useState(() => localYMD());

  useEffect(() => {
    if (date) return; // ถ้าถูกบังคับด้วย prop date ไม่ต้องทำโหมดนี้
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 0, 0, 0
    );

    const msToMidnight = nextMidnight.getTime() - now.getTime();
    const t1 = setTimeout(() => {
      setTodayStr(localYMD());
      // หลังจากเด้งครั้งแรก ตั้ง interval ทุก 24 ชม.
      const t2 = setInterval(() => {
        setTodayStr(localYMD());
      }, 24 * 60 * 60 * 1000);
      window.__timelineDailyTick = t2;
    }, msToMidnight);
    return () => {
      clearTimeout(t1);
      if (window.__timelineDailyTick) clearInterval(window.__timelineDailyTick);
    };
  }, [date]);

  const effectiveDate = date || todayStr;

  const [locked9, setLocked9] = useState([]);
  const [locked18, setLocked18] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(
  async (signal) => {
    if (typeof bookingService?.getTodayBookings !== "function") {
      setLocked9([]);
      setLocked18([]);
      setErr("ไม่พบฟังก์ชัน getTodayBookings ใน bookingService");
      return;
    }

    setLoading(true);
    setErr("");
    try {
      const res = await bookingService.getTodayBookings(date ? effectiveDate : undefined);
      if (signal.aborted) return;

      // const all = extractBookings(res).filter(isLocked);
      let all = extractBookings(res).filter(isLocked);
      // เผื่อ backend คืนหลายวัน: ถ้ามีวันที่ระบุ ให้กรองวันนั้นเท่านั้น
      if (date) {
        const toYMD = (d) => {
          if (!d) return "";
          const dt = new Date(d);
          return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
 
      };
      all = all.filter(b =>
        [b?.date, b?.bookingDate, b?.date_thai].some(x => toYMD(x) === effectiveDate)
      );
    }



      const uniq = (arr) =>
        Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b));

      setLocked9(
        uniq(all.filter((b) => String(b.courseType) === "9").map((b) => b.timeSlot))
      );
      setLocked18(
        uniq(all.filter((b) => String(b.courseType) === "18").map((b) => b.timeSlot))
      );
    } catch (e) {
      if (signal.aborted) return;

      const status = e?.response?.status;
      const backendMsg = e?.response?.data?.message;
      // Server ไม่ได้ npm run dev หรือ โค้ดไม่ได้เชื่อมกับ Server
      let message = "⚠️ ไม่สามารถโหลดข้อมูลได้ มีข้อผิดพลาดทาง Server";

      if (status === 401)
        message = "🔒 ยังไม่ได้เข้าสู่ระบบ: กรุณาเข้าสู่ระบบก่อนเข้าถึงข้อมูลการจอง";
      else if (status === 403)
        message = "🚫 ไม่มีสิทธิ์เข้าถึงข้อมูลนี้: โปรดตรวจสอบสิทธิ์ของผู้ใช้";
      else if (status === 404)
        message = "❓ ไม่พบข้อมูลการจองในระบบ";
      else if (status === 500)
        message = "💥 เซิร์ฟเวอร์เกิดข้อผิดพลาด: โปรดลองอีกครั้งภายหลัง";
      else if (backendMsg)
        message = `⚠️ ${backendMsg}`;

      setLocked9([]);
      setLocked18([]);
      setErr(message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  },
  [date, effectiveDate]
);


  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  return (
    <div
      className={[
        "absolute bottom-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl px-3 z-10",
        className,
      ].join(" ")}
    >
      {/* โทนขาวบริสุทธิ์ ดูสะอาด */}
      <div className="relative bg-white/60 backdrop-blur-lg rounded-2xl shadow-md border border-slate-200/30 p-4 md:p-5 ring-1 ring-slate-100/30">
        {/* light gradient overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-2xl 
  bg-gradient-to-b from-white/50 via-slate-50/40 to-slate-100/30 opacity-70"
        />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
          <div>
            <h3 className="text-base font-semibold text-gray-800 tracking-tight">
              Booked Slots (9 & 18 Holes)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Date: {effectiveDate}</p>
          </div>
          {loading && <span className="text-gray-400 text-xs animate-pulse">Loading…</span>}
          {!loading && err && <span className="text-red-500 text-xs">{err}</span>}
        </div>

        {/* Content */}
        {!loading && !err && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <LockedColumn title="18 Holes" holesCount={18} times={locked18} />
            <LockedColumn title="9 Holes" holesCount={9} times={locked9} />
          </div>
        )}

        {!loading && !err && locked9.length === 0 && locked18.length === 0 && (
          <p className="text-gray-400 text-xs mt-2">No bookings yet.</p>
        )}
      </div>
    </div>
  );
}

function LockedColumn({ title, holesCount, times }) {
  return (
    <section>
      <p className="text-xs font-medium text-gray-700 mb-1.5">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {times.length === 0 ? (
          <span className="text-gray-400 text-xs">—</span>
        ) : (
          times.map((t, i) => (
            <TimeSlotPill key={`${title}-${t}-${i}`} timeSlot={t} holesCount={holesCount} />
          ))
        )}
      </div>
    </section>
  );
}

function TimeSlotPill({ timeSlot, holesCount }) {
  const finish = useMemo(() => calcFinish(timeSlot, holesCount), [timeSlot, holesCount]);
  return (
    <div
      className="flex flex-col items-center px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/70 text-gray-700 text-xs shadow-sm cursor-not-allowed hover:bg-slate-50 transition-all"
      title={`Time ${timeSlot} (${holesCount} holes • ends around ${finish})`}
    >
      <div className="flex items-center gap-1.5">
        <FaLock className="w-3 h-3 text-gray-600" />
        <span className="font-medium tabular-nums text-[11px]">{timeSlot}</span>
      </div>
      <span className="text-[10px] mt-0.5 text-gray-500">Ends ~ {finish}</span>
    </div>
  );
}
