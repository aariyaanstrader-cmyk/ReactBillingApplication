import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewBill from './pages/NewBill';
import BillsList from './pages/BillsList';
import ViewBill from './pages/ViewBill';
import Settings from './pages/Settings';
import CustomerDetail from './pages/CustomerDetail';
import CustomersList from './pages/CustomersList';
import DataLoad from './pages/DataLoad';
import DataLoadResult from './pages/DataLoadResult';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};

const AppRoutes = () => {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/new-bill" element={<PrivateRoute><NewBill /></PrivateRoute>} />
      <Route path="/bills" element={<PrivateRoute><BillsList /></PrivateRoute>} />
      <Route path="/bills/:id" element={<PrivateRoute><ViewBill /></PrivateRoute>} />
      <Route path="/bills/:id/edit" element={<PrivateRoute><NewBill /></PrivateRoute>} />
      <Route path="/customers" element={<PrivateRoute><CustomersList /></PrivateRoute>} />
      <Route path="/customers/:id" element={<PrivateRoute><CustomerDetail /></PrivateRoute>} />
      <Route path="/data-load" element={<PrivateRoute><DataLoad /></PrivateRoute>} />
      <Route path="/data-load/result" element={<PrivateRoute><DataLoadResult /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
