import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import UserService from "../../service/userService.js";

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef(null);

  // ✅ โหลดข้อมูลพนักงานตาม ID
  useEffect(() => {
  const loadEmployee = async () => {
    try {
      const res = await UserService.getUserById(id);
      // รองรับทั้งกรณีมี data ซ้อน และส่ง object ตรง
      const userData = res.data?.data || res.data;

      if (userData && userData._id) {
        setFormData(userData);
      } else {
        console.error("ไม่พบข้อมูลพนักงาน:", res.data);
        setFormData(null);
      }
    } catch (err) {
      console.error("Load employee failed:", err);
      setFormData(null);
    }
  };
  loadEmployee();
}, [id]);


  if (!formData) return <div className="p-5">Loading...</div>;

  // ✅ อัปเดตค่าในฟอร์ม
  const handleChange = (key, value) => {
    setFormData({ ...formData, [key]: value });
  };

  // ✅ Upload image
  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
    }
  };

  // ✅ ปุ่มเลือกไฟล์
  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  // ✅ บันทึกข้อมูล (PUT /user/updateuser/:id)
  const handleSave = async () => {
    try {
      const data = new FormData();
      data.append("name", formData.name);
      data.append("email", formData.email);
      data.append("phone", formData.phone);
      data.append("role", formData.role);
      if (formData.image instanceof File) {
        data.append("image", formData.image);
      }

      await UserService.updateUser(id, data);
      setIsEditing(false);
      alert("บันทึกข้อมูลสำเร็จ ✅");
    } catch (err) {
      console.error("Update failed:", err);
      alert("บันทึกข้อมูลไม่สำเร็จ ❌");
    }
  };

  // ✅ UI render field
  const renderField = (label, key) => (
    <div>
      <p className="text-sm font-semibold text-gray-600 mb-1">{label}</p>

      {isEditing ? (
        key === "role" ? (
          // ✅ ถ้า key เป็น role ให้แสดง SELECT
          <select
            value={formData[key] || ""}
            onChange={(e) => handleChange(key, e.target.value)}
            className="border border-gray-300 rounded p-2 w-full"
          >
            <option value="Admin">admin</option>
            <option value="Caddy">caddy</option>
            <option value="Starter">starter</option>
          </select>
        ) : (
          <input
            value={formData[key] || ""}
            onChange={(e) => handleChange(key, e.target.value)}
            className="border border-gray-300 rounded p-2 w-full"
          />
        )
      ) : (
        <p className="text-gray-800 bg-gray-100 p-2 rounded-lg">
          {formData[key]}
        </p>
      )}
    </div>
  );

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl">
      <button
        onClick={() => navigate("/admin")}
        className="mb-6 text-blue-600 font-medium hover:underline"
      >
        ← ย้อนกลับ
      </button>

      <div className="flex flex-col md:flex-row gap-10">
        {/* ✅ รูปภาพ */}
        <div className="flex-shrink-0 text-center">
          <img
            src={
              formData.image instanceof File
                ? URL.createObjectURL(formData.image)
                : formData.image
            }
            alt="employee"
            className="w-44 h-44 object-cover rounded-full mx-auto shadow-md"
          />

          <Input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
            accept="image/*"
          />

          {isEditing && (
            <button
              className="mt-4 px-5 py-2 bg-gray-700 text-white rounded-full hover:bg-gray-800"
              onClick={handleButtonClick}
            >
              เปลี่ยน/อัปโหลดรูปภาพ
            </button>
          )}
        </div>

        {/* ✅ ฟอร์ม */}
        <div className="flex-1 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-700 mb-3 border-b pb-1 text-center">
              ข้อมูลส่วนตัว
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField("ชื่อ", "name")}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-700 mb-3 border-b pb-1 text-center">
              ข้อมูลการติดต่อ
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField("เบอร์โทรศัพท์", "phone")}
              {renderField("อีเมล", "email")}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-700 mb-3 border-b pb-1 text-center">
              ข้อมูลตำแหน่งงาน
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField("ตำแหน่ง", "role")}
            </div>
          </section>

          <div className="pt-4 flex gap-4 flex-wrap">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 shadow"
                >
                  บันทึกการเปลี่ยนแปลง
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-2 bg-gray-400 text-white font-medium rounded-lg hover:bg-gray-500 shadow"
                >
                  ยกเลิก
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-2 bg-green-800 text-white font-medium rounded-lg hover:bg-green-800 shadow"
              >
                แก้ไขข้อมูล
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
