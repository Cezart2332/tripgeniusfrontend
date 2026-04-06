import axios from 'axios';
import { store } from "./store";
import {setToken, logout} from './authSlice'

const baseURL = import.meta.env.VITE_BASE_URL;

const api = axios.create({
    baseURL,
    withCredentials:true
})


api.interceptors.request.use((config) =>{
    const token = store.getState().auth.token;
    if(token) config.headers.Authorization = `Bearer ${token}`
    return config
})

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const isRefreshCall = error.config?.url?.includes('/auth/refresh');
        
        if (error.response?.status === 401 && !isRefreshCall)
        {
            try
            {
                const res = await api.post('/api/auth/refresh')
                store.dispatch(setToken({ token: res.data.token }))
                if (error.config?.headers) {
                    error.config.headers.Authorization = `Bearer ${res.data.token}`
                }
                return api(error.config)
            }
            catch
            {
                store.dispatch(logout())
                await api.post('api/auth/logout')
            }
        } 
        return Promise.reject(error)
    }
)
export default api;