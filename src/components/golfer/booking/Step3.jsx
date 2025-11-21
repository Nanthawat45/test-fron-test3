import React, { useState, useEffect, useMemo, useRef } from "react"; // นำเข้า React hooks ที่ใช้ state/effect/memo/ref
import LoadingAnimation from "../../golfer/animations/LoadingAnimation"; // คอมโพเนนต์แสดงโหลดดิ้ง
import CaddyService from "../../../service/caddyService"; // service ดึงรายชื่อแคดดี้

/* ---------- helpers ---------- */
const HOLD_KEY = (d, t, ct) => `caddy-holds:${d || "none"}:${t || "none"}:${ct || "none"}`; // ฟังก์ชันสร้างคีย์สำหรับ sessionStorage โดยผูกกับ date/timeSlot/courseType

const idOf = (c = {}) => String(c.caddy_id || c._id || c.id || ""); // คืน id ของแคดดี้เป็นสตริง รองรับหลายชื่อฟิลด์
const sameSlot = (a = {}, b = {}) => { // เปรียบเทียบว่าสองอ็อบเจ็กต์เป็นช่องเวลาเดียวกันหรือไม่
  const ad = a.date || a.d, // วันที่ของ a (รองรับ date/d)
    at = a.timeSlot || a.t, // ช่วงเวลาของ a (รองรับ timeSlot/t)
    ac = String(a.courseType ?? a.ct ?? ""); // ประเภทคอร์สของ a (รองรับ courseType/ct) บังคับเป็นสตริง
  const bd = b.date || b.d, // วันที่ของ b
    bt = b.timeSlot || b.t, // ช่วงเวลาของ b
    bc = String(b.courseType ?? b.ct ?? ""); // ประเภทคอร์สของ b
  return String(ad) === String(bd) && String(at) === String(bt) && String(ac) === String(bc); // เทียบทั้งสามมิติเป็นสตริง
};
const readHolds = (d, t, ct) => { // อ่านรายการ hold จาก sessionStorage สำหรับคีย์ (d,t,ct)
  try {
    const v = JSON.parse(sessionStorage.getItem(HOLD_KEY(d, t, ct)) || "[]"); // แปลง JSON; ถ้าไม่มีให้ใช้อาร์เรย์ว่าง
    return Array.isArray(v) ? v.map(String) : []; // ถ้าเป็นอาร์เรย์ แปลงแต่ละตัวเป็นสตริง; ไม่ใช่อาร์เรย์ -> คืน []
  } catch {
    return []; // JSON เสียรูป -> คืน []
  }
};
const writeHolds = (d, t, ct, ids = []) => { // เขียนรายการ hold ลง sessionStorage
  const set = Array.from(new Set(ids.map(String))); // ลบซ้ำและบังคับเป็นสตริง
  sessionStorage.setItem(HOLD_KEY(d, t, ct), JSON.stringify(set)); // เซฟเป็น JSON
};

export default function Step3({ bookingData, handleChange, onNext, onPrev }) { // คอมโพเนนต์หลักของ Step 3
  const { // ดึงค่าจาก props.bookingData พร้อมค่าเริ่มต้น
    golfCartQty = 0, // จำนวนรถกอล์ฟ
    golfBagQty = 0, // จำนวนกระเป๋า
    caddy = [], // รายการ caddy id ที่เลือกแล้ว
    caddySelectionEnabled = false, // สถานะเปิด/ปิดการเลือกแคดดี้
    players = 1, // จำนวนผู้เล่น
    date = "", // วันที่
    timeSlot = "", // ช่วงเวลา
    courseType = "", // ประเภทคอร์ส
  } = bookingData;

  const [caddySearchTerm, setCaddySearchTerm] = useState(""); // คำค้นหาแคดดี้
  const [availableCaddies, setAvailableCaddies] = useState([]); // รายชื่อแคดดี้ที่ว่าง (หลัง normalize + filter)
  const [isLoading, setIsLoading] = useState(false); // สถานะโหลดข้อมูล
  const [error, setError] = useState(""); // ข้อความผิดพลาดหรือคำเตือน
  const pollRef = useRef(null); // เก็บ interval id สำหรับ polling

  // จำนวนที่ต้องเลือกและที่เลือกแล้ว
  const requiredCaddies = Number(players || 0); // จำนวนแคดดี้ที่ต้องเลือก = จำนวนผู้เล่น
  const selectedCount = Array.isArray(caddy) ? caddy.length : 0; // จำนวนที่เลือกแล้ว (ป้องกัน non-array)

  /* โหลดรายชื่อแคดดี้ (เรียกซ้ำได้ รวมถึงตอนติ๊กเปิด) */
  const loadCaddies = async (signal) => { // ฟังก์ชัน async สำหรับโหลดรายชื่อแคดดี้
    if (!date) return; // ถ้ายังไม่มีวันที่ ไม่ต้องโหลด
    try {
      setIsLoading(true); // ตั้งโหลดดิ้ง
      setError(""); // ล้าง error ก่อน

      const resp = await CaddyService.getAvailableCaddies(date); // เรียก service ด้วย date อย่างเดียว
      const raw = resp?.data ?? resp ?? []; // รองรับรูปแบบตอบกลับหลายแบบ
      const list = Array.isArray(raw) ? raw : raw.list || raw.items || raw.data || []; // ดึงอาร์เรย์ข้อมูลออกมา

      const normalized = (list || []) // ทำ normalize + filter
        .filter(Boolean) // กรองค่าที่เป็น falsy ออก
        .filter((c) => (c.caddyStatus || c.status || "available").toLowerCase() === "available") // ต้อง available
        .filter((c) => { // ตรวจไม่ชนกับ busy ในช่องเวลานี้
          const busy = c.busySlots || c.unavailable || c.bookings || c.slots || []; // รองรับชื่อฟิลด์หลายแบบ
          if (!Array.isArray(busy) || busy.length === 0) return true; // ถ้าไม่มี busy เลย -> ว่าง
          return !busy.some((s) => sameSlot(s, { date, timeSlot, courseType })); // ห้ามชน slot ปัจจุบัน
        })
        .map((c) => ({ // map ให้เป็นรูปแบบเดียวกัน
          id: idOf(c), // id เป็นสตริง
          name: c.name || c.fullName || `Caddy ${c.code || ""}`.trim(), // ชื่อแสดงผล
          profilePic: c.profilePic || c.avatar || "", // รูปโปรไฟล์ (อาจว่าง)
        }));

      if (!signal?.aborted) setAvailableCaddies(normalized); // ถ้าไม่ถูกยกเลิก -> ตั้ง state รายการแคดดี้
    } catch (e) {
      if (!signal?.aborted) { // ถ้าไม่ถูกยกเลิก -> ตั้ง error และเคลียร์รายการ
        setError(e?.response?.data?.message || e.message || "โหลดรายชื่อแคดดี้ไม่สำเร็จ"); // ข้อความผิดพลาด
        setAvailableCaddies([]); // เคลียร์รายการ
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false); // จบโหลดดิ้งถ้าไม่ถูกยกเลิก
    }
  };

  /* โหลดอัตโนมัติเมื่อเปิดสวิตช์/เปลี่ยน slot */
  useEffect(() => { // effect เมื่อเปลี่ยนสวิตช์/วันที่/ช่วงเวลา/ประเภทคอร์ส/จำนวนผู้เล่น
    if (!caddySelectionEnabled || !date) { // ถ้ายังไม่เปิดเลือกหรือไม่มีวันที่
      setAvailableCaddies([]); // เคลียร์รายการ
      setError(""); // ล้าง error
      return; // ออก
    }
    const ac = new AbortController(); // สร้าง AbortController
    loadCaddies(ac.signal); // โหลดทันทีรอบแรก

    clearInterval(pollRef.current); // ล้าง interval เดิมถ้ามี
    pollRef.current = setInterval(() => loadCaddies(ac.signal), 15000); // ตั้ง polling ทุก 15 วิ

    const onFocus = () => document.visibilityState === "visible" && loadCaddies(ac.signal); // ถ้ากลับมาโฟกัสแท็บ ให้รีโหลด
    window.addEventListener("focus", onFocus); // ผูก event focus
    document.addEventListener("visibilitychange", onFocus); // ผูก event visibilitychange

    return () => { // cleanup ตอน unmount/เปลี่ยน dependency
      ac.abort(); // ยกเลิกโหลดค้าง
      clearInterval(pollRef.current); // ล้าง interval
      window.removeEventListener("focus", onFocus); // ถอน event
      document.removeEventListener("visibilitychange", onFocus); // ถอน event
    };
  }, [caddySelectionEnabled, date, timeSlot, courseType, players]); // dependency ที่มีผลต่อการโหลด/รีโหลด

  /* soft holds */
  const softHolds = useMemo(() => readHolds(date, timeSlot, courseType), [date, timeSlot, courseType]); // อ่าน hold จาก storage ตาม slot ปัจจุบัน

  /* filter หลังตัด hold + คำค้น */
  const filteredCaddies = useMemo(() => { // กรองรายชื่อแคดดี้หลังหักคนที่ถูก hold แล้ว และตามคำค้น
    const kw = caddySearchTerm.trim().toLowerCase(); // แปลงคำค้นเป็นตัวพิมพ์เล็ก
    return availableCaddies // เริ่มจากรายการที่ว่าง
      .filter((c) => !softHolds.includes(String(c.id))) // กรองทิ้งคนที่ถูก hold ใน slot นี้
      .filter((c) => (c.name || "").toLowerCase().includes(kw)); // กรองตามชื่อกับคำค้น
  }, [availableCaddies, softHolds, caddySearchTerm]); // memo ตามรายการ/hold/คำค้น

  /* เลือก/ยกเลิกแคดดี้ */
  const handleCaddySelection = (caddyIdRaw) => { // จัดการคลิกเลือก/ยกเลิกเลือกแคดดี้
    const caddyId = String(caddyIdRaw); // บังคับเป็นสตริง
    let selected = caddy.map(String); // คัดลอกรายการที่เลือกแล้วเป็นสตริง

    if (selected.includes(caddyId)) { // ถ้าคนนี้ถูกเลือกอยู่แล้ว
      selected = selected.filter((id) => id !== caddyId); // ยกเลิกเลือก
      writeHolds(date, timeSlot, courseType, readHolds(date, timeSlot, courseType).filter((id) => id !== caddyId)); // ถอน hold สำหรับ id นี้
    } else { // ถ้ายังไม่ถูกเลือก
      if (selected.length >= requiredCaddies) { // ถ้าเลือกครบจำนวนผู้เล่นแล้ว
        setError(`ต้องเลือกแคดดี้ให้ครบจำนวนผู้เล่น (${requiredCaddies} คน)`); // ตั้งข้อความเตือน
        return; // ไม่ทำต่อ
      }
      selected = [...selected, caddyId]; // เพิ่มเข้า selection
      writeHolds(date, timeSlot, courseType, [...readHolds(date, timeSlot, courseType), caddyId]); // ตั้ง hold ให้ id นี้
    }

    // อัปเดต error ตามสถานะเลือก
    const nextCount = selected.length; // จำนวนใหม่หลังอัปเดต
    if (nextCount < requiredCaddies) { // ถ้ายังไม่ครบตามที่ต้องเลือก
      setError(`ต้องเลือกแคดดี้ให้ครบ ${requiredCaddies} คน (เลือกแล้ว ${nextCount})`); // เตือนให้เลือกต่อ
    } else {
      setError(""); // ครบแล้ว ล้างเตือน
    }

    handleChange({ target: { name: "caddy", value: selected } }); // แจ้ง parent อัปเดตค่า caddy ที่เลือกแล้ว
  };

  /* เปลี่ยน slot → ล้าง holds */
  useEffect(() => { // effect สำหรับเคลียร์ hold เมื่อ component/slot เปลี่ยนหรือ unmount
    return () => writeHolds(date, timeSlot, courseType, []); // cleanup: ล้าง hold ของ slot นี้
  }, [date, timeSlot, courseType]); // เปลี่ยน slot เมื่อไหร่ให้ล้าง

  /* ปุ่มต่อ: ถ้าเปิดสวิตช์ ต้องเลือกเท่ากับ players เป๊ะ */
  const needCaddies = !!caddySelectionEnabled; // ต้องเปิดสวิตช์จึงจะบังคับเลือก
  const canProceed = !needCaddies || selectedCount === requiredCaddies; // ไปต่อได้เมื่อไม่บังคับหรือเลือกครบแล้ว
  const nextDisabled = !canProceed; // ปุ่ม Next ถูกปิดเมื่อยังไปต่อไม่ได้

  return ( // เริ่ม JSX UI
    <div className="max-w-lg mx-auto p-6 bg-white/60 backdrop-blur-lg rounded-3xl border border-neutral-200/40 ring-1 ring-white/30 shadow-md"> {/* กล่องหลักของสtep */}
      <h2 className="text-[22px] font-th text-neutral-900 text-center mb-6">Step 3: บริการเสริม</h2> {/* ชื่อสเต็ป */}

      {/* Golf Bag */}
      <div className="mb-6 text-center"> {/* ส่วนจำนวนกระเป๋า */}
        <label className="block text-neutral-700 text-sm font-th mb-2">จำนวนกระเป๋าไม้กอล์ฟ</label> {/* ป้ายชื่อ */}
        <div className="flex items-center justify-center gap-3"> {/* ปุ่มลด/เพิ่มและตัวเลข */}
          <button
            type="button" // ป้องกันพฤติกรรม submit form โดยไม่ตั้งใจ
            onMouseDown={(e) => e.preventDefault()} // กันการ focus ที่อาจทำให้หน้าเด้ง/สคอลล์
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleChange({ target: { name: "golfBagQty", value: Math.max(0, Number(golfBagQty) - 1) } }); }} // ลดค่าอย่างปลอดภัย
            className="px-4 py-2 rounded-full bg-neutral-100 text-neutral-900 hover:bg-neutral-200 transition"
          >–</button> {/* ปุ่มลด */}
          <span className="text-2xl font-th text-neutral-900 tabular-nums">{golfBagQty}</span> {/* แสดงจำนวน */}
          <button
            type="button" // ป้องกัน submit form
            onMouseDown={(e) => e.preventDefault()} // กัน focus เด้ง
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleChange({ target: { name: "golfBagQty", value: Number(golfBagQty) + 1 } }); }} // เพิ่มค่า
            className="px-4 py-2 rounded-full bg-neutral-100 text-neutral-900 hover:bg-neutral-200 transition"
          >+</button> {/* ปุ่มเพิ่ม */}
        </div>
        <p className="text-xs text-neutral-500 mt-1">*ค่าบริการกระเป๋าไม้กอล์ฟ/ท่าน 300 บาท</p> {/* หมายเหตุราคา */}
      </div>

      {/* Golf Cart */}
      <div className="mb-6 text-center"> {/* ส่วนจำนวนรถกอล์ฟ */}
        <label className="block text-neutral-700 text-sm font-th mb-2">จำนวนรถกอล์ฟ</label> {/* ป้ายชื่อ */}
        <div className="flex items-center justify-center gap-3"> {/* ปุ่มลด/เพิ่มและตัวเลข */}
          <button
            type="button" // ป้องกัน submit form
            onMouseDown={(e) => e.preventDefault()} // กัน focus เด้ง
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleChange({ target: { name: "golfCartQty", value: Math.max(0, Number(golfCartQty) - 1) } }); }} // ลดค่า
            className="px-4 py-2 rounded-full bg-neutral-100 text-neutral-900 hover:bg-neutral-200 transition"
          >–</button> {/* ปุ่มลด */}
          <span className="text-2xl font-th text-neutral-900 tabular-nums">{golfCartQty}</span> {/* แสดงจำนวน */}
          <button
            type="button" // ป้องกัน submit form
            onMouseDown={(e) => e.preventDefault()} // กัน focus เด้ง
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleChange({ target: { name: "golfCartQty", value: Number(golfCartQty) + 1 } }); }} // เพิ่มค่า
            className="px-4 py-2 rounded-full bg-neutral-100 text-neutral-900 hover:bg-neutral-200 transition"
          >+</button> {/* ปุ่มเพิ่ม */}
        </div>
        <p className="text-xs text-neutral-500 mt-1">*ค่าบริการรถกอล์ฟ/คัน 500 บาท</p> {/* หมายเหตุราคา */}
      </div>

      {/* Caddy */}
      <div className="mb-6 border-t border-neutral-200 pt-6"> {/* ส่วนเลือกแคดดี้ */}
        <div className="flex items-center mb-3"> {/* แถวสวิตช์เลือกแคดดี้ */}
          <input
            type="checkbox" // กล่องติ๊กเปิด/ปิดการเลือกแคดดี้
            id="caddy-selection-toggle" // สำหรับจับคู่ label
            checked={!!caddySelectionEnabled} // ค่าปัจจุบันของสวิตช์
            onMouseDown={(e) => e.preventDefault()} // กัน focus เด้งตอนกด
            onClick={(e) => e.preventDefault()} // ตัด default เพื่อใช้ onChange เท่านั้น
            onChange={async (e) => { // เมื่อเปลี่ยนค่า
              e.preventDefault(); // กันพฤติกรรม default
              e.stopPropagation(); // กันบับเบิลที่ไม่จำเป็น
              if (caddySelectionEnabled) { // ถ้ากำลังเปิดอยู่ -> ปิด
                handleChange({ target: { name: "caddy", value: [] } }); // ล้างรายการเลือก
                writeHolds(date, timeSlot, courseType, []); // ล้าง hold
                handleChange({ target: { name: "caddySelectionEnabled", value: false } }); // ปิดสวิตช์
                setError(""); // ล้าง error
              } else { // ถ้ากำลังปิด -> เปิด
                handleChange({ target: { name: "caddySelectionEnabled", value: true } }); // เปิดสวิตช์
                setError(requiredCaddies > 0 ? `ต้องเลือกแคดดี้ให้ครบ ${requiredCaddies} คน (เลือกแล้ว 0)` : ""); // แจ้งแนวทางทันที
                await loadCaddies(); // โหลดรายชื่อทันทีเพื่อความลื่น
              }
            }}
            className="mr-2 h-4 w-4 text-emerald-600 border-neutral-300 rounded focus:ring-emerald-500" // สไตล์เช็คบ็อกซ์
          />
          <label htmlFor="caddy-selection-toggle" className="text-neutral-800 font-th text-sm"> {/* ป้ายคำอธิบาย */}
            ต้องการเลือกแคดดี้
          </label>
        </div>

        {caddySelectionEnabled && ( // แสดงส่วนเลือกแคดดี้เมื่อสวิตช์เปิด
          <div className="space-y-4"> {/* คอนเทนเนอร์เนื้อหาเลือกแคดดี้ */}
            {/* แสดงข้อความสถานะ ต้องเลือกแคดดี้กี่คน */}
            <div
              className={[
                "text-sm rounded-xl px-3 py-2 border", // กล่องสถานะ
                selectedCount === requiredCaddies // สีตามครบ/ไม่ครบ
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-amber-50 border-amber-200 text-amber-700",
              ].join(" ")}
            >
              ต้องเลือกแคดดี้ให้ครบ <b>{requiredCaddies}</b> คน (เลือกแล้ว <b>{selectedCount}</b>) {/* ข้อความนับจำนวน */}
            </div>

            <input
              type="text" // ช่องค้นหา
              placeholder="ค้นหาชื่อแคดดี้..." // placeholder
              value={caddySearchTerm} // ค่าปัจจุบัน
              onChange={(e) => setCaddySearchTerm(e.target.value)} // อัปเดตคำค้น
              onMouseDown={(e) => e.preventDefault()} // กัน focus เด้งบางกรณี
              className="w-full px-3 py-2 rounded-2xl bg-white/80 border border-neutral-200 text-neutral-800 shadow-sm outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-600 transition" // สไตล์ช่องค้นหา
            />

            {isLoading ? ( // ถ้าโหลดอยู่ แสดงแอนิเมชัน
              <div className="flex justify-center py-3"><LoadingAnimation /></div> // คอมโพเนนต์โหลดดิ้ง
            ) : error && !error.startsWith("ต้องเลือกแคดดี้") ? ( // ถ้ามี error ที่ไม่ใช่ข้อความแนะแนวการเลือก
              <p className="text-center text-red-500 text-sm">{error}</p> // แสดง error
            ) : null} {/* ถ้าไม่มีอะไร -> ไม่แสดง */}

            <div className="grid grid-cols-2 gap-4"> {/* กริดการ์ดแคดดี้ */}
              {filteredCaddies.length > 0 ? ( // ถ้ามีรายการหลังกรอง
                filteredCaddies.map((c) => { // วนรายการ
                  const cid = String(c.id); // id เป็นสตริง
                  const picked = caddy.map(String).includes(cid); // สถานะถูกเลือกแล้วหรือยัง
                  const limitReached = !picked && selectedCount >= requiredCaddies; // ถ้าเลือกครบแล้ว ห้ามเลือกเพิ่ม
                  return (
                    <div
                      key={cid} // key ของการ์ด
                      onMouseDown={(e) => e.preventDefault()} // กัน focus เด้ง/ลากโฟกัส
                      onClick={(e) => { // คลิกการ์ดเพื่อเลือก/ยกเลิก
                        e.preventDefault(); // กัน default (เพื่อกันการสคอลล์/โฟกัส)
                        e.stopPropagation(); // กันบับเบิล
                        if (!limitReached) handleCaddySelection(cid); // ถ้ายังไม่ครบโควตา ให้จัดการเลือก
                      }}
                      className={[
                        "flex flex-col items-center p-4 rounded-2xl cursor-pointer transition-all", // สไตล์การ์ด
                        picked // สีตามสถานะเลือก/ไม่เลือก/เต็มโควตา
                          ? "bg-emerald-50 border border-emerald-300 scale-[1.02]"
                          : limitReached
                          ? "bg-neutral-100 border border-neutral-200 opacity-60 cursor-not-allowed"
                          : "bg-white/70 border border-neutral-200 hover:bg-neutral-50 hover:scale-[1.01]",
                      ].join(" ")}
                      title={limitReached ? "เลือกได้เท่าจำนวนผู้เล่นเท่านั้น" : ""} // คำแนะนำเมื่อครบโควตา
                    >
                      <div className="relative w-20 h-20 rounded-full overflow-hidden mb-2"> {/* วงกลมรูปโปรไฟล์ ขนาดคงที่กัน layout shift */}
                        <img
                          src={c.profilePic || "https://placehold.co/96x96/cccccc/ffffff?text=Caddy"} // รูปโปรไฟล์ หรือ placeholder
                          alt={c.name} // alt text
                          className="w-full h-full object-cover" // เติมเต็มกรอบ
                          onError={(e) => { // ถ้ารูปเสียให้ใช้ placeholder
                            e.currentTarget.src = "https://placehold.co/96x96/cccccc/ffffff?text=Caddy"; // ตั้งรูป fallback
                          }}
                        />
                        {picked && ( // ถ้าเลือกแล้ว แสดงแถบติ๊กมุมขวาล่าง
                          <span className="absolute bottom-1 right-1 bg-emerald-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            ✓ เลือกแล้ว
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-neutral-800">{c.name}</p> {/* ชื่อแคดดี้ */}
                      <p className="text-xs text-emerald-600 mt-0.5">ว่าง</p> {/* สถานะ */}
                    </div>
                  );
                })
              ) : ( // ถ้าไม่มีรายการหลังกรอง
                <p className="col-span-2 text-center text-neutral-500 text-sm">ไม่พบแคดดี้ที่ค้นหา</p> // ข้อความว่างเปล่า
              )}
            </div>
          </div>
        )}
        <p className="text-xs text-neutral-500 mt-3">*ค่าบริการแคดดี้/ท่าน 400 บาท</p> {/* หมายเหตุราคา */}
      </div>

      <div className="flex justify-between mt-6"> {/* แถวปุ่มย้อนกลับ/ยืนยัน */}
        <button
          onMouseDown={(e) => e.preventDefault()} // กัน focus เด้งขณะคลิก
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPrev(); }} // เรียก onPrev พร้อมกัน default/bubble
          type="button" // กัน submit form โดยไม่ตั้งใจ
          className="px-6 py-2 rounded-full font-th bg-neutral-900 text-white hover:bg-black transition-colors"
        >
          ย้อนกลับ
        </button>

        <button
          onMouseDown={(e) => e.preventDefault()} // กัน focus เด้ง
          onClick={(e) => { // คลิกยืนยันการจอง
            e.preventDefault(); // กัน default
            e.stopPropagation(); // กันบับเบิล
            if (!canProceed) { // ถ้ายังเลือกไม่ครบ
              setError(`ต้องเลือกแคดดี้ให้ครบ ${requiredCaddies} คน (เลือกแล้ว ${selectedCount})`); // ตั้งเตือน
              return; // ยังไม่ไปต่อ
            }
            onNext(); // ไปขั้นถัดไป
          }}
          disabled={nextDisabled} // ปิดปุ่มถ้าไปต่อไม่ได้
          className={[
            "px-6 py-2 rounded-full font-th transition-colors", // สไตล์ปุ่ม
            nextDisabled
              ? "bg-neutral-300 text-neutral-500 cursor-not-allowed" // สภาพปุ่มปิด
              : "bg-emerald-600 text-white hover:bg-emerald-700", // สภาพปุ่มเปิด
          ].join(" ")}
        >
          ยืนยันการจอง
        </button>
      </div>
    </div>
  ); // จบ JSX
} // จบคอมโพเนนต์
