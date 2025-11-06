// src/pages/Starter/ReportPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamation } from "@fortawesome/free-solid-svg-icons";
import { faCircleCheck } from "@fortawesome/free-regular-svg-icons";
import HoleService from "../../service/holeService";

const colorMap = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-400",
};

const ReportPage = () => {
  const navigate = useNavigate();

  const [holeStatuses, setHoleStatuses] = useState([]);
  const [loadingHoles, setLoadingHoles] = useState(true);
  const [holesError, setHolesError] = useState(null);

  const [confirmData, setConfirmData] = useState(null);
  const [popup, setPopup] = useState(null);

  const fetchHoleStatuses = async () => {
    setLoadingHoles(true);
    setHolesError(null);
    try {
      const { data } = await HoleService.getAllHoles(); // ✅ ใช้ service
      const formatted = (data || []).map((h) => {
        let displayColor = "green";
        let displayStatus = "ใช้งานได้";
        if (h.status === "close" || h.status === "closed") {
          displayColor = "red";
          displayStatus = h?.description || "ปิดหลุม";
        } else if (h.status === "editing" || h.status === "under_maintenance") {
          displayColor = "blue";
          displayStatus = "กำลังแก้ไข";
        } else if (h.status === "help_car" || h.status === "go_help_car") {
          displayColor = "orange";
          displayStatus = h.status === "help_car" ? "ขอรถกอล์ฟช่วย" : "สลับรถแล้ว";
        }
        return {
          number: h.holeNumber ?? h.number ?? h?._id?.slice(-2),
          color: displayColor,
          status: displayStatus,
        };
      });
      setHoleStatuses(formatted);
    } catch (err) {
      setHoleStatuses([]);
      setHolesError(
        err?.response?.data?.message ||
          (err?.response?.status === 401 ? "กรุณาเข้าสู่ระบบอีกครั้ง" : "ไม่สามารถดึงข้อมูลสถานะหลุมได้")
      );
    } finally {
      setLoadingHoles(false);
    }
  };

  useEffect(() => {
    fetchHoleStatuses();
  }, []);

  const askHoleAction = (title, payload) => {
    setConfirmData({ scope: "hole", title, payload });
  };

  const handleConfirm = async () => {
    if (!confirmData) return;
    try {
      const { title, payload } = confirmData;
      const { holeNumber, description, helpCarCount } = payload || {};

      if (title === "แจ้งปิดหลุม") {
        await HoleService.closeHole({ holeNumber: Number(holeNumber), description });
      } else if (title === "แจ้งสถานะกำลังแก้ไข") {
        await HoleService.reportHole({ holeNumber: Number(holeNumber) });
      } else if (title === "แจ้งเปิดใช้งานหลุม") {
        await HoleService.openHole({ holeNumber: Number(holeNumber) });
      } else if (title === "ขอรถกอล์ฟช่วย") {
        await HoleService.reportHelpCar({
          holeNumber: Number(holeNumber),
          description: description || "",
          helpCarCount: Number(helpCarCount), // ✅ ส่งจำนวนรถเสีย
        });
      } else if (title === "สลับรถกอล์ฟให้กลุ่มนี้") {
        await HoleService.resolveGoCar({ holeNumber: Number(holeNumber) });
      }

      await fetchHoleStatuses();
      setPopup({ title: "ดำเนินการสำเร็จ", isError: false });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "เกิดข้อผิดพลาดในการดำเนินการ";
      setPopup({ title: msg, isError: true });
    } finally {
      setConfirmData(null);
    }
  };

  const renderPopup = () => {
    if (confirmData) {
      return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-3xl shadow-md text-center w-[60%] max-w-xs">
            <FontAwesomeIcon icon={faExclamation} className="text-yellow-400 mb-4" style={{ fontSize: 48 }} />
            <h3 className="text-lg font-semibold mb-4">คุณแน่ใจหรือไม่?</h3>
            <div className="flex justify-center gap-4">
              <button onClick={handleConfirm} className="bg-green-600 text-white px-6 py-2 rounded-full hover:bg-green-700">
                ตกลง
              </button>
              <button onClick={() => setConfirmData(null)} className="bg-red-600 text-white px-6 py-2 rounded-full hover:bg-red-700">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      );
    }
    if (popup) {
      return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-3xl shadow-md text-center w-[70%] max-w-xs space-y-4">
            <FontAwesomeIcon
              icon={popup.isError ? faExclamation : faCircleCheck}
              className={popup.isError ? "text-red-500 mx-auto" : "text-green-500 mx-auto"}
              style={{ fontSize: 48 }}
            />
            <h2 className="text-3xl font-extrabold">{popup.isError ? "เกิดข้อผิดพลาด!" : "สำเร็จ!"}</h2>
            <h3 className="text-base font-normal text-gray-800">{popup.title}</h3>
            <button onClick={() => setPopup(null)} className="mt-4 bg-gray-500 text-white px-6 py-2 rounded-full hover:bg-green-600">
              ตกลง
            </button>
          </div>
        </div>
      );
    }
    return null;
  };

  // ✅ ปรับการ์ด: เพิ่ม showCount สำหรับ "ขอรถกอล์ฟช่วย"
  const HoleCard = ({ color, title, ask, showIssue, showCount }) => {
    const [holeNumber, setHoleNumber] = useState("");
    const [issue, setIssue] = useState("");
    const [count, setCount] = useState("");

    const isValid = () => {
      if (!holeNumber.trim()) return false;
      if (showIssue && !issue.trim()) return false;
      if (showCount) {
        const n = Number(count);
        if (!Number.isFinite(n) || n <= 0) return false;
      }
      return true;
    };

    return (
      <div className="w-full max-w-[240px] p-2 border border-gray-800 rounded-xl shadow-sm bg-gray-50">
        <div className="flex items-center mb-3">
          <div className={`w-4 h-4 rounded-full ${colorMap[color]} mr-2`} />
          <h2 className="text-md font-semibold">{title}</h2>
        </div>

        <label className="block mb-1 font-medium text-sm">หมายเลขหลุม</label>
        <input
          type="text"
          value={holeNumber}
          onChange={(e) => setHoleNumber(e.target.value)}
          className="w-20 mb-3 px-2 py-1 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-center text-sm"
          placeholder="เลขหลุม"
        />

        {showIssue && (
          <>
            <label className="block mb-1 font-medium text-sm">เลือกปัญหา</label>
            <select
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              className="w-full mb-3 px-2 py-1 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
            >
              <option value="" disabled>-- กรุณาเลือกปัญหา --</option>
              <option value="ระบายน้ำ แฟร์เวย์">ระบายน้ำ แฟร์เวย์</option>
              <option value="ระบายน้ำกรีน">ระบายน้ำกรีน</option>
              <option value="ระบายน้ำบังเกอร์">ระบายน้ำบังเกอร์</option>
              <option value="บังเกอร์เสียหาย">บังเกอร์เสียหาย</option>
              <option value="หมอกหนา">หมอกหนา</option>
              <option value="น้ำท่วม">น้ำท่วม</option>
            </select>
          </>
        )}

        {showCount && (
          <>
            <label className="block mb-1 font-medium text-sm">จำนวนรถเสีย</label>
            <input
              type="number"
              min="1"
              max="4"
              step="1"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-full mb-3 px-2 py-1 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              placeholder="1 - 4 คัน"
            />
          </>
        )}

        <div className="text-center">
          <button
            onClick={() =>
              ask(title, {
                holeNumber,
                description: issue || "",
                helpCarCount: showCount ? Number(count) : undefined, // ✅ ส่งเฉพาะตอนขอรถช่วย
              })
            }
            className={`text-white text-sm px-4 py-1 rounded-full transition-colors ${
              isValid() ? "bg-green-600 hover:bg-green-700" : "bg-slate-600 cursor-not-allowed"
            }`}
            disabled={!isValid()}
          >
            ยืนยัน
          </button>
        </div>
      </div>
    );
  };

  // ✅ กรองรายการเฉพาะที่ “ไม่ใช่สีเขียว (ใช้งานได้)”
  const problemHoleStatuses = holeStatuses.filter((h) => h.color !== "green");

  return (
    <div className="min-h-screen bg-white font-inter px-4 py-6">
      {/* ปุ่มย้อนกลับ */}
      <div className="max-w-6xl mx-auto mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-700 hover:text-gray-900 font-semibold transition-colors"
        >
          &lt; ย้อนกลับ
        </button>
      </div>

      {/* แจ้งปัญหา */}
      <section className="max-w-6xl mx-auto">
        <div className="flex justify-center mt-2 mb-6">
          <div className="inline-block bg-black text-white text-lg font-bold py-2 px-6 rounded-lg shadow-md">
            แจ้งปัญหาหลุม
          </div>
        </div>

        <div className="border-2 border-gray-600 rounded-xl p-4 shadow-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 justify-items-center sm:justify-items-stretch">
            <HoleCard title="แจ้งปิดหลุม" color="red" showIssue={true} showCount={false} ask={askHoleAction} />
            <HoleCard title="แจ้งสถานะกำลังแก้ไข" color="blue" showIssue={false} showCount={false} ask={askHoleAction} />
            <HoleCard title="แจ้งเปิดใช้งานหลุม" color="green" showIssue={false} showCount={false} ask={askHoleAction} />
            {/* ✅ ขอรถกอล์ฟช่วย: ถ้าจะใช้งานให้เอา comment ออก */}
            {/* <HoleCard title="ขอรถกอล์ฟช่วย" color="orange" showIssue={false} showCount={true} ask={askHoleAction} /> */}
            <HoleCard title="สลับรถกอล์ฟให้กลุ่มนี้" color="yellow" showIssue={false} showCount={false} ask={askHoleAction} />
          </div>
        </div>
      </section>

      {/* สถานะหลุม (แสดงเฉพาะหลุมที่มีปัญหา) */}
      <section className="max-w-[75rem] mx-auto mt-8 px-1 sm:px-6">
        <h2 className="text-2xl font-extrabold mb-4 text-center text-gray-800">สถานะหลุมกอล์ฟ</h2>
        {loadingHoles ? (
          <div className="text-center text-lg text-gray-600 py-10">กำลังโหลดข้อมูล...</div>
        ) : holesError ? (
          <div className="text-center text-lg text-red-600 py-10">{holesError}</div>
        ) : (
          <div className="border-2 border-gray-400 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 shadow-md bg-white">
            {problemHoleStatuses.length > 0 ? (
              problemHoleStatuses.map((h) => (
                <div
                  key={h.number}
                  className="border rounded-lg p-2 bg-white shadow-sm text-center transform hover:scale-105 transition-transform duration-200"
                >
                  <div
                    className={`text-xs font-semibold px-2 py-0.5 mb-2 rounded-full text-white ${
                      colorMap[h.color] || "bg-gray-400"
                    }`}
                  >
                    หลุมที่ {h.number}
                  </div>
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center border border-gray-300 shadow-inner bg-white">
                    <div className={`w-6 h-6 rounded-full ${colorMap[h.color] || "bg-gray-400"}`} />
                  </div>
                  <div className="text-xs text-gray-700 truncate">{h.status}</div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center text-gray-500 py-10">
                ตอนนี้ไม่มีหลุมที่มีปัญหา 🎉
              </div>
            )}
          </div>
        )}
      </section>

      {renderPopup()}
    </div>
  );
};

export default ReportPage;
