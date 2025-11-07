import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Router from "./routes/Router";
import "./index.css";

// โค้ดที่ต้องเพิ่มเพื่อแก้ไข Runtime Error
import { library } from '@fortawesome/fontawesome-svg-core';
// Import Icons ที่คุณใช้ทั้งหมดจากทุกไฟล์มาตั้งค่าที่นี่
import { faExclamation, faCircleCheck } from '@fortawesome/free-solid-svg-icons';

library.add(faExclamation, faCircleCheck);
// สิ้นสุดโค้ดที่ต้องเพิ่ม

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={Router} />
    </AuthProvider>
  </React.StrictMode>
);