import { BrowserRouter, Route, Routes } from 'react-router-dom';
import LandingPage from './routes/LandingPage';
import RoomPage from './routes/RoomPage';

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/room/:code" element={<RoomPage />} />
    </Routes>
  </BrowserRouter>
);

export default App;
