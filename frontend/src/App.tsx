import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "./components/Home";
import Navbar from "./components/Navbar";
import TournamentPage from "./components/TournamentPage";

import FantasyDashboard from "./components/fantasy/FantasyDashboard";
import FantasyStagePicks from "./components/fantasy/FantasyStagePicks";
import FantasyPlayoffPicks from "./components/fantasy/FantasyPlayoffPicks";
import FantasyLeaderboard from "./components/fantasy/FantasyLeaderboard";
import UserFantasyProfile from "./components/fantasy/UserFantasyProfile";

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-gray-100">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tournament/:slug" element={<TournamentPage />} />

          <Route path="/fantasy" element={<FantasyDashboard />} />
          <Route
            path="/fantasy/stage/:stageId/picks"
            element={<FantasyStagePicks />}
          />
          <Route
            path="/fantasy/tournament/:tournamentId/playoffs/picks"
            element={<FantasyPlayoffPicks />}
          />
          <Route path="/fantasy/leaderboard" element={<FantasyLeaderboard />} />
          <Route
            path="/fantasy/profile/:username"
            element={<UserFantasyProfile />}
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
