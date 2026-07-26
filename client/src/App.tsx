import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AuthLayout from "./layouts/auth";
import AdminLayout from "layouts/admin";
import UserLayout from "layouts/user";
import { ChakraProvider } from "@chakra-ui/react";
import theme from "theme/theme";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Provider } from "react-redux";
import { store, persistor } from "./redux/store";
import { PersistGate } from "redux-persist/integration/react";

function AppRoutes() {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  return (
    <>
      <ToastContainer />
      <Routes>
        {token && user?.role ? (
          user?.role === "user" ? (
            <Route path="/*" element={<UserLayout setIsLogin={setIsLogin} />} />
          ) : user?.role === "superAdmin" ? (
            <Route path="/*" element={<AdminLayout setIsLogin={setIsLogin} />} />
          ) : (
            <Route path="/*" element={<AuthLayout />} />
          )
        ) : (
          <Route path="/*" element={<AuthLayout />} />
        )}
      </Routes>
    </>
  );
}

export function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ChakraProvider theme={theme}>
          <Router>
            <AppRoutes />
          </Router>
        </ChakraProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
