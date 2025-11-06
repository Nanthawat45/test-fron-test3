import React, { useState, useMemo } from "react"; // นำเข้า React และ hooks ใช้ state จัดการสถานะภายใน และ useMemo คำนวณแบบแคช
import LoadingAnimation from "../animations/LoadingAnimation.jsx"; // คอมโพเนนต์แอนิเมชันระหว่างโหลด
import StripeService from "../../../service/stripeService.js"; // service สำหรับเรียกสร้าง Stripe Checkout
import { calculatePriceBreakdown } from "../../../service/calculatePrice.js"; // ฟังก์ชันคำนวณสรุปราคาโดยแยกประเภทค่าใช้จ่าย

// คืน 'YYYY-MM-DD' โดยไม่เพี้ยน timezone                                 // ยูทิลช่วยทำให้รูปแบบวันที่คงที่ฝั่งเซิร์ฟเวอร์
function normalizeDateForServer(input) { // ฟังก์ชันรับค่า date หลากรูปแบบแล้ว normalize เป็นสตริง YYYY-MM-DD
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input; // ถ้าเป็นสตริงอยู่แล้วและตรงรูปแบบ ให้คืนค่าเดิม
  const d = new Date(input); // แปลงเป็น Date object แม้จะได้ timestamp/string มาก็ตาม
  const yyyy = d.getFullYear(); // ดึงปี 4 หลัก
  const mm = String(d.getMonth() + 1).padStart(2, "0"); // เดือนเริ่มจาก 0 → บวก 1 แล้วแพดซ้ายให้ 2 หลัก
  const dd = String(d.getDate()).padStart(2, "0"); // วันในเดือน แพดซ้ายให้ 2 หลัก
  return `${yyyy}-${mm}-${dd}`; // ประกอบกลับเป็นรูปแบบมาตรฐาน YYYY-MM-DD
}

export default function Step4({ // คอมโพเนนต์สเต็ป 4: สรุปและชำระเงิน
  bookingData, // ออบเจ็กต์ข้อมูลการจองจากสเต็ปก่อนหน้า
  onPrev, // ฟังก์ชันย้อนกลับไป step ก่อนหน้า
  isLoading: isLoadingFromParent = false, // alias + default                 // สถานะโหลดจากพาเรนต์ (เช่น กำลังทำงานรวม)
}) {
  const [isLoading, setIsLoading] = useState(false); // สถานะโหลดเฉพาะในคอมโพเนนต์นี้ (ระหว่างกดชำระเงิน)
  const [error, setError] = useState(""); // เก็บข้อความผิดพลาดเพื่อแสดงบนหน้า

  const { // ดึงค่าจาก bookingData พร้อมกำหนดค่า fallback
    courseType = "-", // ประเภทคอร์ส (จำนวนหลุม)
    date, // วันที่จอง (อาจเป็นสตริงหรือ Date)
    timeSlot = "-", // ช่วงเวลา
    players = 0, // จำนวนผู้เล่น
    groupName = "", // ชื่อกลุ่ม (optional)
    caddy: rawCaddy = [], // รายการ id แคดดี้ที่เลือก (ดิบ)
    golfCartQty: rawCart = 0, // จำนวนรถกอล์ฟ (ดิบ)
    golfBagQty: rawBag = 0, // จำนวนถุงกอล์ฟ (ดิบ)
  } = bookingData || {}; // ถ้า bookingData เป็น undefined ให้ใช้ออบเจ็กต์ว่าง

  const caddy = Array.isArray(rawCaddy) ? rawCaddy : []; // ปรับให้แน่ใจว่า caddy เป็นอาร์เรย์
  const golfCartQty = Number(rawCart ?? 0); // แปลงจำนวนรถกอล์ฟเป็นตัวเลขป้องกัน NaN
  const golfBagQty = Number(rawBag ?? 0); // แปลงจำนวนถุงกอล์ฟเป็นตัวเลขป้องกัน NaN

  const { greenFee, caddyFee, cartFee, bagFee, total } = useMemo( // คำนวณสรุปราคาแบบแคช ถ้าพารามิเตอร์ไม่เปลี่ยนจะไม่คำนวณซ้ำ
    () =>
      calculatePriceBreakdown({ // เรียกฟังก์ชันคำนวณโดยส่งข้อมูลที่จำเป็น
        courseType, // ประเภทคอร์ส
        players: Number(players ?? 0), // จำนวนผู้เล่นเป็นตัวเลข
        caddy, // อาร์เรย์ id แคดดี้
        golfCartQty, // จำนวนรถกอล์ฟ
        golfBagQty, // จำนวนถุงกอล์ฟ
        date, // วันที่ (อาจมีผลต่อเรทราคา)
      }),
    [courseType, players, caddy, golfCartQty, golfBagQty, date] // จะคำนวณใหม่เมื่อใดเมื่อหนึ่งในค่าเหล่านี้เปลี่ยน
  );

  async function handleProceedToPayment() { // ฟังก์ชันหลักที่กดแล้วจะไป Stripe Checkout
    try {
      setIsLoading(true); // เปิดสถานะโหลดของปุ่มในหน้า
      setError(""); // ล้าง error เก่า

      // ✅ ตรวจว่าข้อมูลพื้นฐานครบหรือไม่
      if (!date || !timeSlot || !players) { // ต้องมีวันที่ เวลา และจำนวนผู้เล่น
        throw new Error("ข้อมูลไม่ครบ กรุณากรอกให้ครบถ้วน"); // โยนข้อผิดพลาดพร้อมข้อความสำหรับผู้ใช้
      }

      // ✅ ต้องเลือกแคดดี้เท่ากับจำนวนผู้เล่นเป๊ะ
      if (!Array.isArray(caddy) || caddy.length !== Number(players)) { // จำนวนแคดดี้ต้องตรงกับจำนวนผู้เล่น
        throw new Error(`จำนวนแคดดี้ต้องเท่ากับจำนวนผู้เล่น (${players} คน)`); // แจ้งเตือนชัดเจน
      }

      // ✅ ตรวจยอดรวมว่าถูกต้องหรือไม่
      if (!total || Number(total) <= 0) { // total ต้องมีและมากกว่าศูนย์
        throw new Error("ยอดชำระไม่ถูกต้อง"); // ป้องกันการไปหน้าชำระเงินโดยยอดรวมผิด
      }

      // ✅ เตรียมข้อมูลส่งไป Stripe
      const payload = { // ออบเจ็กต์ข้อมูลตามที่ backend/Stripe service ต้องการ
        courseType: String(courseType), // บังคับให้เป็นสตริงกัน type mismatch
        date: normalizeDateForServer(date), // normalize วันเป็น YYYY-MM-DD
        timeSlot, // ช่วงเวลา
        players: Number(players), // จำนวนผู้เล่นตัวเลข
        groupName, // ชื่อกลุ่ม
        caddy, // array ของ id ที่เลือก
        golfCartQty: Number(golfCartQty || 0), // จำนวนรถกอล์ฟตัวเลข
        golfBagQty: Number(golfBagQty || 0), // จำนวนถุงกอล์ฟตัวเลข
        totalPrice: Number(total), // ราคารวมสุดท้ายตัวเลข
      };

      // ✅ เก็บข้อมูลไว้ใน sessionStorage สำหรับหน้า success
      const preview = {  // ออบเจ็กต์ตัวอย่างเพื่อให้หน้า success แสดงสรุปได้แม้ยังไม่ดึงจากเซิร์ฟเวอร์
        ...payload, // คัดลอก payload หลัก
        price: { greenFee, caddyFee, cartFee, bagFee, total } // แนบโครงราคาที่คำนวณแล้ว
      };
      sessionStorage.setItem("bookingPreview", JSON.stringify(preview)); // เซฟลง sessionStorage เป็นสตริง JSON

      // ✅ เรียก Stripe Checkout
      const resp = await StripeService.createCheckout(payload); // call service ไปยัง backend เพื่อสร้าง session
      const data = resp?.data ?? resp; // รองรับทั้งกรณี axios (มี data) และ fetch/raw
      const paymentUrl = data?.paymentUrl || data?.url; // ดึง URL สำหรับ redirect ไป Stripe
      if (!paymentUrl) { // ถ้าไม่พบ URL
        throw new Error(data?.message || "ไม่พบลิงก์ชำระเงินจากเซิร์ฟเวอร์"); // แจ้งข้อผิดพลาด
      }

      // ✅ ถ้าไม่ throw error → ไปหน้า Stripe
      window.location.assign(paymentUrl); // สั่งเปลี่ยนหน้าไปยังหน้าชำระเงินของ Stripe
    } catch (err) { // จัดการข้อผิดพลาดทั้งหมด
      // ⚠️ โชว์ข้อความผิดพลาดบนหน้าแทนที่จะ redirect
      setError(err?.response?.data?.message || err?.message || "เกิดข้อผิดพลาด"); // แสดงข้อความที่คนอ่านเข้าใจ
    } finally {
      setIsLoading(false); // ปิดสถานะโหลดไม่ว่าผลจะสำเร็จหรือผิดพลาด
    }
  }

  const disabled = isLoading || isLoadingFromParent; // ปุ่มต่าง ๆ ควรถูก disable เมื่อกำลังโหลด (ภายใน/จากพาเรนต์)

  return ( // เริ่ม JSX UI ของสเต็ป 4
    <div className="max-w-md mx-auto p-6 bg-white/60 backdrop-blur-lg rounded-3xl border border-neutral-200/40 ring-1 ring-white/30 shadow-md"> {/* กล่องหลักพร้อมสไตล์ */}
      <h2 className="text-[22px] font-th text-neutral-900 text-center mb-6">Step 4: สรุปและตรวจสอบ</h2> {/* หัวข้อสเต็ป */}

      <div className="text-neutral-800 space-y-1.5 mb-6 text-[15px]"> {/* บล็อกสรุปข้อมูลการจอง */}
        <p><span className="text-neutral-500">ประเภทคอร์ส:</span> {courseType} หลุม</p> {/* แสดงประเภทคอร์ส */}
        <p><span className="text-neutral-500">วันที่:</span> {date ? new Date(date).toLocaleDateString("th-TH") : "-"}</p> {/* แสดงวันที่ในรูปแบบท้องถิ่นไทย */}
        <p><span className="text-neutral-500">เวลา:</span> {timeSlot}</p> {/* แสดงช่วงเวลา */}
        <p><span className="text-neutral-500">จำนวนผู้เล่น:</span> {players} คน</p> {/* แสดงจำนวนผู้เล่น */}
        <p><span className="text-neutral-500">ชื่อกลุ่ม:</span> {groupName || "-"}</p> {/* แสดงชื่อกลุ่มหรือขีดถ้าไม่มี */}
        <p><span className="text-neutral-500">แคดดี้:</span> {Array.isArray(caddy) && caddy.length > 0 ? `${caddy.length} คน` : "-"}</p> {/* แสดงจำนวนแคดดี้ที่เลือก */}
        <p><span className="text-neutral-500">รถกอล์ฟ:</span> {golfCartQty} คัน</p> {/* แสดงจำนวนรถกอล์ฟ */}
        <p><span className="text-neutral-500">ถุงกอล์ฟ:</span> {golfBagQty} ถุง</p> {/* แสดงจำนวนถุงกอล์ฟ */}
      </div>

      <div className="rounded-2xl bg-white/70 border border-neutral-200 p-4 mb-6"> {/* กล่องรายละเอียดราคา */}
        <h3 className="text-[16px] font-th text-neutral-900 mb-2">รายละเอียดค่าใช้จ่าย</h3> {/* หัวข้อย่อย */}
        <ul className="text-neutral-800 text-[15px] space-y-1"> {/* รายการค่าใช้จ่าย */}
          <li>• Green Fee: {Number(greenFee).toLocaleString()} บาท</li> {/* ค่า Green Fee */}
          <li>• Caddy: {Number(caddyFee).toLocaleString()} บาท</li> {/* ค่า Caddy */}
          <li>• Cart: {Number(cartFee).toLocaleString()} บาท</li> {/* ค่า Cart */}
          <li>• Golf Bag: {Number(bagFee).toLocaleString()} บาท</li> {/* ค่า Golf Bag */}
        </ul>
        <div className="h-px bg-neutral-200 my-3" /> {/* เส้นคั่น */}
        <h3 className="text-xl font-th text-emerald-700">รวมทั้งหมด: {Number(total).toLocaleString()} บาท</h3> {/* ราคารวมทั้งหมด */}
      </div>

      {error && ( // ถ้ามีข้อผิดพลาดให้แสดงกล่องแจ้งเตือน
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 mb-4"> {/* สไตล์กล่อง error */}
          <p className="text-sm text-red-700"><span className="font-medium">เกิดข้อผิดพลาด:</span> {error}</p> {/* ข้อความ error */}
        </div>
      )}
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 mb-4"> {/* กล่องคำแนะนำก่อนชำระ */}
        <p className="text-sm text-emerald-800">โปรดตรวจสอบข้อมูลให้ถูกต้องก่อนดำเนินการชำระเงิน</p> {/* ข้อความแนะนำ */}
      </div>

      <div className="flex justify-between mt-6"> {/* แถวปุ่มย้อนกลับและชำระเงิน */}
        <button
          onClick={onPrev} // เรียกกลับไปสเต็ปก่อนหน้า
          disabled={disabled} // ปิดปุ่มเมื่ออยู่ในสถานะโหลด
          className="px-6 py-2 rounded-full font-th bg-neutral-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors" // สไตล์ปุ่มย้อนกลับ
        >
          ย้อนกลับ {/* ป้ายปุ่ม */}
        </button>

        <button
          onClick={handleProceedToPayment} // เริ่มกระบวนการไป Stripe Checkout
          disabled={disabled} // ปิดปุ่มเมื่อกำลังโหลด
          className={[ // จัดคลาสแบบไดนามิก
            "px-6 py-2 rounded-full font-th flex items-center gap-2 transition-colors", // สไตล์พื้นฐานปุ่ม
            "disabled:opacity-50 disabled:cursor-not-allowed", // สไตล์ตอน disabled
            disabled ? "bg-neutral-300 text-neutral-600" : "bg-emerald-600 text-white hover:bg-emerald-700", // สีตามสถานะ
          ].join(" ")}
        >
          {disabled ? ( // ถ้ากำลังโหลด แสดงแอนิเมชันและข้อความ
            <>
              <LoadingAnimation /> {/* ไอคอนโหลด */}
              <span>กำลังประมวลผล...</span> {/* ข้อความกำลังดำเนินการ */}
            </>
          ) : ( // ถ้าไม่โหลด แสดงป้ายปุ่มปกติ
            <>ดำเนินการชำระเงิน</>
          )}
        </button>
      </div>
    </div>
  ); // จบการเรนเดอร์ JSX
} // จบคอมโพเนนต์ Step4
