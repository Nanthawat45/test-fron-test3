import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Router from "./routes/Router";
import "./index.css";

// Font Awesome setup (ใส่ไอคอนที่ใช้จริงครั้งเดียว)
import { library } from "@fortawesome/fontawesome-svg-core";
import { faExclamation, faCircleCheck } from "@fortawesome/free-solid-svg-icons";
library.add(faExclamation, faCircleCheck);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={Router} />
    </AuthProvider>
  </React.StrictMode>
);
