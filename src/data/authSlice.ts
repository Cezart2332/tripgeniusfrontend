import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { User } from "../types/models";


interface AuthState{
    user: User | null,
    token: string | null
}

const authSlice = createSlice({
    name: "auth",
    initialState:
    {
        user:null,
        token:null
    } as AuthState, 
    reducers:
    {
        setCredentials : (state,action : PayloadAction<{user: User, token: string}>) =>{
            state.user = action.payload.user;
            state.token = action.payload.token;
        },
        setToken: (state,action : PayloadAction<{token:string}>) =>{
            state.token = action.payload.token
        },
        setUser: (state, action : PayloadAction<{user: User}>) => {
            state.user = action.payload.user
        },
        logout: (state) => {
            state.user = null;
            state.token = null;
        }
    }
})
export const { setCredentials,setUser, setToken, logout } = authSlice.actions;
export default authSlice.reducer;