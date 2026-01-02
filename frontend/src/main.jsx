import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./App.css";

// main.jsx
import "primereact/resources/themes/lara-light-indigo/theme.css"; // ou outro theme
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
