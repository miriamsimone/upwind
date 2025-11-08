import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import StudentDashboard from './components/StudentDashboard';

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard/s1" replace />} />
      <Route path="/dashboard/:studentId" element={<StudentDashboard />} />
      <Route path="*" element={<Navigate to="/dashboard/s1" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
