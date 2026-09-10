/* Beacon local authentication for the academic/demo project. */
(() => {
  "use strict";
  const USERS_KEY = "beacon_users";
  const SESSION_KEY = "beacon_session";

  function users() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch { return []; }
  }
  function save(list) { localStorage.setItem(USERS_KEY, JSON.stringify(list)); }
  function email(v) { return String(v || "").trim().toLowerCase(); }
  function hash(v) {
    let h = 2166136261;
    for (let i=0;i<v.length;i++) { h ^= v.charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24); }
    return (h >>> 0).toString(16);
  }
  function login(e,p) {
    e=email(e); p=String(p||"");
    const u=users().find(x=>x.email===e && x.passwordHash===hash(p));
    if(!u) return {ok:false,message:"Incorrect email or password."};
    const session={id:u.id,name:u.name,email:u.email};
    sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
    return {ok:true,session};
  }
  function register(name,e,p) {
    name=String(name||"").trim(); e=email(e); p=String(p||"");
    if(name.length<2) return {ok:false,message:"Please enter your name."};
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return {ok:false,message:"Please enter a valid email address."};
    if(p.length<6) return {ok:false,message:"Password must be at least 6 characters."};
    const list=users();
    if(list.some(x=>x.email===e)) return {ok:false,message:"An account with this email already exists."};
    list.push({id:`u_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,name,email:e,passwordHash:hash(p)});
    save(list);
    return login(e,p);
  }
  function getSession(){ try{return JSON.parse(sessionStorage.getItem(SESSION_KEY))||null;}catch{return null;} }
  function logout(){sessionStorage.removeItem(SESSION_KEY);window.location.replace("login.html");}
  function requireAuth(){if(!getSession()){window.location.replace("login.html");return false;}return true;}
  window.BeaconAuth={login,register,getSession,logout,requireAuth};
})();
