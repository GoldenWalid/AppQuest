import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Send cookies (session_token httpOnly) on every request
axios.defaults.withCredentials = true;

export const api = {
  // auth
  exchangeSession: (session_id) =>
    axios.post(`${API}/auth/session`, { session_id }).then((r) => r.data),
  me: () => axios.get(`${API}/auth/me`).then((r) => r.data),
  logout: () => axios.post(`${API}/auth/logout`).then((r) => r.data),

  // app
  getProfile: () => axios.get(`${API}/profile`).then((r) => r.data),
  awakenChat: (session_id, messages) =>
    axios.post(`${API}/awaken/chat`, { session_id, messages }).then((r) => r.data),
  getStats: () => axios.get(`${API}/stats`).then((r) => r.data),
  getQuests: (type, status) => {
    const params = {};
    if (type) params.type = type;
    if (status) params.status = status;
    return axios.get(`${API}/quests`, { params }).then((r) => r.data);
  },
  completeQuest: (id) => axios.post(`${API}/quests/${id}/complete`).then((r) => r.data),
  decomposeQuest: (id) => axios.post(`${API}/quests/${id}/decompose`).then((r) => r.data),
  toggleStep: (questId, stepId, done) =>
    axios.patch(`${API}/quests/${questId}/steps/${stepId}`, { done }).then((r) => r.data),
  genDaily: () => axios.post(`${API}/quests/generate-daily`).then((r) => r.data),
  getSkills: () => axios.get(`${API}/skills`).then((r) => r.data),
  getAchievements: () => axios.get(`${API}/achievements`).then((r) => r.data),
  reset: () => axios.post(`${API}/reset`).then((r) => r.data),
};
