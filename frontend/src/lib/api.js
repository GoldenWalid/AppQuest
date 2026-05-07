import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = {
  getProfile: () => axios.get(`${API}/profile`).then(r => r.data),
  initiate: (data) => axios.post(`${API}/profile/initiate`, data).then(r => r.data),
  getStats: () => axios.get(`${API}/stats`).then(r => r.data),
  getQuests: (type, status) => {
    const params = {};
    if (type) params.type = type;
    if (status) params.status = status;
    return axios.get(`${API}/quests`, { params }).then(r => r.data);
  },
  completeQuest: (id) => axios.post(`${API}/quests/${id}/complete`).then(r => r.data),
  genDaily: () => axios.post(`${API}/quests/generate-daily`).then(r => r.data),
  getSkills: () => axios.get(`${API}/skills`).then(r => r.data),
  getAchievements: () => axios.get(`${API}/achievements`).then(r => r.data),
  reset: () => axios.post(`${API}/reset`).then(r => r.data),
};
